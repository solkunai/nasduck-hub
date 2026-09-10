import { useEffect, useRef, useState } from 'react'
import { useActiveWallet } from '../hooks/useActiveWallet'
import { useMediaQuery } from '../hooks/useMediaQuery'
import { useMemeWall, type Meme } from '../hooks/useMemeWall'
import { formatTimeAgo } from '../lib/format'
import { shareImageToX } from '../lib/share'
import { DownloadShareButton } from './DownloadShareButton'

// Mobile (2-col grid) keeps 6 — that's 3 clean rows, what was actually
// asked for originally. A fixed 6 looked wrong once the grid reaches its
// widest (5-col at xl): confirmed live — 5 on one row, 1 stranded alone on
// the next, then straight to page 2. 10 fits the wide layouts cleanly
// instead (2 full rows at 5 columns; a little less even at 3/4 columns,
// but never a lone straggler by itself).
const MOBILE_PAGE_SIZE = 6
const DESKTOP_PAGE_SIZE = 10

function agoFrom(iso: string): string {
  return formatTimeAgo((Date.now() - new Date(iso).getTime()) / 1000)
}

function filenameFor(meme: Meme): string {
  return `nasduck-meme-${meme.id}.jpg`
}

function shareTextFor(meme: Meme): string {
  return meme.caption ? `${meme.caption} $NASDUCK` : '$NASDUCK'
}

export function MemeWall() {
  const { publicKey, connected, login } = useActiveWallet()
  const wallet = publicKey?.toBase58() ?? null
  const { memes, heroMeme, myVotes, sort, setSort, loading, error, voteError, upvote, report, upload } = useMemeWall(wallet)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Matches the grid's own `sm:` breakpoint (640px, Tailwind's real
  // default — confirmed no custom override in tailwind.config before
  // relying on that number here) so the page size lines up with whichever
  // column count is actually showing.
  const isDesktop = useMediaQuery('(min-width: 640px)')
  const PAGE_SIZE = isDesktop ? DESKTOP_PAGE_SIZE : MOBILE_PAGE_SIZE

  const [page, setPage] = useState(0)
  // Switching TOP/RECENT reorders the whole list — "page 3" of one sort
  // has no sensible relationship to "page 3" of the other, so land back on
  // page 1 rather than showing a jarring, seemingly-arbitrary slice.
  useEffect(() => {
    setPage(0)
  }, [sort])
  const totalPages = Math.max(1, Math.ceil(memes.length / PAGE_SIZE))
  // Defensive: if the list ever shrinks (e.g. a refetch drops a
  // now-hidden meme) while sitting on a later page, clamp back rather than
  // silently render an empty grid with no "no memes" message to explain it
  // (that message only checks memes.length, not the current page's slice).
  useEffect(() => {
    if (page > totalPages - 1) setPage(totalPages - 1)
  }, [page, totalPages])
  const pageMemes = memes.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  function handleUploadClick() {
    if (!connected) {
      login()
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
              <DownloadShareButton imageUrl={heroMeme.imageUrl} filename={filenameFor(heroMeme)} shareText={shareTextFor(heroMeme)} />
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
        <>
          {/* Was a single auto-fill column with a 200px minimum — on mobile
              that only ever fit one full-width card per row, reading as an
              endless single-file scroll. Explicit column counts instead of
              minmax auto-fill guarantee 2-up even on a narrow phone. */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3.5 lg:grid-cols-4 xl:grid-cols-5">
            {pageMemes.map((meme) => (
              <MemeCard key={meme.id} meme={meme} voted={myVotes.has(meme.id)} canVote={!!wallet} onUpvote={upvote} onReport={report} />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3.5 font-mono text-[11.5px]">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-line-strong hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← PREV
              </button>
              <span className="text-ink-faint">
                PAGE {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-line px-3 py-1.5 text-ink-muted hover:border-line-strong hover:text-ink-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                NEXT →
              </button>
            </div>
          )}
        </>
      )}

      <div className="mt-3 font-mono text-[10.5px] text-ink-dim">
        Wallet-gated uploads publish instantly — no approval queue. Flag anything fowl and the desk reviews after the
        fact.
      </div>
    </div>
  )
}

function ShareButton({ meme, compact }: { meme: Meme; compact?: boolean }) {
  const [busy, setBusy] = useState(false)
  async function handleShare() {
    setBusy(true)
    try {
      await shareImageToX(meme.imageUrl, shareTextFor(meme), filenameFor(meme))
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

function MemeCard({
  meme,
  voted,
  canVote,
  onUpvote,
  onReport,
}: {
  meme: Meme
  voted: boolean
  canVote: boolean
  onUpvote: (id: number) => void
  onReport: (id: number) => void
}) {
  const [reported, setReported] = useState(false)
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-panel transition-transform hover:-translate-y-0.5 hover:border-line-strong">
      <div className="aspect-square border-b border-line bg-bg">
        <img src={meme.imageUrl} alt={meme.caption} className="h-full w-full object-cover" />
      </div>
      <div className="p-2 sm:p-3">
        {/* Two-up on mobile leaves ~168px per card — every size below was
            tuned against that, not just shrunk arbitrarily, so the footer
            row (vote + download + share + report) fits on one line
            without wrapping. The "ago" timestamp is the one thing dropped
            entirely at that width rather than squeezed — least essential
            piece of a compact card, still shown from sm: up where there's
            room for it. */}
        <div className="h-7 overflow-hidden font-mono text-[10px] leading-snug text-ink-secondary sm:h-8 sm:text-[11.5px]">
          {meme.caption || 'untitled'}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-1.5 sm:mt-2.5 sm:gap-2">
          <button
            onClick={() => onUpvote(meme.id)}
            disabled={!canVote || voted}
            className={`flex items-center gap-1 rounded-md border px-1.5 py-1 font-mono text-[10px] disabled:cursor-not-allowed sm:gap-1.5 sm:px-2.5 sm:py-1.5 sm:text-[11.5px] ${
              voted ? 'border-up bg-up text-bg' : 'border-line text-ink-muted hover:border-up hover:text-up'
            }`}
          >
            ▲ {meme.votes}
          </button>
          <div className="flex items-center gap-1.5 font-mono text-[11px] text-ink-dim sm:gap-2.5">
            <DownloadShareButton imageUrl={meme.imageUrl} filename={filenameFor(meme)} shareText={shareTextFor(meme)} compact />
            <ShareButton meme={meme} compact />
            <span className="hidden sm:inline">{agoFrom(meme.createdAt)}</span>
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
