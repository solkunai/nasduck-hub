// Read-only sanity check of the Helius lookup the OTC backend will use.
// Never prints the API key or the RPC URL that contains it.
import 'dotenv/config'

const OTC_DESK_COLLECTION = 'D7sLW9uKZG3G7bNbWfMHvKSgVhU9nXdv7huTfepF5Jrh'
const key = process.env.HELIUS_API_KEY
if (!key) throw new Error('HELIUS_API_KEY missing from candy-machine/.env')
const RPC = `https://mainnet.helius-rpc.com/?api-key=${key}`

async function das(method: string, params: Record<string, unknown>) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`)
  return json.result
}

async function main() {
  // 1. Every asset in the OTC Desk collection, to confirm it's the right one.
  const owners = new Map<string, number>()
  let total = 0
  let burnt = 0
  let iface = new Set<string>()
  for (let page = 1; ; page++) {
    const r = await das('getAssetsByGroup', { groupKey: 'collection', groupValue: OTC_DESK_COLLECTION, page, limit: 1000 })
    for (const a of r.items) {
      total++
      iface.add(a.interface)
      if (a.burnt) { burnt++; continue }
      owners.set(a.ownership.owner, (owners.get(a.ownership.owner) ?? 0) + 1)
    }
    if (r.items.length < 1000) break
  }
  console.log(`collection assets: ${total} (burnt: ${burnt}), interface: ${[...iface].join(',')}, unique holders: ${owners.size}`)

  // 2. Per-wallet count — the exact call the backend will make — checked
  // against the full-collection tally above for a few real holders.
  const sample = [...owners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
  for (const [owner, expected] of sample) {
    const r = await das('searchAssets', {
      ownerAddress: owner,
      grouping: ['collection', OTC_DESK_COLLECTION],
      burnt: false,
      page: 1,
      limit: 1000,
    })
    const got = r.items.length
    console.log(`${owner.slice(0, 4)}…${owner.slice(-4)}: per-wallet lookup ${got}, full-collection tally ${expected} ${got === expected ? 'OK' : 'MISMATCH'}`)
  }
}

main().catch((e) => {
  console.error(String(e).replace(key, '***'))
  process.exit(1)
})
