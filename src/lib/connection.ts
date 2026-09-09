import { Connection } from '@solana/web3.js'
import { SUPABASE_URL } from './nasduck'

// Reads only (balances, token accounts) — the swap widget never sends a
// transaction through this Connection at all; Jupiter's Ultra API broadcasts
// the signed transaction on its own backend (see lib/swap.ts). Same reasoning
// as before Privy: the public Solana RPC (api.mainnet-beta.solana.com)
// returns a flat 403 "Access forbidden" on getBalance from nasduck.wtf's real
// origin, not just a rate limit — confirmed live — so this routes through the
// rpc-proxy edge function instead, which enforces a read-only method
// allowlist (see supabase/functions/rpc-proxy).
// `||` not `??`: a real .env file (copied from .env.example, which lists
// every var with an empty default like `VITE_RPC_URL=`) sets this to `""`,
// not undefined — `??` only falls back on null/undefined, so it would try to
// open a Connection against an empty string and crash the whole app.
const RPC_ENDPOINT = import.meta.env.VITE_RPC_URL || `${SUPABASE_URL}/functions/v1/rpc-proxy`

// One shared Connection for the whole app rather than one per hook/component
// — cheap to construct, but no reason to duplicate it now that it's no
// longer handed down via wallet-adapter's ConnectionProvider context.
export const connection = new Connection(RPC_ENDPOINT)
