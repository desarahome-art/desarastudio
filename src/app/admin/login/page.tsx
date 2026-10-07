import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminLoginForm } from '@/components/admin/AdminLoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) redirect('/admin/bookings')

  return (
    <div className="min-h-screen flex items-center justify-center bg-[rgb(var(--color-cream))] px-4">
      <AdminLoginForm />
    </div>
  )
}
