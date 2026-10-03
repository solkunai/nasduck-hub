import { useState, type ReactNode } from 'react'
import type { MintStage } from '../../hooks/useMintFlow'
import { formatNumber } from '../../lib/format'
import { MINT_LIVE } from '../../lib/mint/config'

interface TradingFloorProps {
  walletShort: string
  stage: MintStage
  minted: number
  mintedStr: string
  mintedPct: string
  usdPricePerMint: number
  nasduckPerMint: number
  priceLive: boolean
  qty: number
  dec: () => void
  inc: () => void
  setMaxQty: () => void
  onMint: () => void
  onLogout: () => void
}

export function TradingFloor({
  walletShort,
  stage,
  minted,
  mintedStr,
  mintedPct,
  usdPricePerMint,
  nasduckPerMint,
  priceLive,
  qty,
  dec,
  inc,
  setMaxQty,
  onMint,
  onLogout,
}: TradingFloorProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const totalTokens = Math.round(qty * nasduckPerMint)
  const totalUsd = qty * usdPricePerMint

  // Pixelify Sans's "5" glyph renders almost identical to "S" (confirmed by
  // rendering it in isolation — "$5.00" reads as "$S.OO" at this size), so
  // the price specifically needs VT323 instead — this project's own
  // established font for numeric/data display, same reasoning as the ticker
  // and stat boxes elsewhere on this page.
  let ctaLabel: ReactNode = (
    <>
      BUY {qty} NDUCK · <span className="font-terminal">${totalUsd.toFixed(2)}</span> IN $NASDUCK
    </>
  )
  let ctaBg = '#F5911E'
  let ctaFg = '#02060E'
  if (stage === 'signing') {
    ctaLabel = 'SIGN IN WALLET…'
    ctaBg = '#0B1220'
    ctaFg = '#F5911E'
  } else if (stage === 'settling') {
    ctaLabel = 'SETTLING ON SOLANA…'
    ctaBg = '#0B1220'
    ctaFg = '#6FBE44'
  } else if (!MINT_LIVE) {
    ctaLabel = 'MINT OPENS SOON'
    ctaBg = '#0B1220'
    ctaFg = '#7E97BD'
  }

  return (
    <div>
      <h2 className="m-0 font-pixelify text-[30px] font-bold text-[#F7E7C1]">TRADING FLOOR</h2>

      <div className="mt-3 flex items-center gap-3 border-[3px] border-[#02060E] bg-[#F7E7C1] p-2.5 [box-shadow:4px_4px_0_#0B1220]">
        <img src="/mint/badge_photo.jpg" alt="" className="h-14 w-14 shrink-0 border-2 border-[#02060E] object-cover object-[50%_25%]" />
        <div className="flex-1 font-terminal text-[15px] leading-tight text-[#3B2F1E]">
          <div>WALLET: {walletShort}</div>
          <div>BALANCE: — SOL · — $NASDUCK</div>
          <div className="text-[#2E6B1E]">CLEARED TO MINT</div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingLogout(true)}
          className="border-[3px] border-[#F7E7C1] bg-[#0F5A3A] px-3 py-1 font-pixelify text-[14px] font-bold text-[#F7E7C1] outline outline-2 outline-[#0F5A3A] [box-shadow:4px_4px_0_#02060E] hover:bg-[#F7E7C1] hover:text-[#0F5A3A]"
        >
          CLOCK OUT
        </button>
      </div>

      {confirmingLogout && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#02060E]/80 p-4"
          onClick={() => setConfirmingLogout(false)}
        >
          <div
            className="w-full max-w-[380px] animate-mintPop border-4 border-[#5A4A30] p-5 text-center [background:linear-gradient(180deg,#E6D7B5,#C7B289)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-silkscreen text-[22px] font-bold text-[#3B2F1E]">CLOCK OUT?</div>
            <p className="mt-2 font-terminal text-[18px] text-[#3B2F1E]">Are you sure you want to disconnect your wallet?</p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmingLogout(false)}
                className="flex-1 border-2 border-[#3B2F1E] py-2 font-pixelify text-[15px] font-bold text-[#3B2F1E]"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingLogout(false)
                  onLogout()
                }}
                className="flex-1 bg-[#FF5A4E] py-2 font-pixelify text-[15px] font-bold text-[#02060E]"
              >
                YES, DISCONNECT
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 border-2 border-[#1F6B3A] bg-[#02060E] p-3">
        <div className="mb-2 flex items-center justify-between font-terminal text-[16px]">
          <span className="text-[#C9D3E3]">MINTED · {mintedStr} / 4,444 ({mintedPct})</span>
        </div>
        <div className="h-6 w-full bg-[#0B1220]">
          <div
            className="h-full [background:repeating-linear-gradient(90deg,#F5911E_0_8px,transparent_8px_10px)] [filter:drop-shadow(0_0_4px_#F5911E)] transition-[width] duration-500"
            style={{ width: `${(minted / 4444) * 100}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-px bg-[#1B2F52] text-center font-terminal text-[14px]">
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">PRICE</div>
          <div className="text-[20px] text-[#F0E4CC]">${usdPricePerMint.toFixed(2)}</div>
          <div className="text-[11px] text-[#5E7699]">
            {priceLive ? `≈ ${formatNumber(Math.round(nasduckPerMint))} $NASDUCK` : 'pricing…'}
          </div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">PER WALLET</div>
          <div className="text-[20px] text-[#6FBE44]">NO LIMIT</div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">ELIGIBLE</div>
          <div className="text-[20px] text-[#6FBE44]">YES</div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={dec}
          className="h-11 w-11 border-2 border-[#1F6B3A] bg-[#0B1220] font-pixelify text-[22px] text-[#F7E7C1]"
        >
          −
        </button>
        <div className="text-center">
          <div className="font-terminal text-[48px] leading-none text-[#F5911E]">{qty}</div>
          <div className="font-terminal text-[13px] text-[#7E97BD]">SHARES OF DUCK</div>
        </div>
        <button
          type="button"
          onClick={inc}
          className="h-11 w-11 border-2 border-[#1F6B3A] bg-[#0B1220] font-pixelify text-[22px] text-[#F7E7C1]"
        >
          +
        </button>
        <button
          type="button"
          onClick={setMaxQty}
          className="border-2 border-[#F5911E] px-3 py-1.5 font-terminal text-[14px] text-[#F5911E]"
        >
          MAX
        </button>
      </div>

      <div className="mt-4 text-center">
        <div className="font-terminal text-[13px] text-[#7E97BD]">ORDER TOTAL · ${totalUsd.toFixed(2)}</div>
        <div className="font-terminal text-[38px] text-[#F0E4CC]">{formatNumber(totalTokens)} $NASDUCK</div>
      </div>

      <button
        type="button"
        onClick={onMint}
        disabled={stage !== 'idle' || !MINT_LIVE}
        className="mt-4 w-full py-4 font-pixelify text-[26px] font-bold"
        style={{ background: ctaBg, color: ctaFg }}
      >
        {ctaLabel}
      </button>

      <div className="mt-2 text-center font-terminal text-[13px] text-[#5E7699]">
        Only mint from this page. The duck will never DM you a link.
      </div>
    </div>
  )
}
