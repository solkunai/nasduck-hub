// Mint page config — public mint only, no allowlist/phases (flat price +
// flat per-wallet limit for everyone). Once a real Candy Machine exists,
// replace MINT_START (the mock "already minted" baseline) with live
// `itemsRedeemed` read from it.
export const SUPPLY = 4444

// $5 USD per duck, paid in $NASDUCK. Actual token amount is computed live
// from useMarket().price, not stored here — see useMintFlow.
export const USD_PRICE_PER_MINT = 5

export const MAX_PER_WALLET = 10

/** Mock baseline for "already minted" on page load — placeholder only. */
export const MINT_START = 2941

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

// Placeholder rarity summary from the design handoff — NOT the real tiers
// computed from the actual 7-category trait set. Replace once metadata.csv
// is regenerated with Background/Skin/Body/NeckAccessory/Mouth/EyesAccessory/Hat.
export const PLACEHOLDER_RARITY = [
  { tier: 'COMMON', count: 2444, pct: '100%', color: '#C9D3E3' },
  { tier: 'UNCOMMON', count: 1111, pct: '46%', color: '#F7E7C1' },
  { tier: 'RARE', count: 578, pct: '24%', color: '#6FBE44' },
  { tier: 'EPIC', count: 301, pct: '13%', color: '#F5911E' },
  { tier: 'LEGEND', count: 10, pct: '2%', color: '#FFC522' },
] as const

// Placeholder "pulled" look data for the mock mint flow / reveal — stands in
// for a real minted NFT's image + attributes until a Candy Machine exists.
export interface MockLook {
  id: string
  fit: string
  desk: string
  acc: string
  bg: string
  frame: string
  rarity: string
}

export const MOCK_LOOKS: MockLook[] = [
  { id: '#0069', fit: 'Leverage Hoodie', desk: '6 Monitors, All Red', acc: 'Gold Chain', bg: 'Pump Green', frame: '#6FBE44', rarity: 'RARE' },
  { id: '#1337', fit: 'Trucker Cap Over Swim Cap', desk: 'Semi Truck Cab', acc: 'Toothpick', bg: 'Highway Dusk', frame: '#F5911E', rarity: 'UNCOMMON' },
  { id: '#0420', fit: 'Pinstripe Suit', desk: 'Bloomberg Terminal', acc: 'Trading Floor Lanyard', bg: 'Ticker Wall', frame: '#FFC522', rarity: 'EPIC' },
  { id: '#2008', fit: 'Varsity Hoodie "QUACKTON"', desk: 'Dorm Laptop', acc: 'Student Loan Letter', bg: 'Campus Navy', frame: '#F7E7C1', rarity: 'COMMON' },
]

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
