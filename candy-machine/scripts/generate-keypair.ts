import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import { Keypair } from '@solana/web3.js'
import { KEY_FILE_PATH } from './_shared'

// Generates a brand-new, devnet-only keypair to act as the Candy Machine /
// Collection authority. Writes ONLY to a local gitignored file — the secret
// key is never printed to the console or logged anywhere. Refuses to
// overwrite an existing keypair so a re-run can't silently orphan whatever
// on-chain accounts the previous one controls.
if (existsSync(KEY_FILE_PATH)) {
  console.error(`Refusing to overwrite existing keypair at ${KEY_FILE_PATH}. Delete it manually first if you really want a new one.`)
  process.exit(1)
}

const keypair = Keypair.generate()
mkdirSync(dirname(KEY_FILE_PATH), { recursive: true })
writeFileSync(KEY_FILE_PATH, JSON.stringify(Array.from(keypair.secretKey)))

console.log(`New devnet authority keypair written to ${KEY_FILE_PATH} (gitignored).`)
console.log(`Public key (safe to share): ${keypair.publicKey.toBase58()}`)
