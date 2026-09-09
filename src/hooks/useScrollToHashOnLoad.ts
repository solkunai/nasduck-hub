import { useEffect } from 'react'

// Confirmed live: a direct/shared link like nasduck.wtf/#memes does NOT
// auto-scroll on load — the browser's native hash-jump only fires once, at
// the moment the URL is first processed, before this SPA has rendered the
// target element into the DOM. An in-page click on an #anchor link works
// fine (the element already exists by then); only the load-with-hash-
// already-in-the-URL case needs this. Shared between Landing and Legal
// rather than duplicated — both have anchor targets a link could point at
// directly (nasduck.wtf/#memes, nasduck.wtf/legal#privacy).
export function useScrollToHashOnLoad() {
  useEffect(() => {
    if (!window.location.hash) return
    const id = window.location.hash.slice(1)
    const t = setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'auto' })
    }, 50)
    return () => clearTimeout(t)
  }, [])
}
