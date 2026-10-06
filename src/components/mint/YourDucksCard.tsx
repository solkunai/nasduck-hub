import type { MintedDuck } from '../../hooks/useMintFlow'
import { DuckStrip } from './DuckStrip'
import { buildFlexTweet } from '../../lib/mint/config'
import { openTweetIntent } from '../../lib/share'
import { PixelXLogo } from './PixelXLogo'

interface YourDucksCardProps {
  mine: MintedDuck[]
  sel: number
  onSelect: (i: number) => void
  /** Opens the full card (traits etc.) for a duck. */
  onOpen: (i: number) => void
}

export function YourDucksCard({ mine, sel, onSelect, onOpen }: YourDucksCardProps) {
  const hasDucks = mine.length > 0
  const latest = mine[sel]

  return (
    <div
      className="flex w-full min-w-0 flex-1 flex-col p-4 sm:min-w-[340px] min-[700px]:p-6 [box-shadow:0_30px_60px_rgba(0,0,0,.6)]"
      style={{
        borderImageSource: 'url(/mint/your_ducks_frame.png)',
        borderImageSlice: '100 150 100 150',
        borderImageWidth: '32px',
        borderImageRepeat: 'stretch',
        borderStyle: 'solid',
        borderWidth: '32px',
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div className="font-pixelify text-[22px] font-bold text-white">YOUR DUCKS</div>
        <div className="font-terminal text-[20px] text-[#F7E7C1]">{mine.length} HELD</div>
      </div>

      {!hasDucks ? (
        <div className="relative min-h-[200px] w-full flex-1 overflow-hidden border-2 border-[#02060E] bg-[#9FC1D4]">
          <img
            src="/mint/duck_minted.png"
            alt=""
            className="h-full w-full object-cover [filter:brightness(0)_opacity(.55)] [image-rendering:pixelated]"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <div className="font-pixelify text-[80px] text-[#02060E]">???</div>
            <div className="bg-[#02060E] px-3 py-1 font-terminal text-[22px] text-white">UNREVEALED · MINT TO REVEAL</div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <button
            type="button"
            onClick={() => onOpen(sel)}
            aria-label={`View NASDUCK ${latest.id} traits`}
            className="relative block aspect-square w-full cursor-pointer overflow-hidden border-2 border-[#02060E]"
          >
            <img src={latest.image} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
            <div className="absolute left-2 top-2 bg-[#F7E7C1] px-2 py-1 font-pixelify text-[13px] text-[#081428] [box-shadow:2px_2px_0_#02060E]">
              NASDUCK {latest.id}
            </div>
            <div
              className="absolute right-2 top-2 px-2 py-1 font-terminal text-[14px] [box-shadow:2px_2px_0_#02060E]"
              style={{ background: '#02060E', color: latest.frame }}
            >
              {latest.rarity}
            </div>
            <div className="absolute bottom-2 left-2 bg-[#02060E]/85 px-2 py-1 font-terminal text-[13px] text-[#F5911E]">▲ JUST LISTED</div>
            <div className="absolute bottom-2 right-2 bg-[#02060E]/85 px-2 py-1 font-terminal text-[13px] text-[#F7E7C1]">TAP FOR TRAITS</div>
          </button>

          {mine.length > 1 && (
            <div className="mt-2">
              <DuckStrip
                ducks={mine}
                selected={sel}
                onPick={(i) => {
                  onSelect(i)
                  onOpen(i)
                }}
              />
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              aria-label="Flex on X"
              onClick={() => openTweetIntent(buildFlexTweet(latest.id))}
              className="flex-1 bg-[#F5911E] py-3 font-pixelify text-[clamp(20px,2.2vw,24px)] font-bold tracking-[.06em] text-[#02060E] [box-shadow:0_4px_0_#02060E] active:translate-y-[3px] active:[box-shadow:0_1px_0_#02060E]"
            >
              <span className="inline-flex items-center justify-center gap-2">FLEX ON <PixelXLogo size={28} /></span>
            </button>
          </div>
        </div>
      )}

      <img
        src="/mint/one_of_one_banner.png"
        alt="Find a 1 of 1 duck — 5 true 1-of-1s are hiding in the mint."
        className="mx-auto mt-2.5 block w-full max-w-[280px] [image-rendering:pixelated]"
      />
    </div>
  )
}
