// Kill switch: the buy button stays disabled ("MINT OPENS SOON") unless the
// build sets VITE_MINT_LIVE=true. Lets the page be shared as a preview, and
// lets a local .env turn minting on for devnet testing without it going
// live in production.
export const MINT_LIVE = import.meta.env.VITE_MINT_LIVE === 'true'

// Fallback until the live status from the chain arrives.
export const SUPPLY = 5555

// Advertised price in USD. What's actually charged is the fixed $NASDUCK
// amount set on each Candy Machine's payment guard (read live via the
// nasducks-mint function); the USD shown at checkout is that amount at the
// current market price.
export const USD_PRICE_PER_MINT = 5
// OTC Desk holder price. Both are charged in $NASDUCK at the live rate
// (the backend quotes every mint), so buyers always pay these dollar amounts.
export const OTC_USD_PRICE_PER_MINT = 2

// Mint fund distribution (kept for reference, hidden from the page for now):
//   50% LP, 25% community (airdrops, giveaways), 25% marketing/dev/artist.
//
// Shared between the desktop full-width strip (Mint.tsx) and the mobile
// bottom sheet (FloorPass.tsx) — same four facts, different container.
export const MINT_DETAILS = [
  ['SUPPLY', '5,555 total. No ducks held back — every one is mintable.'],
  ['ROYALTIES', '5% on secondary, routed to the $NASDUCK community wallet.'],
  ['REVEAL', 'Instant. You see your duck the moment the transaction settles.'],
  ['VERIFY', 'Only mint from this page. Check the URL twice. Then once more.'],
] as const

// Real legal/risk disclaimers — deliberately separate from MINT_DETAILS so
// the Fine Print modal doesn't just repeat the strip already visible below
// the cards on desktop.
export const FINE_PRINT_ITEMS = [
  ['NON-CUSTODIAL', 'You sign every transaction in your own wallet. We never hold your funds or your ducks and have no way to move them.'],
  ['OWNERSHIP', 'You own the art. We keep zero rights to resell or license your specific duck.'],
  ['NO PROMISES', 'NFT value can go to zero. This is a collectible, not an investment contract.'],
  ['IRREVERSIBLE', "Blockchain transactions can't be undone. Double-check your wallet and the price before confirming."],
  ['SECURITY', 'We will never DM you first, ask for your seed phrase, or send a "support" link. Anyone who does is not us.'],
  ['ELIGIBILITY', 'You must be legally able to hold crypto assets in your jurisdiction to mint.'],
] as const

// Real tier breakdown of the 5,555-item collection, bucketed by each NFT's
// rank: top 125 = Legendary (includes all 5 1-of-1s), next 500 = Rare,
// next 1,500 = Uncommon, remaining 3,430 = Common. Must match the `tier`
// values baked into public/mint/collection.json.
export const REAL_RARITY = [
  { tier: 'COMMON', count: 3430, pct: '62%', color: '#C9D3E3' },
  { tier: 'UNCOMMON', count: 1500, pct: '27%', color: '#F7E7C1' },
  { tier: 'RARE', count: 500, pct: '9%', color: '#F5911E' },
  { tier: 'LEGENDARY', count: 125, pct: '2%', color: '#FFC522' },
] as const

export function tierColor(tier: string): string {
  return REAL_RARITY.find((r) => r.tier === tier)?.color ?? '#C9D3E3'
}

// Same rank cutoffs as REAL_RARITY above.
export function tierForRank(rank: number): string {
  if (rank <= 125) return 'LEGENDARY'
  if (rank <= 625) return 'RARE'
  if (rank <= 2125) return 'UNCOMMON'
  return 'COMMON'
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
  return `Just got my badge punched on the @NASDUCKOTC trading floor.\n\nNasDuck ${id} | Fired from Wall Street, hired by degens. 🦆📈\n\n${MINT_SITE_URL}`
}

export function fmt(n: number): string {
  return n.toLocaleString('en-US')
}

export function pad(n: number): string {
  return String(n).padStart(4, '0')
}
