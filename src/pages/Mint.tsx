import { useMintFlow } from '../hooks/useMintFlow'
import { MoneyRain } from '../components/mint/MoneyRain'
import { MintTicker } from '../components/mint/MintTicker'
import { FloorPass } from '../components/mint/FloorPass'
import { TradingFloor } from '../components/mint/TradingFloor'
import { YourDucksCard } from '../components/mint/YourDucksCard'
import { OrderFilledModal } from '../components/mint/OrderFilledModal'
import { RarityModal, FinePrintModal } from '../components/mint/InfoModals'
import { useState } from 'react'
import { MINT_DETAILS } from '../lib/mint/config'

// Same pixel frame as the MARKET OPEN badge, sized for the small header links.
const HEADER_LINK_FRAME = {
  borderImageSource: 'url(/mint/badge_frame.png)',
  borderImageSlice: '30 75 30 75',
  borderImageRepeat: 'stretch',
  borderStyle: 'solid',
  borderWidth: '9px 22px',
} as const

export function Mint() {
  const m = useMintFlow()
  // Index into m.mine of the duck opened from Your Ducks, if any.
  const [viewing, setViewing] = useState<number | null>(null)
  const connected = m.wallet.connected
  const walletShort = m.wallet.publicKey
    ? `${m.wallet.publicKey.toBase58().slice(0, 4)}…${m.wallet.publicKey.toBase58().slice(-4)}`
    : '····…····'

  return (
    <div className="relative min-h-screen bg-[#0B2350] font-terminal text-[#F0E4CC]">
      <img
        src="/mint/wallst_day.jpg"
        alt=""
        className="fixed inset-0 h-full w-full object-cover object-[center_62%] [image-rendering:pixelated]"
        style={{ objectPosition: 'center 62%' }}
      />
      <div
        className="fixed inset-0"
        style={{ background: 'radial-gradient(ellipse 60% 70% at 50% 50%, rgba(2,6,14,.62), rgba(2,6,14,.18) 80%)' }}
      />
      <MoneyRain count={14} />

      <div className="relative z-10">
        <MintTicker
          mintedStr={m.mintedStr}
          supplyStr={m.supplyStr}
          remainingStr={m.remainingStr}
          usdPricePerMint={m.usdPricePerMint}
          nasduckPriceUsd={m.nasduckPriceUsd}
        />

        <div className="flex flex-wrap items-center justify-center gap-4 px-3 py-3 min-[700px]:justify-between min-[700px]:px-5 min-[700px]:py-4">
          <div className="flex items-center gap-2.5">
            <img src="/mint/nasduck-badge.jpg" alt="NASDUCK" className="h-[30px] w-[30px] rounded-full object-cover" />
            <div className="font-pixelify text-[20px] font-bold text-[#F7E7C1]">NASDUCKS</div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="https://nasduck.wtf"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-[#03111E] px-1.5 font-terminal text-[13px] text-[#F7E7C1] hover:text-[#F5911E] min-[700px]:px-2 min-[700px]:text-[15px]"
              style={HEADER_LINK_FRAME}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9s1.3-6.4 3.8-9z" />
              </svg>
              NASDUCK.WTF ↗
            </a>
            <a
              href="https://x.com/NASDUCKOTC"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 bg-[#03111E] px-1.5 font-terminal text-[13px] text-[#F7E7C1] hover:text-[#F5911E] min-[700px]:px-2 min-[700px]:text-[15px]"
              style={HEADER_LINK_FRAME}
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              @NASDUCKOTC ↗
            </a>
          </div>
        </div>

        <div className="mx-auto flex flex-col items-center gap-4 px-3 pb-6 min-[700px]:px-5 min-[700px]:pb-8" style={{ maxWidth: 1180 }}>
          {m.cluster === 'devnet' && (
            <div className="w-full border-2 border-[#FF5A4E] bg-[#02060E] px-3 py-1.5 text-center font-terminal text-[18px] text-[#FF5A4E]">
              DEVNET TEST MODE · test tokens only, nothing here is real
            </div>
          )}
          <div
            className="inline-flex items-center gap-2 bg-[#03111E] px-3 py-0.5 font-terminal text-[20px] text-[#F5911E] [text-shadow:0_0_6px_currentColor]"
            style={{
              borderImageSource: 'url(/mint/badge_frame.png)',
              borderImageSlice: '30 75 30 75',
              borderImageRepeat: 'stretch',
              borderStyle: 'solid',
              borderWidth: '12px 30px',
            }}
          >
            MARKET OPEN · PUBLIC MINT
          </div>

          <h1
            className="m-0 text-center font-silkscreen font-bold leading-[1.05] tracking-[.02em] text-balance"
            style={{
              fontSize: 'clamp(28px,5vw,56px)',
              color: '#F7E7C1',
              textShadow: '2px 2px 0 #02060E, -2px -2px 0 #02060E, 2px -2px 0 #02060E, -2px 2px 0 #02060E',
            }}
          >
            MINT HERE. <span className="text-[#F5911E]">THE DUCK IS GOING PUBLIC</span>
          </h1>

          <div
            className="w-full px-1 py-1.5"
            style={{
              // Corners and the centre plates keep their shape; only the plain
              // runs between them stretch. Thinner on phones.
              borderImageSource: 'url(/mint/minted_frame.png)',
              borderImageSlice: '36 75 28 75 fill',
              borderImageRepeat: 'stretch',
              borderStyle: 'solid',
              borderWidth: 'clamp(18px,2.6vw,30px) clamp(30px,5vw,56px) clamp(14px,2vw,24px)',
            }}
          >
            {/* Numbers stay in VT323: Pixelify's "5" reads as "S". */}
            <div className="mb-2 flex items-end justify-between gap-3">
              <div className="flex items-baseline gap-2.5">
                <span className="font-terminal text-[clamp(28px,3.6vw,40px)] leading-none text-white [text-shadow:0_0_10px_rgba(255,255,255,.35),2px_2px_0_#02060E]">
                  {m.mintedStr}
                  <span className="text-white/75"> / {m.supplyStr}</span>
                </span>
                <span className="font-pixelify text-[clamp(15px,1.8vw,20px)] font-bold tracking-[.06em] text-[#F5911E] [text-shadow:2px_2px_0_#02060E]">
                  MINTED
                </span>
              </div>
              <span className="font-terminal text-[clamp(26px,3.2vw,36px)] leading-none text-[#F5911E] [text-shadow:0_0_10px_rgba(245,145,30,.6),2px_2px_0_#02060E]">
                {m.mintedPct}
              </span>
            </div>
            <div className="h-[22px] w-full border-2 border-[#2E5590] bg-[#02060E] p-[2px]">
              <div
                className="mint-progress-fill h-full transition-[width] duration-500"
                style={{ width: m.mintedPct }}
              />
            </div>
          </div>

          <div className="flex w-full flex-col-reverse items-stretch gap-7 sm:flex-row sm:flex-wrap-reverse sm:items-stretch">
            <YourDucksCard mine={m.mine} sel={m.sel} onSelect={m.setSel} onOpen={setViewing} />

            <div
              className="w-full min-w-0 flex-1 p-4 sm:min-w-[440px] min-[700px]:p-6 [box-shadow:0_30px_60px_rgba(0,0,0,.6),0_0_60px_rgba(245,145,30,.25)]"
              style={{
                borderImageSource: 'url(/mint/floor_access_frame.png)',
                borderImageSlice: '110 150 110 150',
                borderImageWidth: '40px',
                borderImageRepeat: 'stretch',
                borderStyle: 'solid',
                borderWidth: '40px',
              }}
            >
              {!connected ? (
                <FloorPass gate={m.gate} connected={connected} onSwipe={m.badgeIn} mintedStr={m.mintedStr} supplyStr={m.supplyStr} remainingStr={m.remainingStr} />
              ) : (
                <TradingFloor walletShort={walletShort} m={m} />
              )}
            </div>
          </div>

          {/* Desktop only — full-width strip under both cards, so Your Ducks
              and Floor Access/Trading Floor can be matched-height boxes
              instead of Floor Access carrying this content and running
              taller. Mobile keeps its own tappable-bar + bottom-sheet
              version inside FloorPass. */}
          <div
            className="hidden w-full min-[700px]:block"
            style={{
              // Same frame as the minted counter.
              borderImageSource: 'url(/mint/minted_frame.png)',
              borderImageSlice: '36 75 28 75 fill',
              borderImageRepeat: 'stretch',
              borderStyle: 'solid',
              borderWidth: 'clamp(18px,2.6vw,30px) clamp(30px,5vw,56px) clamp(14px,2vw,24px)',
            }}
          >
            <div className="grid grid-cols-4 divide-x divide-[#2E5590] py-2 text-[18px]">
              {MINT_DETAILS.map(([label, body]) => (
                <div key={label} className="flex flex-col items-center justify-center px-5 py-2 text-center font-terminal">
                  <div className="text-[20px] text-[#F5911E]">{label}</div>
                  <div className="leading-[1.2] text-white">{body}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => m.togglePanel('rarity')}
              className="border-[3px] border-[#F7E7C1] bg-[#A0520C] px-3 py-1 font-pixelify text-[17px] font-bold text-[#F7E7C1] outline outline-2 outline-[#A0520C] [box-shadow:4px_4px_0_#02060E] hover:bg-[#F7E7C1] hover:text-[#A0520C]"
            >
              RARITY
            </button>
            <button
              type="button"
              onClick={() => m.togglePanel('info')}
              className="border-[3px] border-[#F7E7C1] bg-[#A0520C] px-3 py-1 font-pixelify text-[17px] font-bold text-[#F7E7C1] outline outline-2 outline-[#A0520C] [box-shadow:4px_4px_0_#02060E] hover:bg-[#F7E7C1] hover:text-[#A0520C]"
            >
              FINE PRINT
            </button>
          </div>

          <div className="whitespace-nowrap text-center font-terminal text-[11px] text-[#F7E7C1] min-[700px]:text-[20px]">Collectibles, not financial advice. The advisor is a duck.</div>
        </div>
      </div>

      {m.receipt && <OrderFilledModal items={m.receipt.items} receipt={m.receipt} onClose={m.closeReceipt} />}
      {!m.receipt && viewing !== null && m.mine[viewing] && <OrderFilledModal items={m.mine} start={viewing} onClose={() => setViewing(null)} />}
      {m.panel === 'rarity' && <RarityModal onClose={() => m.togglePanel('rarity')} />}
      {m.panel === 'info' && <FinePrintModal onClose={() => m.togglePanel('info')} />}
    </div>
  )
}
