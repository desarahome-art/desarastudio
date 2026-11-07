import test from 'node:test'
import assert from 'node:assert/strict'
import {
  statusBayarBooking, ringkasPembayaranBooking, uraiLogPembayaran, dpSaatBooking, susunRiwayatBooking,
} from '../src/lib/pembayaran-booking.ts'

// formatRupiah memakai Intl (spasi tak-putus setelah "Rp")
const rp = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n)
const bk = (status: string, total: number, dibayar: number) => ({ status, total_harga: total, dp_dibayar: dibayar })

test('status bayar booking', () => {
  assert.equal(statusBayarBooking(bk('pending', 570000, 100000)), 'belum_dicek')
  assert.equal(statusBayarBooking(bk('pending', 570000, 0)), 'belum_bayar')
  assert.equal(statusBayarBooking(bk('booking', 900000, 0)), 'belum_bayar')
  assert.equal(statusBayarBooking(bk('booking', 900000, 400000)), 'dp')
  assert.equal(statusBayarBooking(bk('selesai', 300000, 300000)), 'lunas')
  assert.equal(statusBayarBooking(bk('pending', 300000, 300000)), 'lunas')
  assert.equal(statusBayarBooking(bk('booking', 300000, 350000)), 'lunas') // lebih bayar
  assert.equal(statusBayarBooking(bk('dibatalkan', 300000, 100000)), 'batal')
})

test('ringkasan: DP pending tidak masuk uang masuk, dibatalkan diabaikan', () => {
  const r = ringkasPembayaranBooking([
    bk('pending', 570000, 100000),
    bk('booking', 900000, 400000),
    bk('selesai', 300000, 300000),
    bk('dibatalkan', 300000, 100000),
  ])
  assert.deepEqual(r, { belumDicek: 1, belumLunas: 2, sisaTagihan: 470000 + 500000, uangMasuk: 700000 })
})

test('urai log cicilan & pelunasan manual', () => {
  assert.deepEqual(
    uraiLogPembayaran(`Pembayaran cicilan ${rp(300000)} (Tunai) · dibayar ${rp(100000)} → ${rp(400000)} · bayar di studio`),
    { label: 'Cicilan', rincian: 'tunai · bayar di studio', jumlah: 300000 }
  )
  assert.deepEqual(
    uraiLogPembayaran(`Pembayaran pelunasan ${rp(500000)} (Transfer) · dibayar ${rp(400000)} → ${rp(900000)}`),
    { label: 'Pelunasan', rincian: 'transfer', jumlah: 500000 }
  )
})

test('urai log pelunasan otomatis, waiting list, koreksi', () => {
  assert.deepEqual(
    uraiLogPembayaran(`Pembayaran pelunasan ${rp(200000)} (otomatis saat sesi selesai) · dibayar ${rp(100000)} → ${rp(300000)}`),
    { label: 'Pelunasan otomatis (sesi selesai)', jumlah: 200000 }
  )
  assert.deepEqual(
    uraiLogPembayaran(`Pembayaran dari waiting list ${rp(100000)} · dibayar Rp 0 → ${rp(100000)} · 1 Nov DP ${rp(100000)} (Transfer)`),
    { label: 'Dari waiting list', rincian: `1 Nov DP ${rp(100000)} (Transfer)`, jumlah: 100000 }
  )
  assert.deepEqual(
    uraiLogPembayaran(`Koreksi pembayaran: dibayar ${rp(300000)} → ${rp(200000)} · alasan: salah input`),
    { label: 'Koreksi', rincian: 'salah input', jumlah: -100000 }
  )
  assert.deepEqual(uraiLogPembayaran('Pembayaran format lama tidak dikenal'), { label: 'Pembayaran format lama tidak dikenal', jumlah: null })
})

test('DP saat booking dari log pertama', () => {
  assert.equal(dpSaatBooking(`Pembayaran cicilan ${rp(300000)} (Tunai) · dibayar ${rp(100000)} → ${rp(400000)}`, 400000), 100000)
  assert.equal(dpSaatBooking(`Pembayaran dari waiting list ${rp(100000)} · dibayar Rp 0 → ${rp(100000)}`, 100000), 0)
  assert.equal(dpSaatBooking(undefined, 150000), 150000)
})

test('susun riwayat: baris DP awal + log urut waktu', () => {
  const b = { ...bk('booking', 900000, 400000), created_at: '2026-11-02T01:00:00Z' }
  const r = susunRiwayatBooking(b, [
    { catatan: `Pembayaran cicilan ${rp(300000)} (Tunai) · dibayar ${rp(100000)} → ${rp(400000)}`, created_at: '2026-11-06T01:00:00Z', oleh: 'a@x' },
  ])
  assert.deepEqual(r.map(x => [x.label, x.jumlah]), [['DP saat booking', 100000], ['Cicilan', 300000]])
  const pending = susunRiwayatBooking({ ...bk('pending', 570000, 100000), created_at: '2026-11-07T01:00:00Z' }, [])
  assert.equal(pending[0].label, 'DP dari client (belum dicek)')
  assert.equal(susunRiwayatBooking(bk('pending', 570000, 0), []).length, 0)
})
