import { createClient } from 'jsr:@supabase/supabase-js@2'
import { dynamicCorsHeaders } from '../_shared/cors.ts'

// Confirmed live: the public Solana RPC (api.mainnet-beta.solana.com)
// returns a flat 403 "Access forbidden" for getBalance from nasduck.wtf's
// real origin — not a rate-limit, an outright block. Same class of problem
// ANSEM Hub solved with its own rpc-proxy; ported that proven pattern
// rather than re-deriving it, with one real difference: no sendTransaction/
// simulateTransaction in the allowlist below. NASDUCK's swap widget never
// calls those on this Connection at all — Jupiter's Ultra API broadcasts
// the signed transaction on its own backend (see lib/swap.ts) — so this
// proxy only ever needs to be a read-only account-data relay, which is a
// strictly safer default than ANSEM's version needed to allow.
const HELIUS_SECRET = Deno.env.get('HELIUS_RPC_URL')
const HELIUS_RPC_URL =
  HELIUS_SECRET && !HELIUS_SECRET.startsWith('http')
    ? `https://mainnet.helius-rpc.com/?api-key=${HELIUS_SECRET}`
    : HELIUS_SECRET
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const ALLOWED_METHODS = new Set([
  'getBalance',
  'getAccountInfo',
  'getMultipleAccounts',
  'getTokenAccountsByOwner',
  'getTokenAccountBalance',
  'getLatestBlockhash',
  'getSignatureStatuses',
  'getSlot',
  'getMinimumBalanceForRentExemption',
  'getVersion',
  'getEpochInfo',
  'getBlockHeight',
])

const RATE_LIMIT_PER_MINUTE = 60

Deno.serve(async (req) => {
  const corsHeaders = dynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!HELIUS_RPC_URL) throw new Error('HELIUS_RPC_URL not configured')
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('supabase service credentials not configured')

    const body = await req.text()
    const parsed = JSON.parse(body)
    const calls = Array.isArray(parsed) ? parsed : [parsed]

    const disallowed = calls.find((c) => !ALLOWED_METHODS.has(c?.method))
    if (disallowed) {
      return new Response(JSON.stringify({ error: `method not allowed: ${disallowed?.method}` }), {
        status: 403,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const { data: count, error: rateLimitError } = await db.rpc('increment_rpc_rate_limit', {
      p_ip: ip,
      p_window: windowStart,
    })
    if (!rateLimitError && typeof count === 'number' && count > RATE_LIMIT_PER_MINUTE) {
      return new Response(JSON.stringify({ error: 'rate limited, try again shortly' }), {
        status: 429,
        headers: { ...corsHeaders, 'content-type': 'application/json' },
      })
    }

    const res = await fetch(HELIUS_RPC_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    })

    const data = await res.text()
    return new Response(data, {
      status: res.status,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'unexpected error' }), {
      status: 500,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    })
  }
})
