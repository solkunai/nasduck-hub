import { VersionedTransaction, type PublicKey } from '@solana/web3.js'
import { FEE_BPS, REFERRAL_ACCOUNT as NASDUCK_REFERRAL_ACCOUNT, WSOL_MINT } from './nasduck'

// Jupiter's Ultra API, not the classic quote/v1+swap/v1 pair ANSEM Hub used.
// Two reasons: (1) ANSEM Hub proved on-chain that the classic endpoints'
// feeAccount/platformFeeBps mechanism can fail with a real InvalidTokenAccount
// error for some routes — Ultra's referralAccount/referralFee goes through
// Jupiter's officially-supported, wallet-recognized Referral Program instead.
// (2) Ultra's /execute broadcasts the signed transaction on Jupiter's own
// backend (via "Beam"), so this app never calls connection.sendRawTransaction
// itself — sidesteps the public-RPC-blocks-sendTransaction problem ANSEM Hub
// needed a whole edge-function proxy to work around.
const ORDER_URL = 'https://lite-api.jup.ag/ultra/v1/order'
const EXECUTE_URL = 'https://lite-api.jup.ag/ultra/v1/execute'

// referral.jup.ag setup is done (see lib/nasduck.ts for the resulting
// Referral Account address — note it's a distinct on-chain account Jupiter
// creates for FEE_WALLET, not FEE_WALLET's own pubkey). A SOL Referral Token
// Account is created under it too. Confirmed directly against Jupiter's
// /ultra/v1/fees endpoint: fee-mint selection follows a fixed priority order
// (SOL > stablecoins > LSTs > bluechips > everything else), and SOL is on
// every NASDUCK trade regardless of direction — so SOL always wins and a
// NASDUCK-denominated referral token account is never needed.
const REFERRAL_ACCOUNT = import.meta.env.VITE_JUP_REFERRAL_ACCOUNT ?? NASDUCK_REFERRAL_ACCOUNT

export interface JupiterOrder {
  requestId: string
  transaction: string | null
  outAmount: number
  priceImpactPct: number
  feeBps: number
  feeMint: string | null
  raw: unknown
}

async function requestOrder(params: URLSearchParams): Promise<{ ok: boolean; status: number; raw: any }> {
  const res = await fetch(`${ORDER_URL}?${params.toString()}`)
  // A 429 body isn't guaranteed to be valid JSON — don't let a parse failure
  // mask the real status code.
  const raw = await res.json().catch(() => ({}))
  return { ok: res.ok && !raw.error, status: res.status, raw }
}

export async function fetchOrder(
  inputMint: string,
  outputMint: string,
  amountRaw: number,
  taker?: string,
): Promise<JupiterOrder> {
  const baseParams = new URLSearchParams({ inputMint, outputMint, amount: String(amountRaw) })
  if (taker) baseParams.set('taker', taker)

  const withReferral = new URLSearchParams(baseParams)
  withReferral.set('referralAccount', REFERRAL_ACCOUNT)
  withReferral.set('referralFee', String(FEE_BPS))

  let { ok, status, raw } = await requestOrder(withReferral)

  // Confirmed live: Jupiter's Ultra API rejects the *entire* order (not just
  // the fee) when referralAccount doesn't point to a real initialized
  // Referral Account — "check that referralAccount is initialized ... for
  // project ...". That's a harder failure than expected (silently
  // fee-less), so fall back to a plain order with no referral params at all
  // rather than leaving the whole swap widget broken until the one-time
  // referral.jup.ag setup is done. Once that account exists, the first
  // branch succeeds and the fee applies automatically — no code change
  // needed.
  if (!ok) {
    console.warn(
      `[swap] order with referral params failed (${raw.error ?? status}) — falling back to a fee-less order. ` +
        'Create a Referral Account for FEE_WALLET at referral.jup.ag to enable the swap fee.',
    )
    ;({ ok, status, raw } = await requestOrder(baseParams))
  }

  if (!ok) throw new Error(raw.error ?? `order ${status}`)

  let feeBps = raw.feeBps != null ? Number(raw.feeBps) : 0
  let feeMint: string | null = raw.feeMint ?? null

  // Hard requirement, not just an expectation: the fee must only ever be
  // collected in SOL, never NASDUCK — confirmed Jupiter's own fee-mint
  // priority (SOL > stablecoins > LSTs > bluechips > others) already
  // guarantees this for a SOL/NASDUCK pair, but assert it in code rather
  // than just trusting that behavior holds forever. If a fee is somehow
  // about to land in anything other than SOL, refuse it — refetch a plain
  // order with no referral params rather than let a NASDUCK-denominated fee
  // through.
  if (feeBps > 0 && feeMint && feeMint !== WSOL_MINT) {
    console.warn(
      `[swap] fee would be collected in ${feeMint}, not SOL — refusing and refetching a fee-less order instead. This should never happen for a SOL/NASDUCK pair; investigate if it does.`,
    )
    const plain = await requestOrder(baseParams)
    if (!plain.ok) throw new Error(plain.raw.error ?? `order ${plain.status}`)
    raw = plain.raw
    feeBps = 0
    feeMint = null
  } else if (feeBps !== FEE_BPS) {
    // Order still executes fine without the fee — this just means the
    // referral token account for SOL isn't set up yet (a softer version of
    // the same setup step above).
    console.warn(
      `[swap] expected ${FEE_BPS}bps referral fee, got ${feeBps}bps — the SOL referral token account may not be initialized yet at referral.jup.ag`,
    )
  }

  return {
    requestId: raw.requestId ?? '',
    transaction: raw.transaction ?? null,
    outAmount: raw.outAmount != null ? Number(raw.outAmount) : 0,
    priceImpactPct: raw.priceImpactPct != null ? Number(raw.priceImpactPct) : 0,
    feeBps,
    feeMint,
    raw,
  }
}

export interface ExecuteResult {
  status: 'Success' | 'Failed' | string
  signature: string | null
}

export async function executeOrder(
  order: JupiterOrder,
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>,
): Promise<ExecuteResult> {
  if (!order.transaction) throw new Error('order has no transaction to execute')

  const txBytes = Uint8Array.from(atob(order.transaction), (c) => c.charCodeAt(0))
  const tx = VersionedTransaction.deserialize(txBytes)
  const signed = await signTransaction(tx)
  const signedTransaction = btoa(String.fromCharCode(...signed.serialize()))

  const res = await fetch(EXECUTE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ signedTransaction, requestId: order.requestId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? `execute ${res.status}`)
  if (data.status === 'Failed') throw new Error(data.error ?? 'swap failed on-chain')

  return { status: data.status ?? 'Success', signature: data.signature ?? null }
}

export function isTaker(publicKey: PublicKey | null): publicKey is PublicKey {
  return publicKey !== null
}
