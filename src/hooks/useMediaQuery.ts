import { useEffect, useState } from 'react'

// No custom `screens` override in tailwind.config — confirmed before
// hardcoding anything here — so this matches Tailwind's real default `sm`
// breakpoint (640px) exactly where a caller needs JS to react to the same
// breakpoint a Tailwind class already switches on.
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = () => setMatches(mql.matches)
    onChange()
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])

  return matches
}
