// ============================================================
// Helper background: filter per kategori & kuota pilihan
// ============================================================
import type { BackgroundItem } from '../types/index.ts'

/** Ubah daftar setting (string lama atau objek) menjadi BackgroundItem. */
export function normalisasiBackgrounds(
  list: ReadonlyArray<string | BackgroundItem> | null | undefined
): BackgroundItem[] {
  if (!Array.isArray(list)) return []
  return list
    .map(bg => (typeof bg === 'string' ? { nama: bg } : bg))
    .filter(bg => bg && typeof bg.nama === 'string' && bg.nama.trim() !== '')
}

/** True jika background tampil di kategori tersebut. kategori_ids tidak ada = semua kategori. */
export function backgroundTampilDiKategori(bg: BackgroundItem, categoryId: string | null | undefined): boolean {
  if (!Array.isArray(bg.kategori_ids)) return true
  if (!categoryId) return false
  return bg.kategori_ids.includes(categoryId)
}

/** Background yang boleh dipilih klien untuk satu kategori. */
export function backgroundsUntukKategori(
  list: ReadonlyArray<string | BackgroundItem> | null | undefined,
  categoryId: string | null | undefined
): BackgroundItem[] {
  return normalisasiBackgrounds(list).filter(bg => backgroundTampilDiKategori(bg, categoryId))
}

/** Kuota efektif: tidak boleh melebihi jumlah background yang tersedia. */
export function kuotaBackgroundEfektif(kuota: number, jumlahTersedia: number): number {
  const k = Number.isFinite(kuota) ? Math.max(0, Math.floor(kuota)) : 0
  return Math.min(k, Math.max(0, jumlahTersedia))
}
