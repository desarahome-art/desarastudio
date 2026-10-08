'use client'

import { useState, useTransition, useMemo } from 'react'
import { formatRupiah, cn } from '@/lib/utils'
import {
  updateBookingStatus,
  updateCetakStatus,
  getBuktiTransferSignedUrl,
  deleteBooking,
} from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { AdminCalendarPicker } from './AdminCalendarPicker'
import { RescheduleModal } from './RescheduleModal'
import { WhatsAppTemplateModal } from './WhatsAppTemplateModal'
import {
  BookingStatusBadge,
  CetakBadge,
  InfoChip,
  ClientCardShell,
  ClientCardField,
} from './shared/ClientCardUI'
import {
  Search,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  Flag,
  ExternalLink,
  Calendar,
  Clock,
  CalendarDays,
  Layers,
  Printer,
  Trash2,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Booking, BookingStatus, CetakStatus, Package, Category } from '@/types'

interface BookingRowProps {
  booking: Booking
  adminEmail: string
  onRefresh: () => void
  onOpenReschedule: (booking: Booking) => void
  onOpenWhatsApp: (booking: Booking) => void
}

function BookingRow({
  booking,
  adminEmail,
  onRefresh,
  onOpenReschedule,
  onOpenWhatsApp,
}: BookingRowProps) {
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

  const formattedDate = new Date(booking.tanggal).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <ClientCardShell>
      {/* ── Header row (Accordion Trigger) ── */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full p-3 sm:p-4 text-left transition-colors hover:bg-[rgb(var(--color-cream-dark)/0.35)] focus-visible:outline-none focus-visible:bg-[rgb(var(--color-cream-dark)/0.35)]"
      >
        <div className="flex items-start justify-between gap-3">
          {/* Sisi Kiri: Nama, Status, Meta, Chips */}
          <div className="flex-1 min-w-0">
            {/* Baris 1: Nama Klien + Status Badge */}
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="font-heading font-semibold text-[15px] sm:text-base text-[rgb(var(--color-text))] truncate max-w-[200px] sm:max-w-none">
                {booking.nama_klien}
              </span>
              <BookingStatusBadge status={booking.status} />
              {hasCetak && <CetakBadge status={booking.status_cetak} />}
            </div>

            {/* Baris 2: Meta line (kode · kategori – paket) */}
            <p className="text-xs text-[rgb(var(--color-text-muted))] truncate mb-2">
              <span className="font-mono">{booking.kode}</span> · {booking.category_nama} – {booking.package_nama}
            </p>

            {/* Baris 3: Info Chips (Tanggal & Jam) */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <InfoChip icon={<Calendar className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />} variant="forest">
                {formattedDate}
              </InfoChip>
              <InfoChip icon={<Clock className="w-3.5 h-3.5 text-amber-700" />} variant="amber">
                {booking.jam_mulai} WIB
              </InfoChip>
              {booking.kampus && (
                <InfoChip variant="neutral" className="hidden sm:inline-flex truncate max-w-[180px]">
                  {booking.kampus}
                </InfoChip>
              )}
            </div>
          </div>

          {/* Sisi Kanan: Harga, DP & Toggle Chevron */}
          <div className="flex items-center gap-2.5 sm:gap-4 shrink-0 text-right pt-0.5">
            <div>
              <p className="font-heading font-semibold text-sm sm:text-base text-[rgb(var(--color-forest))]">
                {formatRupiah(booking.total_harga)}
              </p>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                DP {formatRupiah(booking.dp_dibayar)}
              </p>
            </div>
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
                href={`https://wa.me/${booking.wa_klien}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[rgb(var(--color-forest))] hover:underline inline-flex items-center gap-1"
              >
                {booking.wa_klien}
              </a>
            </ClientCardField>

            {booking.kampus && (
              <ClientCardField label="Kampus / Instansi">
                {booking.kampus}
              </ClientCardField>
            )}

            <ClientCardField label="Durasi Total">
              {booking.durasi_total} menit
            </ClientCardField>

            <ClientCardField label="Background Dipilih">
              {booking.pilihan_background?.length ? booking.pilihan_background.join(', ') : '-'}
            </ClientCardField>

            {booking.catatan && (
              <ClientCardField label="Catatan & Riwayat" className="sm:col-span-2">
                <p className="whitespace-pre-line text-xs font-normal text-[rgb(var(--color-text))] bg-[rgb(var(--color-cream-dark)/0.3)] p-2 rounded-lg border border-[rgb(var(--color-border)/0.6)]">
                  {booking.catatan}
                </p>
              </ClientCardField>
            )}

            {booking.bukti_transfer && (
              <ClientCardField label="Bukti Transfer" className="sm:col-span-2">
                <button
                  type="button"
                  disabled={loadingBukti}
                  onClick={handleViewBukti}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--color-forest))] hover:bg-[rgb(var(--color-forest)/0.12)] bg-[rgb(var(--color-forest)/0.06)] px-2.5 py-1.5 rounded-lg border border-[rgb(var(--color-forest)/0.2)] transition-colors min-h-[36px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {loadingBukti ? 'Memuat gambar...' : 'Lihat Bukti Transfer'}
                </button>
              </ClientCardField>
            )}

            {/* ── Section Info & Status Cetak Foto (Segmented Control Kompak) ── */}
            {hasCetak && (
              <div className="sm:col-span-2 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream-dark)/0.25)] p-2.5 sm:p-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Printer className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                      <span className="text-xs font-semibold text-[rgb(var(--color-text))]">
                        Status Cetak Foto
                      </span>
                    </div>
                    <p className="text-[11px] text-[rgb(var(--color-text-muted))] truncate">
                      {hasCetakPaket && (
                        <span>
                          Paket: {booking.package_snapshot.cetak_ukuran || 'Cetak'} ({booking.package_snapshot.cetak_jumlah || 1} lbr)
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

                  {/* Segmented Control */}
                  <div className="inline-flex items-center self-start sm:self-auto rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={isCetakPending || (booking.status_cetak === 'menunggu' || !booking.status_cetak)}
                      onClick={() => handleCetakStatus('menunggu')}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-[6px] font-medium transition-all min-h-[32px]',
                        booking.status_cetak === 'menunggu' || !booking.status_cetak
                          ? 'bg-amber-100 text-amber-900 font-semibold shadow-xs'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                      )}
                    >
                      Belum
                    </button>
                    <button
                      type="button"
                      disabled={isCetakPending || booking.status_cetak === 'proses'}
                      onClick={() => handleCetakStatus('proses')}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-[6px] font-medium transition-all min-h-[32px]',
                        booking.status_cetak === 'proses'
                          ? 'bg-purple-100 text-purple-900 font-semibold shadow-xs'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                      )}
                    >
                      Proses
                    </button>
                    <button
                      type="button"
                      disabled={isCetakPending || booking.status_cetak === 'selesai'}
                      onClick={() => handleCetakStatus('selesai')}
                      className={cn(
                        'text-xs px-2.5 py-1 rounded-[6px] font-medium transition-all min-h-[32px]',
                        booking.status_cetak === 'selesai'
                          ? 'bg-emerald-100 text-emerald-900 font-semibold shadow-xs'
                          : 'text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]'
                      )}
                    >
                      Selesai
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer Aksi ── */}
          <div className="pt-3 border-t border-[rgb(var(--color-border)/0.6)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            {/* Sisi Kiri / Atas (Primary & Secondary Actions) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-wrap">
              {/* Primary Action Button */}
              {booking.status === 'pending' && (
                <Button
                  size="sm"
                  onClick={() => handleStatus('booking')}
                  loading={isPending}
                  className="rounded-lg h-9 min-h-[40px] text-xs font-semibold w-full sm:w-auto"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Konfirmasi Booking
                </Button>
              )}

              {booking.status === 'booking' && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleStatus('selesai')}
                  loading={isPending}
                  className="rounded-lg h-9 min-h-[40px] text-xs font-semibold w-full sm:w-auto"
                >
                  <Flag className="w-3.5 h-3.5" />
                  Tandai Selesai
                </Button>
              )}

              {/* Baris Secondary & Destructive di Mobile / inline di desktop */}
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenReschedule(booking)}
                  className="rounded-lg h-9 min-h-[40px] text-xs border border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:bg-[rgb(var(--color-cream-dark)/0.5)] justify-center flex-1 sm:flex-none"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1 text-[rgb(var(--color-forest))]" />
                  Edit Jadwal & Paket
                </Button>

                {/* Destructive Ghost: Batalkan */}
                {(booking.status === 'pending' || booking.status === 'booking') && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleStatus('dibatalkan')}
                    loading={isPending}
                    className="rounded-lg h-9 min-h-[40px] text-xs border border-rose-200 text-rose-700 bg-rose-50/40 hover:bg-rose-100/60 hover:border-rose-300 justify-center flex-1 sm:flex-none"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1 text-rose-600" />
                    Batalkan
                  </Button>
                )}

                {/* Destructive Ghost: Hapus Permanen */}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDelete}
                  loading={isDeleting}
                  disabled={isPending || isDeleting}
                  className="rounded-lg h-9 min-h-[40px] text-xs border border-rose-200 text-rose-700 bg-rose-50/40 hover:bg-rose-100/60 hover:border-rose-300 justify-center flex-1 sm:flex-none"
                  title="Hapus Permanen Data Booking Ini"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1 text-rose-600" />
                  Hapus
                </Button>
              </div>
            </div>

            {/* Sisi Kanan: WhatsApp Template Modal */}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onOpenWhatsApp(booking)}
              className="rounded-lg h-9 min-h-[40px] text-xs font-medium border border-emerald-300/80 text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/80 justify-center w-full sm:w-auto"
            >
              <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              Template WA Client
            </Button>
          </div>
        </div>
      )}
    </ClientCardShell>
  )
}

interface BookingsClientProps {
  initialBookings: Booking[]
  packages?: Package[]
  categories?: Category[]
  adminEmail: string
}

export function BookingsClient({
  initialBookings,
  packages = [],
  categories = [],
  adminEmail,
}: BookingsClientProps) {
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

      {/* ── Filter Bar Ringkas (Search full-width + scrollable options) ── */}
      <div className="flex flex-col gap-2.5 mb-4">
        {/* Baris 1: Search Input Full-Width */}
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[rgb(var(--color-text-muted))]" />
          <input
            type="text"
            placeholder="Cari nama klien atau kode booking..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-sm rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] focus:outline-none focus:border-[rgb(var(--color-forest))] transition-colors"
          />
        </div>

        {/* Baris 2: Controls dalam satu baris scrollable (tidak bertumpuk di mobile) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          {/* Filter Status */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as BookingStatus | 'all')}
            className="h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs font-medium focus:outline-none focus:border-[rgb(var(--color-forest))] shrink-0"
          >
            <option value="all">Semua Status</option>
            <option value="pending">Menunggu Konfirmasi</option>
            <option value="booking">Dikonfirmasi</option>
            <option value="selesai">Selesai</option>
            <option value="dibatalkan">Dibatalkan</option>
          </select>

          {/* Filter Cetak */}
          <select
            value={filterCetak}
            onChange={e => setFilterCetak(e.target.value as CetakStatus | 'all' | 'ada_cetak')}
            className="h-9 px-2.5 rounded-lg border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs font-medium focus:outline-none focus:border-[rgb(var(--color-forest))] shrink-0"
          >
            <option value="all">Semua Cetak</option>
            <option value="ada_cetak">Ada Cetak Foto</option>
            <option value="menunggu">Cetak: Belum</option>
            <option value="proses">Cetak: Proses</option>
            <option value="selesai">Cetak: Selesai</option>
          </select>

          {/* Toggle Kalender Button */}
          <button
            type="button"
            onClick={() => setShowCalendarView(v => !v)}
            className={cn(
              'h-9 px-2.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors',
              showCalendarView || filterTanggal
                ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] font-semibold'
                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))]'
            )}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>{filterTanggal ? `Filter: ${filterTanggal}` : 'Pilih Tanggal'}</span>
          </button>

          {/* Quick Filter Separator & Chips */}
          <div className="h-4 w-px bg-[rgb(var(--color-border))] shrink-0 mx-0.5" />

          {quickDates.map(qd => {
            const isSelected = filterTanggal === qd.value
            return (
              <button
                key={qd.label}
                type="button"
                onClick={() => setFilterTanggal(qd.value)}
                className={cn(
                  'h-9 px-3 rounded-lg text-xs font-medium transition-all shrink-0 border',
                  isSelected
                    ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))]'
                    : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.4)]'
                )}
              >
                {qd.label}
              </button>
            )
          })}
        </div>

        {/* Kalender Popup Grid (jika toggle aktif) */}
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

      {/* ── Timeline Jadwal Harian (Compact) ── */}
      {activeDayBookings.length > 0 && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] flex items-center justify-center font-bold">
                <Clock className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="font-heading font-semibold text-xs sm:text-sm text-[rgb(var(--color-text))]">
                  Jadwal Sesi: {activeDate === today ? 'Hari Ini' : activeDate}
                </p>
                <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                  {activeDayBookings.length} sesi terdaftar
                </p>
              </div>
            </div>

            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] border border-[rgb(var(--color-forest)/0.2)]">
              {activeDate}
            </span>
          </div>

          {/* Timeline Chips Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {activeDayBookings
              .sort((a, b) => a.jam_mulai.localeCompare(b.jam_mulai))
              .map(b => (
                <div
                  key={b.id}
                  onClick={() => setSearch(b.kode)}
                  className="p-2 sm:p-2.5 rounded-lg bg-[rgb(var(--color-cream-dark)/0.25)] border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))] cursor-pointer transition-all flex flex-col justify-between"
                  title="Klik untuk filter booking ini"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-heading font-semibold text-xs text-[rgb(var(--color-forest))] flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {b.jam_mulai}
                    </span>
                    <span
                      className={cn(
                        'text-[10px] px-1.5 py-0.2 rounded font-medium',
                        b.status === 'booking'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {b.status === 'booking' ? 'Konfirm' : 'Menunggu'}
                    </span>
                  </div>
                  <p className="font-heading font-semibold text-xs truncate text-[rgb(var(--color-text))]">
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

      {/* ── Booking List ── */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between px-1 text-xs text-[rgb(var(--color-text-muted))] font-normal">
          <span className="flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Menampilkan {filtered.length} booking
          </span>
          {filterTanggal && (
            <button
              onClick={() => setFilterTanggal('')}
              className="text-[rgb(var(--color-forest))] font-semibold hover:underline"
            >
              Hapus filter tanggal
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[rgb(var(--color-border))] p-8 sm:p-12 text-center bg-[rgb(var(--color-surface))]">
            <Calendar className="w-8 h-8 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-40" />
            <p className="font-heading font-semibold text-sm text-[rgb(var(--color-text))]">
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
