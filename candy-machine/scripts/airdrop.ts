import { sol } from '@metaplex-foundation/umi'
import { getUmi } from './_shared'

// Devnet SOL has zero real value — this is purely to fund the test authority
// wallet so it can pay rent/fees for the scripts that follow.
const umi = getUmi()

console.log(`Requesting devnet airdrop for ${umi.identity.publicKey}...`)
await umi.rpc.airdrop(umi.identity.publicKey, sol(2))

const balance = await umi.rpc.getBalance(umi.identity.publicKey)
console.log(`Balance: ${Number(balance.basisPoints) / 1e9} SOL`)
