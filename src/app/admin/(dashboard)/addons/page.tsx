import { createClient } from '@/lib/supabase/server'
import { AddonsClient } from '@/components/admin/AddonsClient'

export const revalidate = 0

export default async function AddonsPage() {
  const supabase = await createClient()
  const [{ data: addons }, { data: categories }, { data: addonCategories }] = await Promise.all([
    supabase.from('addons').select('*').order('urutan'),
    supabase.from('categories').select('*').order('urutan'),
    supabase.from('addon_categories').select('*'),
  ])

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Manajemen Add-on</h1>
      <AddonsClient
        initialAddons={addons || []}
        categories={categories || []}
        initialAddonCategories={addonCategories || []}
      />
    </div>
  )
}
