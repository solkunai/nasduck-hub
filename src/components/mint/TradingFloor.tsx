import { useEffect, useState, type ReactNode } from 'react'
import type { useMintFlow } from '../../hooks/useMintFlow'
import { MINT_LIVE } from '../../lib/mint/config'

interface TradingFloorProps {
  walletShort: string
  m: ReturnType<typeof useMintFlow>
}

const usdStr = (v: number | null) => (v === null ? '' : `$${v.toFixed(2)}`)

// Live m:ss until the given time; the hook re-checks the desks right after.
function HoldCountdown({ until }: { until: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const s = Math.max(0, Math.ceil((until - now) / 1000))
  return <>{s > 0 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'any second'}</>
}

export function TradingFloor({ walletShort, m }: TradingFloorProps) {
  const [confirmingLogout, setConfirmingLogout] = useState(false)
  const { stage, qty, dec, inc, setMaxQty, resetQty, setQtyCustom, onMint, logout: onLogout } = m
  const ready = MINT_LIVE && stage === 'idle' && !m.blockedReason

  // Pixelify Sans's "5" glyph renders almost identical to "S" (confirmed by
  // rendering it in isolation — "$5.00" reads as "$S.OO" at this size), so
  // the numbers specifically need VT323 instead — this project's own
  // established font for numeric/data display, same reasoning as the ticker
  // and stat boxes elsewhere on this page.
  let ctaLabel: ReactNode = (
    <>
      BUY {qty} {qty === 1 ? 'DUCK' : 'DUCKS'} ·<span className="font-terminal">{m.totalTokensStr}</span> $NASDUCK
    </>
  )
  let ctaBg = '#F5911E'
  let ctaFg = '#02060E'
  if (stage === 'preparing') {
    ctaLabel = m.progress ? `PREPARING · ${m.progress}` : 'PREPARING ORDER…'
    ctaBg = '#0B1220'
    ctaFg = '#F5911E'
  } else if (stage === 'authorizing') {
    ctaLabel = 'VERIFY OTC DESK IN WALLET…'
    ctaBg = '#0B1220'
    ctaFg = '#F5911E'
  } else if (stage === 'signing') {
    ctaLabel = m.progress ? `SIGN IN WALLET · ${m.progress}` : 'SIGN IN WALLET…'
    ctaBg = '#0B1220'
    ctaFg = '#F5911E'
  } else if (stage === 'settling') {
    ctaLabel = m.progress ? `SETTLING · ${m.progress}` : 'SETTLING ON SOLANA…'
    ctaBg = '#0B1220'
    ctaFg = '#F5911E'
  } else if (!MINT_LIVE) {
    ctaLabel = 'MINT OPENS SOON'
    ctaBg = '#0B1220'
    ctaFg = '#7E97BD'
  } else if (m.blockedReason) {
    ctaLabel = m.blockedReason
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
          <div>BALANCE: {m.balanceLabel}</div>
          <div className="text-[#B4600C]">CLEARED TO MINT</div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmingLogout(true)}
          className="border-[3px] border-[#F7E7C1] bg-[#A0520C] px-3 py-1 font-pixelify text-[14px] font-bold text-[#F7E7C1] outline outline-2 outline-[#A0520C] [box-shadow:4px_4px_0_#02060E] hover:bg-[#F7E7C1] hover:text-[#A0520C]"
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

      <div className="mt-4 border-2 border-[#A0520C] bg-[#02060E] p-3">
        <div className="mb-2 flex items-center justify-between font-terminal text-[16px]">
          <span className="text-white">MINTED · {m.mintedStr} / {m.supplyStr} ({m.mintedPct})</span>
        </div>
        <div className="h-6 w-full bg-[#0B1220]">
          <div
            className="mint-progress-fill h-full transition-[width] duration-500"
            style={{ width: m.mintedPct }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-px bg-[#1B2F52] text-center font-terminal text-[14px]">
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">PRICE</div>
          <div className="text-[20px] text-[#F0E4CC]">{m.publicPriceUsd !== null ? usdStr(m.publicPriceUsd) : '—'}</div>
          <div className="text-[15px] leading-tight text-white">
            {m.publicPriceTokens > 0 ? `${Math.round(m.publicPriceTokens).toLocaleString('en-US')} $NASDUCK` : 'pricing…'}
          </div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">PER WALLET</div>
          <div className="text-[20px] text-[#F5911E]">NO LIMIT</div>
        </div>
        <div className="bg-[#0B1220] p-2.5">
          <div className="text-[#F0E4CC]">OTC DESKS</div>
          {m.otcOpen ? (
            <>
              <div className={`text-[20px] ${m.otcAvailable > 0 ? 'text-[#F5911E]' : 'text-[#F0E4CC]'}`}>{m.otcAvailable}</div>
              <div className="text-[15px] leading-tight text-white">
                {m.otcAvailable > 0 ? `discounted at ${Math.round(m.otcPriceTokens).toLocaleString('en-US')} each` : m.desksHeld > 0 ? 'discounts used' : 'none held'}
              </div>
              {m.desksOnHold > 0 && m.holdUntil && stage === 'idle' && (
                <div className="text-[11px] text-[#F5911E]">
                  {m.desksOnHold} on hold · back in <HoldCountdown until={m.holdUntil} />
                </div>
              )}
            </>
          ) : (
            <div className="text-[20px] text-[#F0E4CC]">—</div>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-center gap-5">
        <button
          type="button"
          onClick={dec}
          className="h-11 w-11 font-pixelify text-[22px] font-bold text-[#F7E7C1]"
          style={{
            borderImageSource: 'url(/mint/qty_btn_frame.png)',
            borderImageSlice: '125 125 125 125',
            borderImageWidth: '8px',
            borderImageRepeat: 'stretch',
            borderStyle: 'solid',
            borderWidth: '8px',
          }}
        >
          −
        </button>
        <div className="text-center">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={qty}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '')
              if (digits === '') return
              setQtyCustom(Number(digits))
            }}
            className="w-[110px] bg-transparent text-center font-terminal text-[48px] leading-none text-white outline-none"
          />
          <div className="font-terminal text-[13px] text-white">SHARES OF DUCK</div>
        </div>
        <button
          type="button"
          onClick={inc}
          className="h-11 w-11 font-pixelify text-[22px] font-bold text-[#F7E7C1]"
          style={{
            borderImageSource: 'url(/mint/qty_btn_frame.png)',
            borderImageSlice: '125 125 125 125',
            borderImageWidth: '8px',
            borderImageRepeat: 'stretch',
            borderStyle: 'solid',
            borderWidth: '8px',
          }}
        >
          +
        </button>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={setMaxQty}
            className="border-2 border-[#F5911E] px-3 py-1 font-terminal text-[16px] text-white"
          >
            MAX
          </button>
          <button
            type="button"
            onClick={resetQty}
            disabled={qty === 1}
            className="border-2 border-[#2E5590] px-3 py-1 font-terminal text-[16px] text-white disabled:opacity-40"
          >
            RESET
          </button>
        </div>
      </div>

      <div className="mt-4 text-center">
        <div className="font-terminal text-[13px] text-white">
          ORDER TOTAL{m.totalUsd !== null ? ` · ${usdStr(m.totalUsd)}` : ''}
        </div>
        <div className="font-terminal text-[38px] text-[#F0E4CC]">≈ {m.totalTokensStr} $NASDUCK</div>
        <div className="font-terminal text-[16px] text-white [text-shadow:0_0_6px_rgba(255,255,255,.25)]">LIVE PRICE · EXACT AMOUNT SHOWN IN YOUR WALLET</div>
        {m.otcQty > 0 && (
          <div className="font-terminal text-[13px] text-[#F5911E]">
            {m.otcQty} AT OTC DESK PRICE{m.publicQty > 0 ? ` · ${m.publicQty} AT FULL PRICE` : ''}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onMint}
        disabled={!ready}
        aria-busy={stage !== 'idle'}
        // Presses down 3px on click, like a physical button.
        className="mt-4 flex w-full items-center justify-center gap-3 py-4 font-pixelify text-[26px] font-bold [box-shadow:0_4px_0_#02060E] enabled:active:translate-y-[3px] enabled:active:[box-shadow:0_1px_0_#02060E]"
        style={{ background: ctaBg, color: ctaFg }}
      >
        {stage !== 'idle' && <span aria-hidden className="inline-block h-5 w-5 shrink-0 animate-spin rounded-full border-[3px] border-[#F5911E] border-t-transparent" />}
        <span>{ctaLabel}</span>
      </button>

      {m.mintError && (
        <div role="alert" className="mt-2 border-2 border-[#FF5A4E] bg-[#02060E] p-2 text-center font-terminal text-[15px] text-[#FF5A4E]">
          {m.mintError}
        </div>
      )}

      <div className="mt-3 text-center font-terminal text-[16px] text-white">
        Only mint from this page. The duck will never DM you a link.
      </div>
      <div className="mt-1 text-center font-terminal text-[16px] text-white">
        Non-custodial: you approve everything in your own wallet. We never hold your funds or NFTs.
      </div>
    </div>
  )
}
