// Read-only: confirms the devnet stand-ins look the way the OTC backend will
// see them — Helius DAS ownership of the test desks, and test $NASDUCK
// balances. Never prints the Helius key.
import 'dotenv/config'
import { readFileSync } from 'fs'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, getAccount } from '@solana/spl-token'

const f = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf8'))
const key = process.env.HELIUS_API_KEY
if (!key) throw new Error('HELIUS_API_KEY missing from candy-machine/.env')
const HELIUS = `https://devnet.helius-rpc.com/?api-key=${key}`

async function das(method: string, params: Record<string, unknown>) {
  const res = await fetch(HELIUS, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) })
  const json = await res.json()
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`)
  return json.result
}

async function main() {
  for (const [name, expected] of [['holderA', 3], ['holderB', 1], ['nonHolder', 0]] as const) {
    const r = await das('searchAssets', { ownerAddress: f.wallets[name], grouping: ['collection', f.otcDeskCollection], burnt: false, page: 1, limit: 1000 })
    const ids = r.items.map((a: { id: string }) => a.id).sort()
    const want = (f.desks[name] ?? []).slice().sort()
    const ok = ids.length === expected && JSON.stringify(ids) === JSON.stringify(want)
    console.log(`${name.padEnd(9)} Helius sees ${ids.length} desks (expected ${expected}) ${ok ? 'OK' : 'MISMATCH'}`)
  }
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
  for (const [name, ata] of Object.entries(f.tokenAccounts as Record<string, string>)) {
    const acc = await getAccount(connection, new PublicKey(ata), 'confirmed', TOKEN_2022_PROGRAM_ID)
    console.log(`${name.padEnd(9)} test $NASDUCK balance: ${(Number(acc.amount) / 1e6).toLocaleString()}  (owner ${acc.owner.toBase58() === f.wallets[name] ? 'correct' : 'WRONG'})`)
  }
}

main().catch((e) => {
  console.error(String(e).replace(key, '***'))
  process.exit(1)
})
