'use client'

import { motion } from 'framer-motion'
import { Clock, Sunrise, Sun, Sunset, Check } from 'lucide-react'
import { timeToMinutes, minutesToTime } from '@/lib/utils'

interface TimeSlotSelectorProps {
  slots: string[]
  selectedSlot: string
  durasiTotal: number
  tanggal: string
  loading: boolean
  onSelect: (slot: string) => void
  error?: string
}

export function TimeSlotSelector({
  slots,
  selectedSlot,
  durasiTotal,
  tanggal,
  loading,
  onSelect,
  error,
}: TimeSlotSelectorProps) {
  // Hitung jam selesai
  const getEndTime = (start: string) => {
    if (!start || typeof start !== 'string') return ''
    try {
      const startM = timeToMinutes(start)
      return minutesToTime(startM + (Number(durasiTotal) || 30))
    } catch {
      return start
    }
  }

  // Kelompokkan slot jam berdasarkan waktu hari
  const safeSlots = Array.isArray(slots) ? slots : []
  const pagiSlots = safeSlots.filter(s => {
    try {
      return timeToMinutes(s) < 12 * 60
    } catch {
      return false
    }
  })
  const siangSlots = safeSlots.filter(s => {
    try {
      const m = timeToMinutes(s)
      return m >= 12 * 60 && m < 15 * 60
    } catch {
      return false
    }
  })
  const soreMalamSlots = safeSlots.filter(s => {
    try {
      return timeToMinutes(s) >= 15 * 60
    } catch {
      return false
    }
  })

  const sessionGroups = [
    { title: 'Pagi', icon: Sunrise, items: pagiSlots, sub: '08:00 - 11:30' },
    { title: 'Siang', icon: Sun, items: siangSlots, sub: '12:00 - 14:30' },
    { title: 'Sore & Malam', icon: Sunset, items: soreMalamSlots, sub: '15:00 - 20:00' },
  ].filter(g => g.items.length > 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-heading font-semibold text-[rgb(var(--color-text))]">
            Pilih Jam Mulai
          </label>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Durasi total sesi: <span className="font-semibold text-[rgb(var(--color-text))]">{durasiTotal} menit</span>
          </p>
        </div>

        {selectedSlot && (
          <span className="text-xs font-heading font-bold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-3 py-1 rounded-full flex items-center gap-1.5 border border-[rgb(var(--color-forest)/0.2)]">
            <Clock className="w-3.5 h-3.5" />
            {selectedSlot} – {getEndTime(selectedSlot)} WIB
          </span>
        )}
      </div>

      <div className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5 shadow-sm">
        {!tanggal ? (
          <div className="text-center py-8 px-4">
            <Clock className="w-8 h-8 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium text-[rgb(var(--color-text-muted))]">
              Silakan pilih tanggal terlebih dahulu di atas
            </p>
          </div>
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <div className="animate-spin w-7 h-7 border-3 border-[rgb(var(--color-forest))] border-t-transparent rounded-full" />
            <p className="text-xs text-[rgb(var(--color-text-muted))]">Memeriksa ketersediaan slot...</p>
          </div>
        ) : safeSlots.length === 0 ? (
          <div className="text-center py-8 px-4">
            <p className="text-sm font-semibold text-red-500 mb-1">
              Slot Penuh untuk Tanggal Ini
            </p>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Semua jam sudah dipesan atau durasi paket melebihi sisa waktu operasional. Silakan pilih tanggal lain.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {sessionGroups.map(group => {
              const Icon = group.icon
              return (
                <div key={group.title} className="flex flex-col gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-heading font-semibold text-[rgb(var(--color-text-muted))] pb-1 border-b border-[rgb(var(--color-border)/0.6)]">
                    <Icon className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                    <span>{group.title}</span>
                    <span className="text-[10px] opacity-60 font-normal">({group.sub})</span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {group.items.map(slot => {
                      const isSelected = selectedSlot === slot
                      const endTime = getEndTime(slot)

                      return (
                        <motion.button
                          key={slot}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => onSelect(slot)}
                          className={`
                            relative flex flex-col items-center justify-center py-2.5 px-2 rounded-xl border-2 transition-all duration-150 text-center
                            ${
                              isSelected
                                ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-blitz))] shadow-md font-bold'
                                : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.6)] text-[rgb(var(--color-text))]'
                            }
                          `}
                        >
                          <span className="font-heading text-sm sm:text-base leading-tight">
                            {slot}
                          </span>
                          <span
                            className={`text-[10px] mt-0.5 ${
                              isSelected ? 'text-white/80' : 'text-[rgb(var(--color-text-muted))]'
                            }`}
                          >
                            s/d {endTime}
                          </span>

                          {isSelected && (
                            <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[rgb(var(--color-blitz))] flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                            </div>
                          )}
                        </motion.button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info ringkasan slot terpilih */}
        {selectedSlot && (
          <div className="mt-4 pt-3 border-t border-[rgb(var(--color-border))] flex items-center justify-between text-xs text-[rgb(var(--color-text))]">
            <span className="text-[rgb(var(--color-text-muted))]">Estimasi Waktu:</span>
            <span className="font-heading font-semibold text-[rgb(var(--color-forest))]">
              {selectedSlot} – {getEndTime(selectedSlot)} WIB ({durasiTotal} menit)
            </span>
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}
