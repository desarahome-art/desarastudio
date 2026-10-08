import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_MENIT_PER_UNIT,
  getMenitPerUnit,
  labelSatuanWaktu,
  hitungMenitAddon,
  hitungHargaAddon,
  sisaKuota,
  rencanakanTambahAddon,
  rencanakanKurangiAddon,
  terapkanRencanaKeBaris,
  tentukanAksiCetak,
  ringkasanSetelah,
  type MasterAddon,
  type BarisBookingAddon,
} from '../src/lib/addon-calc.ts'
import { isSlotWithinOperatingHours } from '../src/lib/utils.ts'

// ---- Data contoh ----
const waktu20: MasterAddon = { id: 'w20', jenis: 'waktu', nama: 'Tambah Waktu', satuan: '+20 menit', harga: 25000, maks: 4, menit_per_unit: 20 }
const waktu30: MasterAddon = { id: 'w30', jenis: 'waktu', nama: 'Tambah Waktu Panjang', satuan: '+30 menit', harga: 35000, maks: 3, menit_per_unit: 30 }
const cetak: MasterAddon = { id: 'c4r', jenis: 'cetak', nama: 'Cetak 4R', satuan: '+1 lembar', harga: 15000, maks: 5, menit_per_unit: 15 }
const bg: MasterAddon = { id: 'bg', jenis: 'background', nama: 'Background', satuan: '+1 background', harga: 10000, maks: 3, menit_per_unit: 15 }
const masters = [waktu20, waktu30, cetak, bg]

const barisKlien: BarisBookingAddon = { id: 'r1', addon_id: 'w20', jenis: 'waktu', nama: 'Tambah Waktu', satuan: '+20 menit', harga: 25000, jumlah: 1, menit_per_unit: 20, ditambah_oleh_admin: false }

test('A. Durasi memakai menit_per_unit dari database', async t => {
  await t.test('menit_per_unit 20 dan 30', () => {
    assert.equal(getMenitPerUnit(waktu20), 20)
    assert.equal(getMenitPerUnit(waktu30), 30)
    // paket 30 menit + 2x20 + 1x30 = 100 menit
    const durasi = 30 + hitungMenitAddon([{ ...waktu20, jumlah: 2 }, { ...waktu30, jumlah: 1 }])
    assert.equal(durasi, 100)
  })

  await t.test('data lama tanpa menit_per_unit memakai 15 menit', () => {
    assert.equal(DEFAULT_MENIT_PER_UNIT, 15)
    assert.equal(hitungMenitAddon([{ jenis: 'waktu', menit_per_unit: null, jumlah: 2 }]), 30)
  })

  await t.test('add-on non-waktu tidak menambah durasi', () => {
    assert.equal(hitungMenitAddon([{ ...cetak, jumlah: 3 }, { ...bg, jumlah: 1 }]), 0)
  })

  await t.test('label satuan mengikuti angka database', () => {
    assert.equal(labelSatuanWaktu(waktu20), '+20 menit')
    assert.equal(labelSatuanWaktu({ jenis: 'waktu', menit_per_unit: 30 }), '+30 menit')
  })
})

