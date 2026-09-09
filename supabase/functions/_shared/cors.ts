export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, solana-client',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Reflects back whatever headers the browser's preflight actually asked for,
// instead of hardcoding an allowlist that breaks every time a client library
// (e.g. @solana/web3.js sending a "solana-client" header) adds a new one.
// Safe here since Allow-Origin is already '*' with no credentialed requests.
export function dynamicCorsHeaders(req: Request): Record<string, string> {
  const requested = req.headers.get('Access-Control-Request-Headers')
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': requested ?? corsHeaders['Access-Control-Allow-Headers'],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}
