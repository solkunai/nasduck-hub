import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { SolanaCluster } from '../../hooks/useActiveWallet'

// Client for the nasducks-mint edge function — the only place the mint
// page touches the chain. See supabase/functions/nasducks-mint.

export interface MintStatus {
  cluster: SolanaCluster
  supply: number
  minted: number
  publicRemaining: number
  otcOpen: boolean
  otcRemaining: number
  prices: { mint: string | null; decimals: number | null; public: string | null; otc: string | null }
  /** Server time the numbers were read from chain (ISO). */
  refreshedAt: string
  wallet?: {
    desksHeld: number
    desksAvailable: number
    /** Desks held by an unsent order (e.g. cancelled), back after holdUntil. */
    desksOnHold: number
    holdUntil: string | null
    lamports: number
    tokenBalance: string
  }
}

export interface PreparedTx {
  kind: 'otc' | 'public'
  reservationId?: string
  assets: string[]
  /** $NASDUCK base units this transaction charges, at the live quote. */
  cost: string
  transaction: string // base64, signed by everything except the minter
}

export interface SubmitResult {
  signature: string
  status: 'confirmed' | 'failed'
  reason?: string
  assets: { address: string; name: string; uri: string }[]
}

export interface WalletAuth {
  issuedAt: string
  signature: string // base58
}

// The exact text the backend verifies for the OTC holder discount.
export const authMessage = (wallet: string, issuedAt: string) => `NasDucks OTC mint\nWallet: ${wallet}\nIssued: ${issuedAt}`

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke('nasducks-mint', { body })
  if (error) {
    // Surface the function's own message ("no OTC Desk held by this wallet", ...)
    // rather than supabase-js's generic "non-2xx status code".
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null)
      throw new Error(payload?.error ?? 'Mint service error, try again')
    }
    throw new Error('Could not reach the mint service, check your connection')
  }
  return data as T
}

// Public mint snapshot (supply / minted / prices), kept fresh by the function
// and readable by anyone — page views read this instead of hitting the chain.
interface StatsRow {
  cluster: SolanaCluster
  supply: number
  minted: number
  public_remaining: number
  otc_open: boolean
  otc_remaining: number
  price_mint: string | null
  price_decimals: number | null
  price_public: string | null
  price_otc: string | null
  refreshed_at: string
}
export type MintStats = Omit<MintStatus, 'wallet' | 'refreshedAt'> & { refreshedAt: number }

const rowToStats = (r: StatsRow): MintStats => ({
  cluster: r.cluster,
  supply: r.supply,
  minted: r.minted,
  publicRemaining: r.public_remaining,
  otcOpen: r.otc_open,
  otcRemaining: r.otc_remaining,
  prices: { mint: r.price_mint, decimals: r.price_decimals, public: r.price_public, otc: r.price_otc },
  refreshedAt: Date.parse(r.refreshed_at),
})

export async function readStats(): Promise<MintStats | null> {
  const { data, error } = await supabase.from('nasducks_mint_stats').select('*').eq('id', 1).maybeSingle()
  return error || !data ? null : rowToStats(data as StatsRow)
}

/** Pushes every snapshot change; returns an unsubscribe function. */
export function subscribeStats(onStats: (s: MintStats) => void, onLive: (live: boolean) => void): () => void {
  const channel = supabase
    .channel('nasducks-mint-stats')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'nasducks_mint_stats' }, (payload) => {
      if (payload.new && 'minted' in payload.new) onStats(rowToStats(payload.new as StatsRow))
    })
    .subscribe((status) => onLive(status === 'SUBSCRIBED'))
  return () => {
    supabase.removeChannel(channel)
  }
}

export const fetchStatus = (wallet?: string) => call<MintStatus>({ action: 'status', ...(wallet ? { wallet } : {}) })

export const prepareMint = (wallet: string, otcQuantity: number, publicQuantity: number, auth?: WalletAuth) =>
  call<{ transactions: PreparedTx[]; lastValidBlockHeight: number; quote: { nasduckUsd: number; public: string; otc: string; decimals: number } }>({ action: 'prepare', wallet, otcQuantity, publicQuantity, auth })

export const fetchOwned = (wallet: string) => call<{ ducks: SubmitResult['assets'] }>({ action: 'owned', wallet })

export const submitMint = (transactions: string[]) => call<{ results: SubmitResult[] }>({ action: 'submit', transactions })
