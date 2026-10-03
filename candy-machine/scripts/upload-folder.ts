// Uploads a folder of files to Irys as one bundled manifest upload.
// Usage: tsx scripts/upload-folder.ts <devnet|mainnet> <path-to-folder>
import { getIrysUploader } from './_irys'

async function main() {
  const network = process.argv[2] as 'devnet' | 'mainnet'
  const folder = process.argv[3]
  if (network !== 'devnet' && network !== 'mainnet') {
    throw new Error('Usage: tsx scripts/upload-folder.ts <devnet|mainnet> <path-to-folder>')
  }
  if (!folder) {
    throw new Error('Usage: tsx scripts/upload-folder.ts <devnet|mainnet> <path-to-folder>')
  }

  const irys = await getIrysUploader(network)

  console.log(`[${network}] balance before:`, (await irys.getBalance()).toString())

  // uploadFolder does NOT auto-fund (unlike the Umi wrapper's upload()) —
  // it needs the Irys-side balance pre-funded or every item 402s. Price a
  // generous estimate (folder bytes + 30% safety margin for the manifest
  // transaction and any price drift mid-batch) and fund it up front.
  const { statSync, readdirSync } = await import('fs')
  const { join } = await import('path')
  const folderBytes = readdirSync(folder).reduce((sum, f) => sum + statSync(join(folder, f)).size, 0)
  const price = await irys.getPrice(Math.ceil(folderBytes * 1.3))
  console.log(`[${network}] funding ${price.toString()} atomic units for ${folderBytes.toLocaleString()} bytes...`)
  await irys.fund(price)
  console.log(`[${network}] balance after funding:`, (await irys.getBalance()).toString())

  // Small files (like these metadata JSONs) qualify for Irys's free tier,
  // which has its own request-rate limit separate from account balance —
  // a batchSize of 10 concurrent requests tripped a 402 "Free transaction
  // limit exceeded" on the metadata folder even though funds were present.
  // Lower concurrency avoids hammering that rate limit.
  const batchSize = Number(process.argv[4]) || 3
  const receipt = await irys.uploadFolder(folder, {
    batchSize,
    keepDeleted: false,
    indexFile: '',
  })

  if (!receipt) {
    throw new Error('Upload returned no receipt — nothing was uploaded (empty folder?).')
  }

  console.log(`\n[${network}] manifest id: ${receipt.id}`)
  console.log(`[${network}] manifest url: https://gateway.irys.xyz/${receipt.id}`)
  console.log(`[${network}] balance after:`, (await irys.getBalance()).toString())
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
