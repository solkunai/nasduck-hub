import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { NASDUCK_MINT } from '../_shared/constants.ts'

// Its own secret, not the shared CRON_SECRET other functions use — keeps
// this function's setup fully independent so testing/rotating it can never
// risk breaking snapshot-holders' cron job, which uses the shared one.
const CRON_SECRET = Deno.env.get('OTC_CRON_SECRET')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const OTC_DESKS_API = `https://otcdesks.cash/api/coins?mint=${NASDUCK_MINT}`

// Shape of the one field of their response this function actually reads —
// deliberately narrow (not the full response) so a field OTC Desks adds
// later doesn't need a code change here, and a field they remove just comes
// through as undefined rather than breaking parsing.
interface OtcCoin {
  rewardSymbol?: string
  rewardMint?: string
  rewards?: {
    distributed?: number
    earned?: number
    toProtocol?: number
    toPot?: number
    toBuyback?: number
    owed?: number
    lastPaidHolders?: number
    lastDistributedAt?: number
    lastClaimTx?: string
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) {
      return json({ error: 'unauthorized' }, 401)
    }
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new Error('supabase service credentials not configured')

    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

    // Read the previous snapshot BEFORE fetching fresh data — this is what
    // lets one poll both refresh the current-totals row and detect whether
    // a new payout happened since the last poll, without a second round
    // trip or a separate "last known state" table.
    const { data: previous } = await db
      .from('otc_desks_rewards')
      .select('paid_to_holders_lamports, last_claim_tx')
      .eq('mint', NASDUCK_MINT)
      .maybeSingle()

    const res = await fetch(OTC_DESKS_API)
    if (!res.ok) throw new Error(`otcdesks.cash returned ${res.status}`)
    const data = (await res.json()) as { coins?: OtcCoin[] }
    const coin = data.coins?.[0]
    if (!coin?.rewards) throw new Error('no reward data in otcdesks.cash response')

    const r = coin.rewards
    const newDistributed = Math.round(r.distributed ?? 0)
    const newClaimTx = r.lastClaimTx ?? null

    // Only record a feed entry when there's a previous snapshot to compare
    // against (never on the very first run for this mint — there's no
    // sensible "since when" to attribute a delta to) and the claim tx
    // actually changed, meaning a real new payout round happened since the
    // last poll rather than the same still-current state being re-fetched.
    // OTC Desks has no per-coin payout history API of its own (confirmed:
    // their /api/claims endpoint is global and per-claimant-wallet, mixing
    // every coin on the platform with no field identifying the originating
    // coin) — this is what builds NASDUCK's own feed up over time instead.
    if (previous && newClaimTx && newClaimTx !== previous.last_claim_tx) {
      const delta = newDistributed - Number(previous.paid_to_holders_lamports)
      // Defensive: the cumulative total should only ever grow. A
      // non-positive delta would mean something unexpected happened
      // upstream (a reset, a misread) — skip recording rather than insert
      // a zero or negative "payout" into the feed.
      if (delta > 0) {
        // upsert + ignoreDuplicates (real Postgrest ON CONFLICT DO NOTHING,
        // not the default merge-on-conflict behavior — verified against
        // the installed client's own docs before using it) rather than a
        // plain insert: claim_tx is UNIQUE, so if this exact payout was
        // already recorded (e.g. an overlapping cron run), this is a safe
        // no-op instead of an error or a duplicate feed entry.
        await db.from('otc_desks_payouts').upsert(
          {
            mint: NASDUCK_MINT,
            claim_tx: newClaimTx,
            amount_lamports_delta: delta,
            holders_paid: r.lastPaidHolders ?? 0,
            paid_at: r.lastDistributedAt ? new Date(r.lastDistributedAt * 1000).toISOString() : new Date().toISOString(),
          },
          { onConflict: 'claim_tx', ignoreDuplicates: true },
        )
      }
    }

    const row = {
      mint: NASDUCK_MINT,
      reward_symbol: coin.rewardSymbol ?? 'unknown',
      reward_mint: coin.rewardMint ?? '',
      paid_to_holders_lamports: newDistributed,
      creator_fees_earned_lamports: Math.round(r.earned ?? 0),
      to_protocol_lamports: Math.round(r.toProtocol ?? 0),
      to_pot_lamports: Math.round(r.toPot ?? 0),
      to_buyback_lamports: Math.round(r.toBuyback ?? 0),
      owed_lamports: Math.round(r.owed ?? 0),
      last_paid_holders: r.lastPaidHolders ?? 0,
      // OTC Desks returns unix seconds, not milliseconds — confirmed by
      // computing a real sample value while building this (×1000 landed
      // in 1970, ×1 landed on today's actual date).
      last_distributed_at: r.lastDistributedAt ? new Date(r.lastDistributedAt * 1000).toISOString() : null,
      last_claim_tx: newClaimTx,
      updated_at: new Date().toISOString(),
    }

    await db.from('otc_desks_rewards').upsert(row, { onConflict: 'mint' })

    return json({ ok: true, paidToHoldersSol: row.paid_to_holders_lamports / 1e9 })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'unexpected error' }, 500)
  }
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  })
}
