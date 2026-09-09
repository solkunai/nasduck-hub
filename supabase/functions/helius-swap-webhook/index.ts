import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { NASDUCK_MINT, KNOWN_POOL_ADDRESSES } from '../_shared/constants.ts'

// Reuses CRON_SECRET as the webhook's shared secret (Helius calls this
// with it in the Authorization header, matching the "authHeader" value set
// when the webhook was registered) rather than asking for a separate one —
// Supabase Edge Function secrets are project-scoped, so it's already
// available here with no new dashboard step.
const WEBHOOK_SECRET = Deno.env.get('CRON_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const POOL_ADDRESSES = new Set(KNOWN_POOL_ADDRESSES)

// Below this, a print doesn't earn a place on a "whale tape" — tune freely,
// this is a display threshold, not a correctness one.
const MIN_USD_AMOUNT = 250

interface HeliusTokenTransfer {
  fromUserAccount?: string
  toUserAccount?: string
  tokenAmount?: number
  mint?: string
}

interface HeliusTransaction {
  signature: string
  timestamp: number
  tokenTransfers?: HeliusTokenTransfer[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!WEBHOOK_SECRET || req.headers.get('authorization') !== WEBHOOK_SECRET) {
      return json({ error: 'unauthorized' }, 401)
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('supabase service credentials not configured')

    const rawBody = await req.text()
    const txs = JSON.parse(rawBody || '[]') as HeliusTransaction[]
    if (!Array.isArray(txs)) return json({ error: 'expected an array of transactions' }, 400)

    const trades = txs.map(classify).filter((t): t is NonNullable<typeof t> => t !== null)
    if (!trades.length) return json({ ok: true, inserted: 0 })

    // One price lookup per webhook delivery (a batch of transactions, not
    // one call per trade) — DexScreener is free/keyless, same source
    // already used everywhere else in this app.
    const price = await fetchNasduckPrice()

    const rows = trades
      .map((t) => ({ ...t, usdAmount: t.tokenAmount * price }))
      .filter((t) => t.usdAmount >= MIN_USD_AMOUNT)
      .map((t) => ({
        signature: t.signature,
        wallet: t.wallet,
        side: t.side,
        token_amount: t.tokenAmount,
        usd_amount: t.usdAmount,
        created_at: t.createdAt,
      }))

    if (!rows.length) return json({ ok: true, inserted: 0 })

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { error } = await db.from('whale_trades').upsert(rows, { onConflict: 'signature', ignoreDuplicates: true })
    if (error) throw new Error(error.message)

    return json({ ok: true, inserted: rows.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500)
  }
})

function classify(tx: HeliusTransaction) {
  const nasduckTransfers = (tx.tokenTransfers ?? []).filter(
    (t) => t.mint === NASDUCK_MINT && typeof t.tokenAmount === 'number' && t.tokenAmount > 0,
  )
  if (!nasduckTransfers.length) return null

  // A swap can show multiple NASDUCK transfers if it routes through more
  // than one hop — the largest is treated as the representative trade
  // rather than trying to reconstruct the whole route (fine for a display
  // feed, not for exact accounting).
  const primary = nasduckTransfers.reduce((a, b) => ((b.tokenAmount ?? 0) > (a.tokenAmount ?? 0) ? b : a))

  const fromIsPool = primary.fromUserAccount ? POOL_ADDRESSES.has(primary.fromUserAccount) : false
  const toIsPool = primary.toUserAccount ? POOL_ADDRESSES.has(primary.toUserAccount) : false
  const createdAt = new Date(tx.timestamp * 1000).toISOString()

  if (fromIsPool && !toIsPool && primary.toUserAccount) {
    return { signature: tx.signature, side: 'buy' as const, wallet: primary.toUserAccount, tokenAmount: primary.tokenAmount!, createdAt }
  }
  if (toIsPool && !fromIsPool && primary.fromUserAccount) {
    return { signature: tx.signature, side: 'sell' as const, wallet: primary.fromUserAccount, tokenAmount: primary.tokenAmount!, createdAt }
  }
  // Neither side (or both sides) is a known pool — a plain wallet-to-wallet
  // transfer, or pool-to-pool liquidity movement, not a swap.
  return null
}

async function fetchNasduckPrice(): Promise<number> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${NASDUCK_MINT}`)
  const data = await res.json()
  const pairs = (data.pairs ?? []) as { priceUsd?: string; liquidity?: { usd?: number } }[]
  const top = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0]
  return top ? parseFloat(top.priceUsd ?? '0') : 0
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
