import { createClient } from '@/lib/supabase/server'
import { BookingsClient } from '@/components/admin/BookingsClient'
import type { BackgroundItem } from '@/types'

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
      .in('key', ['backgrounds', 'jam_tutup', 'jam_buka']),
  ])

  let availableBackgrounds: BackgroundItem[] = []
  let jamTutup = '20:00'
  if (settingsRows) {
    for (const s of settingsRows) {
      if (s.key === 'backgrounds' && Array.isArray(s.value)) {
        availableBackgrounds = s.value as BackgroundItem[]
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
        initialBookings={bookings || []}
        packages={packages || []}
        categories={categories || []}
        addons={addons || []}
        addonCategories={addonCategories || []}
        availableBackgrounds={availableBackgrounds}
        jamTutup={jamTutup}
        adminEmail={user.user?.email || ''}
      />
    </div>
  )
}
