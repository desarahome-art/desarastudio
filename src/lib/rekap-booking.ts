// ============================================================
// Rekap daftar booking (murni, tanpa database) — dipakai halaman Booking dan unit test.
// Menghitung dari booking yang SEDANG TAMPIL: jumlah client dan jumlah cetak per ukuran.
//  - Booking dibatalkan tidak dihitung.
//  - Cetak = cetak bawaan paket (cetak_ukuran x cetak_jumlah) + add-on cetak (jumlah per add-on).
// ============================================================

export interface BookingRekapLike {
  status: string
  package_snapshot?: { cetak_ukuran?: string | null; cetak_jumlah?: number | null } | null
  booking_addons?: Array<{
    jenis: string
    nama: string
    jumlah: number
    addon_id?: string | null
  }> | null
}

export interface BarisCetak {
  ukuran: string
  lembar: number
  dariPaket: number
  dariAddon: number
}

export interface RekapBooking {
  client: number
  dibatalkan: number
  cetak: BarisCetak[]
  totalLembar: number
}

/** "12 r", "12R", "Cetak 12R" -> "12R". Selain pola angka+R, dikembalikan apa adanya (huruf besar). */
export function normalisasiUkuran(teks?: string | null): string {
  const t = String(teks ?? '').trim()
  if (!t) return ''
  const m = t.match(/(\d+)\s*R\b/i)
  if (m) return `${Number(m[1])}R`
  return t.toUpperCase()
}

function nilaiUrut(ukuran: string): number {
  const m = ukuran.match(/^(\d+)R$/)
  return m ? Number(m[1]) : Number.POSITIVE_INFINITY
}

/**
 * @param ukuranAddon peta addon_id -> ukuran dari master add-on (opsional). Dipakai lebih dulu;
 *                    bila kosong, ukuran dibaca dari nama add-on ("Cetak 12R").
 */
export function hitungRekapBooking(
  bookings: BookingRekapLike[],
  ukuranAddon: Record<string, string | null | undefined> = {}
): RekapBooking {
  const peta = new Map<string, BarisCetak>()
  const tambah = (ukuran: string, jumlah: number, dari: 'paket' | 'addon') => {
    if (!(jumlah > 0)) return
    const key = ukuran || 'Tanpa ukuran'
    const r = peta.get(key) || { ukuran: key, lembar: 0, dariPaket: 0, dariAddon: 0 }
    r.lembar += jumlah
    if (dari === 'paket') r.dariPaket += jumlah
    else r.dariAddon += jumlah
    peta.set(key, r)
  }

  let client = 0
  let dibatalkan = 0
  for (const b of bookings) {
    if (b.status === 'dibatalkan') {
      dibatalkan += 1
      continue
    }
    client += 1

    const p = b.package_snapshot
    const ukuranPaket = normalisasiUkuran(p?.cetak_ukuran)
    const jumlahPaket = Number(p?.cetak_jumlah)
    if (ukuranPaket || jumlahPaket > 0) {
      // Sama dengan tampilan kartu booking: ukuran ada tetapi jumlah kosong dianggap 1 lembar
      tambah(ukuranPaket, jumlahPaket > 0 ? jumlahPaket : 1, 'paket')
    }

    for (const a of b.booking_addons || []) {
      if (a.jenis !== 'cetak') continue
      const master = a.addon_id ? ukuranAddon[a.addon_id] : null
      const ukuran = normalisasiUkuran(master) || normalisasiUkuran(a.nama)
      tambah(ukuran, Number(a.jumlah) || 0, 'addon')
    }
  }

  const cetak = Array.from(peta.values()).sort(
    (a, b) => nilaiUrut(a.ukuran) - nilaiUrut(b.ukuran) || a.ukuran.localeCompare(b.ukuran)
  )
  return { client, dibatalkan, cetak, totalLembar: cetak.reduce((s, r) => s + r.lembar, 0) }
}
