// Adversarial checks against the DEPLOYED nasducks-mint function on devnet
// (ported from the retired otc-mint checks):
//   - bad input / missing or forged wallet signatures are refused
//   - tampered transaction is rejected by the network
//   - abandoned reservation is released only after expiry + chain check
//   - mint that landed but was never submitted/confirmed gets auto-confirmed
//   - passing a used desk to another wallet earns no second discount
//   - simultaneous requests can't double-reserve the same desk
//   - lowering the live price inside a signed transaction is rejected
//   - flipping the machine to public shuts the $2 path, and back restores it
// Creates its own fresh test desks, so it doesn't depend on earlier runs.
// Needs at least 3 ducks left in the devnet OTC machine. Takes ~4 minutes.
import { readFileSync } from 'fs'
import { createSignerFromKeypair, generateSigner, publicKey, signerIdentity, some, type Umi } from '@metaplex-foundation/umi'
import { base58, base64 } from '@metaplex-foundation/umi/serializers'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { create, fetchAsset, fetchCollection, mplCore, transfer } from '@metaplex-foundation/mpl-core'
import { mintV1, mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine'
import 'dotenv/config'
import { setMachineSigner } from './otc-flip'
import { getUmi } from './_shared'

const SUPABASE_URL = 'https://qrqenowwwccmfgwsnfpa.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_8in3GY7CIf71OL_PUZv_-Q_JIXeKa4q'
const FN = `${SUPABASE_URL}/functions/v1/nasducks-mint`
const TOKEN = 10n ** 6n

const fx = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
const rh = JSON.parse(readFileSync('output/devnet-rehearsal.json', 'utf-8'))
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}

function wallet(name: string): Umi {
  const umi = createUmi('https://api.devnet.solana.com').use(mplCore()).use(mplCandyMachine())
  const kp = umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(readFileSync(`.keys/devnet-test-${name}.json`, 'utf-8'))))
  umi.use(signerIdentity(createSignerFromKeypair(umi, kp)))
  return umi
}

// A throwaway wallet that never holds SOL; only used to sign messages.
function freshWallet(): Umi {
  const umi = createUmi('https://api.devnet.solana.com').use(mplCore()).use(mplCandyMachine())
  umi.use(signerIdentity(generateSigner(umi)))
  return umi
}

async function call(body: unknown) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY, authorization: `Bearer ${PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

// signerUmi signs a message claiming to be `claimed` (forgery when they differ).
async function auth(signerUmi: Umi, claimed = String(signerUmi.identity.publicKey)) {
  const issuedAt = new Date().toISOString()
  const msg = new TextEncoder().encode(`NasDucks OTC mint\nWallet: ${claimed}\nIssued: ${issuedAt}`)
  return { issuedAt, signature: base58.deserialize(await signerUmi.identity.signMessage(msg))[0] }
}

const prepareOtc = async (umi: Umi, otcQuantity: number) =>
  call({ action: 'prepare', wallet: umi.identity.publicKey, otcQuantity, publicQuantity: 0, auth: await auth(umi) })
const walletStatus = async (addr: string) => (await call({ action: 'status', wallet: addr })).body
const available = async (addr: string) => (await walletStatus(addr)).wallet?.desksAvailable as number

// Sends straight to the network, bypassing the backend's submit (so the
// backend never hears about it).
async function signAndSendDirect(umi: Umi, b64: string, lastValidBlockHeight: number) {
  const tx = umi.transactions.deserialize(base64.serialize(b64))
  const sig = await umi.rpc.sendTransaction(await umi.identity.signTransaction(tx))
  await umi.rpc.confirmTransaction(sig, { strategy: { type: 'blockhash', blockhash: tx.message.blockhash, lastValidBlockHeight } })
  return base58.deserialize(sig)[0]
}

async function signAndSubmit(umi: Umi, b64: string) {
  const signed = await umi.identity.signTransaction(umi.transactions.deserialize(base64.serialize(b64)))
  return call({ action: 'submit', transactions: [base64.deserialize(umi.transactions.serialize(signed))[0]] })
}

async function heliusDeskCount(owner: string) {
  const res = await fetch(`https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'searchAssets', params: { ownerAddress: owner, grouping: ['collection', fx.otcDeskCollection], burnt: false, page: 1, limit: 1000 } }),
  })
  return (await res.json()).result.items.length as number
}

