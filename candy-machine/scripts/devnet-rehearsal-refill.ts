// Refills the devnet rehearsal with two fresh, bigger machines in the SAME
// rehearsal collection, guarded by the SAME backend signer and test token:
//   OTC machine    — 25 regular ducks, 2,000 test $NASDUCK + thirdPartySigner
//   Public machine — 25 regular ducks + all 5 one-of-ones, 5,000 test $NASDUCK
// Items point at the final (renamed-traits) metadata on Arweave. The previous
// machines are left untouched and recorded under "previous". Writes only
// public addresses to output/devnet-rehearsal.json.
import { readFileSync, writeFileSync } from 'fs'
import { Connection } from '@solana/web3.js'
import { generateSigner, publicKey, some, type Umi } from '@metaplex-foundation/umi'
import { addConfigLines, create } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const OUT = 'output/devnet-rehearsal.json'
const METADATA_BASE = 'https://gateway.irys.xyz/EpWBkNSoUXGSsfnB9W2sgKoVT57dC4aXr9LtNHDMWUTM/'
const TOKEN = 10n ** 6n
const LINES_PER_TX = 10

const range = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i)
const OTC_ITEMS = range(100, 25)
const PUBLIC_ITEMS = [...range(125, 25), 5550, 5551, 5552, 5553, 5554]

// Same config-line shape as the real machines (and the rent calculation).
const configLineSettings = {
  prefixName: 'NasDucks #',
  nameLength: 4,
  prefixUri: METADATA_BASE,
  uriLength: 9,
  isSequential: false,
}

async function createMachine(umi: Umi, collection: string, items: number[], guards: Parameters<typeof create>[1]['guards']) {
  const candyMachine = generateSigner(umi)
  await (
    await create(umi, {
      candyMachine,
      collection: publicKey(collection),
      collectionUpdateAuthority: umi.identity,
      itemsAvailable: items.length,
      isMutable: true,
      configLineSettings,
      guards,
    })
  ).sendAndConfirm(umi)
  for (let i = 0; i < items.length; i += LINES_PER_TX) {
    await addConfigLines(umi, {
      candyMachine: candyMachine.publicKey,
      index: i,
      configLines: items.slice(i, i + LINES_PER_TX).map((n) => ({ name: String(n), uri: `${n}.json` })),
    }).sendAndConfirm(umi)
  }
  return candyMachine.publicKey
}

async function main() {
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed')
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS) throw new Error('Refusing to run: RPC is not Solana devnet.')

  const fixtures = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
  const current = JSON.parse(readFileSync(OUT, 'utf-8'))
  const umi = getUmi()

  const mint = publicKey(fixtures.testNasduckMint)
  const destinationAta = publicKey(fixtures.tokenAccounts.treasury)

  const otcMachine = await createMachine(umi, current.collection, OTC_ITEMS, {
    thirdPartySigner: some({ signerKey: publicKey(current.otcSigner) }),
    token2022Payment: some({ amount: 2_000n * TOKEN, mint, destinationAta }),
  })
  const publicMachine = await createMachine(umi, current.collection, PUBLIC_ITEMS, {
    token2022Payment: some({ amount: 5_000n * TOKEN, mint, destinationAta }),
  })

  const { previous = [], ...prev } = current
  const out = {
    cluster: 'devnet',
    collection: current.collection,
    otcSigner: current.otcSigner,
    metadataBase: METADATA_BASE,
    otcMachine,
    publicMachine,
    otcItems: OTC_ITEMS,
    publicItems: PUBLIC_ITEMS,
    previous: [...previous, { otcMachine: prev.otcMachine, publicMachine: prev.publicMachine }],
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify({ otcMachine, publicMachine }, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
