'use client'

import { useState, useTransition } from 'react'
import { markWaitingListContacted, convertWaitingListToBooking, deleteWaitingList } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { parseWaitingListInfo } from '@/lib/utils'
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
  Package as PackageIcon,
  X,
  Info,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto max-h-[92vh] flex flex-col">

        {/* ── Header berwarna ── */}
        <div className="relative px-6 pt-5 pb-5 bg-[rgb(var(--color-forest))] text-white shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[rgb(var(--color-blitz))] flex items-center justify-center shadow-md">
              <CalendarCheck className="w-5 h-5 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <p className="font-heading font-bold text-base text-white leading-tight">
                Masukkan ke Bookings
              </p>
              <p className="text-xs text-white/70 mt-0.5">{item.nama} · {item.wa}</p>
            </div>
          </div>
        </div>

        {/* ── Body (Scrollable) ── */}
        <div className="px-5 pt-5 pb-6 flex flex-col gap-5 overflow-y-auto">

          {/* Ringkasan data client */}
          <div className="rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] overflow-hidden">
            <div className="px-4 py-2.5 bg-[rgb(var(--color-forest)/0.06)] border-b border-[rgb(var(--color-border))]">
              <p className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                Data Waiting List
              </p>
            </div>
            <div className="px-4 py-3 flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--color-text-muted))] text-xs">Kategori Foto</span>
                <span className="font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] px-2.5 py-0.5 rounded-lg text-xs">
                  {item.category_nama}
                </span>
              </div>
              {item.package_nama && (
                <div className="flex items-center justify-between">
                  <span className="text-[rgb(var(--color-text-muted))] text-xs">Paket Foto</span>
                  <span className="font-semibold text-[rgb(var(--color-text))] text-xs">{item.package_nama}</span>
                </div>
              )}
              {item.acara_nama && (
                <div className="flex items-center justify-between">
                  <span className="text-[rgb(var(--color-text-muted))] text-xs">Acara Wisuda</span>
                  <span className="font-semibold text-purple-700 text-xs max-w-[55%] text-right">{item.acara_nama}</span>
                </div>
              )}
              {parsedJam && (
                <div className="flex items-center justify-between pt-2 border-t border-[rgb(var(--color-border))]">
                  <span className="text-[rgb(var(--color-text-muted))] text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-600" /> Jam Sesi
                  </span>
                  <span className="font-heading font-bold text-sm text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-lg">
                    {parsedJam} WIB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ── Pilih Tanggal Fix (ModernDatePicker) ── */}
          <div className="flex flex-col gap-1.5">
            <ModernDatePicker
              value={tanggal}
              onChange={setTanggal}
              closedDates={closedDates}
            />
          </div>

          {/* Info */}
          <div className="rounded-xl bg-[rgb(var(--color-forest)/0.06)] border border-[rgb(var(--color-forest)/0.2)] p-3.5 flex items-start gap-2.5">
            <Info className="w-4 h-4 text-[rgb(var(--color-forest))] shrink-0 mt-0.5" />
            <p className="text-xs text-[rgb(var(--color-text))] leading-relaxed">
              Booking dibuat dengan status <strong>Menunggu</strong>. Paket &amp; jam dari waiting list otomatis terpindah. Tanggal di atas yang akan tercatat di bookings.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3.5 flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <Button variant="ghost" className="flex-1" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button
              className="flex-1 shadow-md"
              loading={loading}
              disabled={!tanggal || loading}
              onClick={() => onConfirm(tanggal)}
            >
              <CalendarCheck className="w-4 h-4" />
              Konfirmasi &amp; Buat Booking
            </Button>
          </div>

        </div>
      </div>
    </div>
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
        setFeedback({ type: 'success', message: `Data waiting list ${nama} berhasil dihapus permanen.` })
        router.refresh()
      }
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: (err as Error)?.message || 'Gagal menghapus data waiting list.' })
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
      <div className="text-center py-16 bg-[rgb(var(--color-surface))] rounded-3xl border-2 border-[rgb(var(--color-border))]">
        <Clock className="w-10 h-10 text-[rgb(var(--color-text-muted))] mx-auto mb-3 opacity-40" />
        <p className="font-heading font-semibold text-lg text-[rgb(var(--color-text))]">
          Waiting List Kosong
        </p>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
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
          onClose={() => { setConvertTarget(null); setConvertError('') }}
          loading={convertLoading}
          error={convertError}
        />
      )}

      <div className="flex flex-col gap-4">
        {/* Banner Feedback */}
        {feedback && (
          <div className={`rounded-2xl p-4 flex items-center justify-between border-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}>
            <div className="flex items-center gap-2.5 text-sm font-medium">
              {feedback.type === 'success'
                ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                : <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs font-semibold underline ml-4 hover:opacity-75"
            >
              Tutup
            </button>
          </div>
        )}

        {/* List */}
        <div className="flex flex-col gap-3.5">
          {items.map(item => {
            const parsed = parseWaitingListInfo(item.catatan)
            const isConverted = Boolean(parsed.bookingKode)

            return (
              <div
                key={item.id}
                className={`rounded-3xl border-2 p-5 bg-[rgb(var(--color-surface))] transition-all ${
                  isConverted
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : item.sudah_dihubungi
                    ? 'border-[rgb(var(--color-border))] opacity-75'
                    : 'border-[rgb(var(--color-border))] shadow-sm hover:border-[rgb(var(--color-forest)/0.4)]'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Info kiri */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <p className="font-heading font-bold text-lg text-[rgb(var(--color-text))]">
                        {item.nama}
                      </p>

                      {isConverted ? (
                        <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Sudah Masuk Bookings ({parsed.bookingKode})
                        </span>
                      ) : item.sudah_dihubungi ? (
                        <span className="text-xs bg-gray-100 text-gray-700 font-medium px-2.5 py-0.5 rounded-full">
                          Sudah Dihubungi
                        </span>
                      ) : (
                        <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Menunggu Konfirmasi
                        </span>
                      )}
                    </div>

                    {/* Chips */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] mb-2">
                      <span className="font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] px-2.5 py-1 rounded-lg">
                        {item.category_nama}
                      </span>

                      {item.package_nama && (
                        <span className="flex items-center gap-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-2.5 py-1 rounded-lg text-[rgb(var(--color-text))] font-medium">
                          <PackageIcon className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                          {item.package_nama}
                        </span>
                      )}

                      {item.acara_nama && (
                        <span className="flex items-center gap-1 bg-purple-50 border border-purple-200 text-purple-900 px-2.5 py-1 rounded-lg font-medium">
                          <GraduationCap className="w-3.5 h-3.5 text-purple-700" />
                          {item.acara_nama}
                        </span>
                      )}

                      {!item.acara_nama && item.tanggal_ingin && (
                        <span className="flex items-center gap-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-2.5 py-1 rounded-lg text-[rgb(var(--color-text))] font-medium">
                          <Calendar className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                          {new Date(item.tanggal_ingin).toLocaleDateString('id-ID', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </span>
                      )}

                      {parsed.jam && (
                        <span className="flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-bold">
                          <Clock className="w-3.5 h-3.5 text-amber-700" />
                          {parsed.jam} WIB
                        </span>
                      )}

                      {parsed.kampus && (
                        <span className="flex items-center gap-1 bg-gray-50 border border-gray-200 text-gray-700 px-2 py-1 rounded-lg">
                          <School className="w-3.5 h-3.5" />
                          {parsed.kampus}
                        </span>
                      )}
                    </div>

                    {/* Catatan */}
                    {item.catatan && (
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2 bg-[rgb(var(--color-cream)/0.5)] p-2.5 rounded-xl border border-[rgb(var(--color-border)/0.7)]">
                        {item.catatan}
                      </p>
                    )}

                    <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-2">
                      Mendaftar: {new Date(item.created_at).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>

                  {/* Tombol aksi */}
                  <div className="flex flex-row sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgb(var(--color-border))]">
                    {/* Tombol konversi → buka modal */}
                    {!isConverted ? (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => openConvertModal(item)}
                        disabled={isPending}
                        className="shadow-sm"
                      >
                        <CalendarCheck className="w-4 h-4" />
                        Masukkan ke Bookings
                      </Button>
                    ) : (
                      <Link href="/admin/bookings">
                        <Button size="sm" variant="ghost" className="border border-emerald-300 text-emerald-800 text-xs">
                          <ExternalLink className="w-3.5 h-3.5" />
                          Lihat di Bookings
                        </Button>
                      </Link>
                    )}

                    <div className="flex gap-2">
                      <a
                        href={`https://wa.me/${item.wa}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1"
                      >
                        <Button size="sm" variant="ghost" className="w-full">
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          WA
                        </Button>
                      </a>

                      {!item.sudah_dihubungi && !isConverted && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleContacted(item.id)}
                          loading={isPending}
                          title="Tandai sudah dihubungi"
                        >
                          <Check className="w-4 h-4" />
                          Tandai
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(item.id, item.nama)}
                        loading={deletingId === item.id}
                        disabled={isPending || deletingId === item.id}
                        className="border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 px-2.5 shrink-0"
                        title="Hapus Permanen"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
