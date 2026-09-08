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

// Every NASDUCK pool address, pulled live from DexScreener's pair list
// (dexscreener.com/api /latest/dex/tokens/{mint}). Confirmed the hard way,
// not guessed: the first snapshot-holders run ranked the PumpSwap pool
// itself (937nYYCP...) as the #1 "holder" — a pool naturally owns the
// largest single token account (all its reserves), which is real but
// useless/misleading on a community leaderboard. Filtered out before
// ranking. Not exhaustive forever (new pools can appear) — re-check this
// list against DexScreener if a pool/program address ever shows up ranked
// again.
export const KNOWN_POOL_ADDRESSES = [
  '937nYYCPzqygDm71FX5XJzepDCnJLca9GSfe5essZK2H', // PumpSwap
  '3vnFSkGU2foSKWsbH5pEJ6HFstugb5YBELkRGgUdJAeA', // Meteora
  '63TL5RqBnTeLWK96sk9rUBEBWxmVFcWkDHGNP1vaYz3P', // Meteora
  'GpDb6iSBYzqESg3D6dyDUWghCEMgLdZKNYZ4rLGVkQYL', // Meteora
  'DYrsQFyEvGCRdDMHMSNpM2SPnHLZDcJeuNyCqf7pbRM2', // Raydium
  '9zwRDc7jqvp2gZ4Uo9LNEzuRddzRGckBXJVyLmQA1GBf', // Orca
  'W7hiFYAfx7QjySs4mzCeNysLig3p8GzRMCpKdAs98o1', // Meteora
  '4Ny7ihkR5qU8ZpnwT4bfv7gaVsrEcP9QdGXGwK7WPiuQ', // Raydium
  'EWxEa2gg1QPjrnXNV5Z9rqapGhJr34LFjTXYqXuUSBS4', // Raydium
  '8iuX8avSY3N7QtNo2nZoqYYox23fSxaycGxxCJhVcNZg', // Meteora
  '8zKKPswFpJNBou7M4yQ1UFJVdkPDMxagV4RquFCfKLjH', // Meteora
  'HFWpwj3bzdMDo7XgeCeVdWvmLnzn2q19NuxF7QTMPV9Y', // Meteora
  '2fkZpFY4r8UedwWE7NPw165d2fn84KyWztiji81iGAMz', // Meteora
  'HjHy9KZHk2N6hUgnSoQFUcU9oVC6BaQ1qHTNbzRSTsMe', // Meteora
  '53zygLLzcbgrnYzvu3yKCvuFK7w7ZUBmv3ifDLXhtPF', // Orca
]
