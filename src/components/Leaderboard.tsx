import { useState } from 'react'
import { useHolderLeaderboard, type HolderRow } from '../hooks/useHolderLeaderboard'
import { useWalletTrades } from '../hooks/useWalletTrades'
import { formatTokenAmount, formatPercent, formatTimeAgo, shortenAddress } from '../lib/format'

export function Leaderboard() {
  const { holders, loading, error, updatedAt } = useHolderLeaderboard()

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-[18px] py-[15px]">
        <div className="font-display text-lg text-ink-primary">TOP OF BOOK</div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-ink-faint">
          <span>◆ = DIAMOND HANDS (14D)</span>
          {updatedAt && <span>UPDATED {formatTimeAgo((Date.now() - new Date(updatedAt).getTime()) / 1000)}</span>}
        </div>
      </div>

      <div className="grid grid-cols-[38px_minmax(0,1fr)_auto_62px] gap-2.5 border-b border-line px-[18px] py-2.5 font-mono text-[10px] tracking-wide text-ink-faint">
        <div>#</div>
        <div>WALLET</div>
        <div className="text-right">BALANCE</div>
        <div className="text-right">24H</div>
      </div>

      {loading && <div className="py-8 text-center font-mono text-sm text-ink-muted">loading top holders…</div>}
      {error && <div className="py-8 text-center font-mono text-sm text-down">{error}</div>}
      {!loading && !error && holders.length === 0 && (
        <div className="py-8 text-center font-mono text-sm text-ink-faint">no snapshot yet — check back shortly</div>
      )}

      <div className="max-h-[480px] overflow-auto">
        {holders.map((h) => (
          <HolderRowItem key={h.wallet} holder={h} />
        ))}
      </div>
    </div>
  )
}

function HolderRowItem({ holder }: { holder: HolderRow }) {
  const [expanded, setExpanded] = useState(false)
  const { data, loading, fetchTrades } = useWalletTrades()

  function toggle() {
    const next = !expanded
    setExpanded(next)
    if (next && !data && !loading) fetchTrades(holder.wallet)
  }

  const diamond = data && data.nasduckBought > 0 && data.nasduckSold === 0

  return (
    <div className="border-b border-line-subtle last:border-b-0">
      <button
        onClick={toggle}
        className="grid w-full grid-cols-[38px_minmax(0,1fr)_auto_62px] items-center gap-2.5 px-[18px] py-3 text-left hover:bg-panel-deep"
      >
        <div className="font-mono text-xs text-ink-faint">{String(holder.rank).padStart(2, '0')}</div>
        <div className="flex min-w-0 items-center gap-2">
          <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-ink-secondary">
            {shortenAddress(holder.wallet)}
          </div>
          {diamond && (
            <span className="whitespace-nowrap rounded-full border border-[#2F7FD1] bg-[rgba(47,127,209,.14)] px-1.5 py-0.5 font-mono text-[10px] text-[#8FD1FF]">
              ◆ NEVER SOLD
            </span>
          )}
        </div>
        <div className="text-right font-mono text-[12.5px] text-ink-secondary">{formatTokenAmount(holder.balance)}</div>
        <div className={`text-right font-mono text-xs ${holder.change24h >= 0 ? 'text-up' : 'text-down'}`}>
          {formatPercent(holder.change24h)}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-line-subtle bg-bg px-[18px] py-3 font-mono text-[11px] text-ink-faint">
          {loading && 'checking 14-day trade history…'}
          {!loading && data && (
            <>
              {data.nasduckBought > 0
                ? `${diamond ? 'Never sold' : 'Sold some'} in the tracked window — bought ${formatTokenAmount(data.nasduckBought)}, sold ${formatTokenAmount(data.nasduckSold)}.`
                : 'No buys tracked in the last 14 days — this holding predates the window.'}
            </>
          )}
        </div>
      )}
    </div>
  )
}
