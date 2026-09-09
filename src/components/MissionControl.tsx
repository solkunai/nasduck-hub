import { useEffect, useRef, useState } from 'react'
import { useMarket } from '../providers/MarketProvider'
import { MCAP_GOAL, HOLDER_GOAL } from '../lib/nasduck'
import { formatUsdCompact, formatNumber } from '../lib/format'

interface Mark {
  label: string
  pct: number
  value: number
}

// Fixed 10%/25%/50%/100% fractions of the goal rather than hardcoded
// dollar amounts — was [10M, 25M, 50M, 100M] sized specifically for a
// $100M goal; with the goal now $1B those would've all crammed into the
// first 10% of the bar instead of spreading across it. The 100% mark
// matters beyond just being the finish line — it's what fires the
// "MILESTONE CROSSED" celebration burst once the goal is fully hit.
function marks(goal: number, unit: 'usd' | 'num'): Mark[] {
  const fractions = [0.1, 0.25, 0.5, 1]
  return fractions.map((f) => {
    const v = goal * f
    return { label: unit === 'usd' ? formatUsdCompact(v) : formatNumber(v), pct: f * 100, value: v }
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
  const [burst, setBurst] = useState<string | null>(null)
  const lastCrossed = useRef(0)

  useEffect(() => {
    for (const m of marksList) {
      if (pct >= m.pct && lastCrossed.current < m.pct) {
        lastCrossed.current = m.pct
        setBurst(`${m.label} ${title === 'MARKET CAP' ? '' : 'HOLDERS'}`.trim())
        const t = setTimeout(() => setBurst(null), 2600)
        return () => clearTimeout(t)
      }
    }
  }, [pct, marksList, title])

  return (
    <div className="relative rounded-2xl border border-line bg-panel p-[22px]">
      {burst && (
        <div
          className="pointer-events-none absolute inset-0 z-10 flex animate-ndBurst items-center justify-center rounded-2xl"
          style={{ background: `radial-gradient(circle at 50% 50%, ${glow}, transparent 70%)` }}
        >
          <div className="rounded-2xl border px-6 py-4 text-center" style={{ borderColor: color, background: 'rgba(10,26,49,.94)' }}>
            <div className="mb-1 font-mono text-[11px] tracking-[2px] text-up">MILESTONE CROSSED</div>
            <div className="font-display text-[28px] tracking-tight text-ink-primary">{burst}</div>
            <div className="mt-1 font-mono text-xs text-brand">QUACK</div>
          </div>
        </div>
      )}
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
          <div key={m.label} className="absolute -translate-x-1/2 text-center" style={{ left: `${Math.min(98, m.pct)}%` }}>
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
  const mcapMarks = marks(MCAP_GOAL, 'usd')
  const holderMarks = marks(HOLDER_GOAL, 'num')
  const nextMcap = mcapMarks.find((x) => x.value > m.marketCap)?.label ?? formatUsdCompact(MCAP_GOAL)

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
          marksList={mcapMarks}
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
          marksList={holderMarks}
          footer="LIVE"
        />
      </div>
    </div>
  )
}
