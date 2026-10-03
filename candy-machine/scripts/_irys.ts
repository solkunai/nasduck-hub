import { readFileSync } from 'fs'
import { Uploader } from '@irys/upload'
import { Solana } from '@irys/upload-solana'
import 'dotenv/config'

const DEVNET_KEY_PATH = process.env.AUTHORITY_SECRET_KEY_PATH || '.keys/authority-devnet.json'
// Deliberately separate from the devnet authority key above — this is a
// disposable, single-purpose burner that only ever pays for Irys uploads.
// It must never be the same file as the devnet authority, and must never
// become the real Candy Machine/Collection authority later.
const MAINNET_KEY_PATH = process.env.MAINNET_UPLOAD_KEY_PATH || '.keys/mainnet-upload-burner.json'

function loadSecretKey(path: string): Uint8Array {
  return new Uint8Array(JSON.parse(readFileSync(path, 'utf-8')))
}

// Builds a real @irys/upload-solana uploader (not the Umi wrapper — this
// talks to Irys directly, which gives us uploadFolder() for streaming large
// folders from disk instead of loading 375MB into memory as GenericFiles).
// network: 'devnet' funds/uploads with devnet SOL against Irys's devnet node
// (free, non-permanent — for dry runs only). 'mainnet' is real SOL, real
// permanent Arweave storage — never call this without explicit go-ahead.
export async function getIrysUploader(network: 'devnet' | 'mainnet') {
  if (network === 'devnet') {
    const secretKey = loadSecretKey(DEVNET_KEY_PATH)
    // Irys's devnet bundler requires the underlying token RPC to also be a
    // devnet/testnet endpoint — mainnet Solana RPC is rejected outright.
    return Uploader(Solana).withWallet(secretKey).withRpc('https://api.devnet.solana.com').devnet()
  }
  const secretKey = loadSecretKey(MAINNET_KEY_PATH)
  return Uploader(Solana).withWallet(secretKey).mainnet()
}
