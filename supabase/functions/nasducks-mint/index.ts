import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { createUmi } from 'npm:@metaplex-foundation/umi-bundle-defaults@1.6.0'
import {
  createNoopSigner,
  createSignerFromKeypair,
  generateSigner,
  publicKey,
  signerIdentity,
  some,
  transactionBuilder,
  type PublicKey,
  type Signer,
  type TransactionBuilder,
  type Umi,
} from 'npm:@metaplex-foundation/umi@1.6.0'
import { base58, base64, publicKey as publicKeySerializer } from 'npm:@metaplex-foundation/umi@1.6.0/serializers'
import { fetchAsset, mplCore } from 'npm:@metaplex-foundation/mpl-core@1.10.0'
import {
  fetchCandyGuard,
  fetchCandyMachine,
  mintV1,
  mplCandyMachine,
  type CandyMachine,
} from 'npm:@metaplex-foundation/mpl-core-candy-machine@0.3.0'
import { dynamicCorsHeaders } from '../_shared/cors.ts'

// NasDucks mint backend. Two Candy Machines presented to users as one pool.
// Both require a backend signature (thirdPartySigner guard), so every mint
// goes through this function, which prices it in dollars at the live
// $NASDUCK rate: the guard charges a small fixed floor and each transaction
// carries a top-up transfer for the rest. Changing the amount breaks our
// signature, so the price can't be altered or skipped.
//   OTC machine    — signed by the OTC signer while holders-only: $2, one per
//                    OTC Desk NFT ever (tracked in otc_mint_claims). Flipping
//                    it to public = switching its guard to the mint signer.
//   Public machine — signed by the mint signer: $5, anyone; holds the 1-of-1s.
//
//   status   — supply/prices/open state (cached, see nasducks_mint_stats);
//              with a wallet: OTC desks + balances
//   prepare  — builds mint transactions (OTC part needs a signed wallet
//              message), already signed by everything except the minter
//   submit   — relays wallet-signed transactions (only ones that touch our
//              machines), waits for confirmation, records OTC claims, and
//              returns the minted ducks
//   confirm  — fallback: record OTC claims from signatures, chain-verified
//   owned    — the NasDucks a wallet holds (for the "Your Ducks" gallery)
//
// Fails closed: any missing config/secret means nothing is signed or sent.

const CLUSTER = Deno.env.get('OTC_CLUSTER') // 'devnet' | 'mainnet'
const OTC_MACHINE = Deno.env.get('OTC_CANDY_MACHINE')
const PUBLIC_MACHINE = Deno.env.get('PUBLIC_CANDY_MACHINE')
const OTC_DESK_COLLECTION = Deno.env.get('OTC_DESK_COLLECTION')
const SIGNER_SECRET = Deno.env.get('OTC_SIGNER_SECRET_KEY') // JSON byte array
const MINT_SIGNER_SECRET = Deno.env.get('MINT_SIGNER_SECRET_KEY') // JSON byte array
const HELIUS_API_KEY = Deno.env.get('HELIUS_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const MAX_OTC_MINTS_PER_TX = 3 // measured: 4 exceeds Solana's 1232-byte limit with the memo
const MAX_PER_REQUEST = 30
const MAX_SUBMIT = 20
// Longer than a blockhash's lifetime (~60-90s), so an expired reservation's
// transaction can no longer land.
const RESERVATION_TTL_SECONDS = 180
const AUTH_MAX_AGE_MS = 10 * 60_000
const RATE_LIMIT_PER_MINUTE = 30
const CONFIRM_TIMEOUT_MS = 60_000
const MEMO_PREFIX = 'nasducks-otc:'
const MEMO_PROGRAM = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'
// The public mint snapshot (nasducks_mint_stats) is re-read from chain at
// most this often, however many visitors are polling.
const STATS_MAX_AGE_MS = 10_000
// Dollar prices. Quotes use the real $NASDUCK market price on both clusters
// (the devnet test token has no market).
const PUBLIC_PRICE_USD = 5
const OTC_PRICE_USD = 2
const PRICE_MINT = '7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze'
const PRICE_TTL_MS = 15_000 // sample Jupiter at most this often (shared)
const PRICE_STALE_MAX_MS = 60_000 // never quote from an older sample
const PRICE_WINDOW_MS = 5 * 60_000 // median window for the sanity check
const PRICE_MAX_DEVIATION = 0.3 // pause if the price is >30% off the median
const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
const UUID_RE = /nasducks-otc:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } })

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function parseWallet(value: unknown): PublicKey {
  if (typeof value !== 'string') throw new HttpError(400, 'wallet is required')
  try {
    return publicKey(value)
  } catch {
    throw new HttpError(400, 'invalid wallet address')
  }
}

