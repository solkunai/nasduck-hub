import { useEffect, useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useMemeWall, type Meme } from '../hooks/useMemeWall'
import { formatTimeAgo } from '../lib/format'
import { downloadImage } from '../lib/download'
import { shareMemeToX } from '../lib/share'

function agoFrom(iso: string): string {
  return formatTimeAgo((Date.now() - new Date(iso).getTime()) / 1000)
}

function filenameFor(meme: Meme): string {
  return `nasduck-meme-${meme.id}.jpg`
}

export function MemeWall() {
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const wallet = publicKey?.toBase58() ?? null
  const { memes, heroMeme, myVotes, sort, setSort, loading, error, voteError, upvote, report, upload } = useMemeWall(wallet)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // One toast at a time, owned here rather than per-button — a save always
  // means "just this one meme, right now," so a single shared slot is
  // simpler than every DownloadButton instance managing its own portal.
  const [savedMeme, setSavedMeme] = useState<Meme | null>(null)

  function handleUploadClick() {
    if (!connected) {
      setVisible(true)
      return
    }
    fileInputRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const caption = window.prompt('caption for this meme (optional, max 200 chars)', '') ?? ''
      await upload(file, caption.slice(0, 200))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div id="memes" className="mx-auto max-w-[1240px] scroll-mt-[110px] px-5 py-9">
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-[clamp(24px,3vw,34px)] tracking-tight text-ink-primary">THE MEME DESK</h2>
          <div className="mt-1.5 font-mono text-[11.5px] text-ink-faint">
            Research published by the community. Peer review is one upvote.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setSort('top')}
            className={`rounded-lg border border-line px-3.5 py-2 font-mono text-[11.5px] ${sort === 'top' ? 'bg-ink-primary text-bg' : 'text-ink-faint'}`}
          >
            TOP
          </button>
          <button
            onClick={() => setSort('recent')}
            className={`rounded-lg border border-line px-3.5 py-2 font-mono text-[11.5px] ${sort === 'recent' ? 'bg-ink-primary text-bg' : 'text-ink-faint'}`}
          >
            RECENT
          </button>
          <button
            onClick={handleUploadClick}
            disabled={uploading}
            className={`rounded-lg border px-4 py-2.5 font-display text-[12.5px] disabled:opacity-50 ${connected ? 'border-brand bg-brand text-bg' : 'border-brand text-brand'}`}
          >
            {uploading ? 'UPLOADING…' : connected ? '+ UPLOAD MEME' : 'CONNECT TO POST'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChosen} />
        </div>
      </div>

      {uploadError && <div className="mb-3 font-mono text-[11px] text-down">{uploadError}</div>}
      {voteError && <div className="mb-3 font-mono text-[11px] text-down">{voteError}</div>}

      {heroMeme && (
        <div className="mb-[18px] grid items-center gap-5 rounded-2xl border border-line-strong bg-gradient-to-r from-[#1B2E1A] to-panel-deep p-[18px] [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
          <div className="aspect-square max-w-[240px] overflow-hidden rounded-[10px] border border-line bg-bg">
            <img src={heroMeme.imageUrl} alt={heroMeme.caption} className="h-full w-full object-cover" />
          </div>
          <div className="min-w-0">
            <div className="mb-2.5 font-mono text-[10.5px] tracking-wide text-brand">PINNED BY THE DESK</div>
            <div className="mb-2.5 font-display text-[clamp(18px,2.4vw,26px)] leading-[1.15] tracking-tight text-ink-primary">
              {heroMeme.caption || 'untitled'}
            </div>
            <div className="mb-4 font-mono text-[11.5px] text-ink-faint">
              by {heroMeme.wallet.slice(0, 4)}...{heroMeme.wallet.slice(-4)} · {agoFrom(heroMeme.createdAt)}
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => upvote(heroMeme.id)}
                disabled={!wallet || myVotes.has(heroMeme.id)}
                className="flex items-center gap-2 rounded-lg bg-up px-3.5 py-2.5 font-mono text-[12.5px] text-bg disabled:opacity-60"
              >
                ▲ {heroMeme.votes}
              </button>
              <ShareButton meme={heroMeme} />
              <DownloadButton meme={heroMeme} onSaved={setSavedMeme} />
            </div>
          </div>
        </div>
      )}

      {loading && <div className="py-8 text-center font-mono text-sm text-ink-muted">loading memes…</div>}
      {error && <div className="py-8 text-center font-mono text-sm text-down">{error}</div>}
      {!loading && !error && memes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-strong py-12 text-center font-mono text-sm text-ink-faint">
          no memes yet — be the first to post
        </div>
      )}

      {!loading && !error && memes.length > 0 && (
        <div className="grid gap-3.5 [grid-template-columns:repeat(auto-fill,minmax(200px,1fr))]">
          {memes.map((meme) => (
            <MemeCard
              key={meme.id}
              meme={meme}
              voted={myVotes.has(meme.id)}
              canVote={!!wallet}
              onUpvote={upvote}
              onReport={report}
              onSaved={setSavedMeme}
            />
          ))}
        </div>
      )}

      <div className="mt-3 font-mono text-[10.5px] text-ink-dim">
        Wallet-gated uploads publish instantly — no approval queue. Flag anything fowl and the desk reviews after the
        fact.
      </div>

      {savedMeme && <SavedToast meme={savedMeme} onDismiss={() => setSavedMeme(null)} />}
    </div>
  )
}

