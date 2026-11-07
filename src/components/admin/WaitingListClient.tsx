'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  markWaitingListContacted,
  convertWaitingListToBooking,
  deleteWaitingList,
  catatPembayaranWaitingList,
} from '@/app/actions'
import { PembayaranModal, type ModePembayaran } from './PembayaranModal'
import {
  cariPaketWaiting,
  statusBayarWaiting,
  ringkasPembayaranWaiting,
  LABEL_JENIS,
  LABEL_STATUS_BAYAR,
  type PaketLike,
  type StatusBayarWaiting,
  type JenisPembayaranWaiting,
} from '@/lib/pembayaran-waiting'
import { Button } from '@/components/ui/Button'
import { parseWaitingListInfo, cn, hariIniWIB, formatRupiah } from '@/lib/utils'
import { linkAppWhatsApp, linkWebWhatsApp } from '@/lib/whatsapp'
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
  Wallet,
  PencilLine,
  BadgeCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ModernDatePicker } from '@/components/booking/ModernDatePicker'
import type { WaitingList, ClosedDateItem } from '@/types'

export interface RiwayatBayarWaiting {
  id: string
  waiting_list_id: string
  jenis: JenisPembayaranWaiting
  jumlah: number
  metode: 'transfer' | 'tunai' | null
  catatan: string | null
  oleh: string | null
  created_at: string
}

interface InfoBayar {
  harga: number
  dibayar: number
  sisa: number
  status: StatusBayarWaiting
  namaPaket?: string
}

