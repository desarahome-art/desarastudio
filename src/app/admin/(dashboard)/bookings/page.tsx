import { createClient } from '@/lib/supabase/server'
import { BookingsClient } from '@/components/admin/BookingsClient'
import { normalizeTime } from '@/lib/utils'
import type { BackgroundItem, ClosedDateItem } from '@/types'

export const revalidate = 0

export default async function BookingsPage() {
  const supabase = await createClient()

  const [
    { data: bookings },
    { data: packages },
    { data: categories },
    { data: addons },
    { data: addonCategories },
    { data: settingsRows },
  ] = await Promise.all([
    supabase
      .from('bookings')
      .select('*, booking_addons(*)')
      .order('created_at', { ascending: false }),
    supabase
      .from('packages')
      .select('*')
      .order('urutan', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .order('urutan', { ascending: true }),
    supabase
      .from('addons')
      .select('*')
      .order('urutan', { ascending: true }),
    supabase.from('addon_categories').select('*'),
    supabase
      .from('settings')
      .select('key, value')
      .in('key', ['backgrounds', 'jam_tutup', 'jam_buka', 'closed_dates', 'nama_studio']),
  ])

  let availableBackgrounds: BackgroundItem[] = []
  let jamTutup = '20:00'
  let closedDates: ClosedDateItem[] = []
  let namaStudio: string | undefined
  if (settingsRows) {
    for (const s of settingsRows) {
      if (s.key === 'backgrounds' && Array.isArray(s.value)) {
        availableBackgrounds = s.value as BackgroundItem[]
      }
      if (s.key === 'nama_studio' && typeof s.value === 'string' && s.value.trim()) {
        namaStudio = s.value.trim()
      }
      if (s.key === 'closed_dates' && Array.isArray(s.value)) {
        closedDates = s.value as ClosedDateItem[]
      }
      if (s.key === 'jam_tutup' && typeof s.value === 'string') {
        jamTutup = s.value
      }
    }
  }

  const { data: user } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Daftar Booking</h1>
      <BookingsClient
        // Jam dari database berbentuk "10:00:00"; tampilkan "10:00"
        initialBookings={(bookings || []).map(b => ({ ...b, jam_mulai: normalizeTime(b.jam_mulai) }))}
        packages={packages || []}
        categories={categories || []}
        addons={addons || []}
        addonCategories={addonCategories || []}
        availableBackgrounds={availableBackgrounds}
        jamTutup={jamTutup}
        closedDates={closedDates}
        namaStudio={namaStudio}
        adminEmail={user.user?.email || ''}
      />
    </div>
  )
}
