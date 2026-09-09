import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface OtcRewards {
  rewardSymbol: string
  rewardMint: string
  paidToHoldersSol: number
  creatorFeesEarnedSol: number
  toProtocolSol: number
  toPotSol: number
  toBuybackSol: number
  owedSol: number
  lastPaidHolders: number
  lastDistributedAt: string | null
  lastClaimTx: string | null
  updatedAt: string
}

const LAMPORTS_PER_SOL = 1e9

export function useOtcRewards() {
  const [rewards, setRewards] = useState<OtcRewards | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const { data, error: err } = await supabase
        .from('otc_desks_rewards')
        .select('*')
        .eq('mint', '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze')
        .maybeSingle()
      if (cancelled) return
      if (err) {
        setError(err.message)
        setLoading(false)
        return
      }
      setRewards(
        data
          ? {
              rewardSymbol: data.reward_symbol,
              rewardMint: data.reward_mint,
              paidToHoldersSol: Number(data.paid_to_holders_lamports) / LAMPORTS_PER_SOL,
              creatorFeesEarnedSol: Number(data.creator_fees_earned_lamports) / LAMPORTS_PER_SOL,
              toProtocolSol: Number(data.to_protocol_lamports) / LAMPORTS_PER_SOL,
              toPotSol: Number(data.to_pot_lamports) / LAMPORTS_PER_SOL,
              toBuybackSol: Number(data.to_buyback_lamports) / LAMPORTS_PER_SOL,
              owedSol: Number(data.owed_lamports) / LAMPORTS_PER_SOL,
              lastPaidHolders: data.last_paid_holders,
              lastDistributedAt: data.last_distributed_at,
              lastClaimTx: data.last_claim_tx,
              updatedAt: data.updated_at,
            }
          : null,
      )
      setLoading(false)
    }
    load()
    // Backing snapshot refreshes every 10 minutes server-side (pg_cron) —
    // poll a bit slower so this doesn't spam reads between real updates,
    // same reasoning as useHolderLeaderboard's 6-minute poll on a 5-minute
    // snapshot.
    const id = setInterval(load, 12 * 60 * 1000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return { rewards, loading, error }
}
