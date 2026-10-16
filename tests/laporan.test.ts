import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hitungLaporan,
  hitungBiayaCetak,
  rentangBulan,
  bulanSebelumnya,
  selisihPersen,
  buatCsv,
  type BookingLaporan,
  type PengeluaranLaporan,
} from '../src/lib/laporan.ts'

const b = (o: Partial<BookingLaporan>): BookingLaporan => ({
  id: 'x', nama_klien: 'A', tanggal: '2026-10-17', jam_mulai: '09:00:00', status: 'selesai',
  total_harga: 250000, category_nama: 'Personal', package_nama: 'Solo', booking_addons: [], ...o,
})
const cetak = (total: number) => [{ jenis: 'cetak', total }]

const data: BookingLaporan[] = [
  b({ id: '1', total_harga: 250000 }),
  b({ id: '2', jam_mulai: '11:00', total_harga: 450000, category_nama: 'Family', package_nama: 'Family 6', booking_addons: [...cetak(100000), { jenis: 'waktu', total: 25000 }] }),
  b({ id: '3', status: 'booking', total_harga: 999999 }),
  b({ id: '4', status: 'dibatalkan', total_harga: 888888 }),
  b({ id: '5', status: 'pending', total_harga: 777777 }),
  b({ id: '6', tanggal: '2026-10-18', total_harga: 300000 }),
  b({ id: '7', tanggal: '2026-09-30', total_harga: 100000 }),
]
const peng: PengeluaranLaporan[] = [
  { id: 'p1', tanggal: '2026-10-17', kategori: 'Operasional lain', keterangan: 'Konsumsi', jumlah: 50000 },
  { id: 'p2', tanggal: '2026-10-05', kategori: 'Honor / fee', keterangan: 'Editor', jumlah: 400000 },
]

test('hanya booking selesai yang dihitung, per tanggal sesi', () => {
  const l = hitungLaporan(data, peng, '2026-10-17', '2026-10-17')
  assert.equal(l.sesi.length, 2)
  assert.equal(l.pendapatan, 700000)
  assert.deepEqual(l.sesi.map(s => s.jam), ['09:00', '11:00'])
})

test('biaya cetak otomatis dari add-on cetak saja', () => {
  assert.equal(hitungBiayaCetak(cetak(100000)), 100000)
  assert.equal(hitungBiayaCetak([{ jenis: 'waktu', total: 25000 }]), 0)
  assert.equal(hitungBiayaCetak([{ jenis: 'cetak', harga: 15000, jumlah: 3 }]), 45000)
  assert.equal(hitungBiayaCetak(null), 0)
})

test('laba = pendapatan - cetak - pengeluaran manual', () => {
  const l = hitungLaporan(data, peng, '2026-10-17', '2026-10-17')
  assert.equal(l.biayaCetak, 100000)
  assert.equal(l.pengeluaranManual, 50000)
  assert.equal(l.totalPengeluaran, 150000)
  assert.equal(l.laba, 550000)
  assert.equal(l.margin, 79)
  assert.equal(l.rataRata, 350000)
})

test('laporan bulanan memakai rentang bulan dan mengabaikan bulan lain', () => {
  const { dari, sampai } = rentangBulan('2026-10')
  assert.deepEqual([dari, sampai], ['2026-10-01', '2026-10-31'])
  const l = hitungLaporan(data, peng, dari, sampai)
  assert.equal(l.pendapatan, 1000000)
  assert.equal(l.pengeluaranManual, 450000)
  assert.equal(l.hariTersibuk, '2026-10-17')
  assert.equal(l.perHari.length, 3)
  assert.equal(l.perKategori[0].nama, 'Personal')
  assert.equal(l.perKategori[0].pendapatan, 550000)
  assert.equal(l.perKategori[1].nama, 'Family')
  assert.ok(l.pengeluaranPerKategori.some(x => x.nama === 'Cetak foto (otomatis)' && x.jumlah === 100000))
})

test('hari tanpa sesi: semua nol, tidak error', () => {
  const l = hitungLaporan(data, peng, '2026-10-20', '2026-10-20')
  assert.equal(l.pendapatan, 0)
  assert.equal(l.margin, 0)
  assert.equal(l.rataRata, 0)
  assert.equal(l.hariTersibuk, null)
})

test('pengeluaran tanpa sesi tetap mengurangi laba (laba negatif)', () => {
  const l = hitungLaporan([], peng, '2026-10-01', '2026-10-31')
  assert.equal(l.laba, -450000)
})

test('bulan sebelumnya dan selisih persen', () => {
  assert.equal(bulanSebelumnya('2026-01'), '2025-12')
  assert.equal(bulanSebelumnya('2026-10'), '2026-09')
  assert.deepEqual(rentangBulan('2028-02'), { dari: '2028-02-01', sampai: '2028-02-29' })
  assert.equal(selisihPersen(1100, 1000), 10)
  assert.equal(selisihPersen(500, 1000), -50)
  assert.equal(selisihPersen(500, 0), null)
})

test('CSV: titik koma, kutip, dan cegah formula Excel', () => {
  const l = hitungLaporan(
    [b({ id: '1', nama_klien: '=HYPERLINK("x")' })],
    [{ id: 'p', tanggal: '2026-10-17', kategori: 'Lainnya', keterangan: 'a;b "c"', jumlah: 1000 }],
    '2026-10-17', '2026-10-17'
  )
  const csv = buatCsv(l, 'Tes')
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'))
  assert.ok(csv.includes('"a;b ""c"""'))
  assert.ok(csv.includes('Laba bersih;'))
})
