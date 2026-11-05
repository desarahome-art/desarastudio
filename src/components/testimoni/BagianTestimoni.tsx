import { createClient } from '@/lib/supabase/server'
import { TestimoniBerjalan, type TestimoniTampil } from './TestimoniBerjalan'

/** Testimoni yang sudah disetujui admin, terbaru dulu. Gagal baca = daftar kosong. */
async function ambilTestimoniDisetujui(batas = 60): Promise<TestimoniTampil[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('testimoni')
      .select('id, nama, paket, bintang, isi')
      .eq('status', 'disetujui')
      .order('disetujui_pada', { ascending: false, nullsFirst: false })
      .limit(batas)
    return (data || []) as TestimoniTampil[]
  } catch {
    return []
  }
}

/**
 * Bilah testimoni yang menempel di dasar layar halaman utama: hanya kartu testimoni yang berjalan,
 * selalu terlihat tanpa perlu scroll. Tidak tampil bila belum ada testimoni yang disetujui.
 */
export async function BagianTestimoni() {
  const items = await ambilTestimoniDisetujui(30)
  if (items.length === 0) return null

  return (
    <>
      {/* Ruang kosong setinggi bilah agar isi halaman paling bawah tidak tertutup */}
      <div aria-hidden="true" className="h-36 print:hidden" />
      <section
        aria-label="Testimoni client"
        className="fixed bottom-0 inset-x-0 z-30 print:hidden border-t border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream))]/95 backdrop-blur py-3 overflow-hidden"
      >
        <TestimoniBerjalan items={items} kompak />
      </section>
    </>
  )
}
