import { useState } from 'react'
import type { MintedDuck, Receipt } from '../../hooks/useMintFlow'
import { formatNumber } from '../../lib/format'
import { buildFlexTweet, fmt, SUPPLY } from '../../lib/mint/config'
import { openTweetIntent } from '../../lib/share'
import { PixelXLogo } from './PixelXLogo'
import { DuckImage } from './DuckImage'
import { DuckStrip } from './DuckStrip'
import { MoneyRain } from './MoneyRain'

// '1is1' is the pre-rename trait name, still on the devnet test ducks.
const ONE_OF_ONE_TYPES = ['1 of 1', '1is1']
const TRAIT_SLOTS = ['Background', 'Skin', 'Body', 'Neck Accessory', 'Mouth', 'Hat', 'Eyes Accessory']

interface OrderFilledModalProps {
  items: MintedDuck[]
  /** Which duck to show first. */
  start?: number
  /** Present right after a mint (celebration + receipt); absent when
   *  re-opening a duck from Your Ducks. */
  receipt?: Receipt
  onClose: () => void
}

export function OrderFilledModal({ items, start = 0, receipt, onClose }: OrderFilledModalProps) {
  const [recSel, onSelect] = useState(start)
  const current = items[recSel]
  // 1-of-1s carry a single "1 of 1" trait on-chain. On this card, fill the
  // regular trait slots with the 1-of-1's name so it reads like any duck.
  const oneOfOne = current.attributes.find((a) => ONE_OF_ONE_TYPES.includes(a.trait_type))?.value ?? null
  const traits = oneOfOne
    ? [{ trait_type: '1 of 1', value: oneOfOne, pct: null }, ...TRAIT_SLOTS.map((slot) => ({ trait_type: slot, value: oneOfOne, pct: null }))]
    : current.attributes

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#02060E]/85 p-2.5 min-[700px]:p-4" onClick={onClose}>
      {receipt && <MoneyRain count={40} big />}
      <div
        className="relative w-full animate-mintPop border-4 border-[#5A4A30] p-3.5 [background:linear-gradient(180deg,#E6D7B5,#C7B289)] [box-shadow:0_0_60px_rgba(245,145,30,.35)]"
        style={{ maxWidth: 1100 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 shrink-0 overflow-hidden border-2 border-[#02060E]"><DuckImage src={current.image} small /></div>
            <h2 className="m-0 font-silkscreen text-[clamp(28px,4vw,44px)] font-bold text-[#B4600C]">{receipt ? 'ORDER FILLED' : `NASDUCK ${current.id}`}</h2>
          </div>
          <button type="button" onClick={onClose} className="font-pixelify text-[20px] text-[#3B2F1E]">
            CLOSE ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-5">
          <div className="w-full min-w-0 flex-1 self-start min-[700px]:min-w-[380px]">
            <div className="relative aspect-square w-full overflow-hidden border-2 border-[#02060E]">
              <DuckImage src={current.image} />
              <div className="absolute left-2 top-2 bg-[#F7E7C1] px-2 py-1 font-pixelify text-[13px] text-[#081428] [box-shadow:2px_2px_0_#02060E]">
                NASDUCK {current.id}
              </div>
              <div className="absolute right-2 top-2 bg-[#02060E] px-2 py-1 font-terminal text-[14px]" style={{ color: current.frame }}>
                {current.rarity}
              </div>
              {current.rank > 0 && (
                <div className="absolute bottom-2 right-2 bg-[#02060E]/85 px-2 py-1 font-terminal text-[13px] text-[#F7E7C1]">
                  RANK #{current.rank} / {fmt(SUPPLY)}
                </div>
              )}
            </div>

            {items.length > 1 && (
              <div>
                <div className="mb-1.5 mt-3 font-terminal text-[14px] text-[#3B2F1E]">
                  {receipt ? 'THIS ORDER' : 'YOUR DUCKS'} · {items.length} DUCKS
                </div>
                <DuckStrip ducks={items} selected={recSel} onPick={onSelect} size={70} />
              </div>
            )}
          </div>

          <div className="w-full min-w-0 flex-1 bg-[#03111E] p-3.5 min-[700px]:min-w-[380px] min-[700px]:p-5">
            <p className="m-0 mb-4 font-terminal text-[18px] text-[#C9D3E3]">{receipt ? "Welcome to the floor. Here's what you pulled." : 'Your duck, on the record.'}</p>

            <div className="mb-4 grid grid-cols-2 gap-2.5">
              {traits.map((t) => {
                const note = oneOfOne ? (t.trait_type === '1 of 1' ? null : '1 OF 1') : t.pct !== null ? `${t.pct}% have this` : null
                return (
                  <div key={t.trait_type} className="border border-[#2E5590] bg-[#0B1E36] p-2">
                    <div className="font-terminal text-[16px] text-[#5E7699]">{t.trait_type.toUpperCase()}</div>
                    <div className="font-terminal text-[22px] text-[#F7E7C1]">{t.value}</div>
                    {note && <div className="font-terminal text-[15px] text-[#F5911E]">{note}</div>}
                  </div>
                )
              })}
            </div>

            {receipt && (
              <div className="space-y-1 font-terminal text-[16px] text-[#C9D3E3]">
                <div className="flex justify-between">
                  <span>MINTED</span>
                  <span>{receipt.qty}</span>
                </div>
                {receipt.otcCount > 0 && (
                  <div className="flex justify-between">
                    <span>OTC DESK PRICE</span>
                    <span>{receipt.otcCount} × {formatNumber(receipt.otcEach)} $NASDUCK</span>
                  </div>
                )}
                {receipt.publicCount > 0 && (
                  <div className="flex justify-between">
                    <span>PRICE</span>
                    <span>{receipt.publicCount} × {formatNumber(receipt.publicEach)} $NASDUCK</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>TOTAL</span>
                  <span>{formatNumber(receipt.total)} $NASDUCK</span>
                </div>
                <div className="flex justify-between">
                  <span>SEC REVIEW</span>
                  <span className="text-[#FF5A4E]">SKIPPED</span>
                </div>
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button type="button" onClick={onClose} className="flex-1 border-2 border-[#A0520C] py-2.5 font-pixelify text-[15px] text-[#F7E7C1]">
                {receipt ? 'MINT MORE' : 'CLOSE'}
              </button>
              <button
                type="button"
                aria-label="Flex on X"
                onClick={() => openTweetIntent(buildFlexTweet(current.id))}
                className="flex-1 bg-[#F5911E] py-2.5 font-pixelify text-[15px] text-[#02060E]"
              >
                <span className="inline-flex items-center justify-center gap-2">FLEX ON <PixelXLogo size={28} /></span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
