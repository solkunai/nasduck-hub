import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchTokenMarket, fetchJupiterPrices, fetchHolderCount } from '../lib/prices'
import { NASDUCK_MINT, WSOL_MINT } from '../lib/nasduck'

export interface Market {
  price: number
  change24h: number
  marketCap: number
  volume24h: number
  liquidityUsd: number
  holders: number
  solPrice: number
  pairAddress: string | null
  live: boolean
}

const fallback: Market = {
  price: 0.00345,
  change24h: 0,
  marketCap: 3_470_000,
  volume24h: 0,
  liquidityUsd: 0,
  holders: 0,
  solPrice: 0,
  pairAddress: null,
  live: false,
}

const MarketContext = createContext<Market>(fallback)

export function useMarket(): Market {
  return useContext(MarketContext)
}

export function MarketProvider({ children }: { children: ReactNode }) {
  const [market, setMarket] = useState<Market>(fallback)

  // Fast lane: price + 24h change every 5s via Jupiter's price v3. Jupiter's
  // free lite-api tier caps at 1 req/sec (60/min sliding window) per client —
  // this loop and the swap widget's own quote poll share that budget for a
  // single visitor, so both stay well under it with real margin (learned the
  // hard way on ANSEM Hub: 2s+2s summed to just over the limit for one tab).
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const p = await fetchJupiterPrices([NASDUCK_MINT, WSOL_MINT])
        if (cancelled) return
        setMarket((prev) => ({
          ...prev,
          price: p[NASDUCK_MINT]?.usdPrice ?? prev.price,
          change24h: p[NASDUCK_MINT]?.priceChange24h ?? prev.change24h,
          solPrice: p[WSOL_MINT]?.usdPrice ?? prev.solPrice,
          live: true,
        }))
      } catch {
        // keep last good values
      }
    }
    load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 5000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  // Slow lane: market cap, volume, liquidity, holder count every 30s.
  useEffect(() => {
    let cancelled = false
    async function load() {
      const results = await Promise.allSettled([fetchTokenMarket(NASDUCK_MINT), fetchHolderCount(NASDUCK_MINT)])
      if (cancelled) return

      const snap = results[0].status === 'fulfilled' ? results[0].value : null
      const holders = results[1].status === 'fulfilled' ? results[1].value : null

      setMarket((prev) => ({
        ...prev,
        marketCap: snap?.marketCap ?? prev.marketCap,
        volume24h: snap?.volume24h ?? prev.volume24h,
        liquidityUsd: snap?.liquidityUsd ?? prev.liquidityUsd,
        pairAddress: snap?.pairAddress ?? prev.pairAddress,
        holders: holders ?? prev.holders,
      }))
    }
    load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 30_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return <MarketContext.Provider value={market}>{children}</MarketContext.Provider>
}