function SavedToast({ meme, onDismiss }: { meme: Meme; onDismiss: () => void }) {
  const [sharing, setSharing] = useState(false)

  useEffect(() => {
    const t = setTimeout(onDismiss, 6000)
    return () => clearTimeout(t)
  }, [onDismiss])

  async function handleShare() {
    setSharing(true)
    try {
      await shareMemeToX(meme.imageUrl, meme.caption, filenameFor(meme))
    } finally {
      setSharing(false)
      onDismiss()
    }
  }

  return (
    <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3.5 rounded-xl border border-line-strong bg-panel px-4 py-3.5 shadow-[0_12px_40px_rgba(0,0,0,.5)]">
      <span className="text-lg">✅</span>
      <div className="font-mono text-[12.5px] text-ink-secondary">meme saved — share it on X?</div>
      <button
        onClick={handleShare}
        disabled={sharing}
        className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 font-display text-[11.5px] text-bg disabled:opacity-50"
      >
        {sharing ? 'OPENING…' : 'SHARE ON X'}
      </button>
      <button onClick={onDismiss} className="text-ink-dim hover:text-ink-muted" title="dismiss">
        ✕
      </button>
    </div>
  )
}

function ShareButton({ meme, compact }: { meme: Meme; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function handleShare() {
    setBusy(true)
    try {
      await shareMemeToX(meme.imageUrl, meme.caption, filenameFor(meme))
    } finally {
      setBusy(false)
    }
  }
  if (compact) {
    return (
      <button onClick={handleShare} disabled={busy} title="share on X" className="hover:text-brand disabled:opacity-50">
        𝕏
      </button>
    )
  }
  return (
    <button
      onClick={handleShare}
      disabled={busy}
      className="rounded-lg border border-line px-3.5 py-2.5 font-mono text-[12.5px] text-ink-muted hover:border-line-strong disabled:opacity-50"
    >
      {busy ? 'OPENING…' : 'SHARE ON X'}
    </button>
  )
}

function DownloadButton({ meme, compact, onSaved }: { meme: Meme; compact?: boolean; onSaved: (meme: Meme) => void }) {
  const [busy, setBusy] = useState(false)
  async function handleDownload() {
    setBusy(true)
    try {
      await downloadImage(meme.imageUrl, filenameFor(meme))
      onSaved(meme)
    } catch {
      // A failed download just means nothing happened — no separate error
      // state worth building for a save button, unlike votes/uploads.
    } finally {
      setBusy(false)
    }
  }
  if (compact) {
    return (
      <button onClick={handleDownload} disabled={busy} title="download image" className="hover:text-brand disabled:opacity-50">
        ⬇
      </button>
    )
  }
  return (
    <button
      onClick={handleDownload}
      disabled={busy}
      className="rounded-lg border border-line px-3.5 py-2.5 font-mono text-[12.5px] text-ink-muted hover:border-line-strong disabled:opacity-50"
    >
      {busy ? 'SAVING…' : 'DOWNLOAD'}
    </button>
  )
}

function MemeCard({
  meme,
  voted,
  canVote,
  onUpvote,
  onReport,
  onSaved,
}: {
  meme: Meme
  voted: boolean
  canVote: boolean
  onUpvote: (id: number) => void
  onReport: (id: number) => void
  onSaved: (meme: Meme) => void
}) {
  const [reported, setReported] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel transition-transform hover:-translate-y-0.5 hover:border-line-strong">
      <div className="aspect-square border-b border-line bg-bg">
        <img src={meme.imageUrl} alt={meme.caption} className="h-full w-full object-cover" />
      </div>
      <div className="p-3">
        <div className="h-8 overflow-hidden font-mono text-[11.5px] leading-snug text-ink-secondary">
          {meme.caption || 'untitled'}
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <button
            onClick={() => onUpvote(meme.id)}
            disabled={!canVote || voted}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono text-[11.5px] disabled:cursor-not-allowed ${
              voted ? 'border-up bg-up text-bg' : 'border-line text-ink-muted hover:border-up hover:text-up'
            }`}
          >
            ▲ {meme.votes}
          </button>
          <div className="flex items-center gap-2.5 font-mono text-[11px] text-ink-dim">
            <DownloadButton meme={meme} compact onSaved={onSaved} />
            <ShareButton meme={meme} compact />
            <span>{agoFrom(meme.createdAt)}</span>
            <button
              onClick={() => {
                if (!reported) {
                  setReported(true)
                  onReport(meme.id)
                }
              }}
              className={reported ? 'text-down' : 'hover:text-down'}
              title="report"
            >
              ⚑
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
