import { downloadImage } from './download'

export type ShareResult = 'native' | 'intent'

// X (like every major platform) does not let a website attach a file into
// its compose box via a plain link — intent URLs only accept prefilled text
// and a link, never an uploadable image. That's a deliberate X platform
// restriction (anti-spam), not something client code can route around.
// Two real paths, in order of how close they get to "actually attach the
// image":
//
// 1. The Web Share API with `files` — on a supporting browser/OS (mobile
//    Safari/Chrome, some desktop Chrome), this hands the real image bytes
//    to the native share sheet, and if the user picks X/Twitter as the
//    target, the app receives the actual file. This is the only path that
//    can genuinely attach the image.
// 2. Fallback for everywhere else: download the image (so it's sitting in
//    the user's downloads, ready to drag into the compose box) AND open
//    X's tweet-intent with the caption prefilled — closes the gap as much
//    as a web page honestly can.
export async function shareMemeToX(imageUrl: string, caption: string, filename: string): Promise<ShareResult> {
  const text = caption ? `${caption} $NASDUCK` : '$NASDUCK'

  if (navigator.share && navigator.canShare) {
    try {
      const res = await fetch(imageUrl)
      const blob = await res.blob()
      const file = new File([blob], filename, { type: blob.type || 'image/jpeg' })
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return 'native'
      }
    } catch (err) {
      // AbortError just means the user closed the share sheet — not a
      // failure, don't fall through to the intent link on top of it.
      if (err instanceof Error && err.name === 'AbortError') return 'native'
    }
  }

  await downloadImage(imageUrl, filename).catch(() => {})
  const params = new URLSearchParams({ text })
  window.open(`https://twitter.com/intent/tweet?${params.toString()}`, '_blank', 'noopener,noreferrer')
  return 'intent'
}
