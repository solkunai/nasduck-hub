import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface PayoutEntry {
  id: number
  claimTx: string
  amountSol: number
  holdersPaid: number
  paidAt: string
}

function toEntry(row: any): PayoutEntry {
  return {
    id: row.id,
    claimTx: row.claim_tx,
    amountSol: Number(row.amount_lamports_delta) / 1e9,
    holdersPaid: row.holders_paid,
    paidAt: row.paid_at,
  }
}

const PAGE_SIZE = 10
const NASDUCK_MINT = '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze'

// "Last 10, then pagination" as asked for, plus live updates for new
// entries — same live-feed pattern as useWhaleFeed (a Realtime subscription
// prepending new rows, not polling) rather than reusing the interval-poll
// pattern from useHolderLeaderboard/useOtcRewards. Polling and "load more"
// pagination don't mix cleanly: a timed refetch-and-replace of page one
// would silently discard whatever additional pages the visitor had already
// loaded. Prepending a single new row on a real Realtime INSERT event has
// no such conflict — it only ever adds to the top, never touches or
// resets what's already loaded further down.
export function useOtcPayoutFeed() {
  const [entries, setEntries] = useState<PayoutEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    supabase
      .from('otc_desks_payouts')
      .select('*')
      .eq('mint', NASDUCK_MINT)
      .order('paid_at', { ascending: false })
      .range(0, PAGE_SIZE - 1)
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        const rows = (data ?? []).map(toEntry)
        setEntries(rows)
        setHasMore(rows.length === PAGE_SIZE)
        setLoading(false)
      })

    const channel = supabase
      .channel('otc-desks-payouts-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'otc_desks_payouts', filter: `mint=eq.${NASDUCK_MINT}` },
        (payload) => {
          setEntries((prev) => [toEntry(payload.new), ...prev])
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const loadMore = useCallback(async () => {
    setLoadingMore(true)
    const { data, error: err } = await supabase
      .from('otc_desks_payouts')
      .select('*')
      .eq('mint', NASDUCK_MINT)
      .order('paid_at', { ascending: false })
      .range(entries.length, entries.length + PAGE_SIZE - 1)
    if (err) {
      setError(err.message)
      setLoadingMore(false)
      return
    }
    const rows = (data ?? []).map(toEntry)
    setEntries((prev) => [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    setLoadingMore(false)
  }, [entries.length])

  return { entries, loading, loadingMore, hasMore, error, loadMore }
}
