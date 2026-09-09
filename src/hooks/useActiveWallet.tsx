import { createContext, useCallback, useContext, useMemo } from 'react'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import type { usePrivy as UsePrivy } from '@privy-io/react-auth'
import type {
  ConnectedStandardSolanaWallet,
  useExportWallet as UseExportWallet,
  useSignTransaction as UseSignTransaction,
  useWallets as UseWallets,
} from '@privy-io/react-auth/solana'

export interface ActiveWallet {
  ready: boolean
  connected: boolean
  publicKey: PublicKey | null
  signTransaction: ((tx: VersionedTransaction) => Promise<VersionedTransaction>) | undefined
  login: () => void
  logout: () => Promise<void>
  isEmbedded: boolean
  canExport: boolean
  exportWallet: () => Promise<void>
  email: string | null
}

// Privy's own SDK isn't mounted until providers/PrivyProviders.tsx finishes
// dynamically importing it (deferred past first paint — see that file for
// why: it adds ~2MB minified to the eager bundle otherwise, confirmed via a
// real `vite build`, most of it EVM/WalletConnect code a Solana-only site
// never touches). Every component that reads wallet state needs to work
// correctly during that window too, not just after — this context is what
// makes that safe: it's always readable with no provider required, so
// nothing crashes or has to conditionally call a hook based on runtime
// state (which real Privy hooks like usePrivy()/useWallets() don't support
// — they throw with no <PrivyProvider> ancestor, confirmed live before this
// existed). PrivyActiveWalletPublisher below is the only thing that ever
// provides a non-default value, and it only mounts once Privy has actually
// loaded and its own provider is up.
const DISCONNECTED: ActiveWallet = {
  ready: false,
  connected: false,
  publicKey: null,
  signTransaction: undefined,
  login: () => {
    console.warn('[wallet] still loading — try again in a moment.')
  },
  logout: async () => {},
  isEmbedded: false,
  canExport: false,
  exportWallet: async () => {},
  email: null,
}

const ActiveWalletContext = createContext<ActiveWallet>(DISCONNECTED)

export function useActiveWallet(): ActiveWallet {
  return useContext(ActiveWalletContext)
}

// Rendered only by PrivyProviders.tsx, only once its dynamic import of
// @privy-io/react-auth (+ /solana) has resolved — every hook below is a
// real Privy hook, safe here specifically because a <PrivyProvider> is
// guaranteed to be mounted above this component by the time it renders.
export function PrivyActiveWalletPublisher({
  children,
  usePrivyHook,
  useWalletsHook,
  useSignTransactionHook,
  useExportWalletHook,
}: {
  children: React.ReactNode
  usePrivyHook: typeof UsePrivy
  useWalletsHook: typeof UseWallets
  useSignTransactionHook: typeof UseSignTransaction
  useExportWalletHook: typeof UseExportWallet
}) {
  const { ready: privyReady, authenticated, login, logout, user } = usePrivyHook()
  const { ready: walletsReady, wallets } = useWalletsHook()
  const { signTransaction: privySignTransaction } = useSignTransactionHook()
  const { exportWallet: privyExportWallet } = useExportWalletHook()

  // A user can in principle have more than one Solana wallet linked
  // (embedded + an external one), but this app only ever acts on one at a
  // time — prefer the Privy embedded wallet (what "sign up with email"
  // actually creates) since that's the one this feature is for; fall back
  // to whatever's first (an external wallet) for users who linked one
  // instead of creating an embedded wallet.
  // A `'privy:'` feature entry (not `.name`) is the real discriminator
  // Privy's own connector code and its own docs recipe use to tell the
  // embedded wallet apart from externally connected ones (Phantom,
  // Solflare, etc.) — confirmed against the SDK's source. `standardWallet`
  // is typed as the general Wallet Standard interface (any wallet could
  // implement it), so this checks the feature map rather than assuming a
  // concrete Privy-only field the type doesn't actually expose.
  const isPrivyStandardWallet = (w: ConnectedStandardSolanaWallet) => 'privy:' in w.standardWallet.features

  const wallet = useMemo(() => {
    if (wallets.length === 0) return null
    return wallets.find(isPrivyStandardWallet) ?? wallets[0]
  }, [wallets])

  const publicKey = useMemo(() => (wallet ? new PublicKey(wallet.address) : null), [wallet])
  const connected = privyReady && walletsReady && authenticated && publicKey !== null
  const isEmbedded = wallet ? isPrivyStandardWallet(wallet) : false

  // Keeps the same call shape SwapWidget/executeOrder already used with
  // wallet-adapter (pass a VersionedTransaction, get one back) rather than
  // touching lib/swap.ts's already-verified execute flow. Privy's own
  // signTransaction takes/returns raw Uint8Array — deserializing its result
  // back into a VersionedTransaction is a small redundant round-trip
  // (executeOrder re-serializes it right after), but it isolates every
  // Privy-specific detail to this one hook.
  const signTransaction = useCallback(
    async (tx: VersionedTransaction): Promise<VersionedTransaction> => {
      if (!wallet) throw new Error('no wallet connected')
      const { signedTransaction } = await privySignTransaction({
        transaction: tx.serialize(),
        wallet,
      })
      return VersionedTransaction.deserialize(signedTransaction)
    },
    [wallet, privySignTransaction],
  )

  // Only the embedded wallet has a private key Privy can export — an
  // external wallet (Phantom etc.) keeps its own key in its own extension,
  // Privy never sees it.
  const exportWallet = useCallback(async () => {
    if (!wallet || !isEmbedded) return
    await privyExportWallet({ address: wallet.address })
  }, [wallet, isEmbedded, privyExportWallet])

  const value: ActiveWallet = {
    ready: privyReady && walletsReady,
    connected,
    publicKey,
    signTransaction: connected ? signTransaction : undefined,
    login,
    logout,
    isEmbedded,
    canExport: connected && isEmbedded,
    exportWallet,
    email: user?.email?.address ?? null,
  }

  return <ActiveWalletContext.Provider value={value}>{children}</ActiveWalletContext.Provider>
}