const KELAS_STATUS_BAYAR: Record<StatusBayarWaiting, string> = {
  menunggu: 'bg-amber-50 text-amber-800 border-amber-200',
  dp: 'bg-sky-50 text-sky-800 border-sky-200',
  lunas: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

function BadgeBayar({ status }: { status: StatusBayarWaiting }) {
  return (
    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border', KELAS_STATUS_BAYAR[status])}>
      {status === 'lunas' ? <BadgeCheck className="w-3 h-3" /> : <Wallet className="w-3 h-3" />}
      {LABEL_STATUS_BAYAR[status]}
    </span>
  )
}

function tglPendek(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

// ── Blok pembayaran di kartu waiting list ────────────────────────────────────
function BlokPembayaran({
  info,
  riwayat,
  dpMinimal,
  isConverted,
  isPending,
  onKonfirmasiDp,
  onBuka,
}: {
  info: InfoBayar
  riwayat: RiwayatBayarWaiting[]
  dpMinimal: number
  isConverted: boolean
  isPending: boolean
  onKonfirmasiDp: (nominal: number) => void
  onBuka: (mode: ModePembayaran) => void
}) {
  const persen = info.harga > 0 ? Math.min(100, Math.round((info.dibayar / info.harga) * 100)) : 0
  const dpKonfirmasi = Math.min(dpMinimal, info.harga)
  const tombol = 'inline-flex items-center gap-1.5 rounded-lg h-9 px-3 text-xs font-semibold border transition-colors disabled:opacity-50'

  return (
    <div className="mb-3 sm:mb-4 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream-dark)/0.2)] p-3" data-testid="blok-pembayaran">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">Pembayaran</p>
        <BadgeBayar status={info.status} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: info.namaPaket ? `Paket ${info.namaPaket}` : 'Harga paket', nilai: info.harga, kelas: '' },
          { label: 'Sudah dibayar', nilai: info.dibayar, kelas: info.dibayar > 0 ? 'text-emerald-700' : '' },
          { label: 'Sisa', nilai: info.sisa, kelas: info.sisa > 0 ? 'text-rose-700' : 'text-emerald-700' },
        ].map(k => (
          <div key={k.label} className="min-w-0">
            <p className="text-[10px] text-[rgb(var(--color-text-muted))] truncate">{k.label}</p>
            <p className={cn('font-heading font-bold text-xs sm:text-sm', k.kelas)}>{formatRupiah(k.nilai)}</p>
          </div>
        ))}
      </div>
      {info.dibayar > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-[rgb(var(--color-border))] overflow-hidden">
          <div className="h-full bg-emerald-600" style={{ width: `${persen}%` }} />
        </div>
      )}

      {info.harga === 0 && (
        <p className="mt-2 text-[11px] text-rose-700">
          Harga paket tidak ditemukan. Pastikan kategori client punya paket aktif di menu Paket.
        </p>
      )}

      {info.status === 'menunggu' && !isConverted && info.harga > 0 && (
        <p className="mt-2 text-[11px] text-amber-800 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
          DP {formatRupiah(dpKonfirmasi)} belum dicek. Cocokkan dengan bukti transfer di WhatsApp.
        </p>
      )}

      {riwayat.length > 0 && (
        <ul className="mt-2.5 pt-2 border-t border-[rgb(var(--color-border)/0.6)] flex flex-col gap-1 text-[11px] text-[rgb(var(--color-text-muted))]">
          {riwayat.map(r => (
            <li key={r.id} className="flex justify-between gap-2">
              <span className="truncate">
                {tglPendek(r.created_at)} · {LABEL_JENIS[r.jenis] || r.jenis}
                {r.metode ? ` · ${r.metode === 'tunai' ? 'tunai' : 'transfer'}` : ''}
                {r.catatan ? ` · ${r.catatan}` : ''}
              </span>
              <span className={cn('font-semibold shrink-0', r.jumlah < 0 ? 'text-rose-700' : 'text-[rgb(var(--color-text))]')}>
                {r.jumlah < 0 ? '−' : r.jenis === 'koreksi' ? '+' : ''}{formatRupiah(Math.abs(r.jumlah))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {isConverted ? (
        <p className="mt-2 text-[11px] text-[rgb(var(--color-text-muted))]">
          Pembayaran sudah dipindah ke booking. Catat pembayaran berikutnya di menu Booking.
        </p>
      ) : info.harga > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {info.status === 'menunggu' && (
            <>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onKonfirmasiDp(dpKonfirmasi)}
                className={cn(tombol, 'border-transparent bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))] hover:bg-[rgb(var(--color-forest-light))]')}
              >
                <Check className="w-3.5 h-3.5" /> Konfirmasi DP {formatRupiah(dpKonfirmasi)}
              </button>
              <button type="button" disabled={isPending} onClick={() => onBuka('cicil')} className={cn(tombol, 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]')}>
                Catat nominal lain
              </button>
            </>
          )}
          {info.status === 'dp' && (
            <>
              <button type="button" disabled={isPending} onClick={() => onBuka('cicil')} className={cn(tombol, 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]')}>
                <Wallet className="w-3.5 h-3.5" /> Catat pembayaran
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => onBuka('lunasi')}
                className={cn(tombol, 'border-transparent bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))] hover:bg-[rgb(var(--color-forest-light))]')}
              >
                <BadgeCheck className="w-3.5 h-3.5" /> Lunasi {formatRupiah(info.sisa)}
              </button>
            </>
          )}
          {info.dibayar > 0 && (
            <button type="button" disabled={isPending} onClick={() => onBuka('koreksi')} className={cn(tombol, 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]')}>
              <PencilLine className="w-3.5 h-3.5" /> Koreksi
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Modal konfirmasi konversi dengan date picker ──────────────────────────────
function ConvertModal({
  item,
  parsedJam,
  bayar,
  closedDates = [],
  onConfirm,
  onClose,
  loading,
  error,
}: {
  item: WaitingList
  parsedJam?: string
  bayar?: InfoBayar
  closedDates?: ClosedDateItem[]
  onConfirm: (tanggal: string) => void
  onClose: () => void
  loading: boolean
  error: string
}) {
  const today = hariIniWIB() // tanggal WIB, bukan UTC
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

          {/* Pembayaran yang ikut dipindah */}
          {bayar && (
            <div
              className={cn(
                'rounded-lg border p-3 text-xs flex items-start gap-2',
                bayar.dibayar > 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'
              )}
            >
              <Wallet className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {bayar.dibayar > 0 ? (
                  <>
                    Pembayaran <strong>{formatRupiah(bayar.dibayar)}</strong> ikut dipindah ke booking
                    {bayar.sisa > 0 ? <> · sisa {formatRupiah(bayar.sisa)}</> : <> · <strong>Lunas</strong></>}.
                  </>
                ) : (
                  <>Belum ada pembayaran yang dikonfirmasi. Booking dibuat dengan dibayar <strong>Rp 0</strong>.</>
                )}
              </p>
            </div>
          )}

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
  info,
  riwayat,
  dpMinimal,
  isPending,
  deletingId,
  onOpenConvert,
  onContacted,
  onDelete,
  onKonfirmasiDp,
  onBukaPembayaran,
}: {
  item: WaitingList
  info: InfoBayar
  riwayat: RiwayatBayarWaiting[]
  dpMinimal: number
  isPending: boolean
  deletingId: string | null
  onOpenConvert: (item: WaitingList) => void
  onContacted: (id: string) => void
  onDelete: (id: string, nama: string, dibayar: number) => void
  onKonfirmasiDp: (item: WaitingList, nominal: number) => void
  onBukaPembayaran: (item: WaitingList, mode: ModePembayaran) => void
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
              {!isConverted && <BadgeBayar status={info.status} />}
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
          <BlokPembayaran
            info={info}
            riwayat={riwayat}
            dpMinimal={dpMinimal}
            isConverted={isConverted}
            isPending={isPending}
            onKonfirmasiDp={nominal => onKonfirmasiDp(item, nominal)}
            onBuka={mode => onBukaPembayaran(item, mode)}
          />

          {/* Informasi Sekunder Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-sm mb-3 sm:mb-4">
            <ClientCardField label="WhatsApp">
              <a
                href={linkAppWhatsApp(item.wa)}
                title="Buka di aplikasi WhatsApp"
                className="text-[rgb(var(--color-forest))] hover:underline inline-flex items-center gap-1"
              >
                {item.wa}
              </a>
              <a
                href={linkWebWhatsApp(item.wa)}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-[11px] text-[rgb(var(--color-text-muted))] hover:underline"
              >
                (WA Web)
              </a>
            </ClientCardField>

            {parsed.kampus && (
              <ClientCardField label="Kampus / Instansi">
                {parsed.kampus}
              </ClientCardField>
            )}

            {parsed.background && (
              <ClientCardField label="Background Dipilih">
                {parsed.background.join(', ')}
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
                href={linkAppWhatsApp(item.wa)}
                title="Buka di aplikasi WhatsApp"
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
                onClick={() => onDelete(item.id, item.nama, info.dibayar)}
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
  packages = [],
  riwayatBayar = {},
  dpMinimal = 100000,
}: {
  items: WaitingList[]
  adminEmail?: string
  closedDates?: ClosedDateItem[]
  packages?: PaketLike[]
  riwayatBayar?: Record<string, RiwayatBayarWaiting[]>
  dpMinimal?: number
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
  const [bayarTarget, setBayarTarget] = useState<{ item: WaitingList; mode: ModePembayaran } | null>(null)

  // Harga paket & status bayar per waiting list (paket dipilih dengan aturan yang sama seperti saat dipindah ke booking)
  const infoBayar = useMemo(() => {
    const peta: Record<string, InfoBayar> = {}
    for (const it of items) {
      const pkg = cariPaketWaiting(packages, it.category_id, it.package_nama)
      const harga = Number(pkg?.harga) || 0
      const dibayar = Math.max(0, Number(it.dp_dibayar) || 0)
      peta[it.id] = { harga, dibayar, sisa: Math.max(0, harga - dibayar), status: statusBayarWaiting(harga, dibayar), namaPaket: pkg?.nama }
    }
    return peta
  }, [items, packages])

  const ringkasan = useMemo(
    () =>
      ringkasPembayaranWaiting(
        items.map(it => ({
          harga: infoBayar[it.id].harga,
          dibayar: infoBayar[it.id].dibayar,
          sudahBooking: Boolean(parseWaitingListInfo(it.catatan).bookingKode),
        }))
      ),
    [items, infoBayar]
  )

  const handleKonfirmasiDp = (item: WaitingList, nominal: number) => {
    const ok = window.confirm(
      `Konfirmasi DP ${formatRupiah(nominal)} dari ${item.nama}?\n\nPastikan bukti transfer sudah dicek di WhatsApp.`
    )
    if (!ok) return
    setFeedback(null)
    startTransition(async () => {
      const res = await catatPembayaranWaitingList(item.id, nominal, 'transfer', 'Konfirmasi DP (bukti transfer WA)')
      if (res.error) setFeedback({ type: 'error', message: res.error })
      else setFeedback({ type: 'success', message: `DP ${item.nama} ${formatRupiah(nominal)} sudah dikonfirmasi.` })
      router.refresh()
    })
  }

  const handleContacted = (id: string) => {
    startTransition(async () => {
      const res = await markWaitingListContacted(id)
      if (res?.error) setFeedback({ type: 'error', message: res.error })
      router.refresh()
    })
  }

  const handleDelete = async (id: string, nama: string, dibayar = 0) => {
    const peringatanBayar =
      dibayar > 0
        ? `\n\nPERHATIAN: client ini sudah membayar ${formatRupiah(dibayar)}. Riwayat pembayarannya ikut terhapus.`
        : ''
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin MENGHAPUS PERMANEN data waiting list client "${nama}"?${peringatanBayar}\n\nTindakan ini tidak dapat dibatalkan.`
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
          bayar={infoBayar[convertTarget.id]}
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

      {/* Modal catat / lunasi / koreksi pembayaran */}
      {bayarTarget && (
        <PembayaranModal
          waiting={{
            id: bayarTarget.item.id,
            nama: bayarTarget.item.nama,
            harga: infoBayar[bayarTarget.item.id]?.harga || 0,
            dibayar: infoBayar[bayarTarget.item.id]?.dibayar || 0,
            dpSaran: dpMinimal,
          }}
          mode={bayarTarget.mode}
          onClose={() => setBayarTarget(null)}
          onSuccess={() => {
            setBayarTarget(null)
            router.refresh()
          }}
        />
      )}

      <div className="flex flex-col gap-3">
        {/* Ringkasan pembayaran waiting list yang belum jadi booking */}
        <div className="grid grid-cols-3 gap-2" data-testid="ringkasan-bayar-waiting">
          {[
            { label: 'Menunggu konfirmasi DP', nilai: `${ringkasan.menunggu} client`, kelas: 'text-amber-800' },
            { label: 'Sudah DP / lunas', nilai: `${ringkasan.dp + ringkasan.lunas} client`, kelas: 'text-[rgb(var(--color-text))]' },
            { label: 'Uang masuk', nilai: formatRupiah(ringkasan.uangMasuk), kelas: 'text-emerald-700' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-2.5 sm:p-3 min-w-0">
              <p className="text-[10px] sm:text-[11px] text-[rgb(var(--color-text-muted))] leading-tight">{k.label}</p>
              <p className={cn('font-heading font-bold text-sm sm:text-base mt-0.5 truncate', k.kelas)}>{k.nilai}</p>
            </div>
          ))}
        </div>

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
              info={infoBayar[item.id]}
              riwayat={riwayatBayar[item.id] || []}
              dpMinimal={dpMinimal}
              onKonfirmasiDp={handleKonfirmasiDp}
              onBukaPembayaran={(it, mode) => setBayarTarget({ item: it, mode })}
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
