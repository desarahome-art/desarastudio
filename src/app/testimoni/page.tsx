import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { TestimoniForm } from '@/components/testimoni/TestimoniForm'

export const dynamic = 'force-dynamic'

// Halaman ini tidak ditautkan dari mana pun: admin mengirim linknya lewat WhatsApp.
export const metadata: Metadata = {
  title: 'Testimoni — Desara Home Studio',
  robots: { index: false, follow: false },
}

export default async function TestimoniPage() {
  let namaPaket: string[] = []
  try {
    const supabase = await createClient()
    const { data } = await supabase.from('packages').select('nama, urutan').eq('aktif', true).order('urutan', { ascending: true })
    const unik = new Set<string>()
    for (const p of data || []) if (p.nama) unik.add(String(p.nama))
    namaPaket = Array.from(unik)
  } catch {
    // form tetap jalan tanpa pilihan paket
  }

  return (
    <main className="min-h-screen flex items-start sm:items-center justify-center px-4 py-8">
      <TestimoniForm daftarPaket={namaPaket} />
    </main>
  )
}
