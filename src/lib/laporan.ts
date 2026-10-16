// ============================================================
// Hitung laporan keuangan (murni, tanpa database) — dipakai halaman Laporan dan unit test.
// Aturan:
//  - Hanya booking berstatus 'selesai' yang dihitung.
//  - Tanggal laporan = tanggal sesi foto (bookings.tanggal).
//  - Pendapatan = total_harga booking.
//  - Biaya cetak (otomatis) = total add-on berjenis 'cetak' pada booking yang sama.
//  - Pengeluaran manual = tabel pengeluaran.
//  - Laba bersih = pendapatan - biaya cetak - pengeluaran manual.
//  - Booking dibatalkan / pending / booking tidak dihitung (DP booking batal diabaikan).
// ============================================================

export interface BarisAddonLaporan {
  jenis: string
  total?: number | null
  harga?: number | null
  jumlah?: number | null
}

export interface BookingLaporan {
  id: string
  kode?: string
  nama_klien: string
  tanggal: string // YYYY-MM-DD
  jam_mulai: string
  status: string
  total_harga: number
  category_nama: string
  package_nama: string
  booking_addons?: BarisAddonLaporan[] | null
}

export interface PengeluaranLaporan {
  id: string
  tanggal: string
  kategori: string
  keterangan: string
  jumlah: number
}

export interface SesiLaporan {
  id: string
  kode?: string
  tanggal: string
  jam: string
  nama: string
  paket: string
  kategori: string
  harga: number
  cetak: number
}

export interface BarisRekap {
  nama: string
  sesi: number
  pendapatan: number
}

export interface Laporan {
  sesi: SesiLaporan[]
  pendapatan: number
  biayaCetak: number
  pengeluaranManual: number
  totalPengeluaran: number
  laba: number
  margin: number // persen, dibulatkan; 0 bila pendapatan 0
  rataRata: number
  perKategori: BarisRekap[]
  perPaket: BarisRekap[]
  pengeluaran: PengeluaranLaporan[]
  pengeluaranPerKategori: { nama: string; jumlah: number }[]
  perHari: { tanggal: string; sesi: number; pendapatan: number; pengeluaran: number }[]
  hariTersibuk: string | null
}

export const KATEGORI_PENGELUARAN = [
  'Sewa & utilitas',
  'Properti & dekorasi',
  'Peralatan & perawatan',
  'Honor / fee',
  'Promosi',
  'Operasional lain',
  'Lainnya',
] as const

export const NAMA_BIAYA_CETAK = 'Cetak foto (otomatis)'

