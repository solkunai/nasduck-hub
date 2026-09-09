import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { NASDUCK_X } from '../../lib/nasduck'
import { NavMenu } from './NavMenu'

export function Header() {
  return (
    <div className="sticky top-0 z-40 border-b border-line bg-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src="/mascot/nasduck-logo.jpg"
            alt="NASDUCK"
            className="h-9 w-9 shrink-0 rounded-full border border-line-strong object-cover"
          />
          <span className="truncate font-display text-[17px] tracking-tight text-ink-primary">NASDUCK</span>
          <span className="hidden rounded border border-[#6B4415] bg-[#1A1206] px-1.5 py-0.5 font-mono text-[10px] text-brand sm:inline-block">
            SOLANA
          </span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <NavMenu />
          <a
            href={NASDUCK_X}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg border border-line px-3 py-2 font-mono text-xs text-ink-muted transition-colors hover:border-line-strong hover:text-ink-primary sm:block"
          >
            @NASDUCKOTC
          </a>
          <WalletMultiButton
            style={{
              background: '#0E2140',
              border: '1px solid #1E3A66',
              borderRadius: 8,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12,
              height: 38,
              whiteSpace: 'nowrap',
              paddingLeft: 12,
              paddingRight: 12,
            }}
          />
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