function parseCount(value: unknown, name: string): number {
  const n = value ?? 0
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_PER_REQUEST) {
    throw new HttpError(400, `${name} must be a whole number from 0 to ${MAX_PER_REQUEST}`)
  }
  return n
}

const heliusUrl = () => `https://${CLUSTER === 'mainnet' ? 'mainnet' : 'devnet'}.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
const scrub = (s: string) => (HELIUS_API_KEY ? s.replaceAll(HELIUS_API_KEY, '***') : s)

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const res = await fetch(heliusUrl(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const body = await res.json()
  // Never surface the upstream error verbatim: the RPC URL carries the key.
  if (!res.ok || body.error) throw new Error(`rpc ${method} failed`)
  return body.result as T
}

// ---------------------------------------------------------------- machines

type Payment = { amount: bigint; mint: PublicKey; destinationAta: PublicKey }
type Machine = { cm: CandyMachine; remaining: number; payment: Payment | null; signer: string | null }

async function loadMachine(umi: Umi, address: string): Promise<Machine> {
  const cm = await fetchCandyMachine(umi, publicKey(address))
  const guard = await fetchCandyGuard(umi, cm.mintAuthority)
  const tps = guard.guards.thirdPartySigner
  const pay = guard.guards.token2022Payment
  return {
    cm,
    remaining: Number(cm.data.itemsAvailable) - Number(cm.itemsRedeemed),
    payment: pay.__option === 'Some' ? pay.value : null,
    signer: tps.__option === 'Some' ? tps.value.signerKey : null,
  }
}

// Which signer a machine's guard names decides what it is: the OTC signer =
// holders-only $2, the mint signer = public $5. Anything else = closed.
async function loadMachines(umi: Umi, otcSigner: Signer, mintSigner: Signer) {
  const [otc, pub] = await Promise.all([loadMachine(umi, OTC_MACHINE!), loadMachine(umi, PUBLIC_MACHINE!)])
  const otcOpen = otc.signer === otcSigner.publicKey && !!otc.payment
  // After the flip, the OTC machine's leftovers are minted like the public pool.
  const otcIsPublic = otc.signer === mintSigner.publicKey && !!otc.payment
  const pubOpen = pub.signer === mintSigner.publicKey && !!pub.payment
  const publicPools = [...(pubOpen ? [pub] : []), ...(otcIsPublic ? [otc] : [])]
  return { otc, pub, otcOpen, publicPools }
}

// ------------------------------------------------------------------ pricing

async function fetchJupiterUsd(): Promise<number> {
  const res = await fetch(`https://lite-api.jup.ag/price/v3?ids=${PRICE_MINT}`)
  if (!res.ok) throw new Error(`price source HTTP ${res.status}`)
  const usd = Number((await res.json())?.[PRICE_MINT]?.usdPrice)
  if (!Number.isFinite(usd) || usd <= 0) throw new Error('price source returned no price')
  return usd
}

// Live $NASDUCK/USD, sampled at most every PRICE_TTL_MS for all callers, and
// refused if missing, stale, or far from the recent median.
async function nasduckUsd(db: SupabaseClient): Promise<number> {
  const recent = async () => {
    const { data, error } = await db
      .from('nasduck_price_samples')
      .select('usd, sampled_at')
      .gte('sampled_at', new Date(Date.now() - PRICE_WINDOW_MS).toISOString())
      .order('sampled_at', { ascending: false })
      .limit(100)
    if (error) throw new Error('price lookup failed')
    return (data ?? []).map((r) => ({ usd: Number(r.usd), at: Date.parse(r.sampled_at) }))
  }
  let samples = await recent()
  if (!samples.length || Date.now() - samples[0].at > PRICE_TTL_MS) {
    const { data: won } = await db.rpc('claim_price_refresh', { p_min_gap_seconds: PRICE_TTL_MS / 1000 })
    if (won) {
      try {
        const usd = await fetchJupiterUsd()
        await db.from('nasduck_price_samples').insert({ usd })
        await db.from('nasduck_price_samples').delete().lt('sampled_at', new Date(Date.now() - 86_400_000).toISOString())
      } catch (e) {
        console.error('nasducks-mint price refresh failed:', e instanceof Error ? e.message : 'unknown')
      }
    } else {
      await sleep(1000) // someone else is refreshing
    }
    samples = await recent()
  }
  if (!samples.length || Date.now() - samples[0].at > PRICE_STALE_MAX_MS) throw new HttpError(503, 'live $NASDUCK price unavailable, try again shortly')
  const sorted = samples.map((s) => s.usd).sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)]
  const latest = samples[0].usd
  if (Math.abs(latest - median) / median > PRICE_MAX_DEVIATION) {
    throw new HttpError(503, '$NASDUCK price is moving too fast to quote fairly, try again in a few minutes')
  }
  return latest
}

