// ============================================================
// Pembayaran Booking (murni, tanpa database) — disamakan dengan sistem Waiting List.
// bookings.dp_dibayar = total yang sudah dibayar. Riwayat disimpan sebagai teks di booking_status_log
// (ditulis catatPembayaran, koreksiPembayaran, pelunasan otomatis, dan konversi waiting list);
// file ini mengubah teks itu menjadi baris yang rapi.
// ============================================================

export type StatusBayarBooking = 'belum_dicek' | 'belum_bayar' | 'dp' | 'lunas' | 'batal'

export interface BookingBayarLike {
  status: string
  total_harga: number | null
  dp_dibayar: number | null
}

export function angkaBayar(b: BookingBayarLike) {
  const total = Number(b.total_harga) || 0
  const dibayar = Math.max(0, Number(b.dp_dibayar) || 0)
  return { total, dibayar, sisa: total - dibayar }
}

/**
 * - Menunggu (pending) + ada DP  -> DP belum dicek (dicek saat admin klik Setujui)
 * - belum ada uang                -> Belum bayar
 * - sisa <= 0                     -> Lunas
 * - Dibatalkan                    -> batal (uang yang sudah masuk tidak dikembalikan otomatis)
 */
export function statusBayarBooking(b: BookingBayarLike): StatusBayarBooking {
  const { dibayar, sisa } = angkaBayar(b)
  if (b.status === 'dibatalkan') return 'batal'
  if (sisa <= 0) return 'lunas'
  if (dibayar <= 0) return 'belum_bayar'
  if (b.status === 'pending') return 'belum_dicek'
  return 'dp'
}

export interface RingkasanBayarBooking {
  belumDicek: number
  belumLunas: number
  sisaTagihan: number
  uangMasuk: number
}

/** Ringkasan dari booking yang sedang tampil. Uang masuk hanya dari booking yang sudah disetujui/selesai. */
export function ringkasPembayaranBooking(bookings: BookingBayarLike[]): RingkasanBayarBooking {
  const r: RingkasanBayarBooking = { belumDicek: 0, belumLunas: 0, sisaTagihan: 0, uangMasuk: 0 }
  for (const b of bookings) {
    if (b.status === 'dibatalkan') continue
    const { dibayar, sisa } = angkaBayar(b)
    if (statusBayarBooking(b) === 'belum_dicek') r.belumDicek += 1
    if (sisa > 0) {
      r.belumLunas += 1
      r.sisaTagihan += sisa
    }
    if (b.status === 'booking' || b.status === 'selesai') r.uangMasuk += dibayar
  }
  return r
}

export interface BarisRiwayat {
  created_at: string
  label: string
  rincian?: string
  /** Selisih "sudah dibayar" (koreksi bisa negatif). null bila teks log tidak dikenali. */
  jumlah: number | null
  oleh?: string | null
}

const RP = String.raw`Rp\s?[\d.]+`
const keAngka = (s: string) => Number(String(s).replace(/[^0-9]/g, '')) || 0

/** Ubah satu teks log pembayaran menjadi baris rapi. Teks yang tidak dikenali tetap ditampilkan apa adanya. */
export function uraiLogPembayaran(catatan: string): Omit<BarisRiwayat, 'created_at' | 'oleh'> {
  const t = String(catatan || '').trim()
  let m: RegExpMatchArray | null

  m = t.match(new RegExp(`^Pembayaran pelunasan (${RP}) \\(otomatis saat sesi selesai\\)`))
  if (m) return { label: 'Pelunasan otomatis (sesi selesai)', jumlah: keAngka(m[1]) }

  m = t.match(new RegExp(`^Pembayaran dari waiting list (${RP}) · dibayar ${RP} → ${RP}(?: · (.+))?$`))
  if (m) return { label: 'Dari waiting list', rincian: m[2]?.trim() || undefined, jumlah: keAngka(m[1]) }

  m = t.match(new RegExp(`^Pembayaran (cicilan|pelunasan) (${RP}) \\((Tunai|Transfer)\\) · dibayar ${RP} → ${RP}(?: · (.+))?$`))
  if (m) {
    const rincian = [m[3].toLowerCase(), m[4]?.trim()].filter(Boolean).join(' · ')
    return { label: m[1] === 'pelunasan' ? 'Pelunasan' : 'Cicilan', rincian, jumlah: keAngka(m[2]) }
  }

  m = t.match(new RegExp(`^Koreksi pembayaran: dibayar (${RP}) → (${RP})(?: · alasan: (.+))?$`))
  if (m) return { label: 'Koreksi', rincian: m[3]?.trim() || undefined, jumlah: keAngka(m[2]) - keAngka(m[1]) }

  return { label: t, jumlah: null }
}

/** Nilai "sudah dibayar" sebelum log pertama = DP saat booking dibuat. */
export function dpSaatBooking(logPertama: string | undefined, dibayarSekarang: number): number {
  if (!logPertama) return dibayarSekarang
  const m = logPertama.match(new RegExp(`dibayar (${RP}) →`))
  return m ? keAngka(m[1]) : 0
}

/** Riwayat lengkap untuk kartu booking: baris "DP saat booking" (bila ada) + setiap log, urut waktu. */
export function susunRiwayatBooking(
  b: BookingBayarLike & { created_at?: string },
  logs: Array<{ catatan: string; oleh?: string | null; created_at: string }>
): BarisRiwayat[] {
  const urut = [...logs].sort((x, y) => x.created_at.localeCompare(y.created_at))
  const hasil: BarisRiwayat[] = []
  const dpAwal = dpSaatBooking(urut[0]?.catatan, angkaBayar(b).dibayar)
  if (dpAwal > 0) {
    hasil.push({
      created_at: b.created_at || urut[0]?.created_at || '',
      label: b.status === 'pending' && urut.length === 0 ? 'DP dari client (belum dicek)' : 'DP saat booking',
      jumlah: dpAwal,
    })
  }
  for (const l of urut) hasil.push({ ...uraiLogPembayaran(l.catatan), created_at: l.created_at, oleh: l.oleh })
  return hasil
}
