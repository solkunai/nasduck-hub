import { Fragment, useState } from 'react'
import type { GateState } from '../../hooks/useMintFlow'
import { MINT_DETAILS } from '../../lib/mint/config'

interface FloorPassProps {
  gate: GateState
  connected: boolean
  onSwipe: () => void
  mintedStr: string
  remainingStr: string
}

// State A of the mint terminal — shown before a wallet is connected. The
// "floor pass + card reader" ritual is purely cosmetic theming around a real
// wallet connect click (see useMintFlow.badgeIn).
export function FloorPass({ gate, connected, onSwipe, mintedStr, remainingStr }: FloorPassProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const reading = gate === 'reading'
  const failed = gate === 'failed'
  const granted = gate === 'granted' || connected
  const photoRevealed = granted
  const readerColor = granted ? '#6FBE44' : reading ? '#F5911E' : '#FF5A4E'
  const readerMsg = granted
    ? 'ACCESS GRANTED · WELCOME TO THE FLOOR'
    : reading
      ? 'READING PHANTOM BADGE…'
      : failed
        ? 'CONNECTION FAILED · CLICK TO TRY AGAIN'
        : 'READER LOCKED · CLICK TO CONNECT WALLET'
  const clearance = granted ? 'APPROVED ✓' : reading ? 'CHECKING…' : failed ? 'DENIED ✕' : 'PENDING'
  const clearColor = granted ? '#2E6B1E' : failed ? '#FF5A4E' : '#B5530A'

  return (
    <div>
      <h2 className="m-0 font-silkscreen text-[28px] font-bold text-[#F7E7C1]">FLOOR ACCESS</h2>
      <p className="mb-4 mt-1 text-center font-terminal text-[19px] font-bold text-white">Sign in with your wallet to reach the IPO desk.</p>

      <button
        type="button"
        onClick={onSwipe}
        className="flex w-full flex-col items-center gap-3 border-0 bg-transparent p-0"
      >
        <div
          className="relative w-full max-w-[340px] overflow-hidden border-[3px] border-[#02060E] bg-[#F7E7C1] [box-shadow:5px_5px_0_#0B1220]"
          style={{ animation: reading ? 'mintSwipe 1.5s ease-in-out' : 'none' }}
        >
          <div className="relative mx-auto mt-[14px] h-1.5 w-[22px] rounded border-2 border-[#3A4A66] bg-[#02060E]" />
          <div className="flex items-end justify-between bg-[#F5911E] px-3 pb-1.5 pt-3.5 font-terminal text-[17px] text-[#02060E]">
            <span className="font-silkscreen text-[14px] font-bold">NASDUCK SECURITIES</span>
            <span>FLOOR PASS</span>
          </div>
          <div className="flex gap-3 p-3">
            <div className="relative h-[96px] w-[84px] shrink-0 overflow-hidden border-2 border-[#02060E] bg-[#0E2140]">
              <img
                src="/mint/badge_photo.jpg"
                alt=""
                className="h-full w-full object-cover object-[50%_25%]"
                style={{ filter: photoRevealed ? 'none' : 'brightness(0) opacity(.55)' }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-[#02060E] text-center font-terminal text-[13px] text-[#F7E7C1]">
                {photoRevealed ? 'VERIFIED' : 'NO PHOTO'}
              </div>
            </div>
            <div className="grid flex-1 content-start gap-[3px] text-left font-terminal text-[#02060E]">
              <div>
                <div className="text-[13px] font-bold text-[#5A4A30]">TRADER</div>
                <div className="truncate text-[21px] leading-none">{granted ? 'YOU' : '???????'}</div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#5A4A30]">DESK</div>
                <div className="text-[21px] leading-none">PUBLIC FLOOR</div>
              </div>
              <div>
                <div className="text-[13px] font-bold text-[#5A4A30]">CLEARANCE</div>
                <div className="text-[21px] leading-none" style={{ color: clearColor }}>
                  {clearance}
                </div>
              </div>
            </div>
          </div>
          <div className="mx-3 mb-3 h-[22px] [background:repeating-linear-gradient(90deg,#02060E_0_2px,transparent_2px_4px,#02060E_4px_5px,transparent_5px_8px,#02060E_8px_11px,transparent_11px_12px)]" />
          {reading && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] animate-mintScan bg-[#6FBE44] [box-shadow:0_0_12px_#6FBE44]" />
          )}
          {granted && (
            <div className="pointer-events-none absolute right-3 top-[62px] animate-mintStamp border-[3px] border-[#2E6B1E] bg-[#F7E7C1]/85 px-2 py-1 text-center font-pixelify text-[20px] font-bold leading-none text-[#2E6B1E]">
              ACCESS<br />GRANTED
            </div>
          )}
        </div>

        <div className="relative flex h-[62px] w-full max-w-[340px] items-end justify-center border-2 border-[#3E2710] p-2 [background:linear-gradient(180deg,#C99459,#7A4E24)] [box-shadow:inset_0_10px_0_#4A2E12,inset_0_-2px_0_#E0B07A]">
          <div className="border-2 border-[#3E2710] bg-[#02060E] px-2 py-0.5 font-terminal text-[19px] [text-shadow:0_0_6px_currentColor]" style={{ color: readerColor }}>
            {readerMsg}
          </div>
        </div>
      </button>

      {/* Desktop: Mint Details now lives in its own full-width strip below
          both cards (see Mint.tsx) so Floor Access and Your Ducks can be
          matched-height boxes. Mobile (<700px) keeps it here as a tappable
          bar + bottom sheet — too cramped at phone widths otherwise, and
          there's no "symmetrical boxes" concern on a single-column stack. */}
      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="mt-5 flex items-center justify-between border border-[#3A4A66] bg-[#0B1220] px-3.5 py-2.5 font-terminal text-[22px] text-[#F7E7C1] min-[700px]:hidden"
      >
        <span>MINT DETAILS</span>
        <span className="text-[18px] text-[#8FA3C4]">SUPPLY · ROYALTIES · REVEAL · VERIFY ▸</span>
      </button>

      {detailsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#02060E]/70 min-[700px]:hidden"
          onClick={() => setDetailsOpen(false)}
        >
          <div
            className="w-full animate-mintSheetUp border-[3px] border-b-0 border-[#1F6B3A] bg-[#02060E] [background-image:radial-gradient(rgba(111,190,68,.08)_1px,transparent_1.5px)] [background-size:4px_4px] [box-shadow:0_0_0_4px_#15191E,0_0_50px_rgba(111,190,68,.3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b-2 border-[#1B2F52] px-4 py-3">
              <span className="font-silkscreen text-[20px] font-bold text-[#F7E7C1]">MINT DETAILS</span>
              <button type="button" onClick={() => setDetailsOpen(false)} className="font-terminal text-[22px] text-[#F7E7C1]">
                ✕
              </button>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 p-4 font-terminal text-[19px]">
              {MINT_DETAILS.map(([label, body]) => (
                <Fragment key={label}>
                  <div className="text-[#F5911E]">{label}</div>
                  <div className="text-[#C9D3E3]">{body}</div>
                </Fragment>
              ))}
            </div>
            <div className="p-4 pt-0">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="w-full bg-[#6FBE44] py-2.5 font-pixelify text-[18px] font-bold text-[#02060E]"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3 border-2 border-[#02060E] bg-[#FFC522] p-3 [box-shadow:4px_4px_0_#0B1220]">
        <div className="shrink-0 whitespace-nowrap font-pixelify text-[34px] font-bold leading-none text-[#02060E]">1 OF 1</div>
        <div className="min-w-0">
          <div className="font-silkscreen text-[19px] font-bold leading-tight text-[#02060E]">FIND A 1 OF 1 DUCK</div>
          <div className="font-terminal text-[17px] font-bold text-black">10 unique ducks are hiding in the pond. Any mint could pull a random one.</div>
        </div>
      </div>

      <div className="mt-3 text-center font-terminal text-[15px] font-bold text-white">
        {mintedStr} / 4,444 already on the floor · {remainingStr} seats left
      </div>
    </div>
  )
}
