import type { Receipt } from '../../hooks/useMintFlow'
import { formatNumber } from '../../lib/format'
import { buildFlexTweet } from '../../lib/mint/config'
import { openTweetIntent } from '../../lib/share'
import { MoneyRain } from './MoneyRain'

interface OrderFilledModalProps {
  receipt: Receipt
  recSel: number
  onSelect: (i: number) => void
  onClose: () => void
}

export function OrderFilledModal({ receipt, recSel, onSelect, onClose }: OrderFilledModalProps) {
  const current = receipt.items[recSel]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#02060E]/85 p-2.5 min-[700px]:p-4" onClick={onClose}>
      <MoneyRain count={40} big />
      <div
        className="relative w-full animate-mintPop border-4 border-[#5A4A30] p-3.5 [background:linear-gradient(180deg,#E6D7B5,#C7B289)] [box-shadow:0_0_60px_rgba(111,190,68,.35)]"
        style={{ maxWidth: 1100 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/mint/duck_minted.png" alt="" className="h-9 w-9 border-2 border-[#02060E] [image-rendering:pixelated]" />
            <h2 className="m-0 font-silkscreen text-[clamp(28px,4vw,44px)] font-bold text-[#2E6B1E]">ORDER FILLED</h2>
          </div>
          <button type="button" onClick={onClose} className="font-pixelify text-[20px] text-[#3B2F1E]">
            CLOSE ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="w-full min-w-0 flex-1 self-start min-[700px]:min-w-[380px]">
            <div className="relative aspect-square w-full overflow-hidden border-2 border-[#02060E]">
              <img src={current.image} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
              <div className="absolute left-2 top-2 bg-[#F7E7C1] px-2 py-1 font-pixelify text-[13px] text-[#081428] [box-shadow:2px_2px_0_#02060E]">
                NASDUCK {current.id}
              </div>
              <div className="absolute right-2 top-2 bg-[#02060E] px-2 py-1 font-terminal text-[14px]" style={{ color: current.frame }}>
                {current.rarity}
              </div>
              {current.rank > 0 && (
                <div className="absolute bottom-2 right-2 bg-[#02060E]/85 px-2 py-1 font-terminal text-[13px] text-[#F7E7C1]">
                  RANK #{current.rank} / 4,444
                </div>
              )}
            </div>

            {receipt.items.length > 1 && (
              <div>
                <div className="mb-1.5 mt-3 font-terminal text-[14px] text-[#3B2F1E]">THIS ORDER · {receipt.items.length} DUCKS</div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(70px,1fr))' }}>
                  {receipt.items.map((it, i) => (
                    <button
                      key={it.id + i}
                      type="button"
                      onClick={() => onSelect(i)}
                      className="aspect-square overflow-hidden border-2"
                      style={{ borderColor: i === recSel ? '#F5911E' : '#3A4A66' }}
                    >
                      <img src={it.image} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="w-full min-w-0 flex-1 bg-[#02060E] p-3.5 min-[700px]:min-w-[380px] min-[700px]:p-5">
            <p className="m-0 mb-4 font-terminal text-[18px] text-[#C9D3E3]">Welcome to the floor. Here's what you pulled.</p>

            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {current.attributes.map((t) => (
                <div key={t.trait_type} className="border border-[#1B2F52] p-2">
                  <div className="font-terminal text-[16px] text-[#5E7699]">{t.trait_type.toUpperCase()}</div>
                  <div className="font-terminal text-[22px] text-[#F7E7C1]">{t.value}</div>
                  <div className="font-terminal text-[15px] text-[#6FBE44]">
                    {t.trait_type === '1is1' ? '1 OF 1' : `${t.pct}% have this`}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1 font-terminal text-[16px] text-[#C9D3E3]">
              <div className="flex justify-between">
                <span>MINTED</span>
                <span>{receipt.qty}</span>
              </div>
              <div className="flex justify-between">
                <span>PRICE</span>
                <span>{formatNumber(Math.round(receipt.total / receipt.qty))} $NASDUCK each</span>
              </div>
              <div className="flex justify-between">
                <span>TOTAL</span>
                <span>{formatNumber(receipt.total)} $NASDUCK</span>
              </div>
              <div className="flex justify-between">
                <span>SEC REVIEW</span>
                <span className="text-[#FF5A4E]">SKIPPED</span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 border-2 border-[#1F6B3A] py-2.5 font-pixelify text-[15px] text-[#F7E7C1]">
                MINT MORE
              </button>
              <button
                type="button"
                onClick={() => openTweetIntent(buildFlexTweet(current.id))}
                className="flex-1 bg-[#6FBE44] py-2.5 font-pixelify text-[15px] text-[#02060E]"
              >
                FLEX ON X ↗
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
