import { useState } from 'react'
import { Link } from 'react-router-dom'
import { NASDUCK_MINT, NASDUCK_X } from '../../lib/nasduck'

export function Footer() {
  const [copied, setCopied] = useState(false)
  function copyCa() {
    navigator.clipboard?.writeText(NASDUCK_MINT).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <>
      <div className="mx-auto max-w-[1240px] px-5 py-9">
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
          <a
            href={NASDUCK_X}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-line bg-panel p-[18px] hover:border-brand"
          >
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">X / TWITTER</div>
            <div className="mt-1.5 font-display text-[19px] text-ink-primary">@NASDUCKOTC ↗</div>
          </a>
          <div onClick={copyCa} className="cursor-pointer rounded-xl border border-line bg-panel p-[18px] hover:border-brand">
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">CONTRACT ADDRESS</div>
            <div className="mt-1.5 break-all font-mono text-[12.5px] leading-snug text-ink-secondary">{NASDUCK_MINT}</div>
            <div className="mt-2 font-mono text-[11px] text-brand">{copied ? 'COPIED ✓' : 'TAP TO COPY'}</div>
          </div>
          <a
            href={`https://solscan.io/token/${NASDUCK_MINT}`}
            target="_blank"
            rel="noreferrer"
            className="block rounded-xl border border-line bg-panel p-[18px] hover:border-brand"
          >
            <div className="font-mono text-[10.5px] tracking-wide text-ink-faint">EXPLORER</div>
            <div className="mt-1.5 font-display text-[19px] text-ink-primary">SOLSCAN ↗</div>
            <div className="mt-1.5 font-mono text-[11px] text-ink-faint">Verify supply, holders, mint authority</div>
          </a>
        </div>
      </div>
      <div className="border-t border-line bg-bg">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-5 py-6">
          <div className="flex items-center gap-2.5">
            <img src="/mascot/nasduck-logo.jpg" alt="" className="h-7 w-7 rounded-full object-cover" />
            <div className="font-mono text-[11.5px] text-ink-faint">$NASDUCK · SOLANA · 2026</div>
            <div className="flex items-center gap-3 border-l border-line pl-3 font-mono text-[11px] text-ink-dim">
              <Link to="/legal#terms" className="hover:text-ink-primary">
                Terms
              </Link>
              <Link to="/legal#privacy" className="hover:text-ink-primary">
                Privacy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
