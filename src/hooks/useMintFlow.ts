import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveWallet } from './useActiveWallet'
import { useMarket } from '../providers/MarketProvider'
import { MINT_LIVE, OTC_USD_PRICE_PER_MINT, SUPPLY, USD_PRICE_PER_MINT, fmt, pad, tierColor, tierForRank, type CollectionItem } from '../lib/mint/config'
import {
  authMessage,
  fetchOwned,
  fetchStatus,
  prepareMint,
  readStats,
  submitMint,
  subscribeStats,
  type MintStats,
  type MintStatus,
  type SubmitResult,
  type WalletAuth,
} from '../lib/mint/api'
import { fromBase64, toBase58, toBase64 } from '../lib/mint/encoding'
import { preloadImage } from '../components/mint/DuckImage'

export type GateState = 'idle' | 'reading' | 'granted' | 'failed'
export type MintStage = 'idle' | 'preparing' | 'authorizing' | 'signing' | 'settling'
export type PanelKey = 'rarity' | 'info' | null

export interface MintedDuck {
  /** On-chain asset address. */
  address: string
  id: string
  image: string
  frame: string
  rarity: string
  rank: number
  // pct is null when the collection-wide stats file isn't available.
  attributes: { trait_type: string; value: string; pct: number | null }[]
}

export interface Receipt {
  items: MintedDuck[]
  qty: number
  /** Total $NASDUCK actually charged (whole tokens). */
  total: number
  otcCount: number
  otcEach: number
  publicCount: number
  publicEach: number
}

// The backend caps each request at 30 per tier; bigger orders run in batches
// (one wallet approval per batch).
const MAX_PER_TIER_PER_BATCH = 30
// Live numbers are pushed to every open page (Realtime). Each page only asks
// the backend for a refresh when it hasn't seen an update for STATS_STALE_MS,
// and the backend re-reads the chain at most once per ~10s for everyone, so
// a crowd of visitors doesn't multiply RPC/API usage.
const STATS_CHECK_MS = 15_000
const STATS_STALE_MS = 25_000
// Wallet balances/desks are fetched on connect, after a mint, and when the
// tab regains focus — at most this often.
const WALLET_REFRESH_MIN_MS = 30_000
// Each new duck is its own on-chain account (~0.0025 SOL rent) plus network
// fees — a deliberately generous per-duck estimate for the pre-check.
const LAMPORTS_PER_DUCK_ESTIMATE = 3_200_000
// The signed OTC message is accepted for 10 minutes; reuse it for 9.
const AUTH_REUSE_MS = 9 * 60_000

