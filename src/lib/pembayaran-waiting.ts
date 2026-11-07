// ============================================================
// Pembayaran Waiting List (murni, tanpa database) — dipakai halaman admin, server action, dan tes.
// dibayar = total yang sudah dikonfirmasi admin; harga = harga paket yang dipilih client.
// ============================================================

export type StatusBayarWaiting = 'menunggu' | 'dp' | 'lunas'
export type JenisPembayaranWaiting = 'dp' | 'cicilan' | 'pelunasan' | 'koreksi'

export const LABEL_STATUS_BAYAR: Record<StatusBayarWaiting, string> = {
  menunggu: 'DP belum dicek', // beda dari badge kontak "Menunggu Konfirmasi"
  dp: 'DP',
  lunas: 'Lunas',
}

export const LABEL_JENIS: Record<JenisPembayaranWaiting, string> = {
  dp: 'DP',
  cicilan: 'Cicilan',
  pelunasan: 'Pelunasan',
  koreksi: 'Koreksi',
}

export function statusBayarWaiting(harga: number, dibayar: number): StatusBayarWaiting {
  if (!(dibayar > 0)) return 'menunggu'
  if (harga > 0 && dibayar >= harga) return 'lunas'
  return 'dp'
}

/** Pembayaran pertama = DP; yang menutup sisa = pelunasan; selain itu cicilan. */
export function jenisPembayaranWaiting(sudah: number, jumlah: number, harga: number): JenisPembayaranWaiting {
  if (harga > 0 && sudah + jumlah >= harga) return 'pelunasan'
  if (!(sudah > 0)) return 'dp'
  return 'cicilan'
}

/** Pesan galat bila pembayaran tidak boleh dicatat, atau null bila boleh. */
export function cekPembayaranWaiting(harga: number, sudah: number, jumlah: number): string | null {
  if (!(harga > 0)) return 'Harga paket belum diketahui. Pastikan paket client masih aktif di menu Paket.'
  if (!Number.isInteger(jumlah) || jumlah <= 0) return 'Isi jumlah pembayaran.'
  const sisa = harga - sudah
  if (sisa <= 0) return 'Waiting list ini sudah lunas.'
  if (jumlah > sisa) return `Melebihi sisa pelunasan (Rp ${sisa.toLocaleString('id-ID')}).`
  return null
}

/** Pesan galat untuk koreksi total dibayar, atau null bila boleh. */
export function cekKoreksiWaiting(harga: number, lama: number, baru: number, alasan: string): string | null {
  if (!Number.isInteger(baru) || baru < 0) return 'Nominal tidak valid.'
  if (harga > 0 && baru > harga) return `Tidak boleh melebihi harga paket (Rp ${harga.toLocaleString('id-ID')}).`
  if (baru === lama) return 'Nominal masih sama dengan sebelumnya.'
  if (String(alasan || '').trim().length < 3) return 'Isi alasan koreksi.'
  return null
}

export interface PaketLike {
  id: string
  category_id: string | null
  nama: string
  harga: number
  aktif?: boolean
  urutan?: number | null
}

/**
 * Paket untuk satu waiting list — aturan yang SAMA dengan saat dipindah ke booking:
 * paket aktif di kategori itu, cocokkan nama (tanpa beda huruf besar/kecil), bila tidak ada pakai paket pertama.
 */
export function cariPaketWaiting<P extends PaketLike>(
  packages: P[],
  categoryId: string | null | undefined,
  packageNama: string | null | undefined
): P | undefined {
  const kandidat = packages
    .filter(p => p.category_id === categoryId && p.aktif !== false)
    .sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0))
  if (kandidat.length === 0) return undefined
  const nama = String(packageNama || '').trim().toLowerCase()
  return (nama && kandidat.find(p => p.nama.toLowerCase() === nama)) || kandidat[0]
}

export interface RingkasanWaiting {
  menunggu: number
  dp: number
  lunas: number
  uangMasuk: number
}

/** Ringkasan untuk waiting list yang BELUM dipindah ke booking. */
export function ringkasPembayaranWaiting(
  items: Array<{ harga: number; dibayar: number; sudahBooking: boolean }>
): RingkasanWaiting {
  const r: RingkasanWaiting = { menunggu: 0, dp: 0, lunas: 0, uangMasuk: 0 }
  for (const it of items) {
    if (it.sudahBooking) continue
    r[statusBayarWaiting(it.harga, it.dibayar)] += 1
    r.uangMasuk += Math.max(0, it.dibayar)
  }
  return r
}
