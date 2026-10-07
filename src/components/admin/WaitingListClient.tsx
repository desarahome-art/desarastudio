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
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WaitingList } from '@/types'

export function WaitingListClient({
  items,
  adminEmail,
}: {
  items: WaitingList[]
  adminEmail?: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

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
      setFeedback({
        type: 'error',
        message: (err as Error)?.message || 'Gagal menghapus data waiting list.',
      })
    } finally {
      setDeletingId(null)
    }
  }

  const handleConvertToBooking = async (id: string) => {
    setConvertingId(id)
    setFeedback(null)
    try {
      const res = await convertWaitingListToBooking(id, adminEmail)
      if (res.error) {
        setFeedback({ type: 'error', message: res.error })
      } else {
        setFeedback({
          type: 'success',
          message: `Berhasil! Data client langsung dimasukkan ke Data Bookings dengan status Menunggu (Kode: ${res.bookingKode}).`,
        })
        router.refresh()
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: (err as Error)?.message || 'Terjadi kesalahan saat mengonversi waiting list ke booking.',
      })
    } finally {
      setConvertingId(null)
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
    <div className="flex flex-col gap-4">
      {/* Banner Feedback / Alert */}
      {feedback && (
        <div
          className={`rounded-2xl p-4 flex items-center justify-between border-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            )}
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

      {/* List Antrean Waiting List */}
      <div className="flex flex-col gap-3.5">
        {items.map(item => {
          const parsed = parseWaitingListInfo(item.catatan)
          const isConverted = Boolean(parsed.bookingKode)
          const isItemLoading = convertingId === item.id

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

                  {/* Kategori, Tanggal, Jam Chips */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[rgb(var(--color-text-muted))] mb-2">
                    <span className="font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] px-2.5 py-1 rounded-lg">
                      {item.category_nama}
                    </span>

                    {item.tanggal_ingin && (
                      <span className="flex items-center gap-1 bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))] px-2.5 py-1 rounded-lg text-[rgb(var(--color-text))] font-medium">
                        <Calendar className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                        {new Date(item.tanggal_ingin).toLocaleDateString('id-ID', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
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

                  {/* Catatan / Info Tambahan */}
                  {item.catatan && (
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-2 bg-[rgb(var(--color-cream)/0.5)] p-2.5 rounded-xl border border-[rgb(var(--color-border)/0.7)]">
                      {item.catatan}
                    </p>
                  )}

                  <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-2">
                    Waktu Mendaftar: {new Date(item.created_at).toLocaleString('id-ID', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                {/* Kolom Tombol Aksi Admin */}
                <div className="flex flex-row sm:flex-col gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[rgb(var(--color-border))]">
                  {/* 1 Tombol Langsung Masuk ke Data Bookings */}
                  {!isConverted ? (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleConvertToBooking(item.id)}
                      loading={isItemLoading}
                      disabled={isPending || isItemLoading}
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
                      title="Hapus Permanen Waiting List Ini"
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
  )
}