type Quote = { nasduckUsd: number; public: bigint; otc: bigint }

// Base units of $NASDUCK per mint, rounded up so the dollar price is met.
function quoteFor(usd: number, decimals: number): Quote {
  const units = (dollars: number) => BigInt(Math.ceil((dollars / usd) * 10 ** decimals))
  return { nasduckUsd: usd, public: units(PUBLIC_PRICE_USD), otc: units(OTC_PRICE_USD) }
}

// Token-2022 TransferChecked of the part of the price above the guard's
// floor, from the minter's token account to the treasury's.
function topUpIx(umi: Umi, minter: PublicKey, pay: Payment, decimals: number, amount: bigint) {
  const pk = publicKeySerializer()
  const [source] = umi.eddsa.findPda(publicKey(ATA_PROGRAM), [pk.serialize(minter), pk.serialize(publicKey(TOKEN_2022_PROGRAM)), pk.serialize(pay.mint)])
  const data = new Uint8Array(10)
  data[0] = 12 // TransferChecked
  new DataView(data.buffer).setBigUint64(1, amount, true)
  data[9] = decimals
  return {
    instruction: {
      programId: publicKey(TOKEN_2022_PROGRAM),
      keys: [
        { pubkey: source, isSigner: false, isWritable: true },
        { pubkey: pay.mint, isSigner: false, isWritable: false },
        { pubkey: pay.destinationAta, isSigner: false, isWritable: true },
        { pubkey: minter, isSigner: true, isWritable: false },
      ],
      data,
    },
    signers: [],
    bytesCreatedOnChain: 0,
  }
}

// --------------------------------------------------------- public snapshot

type Stats = {
  cluster: string
  supply: number
  minted: number
  publicRemaining: number
  otcOpen: boolean
  otcRemaining: number
  prices: { mint: string | null; decimals: number | null; public: string | null; otc: string | null }
  refreshedAt: string
}
type StatsRow = {
  cluster: string
  supply: number
  minted: number
  public_remaining: number
  otc_open: boolean
  otc_remaining: number
  price_mint: string | null
  price_decimals: number | null
  price_public: string | null
  price_otc: string | null
  refreshed_at: string
}

const rowToStats = (r: StatsRow): Stats => ({
  cluster: r.cluster,
  supply: r.supply,
  minted: r.minted,
  publicRemaining: r.public_remaining,
  otcOpen: r.otc_open,
  otcRemaining: r.otc_remaining,
  prices: { mint: r.price_mint, decimals: r.price_decimals, public: r.price_public, otc: r.price_otc },
  refreshedAt: r.refreshed_at,
})

async function refreshStats(db: SupabaseClient, umi: Umi, signer: Signer, mintSigner: Signer): Promise<Stats> {
  const { otc, pub, otcOpen, publicPools } = await loadMachines(umi, signer, mintSigner)
  const paymentMint = pub.payment?.mint ?? otc.payment?.mint ?? null
  const decimals = paymentMint ? (await rpc<{ value: { decimals: number } }>('getTokenSupply', [paymentMint])).value.decimals : null
  // Prices shown are live quotes; a price outage shows as "no price" rather
  // than hiding supply.
  let quote: Quote | null = null
  if (decimals !== null) {
    try {
      quote = quoteFor(await nasduckUsd(db), decimals)
    } catch {
      quote = null
    }
  }
  const stats: Stats = {
    cluster: CLUSTER!,
    supply: Number(otc.cm.data.itemsAvailable) + Number(pub.cm.data.itemsAvailable),
    minted: Number(otc.cm.itemsRedeemed) + Number(pub.cm.itemsRedeemed),
    publicRemaining: publicPools.reduce((a, p) => a + p.remaining, 0),
    otcOpen,
    otcRemaining: otcOpen ? otc.remaining : 0,
    prices: {
      mint: paymentMint,
      decimals,
      public: quote && publicPools.length ? quote.public.toString() : null,
      otc: quote && otcOpen ? quote.otc.toString() : null,
    },
    refreshedAt: new Date().toISOString(),
  }
  const { error } = await db.from('nasducks_mint_stats').upsert({
    id: 1,
    cluster: stats.cluster,
    supply: stats.supply,
    minted: stats.minted,
    public_remaining: stats.publicRemaining,
    otc_open: stats.otcOpen,
    otc_remaining: stats.otcRemaining,
    price_mint: stats.prices.mint,
    price_decimals: stats.prices.decimals,
    price_public: stats.prices.public,
    price_otc: stats.prices.otc,
    refreshed_at: stats.refreshedAt,
  })
  if (error) console.error('nasducks-mint stats write failed:', error.message)
  return stats
}

