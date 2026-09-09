import type { ReactNode } from 'react'
import { PrivyProvider } from '@privy-io/react-auth'
import { toSolanaWalletConnectors } from '@privy-io/react-auth/solana'
import {
  createDefaultAuthorizationCache,
  createDefaultChainSelector,
  createDefaultWalletNotFoundHandler,
  registerMwa,
} from '@solana-mobile/wallet-standard-mobile'

// Privy App ID from dashboard.privy.io — public, safe to ship in client
// code (same trust level as a Supabase publishable key: identifies which
// app is asking, doesn't grant access to anything by itself).
const PRIVY_APP_ID = import.meta.env.VITE_PRIVY_APP_ID || ''

// Registers Solana Mobile Wallet Adapter (Android's Phantom/Solflare/etc.
// via the OS-level wallet chooser, not a browser extension) as a
// Wallet Standard wallet. Confirmed against Privy's own MWA recipe this
// doesn't happen automatically just from installing the package — without
// this explicit call, toSolanaWalletConnectors() below would never see an
// MWA option and Android browser users would only get email/Google/X.
// Registers once at module load, not per-render.
registerMwa({
  appIdentity: { name: 'NASDUCK', uri: 'https://nasduck.wtf', icon: 'mascot/nasduck-logo.jpg' },
  authorizationCache: createDefaultAuthorizationCache(),
  chains: ['solana:mainnet'],
  chainSelector: createDefaultChainSelector(),
  onWalletNotFound: createDefaultWalletNotFoundHandler(),
})

export function AppProviders({ children }: { children: ReactNode }) {
  // No App ID configured (e.g. local dev before it's set up) — render the
  // app without Privy rather than crash the whole page. useActiveWallet()
  // below just reports "not connected" in that case, same as a visitor who
  // hasn't logged in.
  if (!PRIVY_APP_ID) return <>{children}</>

  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'twitter'],
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
      {children}
    </PrivyProvider>
  )
}
