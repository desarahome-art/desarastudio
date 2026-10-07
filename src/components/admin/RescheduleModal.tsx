'use client'

import { useState, useTransition, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ModernDatePicker } from '@/components/booking/ModernDatePicker'
import { getAvailableSlots, updateBookingSchedule } from '@/app/actions'
import { X, Calendar, Clock, Check, AlertCircle, FileText } from 'lucide-react'
import type { Booking } from '@/types'

interface RescheduleModalProps {
  booking: Booking
  adminEmail: string
  onClose: () => void
  onSuccess: () => void
}

export function RescheduleModal({
  booking,
  adminEmail,
  onClose,
  onSuccess,
}: RescheduleModalProps) {
  const [tanggal, setTanggal] = useState(booking.tanggal)
  const [jam, setJam] = useState(booking.jam_mulai)
  const [keterangan, setKeterangan] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  useEffect(() => {
    if (!tanggal) return
    let active = true
    setLoadingSlots(true)

    getAvailableSlots(tanggal, booking.durasi_total, '08:00', '20:00', 30)
      .then(slots => {
        if (!active) return
        // Pastikan jam booking saat ini tetap ada di list jika tanggalnya sama
        const finalSlots = Array.isArray(slots) ? [...slots] : []
        if (tanggal === booking.tanggal && !finalSlots.includes(booking.jam_mulai)) {
          finalSlots.push(booking.jam_mulai)
          finalSlots.sort()
        }
        setAvailableSlots(finalSlots)
      })
      .catch(() => {
        if (active) setAvailableSlots([])
      })
      .finally(() => {
        if (active) setLoadingSlots(false)
      })

    return () => {
      active = false
    }
  }, [tanggal, booking.durasi_total, booking.tanggal, booking.jam_mulai])

  const handleSave = () => {
    if (!tanggal || !jam) {
      setError('Pilih tanggal dan jam terlebih dahulu')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await updateBookingSchedule(
        booking.id,
        tanggal,
        jam,
        adminEmail,
        keterangan
      )
      if (res.error) {
        setError(res.error)
      } else {
        onSuccess()
        onClose()
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-[rgb(var(--color-forest))] text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-blitz))] text-black flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg">Atur Ulang Jadwal</h3>
              <p className="text-xs text-white/80">
                {booking.nama_klien} · {booking.kode}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex flex-col gap-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Kalender Modern */}
          <div>
            <label className="text-xs font-heading font-bold text-[rgb(var(--color-text))] mb-1.5 block">
              1. Pilih Tanggal Baru
            </label>
            <ModernDatePicker
              value={tanggal}
              onChange={newDate => {
                setTanggal(newDate)
                setJam('')
              }}
            />
          </div>

          {/* Slot Jam Modern */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-heading font-bold text-[rgb(var(--color-text))]">
                2. Pilih Jam Mulai
              </label>
              {jam && (
                <span className="text-xs font-bold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {jam} WIB
                </span>
              )}
            </div>

            {loadingSlots ? (
              <div className="p-6 text-center text-xs text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-surface))] rounded-2xl border border-[rgb(var(--color-border))]">
                Memuat ketersediaan slot jam...
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-4 text-center text-xs text-red-500 bg-red-50 rounded-2xl border border-red-200">
                Tidak ada slot jam tersedia pada tanggal ini.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 bg-[rgb(var(--color-surface))] p-3 rounded-2xl border-2 border-[rgb(var(--color-border))]">
                {availableSlots.map(slot => {
                  const isSelected = jam === slot
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setJam(slot)}
                      className={`
                        py-2 px-1 rounded-xl text-xs font-heading font-bold transition-all text-center
                        ${
                          isSelected
                            ? 'bg-[rgb(var(--color-forest))] text-white shadow-sm ring-2 ring-[rgb(var(--color-blitz))]'
                            : 'bg-[rgb(var(--color-cream))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-forest)/0.1)] border border-[rgb(var(--color-border))]'
                        }
                      `}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Input Keterangan / Alasan Reschedule */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-heading font-bold text-[rgb(var(--color-text))] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                3. Keterangan / Alasan Perubahan (Opsional)
              </label>
              <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                Tercatat di riwayat booking
              </span>
            </div>
            <textarea
              rows={2}
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              placeholder="Contoh: Permintaan klien via WA, studio ada kendala teknis, dll..."
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs focus:outline-none focus:border-[rgb(var(--color-forest))] resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex gap-2">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button
            onClick={handleSave}
            loading={isPending}
            disabled={!tanggal || !jam}
            className="flex-1"
          >
            <Check className="w-4 h-4" />
            Simpan Perubahan
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
