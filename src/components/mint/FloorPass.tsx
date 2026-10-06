import { Fragment, useState } from 'react'
import type { GateState } from '../../hooks/useMintFlow'
import { MINT_DETAILS } from '../../lib/mint/config'

interface FloorPassProps {
  gate: GateState
  connected: boolean
  onSwipe: () => void
  mintedStr: string
  supplyStr: string
  remainingStr: string
}

// State A of the mint terminal — shown before a wallet is connected. The
// "floor pass + card reader" ritual is purely cosmetic theming around a real
// wallet connect click (see useMintFlow.badgeIn).
export function FloorPass({ gate, connected, onSwipe, mintedStr, supplyStr, remainingStr }: FloorPassProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const reading = gate === 'reading'
  const failed = gate === 'failed'
  const granted = gate === 'granted' || connected
  const photoRevealed = granted
  const readerColor = granted ? '#F5911E' : reading ? '#F5911E' : failed ? '#FF5A4E' : '#F5911E'
  const readerMsg = granted
    ? 'ACCESS GRANTED · WELCOME TO THE FLOOR'
    : reading
      ? 'READING PHANTOM BADGE…'
      : failed
        ? 'CONNECTION FAILED · CLICK TO TRY AGAIN'
        : 'READER LOCKED · CLICK TO CONNECT WALLET'
  const clearance = granted ? 'APPROVED ✓' : reading ? 'CHECKING…' : failed ? 'DENIED ✕' : 'PENDING'
  const clearColor = granted ? '#B4600C' : failed ? '#FF5A4E' : '#B5530A'

  return (
    <div>
      <h2 className="m-0 text-center font-silkscreen text-[28px] font-bold text-[#F5911E]">FLOOR ACCESS</h2>
      <p className="mb-4 mt-1 text-center font-terminal text-[22px] font-bold text-white">Sign in with your wallet to reach the IPO desk.</p>

      <div className="border-2 border-[#1B2F52] bg-[#0B1220] p-3 [box-shadow:4px_4px_0_#0B1220]">
      <button
        type="button"
        onClick={onSwipe}
        className="flex w-full flex-col items-center gap-7 border-0 bg-transparent p-0"
      >
        <div
          className="relative mx-auto aspect-[1691/930] w-full max-w-[620px] overflow-hidden"
          style={{ animation: reading ? 'mintSwipe 1.5s ease-in-out' : 'none' }}
        >
          <img src="/mint/badge_template.png" alt="" className="absolute inset-0 h-full w-full object-cover [image-rendering:pixelated]" />

          <div className="absolute overflow-hidden border border-[#02060E]/40 bg-[#0E2140]" style={{ left: '11.4%', top: '31.7%', width: '22.5%', height: '41.1%' }}>
            <img
              src="/mint/badge_photo.jpg"
              alt=""
              className="h-full w-full object-cover object-[50%_25%]"
              style={{ filter: photoRevealed ? 'none' : 'brightness(0) opacity(.55)' }}
            />
            <div
              className="absolute inset-x-0 bottom-0 bg-[#02060E] text-center font-terminal leading-tight text-[#F7E7C1]"
              style={{ fontSize: 'clamp(6px, 1.8vw, 10px)' }}
            >
              {photoRevealed ? 'VERIFIED' : 'NO PHOTO'}
            </div>
          </div>

          <div
            className="absolute flex items-center truncate px-1.5 font-terminal leading-none text-[#02060E]"
            style={{ left: '36.7%', top: '39.2%', width: '27.8%', height: '6.2%', fontSize: 'clamp(8px, 2.6vw, 15px)' }}
          >
            {granted ? 'YOU' : '???????'}
          </div>
          <div
            className="absolute flex items-center truncate px-1.5 font-terminal leading-none text-[#02060E]"
            style={{ left: '36.7%', top: '51.6%', width: '27.8%', height: '6.1%', fontSize: 'clamp(8px, 2.6vw, 15px)' }}
          >
            PUBLIC FLOOR
          </div>
          <div
            className="absolute flex items-center truncate px-1.5 font-terminal font-bold leading-none"
            style={{ left: '36.7%', top: '64.2%', width: '27.8%', height: '6.2%', color: clearColor, fontSize: 'clamp(8px, 2.6vw, 15px)' }}
          >
            {clearance}
          </div>

          {reading && (
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] animate-mintScan bg-[#F5911E] [box-shadow:0_0_12px_#F5911E]" />
          )}
          {granted && (
            <div className="pointer-events-none absolute right-3 top-[18%] animate-mintStamp border-[3px] border-[#B4600C] bg-[#F7E7C1]/85 px-2 py-1 text-center font-pixelify text-[16px] font-bold leading-none text-[#B4600C]">
              ACCESS<br />GRANTED
            </div>
          )}
        </div>

        {gate === 'idle' ? (
          <img
            src="/mint/connect_wallet_btn.png"
            alt="Connect wallet to mint"
            className="h-[55px] w-full max-w-[340px] [image-rendering:pixelated]"
          />
        ) : (
          <div className="relative flex h-[62px] w-full max-w-[340px] items-end justify-center border-2 border-[#3E2710] p-2 [background:linear-gradient(180deg,#C99459,#7A4E24)] [box-shadow:inset_0_10px_0_#4A2E12,inset_0_-2px_0_#E0B07A]">
            <div
              className="border-2 border-[#3E2710] bg-[#02060E] px-2 py-0.5 font-terminal text-[19px] [text-shadow:0_0_6px_currentColor]"
              style={{ color: readerColor }}
            >
              {readerMsg}
            </div>
          </div>
        )}
      </button>
      </div>

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
            className="w-full animate-mintSheetUp border-[3px] border-b-0 border-[#A0520C] bg-[#02060E] [background-image:radial-gradient(rgba(245,145,30,.08)_1px,transparent_1.5px)] [background-size:4px_4px] [box-shadow:0_0_0_4px_#15191E,0_0_50px_rgba(245,145,30,.3)]"
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
                className="w-full bg-[#F5911E] py-2.5 font-pixelify text-[18px] font-bold text-[#02060E]"
              >
                GOT IT
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-px bg-[#1B2F52] text-center font-terminal">
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[13px] text-[#8FA3C4]">TOTAL SUPPLY</div>
          <div className="text-[20px] font-bold text-white">{supplyStr}</div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[13px] text-[#8FA3C4]">MINTED</div>
          <div className="text-[20px] font-bold text-white">{mintedStr}</div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[13px] text-[#8FA3C4]">REMAINING</div>
          <div className="text-[20px] font-bold text-white">{remainingStr}</div>
        </div>
      </div>
    </div>
  )
}
