import { readFileSync, existsSync } from 'fs'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { mplCore } from '@metaplex-foundation/mpl-core'
import { mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine'
import { createSignerFromKeypair, signerIdentity, type Umi } from '@metaplex-foundation/umi'
import 'dotenv/config'

const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com'
const KEY_PATH = process.env.AUTHORITY_SECRET_KEY_PATH || '.keys/authority-devnet.json'

// Loads the devnet-only authority keypair from a local, gitignored file.
// Never logs or returns the raw secret bytes — only the Umi signer built
// from them. Run `npm run keypair:generate` first if this file doesn't exist.
export function getUmi(): Umi {
  if (!existsSync(KEY_PATH)) {
    throw new Error(`No authority keypair found at ${KEY_PATH} — run "npm run keypair:generate" first.`)
  }
  const secretKey = new Uint8Array(JSON.parse(readFileSync(KEY_PATH, 'utf-8')))

  const umi = createUmi(RPC_URL).use(mplCore()).use(mplCandyMachine())
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey)
  const signer = createSignerFromKeypair(umi, keypair)
  umi.use(signerIdentity(signer))
  return umi
}

export const KEY_FILE_PATH = KEY_PATH
