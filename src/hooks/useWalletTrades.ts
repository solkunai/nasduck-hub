import { useCallback, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface WalletTrades {
  buys: number
  sells: number
  nasduckBought: number
  nasduckSold: number
  costBasisSol: number
  proceedsSol: number
  currentBalance: number
  cached: boolean
}

export function useWalletTrades() {
  const [data, setData] = useState<WalletTrades | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTrades = useCallback(async (wallet: string) => {
    setLoading(true)
    setError(null)
    setData(null)

    const { data: result, error: invokeError } = await supabase.functions.invoke('wallet-trades', {
      body: { wallet },
    })

    if (invokeError || result?.error) {
      setError(invokeError?.message ?? result?.error ?? 'failed to load trade history')
      setLoading(false)
      return
    }

    setData(result as WalletTrades)
    setLoading(false)
  }, [])

  return { data, loading, error, fetchTrades }
}
