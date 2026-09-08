import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!url || !publishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY')
}

// The publishable key is meant to be public — it's what a browser is
// supposed to hold, distinct from the Personal Access Token used to manage
// the project (never belongs in client code). See lib/nasduck.ts's REFERRAL_ACCOUNT
// comment style: this key only grants what RLS policies allow, nothing more.
export const supabase = createClient(url, publishableKey)
