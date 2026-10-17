import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hitungLaporan,
  rentangBulan,
  bulanSebelumnya,
  selisihPersen,
  buatCsv,
  type PemasukanLaporan,
  type PengeluaranLaporan,
} from '../src/lib/laporan.ts'

// Contoh nyata 1 Oktober 2026
const masuk: PemasukanLaporan[] = [
  { id: 'a', tanggal: '2026-10-01', jenis: 'Paket', nama: 'Bronze', jumlah: 8, harga_satuan: 300000 },
  { id: 'b', tanggal: '2026-10-01', jenis: 'Paket', nama: 'Silver', jumlah: 5, harga_satuan: 550000 },
  { id: 'c', tanggal: '2026-10-01', jenis: 'Paket', nama: 'Gold', jumlah: 1, harga_satuan: 900000 },
  { id: 'd', tanggal: '2026-10-01', jenis: 'Add-on', nama: 'Tambah orang', jumlah: 15, harga_satuan: 20000 },
  { id: 'e', tanggal: '2026-10-02', jenis: 'Paket', nama: 'bronze ', jumlah: 3, harga_satuan: 300000 },
  { id: 'f', tanggal: '2026-09-30', jenis: 'Paket', nama: 'Gold', jumlah: 1, harga_satuan: 900000 },
]
const keluar: PengeluaranLaporan[] = [
  { id: 'k1', tanggal: '2026-10-01', kategori: 'Cetak foto', keterangan: 'Cetak 12R x 5', jumlah: 750000 },
  { id: 'k2', tanggal: '2026-10-01', kategori: 'Cetak foto', keterangan: 'Cetak 20R x 1', jumlah: 400000 },
  { id: 'k3', tanggal: '2026-10-01', kategori: 'Operasional lain', keterangan: 'Konsumsi', jumlah: 287000 },
  { id: 'k4', tanggal: '2026-10-01', kategori: 'Honor / fee', keterangan: 'Crew', jumlah: 1900000 },
  { id: 'k5', tanggal: '2026-10-03', kategori: 'Lainnya', keterangan: 'Parkir', jumlah: 10000 },
]

test('harian 1 Oktober: client, pemasukan, pengeluaran, laba', () => {
  const l = hitungLaporan(masuk, keluar, '2026-10-01', '2026-10-01')
  assert.equal(l.client, 14)
  assert.equal(l.totalPemasukan, 6350000)
  assert.equal(l.totalPengeluaran, 3337000)
  assert.equal(l.laba, 3013000)
  assert.equal(l.margin, 47)
  assert.equal(l.pemasukan.length, 4)
})

test('add-on dan Lainnya bukan client', () => {
  const l = hitungLaporan(
    [{ id: 'x', tanggal: '2026-10-01', jenis: 'Lainnya', nama: 'Sewa studio', jumlah: 1, harga_satuan: 100000 }, masuk[3]],
    [], '2026-10-01', '2026-10-01'
  )
  assert.equal(l.client, 0)
  assert.equal(l.totalPemasukan, 400000)
})

test('bulanan: rentang bulan, per tanggal, per item, per kategori', () => {
  const { dari, sampai } = rentangBulan('2026-10')
  const l = hitungLaporan(masuk, keluar, dari, sampai)
  assert.equal(l.client, 17)
  assert.equal(l.totalPemasukan, 6350000 + 900000)
  assert.equal(l.totalPengeluaran, 3347000)
  assert.deepEqual(l.perHari.map(h => [h.tanggal, h.client, h.pemasukan, h.pengeluaran, h.laba]), [
    ['2026-10-01', 14, 6350000, 3337000, 3013000],
    ['2026-10-02', 3, 900000, 0, 900000],
    ['2026-10-03', 0, 0, 10000, -10000],
  ])
  // nama sama beda huruf/spasi digabung
  const bronze = l.perItem.find(x => x.nama === 'Bronze')!
  assert.equal(bronze.jumlah, 11)
  assert.equal(bronze.nilai, 3300000)
  assert.equal(l.perKategori[0].nama, 'Honor / fee')
  assert.equal(l.perKategori.find(k => k.nama === 'Cetak foto')!.jumlah, 1150000)
  // jumlah per tanggal = total
  assert.equal(l.perHari.reduce((s, h) => s + h.laba, 0), l.laba)
})

test('tanggal kosong: semua nol', () => {
  const l = hitungLaporan(masuk, keluar, '2026-10-20', '2026-10-20')
  assert.equal(l.totalPemasukan, 0)
  assert.equal(l.margin, 0)
  assert.equal(l.perHari.length, 0)
})

test('bulan sebelumnya dan selisih persen', () => {
  assert.equal(bulanSebelumnya('2026-01'), '2025-12')
  assert.deepEqual(rentangBulan('2028-02'), { dari: '2028-02-01', sampai: '2028-02-29' })
  assert.equal(selisihPersen(1100, 1000), 10)
  assert.equal(selisihPersen(500, 0), null)
})

test('CSV: pemisah titik koma, kutip, cegah formula Excel', () => {
  const l = hitungLaporan(
    [{ id: 'x', tanggal: '2026-10-01', jenis: 'Lainnya', nama: '=HYPERLINK("x")', jumlah: 1, harga_satuan: 1000 }],
    [{ id: 'y', tanggal: '2026-10-01', kategori: 'Lainnya', keterangan: 'a;b "c"', jumlah: 500 }],
    '2026-10-01', '2026-10-01'
  )
  const csv = buatCsv(l, 'Tes')
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('"\'=HYPERLINK(""x"")"'))
  assert.ok(csv.includes('"a;b ""c"""'))
  assert.ok(csv.includes('Laba bersih;500'))
})
