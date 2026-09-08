const ITEMS = [{ label: 'Fowl Play Tape', desc: 'live whale buy/sell feed' }]

// Last thing standing on this list — needs a Helius webhook listener that
// doesn't exist yet, unlike everything else in Phase 2 which only needed
// tables+RLS+storage. Shown here so the page is honest about what's coming.
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
