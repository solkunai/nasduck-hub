import { useState } from 'react'

const LINKS = [
  { href: '#swap', icon: '🎯', label: 'BUY $NASDUCK' },
  { href: '#tap-the-duck', icon: '🦆', label: 'TAP THE DUCK' },
  { href: '#memes', icon: '😂', label: 'MEMES' },
]

// One menu, not a separate mobile/desktop implementation — a small icon
// button + dropdown works identically at any width, so there's nothing to
// diverge between the two.
export function NavMenu() {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="menu"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-lg border border-line text-ink-muted transition-colors hover:border-line-strong hover:text-ink-primary"
      >
        {open ? '✕' : '☰'}
      </button>

      {open && (
        <>
          {/* Closes on outside click — sits below the panel, above the page. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-[46px] z-50 w-[200px] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_16px_40px_rgba(0,0,0,.5)]">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-3 font-mono text-[12.5px] text-ink-secondary hover:bg-panel-deep hover:text-ink-primary"
              >
                <span>{link.icon}</span>
                {link.label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
