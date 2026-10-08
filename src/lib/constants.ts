/**
 * Konfigurasi ketersediaan slot booking
 *
 * MAX_BOOKING_PER_SLOT: Batas kapasitas jumlah booking yang diperbolehkan
 * pada start time (jam_mulai) yang sama persis (default: 1).
 */
export const DEFAULT_MAX_BOOKING_PER_SLOT = 1

export const MAX_BOOKING_PER_SLOT =
  Number(process.env.MAX_BOOKING_PER_SLOT || process.env.NEXT_PUBLIC_MAX_BOOKING_PER_SLOT) ||
  DEFAULT_MAX_BOOKING_PER_SLOT
