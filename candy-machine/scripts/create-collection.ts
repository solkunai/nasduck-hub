import { writeFileSync, mkdirSync } from 'fs'
import { generateSigner } from '@metaplex-foundation/umi'
import { createCollection, ruleSet } from '@metaplex-foundation/mpl-core'
import { getUmi } from './_shared'

// Devnet trial run — proves Collection + Royalties-plugin + Candy Machine +
// instant reveal actually work end to end before the real 4,444-item art
// exists. The REAL production collection gets created fresh with this same
// script once final art/metadata is ready; this one is disposable.
const umi = getUmi()
const collection = generateSigner(umi)

await createCollection(umi, {
  collection,
  name: 'NasDucks (devnet test)',
  uri: 'https://nasduck.wtf/mint', // placeholder — replace with real collection metadata JSON once it exists
  plugins: [
    {
      type: 'Royalties',
      basisPoints: 500, // 5%
      creators: [{ address: umi.identity.publicKey, percentage: 100 }],
      ruleSet: ruleSet('None'), // no program allow/deny-list restriction; royalty still enforced on Core transfers
    },
  ],
}).sendAndConfirm(umi)

mkdirSync('output', { recursive: true })
writeFileSync('output/collection-devnet.json', JSON.stringify({ collection: collection.publicKey }, null, 2))

console.log(`Collection created: ${collection.publicKey}`)
console.log('Saved to output/collection-devnet.json')
