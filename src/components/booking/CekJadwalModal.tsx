'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { format, parseISO } from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { X, CalendarSearch, ArrowRight, Info } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { getAvailableSlots } from '@/app/actions'
import { ModernDatePicker } from './ModernDatePicker'
import { TimeSlotSelector } from './TimeSlotSelector'
import type { Package, Settings } from '@/types'

interface CekJadwalModalProps {
  settings: Settings
  packages: Package[]
  onClose: () => void
  /** Dipanggil saat klien menekan "Booking jam ini" */
  onPilihJadwal: (tanggal: string, jam: string) => void
}

/**
 * Modal untuk melihat jam kosong tanpa mengisi biodata.
 *
 * Slot dihitung dengan durasi paket TERPENDEK, karena aturan slot di sistem ini
 * hanya memblokir jam mulai yang sama persis; durasi hanya berpengaruh pada
 * batas jam tutup. Dengan durasi terpendek, semua jam yang mungkin ikut tampil.
 * Jam final tetap divalidasi ulang di Step 5 (sesuai paket) dan di server saat submit.
 */
export function CekJadwalModal({ settings, packages, onClose, onPilihJadwal }: CekJadwalModalProps) {
  const durasiTerpendek = (() => {
    const durasi = packages
      .filter(p => p.aktif !== false)
      .map(p => Number(p.durasi_menit) || 0)
      .filter(d => d > 0)
    return durasi.length > 0 ? Math.min(...durasi) : Number(settings?.slot_interval) || 30
  })()

  const [tanggal, setTanggal] = useState('')
  const [jam, setJam] = useState('')
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  // Setelah tanggal dipilih, gulir ke daftar jam (di HP daftar jam ada di bawah kalender)
  const daftarJamRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tanggal) return
    const t = setTimeout(() => {
      daftarJamRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 150)
    return () => clearTimeout(t)
  }, [tanggal])

  // Abaikan respons lama jika klien berpindah tanggal dengan cepat
  const permintaanRef = useRef(0)

  const muatSlot = useCallback(async (tgl: string) => {
    const nomor = ++permintaanRef.current
    setLoading(true)
    try {
      const hasil = await getAvailableSlots(tgl, durasiTerpendek)
      if (nomor !== permintaanRef.current) return
      setSlots(Array.isArray(hasil) ? hasil : [])
    } catch (err) {
      console.error('Gagal memuat jadwal kosong:', err)
      if (nomor === permintaanRef.current) setSlots([])
    } finally {
      if (nomor === permintaanRef.current) setLoading(false)
    }
  }, [durasiTerpendek])

  useEffect(() => {
    if (tanggal) muatSlot(tanggal)
  }, [tanggal, muatSlot])

  // Tutup dengan tombol Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const gantiTanggal = (tgl: string) => {
    setTanggal(tgl)
    setJam('')
    setSlots([])
  }

  const labelTanggal = tanggal
    ? format(parseISO(tanggal), 'EEEE, d MMMM yyyy', { locale: localeId })
    : ''

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cek-jadwal-judul"
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.34, 1.2, 0.64, 1] }}
        className="w-full max-w-lg bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-[rgb(var(--color-forest))] text-white border-b-4 border-[rgb(var(--color-blitz))] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-3 pr-10">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-blitz))] flex items-center justify-center shadow-lg shrink-0">
              <CalendarSearch className="w-6 h-6 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <h2 id="cek-jadwal-judul" className="font-heading font-bold text-xl sm:text-2xl text-white leading-tight">
                Cek Jadwal Kosong
              </h2>
              <p className="text-white/80 text-xs sm:text-sm mt-0.5">
                Lihat jam yang masih tersedia, tanpa isi data dulu.
              </p>
            </div>
          </div>
        </div>

        {/* Isi */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 flex flex-col gap-5">
          <ModernDatePicker
            value={tanggal}
            onChange={gantiTanggal}
            closedDates={settings?.closed_dates || []}
          />

          {tanggal && (
            <div ref={daftarJamRef} className="scroll-mt-4">
            <TimeSlotSelector
              slots={slots}
              selectedSlot={jam}
              durasiTotal={durasiTerpendek}
              tanggal={tanggal}
              loading={loading}
              onSelect={setJam}
              judul="Jam yang Masih Kosong"
              keterangan={<span className="capitalize">{labelTanggal}</span>}
              tampilkanJamSelesai={false}
            />
            </div>
          )}

          {tanggal && !loading && slots.length > 0 && (
            <p className="flex items-start gap-2 text-xs text-[rgb(var(--color-text-muted))] leading-relaxed">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                Jam menjelang tutup ({settings?.jam_tutup || '20:00'}) bisa tidak cukup untuk paket berdurasi panjang.
                Jam akan dicek ulang sesuai paket yang kamu pilih nanti.
              </span>
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-4 sm:px-6 py-4 border-t-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
            Tutup
          </Button>
          <Button
            type="button"
            onClick={() => onPilihJadwal(tanggal, jam)}
            disabled={!tanggal || !jam}
            className="flex-[2] group"
          >
            {jam ? `Booking jam ${jam}` : 'Pilih jam dulu'}
            {jam && <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
