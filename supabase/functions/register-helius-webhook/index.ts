const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, solana-client, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const KNOWN_POOL_ADDRESSES = [
  '937nYYCPzqygDm71FX5XJzepDCnJLca9GSfe5essZK2H',
  '3vnFSkGU2foSKWsbH5pEJ6HFstugb5YBELkRGgUdJAeA',
  '63TL5RqBnTeLWK96sk9rUBEBWxmVFcWkDHGNP1vaYz3P',
  'GpDb6iSBYzqESg3D6dyDUWghCEMgLdZKNYZ4rLGVkQYL',
  'DYrsQFyEvGCRdDMHMSNpM2SPnHLZDcJeuNyCqf7pbRM2',
  '9zwRDc7jqvp2gZ4Uo9LNEzuRddzRGckBXJVyLmQA1GBf',
  'W7hiFYAfx7QjySs4mzCeNysLig3p8GzRMCpKdAs98o1',
  '4Ny7ihkR5qU8ZpnwT4bfv7gaVsrEcP9QdGXGwK7WPiuQ',
  'EWxEa2gg1QPjrnXNV5Z9rqapGhJr34LFjTXYqXuUSBS4',
  '8iuX8avSY3N7QtNo2nZoqYYox23fSxaycGxxCJhVcNZg',
  '8zKKPswFpJNBou7M4yQ1UFJVdkPDMxagV4RquFCfKLjH',
  'HFWpwj3bzdMDo7XgeCeVdWvmLnzn2q19NuxF7QTMPV9Y',
  '2fkZpFY4r8UedwWE7NPw165d2fn84KyWztiji81iGAMz',
  'HjHy9KZHk2N6hUgnSoQFUcU9oVC6BaQ1qHTNbzRSTsMe',
  '53zygLLzcbgrnYzvu3yKCvuFK7w7ZUBmv3ifDLXhtPF',
]

const CRON_SECRET = Deno.env.get('CRON_SECRET')
const HELIUS_SECRET = Deno.env.get('HELIUS_RPC_URL')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')

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

    // Confirmed live: the original registration included 'TRANSFER' in
    // transactionTypes alongside 'SWAP'. helius-swap-webhook's own classify()
    // never actually checks the Helius-assigned transaction type at all — it
    // just inspects tokenTransfers directly — so 'TRANSFER' events were
    // being delivered, fully processed, and then discarded by pool-address
    // matching for the vast majority of calls (27,831 invocations/day vs
    // 5,766 real whale_trades rows — ~79% produced nothing). Every
    // invocation is billed regardless of outcome; this single line was
    // responsible for the bulk of nasduck-hub's edge function usage.
    // 'SWAP' alone is what the whale feed actually needs — legitimate swaps
    // against PumpSwap/Meteora DLMM (this project's real pools) are
    // reliably classified as 'SWAP' by Helius's enhanced parser already, so
    // dropping 'TRANSFER' costs nothing functionally.
    //
    // Re-registering with fixed settings alone isn't enough: Helius holds
    // whatever config was set at creation time and doesn't re-read this
    // function's source, so this also has to find and delete the existing
    // webhook first — otherwise this would create a second, duplicate
    // webhook alongside the old TRANSFER-inclusive one rather than fixing
    // it.
    const existingRes = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`)
    const existing = existingRes.ok ? ((await existingRes.json()) as { webhookID: string; webhookURL: string }[]) : []
    const stale = existing.filter((w) => w.webhookURL === webhookURL)
    for (const w of stale) {
      await fetch(`https://api.helius.xyz/v0/webhooks/${w.webhookID}?api-key=${apiKey}`, { method: 'DELETE' })
    }

    const res = await fetch(`https://api.helius.xyz/v0/webhooks?api-key=${apiKey}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        webhookURL,
        transactionTypes: ['SWAP'],
        accountAddresses: WATCHED_POOLS,
        webhookType: 'enhanced',
        authHeader: CRON_SECRET,
      }),
    })

    const data = await res.json()
    if (!res.ok) return json({ error: data }, res.status)

    return json({ ok: true, webhookID: data.webhookID, watching: WATCHED_POOLS, deletedStale: stale.length })
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
