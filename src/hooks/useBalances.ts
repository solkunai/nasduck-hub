import { useEffect, useState } from 'react'
import { PublicKey } from '@solana/web3.js'
import { connection } from '../lib/connection'
import { NASDUCK_MINT } from '../lib/nasduck'
import { useActiveWallet } from './useActiveWallet'

export interface Balances {
  sol: number
  nasduck: number
  error: string | null
}

const NASDUCK_PUBKEY = new PublicKey(NASDUCK_MINT)

export function useBalances(): Balances {
  const { publicKey } = useActiveWallet()
  const [balances, setBalances] = useState<Omit<Balances, 'error'>>({ sol: 0, nasduck: 0 })
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!publicKey) {
      setBalances({ sol: 0, nasduck: 0 })
      setError(null)
      return
    }
    let cancelled = false
    async function load() {
      try {
        const [lamports, tokenAccounts] = await Promise.all([
          connection.getBalance(publicKey!),
          connection.getParsedTokenAccountsByOwner(publicKey!, { mint: NASDUCK_PUBKEY }),
        ])
        if (cancelled) return
        const nasduck = tokenAccounts.value.reduce(
          (sum, { account }) => sum + (account.data.parsed?.info?.tokenAmount?.uiAmount ?? 0),
          0,
        )
        setBalances({ sol: lamports / 1e9, nasduck })
        setError(null)
      } catch (err) {
        if (cancelled) return
        // Keep the last known balances (better than snapping to 0 on a
        // transient blip), but surface it — a silent failure here used to
        // show BAL 0.000 forever with zero explanation, indistinguishable
        // from "you have no SOL" to the user.
        setError(err instanceof Error ? err.message : 'balance check failed')
      }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [connection, publicKey])

  return { ...balances, error }
}