function angka(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

/** Biaya cetak satu booking = total add-on berjenis cetak (harga x jumlah bila total kosong). */
export function hitungBiayaCetak(addons?: BarisAddonLaporan[] | null): number {
  if (!addons) return 0
  let s = 0
  for (const a of addons) {
    if (a.jenis !== 'cetak') continue
    s += a.total != null ? angka(a.total) : angka(a.harga) * angka(a.jumlah ?? 1)
  }
  return s
}

function normJam(j: string): string {
  return String(j || '').slice(0, 5)
}

function rekap(sesi: SesiLaporan[], key: 'kategori' | 'paket'): BarisRekap[] {
  const m = new Map<string, BarisRekap>()
  for (const s of sesi) {
    const nama = s[key] || '-'
    const r = m.get(nama) || { nama, sesi: 0, pendapatan: 0 }
    r.sesi += 1
    r.pendapatan += s.harga
    m.set(nama, r)
  }
  return Array.from(m.values()).sort((a, b) => b.pendapatan - a.pendapatan || a.nama.localeCompare(b.nama))
}

/** Hitung laporan untuk rentang tanggal [dari, sampai] (inklusif, YYYY-MM-DD). */
export function hitungLaporan(
  bookings: BookingLaporan[],
  pengeluaran: PengeluaranLaporan[],
  dari: string,
  sampai: string
): Laporan {
  const sesi: SesiLaporan[] = bookings
    .filter(b => b.status === 'selesai' && b.tanggal >= dari && b.tanggal <= sampai)
    .map(b => ({
      id: b.id,
      kode: b.kode,
      tanggal: b.tanggal,
      jam: normJam(b.jam_mulai),
      nama: b.nama_klien,
      paket: b.package_nama,
      kategori: b.category_nama,
      harga: angka(b.total_harga),
      cetak: hitungBiayaCetak(b.booking_addons),
    }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.jam.localeCompare(b.jam))

  const peng = pengeluaran
    .filter(p => p.tanggal >= dari && p.tanggal <= sampai)
    .map(p => ({ ...p, jumlah: angka(p.jumlah) }))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))

  const pendapatan = sesi.reduce((s, x) => s + x.harga, 0)
  const biayaCetak = sesi.reduce((s, x) => s + x.cetak, 0)
  const pengeluaranManual = peng.reduce((s, x) => s + x.jumlah, 0)
  const totalPengeluaran = biayaCetak + pengeluaranManual
  const laba = pendapatan - totalPengeluaran

  const pk = new Map<string, number>()
  for (const p of peng) pk.set(p.kategori, (pk.get(p.kategori) || 0) + p.jumlah)
  if (biayaCetak > 0) pk.set(NAMA_BIAYA_CETAK, biayaCetak)
  const pengeluaranPerKategori = Array.from(pk.entries())
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama))

  const hari = new Map<string, { tanggal: string; sesi: number; pendapatan: number; pengeluaran: number }>()
  const ambil = (t: string) => {
    let h = hari.get(t)
    if (!h) { h = { tanggal: t, sesi: 0, pendapatan: 0, pengeluaran: 0 }; hari.set(t, h) }
    return h
  }
  for (const s of sesi) { const h = ambil(s.tanggal); h.sesi += 1; h.pendapatan += s.harga; h.pengeluaran += s.cetak }
  for (const p of peng) ambil(p.tanggal).pengeluaran += p.jumlah
  const perHari = Array.from(hari.values()).sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  let hariTersibuk: string | null = null
  let maks = 0
  for (const h of perHari) {
    if (h.pendapatan > maks) { maks = h.pendapatan; hariTersibuk = h.tanggal }
  }

  return {
    sesi,
    pendapatan,
    biayaCetak,
    pengeluaranManual,
    totalPengeluaran,
    laba,
    margin: pendapatan > 0 ? Math.round((laba / pendapatan) * 100) : 0,
    rataRata: sesi.length > 0 ? Math.round(pendapatan / sesi.length) : 0,
    perKategori: rekap(sesi, 'kategori'),
    perPaket: rekap(sesi, 'paket'),
    pengeluaran: peng,
    pengeluaranPerKategori,
    perHari,
    hariTersibuk,
  }
}

/** Awal & akhir bulan dari "YYYY-MM". */
export function rentangBulan(bulan: string): { dari: string; sampai: string } {
  const [y, m] = bulan.split('-').map(Number)
  const akhir = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { dari: `${y}-${mm}-01`, sampai: `${y}-${mm}-${String(akhir).padStart(2, '0')}` }
}

/** Bulan sebelumnya dari "YYYY-MM". */
export function bulanSebelumnya(bulan: string): string {
  const [y, m] = bulan.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 2, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Selisih persen terhadap pembanding; null bila pembanding 0. */
export function selisihPersen(sekarang: number, lalu: number): number | null {
  if (lalu <= 0) return null
  return Math.round(((sekarang - lalu) / lalu) * 100)
}

function csvSel(v: string | number): string {
  let s = String(v)
  // Cegah formula Excel dari teks bebas (keterangan/nama klien): awali dengan apostrof
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV laporan (pemisah titik koma agar terbuka benar di Excel Indonesia). */
export function buatCsv(l: Laporan, judul: string): string {
  const baris: (string | number)[][] = [
    [judul],
    [],
    ['Ringkasan'],
    ['Pendapatan', l.pendapatan],
    ['Biaya cetak (otomatis)', l.biayaCetak],
    ['Pengeluaran manual', l.pengeluaranManual],
    ['Laba bersih', l.laba],
    [],
    ['Sesi selesai'],
    ['Tanggal', 'Jam', 'Klien', 'Paket', 'Kategori', 'Total', 'Biaya cetak'],
    ...l.sesi.map(s => [s.tanggal, s.jam, s.nama, s.paket, s.kategori, s.harga, s.cetak]),
    [],
    ['Pengeluaran manual'],
    ['Tanggal', 'Kategori', 'Keterangan', 'Jumlah'],
    ...l.pengeluaran.map(p => [p.tanggal, p.kategori, p.keterangan, p.jumlah]),
  ]
  return '﻿' + baris.map(r => r.map(csvSel).join(';')).join('\r\n')
}
