import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { NASDUCK_MINT, DEX_PROGRAM_IDS } from '../_shared/constants.ts'

// Accept either a full RPC URL or a bare API key in this secret — the
// Supabase dashboard's secret UI shows the key as typed, no formatting
// hints, so a bare key is an easy and expected thing to paste here.
const HELIUS_SECRET = Deno.env.get('HELIUS_RPC_URL')
const HELIUS_RPC_URL =
  HELIUS_SECRET && !HELIUS_SECRET.startsWith('http')
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_SECRET}`
    : HELIUS_SECRET
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
const BASE58 = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/

const WINDOW_DAYS = 14
const CACHE_TTL_MS = 10 * 60 * 1000
const MAX_SIGNATURES = 200
const DEX_PROGRAMS = new Set(DEX_PROGRAM_IDS)

interface TradeSummary {
  buys: number
  sells: number
  nasduckBought: number
  nasduckSold: number
  costBasisSol: number
  proceedsSol: number
  currentBalance: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!HELIUS_RPC_URL) throw new Error('HELIUS_RPC_URL not configured')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('supabase service credentials not configured')

    const { wallet } = await req.json().catch(() => ({}))
    if (typeof wallet !== 'string' || !BASE58.test(wallet)) {
      return json({ error: 'invalid wallet address' }, 400)
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    const { data: cached } = await db.from('wallet_trade_cache').select('*').eq('wallet', wallet).maybeSingle()
    if (cached && Date.now() - new Date(cached.computed_at).getTime() < CACHE_TTL_MS) {
      return json({ ...toSummary(cached), cached: true })
    }

    const summary = await computeTradeSummary(wallet)

    await db.from('wallet_trade_cache').upsert(
      {
        wallet,
        computed_at: new Date().toISOString(),
        buys: summary.buys,
        sells: summary.sells,
        nasduck_bought: summary.nasduckBought,
        nasduck_sold: summary.nasduckSold,
        cost_basis_sol: summary.costBasisSol,
        proceeds_sol: summary.proceedsSol,
        current_balance: summary.currentBalance,
      },
      { onConflict: 'wallet' },
    )

    return json({ ...summary, cached: false })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500)
  }
})

function toSummary(row: Record<string, unknown>): TradeSummary {
  return {
    buys: Number(row.buys),
    sells: Number(row.sells),
    nasduckBought: Number(row.nasduck_bought),
    nasduckSold: Number(row.nasduck_sold),
    costBasisSol: Number(row.cost_basis_sol),
    proceedsSol: Number(row.proceeds_sol),
    currentBalance: Number(row.current_balance),
  }
}

async function computeTradeSummary(wallet: string): Promise<TradeSummary> {
  const cutoffSec = Math.floor((Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000) / 1000)

  const signatures: string[] = []
  let before: string | undefined
  while (signatures.length < MAX_SIGNATURES) {
    const page = (await rpc(HELIUS_RPC_URL!, 'getSignaturesForAddress', [
      wallet,
      { limit: 1000, before },
    ])) as { signature: string; blockTime: number | null; err: unknown }[]
    if (!page.length) break

    for (const item of page) {
      if (item.err) continue
      if (item.blockTime != null && item.blockTime < cutoffSec) {
        return finish(wallet, await summarize(wallet, signatures))
      }
      signatures.push(item.signature)
      if (signatures.length >= MAX_SIGNATURES) break
    }
    before = page[page.length - 1]?.signature
    if (page.length < 1000) break
  }

  return finish(wallet, await summarize(wallet, signatures))
}

async function finish(wallet: string, partial: Omit<TradeSummary, 'currentBalance'>): Promise<TradeSummary> {
  // getTokenAccountsByOwner's mint filter resolves the token program (classic
  // SPL vs Token-2022) automatically — NASDUCK is Token-2022, no special
  // handling needed here as a result.
  const balanceResult = (await rpc(HELIUS_RPC_URL!, 'getTokenAccountsByOwner', [
    wallet,
    { mint: NASDUCK_MINT },
    { encoding: 'jsonParsed' },
  ])) as { value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] }

  let currentBalance = 0
  for (const acc of balanceResult.value ?? []) {
    currentBalance += acc.account?.data?.parsed?.info?.tokenAmount?.uiAmount ?? 0
  }

  return { ...partial, currentBalance }
}

async function summarize(wallet: string, signatures: string[]): Promise<Omit<TradeSummary, 'currentBalance'>> {
  let buys = 0
  let sells = 0
  let nasduckBought = 0
  let nasduckSold = 0
  let costBasisSol = 0
  let proceedsSol = 0

  const CONCURRENCY = 4
  let cursor = 0

  async function worker() {
    while (cursor < signatures.length) {
      const sig = signatures[cursor++]
      let tx: unknown = null
      try {
        tx = await rpc(HELIUS_RPC_URL!, 'getTransaction', [
          sig,
          { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
        ])
      } catch {
        continue
      }
      const result = classifyTransaction(tx, wallet)
      if (!result) continue
      if (result.type === 'buy') {
        buys++
        nasduckBought += result.nasduckAmount
        costBasisSol += result.solAmount
      } else {
        sells++
        nasduckSold += result.nasduckAmount
        proceedsSol += result.solAmount
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, signatures.length) }, worker))

  return { buys, sells, nasduckBought, nasduckSold, costBasisSol, proceedsSol }
}

function classifyTransaction(
  tx: any,
  wallet: string,
): { type: 'buy' | 'sell'; nasduckAmount: number; solAmount: number } | null {
  const meta = tx?.meta
  const msg = tx?.transaction?.message
  if (!meta || !msg) return null

  const pre = (meta.preTokenBalances ?? []).find((b: any) => b.owner === wallet && b.mint === NASDUCK_MINT)
  const post = (meta.postTokenBalances ?? []).find((b: any) => b.owner === wallet && b.mint === NASDUCK_MINT)
  const preAmount = pre?.uiTokenAmount?.uiAmount ?? 0
  const postAmount = post?.uiTokenAmount?.uiAmount ?? 0
  const nasduckDelta = postAmount - preAmount
  // Real NASDUCK signature history includes bot/MEV-scan transactions that
  // touch a pool account without moving any balance (confirmed live: same
  // pre/post token balances across every account in the tx) — this check
  // is what filters those out, not just a theoretical edge case.
  if (nasduckDelta === 0) return null

  const programIds: string[] = [
    ...(msg.instructions ?? []).map((ix: any) => ix.programId),
    ...(meta.innerInstructions ?? []).flatMap((inner: any) => (inner.instructions ?? []).map((ix: any) => ix.programId)),
  ]
  if (!programIds.some((id) => DEX_PROGRAMS.has(id))) return null

  const accountKeys: string[] = (msg.accountKeys ?? []).map((k: any) => (typeof k === 'string' ? k : k.pubkey))
  const walletIndex = accountKeys.indexOf(wallet)
  if (walletIndex === -1) return null

  const preLamports = meta.preBalances?.[walletIndex]
  const postLamports = meta.postBalances?.[walletIndex]
  if (typeof preLamports !== 'number' || typeof postLamports !== 'number') return null

  let solDelta = (postLamports - preLamports) / 1e9
  if (walletIndex === 0 && typeof meta.fee === 'number') {
    solDelta += meta.fee / 1e9
  }

  if (nasduckDelta > 0) {
    return { type: 'buy', nasduckAmount: nasduckDelta, solAmount: Math.max(0, -solDelta) }
  }
  return { type: 'sell', nasduckAmount: -nasduckDelta, solAmount: Math.max(0, solDelta) }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}

const RETRY_DELAYS_MS = [300, 800, 1800]

async function rpc(url: string, method: string, params: unknown[]) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 'nasduck-trades', method, params }),
    })

    if (res.status === 429 && attempt < RETRY_DELAYS_MS.length) {
      await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      continue
    }

    const data = await res.json()
    if (data.error) {
      const message: string = data.error.message ?? `${method} rpc error`
      if (/rate limit/i.test(message) && attempt < RETRY_DELAYS_MS.length) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
        continue
      }
      throw new Error(message)
    }
    return data.result
  }
}
