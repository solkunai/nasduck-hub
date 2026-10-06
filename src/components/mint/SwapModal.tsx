import { SwapWidget } from '../SwapWidget'

// The site's existing Jupiter swap (same one as the landing page), in a
// pop-up so buyers can get $NASDUCK without leaving the mint.
export function SwapModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-auto bg-[#02060E]/85 p-3" onClick={onClose}>
      <div className="w-full max-w-[440px] animate-mintPop" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-pixelify text-[22px] font-bold text-white">GET $NASDUCK</div>
          <button type="button" onClick={onClose} className="font-pixelify text-[18px] text-[#F7E7C1]">
            CLOSE ✕
          </button>
        </div>
        <SwapWidget />
        <p className="mt-2 text-center font-terminal text-[15px] text-white">
          Swaps run through Jupiter in your own wallet. Close this when done to mint.
        </p>
      </div>
    </div>
  )
}
