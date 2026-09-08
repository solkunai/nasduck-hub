import { type ReactNode, useMemo } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import '@solana/wallet-adapter-react-ui/styles.css'

// ANSEM Hub needed a server-side RPC proxy because it called
// connection.sendRawTransaction() itself, and the public RPC blocks
// sendTransaction from unrecognized browser origins with a 403. This app's
// swap widget instead uses Jupiter's Ultra API (/ultra/v1/execute), which
// broadcasts the signed transaction on Jupiter's own backend — no
// sendTransaction call against this Connection at all. That leaves this
// Connection doing reads only (balances, token accounts), which the public
// RPC already handles fine, so no proxy is needed for swaps specifically.
// Still worth a dedicated RPC endpoint later if read volume grows enough to
// hit the public endpoint's own rate limits.
// `||` not `??`: a real .env file (copied from .env.example, which lists
// every var with an empty default like `VITE_RPC_URL=`) sets this to `""`,
// not undefined — `??` only falls back on null/undefined, so it would try
// to open a Connection against an empty string and crash the whole app.
// Confirmed live: exactly this happened on first real .env setup.
const RPC_ENDPOINT = import.meta.env.VITE_RPC_URL || 'https://api.mainnet-beta.solana.com'

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
