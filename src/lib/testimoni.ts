// ============================================================
// Logika murni testimoni (tanpa database) — dipakai form, halaman tampil, server action, dan tes.
// ============================================================

export const NAMA_MIN = 2
export const NAMA_MAX = 40
export const ISI_MIN = 10
export const ISI_MAX = 400
/** Maksimal kiriman per pengirim (hash IP) dalam 24 jam */
export const BATAS_KIRIM_PER_HARI = 2
/** Maksimal kiriman dari semua pengirim dalam 1 jam (pengaman spam terdistribusi) */
export const BATAS_KIRIM_GLOBAL_PER_JAM = 30

export type StatusTestimoni = 'menunggu' | 'disetujui' | 'disembunyikan'

export interface TestimoniInput {
  nama: unknown
  paket?: unknown
  bintang: unknown
  isi: unknown
}

export interface TestimoniBersih {
  nama: string
  paket: string | null
  bintang: number
  isi: string
}

export function bersihkanTeks(teks: unknown): string {
  return String(teks ?? '')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validasiTestimoni(
  input: TestimoniInput,
  daftarPaket: string[] = []
): { error: string } | { data: TestimoniBersih } {
  const nama = bersihkanTeks(input?.nama)
  const isi = bersihkanTeks(input?.isi)
  const bintang = Number(input?.bintang)
  const paketMentah = bersihkanTeks(input?.paket)

  if (nama.length < NAMA_MIN) return { error: 'Nama wajib diisi.' }
  if (nama.length > NAMA_MAX) return { error: `Nama maksimal ${NAMA_MAX} karakter.` }
  if (!Number.isInteger(bintang) || bintang < 1 || bintang > 5) return { error: 'Pilih penilaian bintang 1 sampai 5.' }
  if (isi.length < ISI_MIN) return { error: `Testimoni minimal ${ISI_MIN} karakter.` }
  if (isi.length > ISI_MAX) return { error: `Testimoni maksimal ${ISI_MAX} karakter.` }
  // Hanya nama paket yang ada di database yang diterima; selain itu dianggap kosong
  const paket = paketMentah && daftarPaket.includes(paketMentah) ? paketMentah : null

  return { data: { nama, paket, bintang, isi } }
}

/** Rata-rata bintang (1 desimal) dan jumlah testimoni. */
export function ringkasRating(items: Array<{ bintang: number }>): { rata: number; jumlah: number } {
  const jumlah = items.length
  if (jumlah === 0) return { rata: 0, jumlah: 0 }
  const total = items.reduce((s, t) => s + t.bintang, 0)
  return { rata: Math.round((total / jumlah) * 10) / 10, jumlah }
}

/**
 * Bagi testimoni ke beberapa baris (bergantian), lalu ulang tiap baris sampai cukup panjang
 * agar animasi berjalan tidak menyisakan ruang kosong. Komponen menggandakan hasilnya sekali lagi
 * untuk perulangan mulus (-50%).
 */
export function susunBarisMarquee<T>(items: T[], jumlahBaris = 2, minPerBaris = 6): T[][] {
  if (items.length === 0) return []
  const baris = items.length >= jumlahBaris * 2 ? jumlahBaris : 1
  const hasil: T[][] = Array.from({ length: baris }, () => [])
  items.forEach((it, i) => hasil[i % baris].push(it))
  return hasil.map(b => {
    const ulang: T[] = []
    while (ulang.length < minPerBaris) ulang.push(...b)
    return ulang
  })
}
