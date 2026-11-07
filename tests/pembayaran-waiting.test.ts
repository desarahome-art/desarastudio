import test from 'node:test'
import assert from 'node:assert/strict'
import {
  statusBayarWaiting, jenisPembayaranWaiting, cekPembayaranWaiting, cekKoreksiWaiting,
  cariPaketWaiting, ringkasPembayaranWaiting,
} from '../src/lib/pembayaran-waiting.ts'

test('status bayar', () => {
  assert.equal(statusBayarWaiting(550000, 0), 'menunggu')
  assert.equal(statusBayarWaiting(550000, 100000), 'dp')
  assert.equal(statusBayarWaiting(550000, 550000), 'lunas')
  assert.equal(statusBayarWaiting(0, 100000), 'dp') // harga tidak diketahui: jangan dianggap lunas
})

test('jenis pembayaran', () => {
  assert.equal(jenisPembayaranWaiting(0, 100000, 550000), 'dp')
  assert.equal(jenisPembayaranWaiting(100000, 200000, 550000), 'cicilan')
  assert.equal(jenisPembayaranWaiting(100000, 450000, 550000), 'pelunasan')
  assert.equal(jenisPembayaranWaiting(0, 550000, 550000), 'pelunasan') // langsung lunas
})

test('cek pembayaran', () => {
  assert.equal(cekPembayaranWaiting(550000, 0, 100000), null)
  assert.equal(cekPembayaranWaiting(550000, 100000, 450000), null)
  assert.match(cekPembayaranWaiting(550000, 100000, 450001)!, /Melebihi sisa/)
  assert.match(cekPembayaranWaiting(550000, 550000, 1)!, /sudah lunas/)
  assert.match(cekPembayaranWaiting(550000, 0, 0)!, /Isi jumlah/)
  assert.match(cekPembayaranWaiting(550000, 0, 1.5)!, /Isi jumlah/)
  assert.match(cekPembayaranWaiting(0, 0, 100000)!, /Harga paket/)
})

test('cek koreksi', () => {
  assert.equal(cekKoreksiWaiting(550000, 100000, 50000, 'salah input'), null)
  assert.equal(cekKoreksiWaiting(550000, 100000, 0, 'batal DP'), null)
  assert.match(cekKoreksiWaiting(550000, 100000, 600000, 'x y z')!, /melebihi/)
  assert.match(cekKoreksiWaiting(550000, 100000, 100000, 'sama')!, /sama/)
  assert.match(cekKoreksiWaiting(550000, 100000, 50000, '')!, /alasan/)
  assert.match(cekKoreksiWaiting(550000, 100000, -1, 'minus')!, /tidak valid/)
})

test('cari paket: cocok nama, abaikan huruf besar, cadangan paket pertama, abaikan nonaktif & kategori lain', () => {
  const pk = [
    { id: 'g', category_id: 'w', nama: 'Gold', harga: 900000, aktif: true, urutan: 3 },
    { id: 'b', category_id: 'w', nama: 'Bronze', harga: 300000, aktif: true, urutan: 1 },
    { id: 's', category_id: 'w', nama: 'Silver', harga: 550000, aktif: false, urutan: 2 },
    { id: 'x', category_id: 'lain', nama: 'Silver', harga: 1, aktif: true, urutan: 0 },
  ]
  assert.equal(cariPaketWaiting(pk, 'w', 'gold')?.id, 'g')
  assert.equal(cariPaketWaiting(pk, 'w', 'Silver')?.id, 'b') // Silver nonaktif -> paket pertama
  assert.equal(cariPaketWaiting(pk, 'w', null)?.id, 'b')
  assert.equal(cariPaketWaiting(pk, 'kosong', 'Gold'), undefined)
})

test('ringkasan hanya waiting list yang belum jadi booking', () => {
  const r = ringkasPembayaranWaiting([
    { harga: 550000, dibayar: 0, sudahBooking: false },
    { harga: 900000, dibayar: 400000, sudahBooking: false },
    { harga: 300000, dibayar: 300000, sudahBooking: false },
    { harga: 300000, dibayar: 300000, sudahBooking: true },
  ])
  assert.deepEqual(r, { menunggu: 1, dp: 1, lunas: 1, uangMasuk: 700000 })
})