async function main() {
  const holderA = wallet('holderA')
  const holderB = wallet('holderB')
  const nonHolder = wallet('nonHolder')
  const authority = getUmi()

  const s = (await call({ action: 'status' })).body
  if (!s.otcOpen || s.otcRemaining < 3) {
    console.log(`Needs the devnet OTC machine open with >= 3 ducks left (open=${s.otcOpen}, left=${s.otcRemaining}).`)
    process.exit(1)
  }

  // One fresh desk each for holderA and holderB.
  const coll = await fetchCollection(authority, publicKey(fx.otcDeskCollection))
  const newDesk: Record<string, string> = {}
  for (const name of ['holderA', 'holderB']) {
    const asset = generateSigner(authority)
    await create(authority, { asset, collection: coll, name: 'TEST OTC Desk (break-it)', uri: 'https://nasduck.wtf', owner: publicKey(fx.wallets[name]) }).sendAndConfirm(authority)
    newDesk[name] = asset.publicKey
  }
  await sleep(4000) // let Helius index the new desks
  const availA0 = await available(fx.wallets.holderA)
  const availB0 = await available(fx.wallets.holderB)
  console.log(`INFO  starting availability: holderA=${availA0} holderB=${availB0}`)

  // --- 0. Input and wallet-signature enforcement (nothing is reserved) -------
  check('garbage wallet address is rejected', (await call({ action: 'status', wallet: 'not-a-wallet' })).status === 400)
  let p = await call({ action: 'prepare', wallet: fx.wallets.holderA, otcQuantity: 1, publicQuantity: 0 })
  check('OTC prepare without a wallet signature is refused', p.status === 401, `HTTP ${p.status}`)
  p = await call({ action: 'prepare', wallet: fx.wallets.holderA, otcQuantity: 1, publicQuantity: 0, auth: await auth(nonHolder, fx.wallets.holderA) })
  check("OTC prepare signed by someone else's wallet is refused (can't spend another holder's desks)", p.status === 401, `HTTP ${p.status}`)
  p = await prepareOtc(freshWallet(), 1)
  check('OTC prepare for a wallet with no OTC Desk is refused', p.status === 403, `HTTP ${p.status} ${p.body.error ?? ''}`)
  p = await call({ action: 'prepare', wallet: fx.wallets.holderA, otcQuantity: 31, publicQuantity: 0, auth: await auth(holderA) })
  check('quantity above the per-request cap is refused', p.status === 400, `HTTP ${p.status}`)
  p = await call({ action: 'prepare', wallet: fx.wallets.holderA, otcQuantity: 0, publicQuantity: 0 })
  check('an empty order is refused', p.status === 400, `HTTP ${p.status}`)
  check('none of that reserved anything', (await available(fx.wallets.holderA)) === availA0)

  // --- 1. Tampered transaction + abandoned reservation (holderA) -------------
  const pA = await prepareOtc(holderA, 1)
  check('holderA reserves one desk', pA.status === 200 && pA.body.transactions?.length === 1, `HTTP ${pA.status}`)
  {
    const tx = holderA.transactions.deserialize(base64.serialize(pA.body.transactions[0].transaction))
    const tampered = new Uint8Array(tx.serializedMessage)
    tampered[tampered.length - 1] ^= 0x01 // flip one bit (inside the memo)
    let rejected = false
    let reason = ''
    try {
      await holderA.rpc.sendTransaction(await holderA.identity.signTransaction({ ...tx, serializedMessage: tampered }))
    } catch (e) {
      rejected = true
      reason = String((e as Error).message).split('\n')[0].slice(0, 100)
    }
    check('a tampered transaction is rejected by the network', rejected, reason)
  }
  // The original is deliberately never sent: that reservation is abandoned.

  // --- 1b. Paying less than the live price -----------------------------------
  {
    const p = await call({ action: 'prepare', wallet: fx.wallets.nonHolder, otcQuantity: 0, publicQuantity: 1 })
    const tx = nonHolder.transactions.deserialize(base64.serialize(p.body.transactions[0].transaction))
    // Find the top-up TransferChecked (Token-2022, discriminator 12) and cut its amount to 1.
    const ix = tx.message.instructions.find((i) => String(tx.message.accounts[i.programIndex]) === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb' && i.data[0] === 12)
    check('every public mint carries a live-price top-up transfer', !!ix)
    if (ix) {
      const cheap = { ...tx.message, instructions: tx.message.instructions.map((i) => (i === ix ? { ...i, data: Uint8Array.from([12, 1, 0, 0, 0, 0, 0, 0, 0, i.data[9]]) } : i)) }
      let rejected = false
      let reason = ''
      try {
        const reserialized = nonHolder.transactions.serializeMessage(cheap)
        const signed = await nonHolder.identity.signTransaction({ ...tx, message: cheap, serializedMessage: reserialized })
        await nonHolder.rpc.sendTransaction(signed)
      } catch (e) {
        rejected = true
        reason = String((e as Error).message).split('\n')[0].slice(0, 100)
      }
      check('a transaction with the price lowered is rejected (backend signature no longer matches)', rejected, reason)
    }
  }

  // --- 2. Mint that lands but the backend never hears about (holderB) --------
  const pB = await prepareOtc(holderB, 1)
  check('holderB reserves one desk', pB.status === 200 && pB.body.transactions?.length === 1, `HTTP ${pB.status}`)
  const landedSig = await signAndSendDirect(holderB, pB.body.transactions[0].transaction, pB.body.lastValidBlockHeight)
  check('holderB mint lands on-chain without going through submit', !!landedSig)
  check(
    'while in flight, both reserved desks show as unavailable',
    (await available(fx.wallets.holderA)) === availA0 - 1 && (await available(fx.wallets.holderB)) === availB0 - 1,
  )

  console.log('INFO  waiting 190s for both reservations to expire...')
  await sleep(190_000)

  check('abandoned reservation was released after expiry (chain showed it never landed)', (await available(fx.wallets.holderA)) === availA0)
  check('landed-but-unrecorded mint was auto-confirmed on expiry, not released', (await available(fx.wallets.holderB)) === availB0 - 1)
  const replay = await call({ action: 'confirm', signatures: [landedSig] })
  check('confirming an already-recorded mint again changes nothing', replay.status === 200 && replay.body.confirmed === 0, JSON.stringify(replay.body))

  // --- 3. Wallet hopping: hand every holderB desk (all used) to a new wallet -
  if ((await available(fx.wallets.holderB)) !== 0) {
    check('setup: holderB has no unused desks left to hop with', false, 'skipping the wallet-hop checks')
  } else {
    const hopper = freshWallet()
    const deskIds: string[] = (
      await (
        await fetch(`https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'searchAssets', params: { ownerAddress: fx.wallets.holderB, grouping: ['collection', fx.otcDeskCollection], burnt: false, page: 1, limit: 1000 } }),
        })
      ).json()
    ).result.items.map((i: { id: string }) => i.id)
    for (const id of deskIds) {
      const asset = await fetchAsset(holderB, publicKey(id))
      await transfer(holderB, { asset, collection: coll, newOwner: hopper.identity.publicKey }).sendAndConfirm(holderB)
    }
    for (let i = 0; i < 20 && (await heliusDeskCount(String(hopper.identity.publicKey))) < deskIds.length; i++) await sleep(3000)
    const w = (await walletStatus(String(hopper.identity.publicKey))).wallet
    check('the new wallet now holds the desks', w?.desksHeld === deskIds.length, JSON.stringify(w))
    check('...but shows 0 available: used desks earn no second discount', w?.desksAvailable === 0)
    const pH = await prepareOtc(hopper, 1)
    check('...and a $2 mint attempt with them is refused', pH.status === 409, `HTTP ${pH.status} ${pH.body.error ?? ''}`)
  }

  // --- 4. Simultaneous requests can't over-reserve (holderA) -----------------
  {
    const free = await available(fx.wallets.holderA)
    const results = await Promise.all(Array.from({ length: free + 4 }, () => prepareOtc(holderA, 1)))
    const ok = results.filter((r) => r.status === 200)
    check(`${free + 4} simultaneous requests for ${free} free desk(s): exactly ${free} succeed`, ok.length === free, results.map((r) => r.status).join(','))
    const winner = ok[0]
    if (winner) {
      const sub = await signAndSubmit(holderA, winner.body.transactions[0].transaction)
      check('a winning request mints and is recorded normally', sub.status === 200 && sub.body.results?.[0]?.status === 'confirmed', JSON.stringify(sub.body).slice(0, 160))
    }
  }

  // --- 5. Flip the OTC machine to public, then back --------------------------
  {
    await setMachineSigner(authority, { machine: rh.otcMachine, signer: rh.mintSigner, floor: BigInt(rh.floorTokens) * TOKEN, apply: true })
    await sleep(12_000) // let the backend's ~10s status cache expire
    check('after flipping to public, the backend reports the OTC mint as closed', (await walletStatus(fx.wallets.holderA)).otcOpen === false)
    const pF = await prepareOtc(holderA, 1)
    check('...and refuses to prepare $2 mints', pF.status === 409, `HTTP ${pF.status} ${pF.body.error ?? ''}`)

    let rejected = false
    try {
      await mintV1(nonHolder, {
        candyMachine: publicKey(rh.otcMachine),
        asset: generateSigner(nonHolder),
        collection: publicKey(rh.collection),
        mintArgs: { token2022Payment: some({ mint: publicKey(fx.testNasduckMint), destinationAta: publicKey(fx.tokenAccounts.treasury) }) },
      }).sendAndConfirm(nonHolder)
    } catch {
      rejected = true
    }
    check('...and minting its leftovers while skipping the backend is still rejected', rejected)
    const pub = await call({ action: 'prepare', wallet: fx.wallets.nonHolder, otcQuantity: 0, publicQuantity: 30 })
    const usesOtc = (pub.body.transactions ?? []).some((t: { transaction: string }) =>
      nonHolder.transactions.deserialize(base64.serialize(t.transaction)).message.accounts.map(String).includes(rh.otcMachine),
    )
    check('the backend now sells OTC leftovers at the $5 quote (nothing sent)', pub.status === 200 && usesOtc, `HTTP ${pub.status}`)

    await setMachineSigner(authority, { machine: rh.otcMachine, signer: rh.otcSigner, floor: BigInt(rh.floorTokens) * TOKEN, apply: true })
    await sleep(12_000) // let the backend's ~10s status cache expire
    check('flipping back to OTC re-opens the holder mint', (await walletStatus(fx.wallets.holderA)).otcOpen === true)
  }

  console.log(`\nINFO  fresh test desks: ${JSON.stringify(newDesk)}`)
  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
