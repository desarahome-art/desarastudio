import test from 'node:test'
import assert from 'node:assert/strict'
import {
  isSlotBlocked,
  countBookingsForSlot,
  normalizeTime,
  isSlotExceedingClosingTime,
  isSlotWithinOperatingHours,
  generateTimeSlots,
  DEFAULT_MAX_BOOKING_PER_SLOT,
  MAX_BOOKING_PER_SLOT,
} from '../src/lib/utils.ts'

test('Slot Availability & Capacity Logic Tests', async (t) => {
  await t.test('1. Normalisasi format jam (normalizeTime)', () => {
    assert.strictEqual(normalizeTime('13:00'), '013:00'.slice(-5)) // 13:00
    assert.strictEqual(normalizeTime('13:00'), '13:00')
    assert.strictEqual(normalizeTime('13:00:00'), '13:00')
    assert.strictEqual(normalizeTime('9:00'), '09:00')
    assert.strictEqual(normalizeTime('09:00:00'), '09:00')
    assert.strictEqual(normalizeTime(''), '')
    assert.strictEqual(normalizeTime(null), '')
  })

  await t.test('2. Skenario Utama: Booking di 13.30 saat ada booking 13.00 berdurasi 45 menit', () => {
    const existingBookings = [
      { jam_mulai: '13:00', durasi_total: 45 },
    ]

    // Slot 13:30 TIDAK boleh terblokir meskipun ada booking 13:00 berdurasi 45 menit (overlap diabaikan)
    const is1330Blocked = isSlotBlocked('13:30', 30, existingBookings)
    assert.strictEqual(
      is1330Blocked,
      false,
      'Slot 13:30 harus TERSEDIA (tidak terblokir) saat ada booking 13:00 durasi 45 menit'
    )

    // Slot 13:00 HARUS terblokir karena start time-nya persis sama
    const is1300Blocked = isSlotBlocked('13:00', 30, existingBookings)
    assert.strictEqual(
      is1300Blocked,
      true,
      'Slot 13:00 harus TERBLOKIR karena waktu mulai sama persis'
    )
  })

  await t.test('3. Skenario Dua booking di start time yang sama (Kapasitas default = 1)', () => {
    const bookings = [
      { jam_mulai: '13:00', durasi_total: 30 },
    ]

    // Booking pertama sudah ada di 13:00, kapasitas default = 1
    assert.strictEqual(countBookingsForSlot('13:00', bookings), 1)
    assert.strictEqual(
      isSlotBlocked('13:00', 30, bookings, 1),
      true,
      'Slot 13:00 harus terblokir saat sudah ada 1 booking dengan kapasitas 1'
    )

    // Slot 14:00 belum ada booking
    assert.strictEqual(countBookingsForSlot('14:00', bookings), 0)
    assert.strictEqual(
      isSlotBlocked('14:00', 30, bookings, 1),
      false,
      'Slot 14:00 harus tersedia'
    )
  })

  await t.test('4. Skenario Kapasitas MAX_BOOKING_PER_SLOT > 1 (Multi-kapasitas)', () => {
    const maxCapacity = 2

    // 0 booking di 10:00 -> Tersedia
    const bookings0: { jam_mulai: string }[] = []
    assert.strictEqual(isSlotBlocked('10:00', 30, bookings0, maxCapacity), false)

    // 1 booking di 10:00 -> Masih tersedia karena kapasitas = 2
    const bookings1 = [{ jam_mulai: '10:00' }]
    assert.strictEqual(
      isSlotBlocked('10:00', 30, bookings1, maxCapacity),
      false,
      'Slot 10:00 masih harus tersedia dengan 1 booking jika kapasitas 2'
    )

    // 2 booking di 10:00 -> Penuh (terblokir)
    const bookings2 = [{ jam_mulai: '10:00' }, { jam_mulai: '10:00:00' }]
    assert.strictEqual(
      isSlotBlocked('10:00', 30, bookings2, maxCapacity),
      true,
      'Slot 10:00 harus terblokir saat sudah ada 2 booking dengan kapasitas 2'
    )
  })

  await t.test('5. Skenario Edge Case: Booking di jam terakhir sebelum tutup studio', () => {
    const jamBuka = '08:00'
    const jamTutup = '20:00'

    // Kasus 5a: Slot 19:30 dengan durasi 30 menit (selesai 20:00) -> Tepat jam tutup (VALID)
    assert.strictEqual(
      isSlotWithinOperatingHours('19:30', 30, jamBuka, jamTutup),
      true,
      'Slot 19:30 durasi 30m harus valid karena selesai tepat jam 20:00'
    )
    assert.strictEqual(
      isSlotExceedingClosingTime('19:30', 30, jamTutup),
      false,
      'Slot 19:30 durasi 30m tidak melebihi jam tutup'
    )

    // Kasus 5b: Slot 19:30 dengan durasi 45 menit (selesai 20:15) -> Melewati jam tutup (INVALID)
    assert.strictEqual(
      isSlotWithinOperatingHours('19:30', 45, jamBuka, jamTutup),
      false,
      'Slot 19:30 durasi 45m harus invalid karena selesai jam 20:15 (melewati 20:00)'
    )
    assert.strictEqual(
      isSlotExceedingClosingTime('19:30', 45, jamTutup),
      true,
      'Slot 19:30 durasi 45m melebihi jam tutup'
    )

    // Kasus 5c: Slot 19:00 dengan durasi 60 menit (selesai 20:00) -> VALID
    assert.strictEqual(
      isSlotWithinOperatingHours('19:00', 60, jamBuka, jamTutup),
      true,
      'Slot 19:00 durasi 60m harus valid karena selesai tepat jam 20:00'
    )

    // Kasus 5d: Slot 19:00 dengan durasi 75 menit (selesai 20:15) -> INVALID
    assert.strictEqual(
      isSlotWithinOperatingHours('19:00', 75, jamBuka, jamTutup),
      false,
      'Slot 19:00 durasi 75m harus invalid'
    )

    // Kasus 5e: Slot 07:30 (sebelum jam buka 08:00) -> INVALID
    assert.strictEqual(
      isSlotWithinOperatingHours('07:30', 30, jamBuka, jamTutup),
      false,
      'Slot 07:30 sebelum jam buka harus invalid'
    )
  })

  await t.test('6. Skenario generate time slots dan pengecekan jam tutup operasional', () => {
    const jamBuka = '08:00'
    const jamTutup = '20:00'
    const interval = 30
    const allSlots = generateTimeSlots(jamBuka, jamTutup, interval)

    // Slot terakhir yang digenerate adalah 19:30
    assert.strictEqual(allSlots[allSlots.length - 1], '19:30')
    assert.strictEqual(allSlots[0], '08:00')

    // Simulasi filter slot yang tersedia untuk durasi 45 menit:
    // Slot 19:30 tidak boleh lolos jika durasi 45m karena 19:30 + 45m = 20:15 > 20:00
    const availableFor45m = allSlots.filter(
      slot => isSlotWithinOperatingHours(slot, 45, jamBuka, jamTutup)
    )
    assert.strictEqual(availableFor45m.includes('19:00'), true)
    assert.strictEqual(
      availableFor45m.includes('19:30'),
      false,
      'Slot 19:30 tidak boleh tersedia untuk durasi 45 menit karena melewati jam 20:00'
    )

    // Untuk durasi 30 menit, 19:30 boleh lolos
    const availableFor30m = allSlots.filter(
      slot => isSlotWithinOperatingHours(slot, 30, jamBuka, jamTutup)
    )
    assert.strictEqual(availableFor30m.includes('19:30'), true)
  })

  await t.test('7. Konfigurasi default MAX_BOOKING_PER_SLOT', () => {
    assert.strictEqual(DEFAULT_MAX_BOOKING_PER_SLOT, 1)
    assert.strictEqual(typeof MAX_BOOKING_PER_SLOT, 'number')
    assert.strictEqual(MAX_BOOKING_PER_SLOT >= 1, true)
  })
})
