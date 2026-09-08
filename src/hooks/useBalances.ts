import { useEffect, useState } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey } from '@solana/web3.js'
import { NASDUCK_MINT } from '../lib/nasduck'

export interface Balances {
  sol: number
  nasduck: number
}

const NASDUCK_PUBKEY = new PublicKey(NASDUCK_MINT)

export function useBalances(): Balances {
  const { connection } = useConnection()
  const { publicKey } = useWallet()
  const [balances, setBalances] = useState<Balances>({ sol: 0, nasduck: 0 })

  useEffect(() => {
    if (!publicKey) {
      setBalances({ sol: 0, nasduck: 0 })
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
      } catch {
        // keep last known balances on a transient RPC error
      }
    }
    load()
    const id = setInterval(load, 15_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [connection, publicKey])

  return balances
}
