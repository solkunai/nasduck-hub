// Uploads one file to Irys/Arweave and prints its permanent URL.
// Usage: tsx scripts/upload-file.ts <devnet|mainnet> <path> <content-type> [--apply]
// Without --apply it only prints the price.
import { readFileSync, statSync } from 'fs'
import { getIrysUploader } from './_irys'

async function main() {
  const [network, path, contentType] = process.argv.slice(2)
  if ((network !== 'devnet' && network !== 'mainnet') || !path || !contentType) {
    throw new Error('Usage: tsx scripts/upload-file.ts <devnet|mainnet> <path> <content-type> [--apply]')
  }
  const irys = await getIrysUploader(network)
  const bytes = statSync(path).size
  const price = await irys.getPrice(bytes)
  const balance = await irys.getBalance()
  console.log(`[${network}] ${bytes.toLocaleString()} bytes, price ${price.toString()}, balance ${balance.toString()}`)
  if (!process.argv.includes('--apply')) return console.log('dry run — nothing uploaded. Re-run with --apply.')
  if (balance.lt(price)) await irys.fund(price.minus(balance))
  const receipt = await irys.upload(readFileSync(path), { tags: [{ name: 'Content-Type', value: contentType }] })
  console.log(`[${network}] uploaded: https://gateway.irys.xyz/${receipt.id}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
