import { useEffect, useState } from 'react'
import { fetchOrder, type JupiterOrder } from '../lib/swap'

export interface OrderState {
  order: JupiterOrder | null
  loading: boolean
  error: string | null
}

// Polls a fresh order every 6s (and on input change). Jupiter's free
// lite-api tier caps at ~1 req/sec per client, shared with MarketProvider's
// own price poll for a single visitor — both intervals are tuned to leave
// real margin under that ceiling (see MarketProvider for why "barely under"
// isn't good enough in practice).
export function useJupiterOrder(
  inputMint: string,
  outputMint: string,
  amountRaw: number,
  taker?: string,
): OrderState {
  const [state, setState] = useState<OrderState>({ order: null, loading: false, error: null })

  useEffect(() => {
    if (!amountRaw || amountRaw <= 0) {
      setState({ order: null, loading: false, error: null })
      return
    }

    let cancelled = false
    async function load() {
      setState((s) => ({ ...s, loading: true }))
      try {
        const order = await fetchOrder(inputMint, outputMint, amountRaw, taker)
        if (cancelled) return
        setState({ order, loading: false, error: null })
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'quote failed'
        setState((s) => ({
          ...s,
          loading: false,
          error: /429|rate limit/i.test(message) ? 'price feed busy, retrying…' : message,
        }))
      }
    }

    load()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 6000)

    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [inputMint, outputMint, amountRaw, taker])

  return state
}
