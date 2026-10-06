import { useEffect, useRef } from 'react'
import type { MintedDuck } from '../../hooks/useMintFlow'
import { DuckImage } from './DuckImage'

interface DuckStripProps {
  ducks: MintedDuck[]
  selected: number
  onPick: (i: number) => void
  /** Thumbnail edge length in px. */
  size?: number
}

// One scrollable row of duck thumbnails. A plain mouse wheel scrolls it
// sideways (trackpads and touch already swipe horizontally).
export function DuckStrip({ ducks, selected, onPick, size = 84 }: DuckStripProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    // Non-passive so the page doesn't scroll at the same time.
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keep the selected duck in view, scrolling only the strip (never the page).
  useEffect(() => {
    const el = ref.current
    const item = el?.children[selected] as HTMLElement | undefined
    if (!el || !item) return
    if (item.offsetLeft < el.scrollLeft) el.scrollLeft = item.offsetLeft
    else if (item.offsetLeft + item.offsetWidth > el.scrollLeft + el.clientWidth) el.scrollLeft = item.offsetLeft + item.offsetWidth - el.clientWidth
  }, [selected])

  return (
    <div
      ref={ref}
      className="flex gap-1.5 overflow-x-auto pb-1.5 [scrollbar-color:#F5911E_#0B1220] [scrollbar-width:thin]"
    >
      {ducks.map((d, i) => (
        <button
          key={d.address || d.id + i}
          type="button"
          onClick={() => onPick(i)}
          aria-label={`View NASDUCK ${d.id} traits`}
          className="shrink-0 overflow-hidden border-2"
          style={{ width: size, height: size, borderColor: i === selected ? '#F5911E' : '#3A4A66' }}
        >
          <DuckImage src={d.image} small />
        </button>
      ))}
    </div>
  )
}
