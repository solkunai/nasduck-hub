import { useEffect, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useClickerGame } from '../hooks/useClickerGame'
import { shortenAddress, formatNumber } from '../lib/format'

// A fresh Audio instance per click, not one shared/reused element — lets
// rapid clicks overlap into a little chorus of quacks instead of each click
// cutting the previous one off mid-sound, which is what reusing a single
// <audio> element would do.
function playQuack() {
  const audio = new Audio('/sfx/quack.mp3')
  audio.volume = 0.5
  audio.play().catch(() => {
    // Autoplay restrictions don't apply here (this only ever fires from a
    // real click), but browsers can still occasionally reject playback for
    // other reasons — a missed quack isn't worth surfacing as an error.
  })
}

export function ClickerGame() {
  const { publicKey, connected } = useWallet()
  const wallet = publicKey?.toBase58() ?? null
  const { score, leaders, feed } = useClickerGame(wallet)
  const [open, setOpen] = useState(false)
  const [pressed, setPressed] = useState(false)

  // Landing.tsx's hash-scroll effect gets a visitor to this section, but a
  // collapsed accordion at the end of that scroll reads as broken — auto-
  // open when arriving via the nav menu's "TAP THE DUCK" link specifically.
  // Checking the hash once on mount only covers a fresh page load that
  // already has the hash in the URL — confirmed live that it does NOT fire
  // for the far more common case of clicking the nav link while already on
  // the page (a same-page anchor click doesn't remount this component, so
  // a mount-only effect never re-runs) — a 'hashchange' listener covers
  // both cases with one check.
  useEffect(() => {
    function checkHash() {
      if (window.location.hash === '#tap-the-duck') setOpen(true)
    }
    checkHash()
    window.addEventListener('hashchange', checkHash)
    return () => window.removeEventListener('hashchange', checkHash)
  }, [])

  return (
    <div id="tap-the-duck" className="mx-auto max-w-[1240px] scroll-mt-[110px] px-5 pb-9">
      <div className="overflow-hidden rounded-2xl border border-line bg-panel-deep">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-3.5 px-[18px] py-[15px] text-left hover:bg-panel"
        >
          <img src="/mascot/nasduck-clicker.png" alt="" className="h-7 w-7 object-contain" />
          <div className="font-mono text-[13px] tracking-wide text-ink-secondary">
            FEED THE DUCK <span className="text-ink-dim">/ break-room minigame</span>
          </div>
          <div className="flex-1" />
          <div className="font-mono text-[11px] text-ink-faint">{open ? 'HIDE −' : 'OPEN +'}</div>
        </button>

        {open && (
          <div className="grid gap-5 border-t border-line px-[18px] py-5 [grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={() => {
                  feed()
                  playQuack()
                  setPressed(true)
                  setTimeout(() => setPressed(false), 100)
                }}
                className={`flex h-[150px] w-[150px] select-none items-center justify-center rounded-full border border-line-strong bg-panel transition-transform hover:border-brand ${pressed ? 'scale-95' : ''}`}
              >
                <img src="/mascot/nasduck-clicker.png" alt="feed the duck" className="pointer-events-none h-[85%] w-[85%] object-contain" />
              </button>
              <div className="font-mono text-[11px] text-ink-faint">
                CLICK TO FEED · {score > 60 ? 'he is full, keep going' : 'he is hungry'}
              </div>
              <div className="font-display text-[34px] text-brand">{formatNumber(score)}</div>
              {!connected && <div className="font-mono text-[10.5px] text-ink-dim">connect a wallet to save your score</div>}
            </div>

            <div className="min-w-0">
              <div className="mb-2.5 font-mono text-[10px] tracking-wide text-ink-faint">TOP CLICKERS · ALL TIME</div>
              {leaders.length === 0 ? (
                <div className="py-4 font-mono text-xs text-ink-faint">nobody's fed the duck yet</div>
              ) : (
                leaders.map((l, i) => (
                  <div
                    key={l.wallet}
                    className="grid grid-cols-[26px_minmax(0,1fr)_auto] gap-2.5 border-b border-line-subtle py-2 font-mono text-xs"
                  >
                    <div className="text-ink-faint">{i + 1}</div>
                    <div
                      className={`overflow-hidden text-ellipsis whitespace-nowrap ${l.wallet === wallet ? 'text-brand' : 'text-ink-secondary'}`}
                    >
                      {l.wallet === wallet ? 'YOU' : shortenAddress(l.wallet)}
                    </div>
                    <div className="text-ink-muted">{formatNumber(l.score)}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
