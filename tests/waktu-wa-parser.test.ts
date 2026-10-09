import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hariIniWIB,
  menitSekarangWIB,
  tambahHariWIB,
  formatTanggalValid,
  formatJamValid,
  normalizeTime,
  parseWaitingListInfo,
} from '../src/lib/utils.ts'
import { normalisasiNomorWa, linkAppWhatsApp, linkWebWhatsApp } from '../src/lib/whatsapp.ts'

test('hariIniWIB: pukul 00:30 WIB masih tanggal WIB yang benar (bukan tanggal UTC kemarin)', () => {
  // 2026-10-09 00:30 WIB = 2026-10-08 17:30 UTC
  const d = new Date('2026-10-08T17:30:00Z')
  assert.equal(hariIniWIB(d), '2026-10-09')
  assert.equal(menitSekarangWIB(d), 30)
  assert.equal(tambahHariWIB(1, d), '2026-10-10')
})

test('hariIniWIB: pukul 23:59 WIB', () => {
  const d = new Date('2026-10-09T16:59:00Z')
  assert.equal(hariIniWIB(d), '2026-10-09')
  assert.equal(menitSekarangWIB(d), 23 * 60 + 59)
})

test('tambahHariWIB melewati pergantian bulan', () => {
  assert.equal(tambahHariWIB(1, new Date('2026-10-31T05:00:00Z')), '2026-11-01')
})

test('validasi tanggal & jam', () => {
  assert.equal(formatTanggalValid('2026-10-09'), true)
  assert.equal(formatTanggalValid('2026-02-30'), false)
  assert.equal(formatTanggalValid('09-10-2026'), false)
  assert.equal(formatTanggalValid(null), false)
  assert.equal(formatJamValid('09:30'), true)
  assert.equal(formatJamValid('10:00:00'), true)
  assert.equal(formatJamValid('25:00'), false)
  assert.equal(formatJamValid('abc'), false)
})

test('normalizeTime membuang detik', () => {
  assert.equal(normalizeTime('10:00:00'), '10:00')
  assert.equal(normalizeTime('9:05'), '09:05')
})

test('parseWaitingListInfo: penanda konversi tidak ikut terbaca sebagai catatan', () => {
  const c = '[Jam: 10:00] | DP: Rp 100.000 (via WA) | Kampus/Instansi: UNTAN | Catatan: bawa toga [Sudah Masuk Booking: DSR-20261009-001]'
  const r = parseWaitingListInfo(c)
  assert.equal(r.jam, '10:00')
  assert.equal(r.kampus, 'UNTAN')
  assert.equal(r.catatanTambahan, 'bawa toga')
  assert.equal(r.bookingKode, 'DSR-20261009-001')
})

test('parseWaitingListInfo: belum dikonversi', () => {
  const r = parseWaitingListInfo('[Jam: 08:30] | DP: Rp 100.000 (via WA)')
  assert.equal(r.bookingKode, undefined)
  assert.equal(r.jam, '08:30')
})

test('normalisasiNomorWa', () => {
  assert.equal(normalisasiNomorWa('0812-3456 789'), '628123456789')
  assert.equal(normalisasiNomorWa('+62 812 3456'), '628123456')
  assert.equal(normalisasiNomorWa('812345'), '62812345')
  assert.equal(normalisasiNomorWa('628123'), '628123')
  assert.equal(normalisasiNomorWa(null), '')
})

test('link WhatsApp aplikasi & web', () => {
  assert.equal(linkAppWhatsApp('0812', 'Halo *Kak*'), 'whatsapp://send?phone=62812&text=Halo%20*Kak*')
  assert.equal(linkAppWhatsApp('0812'), 'whatsapp://send?phone=62812')
  assert.equal(linkWebWhatsApp('0812', 'Hai'), 'https://wa.me/62812?text=Hai')
})
