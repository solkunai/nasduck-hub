const ITEMS = [
  { label: 'Fowl Play Tape', desc: 'live whale buy/sell feed' },
  { label: 'Top of Book', desc: 'holder leaderboard + diamond hands' },
  { label: 'The Meme Desk', desc: 'community meme wall' },
  { label: 'Feed the Duck', desc: 'clicker game + leaderboard' },
]

// Phase 2 needs a real backend (Helius webhooks, Supabase, storage) — see
// project notes. Shown here so the page is honest about what's coming rather
// than silently missing pieces we already scoped and agreed on.
export function ComingSoonStrip() {
  return (
    <div className="mx-auto max-w-[1240px] px-5 py-9">
      <div className="rounded-2xl border border-dashed border-line-strong bg-panel/40 p-6">
        <div className="mb-4 font-mono text-[11px] tracking-wide text-ink-faint">COMING NEXT TO THE DESK</div>
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
          {ITEMS.map((item) => (
            <div key={item.label}>
              <div className="font-display text-sm text-ink-secondary">{item.label}</div>
              <div className="mt-1 font-mono text-[11px] text-ink-faint">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
