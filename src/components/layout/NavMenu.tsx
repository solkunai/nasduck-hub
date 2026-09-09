import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
  const location = useLocation()
  const navigate = useNavigate()
  const onLanding = location.pathname === '/'

  // These links only find their target element on the Landing page — from
  // /legal a bare #swap href would silently do nothing (no such element on
  // that page), same issue fixed in Header's BUY button. Route home with
  // the hash instead when elsewhere.
  function handleClick(e: React.MouseEvent, href: string) {
    setOpen(false)
    if (!onLanding) {
      e.preventDefault()
      navigate(`/${href}`)
    }
  }

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
          {/* On mobile this button sits mid-header (logo+wordmark to its
              left, wallet/BUY buttons to its right), not flush against the
              right edge — confirmed live at 390px that right-0 pushed the
              200px panel left past x=0 and off-screen. Anchoring to the
              button's own left edge instead keeps it under the button on
              narrow screens; sm+ has enough room to the left of the button
              for the original right-aligned panel to sit cleanly under the
              whole button/link/wallet/BUY cluster like before. */}
          <div className="absolute left-0 top-[46px] z-50 w-[200px] overflow-hidden rounded-xl border border-line-strong bg-panel shadow-[0_16px_40px_rgba(0,0,0,.5)] sm:left-auto sm:right-0">
            {LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleClick(e, link.href)}
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
