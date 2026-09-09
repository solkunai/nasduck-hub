import { useState } from 'react'
import { useMarket } from '../providers/MarketProvider'
import { NASDUCK_MINT } from '../lib/nasduck'
import { formatPrice, formatPercent } from '../lib/format'

export function Hero() {
  const m = useMarket()
  const [copied, setCopied] = useState(false)
  const up = m.change24h >= 0
  const chgClass = up ? 'text-up' : 'text-down'

  const mascotAnim = up ? (m.change24h > 20 ? 'animate-ndPump' : 'animate-ndFloat') : 'animate-ndDip'
  const auraColor = up ? 'rgba(111,190,68,.22)' : 'rgba(232,67,79,.2)'

  function copyCa() {
    navigator.clipboard?.writeText(NASDUCK_MINT).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="mx-auto grid max-w-[1240px] items-center gap-9 px-5 pb-5 pt-11 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
      <div className="min-w-0">
        <h1 className="mb-4 font-display text-[clamp(38px,6.2vw,74px)] leading-[0.95] tracking-tighter text-ink-primary text-balance">
          FIRED FROM
          <br />
          WALL STREET.
          <br />
          <span className="text-brand">HIRED BY DEGENS.</span>
        </h1>
        <p className="mb-6 max-w-[520px] text-[16.5px] leading-relaxed text-ink-muted text-pretty">
          $NASDUCK is a duck with a Bloomberg terminal, a pair of swim goggles and no compliance
          department. Your new financial advisor takes his fees in memes.
        </p>

        <div className="mb-5 flex flex-wrap items-stretch gap-3">
          <a
            href="#swap"
            className="flex items-center gap-2.5 rounded-[10px] bg-brand px-6 py-4 font-display text-[17px] text-bg transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
          >
            BUY $NASDUCK <span className="font-mono text-[13px] opacity-70">↓ JUP</span>
          </a>
          <div className="flex min-w-[190px] flex-col justify-center rounded-[10px] border border-line bg-panel px-[18px] py-[11px]">
            <div className="font-mono text-[10px] tracking-wide text-ink-faint">PRICE</div>
            <div className="flex items-baseline gap-2.5">
              <div className={`font-mono text-[22px] font-bold ${chgClass}`}>{formatPrice(m.price)}</div>
              <div className={`font-mono text-[13px] ${chgClass}`}>{formatPercent(m.change24h)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-gradient-to-b from-panel to-panel-deep p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">
              OFFICIAL CONTRACT ADDRESS · SOLANA
            </div>
            <a
              href={`https://solscan.io/token/${NASDUCK_MINT}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10.5px] text-ink-faint hover:text-brand"
            >
              SOLSCAN ↗
            </a>
          </div>
          <div
            onClick={copyCa}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-bg p-3.5 hover:border-brand"
          >
            <div className="min-w-0 flex-1 break-all font-mono text-[12.5px] leading-snug text-ink-secondary">
              {NASDUCK_MINT}
            </div>
            <div
              className={`whitespace-nowrap rounded-md px-3 py-2 font-display text-[11px] text-bg ${copied ? 'bg-up' : 'bg-brand'}`}
            >
              {copied ? 'COPIED ✓' : 'COPY CA'}
            </div>
          </div>
          <div className="mt-2.5 flex items-start gap-2 font-mono text-[11px] leading-relaxed text-ink-faint">
            <span className="text-up">⚠</span>
            <span>
              Copycats exist. Verify every character before you buy — if the address does not match
              this one, it is not NASDUCK. No presale, no team allocation, no private DMs.
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col items-center gap-3.5">
        <div className="relative flex aspect-square w-full max-w-[400px] items-center justify-center">
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: `radial-gradient(circle at 50% 45%, ${auraColor}, transparent 62%)` }}
          />
          <div className="absolute inset-[6%] rounded-full border border-line" />
          <img
            src="/mascot/nasduck-logo.jpg"
            alt="NASDUCK mascot"
            className={`relative w-4/5 rounded-full shadow-[0_24px_60px_rgba(0,0,0,.55)] ${mascotAnim}`}
          />
        </div>
        <a
          href="#memes"
          className="flex items-center gap-2.5 rounded-[10px] bg-brand px-7 py-3.5 font-display text-[15px] text-bg transition-all hover:-translate-y-0.5 hover:bg-brand-hover"
        >
          🦆 CLICK FOR MEMES
        </a>
      </div>
    </div>
  )
}
