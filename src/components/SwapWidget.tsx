import { useMemo, useState } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useMarket } from '../providers/MarketProvider'
import { useJupiterOrder } from '../hooks/useJupiterOrder'
import { useBalances } from '../hooks/useBalances'
import { executeOrder } from '../lib/swap'
import { NASDUCK_MINT, WSOL_MINT, NASDUCK_DECIMALS, FEE_BPS } from '../lib/nasduck'
import { formatPrice, formatTokenAmount, formatUsdCompact } from '../lib/format'

const SOL_DECIMALS = 9
// Left unswapped on a MAX buy so the transaction still has SOL to pay
// network + priority fees with.
const SOL_FEE_RESERVE = 0.01

type Side = 'BUY' | 'SELL'
type TxState = { status: 'idle' | 'pending' | 'success' | 'error'; message?: string; signature?: string | null }

export function SwapWidget() {
  const { publicKey, connected, signTransaction, login } = useActiveWallet()
  const market = useMarket()
  const balances = useBalances()

  const [side, setSide] = useState<Side>('BUY')
  // Was hardcoded to '1.0' (1 SOL) — confirmed live this broke the widget
  // for anyone with less than 1 SOL: Jupiter's Ultra API validates the
  // order against the connected wallet's real balance and correctly
  // rejects it as insufficient, which is most casual wallets, not an edge
  // case. Empty means no quote is requested until the user actually enters
  // or picks an amount.
  const [amountStr, setAmountStr] = useState('')
  const [tx, setTx] = useState<TxState>({ status: 'idle' })

  const inputMint = side === 'BUY' ? WSOL_MINT : NASDUCK_MINT
  const outputMint = side === 'BUY' ? NASDUCK_MINT : WSOL_MINT
  const inputDecimals = side === 'BUY' ? SOL_DECIMALS : NASDUCK_DECIMALS
  const outputDecimals = side === 'BUY' ? NASDUCK_DECIMALS : SOL_DECIMALS

  const amountNum = parseFloat(amountStr) || 0
  const amountRaw = Math.round(amountNum * 10 ** inputDecimals)

  const { order, loading, error } = useJupiterOrder(inputMint, outputMint, amountRaw, publicKey?.toBase58())
  const receiveAmount = order ? order.outAmount / 10 ** outputDecimals : 0

  // USD value of each side, independent of the input token's own price
  // trend — SOL's price for whichever side is denominated in SOL, DUCK's
  // for whichever side is denominated in DUCK.
  const payUsd = amountNum * (side === 'BUY' ? market.solPrice : market.price)
  const receiveUsd = receiveAmount * (side === 'BUY' ? market.price : market.solPrice)

  const payBalance = side === 'BUY' ? balances.sol : balances.nasduck
  const feePct = (order?.feeBps ?? FEE_BPS) / 100

  const rateStr = useMemo(() => {
    if (market.price <= 0) return '—'
    return side === 'BUY' ? `${formatTokenAmount(market.solPrice / market.price)} DUCK` : formatPrice(market.price)
  }, [market.price, market.solPrice, side])

  function setPct(pct: number) {
    const reserve = side === 'BUY' ? SOL_FEE_RESERVE : 0
    const usable = Math.max(0, payBalance - reserve)
    setAmountStr((usable * pct).toFixed(side === 'BUY' ? 4 : 2))
  }

  async function handleSwap() {
    if (!connected || !publicKey) {
      login()
      return
    }
    if (!order || !signTransaction) return

    setTx({ status: 'pending' })
    try {
      const result = await executeOrder(order, signTransaction)
      setTx({ status: 'success', signature: result.signature })
    } catch (err) {
      setTx({ status: 'error', message: err instanceof Error ? err.message : 'swap failed' })
    }
  }

  const ctaLabel = !connected
    ? 'CONNECT WALLET'
    : tx.status === 'pending'
      ? 'SENDING…'
      : side === 'BUY'
        ? 'APE IN'
        : 'PAPER HANDS'

  return (
    <div className="max-w-[420px] rounded-2xl border border-line-strong bg-gradient-to-b from-[#12294F] to-panel-deep p-[18px] shadow-[0_0_0_1px_rgba(245,145,30,.14),0_20px_50px_rgba(0,0,0,.45)]">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2.5">
        <div className="font-display text-[17px] text-ink-primary">THE TERMINAL</div>
        <div className="rounded-full border border-line px-2 py-1 font-mono text-[10px] text-ink-faint">
          JUPITER AGGREGATED
        </div>
      </div>

      <div className="mb-3.5 grid grid-cols-2 gap-1.5">
        <button
          onClick={() => setSide('BUY')}
          className={`rounded-lg border border-line py-2.5 text-center font-display text-[13px] ${side === 'BUY' ? 'bg-up text-bg' : 'text-ink-faint'}`}
        >
          BUY
        </button>
        <button
          onClick={() => setSide('SELL')}
          className={`rounded-lg border border-line py-2.5 text-center font-display text-[13px] ${side === 'SELL' ? 'bg-down text-bg' : 'text-ink-faint'}`}
        >
          SELL
        </button>
      </div>

      <div className="rounded-[10px] border border-line bg-bg p-3.5">
        <div className="flex justify-between font-mono text-[10.5px] text-ink-faint">
          <span>YOU PAY</span>
          <span>BAL {balances.error ? '—' : side === 'BUY' ? balances.sol.toFixed(3) : formatTokenAmount(balances.nasduck)}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <input
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            inputMode="decimal"
            placeholder="0.0"
            className="min-w-0 flex-1 bg-transparent font-mono text-[26px] font-bold text-ink-primary outline-none placeholder:text-ink-dim"
          />
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-input py-1.5 pl-2 pr-3 font-mono text-[13px] text-ink-secondary">
            {side === 'BUY' ? (
              <img src="/icons/solana.png" alt="" className="h-[18px] w-[18px] object-contain" />
            ) : (
              <img src="/mascot/nasduck-pfp.jpg" alt="" className="h-[18px] w-[18px] rounded-full object-cover" />
            )}
            {side === 'BUY' ? 'SOL' : 'DUCK'}
          </div>
        </div>
        {payUsd > 0 && <div className="mt-1 font-mono text-[11px] text-ink-faint">≈ {formatUsdCompact(payUsd)}</div>}
        <div className="mt-2.5 flex gap-1.5">
          {[0.25, 0.5, 1].map((pct) => (
            <button
              key={pct}
              onClick={() => setPct(pct)}
              className="rounded-md border border-line px-2.5 py-1 font-mono text-[10.5px] text-ink-muted hover:border-brand hover:text-brand"
            >
              {pct === 1 ? 'MAX' : `${pct * 100}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-center py-1">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-line-strong bg-input text-ink-muted">↓</div>
      </div>

      <div className="rounded-[10px] border border-line bg-bg p-3.5">
        <div className="flex justify-between font-mono text-[10.5px] text-ink-faint">
          <span>YOU RECEIVE</span>
          <span>{loading ? 'QUOTING…' : 'LIVE QUOTE'}</span>
        </div>
        <div className="mt-2 flex items-center gap-2.5">
          <div
            className={`min-w-0 flex-1 overflow-hidden text-ellipsis font-mono text-[26px] font-bold ${side === 'BUY' ? 'text-up' : 'text-down'}`}
          >
            {receiveAmount > 0 ? (side === 'BUY' ? formatTokenAmount(receiveAmount) : receiveAmount.toFixed(4)) : '0'}
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-line bg-input py-1.5 pl-1.5 pr-3 font-mono text-[13px]">
            {side === 'BUY' ? (
              <img src="/mascot/nasduck-pfp.jpg" alt="" className="h-5 w-5 rounded-full object-cover" />
            ) : (
              <img src="/icons/solana.png" alt="" className="h-5 w-5 object-contain" />
            )}
            {side === 'BUY' ? 'DUCK' : 'SOL'}
          </div>
        </div>
        {receiveUsd > 0 && (
          <div className={`mt-1 font-mono text-[11px] ${side === 'BUY' ? 'text-up' : 'text-down'}`}>
            ≈ {formatUsdCompact(receiveUsd)}
          </div>
        )}
      </div>

      <div className="my-3 grid gap-1.5 font-mono text-[10.5px] text-ink-faint">
        <div className="flex justify-between gap-2.5">
          <span>RATE</span>
          <span className="text-ink-muted">1 SOL ≈ {rateStr}</span>
        </div>
        <div className="flex justify-between gap-2.5">
          <span>PRICE IMPACT</span>
          <span className={order && order.priceImpactPct > 3 ? 'text-down' : 'text-up'}>
            {order ? `${order.priceImpactPct.toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-2.5">
          <span>SLIPPAGE</span>
          <span className="text-ink-muted">AUTO</span>
        </div>
        <div className="flex justify-between gap-2.5">
          <span>DESK FEE</span>
          <span className="text-ink-muted">{feePct.toFixed(2)}%</span>
        </div>
      </div>

      {balances.error && (
        <div className="mb-2 font-mono text-[11px] text-down">balance check failed: {balances.error}</div>
      )}
      {error && <div className="mb-2 font-mono text-[11px] text-down">{error}</div>}
      {tx.status === 'error' && <div className="mb-2 font-mono text-[11px] text-down">{tx.message}</div>}
      {tx.status === 'success' && (
        <div className="mb-2 font-mono text-[11px] text-up">
          quacked ✓{' '}
          {tx.signature && (
            <a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer" className="underline">
              view on solscan
            </a>
          )}
        </div>
      )}

      <button
        onClick={handleSwap}
        disabled={connected && (!order || tx.status === 'pending')}
        className="w-full rounded-[10px] bg-brand py-4 text-center font-display text-base text-bg transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ctaLabel}
      </button>
      <div className="mt-2.5 text-center font-mono text-[10px] text-ink-dim">
        Non-custodial. The duck never touches your keys.
      </div>
    </div>
  )
}
