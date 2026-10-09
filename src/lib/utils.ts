import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const DEFAULT_MAX_BOOKING_PER_SLOT = 1

export const MAX_BOOKING_PER_SLOT =
  Number(process.env.MAX_BOOKING_PER_SLOT || process.env.NEXT_PUBLIC_MAX_BOOKING_PER_SLOT) ||
  DEFAULT_MAX_BOOKING_PER_SLOT

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}

export function generateTimeSlots(
  jamBuka: string,
  jamTutup: string,
  intervalMenit: number
): string[] {
  const slots: string[] = []
  const [bukaH, bukaM] = jamBuka.split(':').map(Number)
  const [tutupH, tutupM] = jamTutup.split(':').map(Number)
  const start = bukaH * 60 + bukaM
  const end = tutupH * 60 + tutupM

  for (let t = start; t < end; t += intervalMenit) {
    const h = Math.floor(t / 60).toString().padStart(2, '0')
    const m = (t % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
  }
  return slots
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0')
  const m = (minutes % 60).toString().padStart(2, '0')
  return `${h}:${m}`
}

/**
 * Normalisasi format jam ke HH:mm (cth: "13:00:00" -> "13:00", "9:00" -> "09:00")
 */
export function normalizeTime(time?: string | null): string {
  if (!time || typeof time !== 'string') return ''
  const trimmed = time.trim()
  const parts = trimmed.split(':')
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, '0')
    const m = parts[1].padStart(2, '0')
    return `${h}:${m}`
  }
  return trimmed
}

export interface BookedSlotItem {
  jam_mulai: string
  durasi_total?: number
}

/**
 * Menghitung berapa banyak booking yang memiliki waktu mulai (start time) yang sama persis
 */
export function countBookingsForSlot(
  slot: string,
  bookings: (BookedSlotItem | string)[]
): number {
  const target = normalizeTime(slot)
  if (!target || !Array.isArray(bookings)) return 0

  return bookings.filter(b => {
    const jam = typeof b === 'string' ? b : b?.jam_mulai
    return normalizeTime(jam) === target
  }).length
}

/**
 * Mengecek apakah slot jam penuh / terblokir.
 *
 * ATURAN BARU:
 * Slot dianggap penuh BUKAN berdasarkan overlap durasi waktu, melainkan HANYA jika:
 * 1. Ada booking dengan waktu mulai (start time) yang sama persis, DAN
 * 2. Jumlah booking pada start time tersebut sudah mencapai batas kapasitas (maxCapacity / MAX_BOOKING_PER_SLOT).
 *
 * Contoh: Jika ada booking jam 13:00 berdurasi 45 menit, slot jam 13:30 TETAP TERSEDIA.
 */
export function isSlotBlocked(
  slot: string,
  durasiOrBookings: number | (BookedSlotItem | string)[],
  bookingsOrCapacity?: (BookedSlotItem | string)[] | number,
  maxCapacity: number = MAX_BOOKING_PER_SLOT
): boolean {
  let bookings: (BookedSlotItem | string)[] = []
  let capacity = maxCapacity

  if (typeof durasiOrBookings === 'number') {
    bookings = Array.isArray(bookingsOrCapacity) ? bookingsOrCapacity : []
    capacity = typeof maxCapacity === 'number' ? maxCapacity : MAX_BOOKING_PER_SLOT
  } else if (Array.isArray(durasiOrBookings)) {
    bookings = durasiOrBookings
    capacity = typeof bookingsOrCapacity === 'number' ? bookingsOrCapacity : MAX_BOOKING_PER_SLOT
  }

  const count = countBookingsForSlot(slot, bookings)
  return count >= capacity
}

/**
 * Mengecek apakah sesi pemotretan melewati jam tutup studio
 */
export function isSlotExceedingClosingTime(
  slot: string,
  durasiMenit: number,
  jamTutup: string = '20:00'
): boolean {
  const slotStart = timeToMinutes(slot)
  const slotEnd = slotStart + Number(durasiMenit || 0)
  const closingMinutes = timeToMinutes(jamTutup)
  return slotEnd > closingMinutes
}

/**
 * Mengecek apakah waktu sesi berada dalam rentang jam operasional (buka s/d tutup)
 */
export function isSlotWithinOperatingHours(
  slot: string,
  durasiMenit: number,
  jamBuka: string = '08:00',
  jamTutup: string = '20:00'
): boolean {
  const slotStart = timeToMinutes(slot)
  const slotEnd = slotStart + Number(durasiMenit || 0)
  const openingMinutes = timeToMinutes(jamBuka)
  const closingMinutes = timeToMinutes(jamTutup)
  return slotStart >= openingMinutes && slotEnd <= closingMinutes
}

