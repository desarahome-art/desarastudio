'use client'

import { useState } from 'react'
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  isSameMonth,
  isSameDay,
  addDays,
  isBefore,
  startOfDay,
  parseISO,
} from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react'

import type { ClosedDateItem } from '@/types'

interface ModernDatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (dateStr: string) => void
  error?: string
  closedDates?: ClosedDateItem[]
}

export function ModernDatePicker({ value, onChange, error, closedDates = [] }: ModernDatePickerProps) {
  const today = startOfDay(new Date())
  const selectedDate = value ? parseISO(value) : null
  const [currentMonth, setCurrentMonth] = useState(selectedDate || today)

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }) // Mulai hari Senin
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const prevMonth = () => {
    // Cegah navigasi ke bulan sebelum bulan sekarang
    if (!isBefore(startOfMonth(subMonths(currentMonth, 1)), startOfMonth(today))) {
      setCurrentMonth(subMonths(currentMonth, 1))
    }
  }

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1))
  }

  const isPrevDisabled = isBefore(
    startOfMonth(subMonths(currentMonth, 1)),
    startOfMonth(today)
  )

  // Generate baris tanggal
  const days: Date[] = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weekDayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-heading font-semibold text-[rgb(var(--color-text))]">
          Pilih Tanggal Sesi
        </label>
        {selectedDate && (
          <span className="text-xs font-medium text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2.5 py-1 rounded-full flex items-center gap-1">
            <Check className="w-3 h-3" />
            {format(selectedDate, 'd MMM yyyy', { locale: localeId })}
          </span>
        )}
      </div>

      <div className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5 shadow-sm">
        {/* Month Header Navigation */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center">
              <CalendarIcon className="w-4 h-4" />
            </div>
            <h4 className="font-heading font-bold text-base text-[rgb(var(--color-text))] capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: localeId })}
            </h4>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              disabled={isPrevDisabled}
              aria-label="Bulan sebelumnya"
              className="w-8 h-8 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream))] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[rgb(var(--color-text))]" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Bulan berikutnya"
              className="w-8 h-8 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream))] transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[rgb(var(--color-text))]" />
            </button>
          </div>
        </div>

        {/* Nama-nama Hari */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {weekDayNames.map(d => (
            <div
              key={d}
              className="text-[11px] font-heading font-semibold text-[rgb(var(--color-text-muted))] py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Grid Tanggal */}
        <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
          {days.map((d, i) => {
            const dateStr = format(d, 'yyyy-MM-dd')
            const closedInfo = closedDates.find(c => c.tanggal === dateStr)
            const isClosed = Boolean(closedInfo)
            const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
            const isCurrentMonth = isSameMonth(d, currentMonth)
            const isPast = isBefore(d, today)
            const isToday = isSameDay(d, today)
            const isDisabled = isPast || !isCurrentMonth || isClosed

            return (
              <button
                key={i}
                type="button"
                disabled={isDisabled}
                title={closedInfo ? `Studio Tutup: ${closedInfo.keterangan}` : undefined}
                onClick={() => onChange(dateStr)}
                className={`
                  relative h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-medium flex flex-col items-center justify-center transition-all duration-150
                  ${!isCurrentMonth ? 'opacity-0 pointer-events-none' : ''}
                  ${
                    isClosed
                      ? 'bg-rose-50 border border-rose-200/80 text-rose-500 cursor-not-allowed line-through opacity-80'
                      : isPast
                      ? 'text-[rgb(var(--color-text-muted)/0.4)] cursor-not-allowed'
                      : isSelected
                      ? 'bg-[rgb(var(--color-forest))] text-white font-bold shadow-md scale-105'
                      : 'hover:bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-text))] active:scale-95'
                  }
                `}
              >
                <span>{format(d, 'd')}</span>
                {/* Indikator Hari Libur / Tutup */}
                {isClosed && isCurrentMonth ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-0.5" />
                ) : isToday && !isSelected ? (
                  <span className="w-1.5 h-1.5 rounded-full bg-[rgb(var(--color-blitz))] mt-0.5" />
                ) : null}
              </button>
            )
          })}
        </div>

        {/* Selected Date Summary Banner */}
        {selectedDate && (
          <div className="mt-4 pt-3 border-t border-[rgb(var(--color-border))] flex items-center justify-between text-xs text-[rgb(var(--color-text))]">
            <span className="text-[rgb(var(--color-text-muted))]">Tanggal Terpilih:</span>
            <span className="font-heading font-semibold text-[rgb(var(--color-forest))]">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: localeId })}
            </span>
          </div>
        )}

        {/* Closed Dates Information in this month */}
        {closedDates.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-dashed border-[rgb(var(--color-border))] flex flex-col gap-1 text-[11px] text-[rgb(var(--color-text-muted))]">
            <div className="flex items-center gap-1.5 font-medium text-rose-600">
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
              <span>Tanggal Berwarna Merah = Studio Tutup / Libur</span>
            </div>
            {closedDates
              .filter(c => {
                try {
                  return isSameMonth(parseISO(c.tanggal), currentMonth)
                } catch {
                  return false
                }
              })
              .map(c => (
                <div key={c.tanggal} className="pl-3.5 text-xs text-rose-700 font-medium">
                  • {c.tanggal}: <span className="font-normal italic">{c.keterangan || 'Studio Tutup'}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  )
}
