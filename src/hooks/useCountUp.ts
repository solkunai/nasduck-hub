import { useEffect, useRef, useState } from 'react'

// Count-up on mount (ease-out cubic), then a slow live drip of +1 per interval.
// Guarded by visibilityState so a backgrounded tab shows the final number, not 0.
export function useCountUp(target: number, durationMs = 1900, dripIntervalMs = 1100): number {
  const [value, setValue] = useState(() => (document.visibilityState === 'hidden' ? target : 0))
  const rafRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (document.visibilityState === 'hidden') {
      setValue(target)
      return
    }

    let start: number | null = null
    function tick(ts: number) {
      if (start === null) start = ts
      const t = Math.min((ts - start) / durationMs, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(target * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [target, durationMs])

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        setValue((v) => (v >= target ? v + 1 : v))
      }
    }, dripIntervalMs)
    return () => clearInterval(id)
  }, [target, dripIntervalMs])

  return value
}
