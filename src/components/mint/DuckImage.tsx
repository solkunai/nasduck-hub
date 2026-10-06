import { useState } from 'react'

// A duck's picture, with a "REVEALING…" panel until it has actually loaded
// (or while its details are still being read), never a stand-in duck.
export function DuckImage({ src, small = false }: { src: string; small?: boolean }) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null)
  const ready = !!src && loadedSrc === src
  return (
    <div className="relative h-full w-full bg-[#03111E]">
      {src && (
        <img
          src={src}
          alt=""
          onLoad={() => setLoadedSrc(src)}
          // Already cached (e.g. preloaded) images can finish before onLoad is attached.
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0 && loadedSrc !== src) setLoadedSrc(src)
          }}
          className={`h-full w-full object-cover [image-rendering:pixelated] ${ready ? '' : 'opacity-0'}`}
        />
      )}
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center">
          {small ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#F5911E] border-t-transparent" />
          ) : (
            <span className="font-terminal text-[22px] text-[#F5911E] [text-shadow:0_0_6px_currentColor]">REVEALING…</span>
          )}
        </div>
      )}
    </div>
  )
}

// Resolves once the image is cached (or after `ms`, whichever comes first).
export function preloadImage(src: string, ms = 5000): Promise<void> {
  return new Promise((resolve) => {
    if (!src) return resolve()
    const img = new Image()
    const t = window.setTimeout(resolve, ms)
    img.onload = img.onerror = () => {
      window.clearTimeout(t)
      resolve()
    }
    img.src = src
  })
}
