// Same DexScreener + Jupiter combo validated on ANSEM Hub: both free, no
// API key, no rate-limit surprises at this app's polling cadence.
const DEX_TOKENS = 'https://api.dexscreener.com/latest/dex/tokens'

interface DexPair {
  pairAddress?: string
  baseToken?: { address?: string }
  quoteToken?: { symbol?: string }
  priceUsd?: string
  priceChange?: { h1?: number }
  marketCap?: number
  fdv?: number
  volume?: { h24?: number }
  liquidity?: { usd?: number }
}

export interface TokenMarket {
  priceUsd: number
  marketCap: number
  volume24h: number
  liquidityUsd: number
  pairAddress: string | null
}

const MAJOR_QUOTE_SYMBOLS = new Set(['SOL', 'USDC', 'USDT'])
const MAX_HOURLY_CHANGE_PCT = 1000

// DexScreener returns every pair a token appears in, including thin/broken
// pools that can report wildly wrong prices. Filter obvious outliers,
// prefer major-quote pairs, then reject anything still far from the median
// before picking by liquidity. (Same defensive logic proven necessary on
// ANSEM Hub, where an unfiltered pick once reported a $3.1T market cap off
// a single broken pump.fun pool.)
function pickBase(pairs: DexPair[], mint: string): TokenMarket | null {
  let candidates = pairs.filter((p) => {
    if (p.baseToken?.address !== mint) return false
    const priceUsd = parseFloat(p.priceUsd ?? '')
    if (!Number.isFinite(priceUsd) || priceUsd <= 0) return false
    const h1Change = p.priceChange?.h1
    if (typeof h1Change === 'number' && Math.abs(h1Change) > MAX_HOURLY_CHANGE_PCT) return false
    return true
  })
  if (!candidates.length) return null

  const majorQuoted = candidates.filter((p) => MAJOR_QUOTE_SYMBOLS.has(p.quoteToken?.symbol ?? ''))
  if (majorQuoted.length) candidates = majorQuoted

  const prices = candidates.map((p) => parseFloat(p.priceUsd ?? '0')).sort((a, b) => a - b)
  const median = prices[Math.floor(prices.length / 2)]
  if (median > 0) {
    candidates = candidates.filter((p) => Math.abs(parseFloat(p.priceUsd ?? '0') - median) / median < 0.5)
  }

  candidates.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))
  const top = candidates[0]
  if (!top) return null

  return {
    priceUsd: parseFloat(top.priceUsd ?? '0'),
    marketCap: top.marketCap ?? top.fdv ?? 0,
    volume24h: top.volume?.h24 ?? 0,
    liquidityUsd: top.liquidity?.usd ?? 0,
    pairAddress: top.pairAddress ?? null,
  }
}

export async function fetchTokenMarket(mint: string): Promise<TokenMarket | null> {
  const res = await fetch(`${DEX_TOKENS}/${mint}`)
  if (!res.ok) throw new Error(`dexscreener ${res.status}`)
  const json = (await res.json()) as { pairs?: DexPair[] }
  return pickBase(json.pairs ?? [], mint)
}

const JUP_PRICE = 'https://lite-api.jup.ag/price/v3'

export interface JupPrice {
  usdPrice: number
  priceChange24h: number
}

export async function fetchJupiterPrices(mints: string[]): Promise<Record<string, JupPrice>> {
  const res = await fetch(`${JUP_PRICE}?ids=${mints.join(',')}`)
  if (!res.ok) throw new Error(`jupiter price ${res.status}`)
  const json = (await res.json()) as Record<string, { usdPrice?: number; priceChange24h?: number }>
  const out: Record<string, JupPrice> = {}
  for (const [mint, v] of Object.entries(json)) {
    if (v && typeof v.usdPrice === 'number') {
      out[mint] = { usdPrice: v.usdPrice, priceChange24h: v.priceChange24h ?? 0 }
    }
  }
  return out
}

const JUP_TOKEN_SEARCH = 'https://lite-api.jup.ag/tokens/v2/search'

// Free, no API key, same host as fetchJupiterPrices. Jupiter indexes this
// itself, so it's accurate without paginating through Helius token accounts.
export async function fetchHolderCount(mint: string): Promise<number | null> {
  const res = await fetch(`${JUP_TOKEN_SEARCH}?query=${mint}`)
  if (!res.ok) throw new Error(`jupiter token search ${res.status}`)
  const results = (await res.json()) as { id?: string; holderCount?: number }[]
  const match = results.find((r) => r.id === mint)
  return typeof match?.holderCount === 'number' ? match.holderCount : null
}
