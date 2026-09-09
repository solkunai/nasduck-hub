import { type ReactNode, useEffect, useState } from 'react'
import { PrivyActiveWalletPublisher } from '../hooks/useActiveWallet'

// Privy App ID from dashboard.privy.io — public, safe to ship in client
// code (same trust level as a Supabase publishable key: identifies which
// app is asking, doesn't grant access to anything by itself).
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || ''

// Everything actually loaded from the dynamic import below, held together
// so the loading effect only needs one piece of state. Uses the real
// imported types (not a hand-rolled shape) so the JSX usage further down
// is still checked against Privy's actual PrivyProviderProps.
interface PrivyModules {
  PrivyProvider: typeof import('@privy-io/react-auth').PrivyProvider
  usePrivy: typeof import('@privy-io/react-auth').usePrivy
  useWallets: typeof import('@privy-io/react-auth/solana').useWallets
  useSignTransaction: typeof import('@privy-io/react-auth/solana').useSignTransaction
  useExportWallet: typeof import('@privy-io/react-auth/solana').useExportWallet
  toSolanaWalletConnectors: typeof import('@privy-io/react-auth/solana').toSolanaWalletConnectors
}

// Confirmed via a real `vite build` (not just `tsc --noEmit`, which doesn't
// catch bundling issues): Privy's SDK adds ~2MB minified / ~600KB gzipped
// to the eagerly-loaded bundle even restricted to `walletChainType:
// 'solana-only'` — its core init path still pulls in EVM/WalletConnect
// infrastructure (secp256k1, CCIP/ENS resolution, Reown's modal code) that
// this app never touches, and that restriction only controls what shows in
// the login modal's UI, not what ships. Deferring the import to run after
// first paint (via requestIdleCallback, which fires once the browser is
// done with more urgent work — falling back to a short setTimeout on
// Safari, which doesn't implement it) keeps that weight off the critical
// path for the marketing page's initial render, at the cost of the
// login/wallet UI needing a brief moment to become available after
// load — acceptable since nobody clicks Sign In in the first instant
// anyway, and useActiveWallet() reports a clean "not ready yet" state
// during that window rather than crashing (verified live before this
// existed — calling Privy's hooks with no provider mounted blanked the
// whole page).
function loadPrivyModules(): Promise<PrivyModules> {
  return Promise.all([import('@privy-io/react-auth'), import('@privy-io/react-auth/solana')]).then(
    ([core, solana]) => ({
      PrivyProvider: core.PrivyProvider,
      usePrivy: core.usePrivy,
      useWallets: solana.useWallets,
      useSignTransaction: solana.useSignTransaction,
      useExportWallet: solana.useExportWallet,
      toSolanaWalletConnectors: solana.toSolanaWalletConnectors,
    }),
  )
}

// Registers Solana Mobile Wallet Adapter (Android's Phantom/Solflare/etc.
// via the OS-level wallet chooser, not a browser extension) as a Wallet
// Standard wallet. Confirmed against Privy's own MWA recipe this doesn't
// happen automatically just from installing the package — without this,
// toSolanaWalletConnectors() would never see an MWA option and Android
// browser users would only get email/Google/X. Loaded alongside Privy
// itself (same deferred timing, same reasoning) rather than at module load,
// since it only needs to be registered before someone opens the wallet
// connector list — same window Privy itself becomes ready in.
function registerMobileWalletAdapter() {
  import('@solana-mobile/wallet-standard-mobile').then((mwa) => {
    mwa.registerMwa({
      appIdentity: { name: 'NASDUCK', uri: 'https://nasduck.wtf', icon: 'mascot/nasduck-logo.jpg' },
      authorizationCache: mwa.createDefaultAuthorizationCache(),
      chains: ['solana:mainnet'],
      chainSelector: mwa.createDefaultChainSelector(),
      onWalletNotFound: mwa.createDefaultWalletNotFoundHandler(),
    })
  })
}

export function AppProviders({ children }: { children: ReactNode }) {
  const [modules, setModules] = useState<PrivyModules | null>(null)

  useEffect(() => {
    if (!PRIVY_APP_ID) return
    // Safari doesn't implement requestIdleCallback — a plain short timeout
    // is a fine fallback for the same "don't compete with first paint"
    // goal, just less precisely timed.
    const hasIdleCallback = typeof window.requestIdleCallback === 'function'
    const idle: (cb: () => void) => number = hasIdleCallback
      ? (cb) => window.requestIdleCallback(cb)
      : (cb) => window.setTimeout(cb, 200)
    const cancelIdle: (id: number) => void = hasIdleCallback
      ? (id) => window.cancelIdleCallback(id)
      : (id) => window.clearTimeout(id)

    const id = idle(() => {
      registerMobileWalletAdapter()
      loadPrivyModules().then(setModules)
    })
    return () => cancelIdle(id)
  }, [])

  // No App ID configured, or Privy hasn't finished loading yet — render
  // the app as-is. useActiveWallet() reports a clean "not connected /
  // not ready" state in both cases rather than crashing.
  if (!PRIVY_APP_ID || !modules) return <>{children}</>

  const { PrivyProvider, toSolanaWalletConnectors, ...hooks } = modules

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        // 'wallet' is what actually puts a "connect an existing wallet"
        // entry in the modal — externalWallets.solana.connectors below
        // makes Phantom/Solflare/Backpack available to connect, but
        // loginMethods is what controls what the modal actually shows, and
        // it silently dropped the wallet option entirely without it
        // (confirmed live). Tried 'siws' first since that literal exists on
        // a same-named LoginMethod type elsewhere in the SDK — the real
        // compiler error for *this* config field's actual type (caught by
        // tsc, not assumed) named 'wallet' as the real accepted value.
        loginMethods: ['email', 'google', 'twitter', 'wallet'],
        appearance: {
          // Defaults to 'ethereum-only' — NASDUCK is Solana-only, and
          // leaving this unset would hide external Solana wallets (Phantom,
          // Solflare, Backpack) from the login modal entirely.
          walletChainType: 'solana-only',
        },
        embeddedWallets: {
          // Creates a Solana embedded wallet automatically for anyone who
          // signs up via email/Google/X and doesn't already have a wallet
          // linked — exactly the "sign up, get a wallet" flow asked for.
          // Someone who instead connects an existing external wallet
          // (Phantom etc.) doesn't get a redundant second wallet created.
          solana: { createOnLogin: 'users-without-wallets' },
        },
        externalWallets: {
          // Keeps Phantom/Solflare/Backpack working as a login option
          // alongside email/Google/X, through Privy's own connector system
          // (replaces wallet-adapter's WalletProvider, which did this job
          // before).
          solana: { connectors: toSolanaWalletConnectors() },
        },
      }}
    >
      <PrivyActiveWalletPublisher
        usePrivyHook={hooks.usePrivy}
        useWalletsHook={hooks.useWallets}
        useSignTransactionHook={hooks.useSignTransaction}
        useExportWalletHook={hooks.useExportWallet}
      >
        {children}
      </PrivyActiveWalletPublisher>
    </PrivyProvider>
  )
}
