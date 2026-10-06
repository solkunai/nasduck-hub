import { FINE_PRINT_ITEMS, REAL_RARITY } from '../../lib/mint/config'

interface ModalShellProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function ModalShell({ title, onClose, children }: ModalShellProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#02060E]/85 p-2.5 min-[700px]:p-4" onClick={onClose}>
      <div
        className="w-full animate-mintPop border-4 border-[#5A4A30] p-4 [background:linear-gradient(180deg,#E6D7B5,#C7B289)]"
        style={{ maxWidth: 1100 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="m-0 font-silkscreen text-[28px] font-bold text-[#3B2F1E]">{title}</h2>
          <button type="button" onClick={onClose} className="font-pixelify text-[20px] text-[#3B2F1E]">
            CLOSE ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function RarityModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="RARITY BOOK" onClose={onClose}>
      <div className="space-y-2.5 bg-[#02060E] p-4">
        {REAL_RARITY.map((r) => (
          <div key={r.tier} className="flex items-center gap-3 font-terminal text-[21px]">
            <div className="w-[96px] min-[700px]:w-[110px]" style={{ color: r.color }}>{r.tier}</div>
            <div className="h-5 flex-1 bg-[#0B1220]">
              <div
                className="h-full"
                style={{ width: r.pct, background: `repeating-linear-gradient(90deg, ${r.color} 0 8px, transparent 8px 10px)` }}
              />
            </div>
            <div className="w-[56px] text-right text-[#C9D3E3] min-[700px]:w-16">{r.count.toLocaleString()}</div>
          </div>
        ))}
      </div>
      <p className="mt-4 font-terminal text-[16px] text-[#3B2F1E]/80">
        5 true 1-of-1s are hiding in the mint — Alien Duck, Blacistheneworange, Duck Ghost, Ducky Wonka, and Pepe Duck. The rarest ranks in the whole collection.
      </p>
    </ModalShell>
  )
}

export function FinePrintModal({ onClose }: { onClose: () => void }) {
  return (
    <ModalShell title="FINE PRINT" onClose={onClose}>
      {/* Fixed column count (not auto-fit) so the 6 items never leave an
          orphaned last cell wrapping alone with an ugly empty gap next to
          it — 1 column stacked on mobile, two clean rows of 3 on desktop. */}
      <div className="grid grid-cols-1 gap-[3px] bg-[#5A4A30] min-[700px]:grid-cols-3">
        {FINE_PRINT_ITEMS.map(([label, body]) => (
          <div key={label} className="bg-[#02060E] p-3.5 font-terminal min-[700px]:p-5">
            <div className="text-[24px] text-[#F5911E] min-[700px]:text-[20px]">{label}</div>
            <div className="text-[19px] leading-[1.25] text-[#C9D3E3] min-[700px]:text-[17px]">{body}</div>
          </div>
        ))}
      </div>
      <p className="mt-2.5 text-center font-terminal text-[20px] text-[#3B2F1E]">
        QUACK RESPONSIBLY. NasDucks are collectibles, not financial advice. The advisor is a duck.
      </p>
    </ModalShell>
  )
}
