import { useMarket } from '../providers/MarketProvider'
import { formatPrice, formatPercent, formatUsdCompact, formatNumber } from '../lib/format'

function Row() {
  const m = useMarket()
  const up = m.change24h >= 0
  const chgClass = up ? 'text-up' : 'text-down'
  return (
    <div className="flex items-center gap-8 whitespace-nowrap px-6 py-2.5 font-mono text-[12.5px]">
      <span className="text-ink-faint">
        $NASDUCK <span className={chgClass}>{formatPrice(m.price)}</span>
      </span>
      <span className="text-ink-faint">
        24H <span className={chgClass}>{formatPercent(m.change24h)}</span>
      </span>
      <span className="text-ink-faint">
        MCAP <span className="text-ink-secondary">{formatUsdCompact(m.marketCap)}</span>
      </span>
      <span className="text-ink-faint">
        VOL 24H <span className="text-ink-secondary">{formatUsdCompact(m.volume24h)}</span>
      </span>
      <span className="text-ink-faint">
        HOLDERS <span className="text-ink-secondary">{formatNumber(m.holders)}</span>
      </span>
      <span className="text-brand">FIRED FROM WALL STREET, HIRED BY DEGENS</span>
      <span className="text-ink-faint">OTC DESK OPEN 24/7 — QUACK RESPONSIBLY</span>
    </div>
  )
}

export function TickerMarquee() {
  return (
    <div className="sticky top-[61px] z-30 overflow-hidden border-b border-line bg-panel-deep">
      <div className="flex w-max animate-ndMarquee">
        <Row />
        <Row />
      </div>
    </div>
  )
}
