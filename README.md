# NASDUCK Hub

Live price, chart, and swap for [$NASDUCK](https://x.com/NASDUCKOTC) on Solana — plus a community
scoreboard tracking progress toward a $100M market cap and 100,000 holders.

- Contract: `7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze` (Solana, Token-2022, 6 decimals)
- Stack: Vite + React 19 + TypeScript + Tailwind + Solana Wallet Adapter

## Setup

```bash
npm install
cp .env.example .env   # optional — sensible defaults work without it
npm run dev
```

## One-time manual step: Jupiter Referral Account

Swaps route through Jupiter's Ultra API (`/ultra/v1/order` + `/ultra/v1/execute`) and take a
0.5% fee via Jupiter's **Referral Program** — not the classic `feeAccount`/`platformFeeBps`
mechanism, which was confirmed broken on-chain for at least one real route on a prior project.

Until a Referral Account exists for the fee wallet, quotes and swaps still work (the code falls
back to a fee-less order automatically), they just don't collect the fee yet. To activate it:

1. Go to [referral.jup.ag](https://referral.jup.ag), connect the fee wallet
   (`AWJKACzdHpnumGnF1qiwSS1gnXX1sscL89Mhm83akFCn`), and create a Referral Account.
2. Create a Referral Token Account for both SOL/WSOL and NASDUCK — a fee can land in either
   depending on swap direction.
3. Nothing else to do — `src/lib/swap.ts` already sends `referralAccount`/`referralFee` on every
   order and the 0.5% fee starts applying automatically once the account exists.

## Status

**Phase 1 (live):** live ticker, price chart, $100M mcap / 100K holders tracker, swap widget
(Jupiter Ultra API).

**Phase 2 (not started — needs backend infra):** whale/buy-sell alert feed, holder leaderboard
with diamond-hands badges, community meme wall, "Feed the Duck" clicker game. These need a
webhook listener + database (Helius + Supabase, or equivalent) that doesn't exist yet for this
project — a real infra decision, not just more frontend code.

## Notes for future sessions

- `src/lib/nasduck.ts` — mint, fee wallet/bps, goals, and a list of confirmed-unrelated copycat
  tokens sharing the NASDUCK name (never treat these as real).
- `src/lib/prices.ts` — DexScreener + Jupiter market data, with the same pair-sanity-checking
  logic (reject broken/thin pools) proven necessary on a prior project.
- `src/providers/WalletProvider.tsx` — explains why this app doesn't need its own RPC proxy for
  swaps (Ultra API broadcasts server-side), unlike a prior project that did.
- `src/hooks/usePriceHistory.ts` — the chart is built from real polled prices, not a historical
  candle API — a proper OHLCV source is still unresearched.
