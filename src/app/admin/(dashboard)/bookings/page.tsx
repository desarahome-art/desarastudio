import { createClient } from '@/lib/supabase/server'
import { BookingsClient } from '@/components/admin/BookingsClient'

export const revalidate = 0

export default async function BookingsPage() {
  const supabase = await createClient()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, booking_addons(*)')
    .order('created_at', { ascending: false })

  const { data: user } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Daftar Booking</h1>
      <BookingsClient
        initialBookings={bookings || []}
        adminEmail={user.user?.email || ''}
      />
    </div>
  )
}
