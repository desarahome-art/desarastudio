import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getCleanUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  return url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')
}

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    getCleanUrl(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component, ignore
          }
        },
      },
    }
  )
}

export async function createAdminClient() {
  return createSupabaseClient(
    getCleanUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
