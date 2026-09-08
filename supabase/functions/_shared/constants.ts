export const NASDUCK_MINT = '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze'

// Program IDs checked to classify a transaction as a swap (vs. a plain
// transfer/airdrop) when a wallet's NASDUCK balance changes. The first two
// are confirmed live against NASDUCK's actual pools — not assumed from
// docs: fetched NASDUCK's real pair addresses from DexScreener, then
// getAccountInfo'd each one directly to read its owning program.
// pAMMBay... (PumpSwap) owns 937nYYCP...essZK2H, NASDUCK's largest pool;
// LBUZKh... (Meteora DLMM) owns 3vnFSkGU...UdJAeA, its second largest.
// The rest are long-established, widely-documented Solana DEX program IDs
// (Jupiter Aggregator v6 also confirmed live on a real ANSEM swap in a
// prior project) — NASDUCK has smaller Raydium/Orca pools too per the same
// DexScreener pair list, so kept for coverage even without a live check on
// those specific ones.
export const DEX_PROGRAM_IDS = [
  'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA', // PumpSwap
  'LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo', // Meteora DLMM
  'JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4', // Jupiter Aggregator v6
  '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8', // Raydium AMM v4
  'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // Raydium CPMM
  'CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK', // Raydium CLMM
  'whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc', // Orca Whirlpool
  '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P', // Pump.fun bonding curve
]
