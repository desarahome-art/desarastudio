'use client'

import { useState, useTransition, useMemo } from 'react'
import { formatRupiah } from '@/lib/utils'
import { updateBookingStatus, updateCetakStatus, getBuktiTransferSignedUrl, deleteBooking } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { AdminCalendarPicker } from './AdminCalendarPicker'
import { RescheduleModal } from './RescheduleModal'
import { WhatsAppTemplateModal } from './WhatsAppTemplateModal'
import {
  Search, MessageCircle, ChevronDown,
  ChevronUp, CheckCircle, XCircle, Flag,
  ExternalLink, Calendar, Clock, Filter,
  CalendarDays, Layers, Printer, Trash2
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Booking, BookingStatus, CetakStatus, Package, Category } from '@/types'

const statusLabel: Record<BookingStatus, string> = {
  pending: 'Menunggu',
  booking: 'Dikonfirmasi',
  selesai: 'Selesai',
  dibatalkan: 'Dibatalkan',
}

const statusColor: Record<BookingStatus, string> = {
  pending:    'bg-yellow-100 text-yellow-800 border border-yellow-300',
  booking:    'bg-blue-100 text-blue-800 border border-blue-300',
  selesai:    'bg-green-100 text-green-800 border border-green-300',
  dibatalkan: 'bg-red-100 text-red-800 border border-red-300',
}

const cetakStatusLabel: Record<CetakStatus, string> = {
  menunggu: 'Belum Dicetak',
  proses: 'Sedang Dicetak',
  selesai: 'Selesai Cetak',
}

const cetakStatusColor: Record<CetakStatus, string> = {
  menunggu: 'bg-amber-50 text-amber-800 border-amber-300',
  proses:   'bg-purple-50 text-purple-800 border-purple-300',
  selesai:  'bg-emerald-50 text-emerald-800 border-emerald-300',
}

function StatusBadge({ status }: { status: BookingStatus }) {
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[status]}`}>
      {statusLabel[status]}
    </span>
  )
}

function CetakStatusBadge({ status }: { status: CetakStatus | null | undefined }) {
  const current = status || 'menunggu'
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${cetakStatusColor[current]}`}>
      <Printer className="w-3 h-3" />
      {cetakStatusLabel[current]}
    </span>
  )
}

interface BookingRowProps {
  booking: Booking
  adminEmail: string
  onRefresh: () => void
  onOpenReschedule: (booking: Booking) => void
  onOpenWhatsApp: (booking: Booking) => void
}