// Serves the cached snapshot; only one caller per window re-reads the chain.
// `force` (after a confirmed mint) shortens the window so counts move at once.
async function currentStats(db: SupabaseClient, umi: Umi, signer: Signer, mintSigner: Signer, force = false): Promise<Stats> {
  const { data } = await db.from('nasducks_mint_stats').select('*').eq('id', 1).maybeSingle()
  const row = data && (data as StatsRow).cluster === CLUSTER ? (data as StatsRow) : null
  if (!row) return refreshStats(db, umi, signer, mintSigner)
  if (!force && Date.now() - Date.parse(row.refreshed_at) < STATS_MAX_AGE_MS) return rowToStats(row)
  const { data: won } = await db.rpc('claim_mint_stats_refresh', { p_min_gap_seconds: force ? 2 : 5 })
  if (!won) return rowToStats(row)
  try {
    return await refreshStats(db, umi, signer, mintSigner)
  } catch (e) {
    console.error('nasducks-mint stats refresh failed:', scrub(e instanceof Error ? e.message : 'unknown'))
    return rowToStats(row)
  }
}

// ------------------------------------------------------------- OTC claims

async function heldDesks(wallet: string): Promise<string[]> {
  const ids: string[] = []
  for (let page = 1; page <= 20; page++) {
    const r = await rpc<{ items: { id: string; burnt: boolean; ownership: { owner: string } }[] }>('searchAssets', {
      ownerAddress: wallet,
      grouping: ['collection', OTC_DESK_COLLECTION],
      burnt: false,
      page,
      limit: 1000,
    })
    for (const a of r.items) if (!a.burnt && a.ownership.owner === wallet) ids.push(a.id)
    if (r.items.length < 1000) break
  }
  return ids
}

async function claimsFor(db: SupabaseClient, desks: string[]) {
  const rows: { otc_asset: string; reservation_id: string; status: string; reserved_at: string; expires_at: string }[] = []
  for (let i = 0; i < desks.length; i += 100) {
    const { data, error } = await db
      .from('otc_mint_claims')
      .select('otc_asset, reservation_id, status, reserved_at, expires_at')
      .in('otc_asset', desks.slice(i, i + 100))
    if (error) throw new Error('claims lookup failed')
    rows.push(...(data ?? []))
  }
  return rows
}

// Settles expired pending reservations on these desks using the chain as
// the source of truth: confirm if a transaction carrying the reservation's
// memo (signed by our signer) landed, otherwise free the desks. If the
// signer's history can't be read far enough back, nothing is released.
async function reconcileExpired(db: SupabaseClient, signer: string, desks: string[]) {
  const now = Date.now()
  const expired = (await claimsFor(db, desks)).filter((r) => r.status === 'pending' && Date.parse(r.expires_at) < now)
  if (!expired.length) return

  const reservations = new Map<string, number>()
  for (const r of expired) {
    const t = Date.parse(r.reserved_at) / 1000
    reservations.set(r.reservation_id, Math.min(reservations.get(r.reservation_id) ?? Infinity, t))
  }
  const cutoff = Math.min(...reservations.values()) - 60

  const landed = new Map<string, string>()
  let before: string | undefined
  let complete = false
  for (let page = 0; page < 10; page++) {
    const sigs = await rpc<{ signature: string; err: unknown; memo: string | null; blockTime: number | null }[]>(
      'getSignaturesForAddress',
      [signer, { limit: 1000, before, commitment: 'confirmed' }],
    )
    for (const s of sigs) {
      const id = s.err == null && s.memo ? UUID_RE.exec(s.memo)?.[1] : undefined
      if (id && reservations.has(id)) landed.set(id, s.signature)
    }
    const last = sigs.at(-1)
    if (sigs.length < 1000 || !last || (last.blockTime ?? 0) < cutoff) {
      complete = true
      break
    }
    before = last.signature
  }

  for (const id of reservations.keys()) {
    const sig = landed.get(id)
    if (sig) await db.rpc('confirm_otc_reservation', { p_reservation: id, p_signature: sig })
    else if (complete) await db.rpc('release_otc_reservation', { p_reservation: id })
  }
}

// Proves the caller controls the wallet: it signed this exact text recently.
function verifyWalletAuth(umi: Umi, wallet: PublicKey, auth: unknown) {
  const a = auth as { issuedAt?: unknown; signature?: unknown } | undefined
  if (!a || typeof a.issuedAt !== 'string' || typeof a.signature !== 'string') throw new HttpError(401, 'wallet signature required')
  const issued = Date.parse(a.issuedAt)
  if (!Number.isFinite(issued) || Math.abs(Date.now() - issued) > AUTH_MAX_AGE_MS) throw new HttpError(401, 'wallet signature expired, sign again')
  const message = new TextEncoder().encode(`NasDucks OTC mint\nWallet: ${wallet}\nIssued: ${a.issuedAt}`)
  let sig: Uint8Array
  try {
    sig = base58.serialize(a.signature)
  } catch {
    throw new HttpError(401, 'invalid wallet signature')
  }
  if (sig.length !== 64 || !umi.eddsa.verify(message, sig, wallet)) throw new HttpError(401, 'invalid wallet signature')
}

