import test from 'node:test'
import assert from 'node:assert/strict'
import { hitungRekapBooking, normalisasiUkuran, type BookingRekapLike } from '../src/lib/rekap-booking.ts'

const paket = (ukuran: string | null, jumlah: number | null) => ({ cetak_ukuran: ukuran, cetak_jumlah: jumlah })
const bk = (status: string, p: ReturnType<typeof paket> | null, addons: BookingRekapLike['booking_addons'] = []): BookingRekapLike => ({
  status, package_snapshot: p, booking_addons: addons,
})

test('normalisasi ukuran', () => {
  assert.equal(normalisasiUkuran('12R'), '12R')
  assert.equal(normalisasiUkuran(' 12 r '), '12R')
  assert.equal(normalisasiUkuran('Cetak 20R'), '20R')
  assert.equal(normalisasiUkuran('Cetak 10R (frame)'), '10R')
  assert.equal(normalisasiUkuran('A3'), 'A3')
  assert.equal(normalisasiUkuran(null), '')
})

test('client dan cetak per ukuran, diurutkan angka', () => {
  const r = hitungRekapBooking([
    bk('booking', paket('12R', 1)),
    bk('booking', paket('12R', 2)),
    bk('selesai', paket('20R', 1)),
    bk('pending', paket(null, null)),
  ])
  assert.equal(r.client, 4)
  assert.deepEqual(r.cetak.map(c => [c.ukuran, c.lembar]), [['12R', 3], ['20R', 1]])
  assert.equal(r.totalLembar, 4)
})

test('add-on cetak digabung dengan cetak paket pada ukuran yang sama', () => {
  const r = hitungRekapBooking([
    bk('booking', paket('12R', 1), [{ jenis: 'cetak', nama: 'Cetak 12R', jumlah: 2 }, { jenis: 'waktu', nama: 'Tambah Waktu', jumlah: 3 }]),
    bk('booking', paket(null, null), [{ jenis: 'cetak', nama: 'Cetak 4R', jumlah: 5 }]),
  ])
  assert.deepEqual(r.cetak.map(c => [c.ukuran, c.lembar, c.dariPaket, c.dariAddon]), [['4R', 5, 0, 5], ['12R', 3, 1, 2]])
  assert.equal(r.totalLembar, 8)
})

test('ukuran dari master add-on didahulukan, nama sebagai cadangan', () => {
  const r = hitungRekapBooking(
    [bk('booking', null, [{ jenis: 'cetak', nama: 'Cetak Besar', jumlah: 2, addon_id: 'x' }, { jenis: 'cetak', nama: 'Cetak 10R', jumlah: 1, addon_id: 'tidak-ada' }])],
    { x: '20R' }
  )
  assert.deepEqual(r.cetak.map(c => [c.ukuran, c.lembar]), [['10R', 1], ['20R', 2]])
})

test('booking dibatalkan tidak dihitung, tetapi dicatat jumlahnya', () => {
  const r = hitungRekapBooking([bk('booking', paket('12R', 1)), bk('dibatalkan', paket('12R', 5), [{ jenis: 'cetak', nama: 'Cetak 12R', jumlah: 9 }])])
  assert.equal(r.client, 1)
  assert.equal(r.dibatalkan, 1)
  assert.equal(r.totalLembar, 1)
})

test('ukuran ada tetapi jumlah kosong dihitung 1 lembar; jumlah ada tetapi ukuran kosong tetap tercatat', () => {
  const r = hitungRekapBooking([bk('booking', paket('12R', null)), bk('booking', paket(null, 2))])
  assert.deepEqual(r.cetak.map(c => [c.ukuran, c.lembar]), [['12R', 1], ['Tanpa ukuran', 2]])
})

test('tanpa data: semua nol', () => {
  const r = hitungRekapBooking([])
  assert.deepEqual(r, { client: 0, dibatalkan: 0, cetak: [], totalLembar: 0 })
})
