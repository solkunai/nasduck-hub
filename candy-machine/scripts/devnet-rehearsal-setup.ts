// Devnet rehearsal of the real two-machine design, at small scale:
//   OTC machine    — 10 regular ducks, 2,000 test $NASDUCK, requires the OTC
//                    backend signer (thirdPartySigner guard)
//   Public machine — 5 regular ducks + all 5 one-of-ones, 5,000 test $NASDUCK
// Items point at the real 5,555 metadata on Arweave. Writes only public
// addresses to output/devnet-rehearsal.json.
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { Connection, Keypair } from '@solana/web3.js'
import { generateSigner, publicKey, some, type Umi } from '@metaplex-foundation/umi'
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core'
import { addConfigLines, create } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const OUT = 'output/devnet-rehearsal.json'
const SIGNER_PATH = '.keys/devnet-otc-signer.json'
const METADATA_BASE = 'https://gateway.irys.xyz/6pZkoSyYyDvLxSej4oPGkPogtDyMi4FHTyw3wsn7V2yB/'
const TOKEN = 10n ** 6n

const OTC_ITEMS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
const PUBLIC_ITEMS = [10, 11, 12, 13, 14, 5550, 5551, 5552, 5553, 5554]

// Same config-line shape as the real machines (and the rent calculation):
// "NasDucks #" + up to 4 digits, manifest base + up to "5554.json".
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
  await addConfigLines(umi, {
    candyMachine: candyMachine.publicKey,
    index: 0,
    configLines: items.map((n) => ({ name: String(n), uri: `${n}.json` })),
  }).sendAndConfirm(umi)
  return candyMachine.publicKey
}

async function main() {
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed')
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS) throw new Error('Refusing to run: RPC is not Solana devnet.')
  if (existsSync(OUT)) throw new Error(`Refusing to run: ${OUT} already exists.`)
  if (existsSync(SIGNER_PATH)) throw new Error(`Refusing to overwrite existing ${SIGNER_PATH}`)

  const fixtures = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
  const umi = getUmi()

  // Backend signer for the OTC machine. Never funded: the minter pays fees.
  const otcSigner = Keypair.generate()
  writeFileSync(SIGNER_PATH, JSON.stringify(Array.from(otcSigner.secretKey)))

  const collection = generateSigner(umi)
  await createCollection(umi, {
    collection,
    name: 'NasDucks (devnet rehearsal)',
    uri: 'https://nasduck.wtf',
    plugins: [
      {
        type: 'Royalties',
        basisPoints: 500,
        creators: [{ address: umi.identity.publicKey, percentage: 100 }],
        ruleSet: ruleSet('None'),
      },
    ],
  }).sendAndConfirm(umi)

  const mint = publicKey(fixtures.testNasduckMint)
  const destinationAta = publicKey(fixtures.tokenAccounts.treasury)

  const otcMachine = await createMachine(umi, collection.publicKey, OTC_ITEMS, {
    thirdPartySigner: some({ signerKey: publicKey(otcSigner.publicKey.toBase58()) }),
    token2022Payment: some({ amount: 2_000n * TOKEN, mint, destinationAta }),
  })
  const publicMachine = await createMachine(umi, collection.publicKey, PUBLIC_ITEMS, {
    token2022Payment: some({ amount: 5_000n * TOKEN, mint, destinationAta }),
  })

  const out = {
    cluster: 'devnet',
    collection: collection.publicKey,
    otcSigner: otcSigner.publicKey.toBase58(),
    otcMachine,
    publicMachine,
    otcItems: OTC_ITEMS,
    publicItems: PUBLIC_ITEMS,
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
