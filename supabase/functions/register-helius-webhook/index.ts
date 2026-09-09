import { corsHeaders } from '../_shared/cors.ts'
import { KNOWN_POOL_ADDRESSES } from '../_shared/constants.ts'

// One-off setup endpoint, not part of the app's runtime — run it once by
// hand (curl, gated by CRON_SECRET like the other internal endpoints) to
// register the Helius webhook, then it's done; Helius calls
// helius-swap-webhook directly from then on. Reuses the already-configured
// HELIUS_RPC_URL secret to extract the API key needed for Helius's own
// management API, so the raw key never has to be re-entered anywhere.
const CRON_SECRET = Deno.env.get('CRON_SECRET')
const HELIUS_SECRET = Deno.env.get('HELIUS_RPC_URL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

// The pools that actually carry NASDUCK's volume, largest four by
// liquidity per DexScreener (PumpSwap + the biggest three Meteora pools) —
// not every pool in KNOWN_POOL_ADDRESSES, to keep the webhook focused on
// where real trades happen.
const WATCHED_POOLS = [
  '937nYYCPzqygDm71FX5XJzepDCnJLca9GSfe5essZK2H',
  '3vnFSkGU2foSKWsbH5pEJ6HFstugb5YBELkRGgUdJAeA',
  '63TL5RqBnTeLWK96sk9rUBEBWxmVFcWkDHGNP1vaYz3P',
  'GpDb6iSBYzqESg3D6dyDUWghCEMgLdZKNYZ4rLGVkQYL',
].filter((addr) => KNOWN_POOL_ADDRESSES.includes(addr))

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json({ error: 'unauthorized' }, 401)
    }
    if (!HELIUS_SECRET) throw new Error('HELIUS_RPC_URL not configured')
    if (!SUPABASE_URL) throw new Error('SUPABASE_URL not configured')

    const apiKey = extractApiKey(HELIUS_SECRET)
    const webhookURL = `${SUPABASE_URL}/functions/v1/helius-swap-webhook`

    const res = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webhookURL,
        // Confirmed live: transactionTypes is required, no "all types"
        // literal exists (verified — "UNKNOWN" specifically means
        // *unclassified*, the opposite of a catch-all). SWAP + TRANSFER
        // cast a deliberately wide net: the wrapper/router programs
        // NASDUCK's real swaps route through (found live earlier — not
        // standard aggregators) make it unclear Helius would always tag
        // them "SWAP" correctly, but it populates tokenTransfers for
        // either type — helius-swap-webhook classifies from those raw
        // transfers itself regardless of Helius's own type label.
        transactionTypes: ['SWAP', 'TRANSFER'],
        accountAddresses: WATCHED_POOLS,
        webhookType: 'enhanced',
        authHeader: CRON_SECRET,
      }),
    })

    const data = await res.json()
    if (!res.ok) return json({ error: data }, res.status)

    return json({ ok: true, webhookID: data.webhookID, watching: WATCHED_POOLS })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500)
  }
})

function extractApiKey(secret: string): string {
  if (!secret.startsWith('http')) return secret
  const url = new URL(secret)
  return url.searchParams.get('api-key') ?? secret
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
