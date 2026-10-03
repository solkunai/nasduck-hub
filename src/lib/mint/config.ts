// Mint page config — public mint only, no allowlist/phases (flat price +
// flat per-wallet limit for everyone). Once a real Candy Machine exists,
// replace MINT_START (the mock "already minted" baseline) with live
// `itemsRedeemed` read from it.
// Kill switch for sharing the page as a preview (e.g. with the NasDuck team)
// before the real mint is ready. When false, the buy button is disabled and
// just reads "MINT OPENS SOON" — wallet connect and everything else on the
// page still works normally. Flip to true once the real Candy Machine is
// live and wired up.
export const MINT_LIVE = false

export const SUPPLY = 4444

// $5 USD per duck, paid in $NASDUCK. Actual token amount is computed live
// from useMarket().price, not stored here — see useMintFlow.
export const USD_PRICE_PER_MINT = 5

/** Mock baseline for "already minted" on page load — placeholder only. */
export const MINT_START = 0

// Shared between the desktop full-width strip (Mint.tsx) and the mobile
// bottom sheet (FloorPass.tsx) — same four facts, different container.
export const MINT_DETAILS = [
  ['SUPPLY', '4,444 total. No ducks held back — every one is mintable.'],
  ['MINT FUNDS', '50% LP, 25% community (airdrops, giveaways), 25% marketing/dev/artist.'],
  ['ROYALTIES', '5% on secondary, routed to the $NASDUCK community wallet.'],
  ['REVEAL', 'Instant. You see your duck the moment the transaction settles.'],
  ['VERIFY', 'Only mint from this page. Check the URL twice. Then once more.'],
] as const

// Real legal/risk disclaimers — deliberately separate from MINT_DETAILS so
// the Fine Print modal doesn't just repeat the strip already visible below
// the cards on desktop.
export const FINE_PRINT_ITEMS = [
  ['OWNERSHIP', 'You own the art. We keep zero rights to resell or license your specific duck.'],
  ['NO PROMISES', 'NFT value can go to zero. This is a collectible, not an investment contract.'],
  ['IRREVERSIBLE', "Blockchain transactions can't be undone. Double-check your wallet and the price before confirming."],
  ['SECURITY', 'We will never DM you first, ask for your seed phrase, or send a "support" link. Anyone who does is not us.'],
  ['ELIGIBILITY', 'You must be legally able to hold crypto assets in your jurisdiction to mint.'],
] as const

// Real tier breakdown, computed from the actual generated 4,444-item
// collection (public/mint/collection.json) — bucketed by each NFT's
// nftexport-computed rank: top 100 = Legendary (includes all 5 1-of-1s),
// next 400 = Rare, next 1,200 = Uncommon, remaining 2,744 = Common.
export const REAL_RARITY = [
  { tier: 'COMMON', count: 2744, pct: '62%', color: '#C9D3E3' },
  { tier: 'UNCOMMON', count: 1200, pct: '27%', color: '#F7E7C1' },
  { tier: 'RARE', count: 400, pct: '9%', color: '#6FBE44' },
  { tier: 'LEGENDARY', count: 100, pct: '2%', color: '#FFC522' },
] as const

export function tierColor(tier: string): string {
  return REAL_RARITY.find((r) => r.tier === tier)?.color ?? '#C9D3E3'
}

// One real NFT's record from public/mint/collection.json.
export interface CollectionItem {
  id: string
  image: string
  rank: number
  tier: string
  attributes: { trait_type: string; value: string; pct: number }[]
}

export const WALLET_SWATCHES: { name: string; color: string }[] = [
  { name: 'PHANTOM', color: '#AB9FF2' },
  { name: 'SOLFLARE', color: '#FFC522' },
  { name: 'BACKPACK', color: '#FF5A4E' },
]

const MINT_SITE_URL = 'https://nasduck.wtf/mint'

// `id` is always the real minted duck's number (e.g. the actual `latest.id` /
// `current.id` from useMintFlow's mint state) — never a placeholder.
export function buildFlexTweet(id: string): string {
  return `Just got my badge punched on the @NASDUCKOTC trading floor. NasDuck ${id} | Fired from Wall Street, hired by degens. 🦆📈\n\n${MINT_SITE_URL}`
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export function pad(n: number): string {
  return String(n).padStart(4, '0')
}
