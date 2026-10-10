'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { formatRupiah } from '@/lib/utils'
import { getMenitPerUnit, labelSatuanWaktu } from '@/lib/addon-calc'
import { normalisasiBackgrounds, kuotaBackgroundEfektif } from '@/lib/background'
import { getAvailableSlots } from '@/app/actions'
import { Minus, Plus, ArrowRight, ShieldCheck, X } from 'lucide-react'
import { BackgroundSelector } from './BackgroundSelector'
import { ModernDatePicker } from './ModernDatePicker'
import { TimeSlotSelector } from './TimeSlotSelector'
import type { Package, Addon, Settings, BookingFormAddon, BackgroundItem } from '@/types'

interface Step5FormProps {
  nama: string
  pkg: Package
  settings: Settings
  addons: Addon[]
  backgrounds: (string | BackgroundItem)[]
  defaultValues: {
    pilihan_background: string[]
    wa_klien: string
    kampus: string
    tanggal: string
    jam_mulai: string
    catatan: string
    addons: BookingFormAddon[]
  }
  onNext: (data: {
    pilihan_background: string[]
    wa_klien: string
    kampus: string
    tanggal: string
    jam_mulai: string
    catatan: string
    addons: BookingFormAddon[]
    durasi_total: number
    total_harga: number
  }) => void
  onBack: () => void
}

