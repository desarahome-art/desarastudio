import test from 'node:test'
import assert from 'node:assert/strict'
import { validasiTestimoni, ringkasRating, susunBarisMarquee, bersihkanTeks } from '../src/lib/testimoni.ts'

const paket = ['Bronze', 'Silver', 'Gold']
const ok = { nama: 'Sinta', paket: 'Silver', bintang: 5, isi: 'Hasil fotonya bagus sekali, terima kasih.' }

test('input valid dibersihkan dan diterima', () => {
  const r = validasiTestimoni({ ...ok, nama: '  Sinta   Dewi ', isi: 'Bagus\n\nsekali   hasilnya!' }, paket)
  assert.ok('data' in r)
  if ('data' in r) {
    assert.equal(r.data.nama, 'Sinta Dewi')
    assert.equal(r.data.isi, 'Bagus sekali hasilnya!')
    assert.equal(r.data.paket, 'Silver')
    assert.equal(r.data.bintang, 5)
  }
})

test('paket tidak dikenal menjadi kosong, paket kosong boleh', () => {
  const a = validasiTestimoni({ ...ok, paket: 'Platinum' }, paket)
  const b = validasiTestimoni({ ...ok, paket: '' }, paket)
  assert.ok('data' in a && a.data.paket === null)
  assert.ok('data' in b && b.data.paket === null)
})

test('penolakan: nama, bintang, isi', () => {
  assert.ok('error' in validasiTestimoni({ ...ok, nama: ' ' }, paket))
  assert.ok('error' in validasiTestimoni({ ...ok, nama: 'x'.repeat(41) }, paket))
  for (const b of [0, 6, 2.5, 'abc', null]) assert.ok('error' in validasiTestimoni({ ...ok, bintang: b }, paket))
  assert.ok('error' in validasiTestimoni({ ...ok, isi: 'bagus' }, paket))
  assert.ok('error' in validasiTestimoni({ ...ok, isi: 'x'.repeat(401) }, paket))
})

test('bintang berupa string angka diterima', () => {
  const r = validasiTestimoni({ ...ok, bintang: '4' }, paket)
  assert.ok('data' in r && r.data.bintang === 4)
})

test('karakter kontrol dibuang', () => {
  assert.equal(bersihkanTeks('a\u0000b\tc'), 'a b c')
})

test('ringkasan rating', () => {
  assert.deepEqual(ringkasRating([]), { rata: 0, jumlah: 0 })
  assert.deepEqual(ringkasRating([{ bintang: 5 }, { bintang: 4 }, { bintang: 5 }]), { rata: 4.7, jumlah: 3 })
})

test('susun baris marquee: kosong, satu baris, dua baris, diulang', () => {
  assert.deepEqual(susunBarisMarquee([]), [])
  const sedikit = susunBarisMarquee([1, 2, 3])
  assert.equal(sedikit.length, 1)
  assert.ok(sedikit[0].length >= 6)
  const banyak = susunBarisMarquee([1, 2, 3, 4, 5, 6, 7, 8])
  assert.equal(banyak.length, 2)
  assert.deepEqual(banyak[0].slice(0, 4), [1, 3, 5, 7])
  assert.deepEqual(banyak[1].slice(0, 4), [2, 4, 6, 8])
})