export function buildWAMessage(params: {
  nama_studio: string
  kode: string
  nama_klien: string
  package_nama: string
  category_nama: string
  tanggal: string
  jam_mulai: string
  total_harga: number
  dp_dibayar: number
  status: string
}): string {
  const {
    nama_studio, kode, nama_klien, package_nama, category_nama,
    tanggal, jam_mulai, total_harga, dp_dibayar, status
  } = params
  const sisa = total_harga - dp_dibayar
  return encodeURIComponent(
    `Halo, ini konfirmasi booking dari ${nama_studio}!\n\n` +
    `Kode Booking: *${kode}*\n` +
    `Nama: ${nama_klien}\n` +
    `Paket: ${category_nama} – ${package_nama}\n` +
    `Tanggal: ${tanggal}\n` +
    `Jam: ${jam_mulai}\n` +
    `Total: Rp${total_harga.toLocaleString('id-ID')}\n` +
    `DP Dibayar: Rp${dp_dibayar.toLocaleString('id-ID')}\n` +
    `Sisa: Rp${sisa.toLocaleString('id-ID')}\n` +
    `Status: ${status}\n\n` +
    `*(Mohon lampirkan screenshot bukti transfer DP di chat ini)*`
  )
}

export function parseWaitingListInfo(catatan?: string | null): {
  jam?: string
  kampus?: string
  dp?: string
  bookingKode?: string
  catatanTambahan?: string
} {
  if (!catatan) return {}
  const bookingMatch = catatan.match(/\[Sudah Masuk Booking:\s*([^\]]+)\]/i)
  // Buang penanda konversi supaya tidak ikut terbaca sebagai bagian catatan/kampus/dp
  catatan = catatan.replace(/\s*\[Sudah Masuk Booking:[^\]]*\]/gi, '')
  const jamMatch = catatan.match(/(?:\[Jam:\s*|Perkiraan Jam:\s*)(\d{1,2}:\d{2})/i)
  const kampusMatch = catatan.match(/Kampus(?:\/Instansi)?:\s*([^|\]]+)/i)
  const dpMatch = catatan.match(/DP:\s*([^|\]]+)/i)
  const catMatch = catatan.match(/Catatan:\s*([^|\]]+)/i)

  return {
    jam: jamMatch ? jamMatch[1] : undefined,
    kampus: kampusMatch ? kampusMatch[1].trim() : undefined,
    dp: dpMatch ? dpMatch[1].trim() : undefined,
    bookingKode: bookingMatch ? bookingMatch[1].trim() : undefined,
    catatanTambahan: catMatch ? catMatch[1].trim() : undefined,
  }
}


// ------------------------------------------------------------
// Waktu Indonesia Barat (WIB, UTC+7) — studio ada di Pontianak.
// JANGAN pakai new Date().toISOString() untuk "hari ini": itu jam UTC,
// sehingga antara 00:00–06:59 WIB tanggalnya masih kemarin.
// ------------------------------------------------------------
const ZONA_STUDIO = 'Asia/Jakarta'

function bagianWaktuWIB(d: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_STUDIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value || '00'
  return {
    tanggal: `${get('year')}-${get('month')}-${get('day')}`,
    menit: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

/** Tanggal hari ini di WIB, format YYYY-MM-DD */
export function hariIniWIB(now: Date = new Date()): string {
  return bagianWaktuWIB(now).tanggal
}

/** Menit sejak tengah malam saat ini di WIB */
export function menitSekarangWIB(now: Date = new Date()): number {
  return bagianWaktuWIB(now).menit
}

/** Tanggal (YYYY-MM-DD) dengan penambahan hari, dihitung dari hari ini WIB */
export function tambahHariWIB(jumlahHari: number, now: Date = new Date()): string {
  const [y, m, d] = hariIniWIB(now).split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + jumlahHari))
  return dt.toISOString().slice(0, 10)
}

export function formatTanggalValid(t: unknown): t is string {
  if (typeof t !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(t)) return false
  const dt = new Date(`${t}T00:00:00Z`)
  return !Number.isNaN(dt.getTime()) && dt.toISOString().slice(0, 10) === t
}

export function formatJamValid(j: unknown): j is string {
  return typeof j === 'string' && /^([01]?\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(j.trim())
}
