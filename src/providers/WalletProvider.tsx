import { type ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { SUPABASE_URL } from '../lib/nasduck'
import '@solana/wallet-adapter-react-ui/styles.css'

// This app's swap widget uses Jupiter's Ultra API (/ultra/v1/execute),
// which broadcasts the signed transaction on Jupiter's own backend — no
// sendTransaction call against this Connection at all, so it only ever
// needs to do reads (balances, token accounts). Originally assumed the
// public RPC would handle that fine without a proxy, unlike ANSEM Hub's
// sendTransaction case — turned out wrong: confirmed live, the public RPC
// (api.mainnet-beta.solana.com) returns a flat 403 "Access forbidden" on
// getBalance from nasduck.wtf's real origin, not just a rate limit. Routes
// through the same rpc-proxy pattern ANSEM Hub proved out, this time with a
// read-only method allowlist (see supabase/functions/rpc-proxy) since
// sendTransaction/simulateTransaction are never needed here.
// `||` not `??`: a real .env file (copied from .env.example, which lists
// every var with an empty default like `VITE_RPC_URL=`) sets this to `""`,
// not undefined — `??` only falls back on null/undefined, so it would try
// to open a Connection against an empty string and crash the whole app.
// Confirmed live: exactly this happened on first real .env setup.
const RPC_ENDPOINT = import.meta.env.VITE_RPC_URL || `${SUPABASE_URL}/functions/v1/rpc-proxy`

export function SolanaProviders({ children }: { children: ReactNode }) {
  // Phantom, Solflare, Backpack and any Wallet Standard wallet self-register
  // and are auto-detected — no adapter list needed for them.
  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
