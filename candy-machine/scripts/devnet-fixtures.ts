// Devnet-only stand-ins for the OTC mint rehearsal: a fake "OTC Desk" Core
// collection with test NFTs, a fake Token-2022 "$NASDUCK" (plain mint with
// the real token's 6 decimals — real $NASDUCK has only metadata extensions,
// no transfer fee/hook, so payment behavior matches), and test wallets.
// Writes only public addresses to output/devnet-fixtures.json.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, createMint, getOrCreateAssociatedTokenAccount, mintTo } from '@solana/spl-token'
import { generateSigner, publicKey } from '@metaplex-foundation/umi'
import { create, createCollection, fetchCollection } from '@metaplex-foundation/mpl-core'
import { getUmi, KEY_FILE_PATH } from './_shared'

const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const OUT = 'output/devnet-fixtures.json'
const RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com'

// Test NASDUCK per wallet: 50M tokens (6 decimals) — plenty for many mints
// at any realistic stand-in price.
const TEST_TOKENS_PER_WALLET = 50_000_000n * 10n ** 6n
const SOL_PER_TEST_WALLET = 0.05

const WALLETS = ['holderA', 'holderB', 'nonHolder', 'treasury'] as const
const DESKS_PER_WALLET: Record<string, number> = { holderA: 3, holderB: 1 }

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed')
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS) {
    throw new Error('Refusing to run: RPC is not Solana devnet.')
  }
  if (existsSync(OUT)) {
    throw new Error(`Refusing to run: ${OUT} already exists (fixtures already created).`)
  }

  const authority = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(KEY_FILE_PATH, 'utf-8'))))
  const umi = getUmi()
  mkdirSync('.keys', { recursive: true })
  mkdirSync('output', { recursive: true })

  // 1. Test wallets (secret keys stay in gitignored .keys/).
  const wallets: Record<string, Keypair> = {}
  for (const name of WALLETS) {
    const path = `.keys/devnet-test-${name}.json`
    if (existsSync(path)) throw new Error(`Refusing to overwrite existing ${path}`)
    const kp = Keypair.generate()
    writeFileSync(path, JSON.stringify(Array.from(kp.secretKey)))
    wallets[name] = kp
  }
  const fund = new Transaction()
  for (const name of WALLETS) {
    fund.add(SystemProgram.transfer({ fromPubkey: authority.publicKey, toPubkey: wallets[name].publicKey, lamports: SOL_PER_TEST_WALLET * LAMPORTS_PER_SOL }))
  }
  await sendAndConfirmTransaction(connection, fund, [authority])
  console.log('test wallets created and funded')

  // 2. Fake OTC Desk collection + test NFTs owned by the holder wallets.
  const otcCollection = generateSigner(umi)
  await createCollection(umi, { collection: otcCollection, name: 'TEST OTC Desk (devnet)', uri: 'https://nasduck.wtf' }).sendAndConfirm(umi)
  const collectionAccount = await fetchCollection(umi, otcCollection.publicKey)
  const desks: Record<string, string[]> = {}
  let n = 1
  for (const [name, count] of Object.entries(DESKS_PER_WALLET)) {
    desks[name] = []
    for (let i = 0; i < count; i++) {
      const asset = generateSigner(umi)
      await create(umi, {
        asset,
        collection: collectionAccount,
        name: `TEST OTC Desk #${n++}`,
        uri: 'https://nasduck.wtf',
        owner: publicKey(wallets[name].publicKey.toBase58()),
      }).sendAndConfirm(umi)
      desks[name].push(asset.publicKey)
    }
  }
  console.log('test OTC Desk collection + desks created')

  // 3. Fake Token-2022 $NASDUCK, balances for the minters, and the
  // treasury's token account (the payment guard's destination must exist).
  const testNasduck = await createMint(connection, authority, authority.publicKey, null, 6, undefined, undefined, TOKEN_2022_PROGRAM_ID)
  const tokenAccounts: Record<string, string> = {}
  for (const name of WALLETS) {
    const ata = await getOrCreateAssociatedTokenAccount(connection, authority, testNasduck, wallets[name].publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID)
    tokenAccounts[name] = ata.address.toBase58()
    if (name !== 'treasury') {
      await mintTo(connection, authority, testNasduck, ata.address, authority, TEST_TOKENS_PER_WALLET, [], undefined, TOKEN_2022_PROGRAM_ID)
    }
  }
  console.log('test $NASDUCK created and distributed')

  const fixtures = {
    cluster: 'devnet',
    otcDeskCollection: otcCollection.publicKey,
    testNasduckMint: testNasduck.toBase58(),
    wallets: Object.fromEntries(WALLETS.map((name) => [name, wallets[name].publicKey.toBase58()])),
    tokenAccounts,
    desks,
  }
  writeFileSync(OUT, JSON.stringify(fixtures, null, 2))
  console.log(JSON.stringify(fixtures, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
