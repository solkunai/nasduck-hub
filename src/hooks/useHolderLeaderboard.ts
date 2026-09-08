import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface HolderRow {
  wallet: string
  rank: number
  balance: number
  change24h: number
  updatedAt: string
}

export function useHolderLeaderboard() {
  const [holders, setHolders] = useState<HolderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase.from('holder_snapshots').select('*').order('rank', { ascending: true }).limit(20)
      if (cancelled) return
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      const rows = (data ?? []).map((r) => ({
        wallet: r.wallet,
        rank: r.rank,
        balance: Number(r.balance),
        change24h: Number(r.change_24h),
        updatedAt: r.updated_at,
      }))
      setHolders(rows)
      setUpdatedAt(rows[0]?.updatedAt ?? null)
      setLoading(false)
    }
    load()
    // The backing snapshot refreshes every 5 minutes server-side (pg_cron) —
    // poll a bit slower than that so this doesn't spam reads between real
    // updates.
    const id = setInterval(load, 6 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { holders, loading, error, updatedAt }
}