// ------------------------------------------------------- transaction build

type Prepared = { kind: 'otc' | 'public'; reservationId?: string; assets: string[]; cost: string; transaction: string }

function mintIx(umi: Umi, m: Machine, minter: Signer, machineSigner: Signer) {
  const asset = generateSigner(umi)
  const pay = m.payment!
  const builder = mintV1(umi, {
    candyMachine: m.cm.publicKey,
    asset,
    collection: m.cm.collectionMint,
    minter,
    payer: minter,
    mintArgs: {
      thirdPartySigner: some({ signer: machineSigner }),
      token2022Payment: some({ mint: pay.mint, destinationAta: pay.destinationAta }),
    },
  })
  return { asset: asset.publicKey, builder }
}

async function finish(umi: Umi, builder: TransactionBuilder) {
  const tx = await builder.buildAndSign(umi)
  return base64.deserialize(umi.transactions.serialize(tx))[0]
}

// Spreads n public mints across the open public pools, weighted by how many
// each has left, so every remaining duck has equal odds.
function assignPublic(pools: Machine[], n: number): Machine[] {
  const left = pools.map((p) => p.remaining)
  const out: Machine[] = []
  for (let i = 0; i < n; i++) {
    const total = left.reduce((a, b) => a + b, 0)
    if (total <= 0) break
    const r = crypto.getRandomValues(new Uint32Array(1))[0] % total
    let acc = 0
    const k = left.findIndex((l) => (acc += l) > r)
    left[k]--
    out.push(pools[k])
  }
  return out
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  const cors = dynamicCorsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors)

  try {
    if (
      !CLUSTER || !['devnet', 'mainnet'].includes(CLUSTER) || !OTC_MACHINE || !PUBLIC_MACHINE || !OTC_DESK_COLLECTION ||
      !SIGNER_SECRET || !MINT_SIGNER_SECRET || !HELIUS_API_KEY || !SUPABASE_URL || !SERVICE_ROLE_KEY
    ) {
      return json({ error: 'mint not configured' }, 503, cors)
    }

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
    const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString()
    const { data: hits, error: rlError } = await db.rpc('increment_rpc_rate_limit', { p_ip: `nasducks-mint:${ip}`, p_window: windowStart })
    if (rlError) return json({ error: 'temporarily unavailable' }, 503, cors)
    if (typeof hits === 'number' && hits > RATE_LIMIT_PER_MINUTE) return json({ error: 'rate limited, try again shortly' }, 429, cors)

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      throw new HttpError(400, 'invalid JSON')
    }

    const umi = createUmi(heliusUrl()).use(mplCore()).use(mplCandyMachine())
    const signer = createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(SIGNER_SECRET))))
    umi.use(signerIdentity(signer))
    const mintSigner = createSignerFromKeypair(umi, umi.eddsa.createKeypairFromSecretKey(new Uint8Array(JSON.parse(MINT_SIGNER_SECRET))))

    // ------------------------------------------------------------- status
    if (body.action === 'status') {
      const stats = await currentStats(db, umi, signer, mintSigner)
      const paymentMint = stats.prices.mint
      const out: Record<string, unknown> = { ...stats }
      if (body.wallet !== undefined) {
        const wallet = parseWallet(body.wallet)
        const desks = await heldDesks(wallet)
        await reconcileExpired(db, signer.publicKey, desks)
        const claims = await claimsFor(db, desks)
        const used = new Set(claims.map((r) => r.otc_asset))
        // Desks held by an unsent order (e.g. cancelled in the wallet): they
        // come back once the hold ends and the chain shows nothing landed.
        const holds = claims.filter((r) => r.status === 'pending' && Date.parse(r.expires_at) > Date.now())
        const [sol, tokens] = await Promise.all([
          rpc<{ value: number }>('getBalance', [wallet]),
          paymentMint
            ? rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>('getTokenAccountsByOwner', [
                wallet,
                { mint: paymentMint },
                { encoding: 'jsonParsed' },
              ])
            : Promise.resolve({ value: [] }),
        ])
        out.wallet = {
          desksHeld: desks.length,
          desksAvailable: desks.filter((d) => !used.has(d)).length,
          desksOnHold: holds.length,
          holdUntil: holds.length ? new Date(Math.max(...holds.map((r) => Date.parse(r.expires_at)))).toISOString() : null,
          lamports: sol.value,
          tokenBalance: tokens.value.reduce((a, t) => a + BigInt(t.account.data.parsed.info.tokenAmount.amount), 0n).toString(),
        }
      }
      return json(out, 200, cors)
    }

    // -------------------------------------------------------------- owned
    if (body.action === 'owned') {
      const wallet = parseWallet(body.wallet)
      const collection = (await fetchCandyMachine(umi, publicKey(OTC_MACHINE!))).collectionMint
      const ducks: { address: string; name: string; uri: string }[] = []
      for (let page = 1; page <= 5; page++) {
        const r = await rpc<{ items: { id: string; burnt: boolean; ownership: { owner: string }; content?: { json_uri?: string; metadata?: { name?: string } } }[] }>(
          'searchAssets',
          { ownerAddress: wallet, grouping: ['collection', collection], burnt: false, page, limit: 1000 },
        )
        for (const a of r.items) {
          if (a.burnt || a.ownership.owner !== wallet) continue
          ducks.push({ address: a.id, name: a.content?.metadata?.name ?? '', uri: a.content?.json_uri ?? '' })
        }
        if (r.items.length < 1000) break
      }
      return json({ ducks }, 200, cors)
    }

    // ------------------------------------------------------------ prepare
    if (body.action === 'prepare') {
      const wallet = parseWallet(body.wallet)
      const otcQuantity = parseCount(body.otcQuantity, 'otcQuantity')
      const publicQuantity = parseCount(body.publicQuantity, 'publicQuantity')
      if (otcQuantity + publicQuantity === 0) throw new HttpError(400, 'nothing to mint')
      if (otcQuantity > 0) verifyWalletAuth(umi, wallet, body.auth)

      const { otc, otcOpen, publicPools } = await loadMachines(umi, signer, mintSigner)
      const minter = createNoopSigner(wallet)

      // Eligibility first (clearest error), then price and balance, then reserve.
      let desks: string[] = []
      if (otcQuantity > 0) {
        if (!otcOpen) throw new HttpError(409, 'the OTC holder mint is closed')
        if (otc.remaining <= 0) throw new HttpError(409, 'the OTC allocation is sold out')
        desks = await heldDesks(wallet)
        if (!desks.length) throw new HttpError(403, 'no OTC Desk held by this wallet')
        await reconcileExpired(db, signer.publicKey, desks)
        const used = new Set((await claimsFor(db, desks)).map((r) => r.otc_asset))
        if (desks.every((d) => used.has(d))) throw new HttpError(409, 'no unused OTC Desks left on this wallet')
      }

      // Price everything in dollars at the live rate before reserving anything.
      const paymentMint = (otc.payment ?? publicPools[0]?.payment)?.mint
      if (!paymentMint) throw new HttpError(409, 'the mint is not open')
      const decimals = (await rpc<{ value: { decimals: number } }>('getTokenSupply', [paymentMint])).value.decimals
      const quote = quoteFor(await nasduckUsd(db), decimals)
      // Each mint costs the dollar quote, or the guard's floor if that is higher.
      const perMint = (m: Machine, kind: 'otc' | 'public') => {
        const q = kind === 'otc' ? quote.otc : quote.public
        return q > m.payment!.amount ? q : m.payment!.amount
      }
      const topUp = (m: Machine, kind: 'otc' | 'public', count: number) => BigInt(count) * (perMint(m, kind) - m.payment!.amount)
      const worstCase =
        (otcQuantity > 0 && otc.payment ? BigInt(otcQuantity) * perMint(otc, 'otc') : 0n) +
        BigInt(publicQuantity) * publicPools.reduce((max, m) => (perMint(m, 'public') > max ? perMint(m, 'public') : max), 0n)
      const balances = await rpc<{ value: { account: { data: { parsed: { info: { tokenAmount: { amount: string } } } } } }[] }>('getTokenAccountsByOwner', [
        wallet,
        { mint: paymentMint },
        { encoding: 'jsonParsed' },
      ])
      const balance = balances.value.reduce((a, t) => a + BigInt(t.account.data.parsed.info.tokenAmount.amount), 0n)
      if (balance < worstCase) {
        const whole = (n: bigint) => (n / 10n ** BigInt(decimals)).toLocaleString('en-US')
        throw new HttpError(400, `not enough $NASDUCK: this order costs ${whole(worstCase)} at the live price, your wallet has ${whole(balance)}`)
      }

      const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash()
      const transactions: Prepared[] = []

      if (otcQuantity > 0) {
        let left = Math.min(otcQuantity, otc.remaining)
        while (left > 0) {
          const want = Math.min(MAX_OTC_MINTS_PER_TX, left)
          const { data: reserved, error } = await db.rpc('reserve_otc_claims', {
            p_wallet: wallet,
            p_assets: desks,
            p_quantity: want,
            p_ttl_seconds: RESERVATION_TTL_SECONDS,
          })
          if (error) throw new Error('reservation failed')
          const rows = (reserved ?? []) as { otc_asset: string; reservation_id: string }[]
          if (!rows.length) break
          const reservationId = rows[0].reservation_id
          try {
            let builder = transactionBuilder()
            const assets: string[] = []
            for (let i = 0; i < rows.length; i++) {
              const m = mintIx(umi, otc, minter, signer)
              assets.push(m.asset)
              builder = builder.add(m.builder)
            }
            const extra = topUp(otc, 'otc', rows.length)
            if (extra > 0n) builder = builder.add(topUpIx(umi, wallet, otc.payment!, decimals, extra))
            builder = builder
              .add({
                instruction: {
                  programId: publicKey(MEMO_PROGRAM),
                  keys: [{ pubkey: signer.publicKey, isSigner: true, isWritable: false }],
                  data: new TextEncoder().encode(`${MEMO_PREFIX}${reservationId}`),
                },
                signers: [signer],
                bytesCreatedOnChain: 0,
              })
              .setFeePayer(minter)
              .setBlockhash({ blockhash, lastValidBlockHeight })
            transactions.push({ kind: 'otc', reservationId, assets, cost: (BigInt(rows.length) * perMint(otc, 'otc')).toString(), transaction: await finish(umi, builder) })
          } catch (e) {
            await db.rpc('release_otc_reservation', { p_reservation: reservationId })
            throw e
          }
          left -= rows.length
          if (rows.length < want) break
        }
        if (!transactions.length) throw new HttpError(409, 'no unused OTC Desks left on this wallet')
      }

      if (publicQuantity > 0) {
        const assigned = assignPublic(publicPools, publicQuantity)
        if (!assigned.length) throw new HttpError(409, 'the public mint is sold out')
        // Pack each pool's mints into as few transactions as fit.
        for (const pool of new Set(assigned)) {
          let count = assigned.filter((p) => p === pool).length
          while (count > 0) {
            let builder = transactionBuilder().setFeePayer(minter).setBlockhash({ blockhash, lastValidBlockHeight })
            const assets: string[] = []
            // Leave room for the top-up transfer (same size whatever the amount).
            const withTopUp = (b: TransactionBuilder) => b.add(topUpIx(umi, wallet, pool.payment!, decimals, 1n))
            while (count > 0) {
              const m = mintIx(umi, pool, minter, mintSigner)
              const next = builder.add(m.builder)
              if (assets.length > 0 && !withTopUp(next).fitsInOneTransaction(umi)) break
              builder = next
              assets.push(m.asset)
              count--
            }
            const extra = topUp(pool, 'public', assets.length)
            if (extra > 0n) builder = builder.add(topUpIx(umi, wallet, pool.payment!, decimals, extra))
            transactions.push({ kind: 'public', assets, cost: (BigInt(assets.length) * perMint(pool, 'public')).toString(), transaction: await finish(umi, builder) })
          }
        }
      }

      return json(
        { transactions, lastValidBlockHeight, quote: { nasduckUsd: quote.nasduckUsd, public: quote.public.toString(), otc: quote.otc.toString(), decimals } },
        200,
        cors,
      )
    }

    // ------------------------------------------------------------- submit
    if (body.action === 'submit') {
      const txs = body.transactions
      if (!Array.isArray(txs) || !txs.length || txs.length > MAX_SUBMIT || !txs.every((t) => typeof t === 'string' && t.length < 4000)) {
        throw new HttpError(400, `transactions must be a list of up to ${MAX_SUBMIT} signed transactions`)
      }

      // Results come back in the same order the transactions were submitted.
      type Sent = { signature: string; status: 'confirmed' | 'failed'; reason?: string; assets: { address: string; name: string; uri: string }[] }
      const results: Sent[] = new Array(txs.length)
      const pending: { index: number; signature: string; sigBytes: Uint8Array; reservationId?: string; assets: string[] }[] = []

      for (const [index, t] of (txs as string[]).entries()) {
        let tx
        try {
          tx = umi.transactions.deserialize(base64.serialize(t))
        } catch {
          throw new HttpError(400, 'invalid transaction')
        }
        const keys = tx.message.accounts.map(String)
        // Only relay mints against our own machines: this is not an open relay.
        if (!keys.includes(OTC_MACHINE) && !keys.includes(PUBLIC_MACHINE)) throw new HttpError(400, 'not a NasDucks mint transaction')
        const signerKeys = keys.slice(0, tx.message.header.numRequiredSignatures)
        const memoIx = tx.message.instructions.find((ix) => keys[ix.programIndex] === MEMO_PROGRAM)
        const memo = memoIx ? new TextDecoder().decode(memoIx.data) : ''
        const reservationId = signerKeys.includes(signer.publicKey) ? UUID_RE.exec(memo)?.[1] : undefined
        // New mint assets are the extra signers (not the fee payer, not our signer).
        const assets = signerKeys.slice(1).filter((k) => k !== signer.publicKey && k !== mintSigner.publicKey)
        try {
          const sigBytes = await umi.rpc.sendTransaction(tx, { commitment: 'confirmed' })
          pending.push({ index, signature: base58.deserialize(sigBytes)[0], sigBytes, reservationId, assets })
        } catch (e) {
          const msg = e instanceof Error ? e.message : ''
          const reason = /insufficient|0x1\b/i.test(msg) ? 'insufficient balance' : /blockhash/i.test(msg) ? 'expired, try again' : 'transaction failed'
          console.error('nasducks-mint send failed:', scrub(msg).slice(0, 300))
          results[index] = { signature: '', status: 'failed', reason, assets: [] }
        }
      }

      const deadline = Date.now() + CONFIRM_TIMEOUT_MS
      const done = new Map<string, { ok: boolean }>()
      while (done.size < pending.length && Date.now() < deadline) {
        const statuses = await umi.rpc.getSignatureStatuses(pending.map((p) => p.sigBytes))
        statuses.forEach((s, i) => {
          if (s && (s.commitment === 'confirmed' || s.commitment === 'finalized')) done.set(pending[i].signature, { ok: s.error == null })
        })
        if (done.size < pending.length) await sleep(1000)
      }

      for (const p of pending) {
        const d = done.get(p.signature)
        if (!d) {
          results[p.index] = { signature: p.signature, status: 'failed', reason: 'not confirmed in time, check your wallet before retrying', assets: [] }
          continue
        }
        if (!d.ok) {
          results[p.index] = { signature: p.signature, status: 'failed', reason: 'transaction failed', assets: [] }
          continue
        }
        if (p.reservationId) await db.rpc('confirm_otc_reservation', { p_reservation: p.reservationId, p_signature: p.signature })
        const assets = []
        for (const a of p.assets) {
          try {
            const asset = await fetchAsset(umi, publicKey(a))
            assets.push({ address: a, name: asset.name, uri: asset.uri })
          } catch {
            // Indexing lag right after confirmation; the mint still happened.
            assets.push({ address: a, name: '', uri: '' })
          }
        }
        results[p.index] = { signature: p.signature, status: 'confirmed', assets }
      }
      // Push the new minted count to every open page without delaying this response.
      if (results.some((r) => r.status === 'confirmed')) {
        EdgeRuntime.waitUntil(currentStats(db, umi, signer, mintSigner, true).catch(() => {}))
      }
      return json({ results }, 200, cors)
    }

    // ------------------------------------------------------------ confirm
    if (body.action === 'confirm') {
      const signatures = body.signatures
      if (!Array.isArray(signatures) || !signatures.length || signatures.length > MAX_SUBMIT || !signatures.every((s) => typeof s === 'string' && s.length <= 100)) {
        throw new HttpError(400, `signatures must be a list of up to ${MAX_SUBMIT} transaction signatures`)
      }
      let confirmed = 0
      for (const sig of signatures as string[]) {
        const tx = await rpc<{
          meta: { err: unknown; logMessages?: string[] } | null
          transaction: { message: { accountKeys: (string | { pubkey: string })[]; header?: { numRequiredSignatures: number } } }
        } | null>('getTransaction', [sig, { encoding: 'json', maxSupportedTransactionVersion: 0, commitment: 'confirmed' }])
        if (!tx || tx.meta?.err != null) continue
        const keys = tx.transaction.message.accountKeys.map((k) => (typeof k === 'string' ? k : k.pubkey))
        const signerCount = tx.transaction.message.header?.numRequiredSignatures ?? 0
        if (!keys.slice(0, signerCount).includes(signer.publicKey)) continue
        const id = (tx.meta?.logMessages ?? []).map((l) => UUID_RE.exec(l)?.[1]).find(Boolean)
        if (!id) continue
        const { data } = await db.rpc('confirm_otc_reservation', { p_reservation: id, p_signature: sig })
        if (typeof data === 'number' && data > 0) confirmed++
      }
      return json({ confirmed }, 200, cors)
    }

    throw new HttpError(400, 'unknown action')
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status, cors)
    console.error('nasducks-mint error:', scrub(err instanceof Error ? err.message : 'unknown'))
    return json({ error: 'something went wrong, try again' }, 500, cors)
  }
})
