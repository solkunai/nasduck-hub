import { useWhaleFeed } from '../hooks/useWhaleFeed'
import { formatTokenAmount, formatUsdCompact, formatTimeAgo, shortenAddress } from '../lib/format'

export function WhaleFeed() {
  const { trades, loading } = useWhaleFeed()

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line px-[18px] py-[15px]">
        <div className="flex items-center gap-2.5">
          <span className="h-1.5 w-1.5 animate-ndPulse rounded-full bg-up" />
          <div className="font-display text-lg text-ink-primary">FOWL PLAY TAPE</div>
        </div>
        <div className="font-mono text-[10px] text-ink-faint">LARGE PRINTS ≥ $250</div>
      </div>

      {loading && <div className="py-8 text-center font-mono text-sm text-ink-muted">loading tape…</div>}

      {!loading && trades.length === 0 && (
        <div className="py-10 text-center font-mono text-sm text-ink-faint">
          quiet on the tape — nothing above $250 yet
        </div>
      )}

      {!loading && trades.length > 0 && (
        <div className="max-h-[430px] overflow-auto">
          {trades.map((t) => (
            <div
              key={t.id}
              className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-3 border-b border-line-subtle px-[18px] py-3 last:border-b-0 hover:bg-panel-deep"
            >
              <div
                className={`rounded-[5px] border py-1 text-center font-display text-[11px] tracking-wide ${
                  t.side === 'buy' ? 'border-[#33591F] text-up' : 'border-[#6B2027] text-down'
                }`}
              >
                {t.side.toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-[12.5px] text-ink-secondary">
                  {shortenAddress(t.wallet)}
                </div>
                <div className="mt-0.5 font-mono text-[10.5px] text-ink-faint">
                  {formatTokenAmount(t.tokenAmount)} DUCK · {formatTimeAgo((Date.now() - new Date(t.createdAt).getTime()) / 1000)}
                </div>
              </div>
              <div className={`text-right font-mono text-sm font-semibold ${t.side === 'buy' ? 'text-up' : 'text-down'}`}>
                {formatUsdCompact(t.usdAmount)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
