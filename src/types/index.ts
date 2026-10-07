// ============================================================
// Shared TypeScript types for Desara Home Studio
// ============================================================

export type BookingStatus = 'pending' | 'booking' | 'selesai' | 'dibatalkan'
export type AddonJenis = 'waktu' | 'background' | 'orang' | 'cetak'
export type CetakStatus = 'menunggu' | 'proses' | 'selesai'

export interface BackgroundItem {
  id?: string
  nama: string
  image_url?: string
}

export interface ClosedDateItem {
  tanggal: string // 'YYYY-MM-DD'
  keterangan: string
}

export interface Settings {
  nama_studio: string
  wa_admin: string
  rekening_bni: string
  rekening_bri?: string
  nama_rekening: string
  dp_minimal: number
  teks_sambutan: string
  tampilkan_waiting: boolean
  jam_buka: string
  jam_tutup: string
  slot_interval: number
  backgrounds: (string | BackgroundItem)[]
  closed_dates?: ClosedDateItem[]
}

export interface Category {
  id: string
  nama: string
  slug: string
  urutan: number
  aktif: boolean
  created_at: string
}

export interface Package {
  id: string
  category_id: string
  nama: string
  harga: number
  durasi_menit: number
  jumlah_pilihan_background: number
  maks_orang: number
  cetak_ukuran: string | null
  cetak_jumlah: number | null
  jumlah_foto_edit: number | null
  bonus: string | null
  urutan: number
  aktif: boolean
  created_at: string
}

export interface Addon {
  id: string
  jenis: AddonJenis
  nama: string
  satuan: string
  harga: number
  maks: number
  ukuran: string | null
  urutan: number
  created_at: string
}

export interface AddonCategory {
  addon_id: string
  category_id: string
}

export interface Booking {
  id: string
  kode: string
  nama_klien: string
  wa_klien: string
  kampus: string | null
  tanggal: string
  jam_mulai: string
  durasi_total: number
  category_id: string | null
  category_nama: string
  package_id: string | null
  package_nama: string
  package_harga: number
  package_snapshot: Package
  total_harga: number
  dp_dibayar: number
  sisa_pelunasan: number
  catatan: string | null
  pilihan_background: string[]
  bukti_transfer: string | null
  status: BookingStatus
  status_cetak: CetakStatus | null
  booking_addons?: BookingAddon[]
  created_at: string
  updated_at: string
}

export interface BookingAddon {
  id: string
  booking_id: string
  addon_id: string | null
  jenis: AddonJenis
  nama: string
  satuan: string
  harga: number
  jumlah: number
  total: number
}

export interface BookingStatusLog {
  id: string
  booking_id: string
  status_dari: BookingStatus | null
  status_ke: BookingStatus
  catatan: string | null
  oleh: string | null
  created_at: string
}

export interface WisudaEvent {
  id: string
  nama: string           // cth. "Wisuda UNTAN Oktober 2026"
  kampus: string         // cth. "Universitas Tanjungpura"
  keterangan?: string | null
  aktif: boolean
  created_at: string
}

export interface WaitingList {
  id: string
  nama: string
  wa: string
  category_id: string | null
  category_nama: string
  package_nama?: string | null    // paket foto yang dipilih client
  acara_id?: string | null        // id WisudaEvent yang dipilih
  acara_nama?: string | null      // nama event wisuda
  tanggal_ingin: string | null    // opsional / deprecated (digantikan acara)
  catatan: string | null
  sudah_dihubungi: boolean
  created_at: string
}

// ---- Form types ----

export interface BookingFormAddon {
  addon: Addon
  jumlah: number
}

export interface BookingFormData {
  nama: string
  category: Category
  package: Package
  pilihan_background: string[]
  wa_klien: string
  kampus: string
  tanggal: string
  jam_mulai: string
  catatan: string
  addons: BookingFormAddon[]
  dp_dibayar: number
  bukti_transfer?: string
}
