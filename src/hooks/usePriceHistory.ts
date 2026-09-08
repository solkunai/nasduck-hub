import { useEffect, useRef, useState } from 'react'

// Builds a real (not simulated) rolling price series purely from what
// MarketProvider already polls — no separate OHLCV API needed. Trade-off:
// history only covers however long the tab's been open, capped at maxPoints.
// A real multi-day chart needs a proper candle-data source (DexScreener has
// no public OHLCV endpoint; Birdeye's costs a paid key) — worth revisiting
// once that's actually researched, not guessed at.
export function usePriceHistory(price: number, maxPoints = 120): number[] {
  const [history, setHistory] = useState<number[]>(() => (price > 0 ? [price] : []))
  const lastPrice = useRef(price)

  useEffect(() => {
    if (price <= 0 || price === lastPrice.current) return
    lastPrice.current = price
    setHistory((h) => {
      const next = h.concat(price)
      return next.length > maxPoints ? next.slice(next.length - maxPoints) : next
    })
  }, [price, maxPoints])

  return history
}
