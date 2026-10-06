import './polyfills'
import { ComputeBudgetProgram, PublicKey as Web3PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js'
import { TOKEN_2022_PROGRAM_ID, createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync } from '@solana/spl-token'
import {
  generateSigner,
  publicKey,
  signAllTransactions,
  some,
  transactionBuilder,
  type TransactionBuilder,
  type Umi,
} from '@metaplex-foundation/umi'
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults'
import { walletAdapterIdentity } from '@metaplex-foundation/umi-signer-wallet-adapters'
import { fromWeb3JsInstruction } from '@metaplex-foundation/umi-web3js-adapters'
import { base58 } from '@metaplex-foundation/umi/serializers'
import { createCollection, fetchCollection, mplCore, ruleSet } from '@metaplex-foundation/mpl-core'
import {
  addConfigLines,
  create,
  deleteCandyGuard,
  deleteCandyMachine,
  fetchCandyGuard,
  fetchCandyMachine,
  getCandyMachineSize,
  mplCandyMachine,
  updateCandyGuard,
} from '@metaplex-foundation/mpl-core-candy-machine'
import { CONFIGS, missingFields, type Cluster, type LaunchConfig } from './config'

// ------------------------------------------------------------------ setup

// Same config-line shape as everywhere else (and the rent calculation):
// "NasDucks #" + up to 4 digits, metadata base + up to "5554.json".
const NAME_LENGTH = 4
const URI_LENGTH = 9
// Transactions per Phantom approval while loading ducks.
const TXS_PER_APPROVAL = 30
// Ducks per loading transaction. Measured ~4,000 compute units per duck; at
// 25 that's ~105k, leaving room under the explicit limit below for the
// security checks Phantom adds when it signs (48 per tx overflowed 200k).
const LINES_PER_TX = 25
const LOAD_COMPUTE_LIMIT = 200_000
// Small priority fee so loading transactions land promptly on mainnet
// (~0.00001 SOL per transaction at the limit above).
const LOAD_PRIORITY_MICROLAMPORTS = 50_000

type Kind = 'otc' | 'public'
interface Saved {
  collection?: string
  otcMachine?: string
  publicMachine?: string
}

interface PhantomProvider {
  isPhantom?: boolean
  publicKey: Web3PublicKey | null
  connect(): Promise<{ publicKey: Web3PublicKey }>
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T
const logEl = $('#log')
function log(msg: string, cls = '') {
  const line = document.createElement('div')
  line.textContent = `${new Date().toLocaleTimeString()}  ${msg}`
  if (cls) line.className = cls
  logEl.appendChild(line)
  logEl.scrollTop = logEl.scrollHeight
}

let cluster: Cluster = 'devnet'
let umi: Umi | null = null
let authority: string | null = null
const cfg = () => CONFIGS[cluster]
const storeKey = () => `nasducks-admin:${cluster}`
function saved(): Saved {
  try {
    return JSON.parse(localStorage.getItem(storeKey()) ?? '{}')
  } catch {
    return {}
  }
}
function save(patch: Saved) {
  localStorage.setItem(storeKey(), JSON.stringify({ ...saved(), ...patch }))
  render()
}

const phantom = () => (window as unknown as { phantom?: { solana?: PhantomProvider } }).phantom?.solana

const rows = (pairs: [string, string, string?][]) =>
  pairs.map(([k, v, cls]) => `<tr><td>${k}</td><td class="${cls ?? ''}">${v}</td></tr>`).join('')

const configLineSettings = (c: LaunchConfig) => ({
  prefixName: 'NasDucks #',
  nameLength: NAME_LENGTH,
  prefixUri: c.metadataBase,
  uriLength: URI_LENGTH,
  isSequential: false,
})

const paymentAccount = (c: LaunchConfig) =>
  getAssociatedTokenAddressSync(new Web3PublicKey(c.paymentMint), new Web3PublicKey(c.paymentWallet!), false, TOKEN_2022_PROGRAM_ID).toBase58()

const units = (whole: bigint, c: LaunchConfig) => whole * 10n ** BigInt(c.paymentDecimals)

// Both machines always need a backend signature (the backend charges the
// live dollar price on top of the floor). The signer decides the mode.
function guardsFor(kind: Kind, c: LaunchConfig, holdersOnly = kind === 'otc') {
  return {
    thirdPartySigner: some({ signerKey: publicKey(holdersOnly ? c.otcSigner! : c.mintSigner!) }),
    token2022Payment: some({ amount: units(c.floorPrice!, c), mint: publicKey(c.paymentMint), destinationAta: publicKey(paymentAccount(c)) }),
  }
}

// --------------------------------------------------------------- rendering

function render() {
  const c = cfg()
  const missing = missingFields(c)
  $('#settings').innerHTML = rows([
    ['collection', `${c.collectionName} · ${c.collectionUri ?? 'MISSING'}`, c.collectionUri ? '' : 'bad'],
    ['royalties', `${c.royaltyBasisPoints / 100}% → ${c.royaltyWallet ?? 'MISSING'}`, c.royaltyWallet ? '' : 'bad'],
    ['payment token', c.paymentMint],
    ['payments go to', c.paymentWallet ? `${c.paymentWallet} (token account ${paymentAccount(c)})` : 'MISSING', c.paymentWallet ? '' : 'bad'],
    ['prices', '$2 OTC / $5 public, charged live in $NASDUCK by the backend'],
    ['OTC signer ($2)', c.otcSigner ?? 'MISSING', c.otcSigner ? '' : 'bad'],
    ['mint signer ($5)', c.mintSigner ?? 'MISSING', c.mintSigner ? '' : 'bad'],
    ['on-chain floor', c.floorPrice !== null ? `${c.floorPrice.toLocaleString()} tokens per mint` : 'MISSING', c.floorPrice !== null ? '' : 'bad'],
    ['pools', `OTC ${c.otcItems.length} · public ${c.publicItems.length} (1-of-1s: public only)`],
    ['metadata', c.metadataBase],
    ['ready', missing.length ? `NO — missing: ${missing.join(', ')}` : 'yes', missing.length ? 'bad' : 'ok'],
  ])
  const s = saved()
  $('#state').innerHTML = rows([
    ['collection', s.collection ?? '— not created'],
    ['OTC machine', s.otcMachine ?? '— not created'],
    ['public machine', s.publicMachine ?? '— not created'],
  ])
}

async function renderWallet() {
  const c = cfg()
  if (!umi || !authority) {
    $('#wallet').innerHTML = rows([['wallet', 'not connected']])
    return
  }
  const sol = Number((await umi.rpc.getBalance(publicKey(authority))).basisPoints) / 1e9
  const wrong = c.authority && c.authority !== authority
  $('#wallet').innerHTML = rows([
    ['connected', authority, wrong ? 'bad' : 'ok'],
    ...(wrong ? ([['', `Wrong account: ${cluster} must be run by ${c.authority}`, 'bad']] as [string, string, string][]) : []),
    ['balance', `${sol.toFixed(4)} SOL on ${cluster}`],
  ])
}

// ----------------------------------------------------------------- guards

async function rpcGenesis(c: LaunchConfig) {
  const res = await fetch(c.rpc, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getGenesisHash' }) })
  return (await res.json()).result as string
}

// Every on-chain action goes through here: right network, right wallet,
// complete settings, and an explicit confirmation.
async function ready(action: string, needsSettings = true): Promise<Umi | null> {
  const c = cfg()
  if (!umi || !authority) return log('Connect Phantom first.', 'bad'), null
  if (c.authority && c.authority !== authority) return log(`Wrong Phantom account. ${cluster} must be run by ${c.authority}.`, 'bad'), null
  if (needsSettings && missingFields(c).length) return log(`Settings incomplete: ${missingFields(c).join(', ')}`, 'bad'), null
  if ((await rpcGenesis(c)) !== c.genesisHash) return log(`RPC is not ${cluster}. Stopping.`, 'bad'), null
  if (!confirm(`${cluster.toUpperCase()}: ${action}\n\nPhantom will ask you to approve. Continue?`)) return null
  return umi
}

// The useful part of a failed send: the program error / last log lines.
function errorDetail(e: unknown): string {
  const err = e as { message?: string; logs?: string[]; cause?: { logs?: string[]; message?: string } }
  const logs = err.logs ?? err.cause?.logs ?? []
  const msg = (err.message ?? String(e)).split('\n').find((l) => /error|failed/i.test(l) && !/^Simulation failed\.?\s*$/.test(l)) ?? (err.message ?? '').split('\n')[0]
  return logs.length ? `${msg} | ${logs.slice(-3).join(' | ')}` : msg
}

// Signs a group of transactions with one Phantom approval, sends them, and
// waits for each. Returns how many failed.
async function sendAll(u: Umi, builders: TransactionBuilder[]): Promise<number> {
  const blockhash = await u.rpc.getLatestBlockhash({ commitment: 'confirmed' })
  const txs = builders.map((b) => {
    const built = b.setBlockhash(blockhash)
    return { transaction: built.build(u), signers: built.getSigners(u) }
  })
  const signed = await signAllTransactions(txs)
  let failed = 0
  const sent: Uint8Array[] = []
  for (const tx of signed) {
    try {
      sent.push(await u.rpc.sendTransaction(tx, { commitment: 'confirmed' }))
    } catch (e) {
      failed++
      log(`send failed: ${errorDetail(e)}`, 'bad')
    }
  }
  for (const sig of sent) {
    const res = await u.rpc.confirmTransaction(sig, { strategy: { type: 'blockhash', ...blockhash }, commitment: 'confirmed' })
    if (res.value.err) {
      failed++
      log(`transaction failed: ${base58.deserialize(sig)[0]}`, 'bad')
    }
  }
  return failed
}

// ------------------------------------------------------------------ steps

async function stepPayment() {
  const c = cfg()
  const u = await ready(`Create the payment token account ${paymentAccount(c)} for ${c.paymentWallet} (costs ~0.002 SOL, paid by you)`)
  if (!u) return
  const existing = await u.rpc.getAccount(publicKey(paymentAccount(c)))
  if (existing.exists) return log('Payment token account already exists. Nothing to do.', 'ok')
  const ix = createAssociatedTokenAccountIdempotentInstruction(
    new Web3PublicKey(authority!),
    new Web3PublicKey(paymentAccount(c)),
    new Web3PublicKey(c.paymentWallet!),
    new Web3PublicKey(c.paymentMint),
    TOKEN_2022_PROGRAM_ID,
  )
  const failed = await sendAll(u, [transactionBuilder().add({ instruction: fromWeb3JsInstruction(ix), signers: [u.identity], bytesCreatedOnChain: 0 })])
  log(failed ? 'Payment token account: FAILED' : 'Payment token account created.', failed ? 'bad' : 'ok')
}

async function stepCollection() {
  const c = cfg()
  if (saved().collection) return log(`Collection already created: ${saved().collection}`, 'ok')
  const u = await ready(`Create the collection "${c.collectionName}" with ${c.royaltyBasisPoints / 100}% royalties to ${c.royaltyWallet}`)
  if (!u) return
  const collection = generateSigner(u)
  const builder = createCollection(u, {
    collection,
    name: c.collectionName,
    uri: c.collectionUri!,
    plugins: [{ type: 'Royalties', basisPoints: c.royaltyBasisPoints, creators: [{ address: publicKey(c.royaltyWallet!), percentage: 100 }], ruleSet: ruleSet('None') }],
  })
  const failed = await sendAll(u, [builder])
  if (failed) return log('Collection: FAILED', 'bad')
  save({ collection: collection.publicKey })
  log(`Collection created: ${collection.publicKey}`, 'ok')
}

async function stepMachine(kind: Kind) {
  const c = cfg()
  const key = kind === 'otc' ? 'otcMachine' : 'publicMachine'
  const s = saved()
  if (s[key]) return log(`${kind} machine already created: ${s[key]}`, 'ok')
  if (!s.collection) return log('Create the collection first.', 'bad')
  const items = kind === 'otc' ? c.otcItems : c.publicItems
  if (!umi) return log('Connect Phantom first.', 'bad')
  const rent = Number((await umi.rpc.getRent(getCandyMachineSize(items.length, { nameLength: NAME_LENGTH, uriLength: URI_LENGTH }))).basisPoints) / 1e9
  const price = kind === 'otc' ? `$2 live, holders-only (OTC signer ${c.otcSigner})` : `$5 live, anyone (mint signer ${c.mintSigner})`
  const u = await ready(`Create the ${kind.toUpperCase()} machine: ${items.length} ducks at ${price}.\nRent locked: ~${rent.toFixed(4)} SOL (refunded when closed).`)
  if (!u) return
  const candyMachine = generateSigner(u)
  const builder = await create(u, {
    candyMachine,
    collection: publicKey(s.collection),
    collectionUpdateAuthority: u.identity,
    itemsAvailable: items.length,
    isMutable: true,
    configLineSettings: configLineSettings(c),
    guards: guardsFor(kind, c),
  })
  const failed = await sendAll(u, [builder])
  if (failed) return log(`${kind} machine: FAILED`, 'bad')
  save({ [key]: candyMachine.publicKey })
  log(`${kind} machine created: ${candyMachine.publicKey}`, 'ok')
}

// Lines that are missing or wrong on-chain, grouped into transactions.
async function pendingLines(u: Umi, machine: string, items: number[]) {
  const cm = await fetchCandyMachine(u, publicKey(machine))
  const prefix = configLineSettings(cfg()).prefixUri
  const onChain = new Map(cm.items.map((it) => [it.index, it]))
  const missing: number[] = []
  items.forEach((n, i) => {
    const it = onChain.get(i)
    if (!it || it.name !== `NasDucks #${n}` || it.uri !== `${prefix}${n}.json`) missing.push(i)
  })
  return { cm, missing }
}

function lineBuilders(u: Umi, machine: string, items: number[], indices: number[]) {
  const line = (i: number) => ({ name: String(items[i]), uri: `${items[i]}.json` })
  const perTx = LINES_PER_TX
  const budget = transactionBuilder()
    .add({ instruction: fromWeb3JsInstruction(ComputeBudgetProgram.setComputeUnitLimit({ units: LOAD_COMPUTE_LIMIT })), signers: [], bytesCreatedOnChain: 0 })
    .add({ instruction: fromWeb3JsInstruction(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: LOAD_PRIORITY_MICROLAMPORTS })), signers: [], bytesCreatedOnChain: 0 })
  const builders: TransactionBuilder[] = []
  let i = 0
  while (i < indices.length) {
    const start = indices[i]
    let end = start
    while (i + 1 < indices.length && indices[i + 1] === end + 1 && end - start + 1 < perTx) end = indices[++i]
    i++
    builders.push(budget.add(addConfigLines(u, { candyMachine: publicKey(machine), index: start, configLines: Array.from({ length: end - start + 1 }, (_, k) => line(start + k)) })))
  }
  return { builders, perTx }
}

async function stepLines() {
  const c = cfg()
  const s = saved()
  if (!s.otcMachine || !s.publicMachine) return log('Create both machines first.', 'bad')
  if (!umi) return log('Connect Phantom first.', 'bad')
  const plan: { kind: Kind; machine: string; items: number[]; missing: number[] }[] = []
  for (const kind of ['otc', 'public'] as Kind[]) {
    const machine = kind === 'otc' ? s.otcMachine : s.publicMachine
    const items = kind === 'otc' ? c.otcItems : c.publicItems
    const { cm, missing } = await pendingLines(umi, machine, items)
    if (Number(cm.itemsRedeemed) > 0 && missing.length) return log(`${kind} machine has already minted; lines can't be changed.`, 'bad')
    plan.push({ kind, machine, items, missing })
    log(`${kind}: ${items.length - missing.length}/${items.length} ducks loaded`)
  }
  const total = plan.reduce((a, p) => a + lineBuilders(umi!, p.machine, p.items, p.missing).builders.length, 0)
  if (!total) return log('All ducks already loaded.', 'ok')
  const fees = total * (0.000005 + (LOAD_COMPUTE_LIMIT * LOAD_PRIORITY_MICROLAMPORTS) / 1e15)
  const u = await ready(`Load the remaining ducks: ${total} transactions, about ${Math.ceil(total / TXS_PER_APPROVAL)} Phantom approvals (~${fees.toFixed(4)} SOL in fees).`)
  if (!u) return
  for (const p of plan) {
    for (let round = 1; round <= 3 && p.missing.length; round++) {
      const { builders, perTx } = lineBuilders(u, p.machine, p.items, p.missing)
      log(`${p.kind}: sending ${builders.length} transactions (${perTx} ducks each)${round > 1 ? `, retry ${round - 1}` : ''}`)
      for (let b = 0; b < builders.length; b += TXS_PER_APPROVAL) {
        log(`${p.kind}: approval ${b / TXS_PER_APPROVAL + 1} of ${Math.ceil(builders.length / TXS_PER_APPROVAL)}`)
        await sendAll(u, builders.slice(b, b + TXS_PER_APPROVAL))
      }
      p.missing = (await pendingLines(u, p.machine, p.items)).missing
    }
    log(p.missing.length ? `${p.kind}: ${p.missing.length} ducks still missing; run this step again.` : `${p.kind}: all ${p.items.length} ducks loaded and checked.`, p.missing.length ? 'bad' : 'ok')
  }
}

async function stepVerify() {
  const c = cfg()
  const s = saved()
  if (!umi) return log('Connect Phantom first.', 'bad')
  if (!s.collection || !s.otcMachine || !s.publicMachine) return log('Setup not finished.', 'bad')
  let ok = true
  const check = (name: string, pass: boolean, detail = '') => {
    ok &&= pass
    log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`, pass ? 'ok' : 'bad')
  }
  const col = await fetchCollection(umi, publicKey(s.collection))
  const roy = col.royalties
  check('collection name and metadata', col.name === c.collectionName && col.uri === c.collectionUri, `${col.name} · ${col.uri}`)
  check('collection royalties', !!roy && roy.basisPoints === c.royaltyBasisPoints && roy.creators.length === 1 && roy.creators[0].address === c.royaltyWallet && roy.creators[0].percentage === 100)
  check('collection update authority is the connected authority', col.updateAuthority === authority)
  const pay = await umi.rpc.getAccount(publicKey(paymentAccount(c)))
  check('payment token account exists', pay.exists, paymentAccount(c))
  for (const kind of ['otc', 'public'] as Kind[]) {
    const machine = kind === 'otc' ? s.otcMachine : s.publicMachine
    const items = kind === 'otc' ? c.otcItems : c.publicItems
    const { cm, missing } = await pendingLines(umi, machine, items)
    const g = (await fetchCandyGuard(umi, cm.mintAuthority)).guards
    check(`${kind}: belongs to the collection`, cm.collectionMint === s.collection)
    check(`${kind}: all ${items.length} ducks loaded with correct metadata`, missing.length === 0 && cm.itemsLoaded === items.length, missing.length ? `${missing.length} missing` : '')
    check(`${kind}: random order (not sequential)`, cm.data.configLineSettings.__option === 'Some' && !cm.data.configLineSettings.value.isSequential)
    const p = g.token2022Payment
    check(
      `${kind}: floor of ${c.floorPrice} tokens paid to the payment account`,
      p.__option === 'Some' && p.value.amount === units(c.floorPrice!, c) && p.value.mint === c.paymentMint && p.value.destinationAta === paymentAccount(c),
    )
    const tps = g.thirdPartySigner
    check(
      kind === 'otc' ? 'otc: holders-only (requires the OTC signer)' : 'public: requires the mint signer (live $5 pricing)',
      tps.__option === 'Some' && tps.value.signerKey === (kind === 'otc' ? c.otcSigner : c.mintSigner),
    )
  }
  const oneOfOnes = [5550, 5551, 5552, 5553, 5554]
  check('1-of-1s only in the public machine', oneOfOnes.every((n) => c.publicItems.includes(n) && !c.otcItems.includes(n)))
  check('every duck exactly once across both machines', new Set([...c.otcItems, ...c.publicItems]).size === 5555 && c.otcItems.length + c.publicItems.length === 5555)
  log(ok ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED: do not launch', ok ? 'ok' : 'bad')
}

async function stepFlip(to: 'public' | 'otc') {
  const c = cfg()
  const machine = saved().otcMachine
  if (!machine || !umi) return log('Connect Phantom and create the OTC machine first.', 'bad')
  const u = await ready(
    to === 'public'
      ? 'Flip the OTC machine to PUBLIC: anyone can mint its remaining ducks at $5. Holder discount ends.'
      : 'Flip the OTC machine back to HOLDERS-ONLY at $2.',
  )
  if (!u) return
  const cm = await fetchCandyMachine(u, publicKey(machine))
  const guard = await fetchCandyGuard(u, cm.mintAuthority)
  const failed = await sendAll(u, [updateCandyGuard(u, { candyGuard: guard.publicKey, guards: guardsFor('otc', c, to === 'otc'), groups: [] })])
  if (failed) return log('Flip: FAILED', 'bad')
  // RPC nodes can briefly serve the old account; re-read before reporting.
  for (let i = 0; i < 10; i++) {
    const g = (await fetchCandyGuard(u, cm.mintAuthority, { commitment: 'confirmed' })).guards
    const want = to === 'otc' ? c.otcSigner : c.mintSigner
    if (g.thirdPartySigner.__option === 'Some' && g.thirdPartySigner.value.signerKey === want) return log(`OTC machine is now ${to === 'otc' ? 'holders-only' : 'public'} (verified on-chain).`, 'ok')
    await new Promise((r) => setTimeout(r, 1500))
  }
  log('Flip sent but not yet visible on-chain; run Verify in a minute.', 'bad')
}

async function stepClose() {
  const s = saved()
  if (!umi || !s.otcMachine || !s.publicMachine) return log('Nothing to close.', 'bad')
  const lines: string[] = []
  for (const m of [s.otcMachine, s.publicMachine]) {
    const cm = await fetchCandyMachine(umi, publicKey(m))
    lines.push(`${m}: ${cm.itemsRedeemed}/${cm.data.itemsAvailable} minted`)
  }
  if (prompt(`Closing ends minting permanently.\n${lines.join('\n')}\n\nType CLOSE to continue.`) !== 'CLOSE') return log('Close cancelled.')
  const u = await ready('Close both machines and their guards; rent returns to the authority.', false)
  if (!u) return
  const builders: TransactionBuilder[] = []
  for (const m of [s.otcMachine, s.publicMachine]) {
    const cm = await fetchCandyMachine(u, publicKey(m))
    builders.push(deleteCandyMachine(u, { candyMachine: publicKey(m) }), deleteCandyGuard(u, { candyGuard: cm.mintAuthority }))
  }
  const failed = await sendAll(u, builders)
  log(failed ? `Close: ${failed} transaction(s) failed; run again.` : 'Both machines closed; rent refunded.', failed ? 'bad' : 'ok')
}

// ----------------------------------------------------------------- wiring

async function connect() {
  const p = phantom()
  if (!p?.isPhantom) return log('Phantom not found in this browser.', 'bad')
  const { publicKey: pk } = await p.connect()
  authority = pk.toBase58()
  umi = createUmi(cfg().rpc).use(mplCore()).use(mplCandyMachine()).use(walletAdapterIdentity(p as never))
  log(`Connected ${authority} (${cluster}).`)
  await renderWallet()
}

$<HTMLSelectElement>('#cluster').addEventListener('change', async (e) => {
  cluster = (e.target as HTMLSelectElement).value as Cluster
  if (umi && phantom()) umi = createUmi(cfg().rpc).use(mplCore()).use(mplCandyMachine()).use(walletAdapterIdentity(phantom() as never))
  log(`Network: ${cluster}. Make sure Phantom is set to the same network.`)
  render()
  await renderWallet()
})
$('#connect').addEventListener('click', () => connect().catch((e) => log(`Connect failed: ${(e as Error).message}`, 'bad')))

const steps: Record<string, () => Promise<unknown>> = {
  payment: stepPayment,
  collection: stepCollection,
  otc: () => stepMachine('otc'),
  public: () => stepMachine('public'),
  lines: stepLines,
  verify: stepVerify,
  'flip-public': () => stepFlip('public'),
  'flip-otc': () => stepFlip('otc'),
  close: stepClose,
}
document.querySelectorAll<HTMLButtonElement>('button[data-step]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const all = document.querySelectorAll<HTMLButtonElement>('button')
    all.forEach((b) => (b.disabled = true))
    try {
      await steps[btn.dataset.step!]()
    } catch (e) {
      log(`Error: ${(e as Error).message.split('\n')[0]}`, 'bad')
    } finally {
      all.forEach((b) => (b.disabled = false))
      await renderWallet().catch(() => {})
    }
  })
})

render()
renderWallet()
