import { useRef, useState } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useWalletModal } from '@solana/wallet-adapter-react-ui'
import { useMemeWall } from '../hooks/useMemeWall'
import { formatTimeAgo } from '../lib/format'
import { NASDUCK_X } from '../lib/nasduck'

function agoFrom(iso: string): string {
  return formatTimeAgo((Date.now() - new Date(iso).getTime()) / 1000)
}

export function MemeWall() {
  const { publicKey, connected } = useWallet()
  const { setVisible } = useWalletModal()
  const wallet = publicKey?.toBase58() ?? null
  const { memes, heroMeme, myVotes, sort, setSort, loading, error, upvote, report, upload } = useMemeWall(wallet)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

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
    <div className="mx-auto max-w-[1240px] px-5 py-9">
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
              <a
                href={NASDUCK_X}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-line px-3.5 py-2.5 font-mono text-[12.5px] text-ink-muted hover:border-line-strong"
              >
                SHARE ON X
              </a>
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
            <MemeCard key={meme.id} meme={meme} voted={myVotes.has(meme.id)} canVote={!!wallet} onUpvote={upvote} onReport={report} />
          ))}
        </div>
      )}

      <div className="mt-3 font-mono text-[10.5px] text-ink-dim">
        Wallet-gated uploads publish instantly — no approval queue. Flag anything fowl and the desk reviews after the
        fact.
      </div>
    </div>
  )
}

function MemeCard({
  meme,
  voted,
  canVote,
  onUpvote,
  onReport,
}: {
  meme: import('../hooks/useMemeWall').Meme
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
          <div className="flex items-center gap-2 font-mono text-[10px] text-ink-dim">
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
