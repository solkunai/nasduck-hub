import { readFileSync, writeFileSync } from 'fs'
import { generateSigner, publicKey } from '@metaplex-foundation/umi'
import { create } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

// Devnet trial run with a small item count (5) — this is purely to prove the
// mechanism (Config Line Settings + instant reveal + royalty-enforced
// collection, wrapped in a real Candy Guard) works, not a rehearsal of the
// real 4,444-item machine. The real one gets created fresh once final art
// exists — re-run with itemsAvailable: 4444, the real Arweave prefix, and
// real guards (SOL/token payment, mint limits) added to the empty `guards`
// object below.
const umi = getUmi()
const { collection } = JSON.parse(readFileSync('output/collection-devnet.json', 'utf-8'))

const candyMachine = generateSigner(umi)

const builder = await create(umi, {
  candyMachine,
  collection: publicKey(collection),
  collectionUpdateAuthority: umi.identity,
  itemsAvailable: 5,
  isMutable: true,
  configLineSettings: {
    prefixName: 'NasDuck #$ID+1$',
    nameLength: 4, // room for "1".."4444" → budget generously even for this 5-item test
    prefixUri: 'https://devnet-test.invalid/', // placeholder — real Arweave manifest base goes here for the production run
    uriLength: 10, // room for "0.json".."4443.json"
    isSequential: false,
  },
  // Deliberately no guards for this validation run — free, unrestricted
  // test mint. The real $5-in-$NASDUCK payment guard + per-wallet limit get
  // added here once that mechanism is designed.
  guards: {},
  groups: [],
})
await builder.sendAndConfirm(umi)

writeFileSync('output/candy-machine-devnet.json', JSON.stringify({ candyMachine: candyMachine.publicKey }, null, 2))

console.log(`Candy Machine (+ Candy Guard) created: ${candyMachine.publicKey}`)
console.log('Saved to output/candy-machine-devnet.json')
