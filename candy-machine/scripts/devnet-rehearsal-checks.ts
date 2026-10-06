// Devnet rehearsal checks for the two-machine setup. Reads both machines'
// config back from chain, then performs real test mints — including an
// attempt to mint from the OTC machine with a forged signer, which must be
// rejected by the program itself.
import { readFileSync } from 'fs'
import { Connection, PublicKey } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, getAccount } from '@solana/spl-token'
import {
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  signerIdentity,
  some,
  transactionBuilder,
  type Signer,
  type Umi,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { fetchAsset, mplCore } from '@metaplex-foundation/mpl-core'
import { fetchCandyGuard, fetchCandyMachine, mintV1, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine'

const RPC = 'https://api.devnet.solana.com'
const DEVNET_GENESIS = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'
const MEMO_PROGRAM = publicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr')
const METADATA_BASE = 'https://gateway.irys.xyz/6pZkoSyYyDvLxSej4oPGkPogtDyMi4FHTyw3wsn7V2yB/'
const ONE_OF_ONES = [5550, 5551, 5552, 5553, 5554]
const TOKEN = 10n ** 6n

const fx = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
const rh = JSON.parse(readFileSync('output/devnet-rehearsal.json', 'utf-8'))
const connection = new Connection(RPC, 'confirmed')

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

function walletUmi(keyPath: string): { umi: Umi; signer: Signer } {
  const umi = createUmi(RPC).use(mplCore()).use(mplCandyMachine())
  const kp = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(readFileSync(keyPath, 'utf-8'))))
  const signer = createSignerFromKeypair(umi, kp)
  umi.use(signerIdentity(signer))
  return { umi, signer }
}

const balance = async (ata: string) => (await getAccount(connection, new PublicKey(ata), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount

function memo(signer: Signer, text: string) {
  return {
    instruction: { programId: MEMO_PROGRAM, keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }], data: new TextEncoder().encode(text) },
    signers: [signer],
    bytesCreatedOnChain: 0,
  }
}

function otcMint(umi: Umi, otcSigner: Signer, memoText: string) {
  const asset = generateSigner(umi)
  const builder = mintV1(umi, {
    candyMachine: publicKey(rh.otcMachine),
    asset,
    collection: publicKey(rh.collection),
    mintArgs: {
      thirdPartySigner: some({ signer: otcSigner }),
      token2022Payment: some({ mint: publicKey(fx.testNasduckMint), destinationAta: publicKey(fx.tokenAccounts.treasury) }),
    },
  }).add(memo(otcSigner, memoText))
  return { asset, builder }
}