test('B. Add-on di lapangan', async t => {
  await t.test('batas maks: jumlah lama + baru tidak boleh melebihi', () => {
    // maks 4, sudah ada 1 -> sisa 3
    assert.equal(sisaKuota(waktu20.maks, [barisKlien], 'w20'), 3)
    const lolos = rencanakanTambahAddon([barisKlien], masters, [{ addon_id: 'w20', jumlah: 3 }])
    assert.equal(lolos.ok, true)
    const gagal = rencanakanTambahAddon([barisKlien], masters, [{ addon_id: 'w20', jumlah: 4 }])
    assert.equal(gagal.ok, false)
    if (!gagal.ok) assert.match(gagal.error, /melebihi batas/)
  })

  await t.test('item yang sama dalam satu permintaan dijumlahkan sebelum cek maks', () => {
    const gagal = rencanakanTambahAddon([barisKlien], masters, [
      { addon_id: 'w20', jumlah: 2 },
      { addon_id: 'w20', jumlah: 2 },
    ])
    assert.equal(gagal.ok, false)
  })

  await t.test('add-on di luar kategori booking ditolak', () => {
    const hasil = rencanakanTambahAddon([], masters, [{ addon_id: 'c4r', jumlah: 1 }], new Set(['w20']))
    assert.equal(hasil.ok, false)
  })

  await t.test('pesanan awal klien tidak diubah; tambahan pertama jadi baris baru', () => {
    const hasil = rencanakanTambahAddon([barisKlien], masters, [{ addon_id: 'w20', jumlah: 1 }])
    assert.ok(hasil.ok)
    if (!hasil.ok) return
    assert.equal(hasil.rencana.updateRows.length, 0)
    assert.equal(hasil.rencana.insertRows.length, 1)
    assert.equal(hasil.rencana.insertRows[0].menit_per_unit, 20)
  })

  await t.test('penambahan berikutnya dijumlahkan ke baris admin (tanpa baris ganda)', () => {
    const barisAdmin: BarisBookingAddon = { ...barisKlien, id: 'r2', jumlah: 1, ditambah_oleh_admin: true }
    const hasil = rencanakanTambahAddon([barisKlien, barisAdmin], masters, [{ addon_id: 'w20', jumlah: 2 }])
    assert.ok(hasil.ok)
    if (!hasil.ok) return
    assert.deepEqual(hasil.rencana.updateRows, [{ id: 'r2', jumlah: 3 }])
    assert.equal(hasil.rencana.insertRows.length, 0)
    const setelah = terapkanRencanaKeBaris([barisKlien, barisAdmin], hasil.rencana)
    assert.equal(setelah.filter(r => r.addon_id === 'w20' && r.ditambah_oleh_admin).length, 1)
  })

  await t.test('harga master berubah -> baris baru agar harga lama tidak berubah', () => {
    const barisAdminLama: BarisBookingAddon = { ...barisKlien, id: 'r2', harga: 20000, ditambah_oleh_admin: true }
    const hasil = rencanakanTambahAddon([barisAdminLama], masters, [{ addon_id: 'w20', jumlah: 1 }])
    assert.ok(hasil.ok)
    if (!hasil.ok) return
    assert.equal(hasil.rencana.insertRows.length, 1)
    assert.equal(hasil.rencana.updateRows.length, 0)
  })

  await t.test('total_harga, durasi_total & sisa pelunasan setelah penambahan', () => {
    const booking = { total_harga: 175000, dp_dibayar: 50000, durasi_total: 50 }
    const hasil = rencanakanTambahAddon([barisKlien], masters, [
      { addon_id: 'w30', jumlah: 2 },
      { addon_id: 'c4r', jumlah: 2 },
    ])
    assert.ok(hasil.ok)
    if (!hasil.ok) return
    assert.equal(hasil.rencana.deltaHarga, 2 * 35000 + 2 * 15000) // 100.000
    assert.equal(hasil.rencana.deltaMenit, 60)
    assert.equal(hasil.rencana.adaCetak, true)
    const r = ringkasanSetelah(booking, hasil.rencana.deltaHarga, hasil.rencana.deltaMenit)
    assert.deepEqual(r, { totalBaru: 275000, dp: 50000, sisaBaru: 225000, durasiBaru: 110 })
  })

  await t.test('total_harga & durasi_total setelah pengurangan dan penghapusan', () => {
    const barisAdmin: BarisBookingAddon = { ...barisKlien, id: 'r2', jumlah: 3, ditambah_oleh_admin: true }
    const booking = { total_harga: 250000, dp_dibayar: 50000, durasi_total: 110 }

    const kurang1 = rencanakanKurangiAddon(barisAdmin, 1)
    assert.ok(kurang1.ok)
    if (!kurang1.ok) return
    assert.deepEqual(kurang1.rencana.updateRows, [{ id: 'r2', jumlah: 2 }])
    const r1 = ringkasanSetelah(booking, kurang1.rencana.deltaHarga, kurang1.rencana.deltaMenit)
    assert.equal(r1.totalBaru, 225000)
    assert.equal(r1.durasiBaru, 90)

    const hapus = rencanakanKurangiAddon(barisAdmin, 3)
    assert.ok(hapus.ok)
    if (!hapus.ok) return
    assert.deepEqual(hapus.rencana.updateRows, [{ id: 'r2', jumlah: 0 }])
    const r2 = ringkasanSetelah(booking, hapus.rencana.deltaHarga, hapus.rencana.deltaMenit)
    assert.equal(r2.totalBaru, 175000)
    assert.equal(r2.durasiBaru, 50)
    assert.equal(terapkanRencanaKeBaris([barisKlien, barisAdmin], hapus.rencana).length, 1)
  })

  await t.test('tambah lalu kurangi kembali ke angka semula', () => {
    const booking = { total_harga: 150000, dp_dibayar: 50000, durasi_total: 30 }
    const tambah = rencanakanTambahAddon([], masters, [{ addon_id: 'w20', jumlah: 2 }])
    assert.ok(tambah.ok)
    if (!tambah.ok) return
    const setelahTambah = ringkasanSetelah(booking, tambah.rencana.deltaHarga, tambah.rencana.deltaMenit)
    const baris: BarisBookingAddon = { ...tambah.rencana.insertRows[0], id: 'x', ditambah_oleh_admin: true }
    const kurang = rencanakanKurangiAddon(baris, 2)
    assert.ok(kurang.ok)
    if (!kurang.ok) return
    const akhir = ringkasanSetelah(
      { ...booking, total_harga: setelahTambah.totalBaru, durasi_total: setelahTambah.durasiBaru },
      kurang.rencana.deltaHarga,
      kurang.rencana.deltaMenit
    )
    assert.equal(akhir.totalBaru, 150000)
    assert.equal(akhir.durasiBaru, 30)
  })

  await t.test('add-on pesanan awal klien tidak bisa dikurangi', () => {
    const hasil = rencanakanKurangiAddon(barisKlien, 1)
    assert.equal(hasil.ok, false)
  })

  await t.test('status cetak: diisi menunggu saat cetak baru, dikosongkan saat cetak terakhir dihapus', () => {
    assert.equal(tentukanAksiCetak({ statusCetak: null, paketPunyaCetak: false, barisSetelah: [{ jenis: 'cetak', jumlah: 1 }], adaCetakBaru: true }), 'menunggu')
    assert.equal(tentukanAksiCetak({ statusCetak: 'proses', paketPunyaCetak: false, barisSetelah: [{ jenis: 'cetak', jumlah: 1 }], adaCetakBaru: true }), 'tetap')
    assert.equal(tentukanAksiCetak({ statusCetak: 'menunggu', paketPunyaCetak: false, barisSetelah: [], adaCetakBaru: false }), 'kosongkan')
    assert.equal(tentukanAksiCetak({ statusCetak: 'menunggu', paketPunyaCetak: true, barisSetelah: [], adaCetakBaru: false }), 'tetap')
  })

  await t.test('peringatan jam tutup: 19:30 + 45 menit melewati 20:00', () => {
    assert.equal(isSlotWithinOperatingHours('19:30', 30, '00:00', '20:00'), true)
    assert.equal(isSlotWithinOperatingHours('19:30', 45, '00:00', '20:00'), false)
  })
})
