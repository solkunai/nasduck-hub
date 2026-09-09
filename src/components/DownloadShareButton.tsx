import { useEffect, useState } from 'react'
import { downloadImage } from '../lib/download'
import { shareImageToX } from '../lib/share'

// Shared by the meme wall and the hero mascot — same job either way:
// download the image, then offer a one-tap share once it's saved.
interface Props {
  imageUrl: string
  filename: string
  shareText: string
  compact?: boolean
  label?: string
  className?: string
}

export function DownloadShareButton({ imageUrl, filename, shareText, compact, label = 'DOWNLOAD', className }: Props) {
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    if (!saved) return
    const t = setTimeout(() => setSaved(false), 6000)
    return () => clearTimeout(t)
  }, [saved])

  async function handleDownload() {
    setBusy(true)
    try {
      await downloadImage(imageUrl, filename)
      setSaved(true)
    } catch {
      // A failed download just means nothing happened — no separate error
      // state worth building for a save button, unlike votes/uploads.
    } finally {
      setBusy(false)
    }
  }

  async function handleShare() {
    setSharing(true)
    try {
      await shareImageToX(imageUrl, shareText, filename)
    } finally {
      setSharing(false)
      setSaved(false)
    }
  }

  return (
    <>
      {compact ? (
        <button onClick={handleDownload} disabled={busy} title="download image" className="hover:text-brand disabled:opacity-50">
          ⬇
        </button>
      ) : (
        <button
          onClick={handleDownload}
          disabled={busy}
          className={
            className ??
            'rounded-lg border border-line px-3.5 py-2.5 font-mono text-[12.5px] text-ink-muted hover:border-line-strong disabled:opacity-50'
          }
        >
          {busy ? 'SAVING…' : label}
        </button>
      )}

      {saved && (
        <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3.5 rounded-xl border border-line-strong bg-panel px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,.5)]">
          <span className="text-lg">✅</span>
          <div className="font-mono text-[12.5px] text-ink-secondary">saved — share it on X?</div>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 font-display text-[11.5px] text-bg disabled:opacity-50"
          >
            {sharing ? 'OPENING…' : 'SHARE ON X'}
          </button>
          <button onClick={() => setSaved(false)} className="text-ink-dim hover:text-ink-muted" title="dismiss">
            ✕
          </button>
        </div>
      )}
    </>
  )
}
