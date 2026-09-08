import { useMarket } from '../providers/MarketProvider'
import { usePriceHistory } from '../hooks/usePriceHistory'
import { formatPrice, formatPercent, formatUsdCompact } from '../lib/format'

export function PriceChart() {
  const m = useMarket()
  const history = usePriceHistory(m.price)
  const up = m.change24h >= 0

  const points = (() => {
    if (history.length < 2) return ''
    const lo = Math.min(...history)
    const hi = Math.max(...history)
    const span = hi - lo || 1
    return history
      .map((v, i) => {
        const x = (i / (history.length - 1)) * 600
        const y = 224 - ((v - lo) / span) * 196
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  })()

  return (
    <div className="min-w-0 flex-[2] rounded-2xl border border-line bg-panel p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="font-display text-lg text-ink-primary">$NASDUCK / USD</div>
          <div className={`font-mono text-lg ${up ? 'text-up' : 'text-down'}`}>{formatPrice(m.price)}</div>
          <div className={`font-mono text-[12.5px] ${up ? 'text-up' : 'text-down'}`}>{formatPercent(m.change24h)}</div>
        </div>
      </div>
      <div className="relative mt-3.5 overflow-hidden rounded-[10px] border border-line-subtle bg-bg">
        <svg viewBox="0 0 600 240" preserveAspectRatio="none" className="block h-[250px] w-full">
          <defs>
            <linearGradient id="ndFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={up ? '#6FBE44' : '#E8434F'} stopOpacity="0.32" />
              <stop offset="100%" stopColor={up ? '#6FBE44' : '#E8434F'} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M0 60 H600 M0 120 H600 M0 180 H600" stroke="#132A4D" strokeWidth="1" />
          {points && (
            <>
              <path d={`M0,240 L${points} L600,240 Z`} fill="url(#ndFill)" />
              <polyline points={points} fill="none" stroke={up ? '#6FBE44' : '#E8434F'} strokeWidth="2.2" strokeLinejoin="round" />
            </>
          )}
        </svg>
        <div className="absolute right-3 top-2.5 font-mono text-[10.5px] text-ink-dim">LIVE SESSION</div>
      </div>
      <div className="mt-3.5 grid grid-cols-2 gap-px overflow-hidden rounded-[10px] border border-line bg-line">
        <Stat label="MCAP" value={formatUsdCompact(m.marketCap)} />
        <Stat label="VOL 24H" value={formatUsdCompact(m.volume24h)} />
        <Stat label="LIQUIDITY" value={formatUsdCompact(m.liquidityUsd)} />
        <Stat label="HOLDERS" value={m.holders.toLocaleString('en-US')} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel px-3.5 py-3">
      <div className="font-mono text-[10px] text-ink-faint">{label}</div>
      <div className="mt-0.5 font-mono text-[15px] text-ink-secondary">{value}</div>
    </div>
  )
}
