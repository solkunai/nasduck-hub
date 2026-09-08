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

## Jupiter Referral Account — done

Swaps route through Jupiter's Ultra API (`/ultra/v1/order` + `/ultra/v1/execute`) and take a
0.5% fee via Jupiter's **Referral Program** — not the classic `feeAccount`/`platformFeeBps`
mechanism, which was confirmed broken on-chain for at least one real route on a prior project.

The fee wallet (`AWJKACzdHpnumGnF1qiwSS1gnXX1sscL89Mhm83akFCn`) has connected to
[referral.jup.ag](https://referral.jup.ag) and created its Referral Account. **Important:**
Jupiter creates a *separate* on-chain account for the Referral Account itself — it is not the
same address as the fee wallet. The real one, already wired into `src/lib/nasduck.ts` as
`REFERRAL_ACCOUNT`, is `HszE2CwtT7buhNhxHqJUcj2iSXimRywzTuqnR5HgdGJ4`.

A Referral Token Account for **SOL only** has also been created. This is the only one needed:
confirmed directly against Jupiter's `/ultra/v1/fees` endpoint that fee-mint selection follows a
fixed priority order (SOL > stablecoins > LSTs > bluechips > everything else), and SOL is on
every NASDUCK trade regardless of direction — so SOL always wins and NASDUCK is never selected as
the fee mint (nor does it need to be — the fee is meant to only ever be paid in SOL). `fetchOrder`
in `src/lib/swap.ts` also enforces this in code: if Jupiter ever returned a fee in anything other
than SOL, it refuses it and refetches a fee-less order rather than let it through.

With both pieces in place, the 0.5% fee should now be live on every swap. If `/order` still fails
for any reason, `fetchOrder` falls back to a fee-less order automatically so the swap widget keeps
working either way — check the browser console for a `[swap]`-prefixed warning if fees stop
flowing to explain why.

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
