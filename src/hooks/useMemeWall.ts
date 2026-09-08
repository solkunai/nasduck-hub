import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface Meme {
  id: number
  wallet: string
  imageUrl: string
  caption: string
  votes: number
  createdAt: string
}

export type MemeSort = 'top' | 'recent'

function toMeme(row: any): Meme {
  return {
    id: row.id,
    wallet: row.wallet,
    imageUrl: supabase.storage.from('memes').getPublicUrl(row.image_path).data.publicUrl,
    caption: row.caption,
    votes: row.votes,
    createdAt: row.created_at,
  }
}

export function useMemeWall(wallet: string | null) {
  const [memes, setMemes] = useState<Meme[]>([])
  const [heroMeme, setHeroMeme] = useState<Meme | null>(null)
  const [myVotes, setMyVotes] = useState<Set<number>>(new Set())
  const [sort, setSort] = useState<MemeSort>('top')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const list = await supabase
      .from('memes')
      .select('*')
      .order(sort === 'top' ? 'votes' : 'created_at', { ascending: false })
      .limit(48)

    if (list.error) {
      setError(list.error.message)
      setLoading(false)
      return
    }

    const rows = (list.data ?? []).map(toMeme)
    setMemes(rows)

    // Meme of the week: highest-voted meme from the last 7 days, falling
    // back to the all-time top when nothing's been posted that recently.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const recentTop = await supabase
      .from('memes')
      .select('*')
      .gte('created_at', weekAgo)
      .order('votes', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (recentTop.data) {
      setHeroMeme(toMeme(recentTop.data))
    } else {
      const allTimeTop = await supabase.from('memes').select('*').order('votes', { ascending: false }).limit(1).maybeSingle()
      setHeroMeme(allTimeTop.data ? toMeme(allTimeTop.data) : null)
    }

    setLoading(false)
  }, [sort])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!wallet) {
      setMyVotes(new Set())
      return
    }
    supabase
      .from('meme_votes')
      .select('meme_id')
      .eq('wallet', wallet)
      .then(({ data }) => setMyVotes(new Set((data ?? []).map((r) => r.meme_id))))
  }, [wallet])

  const upvote = useCallback(
    async (memeId: number) => {
      if (!wallet || myVotes.has(memeId)) return
      setMyVotes((s) => new Set(s).add(memeId))
      setMemes((prev) => prev.map((m) => (m.id === memeId ? { ...m, votes: m.votes + 1 } : m)))
      setHeroMeme((h) => (h && h.id === memeId ? { ...h, votes: h.votes + 1 } : h))

      const { error: voteError } = await supabase.from('meme_votes').insert({ meme_id: memeId, wallet })
      if (voteError) {
        // Roll back the optimistic update (most likely cause: already voted
        // from another tab/session — the primary key rejects the insert).
        setMyVotes((s) => {
          const next = new Set(s)
          next.delete(memeId)
          return next
        })
        setMemes((prev) => prev.map((m) => (m.id === memeId ? { ...m, votes: Math.max(0, m.votes - 1) } : m)))
      }
    },
    [wallet, myVotes],
  )

  const report = useCallback(async (memeId: number) => {
    if (!wallet) return
    await supabase.from('meme_reports').insert({ meme_id: memeId, wallet })
  }, [wallet])

  const upload = useCallback(
    async (file: File, caption: string) => {
      if (!wallet) throw new Error('connect a wallet first')
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${wallet}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

      const up = await supabase.storage.from('memes').upload(path, file)
      if (up.error) throw new Error(up.error.message)

      const insert = await supabase.from('memes').insert({ wallet, image_path: path, caption }).select().single()
      if (insert.error) throw new Error(insert.error.message)

      setMemes((prev) => [toMeme(insert.data), ...prev])
    },
    [wallet],
  )

  return { memes, heroMeme, myVotes, sort, setSort, loading, error, upvote, report, upload, reload: load }
}
