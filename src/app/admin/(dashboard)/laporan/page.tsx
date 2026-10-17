import { createClient } from '@/lib/supabase/server'
import { LaporanClient, type SaranHarga } from '@/components/admin/LaporanClient'
import { hariIniWIB, tambahHariWIB } from '@/lib/utils'
import type { PemasukanLaporan, PengeluaranLaporan } from '@/lib/laporan'

export const revalidate = 0

export default async function LaporanPage() {
  const supabase = await createClient()
  // Ambil 2 tahun terakhir saja agar halaman tetap ringan
  const mulai = tambahHariWIB(-730)

  const [
    { data: pemasukan, error: errMasuk },
    { data: pengeluaran, error: errKeluar },
    { data: packages },
    { data: addons },
  ] = await Promise.all([
    supabase
      .from('pemasukan')
      .select('id, tanggal, jenis, nama, jumlah, harga_satuan')
      .gte('tanggal', mulai)
      .order('created_at', { ascending: true }),
    supabase
      .from('pengeluaran')
      .select('id, tanggal, kategori, keterangan, jumlah')
      .gte('tanggal', mulai)
      .order('created_at', { ascending: true }),
    // Hanya untuk saran nama + harga di form input (tetap bisa diubah)
    supabase.from('packages').select('nama, harga').order('urutan', { ascending: true }),
    supabase.from('addons').select('nama, harga').order('urutan', { ascending: true }),
  ])

  // Jangan diam-diam tampil kosong: tampilkan penyebab bila query gagal
  const galat: string[] = []
  if (errMasuk) galat.push(`Data pemasukan gagal dimuat: ${errMasuk.message}`)
  if (errKeluar) galat.push(`Data pengeluaran gagal dimuat: ${errKeluar.message}`)

  const saran: SaranHarga = { Paket: {}, 'Add-on': {} }
  for (const p of packages || []) if (p.nama && !(p.nama in saran.Paket)) saran.Paket[p.nama] = Number(p.harga) || 0
  for (const a of addons || []) if (a.nama && !(a.nama in saran['Add-on'])) saran['Add-on'][a.nama] = Number(a.harga) || 0

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Laporan Keuangan</h1>
      <LaporanClient
        pemasukan={(pemasukan || []) as PemasukanLaporan[]}
        pengeluaran={(pengeluaran || []) as PengeluaranLaporan[]}
        saran={saran}
        hariIni={hariIniWIB()}
        galat={galat}
      />
    </div>
  )
}
