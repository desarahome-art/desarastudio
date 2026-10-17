// ============================================================
// Laporan keuangan SERBA MANUAL (murni, tanpa database) — dipakai halaman Laporan dan unit test.
// Aturan:
//  - Hanya membaca tabel pemasukan & pengeluaran yang diisi admin. Booking tidak ikut dihitung.
//  - Client = jumlah pada baris pemasukan berjenis 'Paket'.
//  - Laba bersih = total pemasukan - total pengeluaran.
// ============================================================

export const JENIS_PEMASUKAN = ['Paket', 'Add-on', 'Lainnya'] as const
export type JenisPemasukan = (typeof JENIS_PEMASUKAN)[number]

export const KATEGORI_PENGELUARAN = [
  'Cetak foto',
  'Honor / fee',
  'Operasional lain',
  'Sewa & utilitas',
  'Properti & dekorasi',
  'Peralatan & perawatan',
  'Promosi',
  'Lainnya',
] as const

export interface PemasukanLaporan {
  id: string
  tanggal: string // YYYY-MM-DD
  jenis: JenisPemasukan
  nama: string
  jumlah: number
  harga_satuan: number
}

export interface PengeluaranLaporan {
  id: string
  tanggal: string
  kategori: string
  keterangan: string
  jumlah: number
}

export interface BarisItem {
  nama: string
  jenis: JenisPemasukan
  jumlah: number
  nilai: number
}

export interface BarisHari {
  tanggal: string
  client: number
  pemasukan: number
  pengeluaran: number
  laba: number
}

export interface Laporan {
  pemasukan: PemasukanLaporan[]
  pengeluaran: PengeluaranLaporan[]
  totalPemasukan: number
  totalPengeluaran: number
  laba: number
  margin: number // persen dibulatkan; 0 bila pemasukan 0
  client: number
  perItem: BarisItem[]
  perKategori: { nama: string; jumlah: number }[]
  perHari: BarisHari[]
}

function angka(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

export const subtotal = (p: Pick<PemasukanLaporan, 'jumlah' | 'harga_satuan'>) =>
  angka(p.jumlah) * angka(p.harga_satuan)

/** Hitung laporan untuk rentang tanggal [dari, sampai] (inklusif, YYYY-MM-DD). */
export function hitungLaporan(
  pemasukan: PemasukanLaporan[],
  pengeluaran: PengeluaranLaporan[],
  dari: string,
  sampai: string
): Laporan {
  const masuk = pemasukan
    .filter(p => p.tanggal >= dari && p.tanggal <= sampai)
    .map(p => ({ ...p, jumlah: angka(p.jumlah), harga_satuan: angka(p.harga_satuan) }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal) || JENIS_PEMASUKAN.indexOf(a.jenis) - JENIS_PEMASUKAN.indexOf(b.jenis))
  const keluar = pengeluaran
    .filter(p => p.tanggal >= dari && p.tanggal <= sampai)
    .map(p => ({ ...p, jumlah: angka(p.jumlah) }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  const totalPemasukan = masuk.reduce((s, p) => s + subtotal(p), 0)
  const totalPengeluaran = keluar.reduce((s, p) => s + p.jumlah, 0)
  const laba = totalPemasukan - totalPengeluaran
  const client = masuk.filter(p => p.jenis === 'Paket').reduce((s, p) => s + p.jumlah, 0)

  const item = new Map<string, BarisItem>()
  for (const p of masuk) {
    const key = `${p.jenis}|${p.nama.trim().toLowerCase()}`
    const r = item.get(key) || { nama: p.nama.trim(), jenis: p.jenis, jumlah: 0, nilai: 0 }
    r.jumlah += p.jumlah
    r.nilai += subtotal(p)
    item.set(key, r)
  }
  const perItem = Array.from(item.values()).sort((a, b) => b.nilai - a.nilai || a.nama.localeCompare(b.nama))

  const kat = new Map<string, number>()
  for (const p of keluar) kat.set(p.kategori, (kat.get(p.kategori) || 0) + p.jumlah)
  const perKategori = Array.from(kat.entries())
    .map(([nama, jumlah]) => ({ nama, jumlah }))
    .sort((a, b) => b.jumlah - a.jumlah || a.nama.localeCompare(b.nama))

  const hari = new Map<string, BarisHari>()
  const ambil = (t: string) => {
    let h = hari.get(t)
    if (!h) { h = { tanggal: t, client: 0, pemasukan: 0, pengeluaran: 0, laba: 0 }; hari.set(t, h) }
    return h
  }
  for (const p of masuk) {
    const h = ambil(p.tanggal)
    if (p.jenis === 'Paket') h.client += p.jumlah
    h.pemasukan += subtotal(p)
  }
  for (const p of keluar) ambil(p.tanggal).pengeluaran += p.jumlah
  const perHari = Array.from(hari.values())
    .map(h => ({ ...h, laba: h.pemasukan - h.pengeluaran }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal))

  return {
    pemasukan: masuk,
    pengeluaran: keluar,
    totalPemasukan,
    totalPengeluaran,
    laba,
    margin: totalPemasukan > 0 ? Math.round((laba / totalPemasukan) * 100) : 0,
    client,
    perItem,
    perKategori,
    perHari,
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
  // Cegah formula Excel dari teks bebas: awali dengan apostrof
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV laporan (pemisah titik koma agar terbuka benar di Excel Indonesia). */
export function buatCsv(l: Laporan, judul: string): string {
  const baris: (string | number)[][] = [
    [judul],
    [],
    ['Ringkasan'],
    ['Client', l.client],
    ['Total pemasukan', l.totalPemasukan],
    ['Total pengeluaran', l.totalPengeluaran],
    ['Laba bersih', l.laba],
    [],
    ['Per tanggal'],
    ['Tanggal', 'Client', 'Pemasukan', 'Pengeluaran', 'Laba'],
    ...l.perHari.map(h => [h.tanggal, h.client, h.pemasukan, h.pengeluaran, h.laba]),
    [],
    ['Pemasukan'],
    ['Tanggal', 'Jenis', 'Nama', 'Jumlah', 'Harga satuan', 'Subtotal'],
    ...l.pemasukan.map(p => [p.tanggal, p.jenis, p.nama, p.jumlah, p.harga_satuan, subtotal(p)]),
    [],
    ['Pengeluaran'],
    ['Tanggal', 'Kategori', 'Keterangan', 'Jumlah'],
    ...l.pengeluaran.map(p => [p.tanggal, p.kategori, p.keterangan, p.jumlah]),
  ]
  return '﻿' + baris.map(r => r.map(csvSel).join(';')).join('\r\n')
}
