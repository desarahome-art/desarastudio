import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '')
    .replace(/\/rest\/v1\/?$/, '')
    .replace(/\/+$/, '')
  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
