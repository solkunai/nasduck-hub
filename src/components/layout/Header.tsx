import { NASDUCK_X } from '../../lib/nasduck'
import { NavMenu } from './NavMenu'
import { WalletMenu } from './WalletMenu'

// Scrolls to top and drops any section hash (#swap etc.) from the URL
// instead of a plain href="/", which would trigger a full page reload —
// unnecessary for a same-page jump and slower than just scrolling.
function goHome(e: React.MouseEvent) {
  e.preventDefault()
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search)
}

export function Header() {
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5">
        <a
          href="#"
          onClick={goHome}
          className="flex shrink-0 items-center gap-1.5 sm:gap-2.5"
        >
          <img
            src="/mascot/nasduck-logo.jpg"
            alt="NASDUCK"
            className="h-7 w-7 shrink-0 rounded-full border border-line-strong object-cover sm:h-9 sm:w-9"
          />
          {/* Was a fixed 17px — confirmed live it left almost no room next
              to the logo once the button cluster claimed its space on a
              390px screen, so the name effectively disappeared. Scales
              down on mobile instead of staying fixed-size and getting
              squeezed to nothing by `truncate`. */}
          <span className="truncate font-display text-[13px] tracking-tight text-ink-primary sm:text-[17px]">
            NASDUCK
          </span>
          <span className="hidden rounded border border-[#6B4415] bg-[#1A1206] px-1.5 py-0.5 font-mono text-[10px] text-brand sm:inline-block">
            SOLANA
          </span>
        </a>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5 sm:gap-2">
          <NavMenu />
          <a
            href={NASDUCK_X}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-line px-3 py-2 font-mono text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink-primary sm:block"
          >
            @NASDUCKOTC
          </a>
          <WalletMenu />
          <a
            href="#swap"
            className="whitespace-nowrap rounded-lg bg-brand px-3 py-2 font-display text-[13px] text-bg transition-colors hover:bg-brand-hover sm:px-4"
          >
            <span className="sm:hidden">BUY</span>
            <span className="hidden sm:inline">BUY $NASDUCK</span>
          </a>
        </div>
      </div>
    </div>
  )
}
