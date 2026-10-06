import type { MintedDuck } from '../../hooks/useMintFlow'
import { buildFlexTweet } from '../../lib/mint/config'
import { openTweetIntent } from '../../lib/share'

interface YourDucksCardProps {
  mine: MintedDuck[]
  sel: number
  onSelect: (i: number) => void
}

export function YourDucksCard({ mine, sel, onSelect }: YourDucksCardProps) {
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
          <div className="relative aspect-square w-full overflow-hidden border-2 border-[#02060E]">
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
            <div className="absolute bottom-2 left-2 bg-[#02060E]/85 px-2 py-1 font-terminal text-[13px] text-[#6FBE44]">▲ JUST LISTED</div>
          </div>

          {mine.length > 1 && (
            <div className="mt-2 grid grid-cols-4 gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(84px,1fr))' }}>
              {mine.map((d, i) => (
                <button
                  key={d.id + i}
                  type="button"
                  onClick={() => onSelect(i)}
                  className="aspect-square overflow-hidden border-2"
                  style={{ borderColor: i === sel ? '#F5911E' : '#3A4A66' }}
                >
                  <img src={d.image} alt="" className="h-full w-full object-cover [image-rendering:pixelated]" />
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex gap-2">
            <button type="button" className="flex-1 bg-[#02060E] py-2 font-terminal text-[14px] text-[#F7E7C1]">
              VIEW ON TENSOR ↗
            </button>
            <button
              type="button"
              onClick={() => openTweetIntent(buildFlexTweet(latest.id))}
              className="flex-1 bg-[#6FBE44] py-2 font-terminal text-[14px] text-[#02060E]"
            >
              FLEX ON X ↗
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
