import { createClient } from '@/lib/supabase/server'
import { LaporanClient } from '@/components/admin/LaporanClient'
import { hariIniWIB, tambahHariWIB, normalizeTime } from '@/lib/utils'
import type { BookingLaporan, PengeluaranLaporan } from '@/lib/laporan'

export const revalidate = 0

export default async function LaporanPage() {
  const supabase = await createClient()
  // Ambil 2 tahun terakhir saja agar halaman tetap ringan
  const mulai = tambahHariWIB(-730)

  const [{ data: bookings }, { data: pengeluaran }] = await Promise.all([
    supabase
      .from('bookings')
      .select('id, kode, nama_klien, tanggal, jam_mulai, status, total_harga, category_nama, package_nama, booking_addons(jenis, harga, jumlah, total)')
      .eq('status', 'selesai')
      .gte('tanggal', mulai)
      .order('tanggal', { ascending: true }),
    supabase
      .from('pengeluaran')
      .select('id, tanggal, kategori, keterangan, jumlah')
      .gte('tanggal', mulai)
      .order('tanggal', { ascending: false }),
  ])

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Laporan Keuangan</h1>
      <LaporanClient
        bookings={((bookings || []) as unknown as BookingLaporan[]).map(b => ({ ...b, jam_mulai: normalizeTime(b.jam_mulai) }))}
        pengeluaran={(pengeluaran || []) as PengeluaranLaporan[]}
        hariIni={hariIniWIB()}
      />
    </div>
  )
}
