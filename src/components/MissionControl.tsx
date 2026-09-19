import { useMarket } from '../providers/MarketProvider'
import { MCAP_GOAL, HOLDER_GOAL } from '../lib/nasduck'
import { formatUsdCompact, formatNumber } from '../lib/format'

interface Mark {
  label: string
  pct: number
  displayPct: number
  value: number
}

const MCAP_MILESTONES = [1e6, 10e6, 25e6, 50e6, 100e6, 250e6, 500e6, 1e9]

// Fixed dollar milestones (not fractions of the goal) per the ask: 100M/
// 250M/etc. read as too lofty a first rung for a coin still in the low
// millions — 1M/10M/25M feel like real near-term progress instead.
// `pct` still ties each mark to its real fraction of the $1B goal (used
// below to detect an actual crossing and to color the tick once passed),
// but `displayPct` spaces the eight tick *labels* evenly across the track
// instead of at their true proportional position — plotted to true scale,
// the first four (1M-50M) would all land within the leftmost 5% of the
// bar and their labels would overlap.
function mcapMarks(goal: number): Mark[] {
  return MCAP_MILESTONES.map((value, i) => ({
    label: formatUsdCompact(value),
    pct: (value / goal) * 100,
    displayPct: (i / (MCAP_MILESTONES.length - 1)) * 100,
    value,
  }))
}

// Holder goal is only 100,000 (not a billion), so 10%/25%/50%/100% fractions
// stay visually spread out on their own — no need for the same decoupling.
function holderMarks(goal: number): Mark[] {
  const fractions = [0.1, 0.25, 0.5, 1]
  return fractions.map((f) => {
    const v = goal * f
    return { label: formatNumber(v), pct: f * 100, displayPct: f * 100, value: v }
  })
}

function Track({
  title,
  current,
  goal,
  goalLabel,
  currentLabel,
  color,
  glow,
  marksList,
  footer,
}: {
  title: string
  current: number
  goal: number
  goalLabel: string
  currentLabel: string
  color: string
  glow: string
  marksList: Mark[]
  footer: string
}) {
  const pct = Math.min(100, (current / goal) * 100)

  return (
    <div className="relative rounded-2xl border border-line bg-panel p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">TARGET · {title}</div>
          <div className="mt-1.5 font-mono text-[clamp(28px,4vw,40px)] font-bold text-ink-primary">{currentLabel}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10.5px] text-ink-faint">GOAL</div>
          <div className="font-display text-xl" style={{ color }}>
            {goalLabel}
          </div>
        </div>
      </div>
      <div className="relative mt-[22px] h-[26px] overflow-hidden rounded-md border border-line bg-bg">
        <div
          className="absolute inset-0"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,transparent 0 19px,#132A4D 19px 20px)' }}
        />
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg,${color}aa,${color})`, boxShadow: `0 0 18px ${glow}` }}
        />
      </div>
      <div className="relative mt-1.5 h-[34px]">
        {marksList.map((m) => (
          <div key={m.label} className="absolute -translate-x-1/2 text-center" style={{ left: `${Math.min(98, m.displayPct)}%` }}>
            <div className="mx-auto mb-1 h-2 w-px" style={{ background: pct >= m.pct ? color : '#4A6690' }} />
            <div className="font-mono text-[10px]" style={{ color: pct >= m.pct ? color : '#4A6690' }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 border-t border-line pt-3 font-mono text-[11.5px] text-ink-faint">
        {pct.toFixed(1)}% OF TARGET · {footer}
      </div>
    </div>
  )
}

export function MissionControl() {
  const m = useMarket()
  const mcapMarksList = mcapMarks(MCAP_GOAL)
  const holderMarksList = holderMarks(HOLDER_GOAL)
  const nextMcap = mcapMarksList.find((x) => x.value > m.marketCap)?.label ?? formatUsdCompact(MCAP_GOAL)

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-9">
      <div className="flex flex-wrap items-baseline gap-3.5">
        <h2 className="font-display text-[clamp(24px,3vw,34px)] tracking-tight text-ink-primary">MISSION CONTROL</h2>
        <div className="font-mono text-[11px] text-ink-faint">NASDUCK'S OWN SCOREBOARD · TWO TARGETS</div>
      </div>
      <div className="mt-5 grid gap-[18px] [grid-template-columns:repeat(auto-fit,minmax(320px,1fr))]">
        <Track
          title="MARKET CAP"
          current={m.marketCap}
          goal={MCAP_GOAL}
          goalLabel="$1B"
          currentLabel={formatUsdCompact(m.marketCap)}
          color="#F5911E"
          glow="rgba(245,145,30,.35)"
          marksList={mcapMarksList}
          footer={`NEXT MILESTONE ${nextMcap}`}
        />
        <Track
          title="HOLDERS"
          current={m.holders}
          goal={HOLDER_GOAL}
          goalLabel="100,000"
          currentLabel={formatNumber(m.holders)}
          color="#6FBE44"
          glow="rgba(111,190,68,.3)"
          marksList={holderMarksList}
          footer="LIVE"
        />
      </div>
    </div>
  )
}
