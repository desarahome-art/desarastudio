// ============================================================
// Rumus add-on (murni, tanpa database) — dipakai bersama oleh:
//   - Server Action (submitBooking, addAddonsToBooking, kurangiAddonLapangan)
//   - Modal admin (ringkasan langsung)
//   - Unit test di folder tests/
// Satu sumber rumus supaya angka di layar = angka yang disimpan server.
// ============================================================

/** Fallback untuk add-on/booking lama yang belum punya menit_per_unit */
export const DEFAULT_MENIT_PER_UNIT = 15

type Jenis = 'waktu' | 'background' | 'orang' | 'cetak' | string

export interface AddonDurasiLike {
  jenis: Jenis
  menit_per_unit?: number | null
}

/** Menit per unit untuk add-on waktu (0 untuk jenis lain). */
export function getMenitPerUnit(a: AddonDurasiLike): number {
  if (a.jenis !== 'waktu') return 0
  const m = Number(a.menit_per_unit)
  return Number.isInteger(m) && m > 0 ? m : DEFAULT_MENIT_PER_UNIT
}

/** Label satuan add-on waktu mengikuti angka database, contoh "+20 menit". */
export function labelSatuanWaktu(a: AddonDurasiLike): string {
  return `+${getMenitPerUnit({ ...a, jenis: 'waktu' })} menit`
}

/** Total menit tambahan dari daftar add-on (hanya jenis waktu). */
export function hitungMenitAddon(rows: Array<AddonDurasiLike & { jumlah: number }>): number {
  return rows.reduce((sum, r) => sum + getMenitPerUnit(r) * (Number(r.jumlah) || 0), 0)
}

/** Total harga dari daftar add-on. */
export function hitungHargaAddon(rows: Array<{ harga: number; jumlah: number }>): number {
  return rows.reduce((sum, r) => sum + (Number(r.harga) || 0) * (Number(r.jumlah) || 0), 0)
}

/** Jumlah unit add-on tertentu yang sudah ada di booking (pesanan awal + tambahan admin). */
export function jumlahTerpakai(
  rows: Array<{ addon_id: string | null; jumlah: number }>,
  addonId: string
): number {
  return rows
    .filter(r => r.addon_id === addonId)
    .reduce((sum, r) => sum + (Number(r.jumlah) || 0), 0)
}

/** Sisa kuota yang masih boleh ditambahkan (tidak pernah negatif). */
export function sisaKuota(
  maks: number,
  rows: Array<{ addon_id: string | null; jumlah: number }>,
  addonId: string
): number {
  return Math.max(0, (Number(maks) || 0) - jumlahTerpakai(rows, addonId))
}

// ------------------------------------------------------------
// Add-on di lapangan
// ------------------------------------------------------------

export interface MasterAddon {
  id: string
  jenis: Jenis
  nama: string
  satuan: string
  harga: number
  maks: number
  menit_per_unit?: number | null
}

export interface BarisBookingAddon {
  id: string
  addon_id: string | null
  jenis: Jenis
  nama: string
  satuan: string
  harga: number
  jumlah: number
  menit_per_unit?: number | null
  ditambah_oleh_admin?: boolean | null
}

export interface ItemLapangan {
  addon_id: string
  jumlah: number
}

export interface BarisBaru {
  addon_id: string
  jenis: Jenis
  nama: string
  satuan: string
  harga: number
  jumlah: number
  menit_per_unit: number | null
}

export interface RencanaPerubahan {
  /** Baris tambahan admin yang jumlahnya diganti (0 = hapus) */
  updateRows: Array<{ id: string; jumlah: number }>
  /** Baris baru (selalu ditandai ditambah_oleh_admin) */
  insertRows: BarisBaru[]
  deltaHarga: number
  deltaMenit: number
  /** Total unit add-on background yang ditambahkan (= kuota warna tambahan) */
  tambahanBackground: number
  adaCetak: boolean
  rincian: string[]
}

export type HasilRencana =
  | { ok: true; rencana: RencanaPerubahan }
  | { ok: false; error: string }

/**
 * Menyusun rencana penambahan add-on di lapangan.
 * - Item dengan addon_id sama dijumlahkan dulu.
 * - Batas maks dihitung dari jumlah lama (awal + tambahan) + jumlah baru.
 * - Jika sudah ada baris TAMBAHAN ADMIN untuk add-on itu dengan harga & menit yang
 *   sama, jumlahnya ditambah (tidak membuat baris ganda). Baris pesanan awal klien
 *   tidak pernah diubah. Jika harga master sudah berubah, dibuat baris baru agar
 *   harga lama tetap tersimpan apa adanya.
 * - allowedAddonIds: add-on yang aktif untuk kategori booking (null = tidak dibatasi).
 */
