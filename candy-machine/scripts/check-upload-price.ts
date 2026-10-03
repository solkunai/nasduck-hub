// Read-only price check — does NOT fund or upload anything. Safe to run
// against mainnet; querying a price quote costs nothing.
import { statSync, readdirSync } from 'fs'
import { join } from 'path'
import { getIrysUploader } from './_irys'

const COLLECTION_DIR = process.env.COLLECTION_DIR || '../../NasDucks_Final_Collection'

function folderBytes(dir: string): number {
  let total = 0
  for (const f of readdirSync(dir)) {
    total += statSync(join(dir, f)).size
  }
  return total
}

async function main() {
  const imagesBytes = folderBytes(join(COLLECTION_DIR, 'images'))
  const metadataBytes = folderBytes(join(COLLECTION_DIR, 'metadata'))
  const totalBytes = imagesBytes + metadataBytes

  console.log(`images: ${(imagesBytes / 1024 / 1024).toFixed(1)} MB`)
  console.log(`metadata: ${(metadataBytes / 1024 / 1024).toFixed(1)} MB`)
  console.log(`total: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`)

  const mainnet = await getIrysUploader('mainnet')
  const priceAtomic = await mainnet.getPrice(totalBytes)
  const sol = Number(priceAtomic.toString()) / 1e9

  console.log(`\nMAINNET price for ${totalBytes.toLocaleString()} bytes: ${priceAtomic.toString()} lamports = ${sol.toFixed(4)} SOL`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
