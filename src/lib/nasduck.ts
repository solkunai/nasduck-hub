export const NASDUCK_MINT = '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze'
export const WSOL_MINT = 'So11111111111111111111111111111111111111112'

// Confirmed via getAccountInfo: NASDUCK is a Token-2022 mint (owner
// TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb, not classic SPL), 6 decimals,
// mintAuthority/freezeAuthority both null (supply is fixed, no team mint or
// freeze risk). getParsedTokenAccountsByOwner's mint filter works for either
// token program without needing to specify it, so no manual ATA derivation
// is needed for balance reads — and Jupiter's Ultra API builds the swap
// transaction itself, so it handles any Token-2022 ATA creation internally.
export const NASDUCK_DECIMALS = 6

export const NASDUCK_X = 'https://x.com/NASDUCKOTC'

// The fee cut on every swap goes here. Collected via Jupiter's Referral
// Program (not the classic swap/v1 feeAccount param — see lib/swap.ts for
// why: that mechanism was confirmed broken on-chain for a real route
// during a prior build, so this project goes straight to the officially
// supported mechanism instead of relearning that the hard way).
export const FEE_WALLET = 'AWJKACzdHpnumGnF1qiwSS1gnXX1sscL89Mhm83akFCn'
export const FEE_BPS = 50 // 0.5%

// The address Jupiter's /order calls use is a separate on-chain Referral
// Account, not FEE_WALLET itself — Jupiter derives/creates this account
// when FEE_WALLET connects at referral.jup.ag and creates a Referral
// Account there. Confirmed directly from the user's own dashboard after
// connecting FEE_WALLET. A SOL Referral Token Account has already been
// created under this account (fees always land in SOL for a SOL/NASDUCK
// pair — see the priority-order check in lib/swap.ts).
export const REFERRAL_ACCOUNT = 'HszE2CwtT7buhNhxHqJUcj2iSXimRywzTuqnR5HgdGJ4'

// Public-safe project identifiers (URL + publishable key, not the account
// Personal Access Token — see lib/supabase.ts). Hardcoded as the default so
// a fresh deploy (Vercel or otherwise) works without a required dashboard
// env var step, same convention as REFERRAL_ACCOUNT/FEE_WALLET above;
// VITE_SUPABASE_* still overrides these if set.
export const SUPABASE_URL = 'https://qrqenowwwccmfgwsnfpa.supabase.co'
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_8in3GY7CIf71OL_PUZv_-Q_JIXeKa4q'

export const MCAP_GOAL = 1_000_000_000
export const HOLDER_GOAL = 100_000

// Multiple unrelated tokens are circulating under the NASDUCK/$NDUCK name
// (confirmed via live lookup: different CAs, unrelated socials, market caps
// in the low thousands). Never treat any of these as the real token.
export const IMPOSTER_MINTS = [
  'DRkfCoeGuv6XUTs6egFYCBB8FZdPmN35kLjAo9SbgFfo',
  '4dnAW2HJ4KQau4B9yGUwxkTaTVWPom3HY5MMw3jqpump',
  'CvV8MhY8esREcUEm2nwh4FBsbQRa5oBjAjKuWvvyG4C8',
  '4y74RxkMFVTwhBeAYRmPifcnQvPeC8wKAyHCcGmSpbkZ',
]

export function isImposterMint(mint: string): boolean {
  return IMPOSTER_MINTS.includes(mint)
}
