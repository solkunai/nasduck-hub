import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface ClickerLeader {
  wallet: string
  score: number
}

const FLUSH_INTERVAL_MS = 1500

export function useClickerGame(wallet: string | null) {
  const [score, setScore] = useState(0)
  const [leaders, setLeaders] = useState<ClickerLeader[]>([])
  const pendingRef = useRef(0)
  const flushingRef = useRef(false)

  const loadLeaders = useCallback(async () => {
    const { data } = await supabase.from('clicker_scores').select('wallet, score').order('score', { ascending: false }).limit(5)
    setLeaders((data ?? []).map((r) => ({ wallet: r.wallet, score: Number(r.score) })))
  }, [])

  useEffect(() => {
    if (!wallet) {
      setScore(0)
      return
    }
    supabase
      .from('clicker_scores')
      .select('score')
      .eq('wallet', wallet)
      .maybeSingle()
      .then(({ data }) => setScore(data ? Number(data.score) : 0))
  }, [wallet])

  useEffect(() => {
    loadLeaders()
    const id = setInterval(loadLeaders, 20_000)
    return () => clearInterval(id)
  }, [loadLeaders])

  const flush = useCallback(async () => {
    if (!wallet || flushingRef.current || pendingRef.current === 0) return
    flushingRef.current = true
    const amount = pendingRef.current
    pendingRef.current = 0
    try {
      const { data, error } = await supabase.rpc('increment_clicker_score', { p_wallet: wallet, p_amount: amount })
      if (!error && typeof data === 'number') setScore(data)
    } finally {
      flushingRef.current = false
    }
  }, [wallet])

  useEffect(() => {
    const id = setInterval(flush, FLUSH_INTERVAL_MS)
    return () => clearInterval(id)
  }, [flush])

  const feed = useCallback(() => {
    setScore((s) => s + 1)
    if (wallet) pendingRef.current += 1
  }, [wallet])

  return { score, leaders, feed }
}
