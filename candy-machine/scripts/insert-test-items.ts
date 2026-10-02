import { readFileSync } from 'fs'
import { publicKey } from '@metaplex-foundation/umi'
import { addConfigLines } from '@metaplex-foundation/mpl-core-candy-machine'
import { getUmi } from './_shared'

// Fake test items — just proves the config-line → instant-reveal mechanism.
// Real names/URIs get inserted once the final art export + Arweave upload exist.
const umi = getUmi()
const { candyMachine } = JSON.parse(readFileSync('output/candy-machine-devnet.json', 'utf-8'))

await addConfigLines(umi, {
  candyMachine: publicKey(candyMachine),
  index: 0,
  configLines: [
    { name: '1', uri: '0.json' },
    { name: '2', uri: '1.json' },
    { name: '3', uri: '2.json' },
    { name: '4', uri: '3.json' },
    { name: '5', uri: '4.json' },
  ],
}).sendAndConfirm(umi)

console.log('Inserted 5 test config lines.')