// Optional per-trait "% have this" stats. Not shipped publicly before launch
// (spoiler), so a missing file just hides those percentages.
let statsPromise: Promise<Map<string, CollectionItem> | null> | null = null
function loadStats() {
  if (!statsPromise) {
    statsPromise = fetch('/mint/collection.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((items: CollectionItem[] | null) => (items ? new Map(items.map((i) => [i.id, i])) : null))
      .catch(() => null)
  }
  return statsPromise
}

// Builds the reveal card from the duck's own on-chain metadata (Arweave).
async function toMintedDuck(asset: SubmitResult['assets'][number]): Promise<MintedDuck> {
  const n = Number(asset.name.split('#')[1])
  const id = Number.isFinite(n) ? `#${pad(n)}` : '#????'
  const [meta, stats] = await Promise.all([
    asset.uri ? fetch(asset.uri).then((r) => r.json()).catch(() => null) : Promise.resolve(null),
    loadStats(),
  ])
  const statItem = stats?.get(id)
  const rank: number = meta?.rank ?? statItem?.rank ?? 0
  const tier = rank > 0 ? tierForRank(rank) : 'COMMON'
  const attributes = ((meta?.attributes ?? statItem?.attributes ?? []) as { trait_type: string; value: string }[]).map((a) => ({
    trait_type: a.trait_type,
    value: a.value,
    pct: statItem?.attributes.find((x) => x.trait_type === a.trait_type)?.pct ?? null,
  }))
  return { address: asset.address, id, image: meta?.image ?? statItem?.image ?? '', frame: tierColor(tier), rarity: tier, rank, attributes }
}

const isWalletRejection = (e: unknown) => /reject|cancel|denied|declined|closed/i.test(e instanceof Error ? e.message : String(e))

/**
 * Drives the mint page. Everything shown and done here is real: supply,
 * prices, the OTC Desk discount and balances come from the nasducks-mint
 * function (which reads the Candy Machines on-chain), and minting builds,
 * signs, submits and confirms real transactions.
 */
export function useMintFlow() {
  const wallet = useActiveWallet()
  const market = useMarket()
  const walletAddr = wallet.publicKey?.toBase58()

  const [gate, setGate] = useState<GateState>('idle')
  const [stage, setStage] = useState<MintStage>('idle')
  const [qty, setQty] = useState(1)
  const [stats, setStats] = useState<MintStats | null>(null)
  const [walletInfo, setWalletInfo] = useState<MintStatus['wallet'] | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [panel, setPanel] = useState<PanelKey>(null)
  const [mine, setMine] = useState<MintedDuck[]>([])
  const [sel, setSel] = useState(0)
  const [mintError, setMintError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)

  const gateTimeout = useRef<number | undefined>(undefined)
  const grantedTimeout = useRef<number | undefined>(undefined)
  const idleTimeout = useRef<number | undefined>(undefined)
  const authRef = useRef<{ wallet: string; auth: WalletAuth; at: number } | null>(null)

  const lastStatsAt = useRef(0)
  const lastWalletAt = useRef(0)

  // ------------------------------------------------------------ live status
  const applyStats = useCallback((next: MintStats) => {
    // refreshedAt is server time, so ordering is safe whatever the local clock says.
    setStats((prev) => {
      if (prev && next.refreshedAt < prev.refreshedAt) return prev
      if (!prev || next.refreshedAt > prev.refreshedAt) lastStatsAt.current = Date.now()
      return next
    })
  }, [])

  const applyStatus = useCallback(
    (s: MintStatus) => {
      const { wallet: w, refreshedAt, ...rest } = s
      applyStats({ ...rest, refreshedAt: Date.parse(refreshedAt) })
      if (w) {
        setWalletInfo(w)
        lastWalletAt.current = Date.now()
      }
    },
    [applyStats],
  )

  useEffect(() => {
    let cancelled = false
    const check = async () => {
      if (cancelled || document.hidden || Date.now() - lastStatsAt.current < STATS_STALE_MS) return
      // Cheap first: the shared snapshot may have moved without a push reaching us.
      const cached = await readStats()
      if (cancelled) return
      if (cached) applyStats(cached)
      if (Date.now() - lastStatsAt.current < STATS_STALE_MS) return
      // Still stale: ask the backend, which refreshes it for everyone.
      try {
        const fresh = await fetchStatus()
        if (!cancelled) applyStatus(fresh)
      } catch {
        // Keep showing the last known numbers; the next check retries.
      }
    }
    readStats().then((s) => {
      if (cancelled) return
      if (s) applyStats(s)
      // A snapshot older than the stale window counts as stale on first load.
      if (s && Date.now() - s.refreshedAt > STATS_STALE_MS) lastStatsAt.current = 0
      check()
    })
    const unsubscribe = subscribeStats(applyStats, () => {})
    // Jittered so a crowd that loaded together doesn't check in lockstep.
    const iv = window.setInterval(check, STATS_CHECK_MS + Math.floor(Math.random() * 5000))
    return () => {
      cancelled = true
      unsubscribe()
      window.clearInterval(iv)
    }
  }, [applyStats, applyStatus])

  const refreshWallet = useCallback(
    async (force = false) => {
      if (!walletAddr || (!force && Date.now() - lastWalletAt.current < WALLET_REFRESH_MIN_MS)) return
      lastWalletAt.current = Date.now()
      try {
        applyStatus(await fetchStatus(walletAddr))
      } catch {
        // Balances stay as last shown; refetched on next focus or mint.
      }
    },
    [walletAddr, applyStatus],
  )

  // "Your Ducks" gallery: every NasDuck the connected wallet holds, read from
  // the wallet (so it survives refreshes and return visits). Wallet data wins
  // over anything shown so far, which also replaces any placeholder a fresh
  // mint showed before its details were readable. Merged by address.
  const syncOwned = useCallback(async (addr: string, isCancelled: () => boolean = () => false) => {
    // A busy moment (rate limit, slow indexer) shouldn't leave the gallery
    // empty: retry a few times before giving up until the next sync.
    let ducks: Awaited<ReturnType<typeof fetchOwned>>['ducks'] | null = null
    for (const wait of [0, 2000, 5000]) {
      if (isCancelled()) return
      if (wait) await new Promise((r) => setTimeout(r, wait))
      try {
        ducks = (await fetchOwned(addr)).ducks
        break
      } catch {
        // try again
      }
    }
    if (!ducks) return
    const loaded: MintedDuck[] = []
    // A few at a time so a big holder doesn't fire hundreds of requests at once.
    for (let i = 0; i < ducks.length && !isCancelled(); i += 8) {
      loaded.push(...(await Promise.all(ducks.slice(i, i + 8).map(toMintedDuck))))
    }
    if (isCancelled()) return
    loaded.sort((a, b) => b.id.localeCompare(a.id))
    const byAddr = new Map(loaded.map((d) => [d.address, d]))
    setMine((current) => {
      const seen = new Set(current.map((d) => d.address))
      return [...current.map((d) => byAddr.get(d.address) ?? d), ...loaded.filter((d) => !seen.has(d.address))]
    })
    setReceipt((r) => (r ? { ...r, items: r.items.map((d) => byAddr.get(d.address) ?? d) } : r))
  }, [])

  useEffect(() => {
    // A different wallet gets its own gallery, never a mix.
    setMine([])
    setSel(0)
    if (!walletAddr) return
    let cancelled = false
    syncOwned(walletAddr, () => cancelled).catch(() => {})
    // Coming back to the tab re-checks the wallet (at most every 30s).
    let last = Date.now()
    const onVisible = () => {
      if (document.hidden || Date.now() - last < 30_000) return
      last = Date.now()
      syncOwned(walletAddr, () => cancelled).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [walletAddr, syncOwned])

  useEffect(() => {
    setWalletInfo(null)
    if (!walletAddr) return
    refreshWallet(true)
    const onVisible = () => {
      if (!document.hidden) refreshWallet()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [walletAddr, refreshWallet])

  // When desks are on hold, re-check right after the hold ends so they come
  // back without a reload.
  const holdUntil = walletInfo?.holdUntil ? Date.parse(walletInfo.holdUntil) : null
  useEffect(() => {
    if (!holdUntil) return
    const t = window.setTimeout(() => refreshWallet(true), Math.max(0, holdUntil - Date.now()) + 3000)
    return () => window.clearTimeout(t)
  }, [holdUntil, refreshWallet])

  const status: (MintStats & { wallet?: MintStatus['wallet'] }) | null = stats ? { ...stats, wallet: walletInfo ?? undefined } : null

  // ------------------------------------------------------ floor pass badge
  // How long the badge keeps visibly "scanning" after Privy's popup closes
  // and the wallet actually connects, before flipping to "granted" — measured
  // from when `wallet.connected` flips true, so a slow connection doesn't eat
  // into it.
  const SCAN_AFTER_CONNECT_MS = 1000

  // A click before the wallet system has loaded is remembered and acted on
  // the moment it's ready, instead of being silently dropped.
  const pendingLogin = useRef(false)
  const openLogin = useCallback(() => {
    wallet.login(() => {
      window.clearTimeout(gateTimeout.current)
      setGate((g) => (g === 'reading' ? 'failed' : g))
    })
  }, [wallet])

  const badgeIn = useCallback(() => {
    if ((gate !== 'idle' && gate !== 'failed') || wallet.connected) return
    setGate('reading')
    if (wallet.ready) openLogin()
    else pendingLogin.current = true
    // Safety net: never leave the reader stuck on "reading".
    gateTimeout.current = window.setTimeout(() => {
      pendingLogin.current = false
      setGate((g) => (g === 'reading' ? 'failed' : g))
    }, 30000)
  }, [gate, wallet.connected, wallet.ready, openLogin])

  useEffect(() => {
    if (!wallet.ready || !pendingLogin.current) return
    pendingLogin.current = false
    openLogin()
  }, [wallet.ready, openLogin])

  useEffect(() => {
    if (gate !== 'reading' || !wallet.connected) return
    window.clearTimeout(gateTimeout.current)
    grantedTimeout.current = window.setTimeout(() => {
      setGate('granted')
      idleTimeout.current = window.setTimeout(() => setGate('idle'), 1100)
    }, SCAN_AFTER_CONNECT_MS)
    return () => {
      window.clearTimeout(grantedTimeout.current)
      window.clearTimeout(idleTimeout.current)
    }
  }, [gate, wallet.connected])

  useEffect(
    () => () => {
      window.clearTimeout(gateTimeout.current)
      window.clearTimeout(grantedTimeout.current)
      window.clearTimeout(idleTimeout.current)
    },
    [],
  )

  const logout = useCallback(() => {
    wallet.logout()
    setGate('idle')
    setStage('idle')
    setMintError(null)
    // Disconnecting clears "Your Ducks" — no connected wallet, no "you own these".
    setMine([])
    setSel(0)
    authRef.current = null
  }, [wallet])

  // ---------------------------------------------------------------- pricing
  const decimals = status?.prices.decimals ?? 6
  const unit = 10 ** decimals
  const publicBase = status?.prices.public ? BigInt(status.prices.public) : 0n
  const otcBase = status?.prices.otc ? BigInt(status.prices.otc) : 0n
  const publicPriceTokens = Number(publicBase) / unit
  const otcPriceTokens = Number(otcBase) / unit

  const otcAvailable = status?.otcOpen ? Math.min(status.wallet?.desksAvailable ?? 0, status.otcRemaining) : 0
  const publicRemaining = status?.publicRemaining ?? 0
  const maxQty = publicRemaining + otcAvailable

  // The cheaper OTC slots are always used first.
  const otcQty = Math.min(qty, otcAvailable)
  const publicQty = Math.min(qty - otcQty, publicRemaining)
  const totalTokens = otcQty * otcPriceTokens + publicQty * publicPriceTokens
  // Quoted live in $NASDUCK for exactly these dollar amounts.
  const totalUsd = status ? otcQty * OTC_USD_PRICE_PER_MINT + publicQty * USD_PRICE_PER_MINT : null
  const needBase = BigInt(otcQty) * otcBase + BigInt(publicQty) * publicBase
  const balanceBase = status?.wallet ? BigInt(status.wallet.tokenBalance) : null
  const lamports = status?.wallet?.lamports ?? null

  let blockedReason: string | null = null
  if (!status) blockedReason = 'LOADING MARKET…'
  else if (maxQty === 0) blockedReason = 'SOLD OUT'
  else if (qty > maxQty) blockedReason = `ONLY ${fmt(maxQty)} LEFT`
  else if (balanceBase !== null && balanceBase < needBase) blockedReason = 'NOT ENOUGH $NASDUCK'
  else if (lamports !== null && lamports < qty * LAMPORTS_PER_DUCK_ESTIMATE) blockedReason = 'NOT ENOUGH SOL FOR FEES'

  // ------------------------------------------------------------------- mint
  const onMint = useCallback(async () => {
    if (!wallet.connected || !walletAddr) {
      badgeIn()
      return
    }
    if (stage !== 'idle' || !MINT_LIVE || !wallet.signTransactions || !wallet.signMessage) return
    setMintError(null)
    // Show progress the instant the button is pressed; the checks below and
    // the wallet popup can take a moment.
    setStage('preparing')
    const bail = (message: string) => {
      setMintError(message)
      setStage('idle')
    }

    let otcReserved = false
    let latest: MintStatus
    try {
      latest = await fetchStatus(walletAddr)
      applyStatus(latest)
    } catch (e) {
      bail(e instanceof Error ? e.message : 'Could not load the latest mint status')
      return
    }

    const otcAvail = latest.otcOpen ? Math.min(latest.wallet?.desksAvailable ?? 0, latest.otcRemaining) : 0
    const wantOtc = Math.min(qty, otcAvail)
    const wantPublic = qty - wantOtc
    if (wantPublic > latest.publicRemaining) {
      bail(`Only ${fmt(latest.publicRemaining + otcAvail)} available for this wallet right now.`)
      return
    }
    const pubBase = latest.prices.public ? BigInt(latest.prices.public) : 0n
    const otcB = latest.prices.otc ? BigInt(latest.prices.otc) : 0n
    const unitL = 10 ** (latest.prices.decimals ?? 6)
    const need = BigInt(wantOtc) * otcB + BigInt(wantPublic) * pubBase
    if (latest.wallet && BigInt(latest.wallet.tokenBalance) < need) {
      bail(`Not enough $NASDUCK: this order needs ${fmt(Math.ceil(Number(need) / unitL))}, your wallet has ${fmt(Math.floor(Number(BigInt(latest.wallet.tokenBalance)) / unitL))}.`)
      return
    }
    if (latest.wallet && latest.wallet.lamports < qty * LAMPORTS_PER_DUCK_ESTIMATE) {
      bail(`Not enough SOL for network fees: keep about ${((qty * LAMPORTS_PER_DUCK_ESTIMATE) / 1e9).toFixed(3)} SOL in your wallet for this order.`)
      return
    }

    const minted: SubmitResult['assets'] = []
    let otcCount = 0
    let publicCount = 0
    let otcCost = 0n
    let publicCost = 0n
    const failures: string[] = []

    try {
      let auth: WalletAuth | undefined
      if (wantOtc > 0) {
        const cached = authRef.current
        if (cached && cached.wallet === walletAddr && Date.now() - cached.at < AUTH_REUSE_MS) {
          auth = cached.auth
        } else {
          setStage('authorizing')
          const issuedAt = new Date().toISOString()
          const signature = await wallet.signMessage(new TextEncoder().encode(authMessage(walletAddr, issuedAt)))
          auth = { issuedAt, signature: toBase58(signature) }
          authRef.current = { wallet: walletAddr, auth, at: Date.now() }
        }
      }

      let otcLeft = wantOtc
      let pubLeft = wantPublic
      const batches = Math.max(Math.ceil(otcLeft / MAX_PER_TIER_PER_BATCH), Math.ceil(pubLeft / MAX_PER_TIER_PER_BATCH))
      for (let b = 1; otcLeft + pubLeft > 0; b++) {
        if (batches > 1) setProgress(`BATCH ${b} OF ${batches}`)
        const o = Math.min(otcLeft, MAX_PER_TIER_PER_BATCH)
        const p = Math.min(pubLeft, MAX_PER_TIER_PER_BATCH)
        setStage('preparing')
        const prep = await prepareMint(walletAddr, o, p, o > 0 ? auth : undefined)
        otcReserved = prep.transactions.some((t) => t.kind === 'otc')
        setStage('signing')
        const signed = await wallet.signTransactions(
          prep.transactions.map((t) => fromBase64(t.transaction)),
          latest.cluster,
        )
        setStage('settling')
        const { results } = await submitMint(signed.map(toBase64))
        otcReserved = false
        results.forEach((r, i) => {
          if (r.status === 'confirmed') {
            minted.push(...r.assets)
            if (prep.transactions[i].kind === 'otc') {
              otcCount += r.assets.length
              otcCost += BigInt(prep.transactions[i].cost)
            } else {
              publicCount += r.assets.length
              publicCost += BigInt(prep.transactions[i].cost)
            }
          } else {
            failures.push(r.reason ?? 'transaction failed')
          }
        })
        const preparedOtc = prep.transactions.filter((t) => t.kind === 'otc').reduce((a, t) => a + t.assets.length, 0)
        const preparedPub = prep.transactions.filter((t) => t.kind === 'public').reduce((a, t) => a + t.assets.length, 0)
        otcLeft -= o
        pubLeft -= p
        // Stop on any failure, or if the backend couldn't fill this batch
        // (desks or supply ran out) — never silently switch tiers or prices.
        if (!failures.length && (preparedOtc < o || preparedPub < p)) failures.push('fewer ducks were available than requested.')
        if (failures.length) break
      }
    } catch (e) {
      if (isWalletRejection(e)) {
        failures.push(
          otcReserved
            ? 'Cancelled in your wallet, nothing was charged. Your OTC Desk discounts are on hold for a moment and come back automatically.'
            : 'Cancelled in your wallet, nothing was charged.',
        )
      } else {
        failures.push(e instanceof Error ? e.message : 'Something went wrong, nothing further was charged')
      }
    }

    if (minted.length) {
      const ducks = await Promise.all(minted.map(toMintedDuck))
      // Open the card with the pictures ready, not swapping in front of you.
      await Promise.all(ducks.map((d) => preloadImage(d.image)))
      setMine((m) => [...ducks.slice().reverse(), ...m.filter((d) => !ducks.some((x) => x.address === d.address))])
      setSel(0)
      setReceipt({
        items: ducks,
        qty: ducks.length,
        total: Math.round(Number(otcCost + publicCost) / unitL),
        otcCount,
        otcEach: otcCount ? Math.round(Number(otcCost) / unitL / otcCount) : 0,
        publicCount,
        publicEach: publicCount ? Math.round(Number(publicCost) / unitL / publicCount) : 0,
      })
    }
    if (failures.length) {
      const first = failures[0]
      setMintError(minted.length ? `Minted ${minted.length} of ${qty}. ${first}` : first.charAt(0).toUpperCase() + first.slice(1))
    }
    setStage('idle')
    setProgress(null)
    refreshWallet(true)
    if (minted.length) {
      // Re-read the wallet shortly after, so the gallery and reveal show the
      // real ducks even if their details weren't readable at confirmation.
      for (const delay of [3000, 10000]) window.setTimeout(() => syncOwned(walletAddr).catch(() => {}), delay)
    }
  }, [wallet, walletAddr, stage, qty, badgeIn, applyStatus, refreshWallet, syncOwned])

  // --------------------------------------------------------------- quantity
  const ceiling = Math.max(1, maxQty)
  const dec = useCallback(() => setQty((q) => Math.max(1, q - 1)), [])
  const inc = useCallback(() => setQty((q) => Math.min(ceiling, q + 1)), [ceiling])
  const setMaxQty = useCallback(() => setQty(ceiling), [ceiling])
  const resetQty = useCallback(() => setQty(1), [])
  // Lets the qty box be typed into directly; clamps to [1, what's available].
  const setQtyCustom = useCallback(
    (raw: number) => {
      if (!Number.isFinite(raw)) return
      setQty(Math.min(Math.max(1, Math.floor(raw)), ceiling))
    },
    [ceiling],
  )
  const closeReceipt = useCallback(() => setReceipt(null), [])
  const togglePanel = useCallback((key: PanelKey) => setPanel((p) => (p === key ? null : key)), [])

  const supply = status?.supply ?? SUPPLY
  const mintedCount = status?.minted ?? 0
  const fmtTokens = (n: number) => fmt(Math.round(n))

  return {
    wallet,
    cluster: status?.cluster ?? null,
    usdPricePerMint: USD_PRICE_PER_MINT,
    nasduckPriceUsd: market.price,
    gate,
    stage,
    qty,
    supply,
    supplyStr: fmt(supply),
    minted: mintedCount,
    mintedStr: fmt(mintedCount),
    remainingStr: fmt(Math.max(0, supply - mintedCount)),
    mintedPct: ((mintedCount / Math.max(1, supply)) * 100).toFixed(1) + '%',
    publicPriceTokens,
    publicPriceUsd: publicPriceTokens > 0 ? USD_PRICE_PER_MINT : null,
    otcOpen: status?.otcOpen ?? false,
    otcAvailable,
    desksHeld: status?.wallet?.desksHeld ?? 0,
    desksOnHold: status?.wallet?.desksOnHold ?? 0,
    holdUntil,
    otcPriceTokens,
    otcPriceUsd: otcPriceTokens > 0 ? OTC_USD_PRICE_PER_MINT : null,
    otcQty,
    publicQty,
    totalTokens,
    totalTokensStr: fmtTokens(totalTokens),
    totalUsd,
    balanceLabel: status?.wallet
      ? `${(status.wallet.lamports / 1e9).toFixed(3)} SOL · ${fmtTokens(Number(BigInt(status.wallet.tokenBalance)) / unit)} $NASDUCK`
      : '— SOL · — $NASDUCK',
    blockedReason,
    mintError,
    progress,
    receipt,
    panel,
    mine,
    sel,
    setSel,
    badgeIn,
    logout,
    onMint,
    dec,
    inc,
    setMaxQty,
    resetQty,
    refreshBalances: () => refreshWallet(true),
    setQtyCustom,
    closeReceipt,
    togglePanel,
  }
}