function BookingRow({ booking, adminEmail, onRefresh, onOpenReschedule, onOpenWhatsApp }: BookingRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isCetakPending, startCetakTransition] = useTransition()
  const [loadingBukti, setLoadingBukti] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Deteksi apakah booking ini ada cetak foto (dari paket snapshot atau add-on)
  const hasCetakPaket = Boolean(
    booking.package_snapshot?.cetak_ukuran ||
    (booking.package_snapshot?.cetak_jumlah && booking.package_snapshot.cetak_jumlah > 0)
  )
  const cetakAddons = (booking.booking_addons || []).filter(a => a.jenis === 'cetak')
  const hasCetakAddon = cetakAddons.length > 0
  const hasCetak = hasCetakPaket || hasCetakAddon

  const handleStatus = (newStatus: BookingStatus) => {
    startTransition(async () => {
      await updateBookingStatus(booking.id, newStatus, undefined, adminEmail)
      onRefresh()
    })
  }

  const handleCetakStatus = (newCetakStatus: CetakStatus) => {
    startCetakTransition(async () => {
      await updateCetakStatus(booking.id, newCetakStatus, adminEmail)
      onRefresh()
    })
  }

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin MENGHAPUS PERMANEN data booking:\n- Klien: ${booking.nama_klien}\n- Kode: ${booking.kode}\n- Tanggal: ${booking.tanggal} ${booking.jam_mulai} WIB\n\nTindakan ini akan menghapus data secara permanen dan tidak dapat dibatalkan.`
    )
    if (!confirmed) return

    setIsDeleting(true)
    try {
      const res = await deleteBooking(booking.id)
      if (res.error) {
        alert(`Gagal menghapus data booking: ${res.error}`)
      } else {
        onRefresh()
      }
    } catch (err: unknown) {
      alert((err as Error)?.message || 'Terjadi kesalahan saat menghapus booking')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleViewBukti = async () => {
    if (!booking.bukti_transfer) return
    setLoadingBukti(true)
    try {
      const res = await getBuktiTransferSignedUrl(booking.bukti_transfer)
      if (res.url) {
        window.open(res.url, '_blank', 'noopener,noreferrer')
      } else {
        alert(res.error || 'Gagal memuat bukti transfer')
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan saat memuat gambar bukti transfer')
    } finally {
      setLoadingBukti(false)
    }
  }

  return (
    <div className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-hidden transition-all shadow-xs hover:border-[rgb(var(--color-forest)/0.4)]">
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-[rgb(var(--color-cream-dark)/0.5)] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-heading font-bold">{booking.nama_klien}</span>
            <StatusBadge status={booking.status} />
            {hasCetak && (
              <CetakStatusBadge status={booking.status_cetak} />
            )}
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            {booking.kode} · {booking.category_nama} – {booking.package_nama}
          </p>
          <div className="flex items-center gap-3 mt-1 text-xs text-[rgb(var(--color-text))] font-medium">
            <span className="flex items-center gap-1 text-[rgb(var(--color-forest))] font-bold bg-[rgb(var(--color-forest)/0.08)] px-2 py-0.5 rounded-md">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(booking.tanggal).toLocaleDateString('id-ID', {
                weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
              })}
            </span>
            <span className="flex items-center gap-1 bg-[rgb(var(--color-blitz)/0.15)] text-[rgb(var(--color-text))] font-bold px-2 py-0.5 rounded-md">
              <Clock className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
              {booking.jam_mulai} WIB
            </span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-heading font-bold text-[rgb(var(--color-forest))]">
            {formatRupiah(booking.total_harga)}
          </p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            DP {formatRupiah(booking.dp_dibayar)}
          </p>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 flex-shrink-0 text-[rgb(var(--color-text-muted))]" />
          : <ChevronDown className="w-4 h-4 flex-shrink-0 text-[rgb(var(--color-text-muted))]" />
        }
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[rgb(var(--color-border))] p-4 bg-[rgb(var(--color-surface))]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
            <div>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mb-0.5">WhatsApp</p>
              <p className="font-medium">{booking.wa_klien}</p>
            </div>
            {booking.kampus && (
              <div>
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-0.5">Kampus / Instansi</p>
                <p className="font-medium">{booking.kampus}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mb-0.5">Durasi</p>
              <p>{booking.durasi_total} menit</p>
            </div>
            <div>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mb-0.5">Background dipilih</p>
              <p>{booking.pilihan_background?.join(', ') || '-'}</p>
            </div>
            {booking.catatan && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-0.5">Catatan & Riwayat</p>
                <p className="whitespace-pre-line text-xs font-medium text-[rgb(var(--color-text))]">{booking.catatan}</p>
              </div>
            )}
            {booking.bukti_transfer && (
              <div className="sm:col-span-2">
                <p className="text-xs text-[rgb(var(--color-text-muted))] mb-1">Bukti Transfer</p>
                <button
                  type="button"
                  disabled={loadingBukti}
                  onClick={handleViewBukti}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-[rgb(var(--color-forest))] hover:underline bg-[rgb(var(--color-forest)/0.08)] px-3 py-1.5 rounded-xl border border-[rgb(var(--color-forest)/0.2)]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {loadingBukti ? 'Memuat gambar...' : 'Lihat Bukti Transfer'}
                </button>
              </div>
            )}

            {/* Bagian Status & Info Cetak Foto jika ada */}
            {hasCetak && (
              <div className="sm:col-span-2 mt-2 p-3.5 rounded-2xl bg-[rgb(var(--color-cream-dark)/0.6)] border border-[rgb(var(--color-border))]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-heading font-bold text-xs text-[rgb(var(--color-forest))] flex items-center gap-1.5">
                        <Printer className="w-4 h-4" />
                        Info & Status Cetak Foto
                      </span>
                      <CetakStatusBadge status={booking.status_cetak} />
                    </div>
                    <p className="text-xs text-[rgb(var(--color-text-muted))]">
                      {hasCetakPaket && (
                        <span>
                          Paket: {booking.package_snapshot.cetak_ukuran || 'Cetak'} ({booking.package_snapshot.cetak_jumlah || 1} lembar)
                        </span>
                      )}
                      {hasCetakPaket && hasCetakAddon && ' · '}
                      {hasCetakAddon && (
                        <span>
                          Add-on: {cetakAddons.map(a => `${a.nama} (${a.jumlah}x)`).join(', ')}
                        </span>
                      )}
                    </p>
                  </div>

                  {/* Kontrol Update Status Cetak */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[11px] font-medium text-[rgb(var(--color-text-muted))] mr-1">
                      Ubah Status:
                    </span>
                    <button
                      type="button"
                      disabled={isCetakPending || (booking.status_cetak === 'menunggu' || !booking.status_cetak)}
                      onClick={() => handleCetakStatus('menunggu')}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-all border ${
                        booking.status_cetak === 'menunggu' || !booking.status_cetak
                          ? 'bg-amber-100 text-amber-800 border-amber-300 font-bold shadow-xs'
                          : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))] hover:border-amber-300'
                      }`}
                    >
                      Belum
                    </button>
                    <button
                      type="button"
                      disabled={isCetakPending || booking.status_cetak === 'proses'}
                      onClick={() => handleCetakStatus('proses')}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-all border ${
                        booking.status_cetak === 'proses'
                          ? 'bg-purple-100 text-purple-800 border-purple-300 font-bold shadow-xs'
                          : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))] hover:border-purple-300'
                      }`}
                    >
                      Proses
                    </button>
                    <button
                      type="button"
                      disabled={isCetakPending || booking.status_cetak === 'selesai'}
                      onClick={() => handleCetakStatus('selesai')}
                      className={`text-xs px-2.5 py-1 rounded-xl font-medium transition-all border ${
                        booking.status_cetak === 'selesai'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold shadow-xs'
                          : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))] hover:border-emerald-300'
                      }`}
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[rgb(var(--color-border)/0.6)]">
            {booking.status === 'pending' && (
              <Button
                size="sm"
                onClick={() => handleStatus('booking')}
                loading={isPending}
              >
                <CheckCircle className="w-4 h-4" />
                Konfirmasi Booking
              </Button>
            )}

            {/* Tombol Modern Atur Ulang Tanggal, Jam & Paket */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenReschedule(booking)}
              className="border border-[rgb(var(--color-border))] hover:bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))]"
            >
              <Calendar className="w-3.5 h-3.5 mr-1" />
              Edit Jadwal & Paket
            </Button>

            {booking.status === 'booking' && (
              <Button
                size="sm"
                onClick={() => handleStatus('selesai')}
                loading={isPending}
                variant="secondary"
              >
                <Flag className="w-4 h-4" />
                Tandai Selesai
              </Button>
            )}

            {(booking.status === 'pending' || booking.status === 'booking') && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleStatus('dibatalkan')}
                loading={isPending}
              >
                <XCircle className="w-4 h-4" />
                Batalkan
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={handleDelete}
              loading={isDeleting}
              disabled={isPending || isDeleting}
              className="border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 flex items-center gap-1.5"
              title="Hapus Permanen Data Booking Ini"
            >
              <Trash2 className="w-3.5 h-3.5 text-red-500" />
              Hapus
            </Button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenWhatsApp(booking)}
              className="ml-auto bg-[#25D366]/10 text-[#075E54] hover:bg-[#25D366]/20 font-bold border border-[#25D366]/30 flex items-center gap-1.5"
            >
              <MessageCircle className="w-4 h-4 text-[#075E54]" />
              Template WA Client
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface BookingsClientProps {
  initialBookings: Booking[]
  packages?: Package[]
  categories?: Category[]
  adminEmail: string
}

export function BookingsClient({ initialBookings, packages = [], categories = [], adminEmail }: BookingsClientProps) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<BookingStatus | 'all'>('all')
  const [filterCetak, setFilterCetak] = useState<CetakStatus | 'all' | 'ada_cetak'>('all')
  const [filterTanggal, setFilterTanggal] = useState('')
  const [showCalendarView, setShowCalendarView] = useState(false)
  const [rescheduleTarget, setRescheduleTarget] = useState<Booking | null>(null)
  const [whatsAppTarget, setWhatsAppTarget] = useState<Booking | null>(null)
  const router = useRouter()

  // Hitung jumlah booking per tanggal untuk indikator kalender
  const bookingsCountByDate = useMemo(() => {
    const map: Record<string, number> = {}
    for (const b of initialBookings) {
      if (b.status !== 'dibatalkan') {
        map[b.tanggal] = (map[b.tanggal] || 0) + 1
      }
    }
    return map
  }, [initialBookings])

  const filtered = initialBookings.filter(b => {
    const matchSearch =
      b.nama_klien.toLowerCase().includes(search.toLowerCase()) ||
      b.kode.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || b.status === filterStatus
    const matchTanggal = !filterTanggal || b.tanggal === filterTanggal

    // Filter Cetak Foto
    const hasCetakPaket = Boolean(
      b.package_snapshot?.cetak_ukuran ||
      (b.package_snapshot?.cetak_jumlah && b.package_snapshot.cetak_jumlah > 0)
    )
    const hasCetakAddon = (b.booking_addons || []).some(a => a.jenis === 'cetak')
    const hasCetak = hasCetakPaket || hasCetakAddon

    let matchCetak = true
    if (filterCetak === 'ada_cetak') {
      matchCetak = hasCetak
    } else if (filterCetak !== 'all') {
      matchCetak = hasCetak && (b.status_cetak || 'menunggu') === filterCetak
    }

    return matchSearch && matchStatus && matchTanggal && matchCetak
  })

  // Booking untuk tanggal aktif terpilih atau hari ini
  const today = new Date().toISOString().split('T')[0]
  const activeDate = filterTanggal || today
  const activeDayBookings = initialBookings.filter(
    b => b.tanggal === activeDate && b.status !== 'dibatalkan'
  )

  const quickDates = [
    { label: 'Semua', value: '' },
    { label: 'Hari Ini', value: today },
    {
      label: 'Besok',
      value: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    },
  ]

  return (
    <div>
      {/* Reschedule & Edit Paket Modal */}
      {rescheduleTarget && (
        <RescheduleModal
          booking={rescheduleTarget}
          packages={packages}
          categories={categories}
          adminEmail={adminEmail}
          onClose={() => setRescheduleTarget(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* WhatsApp Template Modal */}
      {whatsAppTarget && (
        <WhatsAppTemplateModal
          booking={whatsAppTarget}
          onClose={() => setWhatsAppTarget(null)}
        />
      )}

      {/* Filter Header & Controls */}
      <div className="flex flex-col gap-3 mb-6">
        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
            <input
              type="text"
              placeholder="Cari nama klien atau kode booking..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
            />
          </div>

          {/* Filter Status Selector */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as BookingStatus | 'all')}
            className="px-4 py-2.5 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm font-medium focus:outline-none focus:border-[rgb(var(--color-forest))]"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Konfirmasi</option>
            <option value="booking">Dikonfirmasi</option>
            <option value="selesai">Selesai</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>

          {/* Filter Status Cetak Foto */}
          <select
            value={filterCetak}
            onChange={e => setFilterCetak(e.target.value as CetakStatus | 'all' | 'ada_cetak')}
            className="px-4 py-2.5 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm font-medium focus:outline-none focus:border-[rgb(var(--color-forest))]"
          >
            <option value="all">Semua Cetak</option>
            <option value="ada_cetak">Ada Cetak Foto</option>
            <option value="menunggu">Cetak: Belum</option>
            <option value="proses">Cetak: Proses</option>
            <option value="selesai">Cetak: Selesai</option>
          </select>

          {/* Toggle Kalender Modern */}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowCalendarView(v => !v)}
            className={`rounded-2xl border-2 px-3.5 py-2.5 font-medium text-sm flex items-center gap-1.5 transition-colors ${
              showCalendarView || filterTanggal
                ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] font-bold'
                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>{filterTanggal ? `Filter: ${filterTanggal}` : 'Pilih Tanggal'}</span>
          </Button>
        </div>

        {/* Quick Date Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-1 shrink-0 font-medium">
            <Filter className="w-3 h-3" /> Quick Filter:
          </span>
          {quickDates.map(qd => {
            const isSelected = filterTanggal === qd.value
            return (
              <button
                key={qd.label}
                type="button"
                onClick={() => setFilterTanggal(qd.value)}
                className={`px-3 py-1.5 rounded-xl font-heading font-semibold transition-all shrink-0 border ${
                  isSelected
                    ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] shadow-xs'
                    : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.4)]'
                }`}
              >
                {qd.label}
              </button>
            )
          })}
        </div>

        {/* Kalender Modern Popup Grid (jika toggle aktif) */}
        {showCalendarView && (
          <div className="mt-1">
            <AdminCalendarPicker
              value={filterTanggal}
              onChange={newDate => setFilterTanggal(newDate)}
              bookingsCountByDate={bookingsCountByDate}
            />
          </div>
        )}
      </div>

      {/* Timeline Jadwal Harian Modern */}
      {activeDayBookings.length > 0 && (
        <div className="mb-6 p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-forest)/0.25)] shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-bold">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-heading font-bold text-sm text-[rgb(var(--color-text))]">
                  Jadwal Sesi: {activeDate === today ? 'Hari Ini' : activeDate}
                </p>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                  {activeDayBookings.length} sesi terdaftar
                </p>
              </div>
            </div>

            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-[rgb(var(--color-forest))] text-white">
              {activeDate}
            </span>
          </div>

          {/* Timeline Chips */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {activeDayBookings
              .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
              .map(b => (
                <div
                  key={b.id}
                  onClick={() => setSearch(b.kode)}
                  className="p-3 rounded-2xl bg-[rgb(var(--color-cream))] border-2 border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))] cursor-pointer transition-all flex flex-col justify-between"
                  title="Klik untuk filter booking ini"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-heading font-black text-sm text-[rgb(var(--color-forest))] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {b.jam_mulai}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${
                      b.status === 'booking' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {b.status}
                    </span>
                  </div>
                  <p className="font-heading font-bold text-xs truncate text-[rgb(var(--color-text))]">
                    {b.nama_klien}
                  </p>
                  <p className="text-[10px] text-[rgb(var(--color-text-muted))] truncate mt-0.5">
                    {b.package_nama} · {b.durasi_total}m
                  </p>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Booking list */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1 text-xs text-[rgb(var(--color-text-muted))] font-medium">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Menampilkan {filtered.length} booking
          </span>
          {filterTanggal && (
            <button
              onClick={() => setFilterTanggal('')}
              className="text-[rgb(var(--color-forest))] font-bold hover:underline"
            >
              Hapus filter tanggal
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border-2 border-dashed border-[rgb(var(--color-border))] p-12 text-center bg-[rgb(var(--color-surface))]">
            <Calendar className="w-10 h-10 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-50" />
            <p className="font-heading font-bold text-base text-[rgb(var(--color-text))]">
              Tidak Ada Booking Ditemukan
            </p>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-sm mx-auto">
              Tidak ada jadwal yang cocok dengan filter pencarian atau tanggal terpilih.
            </p>
          </div>
        ) : (
          filtered.map(b => (
            <BookingRow
              key={b.id}
              booking={b}
              adminEmail={adminEmail}
              onRefresh={() => router.refresh()}
              onOpenReschedule={item => setRescheduleTarget(item)}
              onOpenWhatsApp={item => setWhatsAppTarget(item)}
            />
          ))
        )}
      </div>
    </div>
  )
}
