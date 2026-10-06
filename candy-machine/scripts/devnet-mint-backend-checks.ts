// End-to-end checks of the DEPLOYED nasducks-mint function on devnet: status,
// a combined OTC + public order, a public-only order, relay restrictions,
// and pool routing after the OTC machine is flipped to public.
import { readFileSync } from 'fs'
import { Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, getAccount } from '@solana/spl-token'
import { createSignerFromKeypair, generateSigner, publicKey, signerIdentity, type Umi } from '@metaplex-foundation/umi'
import { base58, base64 } from '@metaplex-foundation/umi/serializers'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { create, fetchCollection, mplCore } from '@metaplex-foundation/mpl-core'
import { mplCandyMachine } from '@metaplex-foundation/mpl-core-candy-machine'
import { flipOtcMachine } from './otc-flip'
import { getUmi } from './_shared'

const SUPABASE_URL = 'https://qrqenowwwccmfgwsnfpa.supabase.co'
const PUBLISHABLE_KEY = 'sb_publishable_8in3GY7CIf71OL_PUZv_-Q_JIXeKa4q'
const FN = `${SUPABASE_URL}/functions/v1/nasducks-mint`
const TOKEN = 10n ** 6n

const fx = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
const rh = JSON.parse(readFileSync('output/devnet-rehearsal.json', 'utf-8'))
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')
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

