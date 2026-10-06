// Sets up a real wallet for hands-on testing of the mint page on devnet:
// devnet SOL for fees, test OTC Desks, and test $NASDUCK.
// Usage: tsx scripts/devnet-fund-tester.ts <wallet address> [desks=3]
import { readFileSync } from 'fs'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { generateSigner, publicKey } from '@metaplex-foundation/umi'
import { create, fetchCollection } from '@metaplex-foundation/mpl-core'
import { getUmi, KEY_FILE_PATH } from './_shared'

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const SOL = 0.1
const TEST_TOKENS = 200_000n * 10n ** 6n

async function main() {
  const target = new PublicKey(process.argv[2] ?? '') // throws on a bad address
  const desks = Number(process.argv[3] ?? 3)
  const connection = new Connection(process.env.RPC_URL || 'https://api.devnet.solana.com', 'confirmed')
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS) throw new Error('Refusing to run: RPC is not Solana devnet.')

  const fx = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
  const authority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(KEY_FILE_PATH, 'utf-8'))))
  const umi = getUmi()

  await sendAndConfirmTransaction(
    connection,
    new Transaction().add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: target, lamports: SOL * LAMPORTS_PER_SOL })),
    [authority],
  )
  console.log(`sent ${SOL} devnet SOL`)

  const coll = await fetchCollection(umi, publicKey(fx.otcDeskCollection))
  for (let i = 0; i < desks; i++) {
    const asset = generateSigner(umi)
    await create(umi, { asset, collection: coll, name: 'TEST OTC Desk', uri: 'https://nasduck.wtf', owner: publicKey(target.toBase58()) }).sendAndConfirm(umi)
    console.log(`test OTC Desk: ${asset.publicKey}`)
  }

  const mint = new PublicKey(fx.testNasduckMint)
  const ata = await getOrCreateAssociatedTokenAccount(connection, authority, mint, target, false, undefined, undefined, TOKEN_2022_PROGRAM_ID)
  await mintTo(connection, authority, mint, ata.address, authority, TEST_TOKENS, [], undefined, TOKEN_2022_PROGRAM_ID)
  console.log(`minted ${TEST_TOKENS / 10n ** 6n} test $NASDUCK`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
