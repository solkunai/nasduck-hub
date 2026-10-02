import { formatPrice } from '../../lib/format'

interface MintTickerProps {
  mintedStr: string
  remainingStr: string
  usdPricePerMint: number
  nasduckPriceUsd: number
}

function TickerContent({ mintedStr, remainingStr, usdPricePerMint, nasduckPriceUsd }: MintTickerProps) {
  return (
    <div className="flex items-center gap-[34px] whitespace-nowrap px-6 py-[9px] font-terminal text-[22px] [text-shadow:0_0_6px_currentColor]">
      <span className="text-[#6FBE44]">▲ NDUCK {mintedStr}/4,444</span>
      <span className="text-[#F5911E]">PUBLIC MINT · ${usdPricePerMint.toFixed(2)}/DUCK</span>
      <span className="text-[#6FBE44]">▲ $NASDUCK {formatPrice(nasduckPriceUsd)}</span>
      <span className="text-[#6FBE44]">▲ QQQ +2.34%</span>
      <span className="text-[#6FBE44]">▲ NASDAQ +1.87%</span>
      <span className="text-[#F7E7C1]">{remainingStr} LEFT</span>
      <span className="text-[#FF5A4E]">▼ COMPLIANCE −100%</span>
      <span className="text-[#F5911E]">FIRED FROM WALL STREET. HIRED BY DEGENS.</span>
      <span className="text-[#F7E7C1]">NASDUCK.WTF</span>
      <span className="text-[#8FA3C4]">X · @NASDUCKOTC</span>
    </div>
  )
}

// Sticky marquee ticker bar — content duplicated twice so the loop (translateX
// 0 -> -50%) reads as seamless.
export function MintTicker(props: MintTickerProps) {
  return (
    <div className="sticky top-0 z-40 overflow-hidden border-b-2 border-[#1B2F52] bg-[#02060E] [background-image:radial-gradient(rgba(111,190,68,.08)_1px,transparent_1.5px)] [background-size:4px_4px]">
      <div className="flex w-max animate-mintMarquee">
        <TickerContent {...props} />
        <TickerContent {...props} />
      </div>
    </div>
  )
}
