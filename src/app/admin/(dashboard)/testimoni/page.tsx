import { createClient } from '@/lib/supabase/server'
import { TestimoniAdminClient, type TestimoniAdmin } from '@/components/admin/TestimoniAdminClient'

export const revalidate = 0

export default async function AdminTestimoniPage() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('testimoni')
    .select('id, nama, paket, bintang, isi, status, created_at')
    .order('created_at', { ascending: false })
    .limit(300)

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Testimoni</h1>
      {error && (
        <p className="mb-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          Data testimoni gagal dimuat: {error.message}. Pastikan migrasi 009_testimoni.sql sudah dijalankan.
        </p>
      )}
      <TestimoniAdminClient items={(data || []) as TestimoniAdmin[]} />
    </div>
  )
}
