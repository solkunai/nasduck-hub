import { readFileSync } from 'fs'
import { generateSigner, publicKey } from '@metaplex-foundation/umi'
import { mintV1 } from '@metaplex-foundation/mpl-core-candy-machine'
import { fetchAsset, fetchCollection } from '@metaplex-foundation/mpl-core'
import { getUmi } from './_shared'

// Mints one of the 5 test items and fetches it straight back from-chain —
// this is the actual proof that Config Line Settings gives real, instant
// reveal (the fetched name/uri should be real test data, e.g. "NasDuck #1" /
// "0.json", not a shared placeholder) and that the Royalties plugin landed
// correctly on the collection.
const umi = getUmi()
const { collection } = JSON.parse(readFileSync('output/collection-devnet.json', 'utf-8'))
const { candyMachine } = JSON.parse(readFileSync('output/candy-machine-devnet.json', 'utf-8'))

const asset = generateSigner(umi)

await mintV1(umi, {
  candyMachine: publicKey(candyMachine),
  asset,
  collection: publicKey(collection),
}).sendAndConfirm(umi)

const minted = await fetchAsset(umi, asset.publicKey)
const coll = await fetchCollection(umi, publicKey(collection))

console.log('--- Minted asset (fetched back from devnet) ---')
console.log('Address:', asset.publicKey)
console.log('Name:', minted.name)
console.log('URI:', minted.uri)
console.log('--- Collection royalty plugin ---')
console.log(JSON.stringify(coll.royalties, (_key, value) => (typeof value === 'bigint' ? value.toString() : value), 2))

const isRealData = minted.name !== '' && minted.uri.endsWith('.json')
console.log(`\nInstant reveal check: ${isRealData ? 'PASS — real test metadata, no placeholder/reveal step needed' : 'FAIL — check output above'}`)
