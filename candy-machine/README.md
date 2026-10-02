# NasDucks Candy Machine — devnet trial run (SUCCEEDED)

## Status
The full devnet mechanism has been validated end to end, using the user's
own existing funded Solana CLI devnet wallet (no new keypair generated):
- Collection created: `HEyWDqDZfuRo8qJ2Dk7sRceP6e1TnK2wQYSqg7U3odq3`
- Candy Machine + Candy Guard created: `2ZLuX73sBZ8d8kAbNPmsaGCzt76dr1RgPSFqxvonPbbu`
- Minted a test item and fetched it back — **real metadata came back
  immediately** (not a placeholder), confirming Config Line Settings gives
  genuine instant reveal.
- Confirmed the Royalties plugin is live on the collection: 5% (500 bps),
  `ruleSet: None`, 100% to the authority wallet.

### One real lesson learned (naming template, not a mechanism bug)
`prefixName: 'NasDuck #$ID+1$'` combined with ALSO putting a number in each
config line's own `name` field caused doubling (e.g. an item minted at
index 4 with config-line name `"5"` came back named `"NasDuck #55"` —
`$ID+1$` injected `5`, then the config line's own `"5"` got appended).
**For the real run: pick one scheme, not both.** Simplest fix — drop
`$ID+1$` from the prefix entirely, use a flat prefix like `'NasDuck #'`,
and put the real number directly in each config line's `name` field
(`"1"`, `"2"`, ... `"4444"`). This also lines up naturally with the existing
`metadata/{id}.json` file numbering already used for the real export.

## What this is
A small, disposable **devnet trial run** (5 fake items, not the real 4,444)
to prove the real mechanism works before touching the actual collection:
- Metaplex **Core** Collection with a **Royalties plugin** (5%, enforced,
  `ruleSet: None`)
- **Candy Machine Core** using **Config Line Settings** (not Hidden Settings
  — we chose this because the real cost gap turned out to be ~$64 vs ~$1,
  not worth building a reveal-automation service to save $63) → real
  metadata is written on-chain per item, so reveal is genuinely instant
- Wrapped in a **Candy Guard** with zero guards configured (free/open test
  mint) — the real $5-in-$NASDUCK payment guard is deliberately NOT built
  yet, flagged as separate follow-up work

## Authority wallet
Uses the user's own existing Solana CLI devnet keypair (`~/.config/solana/id.json`,
already funded with 0.5 devnet SOL) via `.env`'s `AUTHORITY_SECRET_KEY_PATH` —
not a freshly generated one. No `keypair:generate` / `devnet:airdrop` steps
needed as a result.

## To re-run this same trial (e.g. on a fresh wallet)
```
npm install
npm run collection:create    # creates the Core Collection + royalty plugin
npm run candy-machine:create # creates Candy Machine + Candy Guard (5 test items, no payment guard)
npm run items:insert-test    # inserts 5 fake config lines
npm run mint:test            # mint one, fetch it back, confirm real metadata + royalty plugin
```

## Real next steps (the actual production build)
1. Once the real 4,444-item art export + Arweave/Irys upload exist: create a
   **fresh** Collection + Candy Machine (this devnet trial is disposable,
   not meant to become the real one) with:
   - `itemsAvailable: 4444`
   - `prefixName: 'NasDuck #'` (no `$ID+1$` — see naming lesson above),
     each config line's `name` = the real duck number
   - the real Arweave/Irys manifest URL as `prefixUri`, each config line's
     `uri` matching the existing `metadata/{id}.json` numbering
   - the real $5-in-$NASDUCK payment guard added to the `guards: {}` object
     in `create-candy-machine.ts` (not built yet — separate task)
2. Decide the per-wallet mint limit and add that guard too.
3. Full devnet dry run of the REAL collection (still devnet, still free)
   before touching mainnet.
4. Only after that succeeds: mainnet, with real SOL, real keys, much more
   caution, and a fresh mainnet-only authority keypair (never reuse a
   devnet key for mainnet).

## Security notes for whoever resumes this
- `.keys/` and `.env` are gitignored in this folder — verify that's still
  true before ever running `git add -A` near this directory.
- The authority keypair is devnet-only. Never reuse it for mainnet.
- Nothing in `output/` is secret (just public on-chain addresses) — safe to
  keep/commit if useful.
