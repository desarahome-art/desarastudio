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
  parseISO,
} from 'date-fns'
import { id as localeId } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react'

interface AdminCalendarPickerProps {
  value: string // YYYY-MM-DD
  onChange: (dateStr: string) => void
  bookingsCountByDate?: Record<string, number>
}

export function AdminCalendarPicker({
  value,
  onChange,
  bookingsCountByDate = {},
}: AdminCalendarPickerProps) {
  const selectedDate = value ? parseISO(value) : null
  const [currentMonth, setCurrentMonth] = useState(selectedDate || new Date())

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(monthStart)
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 })
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1))
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1))

  const days: Date[] = []
  let day = startDate
  while (day <= endDate) {
    days.push(day)
    day = addDays(day, 1)
  }

  const weekDayNames = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
  const today = new Date()

  return (
    <div className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 shadow-sm">
      {/* Header bar navigasi bulan */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center">
            <CalendarIcon className="w-4 h-4" />
          </div>
          <span className="font-heading font-bold text-sm text-[rgb(var(--color-text))] capitalize">
            {format(currentMonth, 'MMMM yyyy', { locale: localeId })}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="text-[11px] font-medium text-[rgb(var(--color-text-muted))] hover:text-red-500 mr-1 px-2 py-1 rounded-md hover:bg-red-50 flex items-center gap-1 transition-colors"
              title="Reset ke semua tanggal"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          )}
          <button
            type="button"
            onClick={prevMonth}
            aria-label="Bulan sebelumnya"
            className="w-7 h-7 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream))] transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-[rgb(var(--color-text))]" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Bulan berikutnya"
            className="w-7 h-7 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream))] transition-colors"
          >
            <ChevronRight className="w-3.5 h-3.5 text-[rgb(var(--color-text))]" />
          </button>
        </div>
      </div>

      {/* Baris nama hari */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {weekDayNames.map(d => (
          <div
            key={d}
            className="text-[10px] font-heading font-semibold text-[rgb(var(--color-text-muted))] py-0.5"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Grid tanggal */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => {
          const isSelected = selectedDate ? isSameDay(d, selectedDate) : false
          const isCurrentMonth = isSameMonth(d, currentMonth)
          const isToday = isSameDay(d, today)
          const dateStr = format(d, 'yyyy-MM-dd')
          const count = bookingsCountByDate[dateStr] || 0

          return (
            <button
              key={i}
              type="button"
              disabled={!isCurrentMonth}
              onClick={() => onChange(isSelected ? '' : dateStr)}
              className={`
                relative h-9 rounded-xl text-xs font-medium flex flex-col items-center justify-center transition-all duration-150
                ${!isCurrentMonth ? 'opacity-20 pointer-events-none' : ''}
                ${
                  isSelected
                    ? 'bg-[rgb(var(--color-forest))] text-white font-bold shadow-sm scale-102 ring-2 ring-[rgb(var(--color-forest)/0.3)]'
                    : 'hover:bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-text))]'
                }
              `}
            >
              <span className="leading-none">{format(d, 'd')}</span>
              
              {/* Dot atau Counter badge booking */}
              {count > 0 ? (
                <span
                  className={`mt-0.5 text-[9px] px-1 rounded-full font-bold leading-none ${
                    isSelected
                      ? 'bg-[rgb(var(--color-blitz))] text-black'
                      : 'bg-[rgb(var(--color-forest)/0.15)] text-[rgb(var(--color-forest))]'
                  }`}
                >
                  {count}
                </span>
              ) : isToday ? (
                <span
                  className={`w-1 h-1 rounded-full mt-0.5 ${
                    isSelected ? 'bg-white' : 'bg-[rgb(var(--color-blitz))]'
                  }`}
                />
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
