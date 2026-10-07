'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { CheckCircle, MessageCircle, RotateCcw } from 'lucide-react'
import { formatRupiah, buildWAMessage } from '@/lib/utils'
import type { Booking, BookingAddon } from '@/types'

interface Step7SuksesProps {
  booking: Booking
  bookingAddons: BookingAddon[]
  waAdmin: string
  namaStudio: string
  onReset: () => void
}

export function Step7Sukses({
  booking,
  bookingAddons,
  waAdmin,
  namaStudio,
  onReset,
}: Step7SuksesProps) {
  const waMsg = buildWAMessage({
    nama_studio: namaStudio,
    kode: booking.kode,
    nama_klien: booking.nama_klien,
    package_nama: booking.package_nama,
    category_nama: booking.category_nama,
    tanggal: booking.tanggal,
    jam_mulai: booking.jam_mulai,
    total_harga: booking.total_harga,
    dp_dibayar: booking.dp_dibayar,
    status: 'Menunggu konfirmasi admin',
  })

  const waUrl = `https://wa.me/${waAdmin}?text=${waMsg}`

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
      className="flex flex-col items-center min-h-screen px-6 py-12 max-w-lg mx-auto w-full text-center"
    >
      {/* Icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-20 h-20 rounded-full bg-[rgb(var(--color-forest)/0.1)] flex items-center justify-center mb-6"
      >
        <CheckCircle className="w-10 h-10 text-[rgb(var(--color-forest))]" />
      </motion.div>

      <h2 className="font-heading text-2xl font-bold mb-2">Booking Berhasil!</h2>
      <p className="text-[rgb(var(--color-text-muted))] mb-6">
        Menunggu konfirmasi admin
      </p>

      {/* Kode booking */}
      <div className="w-full rounded-2xl bg-[rgb(var(--color-blitz)/0.15)] border-2 border-[rgb(var(--color-blitz))] px-6 py-4 mb-6">
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-1">Kode Booking</p>
        <p className="font-heading font-bold text-3xl tracking-wider">{booking.kode}</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
          Simpan kode ini untuk pengecekan status
        </p>
      </div>

      {/* Ringkasan */}
      <div className="w-full rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] p-5 text-left mb-6">
        <h3 className="font-heading font-semibold mb-3">Ringkasan Booking</h3>
        <div className="flex flex-col gap-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-[rgb(var(--color-text-muted))]">Nama</span>
            <span className="font-medium">{booking.nama_klien}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--color-text-muted))]">Paket</span>
            <span className="font-medium">{booking.category_nama} – {booking.package_nama}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--color-text-muted))]">Tanggal</span>
            <span className="font-medium">{new Date(booking.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[rgb(var(--color-text-muted))]">Jam</span>
            <span className="font-medium">{booking.jam_mulai} WIB</span>
          </div>
          {bookingAddons.length > 0 && bookingAddons.map(a => (
            <div key={a.id} className="flex justify-between">
              <span className="text-[rgb(var(--color-text-muted))]">{a.nama} ×{a.jumlah}</span>
              <span>{formatRupiah(a.total)}</span>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-[rgb(var(--color-border))] font-heading font-bold">
            <span>Total</span>
            <span className="text-[rgb(var(--color-forest))]">{formatRupiah(booking.total_harga)}</span>
          </div>
          <div className="flex justify-between text-xs text-[rgb(var(--color-text-muted))]">
            <span>DP Dibayar</span>
            <span>{formatRupiah(booking.dp_dibayar)}</span>
          </div>
          <div className="flex justify-between text-xs font-medium">
            <span>Sisa Pelunasan</span>
            <span>{formatRupiah(booking.sisa_pelunasan)}</span>
          </div>
        </div>
      </div>

      {/* Notice Bukti Transfer WA */}
      <div className="w-full rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 mb-6 text-left flex items-start gap-3">
        <MessageCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-heading font-bold text-xs sm:text-sm text-emerald-900">
            Kirimkan Bukti Transfer DP via WhatsApp
          </p>
          <p className="text-xs text-emerald-800 leading-relaxed mt-0.5">
            Klik tombol di bawah untuk membuka chat dengan Admin dan lampirkan screenshot bukti transfer pembayaran DP Anda.
          </p>
        </div>
      </div>

      {/* WhatsApp CTA */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="w-full"
      >
        <Button variant="secondary" size="lg" className="w-full mb-3 shadow-md">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          Kirim Bukti Transfer ke Admin via WA
        </Button>
      </a>

      <button
        onClick={onReset}
        className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Booking lagi
      </button>
    </motion.div>
  )
}
