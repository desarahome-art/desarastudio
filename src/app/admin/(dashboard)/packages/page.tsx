import { createClient } from '@/lib/supabase/server'
import { PackagesClient } from '@/components/admin/PackagesClient'

export const revalidate = 0

export default async function PackagesPage() {
  const supabase = await createClient()
  const [{ data: categories }, { data: packages }] = await Promise.all([
    supabase.from('categories').select('*').order('urutan'),
    supabase.from('packages').select('*').order('urutan'),
  ])

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Kategori & Paket</h1>
      <PackagesClient
        initialCategories={categories || []}
        initialPackages={packages || []}
      />
    </div>
  )
}
