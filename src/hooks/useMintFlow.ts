import { useCallback, useEffect, useRef, useState } from 'react'
import { useActiveWallet } from './useActiveWallet'
import { useMarket } from '../providers/MarketProvider'
import { MINT_START, SUPPLY, USD_PRICE_PER_MINT, fmt, pad, tierColor, type CollectionItem } from '../lib/mint/config'

export type GateState = 'idle' | 'reading' | 'granted' | 'failed'
export type MintStage = 'idle' | 'signing' | 'settling'
export type PanelKey = 'rarity' | 'info' | null

export interface MintedDuck {
  id: string
  image: string
  frame: string
  rarity: string
  rank: number
  attributes: { trait_type: string; value: string; pct: number }[]
}

// Real 4,444-item collection (public/mint/collection.json), fetched once and
// shuffled client-side so each simulated "pull" hands out a real, unique
// duck (real rank/tier/attributes) instead of the old 4-item MOCK_LOOKS
// placeholder. Still a simulated draw — no real Candy Machine mint yet —
// but the duck you get back is a genuine item from the actual generated set.
let collectionPromise: Promise<CollectionItem[]> | null = null
function loadShuffledCollection(): Promise<CollectionItem[]> {
  if (!collectionPromise) {
    collectionPromise = fetch('/mint/collection.json')
      .then((r) => r.json())
      .then((items: CollectionItem[]) => {
        const shuffled = items.slice()
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1))
          ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
        }
        return shuffled
      })
  }
  return collectionPromise
}

export interface TapeRow {
  time: string
  wallet: string
  qty: number
  id: string
  mine: boolean
}

export interface Receipt {
  items: MintedDuck[]
  qty: number
  /** Total $NASDUCK charged (token count, not USD) — whole tokens. */
  total: number
}

const randWallet = () => {
  const c = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  let a = ''
  let b = ''
  for (let i = 0; i < 4; i++) {
    a += c[Math.floor(Math.random() * c.length)]
    b += c[Math.floor(Math.random() * c.length)]
  }
  return `${a}…${b}`
}

const nowClock = () => new Date().toTimeString().slice(0, 8)

/**
 * Drives the whole mint page's interactive state.
 *
 * Wallet connect/disconnect is REAL (via useActiveWallet / Privy) — clicking
 * the floor pass opens a real wallet login, and `gate` tracks that real flow.
 *
 * Everything else (minted count ticking up, the activity tape, the mint
 * transaction itself, and what you "pull") is SIMULATED, matching the
 * design prototype's mock timers 1:1. None of it is wired to a real Candy
 * Machine yet — that's the next build step once one exists on devnet.
 */
