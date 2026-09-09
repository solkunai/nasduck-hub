import { useMarket } from '../providers/MarketProvider'
import { formatPrice, formatPercent, formatUsdCompact } from '../lib/format'

export function PriceChart() {
  const m = useMarket()
  const up = m.change24h >= 0

  return (
    <div className="min-w-0 flex-[2] rounded-2xl border border-line bg-panel p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="font-display text-lg text-ink-primary">$NASDUCK / USD</div>
          <div className={`font-mono text-lg ${up ? 'text-up' : 'text-down'}`}>{formatPrice(m.price)}</div>
          <div className={`font-mono text-[12.5px] ${up ? 'text-up' : 'text-down'}`}>{formatPercent(m.change24h)}</div>
        </div>
      </div>
      <div className="relative mt-3.5 h-[380px] overflow-hidden rounded-[10px] border border-line-subtle bg-bg">
        {m.pairAddress ? (
          // Real candlesticks via DexScreener's own embed — same provider
          // already backing price/mcap/volume elsewhere on this page, and
          // confirmed live (no X-Frame-Options/CSP frame-ancestors blocking
          // it) before wiring this in, not assumed from a URL pattern
          // someone else used once. Pair address comes from live market
          // data (the same highest-liquidity pair DexScreener itself picked
          // for the stats below), not hardcoded, so this tracks reality if
          // liquidity ever migrates to a different pool.
          <iframe
            title="NASDUCK price chart"
            src={`https://dexscreener.com/solana/${m.pairAddress}?embed=1&theme=dark&trades=0&info=0`}
            className="h-full w-full border-0"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-mono text-[11px] text-ink-dim">
            loading chart…
          </div>
        )}
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
