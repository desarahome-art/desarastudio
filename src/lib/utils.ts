import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

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

export function isSlotBlocked(
  slot: string,
  durasiMenit: number,
  blockedRanges: { jam_mulai: string; durasi_total: number }[]
): boolean {
  const slotStart = timeToMinutes(slot)
  const slotEnd = slotStart + durasiMenit

  return blockedRanges.some(({ jam_mulai, durasi_total }) => {
    const bStart = timeToMinutes(jam_mulai)
    const bEnd = bStart + durasi_total
    return slotStart < bEnd && slotEnd > bStart
  })
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
  const jamMatch = catatan.match(/(?:\[Jam:\s*|Perkiraan Jam:\s*)(\d{1,2}:\d{2})/i)
  const kampusMatch = catatan.match(/Kampus(?:\/Instansi)?:\s*([^|\]]+)/i)
  const dpMatch = catatan.match(/DP:\s*([^|\]]+)/i)
  const bookingMatch = catatan.match(/\[Sudah Masuk Booking:\s*([^\]]+)\]/i)
  const catMatch = catatan.match(/Catatan:\s*([^|\]]+)/i)

  return {
    jam: jamMatch ? jamMatch[1] : undefined,
    kampus: kampusMatch ? kampusMatch[1].trim() : undefined,
    dp: dpMatch ? dpMatch[1].trim() : undefined,
    bookingKode: bookingMatch ? bookingMatch[1].trim() : undefined,
    catatanTambahan: catMatch ? catMatch[1].trim() : undefined,
  }
}

