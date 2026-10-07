import { createClient } from '@/lib/supabase/server'
import { WaitingListClient } from '@/components/admin/WaitingListClient'

export const revalidate = 0

export default async function WaitingListPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('waiting_list')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: user } = await supabase.auth.getUser()

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Waiting List</h1>
      <WaitingListClient
        items={data || []}
        adminEmail={user.user?.email || ''}
      />
    </div>
  )
}

