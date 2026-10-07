import { createClient } from '@/lib/supabase/server'
import { WaitingListClient } from '@/components/admin/WaitingListClient'
import { WisudaEventManager } from '@/components/admin/WisudaEventManager'
import type { WisudaEvent } from '@/types'

export const revalidate = 0

export default async function WaitingListPage() {
  const supabase = await createClient()

  const [
    { data: waitingList },
    { data: wisudaEvents },
    { data: userAuth },
    { data: settingsRow },
  ] = await Promise.all([
    supabase.from('waiting_list').select('*').order('created_at', { ascending: false }),
    supabase.from('wisuda_events').select('*').order('created_at', { ascending: false }),
    supabase.auth.getUser(),
    supabase.from('settings').select('value').eq('key', 'closed_dates').single(),
  ])

  const closedDates = Array.isArray(settingsRow?.value) ? settingsRow.value : []

  return (
    <div className="flex flex-col gap-8">

      {/* ── Manajemen Acara Wisuda ── */}
      <section className="p-5 sm:p-6 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
        <WisudaEventManager events={(wisudaEvents || []) as WisudaEvent[]} />
      </section>

      {/* ── Daftar Waiting List ── */}
      <section>
        <h1 className="font-heading text-2xl font-bold mb-4">Daftar Waiting List</h1>
        <WaitingListClient
          items={waitingList || []}
          adminEmail={userAuth.user?.email || ''}
          closedDates={closedDates}
        />
      </section>

    </div>
  )
}
