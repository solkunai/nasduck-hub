import { useCallback, useMemo } from 'react'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { usePrivy } from '@privy-io/react-auth'
import {
  type ConnectedStandardSolanaWallet,
  useExportWallet,
  useSignTransaction,
  useWallets,
} from '@privy-io/react-auth/solana'

// Mirrors the check in providers/PrivyProviders.tsx: with no App ID
// configured, <PrivyProvider> is never mounted at all, so Privy's own
// hooks (usePrivy, useWallets, ...) aren't just "not authenticated" — they
// throw, because there's no provider tree for them to read from. Confirmed
// live: this crashed the whole page to blank white, not a graceful
// "disconnected" state. `import.meta.env` is a Vite build-time constant, so
// this never changes across a running app's lifetime — conditionally
// calling the real hook below based on it doesn't violate rules-of-hooks
// in practice, even though the linter can't prove that statically.
const PRIVY_ENABLED = Boolean(import.meta.env.VITE_PRIVY_APP_ID)

const DISCONNECTED: ReturnType<typeof usePrivyWallet> = {
  ready: true,
  connected: false,
  publicKey: null,
  signTransaction: undefined,
  login: () => {
    console.warn('[wallet] VITE_PRIVY_APP_ID is not configured — nobody can sign in yet.')
  },
  logout: async () => {},
  isEmbedded: false,
  canExport: false,
  exportWallet: async () => {},
  email: null,
}

// Single place the rest of the app touches Privy. Every consumer that used
// to call wallet-adapter's useWallet()/useWalletModal() now calls this
// instead, getting back the same shape (publicKey, connected,
// signTransaction) so SwapWidget/PnlCard/ClickerGame/MemeWall/useBalances
// didn't need their own logic rewritten — only the import + a couple of
// renames (setVisible(true) -> login()).
export function useActiveWallet() {
  // eslint-disable-next-line react-hooks/rules-of-hooks -- PRIVY_ENABLED is a
  // build-time constant, see comment above.
  return PRIVY_ENABLED ? usePrivyWallet() : DISCONNECTED
}

function usePrivyWallet() {
  const { ready: privyReady, authenticated, login, logout, user } = usePrivy()
  const { ready: walletsReady, wallets } = useWallets()
  const { signTransaction: privySignTransaction } = useSignTransaction()
  const { exportWallet: privyExportWallet } = useExportWallet()

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

  return {
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
}
