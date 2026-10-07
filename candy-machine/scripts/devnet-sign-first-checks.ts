// Checks the "wallet signs first" flow against the DEPLOYED devnet test copy
// (nasducks-mint-devnet): orders come back unsigned, the backend co-signs
// only an order it built (wallet safety-check instructions allowed), each
// order once, and voided orders never land. Uses the devnet test wallets.
import { readFileSync } from 'fs'
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { base58 } from '@metaplex-foundation/umi/serializers'
import nacl from 'tweetnacl'

const FN = 'https://qrqenowwwccmfgwsnfpa.supabase.co/functions/v1/nasducks-mint-devnet'
const PUBLISHABLE_KEY = 'sb_publishable_8in3GY7CIf71OL_PUZv_-Q_JIXeKa4q'
const fx = JSON.parse(readFileSync('output/devnet-fixtures.json', 'utf-8'))
const full = JSON.parse(readFileSync('output/devnet-fullsize.json', 'utf-8'))
const split = JSON.parse(readFileSync('output/pool-split.json', 'utf-8'))
const connection = new Connection('https://api.devnet.solana.com', 'confirmed')

let pass = 0
let fail = 0
const check = (name: string, ok: boolean, detail = '') => {
  ok ? pass++ : fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`)
}
const kp = (name: string) => Keypair.fromSecretKey(new Uint8Array(JSON.parse(readFileSync(`.keys/devnet-test-${name}.json`, 'utf-8'))))

async function call(body: unknown) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: PUBLISHABLE_KEY, authorization: `Bearer ${PUBLISHABLE_KEY}` },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

function auth(k: Keypair) {
  const issuedAt = new Date().toISOString()
  const msg = new TextEncoder().encode(`NasDucks OTC mint\nWallet: ${k.publicKey.toBase58()}\nIssued: ${issuedAt}`)
  return { issuedAt, signature: base58.deserialize(nacl.sign.detached(msg, k.secretKey))[0] }
}

const decode = (b64: string) => VersionedTransaction.deserialize(Buffer.from(b64, 'base64'))
const encode = (tx: VersionedTransaction) => Buffer.from(tx.serialize()).toString('base64')
const allZero = (sig: Uint8Array) => sig.every((b) => b === 0)
const tokenBal = async (ata: string) => (await getAccount(connection, new PublicKey(ata), 'confirmed', TOKEN_2022_PROGRAM_ID)).amount

// Rebuilds a prepared transaction with extra instructions, the way a wallet
// adding its own instructions would, then signs it as the wallet.
function withExtra(b64: string, extra: Parameters<typeof TransactionMessage.prototype.instructions.push>[0][], position: 'start' | 'end', signer: Keypair) {
  const tx = decode(b64)
  const msg = TransactionMessage.decompile(tx.message)
  msg.instructions = position === 'start' ? [...extra, ...msg.instructions] : [...msg.instructions, ...extra]
  const rebuilt = new VersionedTransaction(tx.version === 'legacy' ? msg.compileToLegacyMessage() : msg.compileToV0Message())
  rebuilt.sign([signer])
  return encode(rebuilt)
}
function signAsWallet(b64: string, signer: Keypair) {
  const tx = decode(b64)
  tx.sign([signer])
  return encode(tx)
}

async function main() {
  const buyer = kp('nonHolder')
  const holder = kp('holderA')
  const attacker = Keypair.generate()
  const buyerAta = getAssociatedTokenAddressSync(new PublicKey(fx.testNasduckMint), buyer.publicKey, false, TOKEN_2022_PROGRAM_ID).toBase58()

  const s = await call({ action: 'status' })
  check('test copy runs on devnet against the full-size machines', s.body.cluster === 'devnet' && s.body.supply === 5555, JSON.stringify({ cluster: s.body.cluster, supply: s.body.supply }))

  // --- 1. Orders come back unsigned, with order numbers and size headroom ---
  const p1 = await call({ action: 'prepare', wallet: buyer.publicKey.toBase58(), publicQuantity: 2 })
  const t1 = p1.body.transactions ?? []
  check('prepare returns orders with order numbers', p1.status === 200 && t1.length > 0 && t1.every((t: { token: string }) => /^[0-9a-f-]{36}$/.test(t.token)), `HTTP ${p1.status} ${p1.body.error ?? ''}`)
  check('orders arrive completely unsigned (the wallet signs first)', t1.every((t: { transaction: string }) => decode(t.transaction).signatures.every(allZero)))
  check('every order leaves room for the wallet\'s safety checks (<= 1052 bytes)', t1.every((t: { transaction: string }) => Buffer.from(t.transaction, 'base64').length <= 1052), t1.map((t: { transaction: string }) => Buffer.from(t.transaction, 'base64').length).join(','))

  // --- 2. A never-submitted order can't land on its own --------------------
  {
    let rejected = false
    try {
      await connection.sendRawTransaction(Buffer.from(signAsWallet(t1[0].transaction, buyer), 'base64'))
    } catch {
      rejected = true
    }
    check('a wallet-signed order sent straight to the network (no backend co-sign) is rejected', rejected)
  }

  // --- 3. Normal mint, with a wallet-added fee instruction --------------------
  {
    const before = await tokenBal(buyerAta)
    const items = t1.map((t: { token: string; transaction: string }) => ({
      token: t.token,
      transaction: withExtra(t.transaction, [ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 })], 'start', buyer),
    }))
    const sub = await call({ action: 'submit', transactions: items })
    const results = sub.body.results ?? []
    const names = results.flatMap((r: { assets: { name: string }[] }) => r.assets.map((a) => a.name))
    check('a wallet-signed order (with a wallet-added fee instruction) is co-signed and lands', sub.status === 200 && results.length > 0 && results.every((r: { status: string }) => r.status === 'confirmed'), JSON.stringify(sub.body).slice(0, 200))
    check('both ducks minted from the public pool with names', names.length === 2 && names.every((n: string) => split.public.includes(Number(n.split('#')[1]))), names.join(', '))
    const expected = t1.reduce((a: bigint, t: { cost: string }) => a + BigInt(t.cost), 0n)
    check('charged exactly the quoted amount', before - (await tokenBal(buyerAta)) === expected, `${Number(expected) / 1e6} tokens`)
    const again = await call({ action: 'submit', transactions: items })
    check('the same order can\'t be co-signed twice', again.body.results?.[0]?.status === 'failed', again.body.results?.[0]?.reason)
  }

  // --- 4. Tampering after the wallet signs is refused --------------------------
  {
    const p = await call({ action: 'prepare', wallet: buyer.publicKey.toBase58(), publicQuantity: 1 })
    const t = p.body.transactions[0]
    // 4a. extra transfer to an attacker appended
    const sneaky = withExtra(t.transaction, [SystemProgram.transfer({ fromPubkey: buyer.publicKey, toPubkey: attacker.publicKey, lamports: 1_000 })], 'end', buyer)
    const r1 = await call({ action: 'submit', transactions: [{ token: t.token, transaction: sneaky }] })
    check('an order with an extra transfer added is refused (not co-signed)', r1.body.results?.[0]?.status === 'failed' && /match/.test(r1.body.results?.[0]?.reason ?? ''), r1.body.results?.[0]?.reason)
    // 4b. that order is now used up: the clean version can't be sneaked in after
    const r2 = await call({ action: 'submit', transactions: [{ token: t.token, transaction: signAsWallet(t.transaction, buyer) }] })
    check('...and that order is void afterwards', r2.body.results?.[0]?.status === 'failed', r2.body.results?.[0]?.reason)
  }
  {
    const p = await call({ action: 'prepare', wallet: buyer.publicKey.toBase58(), publicQuantity: 1 })
    const t = p.body.transactions[0]
    // 4c. price lowered: rewrite the top-up transfer amount
    const tx = decode(t.transaction)
    const msg = TransactionMessage.decompile(tx.message)
    const topUp = msg.instructions.find((ix) => ix.programId.equals(TOKEN_2022_PROGRAM_ID) && ix.data[0] === 12)
    if (topUp) topUp.data = Buffer.from([12, 1, 0, 0, 0, 0, 0, 0, 0, topUp.data[9]])
    const cheap = new VersionedTransaction(tx.version === 'legacy' ? msg.compileToLegacyMessage() : msg.compileToV0Message())
    cheap.sign([buyer])
    const r = await call({ action: 'submit', transactions: [{ token: t.token, transaction: encode(cheap) }] })
    check('an order with the price lowered is refused (not co-signed)', !!topUp && r.body.results?.[0]?.status === 'failed', r.body.results?.[0]?.reason)
  }
  {
    const p = await call({ action: 'prepare', wallet: buyer.publicKey.toBase58(), publicQuantity: 1 })
    const t = p.body.transactions[0]
    const r = await call({ action: 'submit', transactions: [{ token: t.token, transaction: t.transaction }] })
    check('an order the wallet never signed is refused', r.body.results?.[0]?.status === 'failed', r.body.results?.[0]?.reason)
    const fake = await call({ action: 'submit', transactions: [{ token: '00000000-0000-4000-8000-000000000000', transaction: signAsWallet(t.transaction, buyer) }] })
    check('an unknown order number is refused', fake.body.results?.[0]?.status === 'failed', fake.body.results?.[0]?.reason)
  }

  // --- 5. Cancel frees OTC desks instantly and voids the order -------------
  {
    const before = (await call({ action: 'status', wallet: holder.publicKey.toBase58() })).body.wallet
    const p = await call({ action: 'prepare', wallet: holder.publicKey.toBase58(), otcQuantity: 1, publicQuantity: 0, auth: auth(holder) })
    check('OTC order prepared for a desk holder', p.status === 200 && p.body.transactions?.[0]?.kind === 'otc', `HTTP ${p.status} ${p.body.error ?? ''} (desks free before: ${before?.desksAvailable})`)
    if (p.status === 200) {
      const held = (await call({ action: 'status', wallet: holder.publicKey.toBase58() })).body.wallet
      check('while unsent, the desk is held', held.desksAvailable === before.desksAvailable - 1)
      const c = await call({ action: 'cancel', tokens: [p.body.transactions[0].token] })
      const after = (await call({ action: 'status', wallet: holder.publicKey.toBase58() })).body.wallet
      check('cancel frees the desk immediately', c.body.cancelled === 1 && after.desksAvailable === before.desksAvailable, JSON.stringify(c.body))
      const late = await call({ action: 'submit', transactions: [{ token: p.body.transactions[0].token, transaction: signAsWallet(p.body.transactions[0].transaction, holder) }] })
      check('a cancelled order can never be co-signed later', late.body.results?.[0]?.status === 'failed', late.body.results?.[0]?.reason)
    }
  }

  // --- 6. A real OTC mint through the new flow ---------------------------------
  {
    const before = (await call({ action: 'status', wallet: holder.publicKey.toBase58() })).body.wallet
    const p = await call({ action: 'prepare', wallet: holder.publicKey.toBase58(), otcQuantity: 1, publicQuantity: 0, auth: auth(holder) })
    if (p.status === 200) {
      const t = p.body.transactions[0]
      const sub = await call({ action: 'submit', transactions: [{ token: t.token, transaction: signAsWallet(t.transaction, holder) }] })
      const r = sub.body.results?.[0]
      const n = Number(r?.assets?.[0]?.name?.split('#')[1])
      check('OTC mint lands via the new flow, from the OTC pool (never a 1-of-1)', r?.status === 'confirmed' && split.otc.includes(n), r?.assets?.[0]?.name ?? JSON.stringify(sub.body).slice(0, 160))
      const after = (await call({ action: 'status', wallet: holder.publicKey.toBase58() })).body.wallet
      check('...and its desk is now used', after.desksAvailable === before.desksAvailable - 1)
    } else {
      check('OTC mint via the new flow', false, `prepare HTTP ${p.status} ${p.body.error ?? ''}`)
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
