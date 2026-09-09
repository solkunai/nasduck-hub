import { useOtcRewards } from '../hooks/useOtcRewards'
import { useOtcPayoutFeed } from '../hooks/useOtcPayoutFeed'
import { formatTimeAgo, shortenAddress } from '../lib/format'

// $NASDUCK's creator fees route through OTC Desks (otcdesks.cash), a real
// Solana protocol: 70% of every fee accumulates as SOL and swaps into
// NASDUCK's assigned tokenized stock (QQQx — a custodian-backed Nasdaq-100
// ETF token) once the balance clears a threshold, then holders claim their
// share. Confirmed directly against OTC Desks' own public API before
// building this (not assumed from a tweet or a screenshot) — see
// otcdesks.cash/docs for the mechanism, and the reward_mint this card links
// out to for independent verification.
function formatSol(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' SOL'
}

export function OtcRewards() {
  const { rewards, loading, error } = useOtcRewards()
  const feed = useOtcPayoutFeed()

  // No row yet (function hasn't run once) or a fetch error — say nothing
  // rather than show a broken-looking card. This section only adds value
  // once there's real data to show.
  if (loading || error || !rewards) return null

  const secondsAgo = rewards.lastDistributedAt
    ? (Date.now() - new Date(rewards.lastDistributedAt).getTime()) / 1000
    : null

  return (
    <div className="mx-auto max-w-[1240px] px-5 pb-9">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h2 className="font-display text-[clamp(24px,3vw,34px)] tracking-tight text-ink-primary">HOLDER REWARDS</h2>
        <div className="font-mono text-[11px] text-ink-faint">POWERED BY OTC DESKS · PAID IN {rewards.rewardSymbol}</div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-panel p-[22px]">
        <div className="grid gap-6 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div>
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">PAID TO HOLDERS</div>
            <div className="mt-1.5 font-mono text-[clamp(26px,4vw,38px)] font-bold" style={{ color: '#F5911E' }}>
              {formatSol(rewards.paidToHoldersSol)}
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink-dim">in {rewards.rewardSymbol}, real Nasdaq-100 exposure</div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">TOTAL CREATOR FEES EARNED</div>
            <div className="mt-1.5 font-mono text-[clamp(20px,3vw,28px)] font-bold text-ink-primary">
              {formatSol(rewards.creatorFeesEarnedSol)}
            </div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink-dim">70% to holders · every swap contributes</div>
          </div>

          <div>
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">ACCUMULATING NOW</div>
            <div className="mt-1.5 font-mono text-[clamp(20px,3vw,28px)] font-bold text-ink-primary">{formatSol(rewards.owedSol)}</div>
            <div className="mt-0.5 font-mono text-[10.5px] text-ink-dim">
              {secondsAgo !== null ? `last round paid ${rewards.lastPaidHolders.toLocaleString()} holders, ${formatTimeAgo(secondsAgo)}` : 'next round pending'}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-4 border-t border-line pt-4 font-mono text-[10.5px] text-ink-faint">
          <a
            href={`https://otcdesks.cash/coin/7Y7V1a4m2nWK7BMgbka5B4vR1pDvCK7yva3Hnrqkraze`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:text-ink-primary"
          >
            View live on OTC Desks ↗
          </a>
          <a
            href={`https://solscan.io/token/${rewards.rewardMint}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted hover:text-ink-primary"
          >
            {rewards.rewardSymbol} token ↗
          </a>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <div className="mb-2.5 font-mono text-[10px] tracking-wide text-ink-faint">PAYOUT FEED</div>

          {/* OTC Desks has no history API for a single coin — this feed is
              built up live by our own backend as each new payout round is
              detected, not backfilled. Empty at first is expected, not
              broken — it fills in as real payouts happen (roughly every
              ~10-11 minutes going by the live cadence observed while
              building this). */}
          {feed.loading ? (
            <div className="py-3 font-mono text-xs text-ink-faint">loading…</div>
          ) : feed.entries.length === 0 ? (
            <div className="py-3 font-mono text-xs text-ink-faint">
              waiting for the next payout — checking every ~10 min, this fills in live
            </div>
          ) : (
            <>
              {feed.entries.map((entry) => (
                <a
                  key={entry.id}
                  href={`https://solscan.io/tx/${entry.claimTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between gap-2.5 border-b border-line-subtle py-2.5 font-mono text-xs hover:bg-panel-deep"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-up">+{formatSol(entry.amountSol)}</span>
                    <span className="text-ink-dim">→ {entry.holdersPaid.toLocaleString()} holders</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-ink-faint">
                    <span>{shortenAddress(entry.claimTx, 4, 4)}</span>
                    <span>{formatTimeAgo((Date.now() - new Date(entry.paidAt).getTime()) / 1000)}</span>
                  </div>
                </a>
              ))}

              {feed.hasMore && (
                <button
                  onClick={feed.loadMore}
                  disabled={feed.loadingMore}
                  className="mt-3 w-full rounded-lg border border-line py-2 font-mono text-[11px] text-ink-muted hover:border-line-strong hover:text-ink-primary disabled:opacity-50"
                >
                  {feed.loadingMore ? 'LOADING…' : 'LOAD MORE'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
