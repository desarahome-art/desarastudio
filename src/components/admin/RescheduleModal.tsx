'use client'

import { useState, useTransition, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { ModernDatePicker } from '@/components/booking/ModernDatePicker'
import { getAvailableSlots, updateBookingSchedule } from '@/app/actions'
import { formatRupiah, normalizeTime } from '@/lib/utils'
import { hitungMenitAddon } from '@/lib/addon-calc'
import {
  X,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  FileText,
  PackageCheck,
} from 'lucide-react'
import type { Booking, Package, Category, ClosedDateItem } from '@/types'

interface RescheduleModalProps {
  booking: Booking
  packages?: Package[]
  categories?: Category[]
  adminEmail: string
  closedDates?: ClosedDateItem[]
  onClose: () => void
  onSuccess: () => void
}

export function RescheduleModal({
  booking,
  packages = [],
  categories = [],
  adminEmail,
  closedDates = [],
  onClose,
  onSuccess,
}: RescheduleModalProps) {
  // Temukan kategori awal booking
  const initialCategory = useMemo(() => {
    return categories.find(c => c.id === booking.category_id) ||
      categories.find(c => c.nama.toLowerCase() === (booking.category_nama || '').toLowerCase()) ||
      categories[0]
  }, [categories, booking.category_id, booking.category_nama])

  const [selectedCatId, setSelectedCatId] = useState<string>(
    initialCategory?.id || booking.category_id || ''
  )
  const [selectedPkgId, setSelectedPkgId] = useState<string>(
    booking.package_id || ''
  )
  const [tanggal, setTanggal] = useState(booking.tanggal)
  const [jam, setJam] = useState(normalizeTime(booking.jam_mulai))
  const [keterangan, setKeterangan] = useState('')
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')

  // Hitung addon waktu & addon total harga yang sudah ada di booking
  const addonWaktuMenit = useMemo(() => {
    return hitungMenitAddon(booking.booking_addons || [])
  }, [booking.booking_addons])

  const totalAddonsPrice = useMemo(() => {
    return (booking.booking_addons || [])
      .reduce((sum, a) => sum + (a.total || (a.harga * a.jumlah) || 0), 0)
  }, [booking.booking_addons])

  // Paket yang sedang aktif terpilih
  const currentSelectedPkg = useMemo(() => {
    return packages.find(p => p.id === selectedPkgId) || booking.package_snapshot
  }, [packages, selectedPkgId, booking.package_snapshot])

  // Total durasi baru
  const effectiveDuration = useMemo(() => {
    const pkgDuration = currentSelectedPkg?.durasi_menit || 30
    return pkgDuration + addonWaktuMenit
  }, [currentSelectedPkg, addonWaktuMenit])

  // Total harga baru & sisa pelunasan
  const newTotalHarga = useMemo(() => {
    const pkgPrice = currentSelectedPkg?.harga || 0
    return pkgPrice + totalAddonsPrice
  }, [currentSelectedPkg, totalAddonsPrice])

  const newSisaPelunasan = useMemo(() => {
    return Math.max(0, newTotalHarga - (booking.dp_dibayar || 0))
  }, [newTotalHarga, booking.dp_dibayar])

  // Paket yang tersedia untuk kategori yang dipilih
  const categoryPackages = useMemo(() => {
    if (!selectedCatId) return packages.filter(p => p.aktif)
    return packages.filter(p => p.category_id === selectedCatId && p.aktif)
  }, [packages, selectedCatId])

  // Fetch slot jam saat tanggal atau durasi berubah
  useEffect(() => {
    if (!tanggal) return
    let active = true
    setLoadingSlots(true)

    // Jam buka/tutup/interval dibaca server dari Pengaturan; jam booking ini sendiri tidak dianggap penuh
    getAvailableSlots(tanggal, effectiveDuration, undefined, undefined, undefined, {
      kecualiBookingId: booking.id,
      admin: true,
    })
      .then(slots => {
        if (!active) return
        const finalSlots = Array.isArray(slots) ? [...slots] : []
        // Pastikan jam booking saat ini tetap muncul jika tanggal dan durasi sama
        const jamAsli = normalizeTime(booking.jam_mulai)
        if (tanggal === booking.tanggal && !finalSlots.includes(jamAsli)) {
          finalSlots.push(jamAsli)
          finalSlots.sort()
        }
        setAvailableSlots(finalSlots)
      })
      .catch(() => {
        if (active) setAvailableSlots([])
      })
      .finally(() => {
        if (active) setLoadingSlots(false)
      })

    return () => {
      active = false
    }
  }, [tanggal, effectiveDuration, booking.id, booking.tanggal, booking.jam_mulai])

  const isPackageChanged = selectedPkgId !== (booking.package_id || '')

  const handleSave = () => {
    if (!tanggal || !jam) {
      setError('Pilih tanggal dan jam sesi terlebih dahulu.')
      return
    }
    setError('')
    startTransition(async () => {
      const res = await updateBookingSchedule(
        booking.id,
        tanggal,
        jam,
        adminEmail,
        keterangan,
        selectedPkgId
      )
      if (res.error) {
        setError(res.error)
      } else {
        onSuccess()
        onClose()
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-xl bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 bg-[rgb(var(--color-forest))] text-white shrink-0 border-b-4 border-[rgb(var(--color-blitz))]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[rgb(var(--color-blitz))] text-black flex items-center justify-center font-bold shadow-md">
              <Calendar className="w-5 h-5 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <h3 className="font-heading font-bold text-base sm:text-lg">
                Atur Ulang Jadwal & Paket
              </h3>
              <p className="text-xs text-white/80">
                {booking.nama_klien} · <span className="font-mono">{booking.kode}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 flex flex-col gap-5 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. SELEKSI & EDIT PAKET FOTO */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-xs flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] flex items-center gap-1.5">
                <PackageCheck className="w-4 h-4" />
                1. Edit Paket Foto
              </label>
              {isPackageChanged && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                  Paket Diubah
                </span>
              )}
            </div>

            {/* Pilihan Kategori */}
            {categories.length > 0 && (
              <div>
                <label className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1.5 block">
                  Kategori:
                </label>
                <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  {categories
                    .filter(c => c.aktif)
                    .map(cat => {
                      const isSelected = selectedCatId === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setSelectedCatId(cat.id)
                            const firstPkg = packages.find(p => p.category_id === cat.id && p.aktif)
                            if (firstPkg) setSelectedPkgId(firstPkg.id)
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all border ${
                            isSelected
                              ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] shadow-xs'
                              : 'bg-[rgb(var(--color-cream-dark)/0.6)] text-[rgb(var(--color-text))] border-transparent hover:border-[rgb(var(--color-forest)/0.4)]'
                          }`}
                        >
                          {cat.nama}
                        </button>
                      )
                    })}
                </div>
              </div>
            )}

            {/* Pilihan Paket di bawah kategori */}
            <div>
              <label className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1.5 block">
                Pilih Paket Foto:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categoryPackages.map(pkg => {
                  const isSelected = selectedPkgId === pkg.id
                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => setSelectedPkgId(pkg.id)}
                      className={`p-3 rounded-2xl border-2 text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] shadow-xs'
                          : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream)/0.4)] hover:border-[rgb(var(--color-forest)/0.4)]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <span className="font-heading font-bold text-xs sm:text-sm text-[rgb(var(--color-text))]">
                          {pkg.nama}
                        </span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-[rgb(var(--color-forest))] text-white flex items-center justify-center shrink-0">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      <p className="font-heading font-black text-sm text-[rgb(var(--color-forest))]">
                        {formatRupiah(pkg.harga)}
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] text-[rgb(var(--color-text-muted))]">
                        <span>{pkg.durasi_menit} mnt</span>
                        <span>· {pkg.jumlah_pilihan_background} bg</span>
                        <span>· Maks {pkg.maks_orang} org</span>
                        {pkg.cetak_ukuran && (
                          <span>· Cetak {pkg.cetak_ukuran}</span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Ringkasan Finansial Realtime */}
            <div className="p-3 rounded-2xl bg-[rgb(var(--color-cream-dark)/0.6)] border border-[rgb(var(--color-border))] flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">Durasi Sesi Total:</span>
                <span className="font-bold text-[rgb(var(--color-text))]">
                  {effectiveDuration} menit {addonWaktuMenit > 0 ? `(Paket ${currentSelectedPkg?.durasi_menit}m + Addon ${addonWaktuMenit}m)` : ''}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[rgb(var(--color-text-muted))]">Total Tagihan Baru:</span>
                <span className="font-heading font-bold text-[rgb(var(--color-forest))]">
                  {formatRupiah(newTotalHarga)}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[rgb(var(--color-border))]">
                <span className="text-[rgb(var(--color-text-muted))]">
                  DP Masuk: {formatRupiah(booking.dp_dibayar)} ➔ Sisa Pelunasan:
                </span>
                <span className="font-heading font-black text-[rgb(var(--color-text))]">
                  {formatRupiah(newSisaPelunasan)}
                </span>
              </div>
            </div>
          </div>

          {/* 2. PILIH TANGGAL BARU */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-xs">
            <label className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-2 block">
              2. Pilih Tanggal Baru
            </label>
            <ModernDatePicker
              value={tanggal}
              closedDates={closedDates}
              onChange={newDate => {
                setTanggal(newDate)
                setJam('')
              }}
            />
          </div>

          {/* 3. SLOT JAM MULAI */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                3. Pilih Jam Mulai
              </label>
              {jam && (
                <span className="text-xs font-bold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-[rgb(var(--color-forest)/0.2)]">
                  <Clock className="w-3.5 h-3.5" />
                  {jam} WIB
                </span>
              )}
            </div>

            {loadingSlots ? (
              <div className="p-6 text-center text-xs text-[rgb(var(--color-text-muted))] bg-[rgb(var(--color-cream)/0.4)] rounded-2xl border border-[rgb(var(--color-border))] flex flex-col items-center gap-2">
                <div className="animate-spin w-5 h-5 border-2 border-[rgb(var(--color-forest))] border-t-transparent rounded-full" />
                <span>Memeriksa ketersediaan jam...</span>
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="p-4 text-center text-xs text-red-500 bg-red-50 rounded-2xl border border-red-200">
                Tidak ada slot jam tersedia pada tanggal ini untuk durasi {effectiveDuration} menit.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 bg-[rgb(var(--color-cream)/0.4)] p-3 rounded-2xl border border-[rgb(var(--color-border))]">
                {availableSlots.map(slot => {
                  const isSelected = jam === slot
                  return (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setJam(slot)}
                      className={`
                        py-2 px-1 rounded-xl text-xs font-heading font-bold transition-all text-center
                        ${
                          isSelected
                            ? 'bg-[rgb(var(--color-forest))] text-white shadow-sm ring-2 ring-[rgb(var(--color-blitz))] font-black'
                            : 'bg-[rgb(var(--color-surface))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-forest)/0.5)] border border-[rgb(var(--color-border))]'
                        }
                      `}
                    >
                      {slot}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* 4. KETERANGAN / ALASAN RESCHEDULE / PERUBAHAN */}
          <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-xs">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                4. Keterangan / Alasan Perubahan (Opsional)
              </label>
              <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                Tercatat di riwayat booking
              </span>
            </div>
            <textarea
              rows={2}
              value={keterangan}
              onChange={e => setKeterangan(e.target.value)}
              placeholder="Contoh: Klien upgrade paket graduation, ganti jam via chat WA, dll..."
              className="w-full px-3.5 py-2.5 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream)/0.3)] text-xs focus:outline-none focus:border-[rgb(var(--color-forest))] resize-none transition-colors"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex items-center justify-between gap-3 shrink-0">
          <Button variant="ghost" onClick={onClose} className="flex-1">
            Batal
          </Button>
          <Button
            onClick={handleSave}
            loading={isPending}
            disabled={!tanggal || !jam}
            className="flex-1 shadow-md group"
          >
            <Check className="w-4 h-4" />
            Simpan Perubahan
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
