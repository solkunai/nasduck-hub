import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface WhaleTrade {
  id: number
  signature: string
  wallet: string
  side: 'buy' | 'sell'
  tokenAmount: number
  usdAmount: number
  createdAt: string
}

function toTrade(row: any): WhaleTrade {
  return {
    id: row.id,
    signature: row.signature,
    wallet: row.wallet,
    side: row.side,
    tokenAmount: Number(row.token_amount),
    usdAmount: Number(row.usd_amount),
    createdAt: row.created_at,
  }
}

const MAX_ROWS = 30

export function useWhaleFeed() {
  const [trades, setTrades] = useState<WhaleTrade[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('whale_trades')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(MAX_ROWS)
      .then(({ data }) => {
        if (cancelled) return
        setTrades((data ?? []).map(toTrade))
        setLoading(false)
      })

    // Live updates as real swaps land — no polling needed. New rows only
    // arrive when the webhook actually fires on a real trade above the
    // $250 threshold, so this can sit idle for a while on a quiet token.
    const channel = supabase
      .channel('whale-trades-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whale_trades' }, (payload) => {
        setTrades((prev) => [toTrade(payload.new), ...prev].slice(0, MAX_ROWS))
      })
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  return { trades, loading }
}