function Stepper({
  value,
  min,
  max,
  onChange,
}: {
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="w-8 h-8 rounded-lg border-2 border-[rgb(var(--color-border))] flex items-center justify-center disabled:opacity-40 hover:border-[rgb(var(--color-forest))] transition-colors bg-[rgb(var(--color-surface))]"
        aria-label="Kurangi"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-6 text-center font-heading font-bold text-sm">{value}</span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="w-8 h-8 rounded-lg border-2 border-[rgb(var(--color-border))] flex items-center justify-center disabled:opacity-40 hover:border-[rgb(var(--color-forest))] transition-colors bg-[rgb(var(--color-surface))]"
        aria-label="Tambah"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

export function Step5Form({
  nama,
  pkg,
  settings,
  addons,
  backgrounds,
  defaultValues,
  onNext,
  onBack,
}: Step5FormProps) {
  // Pilihan lama dari kategori sebelumnya dibuang jika tidak tersedia di kategori ini
  const [selectedBg, setSelectedBg] = useState<string[]>(() => {
    const tersedia = normalisasiBackgrounds(backgrounds).map(b => b.nama)
    return defaultValues.pilihan_background.filter(b => tersedia.includes(b))
  })
  const [wa, setWa] = useState(defaultValues.wa_klien)
  const [kampus, setKampus] = useState(defaultValues.kampus)
  const [tanggal, setTanggal] = useState(defaultValues.tanggal)
  const [jam, setJam] = useState(defaultValues.jam_mulai)
  const [catatan, setCatatan] = useState(defaultValues.catatan)
  const [addonMap, setAddonMap] = useState<Record<string, number>>(
    Object.fromEntries(
      defaultValues.addons.map(a => [a.addon.id, a.jumlah])
    )
  )

  // S&K Modal state
  const [showSkModal, setShowSkModal] = useState(false)
  const [agreedSk, setAgreedSk] = useState(false)
  // Jam terpilih disimpan di ref agar memilih jam TIDAK memicu pengambilan ulang daftar slot
  const jamRef = useRef(jam)
  jamRef.current = jam
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Hitung durasi total dan kuota background dari paket + add-on
  const addonsWaktu = addons.filter(a => a.jenis === 'waktu')
  const waktuExtra = addonsWaktu.reduce(
    (sum, a) => sum + (addonMap[a.id] || 0) * getMenitPerUnit(a),
    0
  )
  const durasiTotal = pkg.durasi_menit + waktuExtra

  const bgExtra = addons
    .filter(a => a.jenis === 'background')
    .reduce((sum, a) => sum + (addonMap[a.id] || 0), 0)
  // Kuota tidak boleh melebihi jumlah background yang tersedia; 0 = seksi disembunyikan
  const bgSlots = kuotaBackgroundEfektif(
    pkg.jumlah_pilihan_background + bgExtra,
    normalisasiBackgrounds(backgrounds).length
  )

  const totalAddons = addons.reduce(
    (sum, a) => sum + (addonMap[a.id] || 0) * a.harga,
    0
  )
  const totalHarga = pkg.harga + totalAddons

  // Fetch slot jam saat tanggal atau durasi total berubah
  const fetchSlots = useCallback(async () => {
    if (!tanggal) {
      setAvailableSlots([])
      return
    }
    setLoadingSlots(true)
    try {
      const slots = await getAvailableSlots(
        tanggal,
        durasiTotal || 30,
        settings?.jam_buka || '08:00',
        settings?.jam_tutup || '20:00',
        settings?.slot_interval || 30
      )
      const safe = Array.isArray(slots) ? slots : []
      setAvailableSlots(safe)
      if (jamRef.current && !safe.includes(jamRef.current)) {
        setJam('')
      }
    } catch (err) {
      console.error('Failed to fetch available slots:', err)
      setAvailableSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [tanggal, durasiTotal, settings?.jam_buka, settings?.jam_tutup, settings?.slot_interval])

  useEffect(() => {
    fetchSlots()
  }, [fetchSlots])

  const toggleBg = (bg: string) => {
    if (selectedBg.includes(bg)) {
      setSelectedBg(prev => prev.filter(b => b !== bg))
      setErrors(prev => ({ ...prev, bg: '' }))
    } else if (selectedBg.length < bgSlots) {
      setSelectedBg(prev => [...prev, bg])
      setErrors(prev => ({ ...prev, bg: '' }))
    }
  }

  const handleDateChange = (newDate: string) => {
    setTanggal(newDate)
    setJam('')
    setErrors(prev => ({ ...prev, tanggal: '' }))
  }

  const handleSlotSelect = (newSlot: string) => {
    setJam(newSlot)
    setErrors(prev => ({ ...prev, jam: '' }))
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (bgSlots > 0 && selectedBg.length !== bgSlots)
      e.bg = `Silakan pilih tepat ${bgSlots} warna background (saat ini ${selectedBg.length} dipilih)`
    if (!wa.trim()) e.wa = 'Nomor WhatsApp aktif wajib diisi'
    if (!tanggal) e.tanggal = 'Silakan pilih tanggal sesi foto pada kalender'
    if (!jam) e.jam = 'Silakan pilih jam mulai sesi foto'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleNext = () => {
    if (!validate()) return
    setShowSkModal(true)
  }

  const handleAgreeAndProceed = () => {
    if (!agreedSk) return
    setShowSkModal(false)

    const selectedAddons: BookingFormAddon[] = addons
      .filter(a => (addonMap[a.id] || 0) > 0)
      .map(a => ({ addon: a, jumlah: addonMap[a.id] }))

    onNext({
      pilihan_background: bgSlots > 0 ? selectedBg.slice(0, bgSlots) : [],
      wa_klien: wa,
      kampus,
      tanggal,
      jam_mulai: jam,
      catatan,
      addons: selectedAddons,
      durasi_total: durasiTotal,
      total_harga: totalHarga,
    })
  }


  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col min-h-screen px-4 sm:px-6 py-10 max-w-xl mx-auto w-full"
    >
      {/* Header Langkah */}
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-1 font-heading">
          Langkah 4 dari 6
        </p>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[rgb(var(--color-text))]">
          Detail Jadwal & Preferensi
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
          Klien: <span className="font-semibold text-[rgb(var(--color-text))]">{nama}</span> • Paket:{' '}
          <span className="font-semibold text-[rgb(var(--color-text))]">{pkg.nama}</span>
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {/* 1. SELEKSI BACKGROUND DENGAN PREVIEW FOTO */}
        {bgSlots > 0 && (
          <section className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
            <BackgroundSelector
              backgrounds={backgrounds}
              selectedBg={selectedBg}
              bgSlots={bgSlots}
              onToggle={toggleBg}
              error={errors.bg}
            />
          </section>
        )}

        {/* 2. PILIHAN TANGGAL MODERN (KALENDER INTERAKTIF) */}
        <section className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
          <ModernDatePicker
            value={tanggal}
            onChange={handleDateChange}
            error={errors.tanggal}
            closedDates={settings?.closed_dates || []}
          />
        </section>

        {/* 3. PILIHAN JAM MULAI (TERKELOMPOK MODERN) */}
        <section className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
          <TimeSlotSelector
            slots={availableSlots}
            selectedSlot={jam}
            durasiTotal={durasiTotal}
            tanggal={tanggal}
            loading={loadingSlots}
            onSelect={handleSlotSelect}
            error={errors.jam}
          />
        </section>

        {/* 4. KONTAK & INFORMASI KLIEN */}
        <section className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm flex flex-col gap-4">
          <h3 className="font-heading font-bold text-base text-[rgb(var(--color-text))] mb-1">
            Kontak & Keterangan
          </h3>

          <div className="relative">
            <Input
              label="Nomor WhatsApp"
              placeholder="0812xxxxxxxx"
              type="tel"
              value={wa}
              onChange={e => {
                setWa(e.target.value)
                setErrors(prev => ({ ...prev, wa: '' }))
              }}
              error={errors.wa}
              hint="Digunakan untuk konfirmasi dan pengiriman softfile foto"
            />
          </div>

          <Input
            label="Kampus / Instansi / Pekerjaan (opsional)"
            placeholder="cth. Universitas Tanjungpura, Polnep"
            value={kampus}
            onChange={e => setKampus(e.target.value)}
          />

          <Textarea
            label="Catatan Khusus (opsional)"
            placeholder="cth. Ingin pose keluarga besar 8 orang, bawa toga wisuda, dll."
            value={catatan}
            onChange={e => setCatatan(e.target.value)}
            rows={3}
          />
        </section>

        {/* 5. ADD-ON LAYANAN */}
        {addons.length > 0 && (
          <section className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
            <div className="mb-4">
              <h3 className="font-heading font-bold text-base text-[rgb(var(--color-text))]">
                Tambah Layanan (Add-on)
              </h3>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Tingkatkan sesi foto sesuai kebutuhanmu
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {addons
                .sort((a, b) => a.urutan - b.urutan)
                .map(addon => {
                  const qty = addonMap[addon.id] || 0
                  return (
                    <div
                      key={addon.id}
                      className={`flex items-center justify-between gap-4 p-3.5 rounded-2xl border-2 transition-all ${
                        qty > 0
                          ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.04)] shadow-xs'
                          : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-heading font-semibold text-sm truncate">
                            {addon.nama}
                          </p>
                          {addon.ukuran && (
                            <span className="text-[10px] bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] px-1.5 py-0.2 rounded font-medium">
                              {addon.ukuran}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                          {(addon.jenis === 'waktu' ? labelSatuanWaktu(addon) : addon.satuan)} •{' '}
                          <span className="font-semibold text-[rgb(var(--color-forest))]">
                            {formatRupiah(addon.harga)}
                          </span>
                        </p>
                      </div>

                      <Stepper
                        value={qty}
                        min={0}
                        max={addon.maks}
                        onChange={v =>
                          setAddonMap(prev => ({ ...prev, [addon.id]: v }))
                        }
                      />
                    </div>
                  )
                })}
            </div>
          </section>
        )}

        {/* 6. RINGKASAN BIAYA BERJALAN */}
        <div className="rounded-3xl bg-[rgb(var(--color-forest)/0.07)] border-2 border-[rgb(var(--color-forest)/0.2)] p-5">
          <div className="flex items-center justify-between text-xs text-[rgb(var(--color-text-muted))] mb-2 pb-2 border-b border-[rgb(var(--color-forest)/0.15)]">
            <span className="font-heading font-semibold">Rincian Perhitungan</span>
            <span>Total Durasi: {durasiTotal} Menit</span>
          </div>

          <div className="flex justify-between text-sm mb-1.5">
            <span className="text-[rgb(var(--color-text))]">Paket {pkg.nama}</span>
            <span className="font-medium">{formatRupiah(pkg.harga)}</span>
          </div>

          {addons
            .filter(a => (addonMap[a.id] || 0) > 0)
            .map(a => (
              <div key={a.id} className="flex justify-between text-xs mb-1.5 text-[rgb(var(--color-text-muted))]">
                <span>
                  {a.nama} ({addonMap[a.id]} × {a.jenis === 'waktu' ? labelSatuanWaktu(a) : a.satuan})
                </span>
                <span className="font-medium text-[rgb(var(--color-text))]">
                  {formatRupiah(a.harga * addonMap[a.id])}
                </span>
              </div>
            ))}

          <div className="flex justify-between font-heading font-bold text-base mt-3 pt-3 border-t border-[rgb(var(--color-forest)/0.2)]">
            <span>Estimasi Total</span>
            <span className="text-lg text-[rgb(var(--color-forest))]">
              {formatRupiah(totalHarga)}
            </span>
          </div>
        </div>
      </div>

      {/* Navigasi Tombol */}
      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Kembali
        </Button>
        <Button onClick={handleNext} className="flex-1 group">
          Pembayaran
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>

      {/* Modal Pop-up Syarat & Ketentuan Studio */}
      <AnimatePresence>
        {showSkModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto"
            onClick={e => e.target === e.currentTarget && setShowSkModal(false)}
          >
            <motion.div
              initial={{ y: 25, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 25, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3, ease: [0.34, 1.2, 0.64, 1] }}
              className="w-full max-w-lg bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto"
            >
              {/* Header Modal S&K */}
              <div className="relative px-6 py-5 bg-[rgb(var(--color-forest))] text-white border-b-4 border-[rgb(var(--color-blitz))]">
                <button
                  type="button"
                  onClick={() => setShowSkModal(false)}
                  className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
                  aria-label="Tutup"
                >
                  <X className="w-4 h-4 text-white" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[rgb(var(--color-blitz))] text-[rgb(var(--color-forest))] flex items-center justify-center shadow-md">
                    <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div>
                    <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-blitz))] bg-white/10 px-2 py-0.5 rounded-full">
                      Persetujuan Klien
                    </span>
                    <h3 className="font-heading font-bold text-lg sm:text-xl text-white mt-0.5">
                      Syarat & Ketentuan Studio
                    </h3>
                  </div>
                </div>
                <p className="text-white/80 text-xs mt-2 leading-relaxed">
                  Harap membaca dan menyetujui ketentuan pemotretan Desara Home Studio sebelum melanjutkan ke tahap pembayaran.
                </p>
              </div>

              {/* Isi Poin-Poin S&K */}
              <div className="p-5 sm:p-6 max-h-[60vh] overflow-y-auto flex flex-col gap-4 text-xs sm:text-sm text-[rgb(var(--color-text))]">
                <div className="rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] p-4 flex flex-col gap-3.5">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5">
                      1
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[rgb(var(--color-text))]">
                        Pembayaran Down Payment (DP)
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                        Jadwal sesi foto dinyatakan sah terkunci setelah klien melakukan pembayaran DP minimal sesuai ketentuan. Pembayaran DP bersifat <strong>non-refundable</strong> (tidak dapat dikembalikan) jika terjadi pembatalan sepihak oleh klien.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5">
                      2
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[rgb(var(--color-text))]">
                        Ketepatan Waktu Kehadiran
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                        Klien diharapkan hadir di studio <strong>10–15 menit</strong> sebelum jam sesi dimulai untuk persiapan. Keterlambatan kedatangan tidak akan menambah durasi pemotretan.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5">
                      3
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[rgb(var(--color-text))]">
                        Perubahan Jadwal (Reschedule)
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                        Reschedule dapat diajukan maksimal <strong>H-2 sebelum jadwal pemotretan</strong> dan bergantung pada ketersediaan slot kosong studio.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5">
                      4
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[rgb(var(--color-text))]">
                        Background & Fasilitas Studio
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                        Klien bersama-sama menjaga kebersihan dan keutuhan peralatan/properti studio selama sesi berlangsung.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] flex items-center justify-center font-heading font-bold text-xs shrink-0 mt-0.5">
                      5
                    </span>
                    <div>
                      <p className="font-heading font-bold text-[rgb(var(--color-text))]">
                        Pengiriman Hasil Foto & Cetak
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5 leading-relaxed">
                        File foto (softfile) serta hasil cetak (jika termasuk dalam paket/add-on) akan diserahkan sesuai estimasi pengerjaan studio.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Checkbox Wajib Centang */}
                <label className={`
                  flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl border-2 cursor-pointer transition-all
                  ${
                    agreedSk
                      ? 'bg-[rgb(var(--color-forest)/0.08)] border-[rgb(var(--color-forest))] shadow-sm'
                      : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.5)]'
                  }
                `}>
                  <input
                    type="checkbox"
                    checked={agreedSk}
                    onChange={e => setAgreedSk(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[rgb(var(--color-forest))] focus:ring-[rgb(var(--color-forest))] accent-[rgb(var(--color-forest))]"
                  />
                  <div className="flex-1">
                    <span className="font-heading font-bold text-xs sm:text-sm text-[rgb(var(--color-text))] block">
                      Saya menerima & menyetujui seluruh S&K Studio
                    </span>
                    <span className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5 block">
                      Centang kotak ini untuk melanjutkan ke tahap pembayaran Down Payment (DP).
                    </span>
                  </div>
                </label>
              </div>

              {/* Footer Tombol Modal */}
              <div className="px-5 py-4 bg-[rgb(var(--color-surface))] border-t-2 border-[rgb(var(--color-border))] flex gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSkModal(false)}
                  className="flex-1"
                >
                  Kembali
                </Button>
                <Button
                  type="button"
                  disabled={!agreedSk}
                  onClick={handleAgreeAndProceed}
                  className="flex-1 group shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Lanjut ke Pembayaran
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

