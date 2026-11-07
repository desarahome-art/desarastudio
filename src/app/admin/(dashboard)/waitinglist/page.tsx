import { createClient } from '@/lib/supabase/server'
import { WaitingListClient, type RiwayatBayarWaiting } from '@/components/admin/WaitingListClient'
import type { PaketLike } from '@/lib/pembayaran-waiting'
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
    { data: packages },
    { data: logBayar, error: errBayar },
    { data: dpRow },
  ] = await Promise.all([
    supabase.from('waiting_list').select('*').order('created_at', { ascending: false }),
    supabase.from('wisuda_events').select('*').order('created_at', { ascending: false }),
    supabase.auth.getUser(),
    supabase.from('settings').select('value').eq('key', 'closed_dates').single(),
    // Harga paket untuk menghitung sisa pembayaran (aturan pemilihan paket sama dengan saat dipindah ke booking)
    supabase.from('packages').select('id, category_id, nama, harga, aktif, urutan'),
    supabase
      .from('waiting_list_pembayaran')
      .select('id, waiting_list_id, jenis, jumlah, metode, catatan, oleh, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('settings').select('value').eq('key', 'dp_minimal').maybeSingle(),
  ])

  const riwayatBayar: Record<string, RiwayatBayarWaiting[]> = {}
  for (const r of (logBayar || []) as RiwayatBayarWaiting[]) {
    ;(riwayatBayar[r.waiting_list_id] ||= []).push(r)
  }
  const dpMinimal = Number(dpRow?.value) > 0 ? Number(dpRow?.value) : 100000

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
        {errBayar && (
          <p className="mb-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-xs text-rose-800">
            Riwayat pembayaran waiting list gagal dimuat ({errBayar.message}). Pastikan migrasi
            010_waiting_list_pembayaran.sql sudah dijalankan di Supabase.
          </p>
        )}
        <WaitingListClient
          items={waitingList || []}
          adminEmail={userAuth.user?.email || ''}
          closedDates={closedDates}
          packages={(packages || []) as PaketLike[]}
          riwayatBayar={riwayatBayar}
          dpMinimal={dpMinimal}
        />
      </section>

    </div>
  )
}
