import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminNav } from '@/components/admin/AdminNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[rgb(var(--color-cream))]">
      <AdminNav userEmail={user.email || ''} />
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 min-h-screen">
        {children}
      </main>
    </div>
  )
}