async function main() {
  if ((await connection.getGenesisHash()) !== DEVNET_GENESIS) throw new Error('Refusing to run: not devnet.')
  const reader = createUmi(RPC).use(mplCore()).use(mplCandyMachine())

  // --- 1. Config read back from chain -----------------------------------
  const otcCm = await fetchCandyMachine(reader, publicKey(rh.otcMachine))
  const pubCm = await fetchCandyMachine(reader, publicKey(rh.publicMachine))
  const uriNum = (uri: string) => Number(uri.replace(METADATA_BASE, '').replace('.json', ''))
  const otcNums = otcCm.items.map((i) => uriNum(i.uri))
  const pubNums = pubCm.items.map((i) => uriNum(i.uri))
  check('OTC machine has 10 items loaded', otcCm.itemsLoaded === 10 && Number(otcCm.data.itemsAvailable) === 10)
  check('public machine has 10 items loaded', pubCm.itemsLoaded === 10 && Number(pubCm.data.itemsAvailable) === 10)
  check('OTC machine contains no 1-of-1s', otcNums.every((n) => !ONE_OF_ONES.includes(n)))
  check('public machine contains all five 1-of-1s', ONE_OF_ONES.every((n) => pubNums.includes(n)))

  const otcGuard = await fetchCandyGuard(reader, otcCm.mintAuthority)
  const pubGuard = await fetchCandyGuard(reader, pubCm.mintAuthority)
  const g = (guard: typeof otcGuard) => guard.guards
  const otcTps = g(otcGuard).thirdPartySigner
  const otcPay = g(otcGuard).token2022Payment
  const pubPay = g(pubGuard).token2022Payment
  check('OTC guard requires the backend signer', otcTps.__option === 'Some' && otcTps.value.signerKey === rh.otcSigner)
  check('OTC guard charges 2,000 test $NASDUCK to treasury', otcPay.__option === 'Some' && otcPay.value.amount === 2_000n * TOKEN && otcPay.value.mint === fx.testNasduckMint && otcPay.value.destinationAta === fx.tokenAccounts.treasury)
  check('public guard charges 5,000 test $NASDUCK to treasury', pubPay.__option === 'Some' && pubPay.value.amount === 5_000n * TOKEN && pubPay.value.destinationAta === fx.tokenAccounts.treasury)
  check('public guard does NOT require the backend signer', g(pubGuard).thirdPartySigner.__option === 'None')

  // --- 2. Public mint by a wallet with no OTC Desks ---------------------
  {
    const { umi } = walletUmi('.keys/devnet-test-nonHolder.json')
    const before = { me: await balance(fx.tokenAccounts.nonHolder), treasury: await balance(fx.tokenAccounts.treasury) }
    const asset = generateSigner(umi)
    await mintV1(umi, {
      candyMachine: publicKey(rh.publicMachine),
      asset,
      collection: publicKey(rh.collection),
      mintArgs: { token2022Payment: some({ mint: publicKey(fx.testNasduckMint), destinationAta: publicKey(fx.tokenAccounts.treasury) }) },
    }).sendAndConfirm(umi)
    const after = { me: await balance(fx.tokenAccounts.nonHolder), treasury: await balance(fx.tokenAccounts.treasury) }
    const a = await fetchAsset(umi, asset.publicKey)
    check('public $5-tier mint succeeds for anyone', true)
    check('public mint charged exactly 5,000 and treasury received exactly 5,000', before.me - after.me === 5_000n * TOKEN && after.treasury - before.treasury === 5_000n * TOKEN)
    check('public-minted duck has real metadata (instant reveal) and is owned by the minter', a.name === `NasDucks #${uriNum(a.uri)}` && a.uri.startsWith(METADATA_BASE) && a.owner === fx.wallets.nonHolder, `${a.name}`)
    check('public-minted duck is in the NasDucks collection', a.updateAuthority.type === 'Collection' && a.updateAuthority.address === rh.collection)
  }

  // --- 3. OTC mint with a FORGED signer must be rejected on-chain --------
  {
    const { umi } = walletUmi('.keys/devnet-test-holderA.json')
    const forged = generateSigner(umi) // attacker's own key, not the backend's
    const before = await balance(fx.tokenAccounts.holderA)
    const { builder } = otcMint(umi, forged, 'nasducks-otc:forged')
    let rejected = false
    let reason = ''
    try {
      await builder.sendAndConfirm(umi)
    } catch (e) {
      rejected = true
      reason = String((e as Error).message).split('\n')[0].slice(0, 120)
    }
    check('OTC mint with a forged signer is rejected by the program', rejected, reason)
    check('rejected attempt charged nothing', (await balance(fx.tokenAccounts.holderA)) === before)
  }

  // --- 4. OTC mint with the real backend signer + memo ------------------
  {
    const { umi } = walletUmi('.keys/devnet-test-holderA.json')
    const otcSigner = walletUmi('.keys/devnet-otc-signer.json').signer
    const before = { me: await balance(fx.tokenAccounts.holderA), treasury: await balance(fx.tokenAccounts.treasury) }
    const { asset, builder } = otcMint(umi, otcSigner, 'nasducks-otc:rehearsal-1')
    const size = builder.getTransactionSize(umi)
    const { signature } = await builder.sendAndConfirm(umi)
    const after = { me: await balance(fx.tokenAccounts.holderA), treasury: await balance(fx.tokenAccounts.treasury) }
    const a = await fetchAsset(umi, asset.publicKey)
    check('OTC $2-tier mint succeeds with the backend signature', true, `${size} bytes of 1232`)
    check('OTC mint charged exactly 2,000 and treasury received exactly 2,000', before.me - after.me === 2_000n * TOKEN && after.treasury - before.treasury === 2_000n * TOKEN)
    check('OTC-minted duck is a regular duck from the OTC pool, owned by the minter', otcNums.includes(uriNum(a.uri)) && a.owner === fx.wallets.holderA, a.name)

    // The backend's confirmation path: find our tx via the signer's history and read its memo.
    await new Promise((r) => setTimeout(r, 2000))
    const sigs = await connection.getSignaturesForAddress(new PublicKey(rh.otcSigner), { limit: 10 })
    const sigBase58 = (await import('bs58')).default.encode(signature)
    const hit = sigs.find((s) => s.signature === sigBase58)
    check('backend can find the mint via the signer address and read its memo', !!hit && !hit.err && (hit.memo ?? '').includes('nasducks-otc:rehearsal-1'), hit?.memo ?? 'not found')
    check('the forged attempt never appears in the real signer\'s history', !sigs.some((s) => (s.memo ?? '').includes('forged')))
  }

  // --- 5. How many OTC mints fit in one transaction (no sending) --------
  {
    const { umi } = walletUmi('.keys/devnet-test-holderA.json')
    const otcSigner = walletUmi('.keys/devnet-otc-signer.json').signer
    const fits: string[] = []
    for (let k = 1; k <= 4; k++) {
      let b = transactionBuilder()
      for (let i = 0; i < k; i++) {
        b = b.add(mintV1(umi, {
          candyMachine: publicKey(rh.otcMachine),
          asset: generateSigner(umi),
          collection: publicKey(rh.collection),
          mintArgs: {
            thirdPartySigner: some({ signer: otcSigner }),
            token2022Payment: some({ mint: publicKey(fx.testNasduckMint), destinationAta: publicKey(fx.tokenAccounts.treasury) }),
          },
        }))
      }
      b = b.add(memo(otcSigner, 'nasducks-otc:00000000-0000-0000-0000-000000000000'))
      fits.push(`${k}: ${b.getTransactionSize(umi)}B ${b.fitsInOneTransaction(umi) ? 'fits' : 'too big'}`)
    }
    console.log(`INFO  OTC mints per transaction (limit 1232 bytes): ${fits.join(' | ')}`)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