export function rencanakanTambahAddon(
  existing: BarisBookingAddon[],
  masters: MasterAddon[],
  items: ItemLapangan[],
  allowedAddonIds: Set<string> | null = null
): HasilRencana {
  const gabungan = new Map<string, number>()
  for (const it of items || []) {
    const qty = Number(it?.jumlah)
    if (!it?.addon_id || !Number.isInteger(qty) || qty < 0) {
      return { ok: false, error: 'Jumlah add-on harus bilangan bulat positif.' }
    }
    if (qty === 0) continue
    gabungan.set(it.addon_id, (gabungan.get(it.addon_id) || 0) + qty)
  }
  if (gabungan.size === 0) {
    return { ok: false, error: 'Pilih minimal satu add-on dengan jumlah lebih dari 0.' }
  }

  const masterMap = new Map(masters.map(m => [m.id, m]))
  const rencana: RencanaPerubahan = {
    updateRows: [],
    insertRows: [],
    deltaHarga: 0,
    deltaMenit: 0,
    tambahanBackground: 0,
    adaCetak: false,
    rincian: [],
  }

  for (const [addonId, qty] of Array.from(gabungan.entries())) {
    const master = masterMap.get(addonId)
    if (!master) return { ok: false, error: 'Add-on tidak ditemukan atau sudah dihapus.' }
    if (allowedAddonIds && !allowedAddonIds.has(addonId)) {
      return { ok: false, error: `Add-on "${master.nama}" tidak aktif untuk kategori booking ini.` }
    }

    const terpakai = jumlahTerpakai(existing, addonId)
    if (terpakai + qty > master.maks) {
      return {
        ok: false,
        error: `Jumlah "${master.nama}" melebihi batas. Maks ${master.maks}, sudah ada ${terpakai}, sisa kuota ${Math.max(0, master.maks - terpakai)}.`,
      }
    }

    const menit = master.jenis === 'waktu' ? getMenitPerUnit(master) : null
    const barisAdmin = existing.find(
      r =>
        r.ditambah_oleh_admin === true &&
        r.addon_id === addonId &&
        Number(r.harga) === Number(master.harga) &&
        (master.jenis !== 'waktu' || getMenitPerUnit(r) === menit)
    )

    if (barisAdmin) {
      rencana.updateRows.push({ id: barisAdmin.id, jumlah: barisAdmin.jumlah + qty })
    } else {
      rencana.insertRows.push({
        addon_id: master.id,
        jenis: master.jenis,
        nama: master.nama,
        satuan: master.jenis === 'waktu' ? labelSatuanWaktu(master) : master.satuan,
        harga: master.harga,
        jumlah: qty,
        menit_per_unit: menit,
      })
    }

    rencana.deltaHarga += master.harga * qty
    rencana.deltaMenit += (menit || 0) * qty
    if (master.jenis === 'background') rencana.tambahanBackground += qty
    if (master.jenis === 'cetak') rencana.adaCetak = true
    rencana.rincian.push(`${master.nama} x${qty}`)
  }

  return { ok: true, rencana }
}

/**
 * Menyusun rencana pengurangan add-on tambahan admin.
 * jumlahKurang = jumlah unit yang dikurangi (sama dengan jumlah baris = hapus baris).
 */
export function rencanakanKurangiAddon(
  row: BarisBookingAddon,
  jumlahKurang: number
): HasilRencana {
  if (!row.ditambah_oleh_admin) {
    return { ok: false, error: 'Add-on pesanan awal klien tidak bisa dikurangi lewat fitur ini.' }
  }
  const k = Number(jumlahKurang)
  if (!Number.isInteger(k) || k < 1 || k > row.jumlah) {
    return { ok: false, error: `Jumlah pengurangan harus antara 1 dan ${row.jumlah}.` }
  }
  return {
    ok: true,
    rencana: {
      updateRows: [{ id: row.id, jumlah: row.jumlah - k }],
      insertRows: [],
      deltaHarga: -(Number(row.harga) || 0) * k,
      deltaMenit: -getMenitPerUnit(row) * k,
      tambahanBackground: 0,
      adaCetak: false,
      rincian: [`${row.nama} -${k}`],
    },
  }
}

/** Apakah paket (snapshot) sudah termasuk cetak. */
export function paketPunyaCetak(pkg?: { cetak_ukuran?: string | null; cetak_jumlah?: number | null } | null): boolean {
  return Boolean(pkg?.cetak_ukuran || (pkg?.cetak_jumlah && pkg.cetak_jumlah > 0))
}

/**
 * Tindakan status_cetak setelah perubahan add-on:
 * - 'menunggu'  : ada cetak baru dan booking belum punya status cetak
 * - 'kosongkan' : cetak terakhir dihapus, paket tanpa cetak, status masih 'menunggu'
 * - 'tetap'     : selain itu
 */
export function tentukanAksiCetak(params: {
  statusCetak: string | null | undefined
  paketPunyaCetak: boolean
  barisSetelah: Array<{ jenis: Jenis; jumlah: number }>
  adaCetakBaru: boolean
}): 'menunggu' | 'kosongkan' | 'tetap' {
  const { statusCetak, barisSetelah, adaCetakBaru } = params
  if (adaCetakBaru && !statusCetak) return 'menunggu'
  const masihAdaCetak = params.paketPunyaCetak || barisSetelah.some(r => r.jenis === 'cetak' && r.jumlah > 0)
  if (!masihAdaCetak && statusCetak === 'menunggu') return 'kosongkan'
  return 'tetap'
}

/** Terapkan rencana ke daftar baris (untuk pratinjau & test). */
export function terapkanRencanaKeBaris(
  existing: BarisBookingAddon[],
  rencana: RencanaPerubahan
): BarisBookingAddon[] {
  const updates = new Map(rencana.updateRows.map(u => [u.id, u.jumlah]))
  const hasil = existing
    .map(r => (updates.has(r.id) ? { ...r, jumlah: updates.get(r.id)! } : r))
    .filter(r => r.jumlah > 0)
  rencana.insertRows.forEach((b, i) =>
    hasil.push({ ...b, id: `baru-${i}`, ditambah_oleh_admin: true })
  )
  return hasil
}

/** Ringkasan uang & durasi booking setelah perubahan. */
export function ringkasanSetelah(
  booking: { total_harga: number; dp_dibayar: number; durasi_total: number },
  deltaHarga: number,
  deltaMenit: number
) {
  const totalBaru = Math.max(0, (Number(booking.total_harga) || 0) + deltaHarga)
  const durasiBaru = Math.max(1, (Number(booking.durasi_total) || 0) + deltaMenit)
  const dp = Number(booking.dp_dibayar) || 0
  return { totalBaru, dp, sisaBaru: totalBaru - dp, durasiBaru }
}