async function call(body: unknown) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY, authorization: `Bearer ${PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

async function auth(umi: Umi) {
  const issuedAt = new Date().toISOString()
  const msg = new TextEncoder().encode(`NasDucks OTC mint\nWallet: ${umi.identity.publicKey}\nIssued: ${issuedAt}`)
  return { issuedAt, signature: base58.deserialize(await umi.identity.signMessage(msg))[0] }
}

// What the site will do: wallet signs every prepared transaction, backend relays them.
async function signAll(umi: Umi, prepared: { transaction: string }[]) {
  const out: string[] = []
  for (const p of prepared) {
    const signed = await umi.identity.signTransaction(umi.transactions.deserialize(base64.serialize(p.transaction)))
    out.push(base64.deserialize(umi.transactions.serialize(signed))[0])
  }
  return out
}

const tokenBalance = async (ata: string) => (await getAccount(connection, new PublicKey(ata), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount
const num = (name: string) => Number(name.split('#')[1])

async function main() {
  const holderB = wallet('holderB')
  const nonHolder = wallet('nonHolder')
  const authority = getUmi()

  // Two fresh test desks for holderB (all earlier test desks are used up).
  const coll = await fetchCollection(authority, publicKey(fx.otcDeskCollection))
  for (let i = 0; i < 2; i++) {
    await create(authority, { asset: generateSigner(authority), collection: coll, name: 'TEST OTC Desk (extra)', uri: 'https://nasduck.wtf', owner: publicKey(fx.wallets.holderB) }).sendAndConfirm(authority)
  }
  await sleep(4000) // let Helius index the new desks

  // --- status --------------------------------------------------------------
  const s0 = await call({ action: 'status' })
  check('status works without a wallet', s0.status === 200 && s0.body.supply === 20, JSON.stringify(s0.body))
  check('status reports real on-chain prices', s0.body.prices?.public === String(5_000n * TOKEN) && s0.body.prices?.otc === String(2_000n * TOKEN) && s0.body.prices?.decimals === 6)
  const s1 = await call({ action: 'status', wallet: fx.wallets.holderB })
  check('status with wallet: 3 desks held, 2 unused, real token balance', s1.body.wallet?.desksHeld === 3 && s1.body.wallet?.desksAvailable === 2 && BigInt(s1.body.wallet.tokenBalance) === (await tokenBalance(fx.tokenAccounts.holderB)), JSON.stringify(s1.body.wallet))

  // --- combined order: 2 at OTC price + 2 at public price ----------------
  {
    const before = { me: await tokenBalance(fx.tokenAccounts.holderB), treasury: await tokenBalance(fx.tokenAccounts.treasury) }
    const p = await call({ action: 'prepare', wallet: fx.wallets.holderB, otcQuantity: 2, publicQuantity: 2, auth: await auth(holderB) })
    const kinds = (p.body.transactions ?? []).map((t: { kind: string; assets: string[] }) => `${t.kind}:${t.assets.length}`).join(' ')
    check('combined order prepares OTC + public transactions', p.status === 200 && kinds.includes('otc:2') && (p.body.transactions as { kind: string; assets: string[] }[]).filter((t) => t.kind === 'public').reduce((a, t) => a + t.assets.length, 0) === 2, `HTTP ${p.status} ${kinds || JSON.stringify(p.body)}`)
    if (p.status === 200) {
      const sub = await call({ action: 'submit', transactions: await signAll(holderB, p.body.transactions) })
      const results = sub.body.results ?? []
      const ducks = results.flatMap((r: { assets: { name: string }[] }) => r.assets.map((a) => a.name))
      check('backend relays, confirms, and returns all 4 minted ducks', sub.status === 200 && results.every((r: { status: string }) => r.status === 'confirmed') && ducks.length === 4, ducks.join(', ') || JSON.stringify(sub.body))
      const otcDucks = results.filter((_: unknown, i: number) => p.body.transactions[i].kind === 'otc').flatMap((r: { assets: { name: string }[] }) => r.assets.map((a) => num(a.name)))
      check('OTC-priced ducks came from the OTC pool (never a 1-of-1)', otcDucks.length === 2 && otcDucks.every((n: number) => rh.otcItems.includes(n)), otcDucks.join(','))
      const after = { me: await tokenBalance(fx.tokenAccounts.holderB), treasury: await tokenBalance(fx.tokenAccounts.treasury) }
      const expected = 2n * 2_000n * TOKEN + 2n * 5_000n * TOKEN
      check('charged exactly 2×$2-tier + 2×$5-tier, all to treasury', before.me - after.me === expected && after.treasury - before.treasury === expected)
      const s2 = await call({ action: 'status', wallet: fx.wallets.holderB })
      check('submit recorded the OTC claims (0 unused desks left)', s2.body.wallet?.desksAvailable === 0)
    }
  }

  // --- public-only order, no wallet message needed ------------------------
  {
    const p = await call({ action: 'prepare', wallet: fx.wallets.nonHolder, publicQuantity: 5 })
    const sizes = (p.body.transactions ?? []).map((t: { assets: string[] }) => t.assets.length)
    check('public-only order needs no wallet message and packs into few transactions', p.status === 200 && sizes.reduce((a: number, b: number) => a + b, 0) === 5, `mints per tx: ${sizes.join('+')}`)
    if (p.status === 200) {
      const sub = await call({ action: 'submit', transactions: await signAll(nonHolder, p.body.transactions) })
      const ducks = (sub.body.results ?? []).flatMap((r: { assets: { name: string }[] }) => r.assets.map((a) => num(a.name)))
      check('all 5 public ducks minted from the public pool', ducks.length === 5 && ducks.every((n: number) => rh.publicItems.includes(n)), ducks.join(','))
    }
  }

  // --- relay restrictions + auth regression -------------------------------
  {
    const kp = Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync('.keys/devnet-test-nonHolder.json', 'utf-8'))))
    const { blockhash } = await connection.getLatestBlockhash()
    const msg = new TransactionMessage({ payerKey: kp.publicKey, recentBlockhash: blockhash, instructions: [SystemProgram.transfer({ fromPubkey: kp.publicKey, toPubkey: kp.publicKey, lamports: 1 })] }).compileToV0Message()
    const tx = new VersionedTransaction(msg)
    tx.sign([kp])
    const r = await call({ action: 'submit', transactions: [Buffer.from(tx.serialize()).toString('base64')] })
    check('backend refuses to relay a transaction that is not a NasDucks mint', r.status === 400, `HTTP ${r.status} ${r.body.error ?? ''}`)
    const u = await call({ action: 'prepare', wallet: fx.wallets.holderB, otcQuantity: 1 })
    check('OTC-priced prepare without a wallet message is still refused', u.status === 401)
  }

  // --- after the flip: public mints draw from both pools ------------------
  {
    await flipOtcMachine(authority, { machine: rh.otcMachine, to: 'public', amount: 5_000n * TOKEN, apply: true })
    const s = await call({ action: 'status' })
    check('after flip: OTC closed, its leftovers counted in public supply', s.body.otcOpen === false && s.body.publicRemaining > 0, JSON.stringify({ otcOpen: s.body.otcOpen, publicRemaining: s.body.publicRemaining }))
    const p = await call({ action: 'prepare', wallet: fx.wallets.nonHolder, publicQuantity: s.body.publicRemaining })
    const fromOtc = (p.body.transactions ?? []).some((t: { transaction: string }) => base64.serialize(t.transaction) && t.transaction.length > 0 && nonHolder.transactions.deserialize(base64.serialize(t.transaction)).message.accounts.includes(publicKey(rh.otcMachine)))
    const fromPub = (p.body.transactions ?? []).some((t: { transaction: string }) => nonHolder.transactions.deserialize(base64.serialize(t.transaction)).message.accounts.includes(publicKey(rh.publicMachine)))
    check('buying out the rest draws from BOTH pools after the flip (nothing sent)', p.status === 200 && fromOtc && fromPub)
    await flipOtcMachine(authority, { machine: rh.otcMachine, to: 'otc', amount: 2_000n * TOKEN, signer: rh.otcSigner, apply: true })
    check('flipped back: OTC open again', (await call({ action: 'status' })).body.otcOpen === true)
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
