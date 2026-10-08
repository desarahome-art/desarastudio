'use client'

import { useState, useTransition } from 'react'
import {
  markWaitingListContacted,
  convertWaitingListToBooking,
  deleteWaitingList,
} from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { parseWaitingListInfo, cn } from '@/lib/utils'
import {
  WaitingListStatusBadge,
  InfoChip,
  ClientCardShell,
  ClientCardField,
} from './shared/ClientCardUI'
import {
  Check,
  MessageCircle,
  CalendarCheck,
  Clock,
  School,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Trash2,
  GraduationCap,
  X,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ModernDatePicker } from '@/components/booking/ModernDatePicker'
import type { WaitingList, ClosedDateItem } from '@/types'

// ── Modal konfirmasi konversi dengan date picker ──────────────────────────────
function ConvertModal({
  item,
  parsedJam,
  closedDates = [],
  onConfirm,
  onClose,
  loading,
  error,
}: {
  item: WaitingList
  parsedJam?: string
  closedDates?: ClosedDateItem[]
  onConfirm: (tanggal: string) => void
  onClose: () => void
  loading: boolean
  error: string
}) {
  const today = new Date().toISOString().slice(0, 10)
  const [tanggal, setTanggal] = useState(item.tanggal_ingin || today)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[rgb(var(--color-surface))] rounded-2xl shadow-xl border border-[rgb(var(--color-border))] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="relative px-5 py-4 bg-[rgb(var(--color-forest))] text-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 p-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-blitz))] flex items-center justify-center text-[rgb(var(--color-forest))] font-bold shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0 pr-8">
              <p className="font-heading font-semibold text-sm sm:text-base text-white leading-tight">
                Masukkan ke Bookings
              </p>
              <p className="text-xs text-white/75 truncate mt-0.5">
                {item.nama} · {item.wa}
              </p>
            </div>
          </div>
        </div>

        {/* Body (Scrollable) */}
        <div className="p-4 sm:p-5 flex flex-col gap-4 overflow-y-auto">
          {/* Ringkasan data client */}
          <div className="rounded-xl bg-[rgb(var(--color-cream-dark)/0.25)] border border-[rgb(var(--color-border))] p-3">
            <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-2">
              Data Waiting List
            </p>
            <div className="flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">Kategori Foto</span>
                <span className="font-semibold text-[rgb(var(--color-forest))]">
                  {item.category_nama}
                </span>
              </div>
              {item.package_nama && (
                <div className="flex items-center justify-between">
                  <span className="text-[rgb(var(--color-text-muted))]">Paket Foto</span>
                  <span className="font-medium text-[rgb(var(--color-text))]">{item.package_nama}</span>
                </div>
              )}
              {item.acara_nama && (
                <div className="flex items-center justify-between">
                  <span className="text-[rgb(var(--color-text-muted))]">Acara Wisuda</span>
                  <span className="font-medium text-purple-700 max-w-[55%] text-right truncate">
                    {item.acara_nama}
                  </span>
                </div>
              )}
              {parsedJam && (
                <div className="flex items-center justify-between pt-1.5 border-t border-[rgb(var(--color-border)/0.6)]">
                  <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-700" /> Jam Sesi
                  </span>
                  <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                    {parsedJam} WIB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Pilih Tanggal Fix */}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-[rgb(var(--color-text))]">
              Pilih Tanggal Sesi
            </span>
            <ModernDatePicker
              value={tanggal}
              onChange={setTanggal}
              closedDates={closedDates}
            />
          </div>

          {/* Info note */}
          <div className="rounded-lg bg-[rgb(var(--color-forest)/0.06)] border border-[rgb(var(--color-forest)/0.2)] p-3 flex items-start gap-2">
            <Info className="w-3.5 h-3.5 text-[rgb(var(--color-forest))] shrink-0 mt-0.5" />
            <p className="text-xs text-[rgb(var(--color-text))] leading-relaxed">
              Booking dibuat dengan status <strong>Menunggu</strong>. Paket &amp; jam dari waiting list otomatis terpindah. Tanggal di atas yang akan tercatat di bookings.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              variant="ghost"
              className="flex-1 rounded-lg h-9 min-h-[40px] text-xs border border-[rgb(var(--color-border))]"
              onClick={onClose}
              disabled={loading}
            >
              Batal
            </Button>
            <Button
              className="flex-1 rounded-lg h-9 min-h-[40px] text-xs font-semibold"
              loading={loading}
              disabled={!tanggal || loading}
              onClick={() => onConfirm(tanggal)}
            >
              <CalendarCheck className="w-3.5 h-3.5 mr-1" />
              Konfirmasi &amp; Buat Booking
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Card Item Component ───────────────────────────────────────────────────────
function WaitingListRow({
  item,
  isPending,
  deletingId,
  onOpenConvert,
  onContacted,
  onDelete,
}: {
  item: WaitingList
  isPending: boolean
  deletingId: string | null
  onOpenConvert: (item: WaitingList) => void
  onContacted: (id: string) => void
  onDelete: (id: string, nama: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const parsed = parseWaitingListInfo(item.catatan)
  const isConverted = Boolean(parsed.bookingKode)

  const formattedDateIngin = item.tanggal_ingin
    ? new Date(item.tanggal_ingin).toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null

  const formattedCreated = new Date(item.created_at).toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <ClientCardShell highlight={isConverted}>
      {/* ── Header row (Accordion Trigger) ── */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={cn(
          'w-full p-3 sm:p-4 text-left transition-colors focus-visible:outline-none',
          item.sudah_dihubungi && !isConverted ? 'opacity-85' : '',
          'hover:bg-[rgb(var(--color-cream-dark)/0.35)] focus-visible:bg-[rgb(var(--color-cream-dark)/0.35)]'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          {/* Sisi Kiri: Nama, Status, Meta, Chips */}
          <div className="flex-1 min-w-0">
            {/* Baris 1: Nama Klien + Status Badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-heading font-semibold text-[15px] sm:text-base text-[rgb(var(--color-text))] truncate max-w-[200px] sm:max-w-none">
                {item.nama}
              </span>
              <WaitingListStatusBadge
                isConverted={isConverted}
                bookingKode={parsed.bookingKode}
                sudahDihubungi={item.sudah_dihubungi}
              />
            </div>

            {/* Baris 2: Meta line */}
            <p className="text-xs text-[rgb(var(--color-text-muted))] truncate mb-2">
              {item.category_nama}
              {item.package_nama ? ` · ${item.package_nama}` : ''}
              {item.acara_nama ? ` · ${item.acara_nama}` : ''}
            </p>

            {/* Baris 3: Info Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {formattedDateIngin && !item.acara_nama && (
                <InfoChip icon={<Calendar className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />} variant="forest">
                  {formattedDateIngin}
                </InfoChip>
              )}
              {parsed.jam && (
                <InfoChip icon={<Clock className="w-3.5 h-3.5 text-amber-700" />} variant="amber">
                  {parsed.jam} WIB
                </InfoChip>
              )}
              {item.acara_nama && (
                <InfoChip icon={<GraduationCap className="w-3.5 h-3.5 text-purple-700" />} variant="purple" className="truncate max-w-[200px]">
                  {item.acara_nama}
                </InfoChip>
              )}
              {parsed.kampus && (
                <InfoChip icon={<School className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />} variant="neutral" className="hidden sm:inline-flex truncate max-w-[180px]">
                  {parsed.kampus}
                </InfoChip>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Waktu Daftar & Toggle Chevron */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-right pt-0.5">
            <span className="text-[11px] text-[rgb(var(--color-text-muted))]">
              {formattedCreated}
            </span>
            <div className="w-6 h-6 rounded-md flex items-center justify-center text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]">
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </div>
        </div>
      </button>

      {/* ── Expanded Detail & Actions ── */}
      {expanded && (
        <div className="border-t border-[rgb(var(--color-border))] p-3 sm:p-4 bg-[rgb(var(--color-surface))]">
          {/* Informasi Sekunder Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-sm mb-3 sm:mb-4">
            <ClientCardField label="WhatsApp">
              <a
                href={`https://wa.me/${item.wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[rgb(var(--color-forest))] hover:underline inline-flex items-center gap-1"
              >
                {item.wa}
              </a>
            </ClientCardField>

            {parsed.kampus && (
              <ClientCardField label="Kampus / Instansi">
                {parsed.kampus}
              </ClientCardField>
            )}

            {item.acara_nama && (
              <ClientCardField label="Acara Wisuda">
                <span className="text-purple-900 font-medium">{item.acara_nama}</span>
              </ClientCardField>
            )}

            <ClientCardField label="Waktu Pendaftaran">
              {new Date(item.created_at).toLocaleString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </ClientCardField>

            {item.catatan && (
              <ClientCardField label="Catatan Tambahan" className="sm:col-span-2">
                <p className="whitespace-pre-line text-xs font-normal text-[rgb(var(--color-text))] bg-[rgb(var(--color-cream-dark)/0.3)] p-2 rounded-lg border border-[rgb(var(--color-border)/0.6)]">
                  {item.catatan}
                </p>
              </ClientCardField>
            )}
          </div>

          {/* ── Footer Aksi ── */}
          <div className="pt-3 border-t border-[rgb(var(--color-border)/0.6)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Primary Action Button */}
            {!isConverted ? (
              <Button
                size="sm"
                variant="primary"
                onClick={() => onOpenConvert(item)}
                disabled={isPending}
                className="rounded-lg h-9 min-h-[40px] text-xs font-semibold w-full sm:w-auto"
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                Masukkan ke Bookings
              </Button>
            ) : (
              <Link href="/admin/bookings" className="w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg h-9 min-h-[40px] text-xs font-semibold border border-emerald-300 text-emerald-800 bg-emerald-50/50 hover:bg-emerald-100/70 w-full justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1" />
                  Lihat di Bookings
                </Button>
              </Link>
            )}

            {/* Secondary & Destructive Actions */}
            <div className="flex items-center gap-2">
              <a
                href={`https://wa.me/${item.wa}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 sm:flex-none"
              >
                <Button
                  size="sm"
                  variant="ghost"
                  className="rounded-lg h-9 min-h-[40px] text-xs font-medium border border-emerald-300/80 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 w-full justify-center"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  WA
                </Button>
              </a>

              {!item.sudah_dihubungi && !isConverted && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onContacted(item.id)}
                  loading={isPending}
                  className="rounded-lg h-9 min-h-[40px] text-xs border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-cream-dark)/0.5)] justify-center flex-1 sm:flex-none"
                  title="Tandai sudah dihubungi"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Tandai
                </Button>
              )}

              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(item.id, item.nama)}
                loading={deletingId === item.id}
                disabled={isPending || deletingId === item.id}
                className="rounded-lg h-9 min-h-[40px] text-xs border border-rose-200 text-rose-700 bg-rose-50/40 hover:bg-rose-100/60 hover:border-rose-300 justify-center shrink-0"
                title="Hapus Permanen"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                Hapus
              </Button>
            </div>
          </div>
        </div>
      )}
    </ClientCardShell>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function WaitingListClient({
  items,
  adminEmail,
  closedDates = [],
}: {
  items: WaitingList[]
  adminEmail?: string
  closedDates?: ClosedDateItem[]
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Modal state
  const [convertTarget, setConvertTarget] = useState<WaitingList | null>(null)
  const [convertParsedJam, setConvertParsedJam] = useState<string | undefined>()
  const [convertLoading, setConvertLoading] = useState(false)
  const [convertError, setConvertError] = useState('')

  const handleContacted = (id: string) => {
    startTransition(async () => {
      await markWaitingListContacted(id)
      router.refresh()
    })
  }

  const handleDelete = async (id: string, nama: string) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin MENGHAPUS PERMANEN data waiting list client "${nama}"?\n\nTindakan ini tidak dapat dibatalkan.`
    )
    if (!confirmed) return

    setDeletingId(id)
    setFeedback(null)
    try {
      const res = await deleteWaitingList(id)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
      } else {
        setFeedback({
          type: 'success',
          message: `Data waiting list ${nama} berhasil dihapus permanen.`,
        })
        router.refresh()
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err as Error)?.message || 'Gagal menghapus data waiting list.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  // Buka modal, isi default tanggal jika ada tanggal_ingin
  const openConvertModal = (item: WaitingList) => {
    const parsed = parseWaitingListInfo(item.catatan)
    setConvertTarget(item)
    setConvertParsedJam(parsed.jam)
    setConvertError('')
  }

  const handleConfirmConvert = async (tanggal: string) => {
    if (!convertTarget) return
    setConvertLoading(true)
    setConvertError('')
    try {
      const res = await convertWaitingListToBooking(convertTarget.id, tanggal, adminEmail)
      if (res.error) {
        setConvertError(res.error)
      } else {
        setConvertTarget(null)
        setFeedback({
          type: 'success',
          message: `Berhasil! Data client dimasukkan ke Bookings dengan status Menunggu (Kode: ${res.bookingKode}).`,
        })
        router.refresh()
      }
    } catch (err: unknown) {
      setConvertError((err as Error)?.message || 'Terjadi kesalahan saat mengonversi.')
    } finally {
      setConvertLoading(false)
    }
  }

  if (!items.length) {
    return (
      <div className="text-center py-12 sm:py-16 bg-[rgb(var(--color-surface))] rounded-xl border border-dashed border-[rgb(var(--color-border))]">
        <Clock className="w-8 h-8 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-40" />
        <p className="font-heading font-semibold text-base text-[rgb(var(--color-text))]">
          Waiting List Kosong
        </p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
          Belum ada client yang mendaftar ke antrean waiting list.
        </p>
      </div>
    )
  }

  return (
    <>
      {/* Modal konfirmasi konversi */}
      {convertTarget && (
        <ConvertModal
          item={convertTarget}
          parsedJam={convertParsedJam}
          closedDates={closedDates}
          onConfirm={handleConfirmConvert}
          onClose={() => {
            setConvertTarget(null)
            setConvertError('')
          }}
          loading={convertLoading}
          error={convertError}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Banner Feedback */}
        {feedback && (
          <div
            className={cn(
              'rounded-xl p-3 flex items-center justify-between border text-xs font-medium',
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-rose-50 border-rose-300 text-rose-900'
            )}
          >
            <div className="flex items-center gap-2">
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline ml-3 hover:opacity-75"
            >
              Tutup
            </button>
          </div>
        )}

        {/* List Card Waiting List */}
        <div className="flex flex-col gap-2.5">
          {items.map(item => (
            <WaitingListRow
              key={item.id}
              item={item}
              isPending={isPending}
              deletingId={deletingId}
              onOpenConvert={openConvertModal}
              onContacted={handleContacted}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </>
  )
}
