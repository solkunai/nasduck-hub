import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { NASDUCK_MINT, KNOWN_POOL_ADDRESSES } from '../_shared/constants.ts'

const POOL_ADDRESSES = new Set(KNOWN_POOL_ADDRESSES)

const HELIUS_SECRET = Deno.env.get('HELIUS_RPC_URL')
const HELIUS_RPC_URL =
  HELIUS_SECRET && !HELIUS_SECRET.startsWith('http')
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_SECRET}`
    : HELIUS_SECRET
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

interface Holder {
  wallet: string
  balance: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json({ error: 'unauthorized' }, 401)
    }
    if (!HELIUS_RPC_URL) throw new Error('HELIUS_RPC_URL not configured')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('supabase service credentials not configured')

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // getTokenLargestAccounts caps at 20 by design (a Solana RPC limit, not
    // a choice here) — same as ANSEM Hub's version. Filtering pools out of
    // that fixed 20 means real-holder rank can end up under 20 rows; no way
    // to ask this RPC for "the next 20" to backfill, so that's accepted.
    const largest = await rpc(HELIUS_RPC_URL, 'getTokenLargestAccounts', [NASDUCK_MINT])
    const accounts = (largest.value ?? []) as { address: string; uiAmount: number | null }[]
    if (!accounts.length) return json({ ok: true, holders: 0 })

    const owners = await rpc(HELIUS_RPC_URL, 'getMultipleAccounts', [
      accounts.map((a) => a.address),
      { encoding: 'jsonParsed' },
    ])

    const parsedAccounts = (owners.value ?? []) as { data?: { parsed?: { info?: { owner?: string } } } }[]

    // Confirmed live, not theoretical: the first real run of this function
    // ranked NASDUCK's own PumpSwap pool as the #1 "holder" — a pool
    // naturally owns the largest single token account (its own reserves).
    // Real but useless/misleading on a community leaderboard, so excluded.
    const holders: Holder[] = accounts
      .map((acc, i) => {
        const owner = parsedAccounts[i]?.data?.parsed?.info?.owner
        return owner ? { wallet: owner, balance: acc.uiAmount ?? 0 } : null
      })
      .filter((h): h is Holder => h !== null && !POOL_ADDRESSES.has(h.wallet))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 20)

    if (!holders.length) return json({ ok: true, holders: 0 })

    const wallets = holders.map((h) => h.wallet)

    const since = new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString()
    const { data: history } = await db
      .from('holder_balance_history')
      .select('wallet, balance, snapshot_at')
      .in('wallet', wallets)
      .lte('snapshot_at', since)
      .order('snapshot_at', { ascending: false })

    const priorBalance = new Map<string, number>()
    for (const row of history ?? []) {
      if (!priorBalance.has(row.wallet)) priorBalance.set(row.wallet, Number(row.balance))
    }

    const now = new Date().toISOString()

    const snapshotRows = holders.map((h, i) => {
      const prior = priorBalance.get(h.wallet)
      const change24h = prior && prior > 0 ? ((h.balance - prior) / prior) * 100 : 0
      return { wallet: h.wallet, rank: i + 1, balance: h.balance, change_24h: change24h, updated_at: now }
    })

    await db.from('holder_balance_history').insert(holders.map((h) => ({ wallet: h.wallet, balance: h.balance, snapshot_at: now })))
    await db.from('holder_snapshots').upsert(snapshotRows, { onConflict: 'wallet' })
    await db.from('holder_snapshots').delete().not('wallet', 'in', `(${wallets.join(',')})`)

    return json({ ok: true, holders: holders.length })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

async function rpc(url: string, method: string, params: unknown[]) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 'nasduck-snapshot', method, params }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message ?? `${method} rpc error`)
  return data.result
}
