'use client'

import { useState, useTransition, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  Plus,
  Minus,
  AlertTriangle,
  PlusCircle,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatRupiah, timeToMinutes, minutesToTime } from '@/lib/utils'
import { addAddonsToBooking } from '@/app/actions'
import { getMenitPerUnit, sisaKuota, ringkasanSetelah, jumlahTerpakai } from '@/lib/addon-calc'
import type { Booking, Addon, BackgroundItem } from '@/types'

interface AddOnLapanganModalProps {
  booking: Booking
  addons: Addon[]
  availableBackgrounds?: BackgroundItem[]
  jamTutup?: string
  onClose: () => void
  onSuccess: () => void
}

export function AddOnLapanganModal({
  booking,
  addons,
  availableBackgrounds = [],
  jamTutup = '20:00',
  onClose,
  onSuccess,
}: AddOnLapanganModalProps) {
  const [selectedQty, setSelectedQty] = useState<Record<string, number>>({})
  const [catatan, setCatatan] = useState('')
  const [newSelectedBg, setNewSelectedBg] = useState<string[]>([])
  const [overrideJamTutup, setOverrideJamTutup] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  // Hitung jumlah addon yang sudah ada di booking sebelumnya
  const existingRows = useMemo(() => booking.booking_addons || [], [booking.booking_addons])

  // Hitung total tambahan harga & menit secara real-time
  const { totalTambahanHarga, totalTambahanMenit, totalTambahanBg, itemsToSubmit } = useMemo(() => {
    let harga = 0
    let menit = 0
    let bg = 0
    const items: Array<{ addon_id: string; jumlah: number }> = []

    for (const addon of addons) {
      const qty = selectedQty[addon.id] || 0
      if (qty > 0) {
        items.push({ addon_id: addon.id, jumlah: qty })
        harga += addon.harga * qty
        if (addon.jenis === 'waktu') {
          menit += getMenitPerUnit(addon) * qty
        }
        if (addon.jenis === 'background') {
          bg += qty
        }
      }
    }

    return {
      totalTambahanHarga: harga,
      totalTambahanMenit: menit,
      totalTambahanBg: bg,
      itemsToSubmit: items,
    }
  }, [addons, selectedQty])

  // Estimasi jam selesai baru
  const ringkasan = ringkasanSetelah(booking, totalTambahanHarga, totalTambahanMenit)
  const durasiBaru = ringkasan.durasiBaru
  const jamSelesaiBaru = useMemo(() => {
    try {
      const startMin = timeToMinutes(booking.jam_mulai)
      return minutesToTime(startMin + durasiBaru)
    } catch {
      return '-'
    }
  }, [booking.jam_mulai, durasiBaru])

  // Cek apakah melewati jam tutup
  const isMelewatiJamTutup = useMemo(() => {
    // Sama dengan aturan server: hanya dicek jika ada tambahan waktu
    if (totalTambahanMenit <= 0) return false
    try {
      const endMin = timeToMinutes(booking.jam_mulai) + durasiBaru
      return endMin > timeToMinutes(jamTutup)
    } catch {
      return false
    }
  }, [booking.jam_mulai, durasiBaru, totalTambahanMenit, jamTutup])

  const handleQtyChange = (addonId: string, delta: number, maxAddable: number) => {
    setErrorMsg('')
    const current = selectedQty[addonId] || 0
    const next = Math.max(0, Math.min(current + delta, maxAddable))
    setSelectedQty(prev => ({
      ...prev,
      [addonId]: next,
    }))
  }

  const handleToggleBg = (namaBg: string) => {
    if (newSelectedBg.includes(namaBg)) {
      setNewSelectedBg(prev => prev.filter(b => b !== namaBg))
    } else {
      if (newSelectedBg.length < totalTambahanBg) {
        setNewSelectedBg(prev => [...prev, namaBg])
      }
    }
  }

  const handleSave = () => {
    setErrorMsg('')
    if (itemsToSubmit.length === 0) {
      setErrorMsg('Pilih minimal satu add-on yang ingin ditambahkan.')
      return
    }

    if (isMelewatiJamTutup && !overrideJamTutup) {
      setErrorMsg('Waktu sesi melebihi jam operasional tutup studio. Berikan centang persetujuan untuk melanjutkan.')
      return
    }

    startTransition(async () => {
      const res = await addAddonsToBooking(
        booking.id,
        itemsToSubmit,
        catatan.trim() || undefined,
        newSelectedBg.length > 0 ? newSelectedBg : undefined,
        overrideJamTutup
      )

      if (res.error) {
        setErrorMsg(res.error)
      } else {
        onSuccess()
      }
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-xl bg-[rgb(var(--color-surface))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative px-5 py-4 bg-[rgb(var(--color-forest))] text-white border-b-2 border-[rgb(var(--color-border))] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="flex items-center gap-2">
            <PlusCircle className="w-5 h-5 text-[rgb(var(--color-blitz))]" />
            <h2 className="font-heading font-bold text-base sm:text-lg">
              Tambah Add-on (Di Lapangan)
            </h2>
          </div>
          <p className="text-xs text-white/80 mt-1">
            Booking: <span className="font-semibold text-white">{booking.kode}</span> · {booking.nama_klien} ({booking.package_nama})
          </p>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-sm flex-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {/* Info Status Saat Ini */}
          <div className="grid grid-cols-2 gap-2 text-xs bg-[rgb(var(--color-cream-dark)/0.25)] p-3 rounded-xl border border-[rgb(var(--color-border)/0.7)]">
            <div>
              <span className="text-[rgb(var(--color-text-muted))] block">Jadwal Sesi:</span>
              <span className="font-semibold">{booking.tanggal} · {booking.jam_mulai} WIB</span>
            </div>
            <div>
              <span className="text-[rgb(var(--color-text-muted))] block">Durasi Saat Ini:</span>
              <span className="font-semibold">{booking.durasi_total} menit</span>
            </div>
          </div>

          {/* Daftar Add-on Master */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-text-muted))] mb-2 block">
              Pilih Add-on yang Ditambahkan
            </label>
            <div className="space-y-2">
              {addons.map(addon => {
                const alreadyQty = jumlahTerpakai(existingRows, addon.id)
                const maxAddable = sisaKuota(addon.maks, existingRows, addon.id)
                const currentPick = selectedQty[addon.id] || 0
                const isFull = maxAddable <= 0

                return (
                  <div
                    key={addon.id}
                    className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-3 ${
                      currentPick > 0
                        ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.04)]'
                        : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]'
                    } ${isFull ? 'opacity-60' : ''}`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-heading font-semibold text-xs sm:text-sm text-[rgb(var(--color-text))]">
                          {addon.nama}
                        </span>
                        {addon.jenis === 'waktu' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 font-medium border border-amber-200">
                            +{getMenitPerUnit(addon)} mnt/unit
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">
                        {formatRupiah(addon.harga)}/{addon.satuan || 'unit'} · Maks: {addon.maks}
                        {alreadyQty > 0 && ` · Sudah ada: ${alreadyQty}`}
                        {' · '}
                        <span className={isFull ? 'text-rose-600 font-semibold' : 'text-[rgb(var(--color-forest))] font-semibold'}>
                          {isFull ? 'Kuota habis' : `Sisa kuota: ${Math.max(0, maxAddable - currentPick)}`}
                        </span>
                      </p>
                    </div>

                    {/* Stepper Kontrol */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={currentPick <= 0 || isPending}
                        onClick={() => handleQtyChange(addon.id, -1, maxAddable)}
                        className="w-7 h-7 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream-dark)/0.4)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-6 text-center font-bold text-xs">
                        {currentPick}
                      </span>
                      <button
                        type="button"
                        disabled={currentPick >= maxAddable || isPending}
                        onClick={() => handleQtyChange(addon.id, 1, maxAddable)}
                        className="w-7 h-7 rounded-lg border border-[rgb(var(--color-border))] flex items-center justify-center hover:bg-[rgb(var(--color-cream-dark)/0.4)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pilihan Warna Tambahan Jika Addon Background Dipilih */}
          {totalTambahanBg > 0 && availableBackgrounds.length > 0 && (
            <div className="p-3 rounded-2xl border-2 border-dashed border-[rgb(var(--color-forest)/0.4)] bg-[rgb(var(--color-forest)/0.03)] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[rgb(var(--color-forest))] flex items-center gap-1">
                  <Palette className="w-3.5 h-3.5" />
                  Pilih Warna Background Tambahan ({newSelectedBg.length}/{totalTambahanBg})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableBackgrounds.map(bg => {
                  const isAlreadySelected = (booking.pilihan_background || []).includes(bg.nama)
                  const isNewlySelected = newSelectedBg.includes(bg.nama)

                  return (
                    <button
                      key={bg.nama}
                      type="button"
                      disabled={isAlreadySelected}
                      onClick={() => handleToggleBg(bg.nama)}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        isAlreadySelected
                          ? 'opacity-40 bg-gray-100 border-gray-200 cursor-not-allowed line-through'
                          : isNewlySelected
                          ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] font-semibold'
                          : 'bg-white border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-forest))]'
                      }`}
                    >
                      {bg.nama} {isAlreadySelected && '(Sudah dipilih)'}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Catatan Admin */}
          <div>
            <label className="text-xs font-medium text-[rgb(var(--color-text))] block mb-1">
              Catatan Admin (Opsional)
            </label>
            <input
              type="text"
              placeholder="Contoh: Klien minta tambah durasi 15 menit & cetak foto di tempat"
              value={catatan}
              onChange={e => setCatatan(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-xs focus:outline-none focus:border-[rgb(var(--color-forest))]"
            />
          </div>

          {/* Ringkasan Real-time */}
          <div className="p-3.5 rounded-2xl bg-[rgb(var(--color-forest)/0.06)] border border-[rgb(var(--color-forest)/0.2)] space-y-1.5 text-xs">
            <div className="flex justify-between font-semibold text-[rgb(var(--color-text))] pb-1 border-b border-[rgb(var(--color-forest)/0.15)]">
              <span>Ringkasan Penambahan</span>
              <span>{itemsToSubmit.length} item dipilih</span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span>Tambahan Durasi:</span>
              <span className="font-medium text-[rgb(var(--color-text))]">
                {totalTambahanMenit > 0 ? `+${totalTambahanMenit} menit` : 'Tidak ada'}
              </span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span>Estimasi Selesai Baru:</span>
              <span className="font-medium text-[rgb(var(--color-text))]">
                {jamSelesaiBaru} WIB (Total {durasiBaru} mnt)
              </span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))] pt-1 border-t border-[rgb(var(--color-forest)/0.15)]">
              <span className="font-semibold text-[rgb(var(--color-text))]">Total Tambahan Biaya:</span>
              <span className="font-bold text-sm text-[rgb(var(--color-forest))]">
                +{formatRupiah(totalTambahanHarga)}
              </span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span>Total Lama:</span>
              <span className="font-medium text-[rgb(var(--color-text))]">{formatRupiah(booking.total_harga)}</span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span className="font-semibold text-[rgb(var(--color-text))]">Total Baru:</span>
              <span className="font-bold text-[rgb(var(--color-text))]">{formatRupiah(ringkasan.totalBaru)}</span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span>DP Dibayar:</span>
              <span className="font-medium text-[rgb(var(--color-text))]">{formatRupiah(ringkasan.dp)}</span>
            </div>
            <div className="flex justify-between text-[rgb(var(--color-text-muted))]">
              <span className="font-semibold text-[rgb(var(--color-text))]">Sisa Pelunasan Baru:</span>
              <span className="font-bold text-sm text-rose-700">{formatRupiah(ringkasan.sisaBaru)}</span>
            </div>
          </div>

          {/* Warning Melewati Jam Tutup */}
          {isMelewatiJamTutup && (
            <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong>Peringatan Jam Operasional:</strong> Sesi foto diperkirakan selesai pukul <strong>{jamSelesaiBaru} WIB</strong>, melewati batas jam operasional studio ({jamTutup} WIB).
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer font-medium text-amber-950 pt-1">
                <input
                  type="checkbox"
                  checked={overrideJamTutup}
                  onChange={e => setOverrideJamTutup(e.target.checked)}
                  className="rounded text-[rgb(var(--color-forest))] focus:ring-0"
                />
                <span>Saya menyetujui sesi berlanjut melewati jam tutup studio.</span>
              </label>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="px-5 py-3.5 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex items-center justify-end gap-2.5 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            loading={isPending}
            disabled={itemsToSubmit.length === 0 || (isMelewatiJamTutup && !overrideJamTutup)}
          >
            Simpan Add-on
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