export function useMintFlow() {
  const wallet = useActiveWallet()
  const market = useMarket()

  // $5 worth of $NASDUCK at the current live price. `market.live` is false
  // until the first real price tick lands (see MarketProvider) — while
  // that's true we're still on its hardcoded fallback price, so the token
  // amount shown is a rough placeholder, not the real live figure yet.
  const nasduckPerMint = market.price > 0 ? USD_PRICE_PER_MINT / market.price : 0

  const [gate, setGate] = useState<GateState>('idle')
  const [stage, setStage] = useState<MintStage>('idle')
  const [qty, setQty] = useState(1)
  const [minted, setMinted] = useState(MINT_START)
  const [tape, setTape] = useState<TapeRow[]>([])
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [panel, setPanel] = useState<PanelKey>(null)
  const [mine, setMine] = useState<MintedDuck[]>([])
  const [sel, setSel] = useState(0)

  const gateTimeout = useRef<number | undefined>(undefined)
  const grantedTimeout = useRef<number | undefined>(undefined)
  const idleTimeout = useRef<number | undefined>(undefined)
  const mintTimeout1 = useRef<number | undefined>(undefined)
  const mintTimeout2 = useRef<number | undefined>(undefined)

  // Real 4,444-item collection, preloaded so it's ready by the time a mint
  // actually happens (connecting a wallet + the scan animation already takes
  // a few seconds, plenty of time for this small fetch to land).
  const collectionRef = useRef<CollectionItem[] | null>(null)
  const drawIndexRef = useRef(0)
  useEffect(() => {
    loadShuffledCollection().then((items) => {
      collectionRef.current = items
    })
  }, [])

  // Seed the activity tape with plausible-looking recent history on mount —
  // cosmetic only, matches the prototype's seeded mock tape.
  useEffect(() => {
    const seed: TapeRow[] = []
    let t = Date.now()
    for (let i = 0; i < 8; i++) {
      t -= 9000 + Math.random() * 20000
      seed.push({
        time: new Date(t).toTimeString().slice(0, 8),
        wallet: randWallet(),
        qty: 1 + Math.floor(Math.random() * 4),
        id: `#${pad(1 + Math.floor(Math.random() * SUPPLY))}`,
        mine: false,
      })
    }
    setTape(seed)
  }, [])

  // Random mint "ticker" — simulates other people minting, same cadence as
  // the prototype (tick every second, ~65% chance of a mint that second).
  useEffect(() => {
    const iv = window.setInterval(() => {
      if (Math.random() > 0.35) return
      setMinted((cur) => {
        if (cur >= SUPPLY) return cur
        const q = Math.min(SUPPLY - cur, 1 + Math.floor(Math.random() * 4))
        const row: TapeRow = { time: nowClock(), wallet: randWallet(), qty: q, id: `#${pad(cur + 1)}`, mine: false }
        setTape((t) => [row, ...t].slice(0, 8))
        return cur + q
      })
    }, 1000)
    return () => window.clearInterval(iv)
  }, [])

  // How long the badge keeps visibly "scanning" after Privy's popup closes
  // and the wallet actually connects, before flipping to "granted". Privy's
  // modal closes itself the instant login succeeds — without this, a fast
  // connection (or an already-authorized cached session) would cut straight
  // from popup-closes to granted with no scan visible at all. This is
  // measured from the moment `wallet.connected` actually flips true, not
  // from when the user clicked, so a slow connection (picking a wallet,
  // approving in the extension) doesn't eat into this window.
  const SCAN_AFTER_CONNECT_MS = 1000

  // Drives the floor-pass "reading… granted…" animation off the REAL wallet
  // connection, not a fake timer. Clicking opens Privy's real login; once
  // `wallet.connected` actually flips true we keep scanning briefly, then
  // show "granted" and settle. onError (closing the modal, rejecting a
  // wallet connection, etc.) flips to "failed" immediately instead of
  // sitting on "reading…" until the 45s fallback timeout below.
  const badgeIn = useCallback(() => {
    if ((gate !== 'idle' && gate !== 'failed') || wallet.connected) return
    setGate('reading')
    wallet.login(() => {
      window.clearTimeout(gateTimeout.current)
      setGate((g) => (g === 'reading' ? 'failed' : g))
    })
    // Safety net: if nothing happens for a while (no onError fired, no
    // connection landed), don't leave the reader stuck on "reading" forever.
    gateTimeout.current = window.setTimeout(() => setGate((g) => (g === 'reading' ? 'failed' : g)), 45000)
  }, [gate, wallet])

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

  useEffect(() => () => {
    window.clearTimeout(gateTimeout.current)
    window.clearTimeout(grantedTimeout.current)
    window.clearTimeout(idleTimeout.current)
    window.clearTimeout(mintTimeout1.current)
    window.clearTimeout(mintTimeout2.current)
  }, [])

  const logout = useCallback(() => {
    wallet.logout()
    setGate('idle')
    setStage('idle')
    // Disconnecting clears the "Your Ducks" view back to the unrevealed
    // placeholder — without a connected wallet we have no business still
    // showing "you own these" in the UI.
    setMine([])
    setSel(0)
  }, [wallet])

  // SIMULATED mint — matches the prototype's signing(1.2s) -> settling(1.3s)
  // -> reveal timing exactly. TODO: replace with a real Candy Machine mint
  // instruction (build tx -> wallet.signTransaction -> send -> confirm) once
  // one is deployed to devnet.
  const onMint = useCallback(() => {
    if (!wallet.connected) {
      badgeIn()
      return
    }
    if (stage !== 'idle') return
    setStage('signing')
    mintTimeout1.current = window.setTimeout(() => {
      setStage('settling')
      mintTimeout2.current = window.setTimeout(() => {
        setMinted((cur) => {
          const q = Math.min(qty, SUPPLY - cur)
          const pool = collectionRef.current
          const items: MintedDuck[] = Array.from({ length: q }, (_, i) => {
            if (!pool) {
              // Fallback for the rare case the fetch hasn't resolved yet —
              // shouldn't normally happen given the wallet-connect delay.
              return { id: `#${pad(cur + 1 + i)}`, image: '/mint/duck_minted.png', frame: '#C9D3E3', rarity: 'COMMON', rank: 0, attributes: [] }
            }
            const picked = pool[(drawIndexRef.current + i) % pool.length]
            return { id: picked.id, image: picked.image, frame: tierColor(picked.tier), rarity: picked.tier, rank: picked.rank, attributes: picked.attributes }
          })
          if (pool) drawIndexRef.current += q
          const row: TapeRow = {
            time: nowClock(),
            wallet: `YOU · ${wallet.publicKey ? `${wallet.publicKey.toBase58().slice(0, 4)}…${wallet.publicKey.toBase58().slice(-4)}` : '····'}`,
            qty: q,
            id: items[0]?.id ?? '',
            mine: true,
          }
          setTape((t) => [row, ...t].slice(0, 8))
          setMine((m) => [...items.slice().reverse(), ...m])
          setSel(0)
          setReceipt({ items, qty: q, total: Math.round(q * nasduckPerMint) })
          return cur + q
        })
        setStage('idle')
      }, 1300)
    }, 1200)
  }, [wallet, stage, qty, nasduckPerMint, badgeIn])

  // No per-wallet cap on the public mint — a wallet can take as much of the
  // remaining supply as it wants, so the only ceiling here is what's left.
  const dec = useCallback(() => setQty((q) => Math.max(1, q - 1)), [])
  const inc = useCallback(() => setQty((q) => Math.min(SUPPLY - minted, q + 1)), [minted])
  const setMaxQty = useCallback(() => setQty(Math.max(1, SUPPLY - minted)), [minted])
  const closeReceipt = useCallback(() => setReceipt(null), [])
  const togglePanel = useCallback((key: PanelKey) => setPanel((p) => (p === key ? null : key)), [])

  return {
    wallet,
    usdPricePerMint: USD_PRICE_PER_MINT,
    nasduckPerMint,
    nasduckPriceUsd: market.price,
    priceLive: market.live,
    gate,
    stage,
    qty,
    minted,
    mintedStr: fmt(minted),
    remainingStr: fmt(SUPPLY - minted),
    mintedPct: ((minted / SUPPLY) * 100).toFixed(1) + '%',
    tape,
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
    closeReceipt,
    togglePanel,
  }
}
