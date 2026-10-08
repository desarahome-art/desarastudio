'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { Printer, CheckCircle2, Clock } from 'lucide-react'
import type { BookingStatus, CetakStatus } from '@/types'

// ── Badges ───────────────────────────────────────────────────────────────────

export const bookingStatusLabel: Record<BookingStatus, string> = {
  pending: 'Menunggu',
  booking: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

export const bookingStatusStyle: Record<BookingStatus, string> = {
  pending:    'bg-amber-50 text-amber-800 border-amber-200/80',
  booking:    'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  selesai:    'bg-teal-50 text-teal-800 border-teal-200/80',
  dibatalkan: 'bg-rose-50 text-rose-700 border-rose-200/80',
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border tracking-tight',
        bookingStatusStyle[status]
      )}
    >
      {bookingStatusLabel[status]}
    </span>
  )
}

export const cetakStatusLabel: Record<CetakStatus, string> = {
  menunggu: 'Belum Dicetak',
  proses: 'Sedang Dicetak',
  selesai: 'Selesai Cetak',
}

export const cetakStatusStyle: Record<CetakStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-800 border-amber-200/80',
  proses:   'bg-purple-50 text-purple-800 border-purple-200/80',
  selesai:  'bg-emerald-50 text-emerald-800 border-emerald-200/80',
}

export function CetakBadge({ status }: { status: CetakStatus | null | undefined }) {
  const current = status || 'menunggu'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border tracking-tight',
        cetakStatusStyle[current]
      )}
    >
      <Printer className="w-3 h-3 shrink-0" />
      {cetakStatusLabel[current]}
    </span>
  )
}

export function WaitingListStatusBadge({
  isConverted,
  bookingKode,
  sudahDihubungi,
}: {
  isConverted: boolean
  bookingKode?: string
  sudahDihubungi?: boolean
}) {
  if (isConverted) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-800 border-emerald-200/80">
        <CheckCircle2 className="w-3 h-3 shrink-0" />
        Sudah Masuk Bookings {bookingKode ? `(${bookingKode})` : ''}
      </span>
    )
  }

  if (sudahDihubungi) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border bg-stone-100 text-stone-700 border-stone-200/80">
        Sudah Dihubungi
      </span>
    )
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-800 border-amber-200/80">
      <Clock className="w-3 h-3 shrink-0" />
      Menunggu Konfirmasi
    </span>
  )
}

// ── Minimal Info Chip ────────────────────────────────────────────────────────

interface InfoChipProps {
  icon?: React.ReactNode
  children: React.ReactNode
  variant?: 'neutral' | 'forest' | 'blitz' | 'amber' | 'purple'
  className?: string
}

const chipVariantStyles = {
  neutral: 'bg-[rgb(var(--color-cream-dark)/0.4)] text-[rgb(var(--color-text))] border-[rgb(var(--color-border)/0.7)]',
  forest:  'bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] border-[rgb(var(--color-forest)/0.2)] font-semibold',
  blitz:   'bg-[rgb(var(--color-blitz)/0.15)] text-[rgb(var(--color-text))] border-[rgb(var(--color-blitz)/0.3)] font-semibold',
  amber:   'bg-amber-50 text-amber-900 border-amber-200 font-semibold',
  purple:  'bg-purple-50 text-purple-900 border-purple-200 font-medium',
}

export function InfoChip({
  icon,
  children,
  variant = 'neutral',
  className,
}: InfoChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] sm:text-xs border tracking-tight shrink-0',
        chipVariantStyles[variant],
        className
      )}
    >
      {icon}
      {children}
    </span>
  )
}

// ── Card Shell & Field Component ─────────────────────────────────────────────

export function ClientCardShell({
  children,
  className,
  highlight,
}: {
  children: React.ReactNode
  className?: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] transition-all duration-150 overflow-hidden',
        highlight
          ? 'border-emerald-200 bg-emerald-50/15'
          : 'hover:border-[rgb(var(--color-forest)/0.35)]',
        className
      )}
    >
      {children}
    </div>
  )
}

export function ClientCardField({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      <span className="text-[11px] sm:text-xs text-[rgb(var(--color-text-muted))] block mb-0.5 font-normal">
        {label}
      </span>
      <div className="text-[13px] sm:text-sm font-medium text-[rgb(var(--color-text))]">
        {children}
      </div>
    </div>
  )
}
