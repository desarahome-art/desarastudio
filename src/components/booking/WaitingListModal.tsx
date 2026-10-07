'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { submitWaitingList, getWaitingListSlotStatus } from '@/app/actions'
import { ModernDatePicker } from './ModernDatePicker'
import { formatRupiah, timeToMinutes } from '@/lib/utils'
import {
  X,
  CheckCircle,
  MessageCircle,
  ClipboardList,
  User,
  Phone,
  Tag,
  CalendarDays,
  Check,
  ArrowRight,
  Clock,
  School,
  Sun,
  Sunrise,
  Sunset,
  Copy,
  Lock,
  CreditCard,
  AlertCircle,
} from 'lucide-react'
import type { Category, Settings } from '@/types'

interface WaitingListModalProps {
  categories: Category[]
  waAdmin: string
  namaStudio: string
  settings?: Settings
  onClose: () => void
}

export function WaitingListModal({
  categories,
  waAdmin,
  namaStudio,
  settings,
  onClose,
}: WaitingListModalProps) {
  const [nama, setNama] = useState('')
  const [wa, setWa] = useState('')
  const [kampus, setKampus] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [tanggal, setTanggal] = useState('')
  const [jamIngin, setJamIngin] = useState('')
  const [catatan, setCatatan] = useState('')

  // Slot checking state
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [allSlots, setAllSlots] = useState<string[]>([])
  const [bookedSlots, setBookedSlots] = useState<string[]>([])
  const [waitingListSlots, setWaitingListSlots] = useState<string[]>([])

  // DP & submit states
  const [copiedRekening, setCopiedRekening] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const dpMinimal = settings?.dp_minimal || 100000
  const activeCategories = categories.filter(c => c.aktif).sort((a, b) => a.urutan - b.urutan)
  const selectedCategory = activeCategories.find(c => c.id === categoryId)

  // Fetch slot status saat tanggal berubah
  const fetchSlotStatus = useCallback(async (selectedDate: string) => {
    if (!selectedDate) {
      setAllSlots([])
      setBookedSlots([])
      setWaitingListSlots([])
      return
    }
    setLoadingSlots(true)
    try {
      const res = await getWaitingListSlotStatus(
        selectedDate,
        settings?.jam_buka || '08:00',
        settings?.jam_tutup || '20:00',
        settings?.slot_interval || 30
      )
      setAllSlots(res.allSlots || [])
      setBookedSlots(res.bookedSlots || [])
      setWaitingListSlots(res.waitingListSlots || [])

      // Jika jam yang dipilih sebelumnya ternyata sekarang terblokir, reset
      if (jamIngin && (res.waitingListSlots.includes(jamIngin) || res.bookedSlots.includes(jamIngin))) {
        setJamIngin('')
      }
    } catch (err) {
      console.error('Gagal memuat status slot waiting list:', err)
    } finally {
      setLoadingSlots(false)
    }
  }, [settings?.jam_buka, settings?.jam_tutup, settings?.slot_interval, jamIngin])

  useEffect(() => {
    if (tanggal) {
      fetchSlotStatus(tanggal)
    } else {
      setAllSlots([])
      setBookedSlots([])
      setWaitingListSlots([])
      setJamIngin('')
    }
  }, [tanggal, fetchSlotStatus])

  // Pengelompokan slot jam (sama persis dengan Form Booking TimeSlotSelector)
  const pagiSlots = allSlots.filter(s => {
    try {
      return timeToMinutes(s) < 12 * 60
    } catch {
      return false
    }
  })
  const siangSlots = allSlots.filter(s => {
    try {
      const m = timeToMinutes(s)
      return m >= 12 * 60 && m < 15 * 60
    } catch {
      return false
    }
  })
  const soreMalamSlots = allSlots.filter(s => {
    try {
      return timeToMinutes(s) >= 15 * 60
    } catch {
      return false
    }
  })

  const sessionGroups = [
    { title: 'Pagi', icon: Sunrise, items: pagiSlots, sub: '08:00 - 11:30' },
    { title: 'Siang', icon: Sun, items: siangSlots, sub: '12:00 - 14:30' },
    { title: 'Sore & Malam', icon: Sunset, items: soreMalamSlots, sub: '15:00 - 20:00' },
  ].filter(g => g.items.length > 0)

  const copyRekening = async () => {
    const rek = settings?.rekening_bni || settings?.rekening_bri || ''
    if (rek) {
      await navigator.clipboard.writeText(rek)
      setCopiedRekening(true)
      setTimeout(() => setCopiedRekening(false), 2000)
    }
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!nama.trim()) e.nama = 'Nama lengkap wajib diisi'
    if (!wa.trim()) e.wa = 'Nomor WhatsApp aktif wajib diisi'
    if (!categoryId) e.category = 'Pilih kategori sesi foto terlebih dahulu'
    if (!tanggal) e.tanggal = 'Pilih perkiraan tanggal sesi foto'
    if (!jamIngin) e.jamIngin = 'Pilih jam sesi foto yang diinginkan'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    const result = await submitWaitingList({
      nama: nama.trim(),
      wa: wa.trim(),
      kampus: kampus.trim() || undefined,
      category_id: categoryId,
      category_nama: selectedCategory!.nama,
      tanggal_ingin: tanggal,
      jam_ingin: jamIngin,
      catatan: catatan.trim() || undefined,
      dp_minimal: dpMinimal,
    })
    setLoading(false)
    if (result.error) {
      setErrors({ submit: result.error })
    } else {
      setSuccess(true)
    }
  }

  // Pesan WhatsApp otomatis lengkap
  const detailMsg = [
    `Halo Admin ${namaStudio}, saya ingin konfirmasi pendaftaran waiting list:`,
    `• Nama: *${nama.trim()}*`,
    kampus.trim() ? `• Kampus/Instansi: *${kampus.trim()}*` : null,
    `• Kategori: *${selectedCategory?.nama || ''}*`,
    tanggal ? `• Tanggal: *${new Date(tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}*` : null,
    jamIngin ? `• Jam: *${jamIngin} WIB*` : null,
    `• DP Waiting List: *${formatRupiah(dpMinimal)}*`,
    catatan.trim() ? `• Catatan: ${catatan.trim()}` : null,
    ``,
    `*(Berikut saya lampirkan bukti transfer DP via WhatsApp untuk verifikasi)*`,
  ].filter(Boolean).join('\n')

  const waUrl = `https://wa.me/${waAdmin}?text=${encodeURIComponent(detailMsg)}`

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.34, 1.2, 0.64, 1] }}
        className="w-full max-w-xl bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto"
      >
        {/* Top Header Card */}
        <div className="relative px-6 pt-6 pb-5 bg-[rgb(var(--color-forest))] text-white border-b-4 border-[rgb(var(--color-blitz))]">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-blitz))] text-black flex items-center justify-center shadow-lg font-heading font-black">
              <ClipboardList className="w-6 h-6 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-blitz))] bg-white/10 px-2 py-0.5 rounded-full">
                  Prioritas Antrean
                </span>
              </div>
              <h2 className="font-heading font-bold text-xl sm:text-2xl text-white leading-tight mt-0.5">
                Daftar Waiting List
              </h2>
            </div>
          </div>
          <p className="text-white/80 text-xs sm:text-sm mt-2.5 leading-relaxed">
            Kunci slot jam pilihan Anda. Waiting list wajib DP minimal {formatRupiah(dpMinimal)} dan bukti transfer dikirim via WhatsApp.
          </p>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 max-h-[78vh] overflow-y-auto">
          <AnimatePresence mode="wait">
            {success ? (
              /* ---- SUCCESS STATE ---- */
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="flex flex-col items-center gap-4 py-3 text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                  className="w-20 h-20 rounded-full bg-[rgb(var(--color-forest)/0.1)] flex items-center justify-center border-2 border-[rgb(var(--color-forest)/0.2)]"
                >
                  <CheckCircle className="w-10 h-10 text-[rgb(var(--color-forest))]" />
                </motion.div>

                <div>
                  <h3 className="font-heading font-bold text-2xl text-[rgb(var(--color-text))] mb-1">
                    Waiting List Terdaftar!
                  </h3>
                  <p className="text-xs sm:text-sm text-[rgb(var(--color-text-muted))] max-w-sm mx-auto leading-relaxed">
                    Data antrean Anda berhasil disimpan. Silakan kirimkan bukti transfer DP via WhatsApp ke Admin agar nomor antrean Anda segera diverifikasi.
                  </p>
                </div>

                {/* Box Petunjuk Wajib Kirim Bukti DP */}
                <div className="w-full rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-4 text-left">
                  <div className="flex items-center gap-2 mb-1.5 text-emerald-800 font-heading font-bold text-sm">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    Langkah Terakhir: Kirim Bukti Transfer DP
                  </div>
                  <p className="text-xs text-emerald-700 leading-relaxed">
                    Kirimkan bukti transfer pembayaran DP sebesar <strong>{formatRupiah(dpMinimal)}</strong> langsung ke WhatsApp Admin melalui tombol di bawah ini.
                  </p>
                </div>

                {/* Badge Konfirmasi Ringkasan */}
                <div className="w-full rounded-2xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] p-4 text-left shadow-sm">
                  <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-2 pb-2 border-b border-[rgb(var(--color-border))]">
                    Ringkasan Waiting List
                  </p>
                  <div className="flex flex-col gap-2.5 text-xs sm:text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> Nama Lengkap
                      </span>
                      <span className="font-semibold text-[rgb(var(--color-text))]">{nama}</span>
                    </div>
                    {kampus && (
                      <div className="flex items-center justify-between">
                        <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                          <School className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> Kampus / Instansi
                        </span>
                        <span className="font-semibold text-[rgb(var(--color-text))]">{kampus}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> WhatsApp
                      </span>
                      <span className="font-semibold text-[rgb(var(--color-text))]">{wa}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> Kategori Sesi
                      </span>
                      <span className="font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2 py-0.5 rounded-md">
                        {selectedCategory?.nama}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <CalendarDays className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> Tanggal
                      </span>
                      <span className="font-semibold text-[rgb(var(--color-text))]">
                        {new Date(tanggal).toLocaleDateString('id-ID', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> Jam Sesi Terkunci
                      </span>
                      <span className="font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2 py-0.5 rounded-md">
                        {jamIngin} WIB
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[rgb(var(--color-border))]">
                      <span className="text-[rgb(var(--color-text-muted))] flex items-center gap-2">
                        <CreditCard className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" /> DP Waiting List
                      </span>
                      <span className="font-heading font-bold text-[rgb(var(--color-forest))]">
                        {formatRupiah(dpMinimal)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5 w-full mt-2">
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="w-full">
                    <Button variant="secondary" size="lg" className="w-full shadow-md">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      Kirim Bukti Transfer ke Admin via WA
                    </Button>
                  </a>
                  <Button variant="ghost" onClick={onClose} className="w-full">
                    Tutup & Selesai
                  </Button>
                </div>
              </motion.div>
            ) : (
              /* ---- FORM STATE ---- */
              <motion.form
                key="form"
                onSubmit={handleSubmit}
                className="flex flex-col gap-6"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                {errors.submit && (
                  <div className="rounded-2xl bg-red-50 border-2 border-red-200 px-4 py-3 text-red-600 text-xs sm:text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{errors.submit}</span>
                  </div>
                )}

                {/* 1. SELEKSI KATEGORI MODEL KARTU */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-heading font-semibold text-[rgb(var(--color-text))]">
                      Pilih Kategori Foto <span className="text-red-500">*</span>
                    </label>
                    <span className="text-xs text-[rgb(var(--color-text-muted))]">
                      {selectedCategory ? '1 dipilih' : 'Pilih 1'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {activeCategories.map(cat => {
                      const isSelected = categoryId === cat.id
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setCategoryId(cat.id)
                            setErrors(prev => ({ ...prev, category: '' }))
                          }}
                          className={`
                            relative p-3 rounded-2xl border-2 text-left transition-all duration-150 flex flex-col justify-between min-h-[64px]
                            ${
                              isSelected
                                ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] shadow-sm'
                                : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-forest)/0.4)] text-[rgb(var(--color-text))]'
                            }
                          `}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-heading font-bold text-xs sm:text-sm line-clamp-1">
                              {cat.nama}
                            </span>
                            {isSelected && (
                              <div className="w-4 h-4 rounded-full bg-[rgb(var(--color-forest))] text-white flex items-center justify-center shrink-0">
                                <Check className="w-2.5 h-2.5" />
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-[rgb(var(--color-text-muted))] mt-1">
                            Foto Studio
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {errors.category && (
                    <p className="text-xs text-red-500 font-medium">{errors.category}</p>
                  )}
                </div>

                {/* 2. DATA IDENTITAS KLIEN & KAMPUS */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] flex flex-col gap-3.5 shadow-sm">
                  <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                    Identitas & Kontak Klien
                  </p>

                  <Input
                    label="Nama Lengkap *"
                    placeholder="cth. Anisa Ramadhani"
                    value={nama}
                    onChange={e => {
                      setNama(e.target.value)
                      setErrors(prev => ({ ...prev, nama: '' }))
                    }}
                    error={errors.nama}
                    autoComplete="name"
                  />

                  <Input
                    label="Kampus / Instansi / Pekerjaan (opsional)"
                    placeholder="cth. Universitas Tanjungpura, Polnep, SMA 1 Pontianak"
                    value={kampus}
                    onChange={e => setKampus(e.target.value)}
                  />

                  <Input
                    label="Nomor WhatsApp *"
                    type="tel"
                    placeholder="0812xxxxxxxx"
                    value={wa}
                    onChange={e => {
                      setWa(e.target.value)
                      setErrors(prev => ({ ...prev, wa: '' }))
                    }}
                    error={errors.wa}
                    hint="Admin akan mengonfirmasi antrean melalui nomor WhatsApp ini"
                  />
                </div>

                {/* 3. PILIHAN TANGGAL MODERN */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
                  <div className="mb-2">
                    <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                      Pilih Tanggal Sesi Waiting List <span className="text-red-500">*</span>
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                      Pilih tanggal yang ingin Anda amankan slotnya
                    </p>
                  </div>
                  <ModernDatePicker
                    value={tanggal}
                    onChange={newDate => {
                      setTanggal(newDate)
                      setErrors(prev => ({ ...prev, tanggal: '', jamIngin: '' }))
                    }}
                    closedDates={settings?.closed_dates || []}
                  />
                  {errors.tanggal && (
                    <p className="text-xs text-red-500 font-medium mt-1">{errors.tanggal}</p>
                  )}
                </div>

                {/* 4. PILIHAN JAM SAMA PERSIS DENGAN FORM BOOKING DENGAN SISTEM BLOKIR WAITING LIST */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] flex flex-col gap-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                        Pilih Jam Mulai Sesi <span className="text-red-500">*</span>
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                        Jam yang sudah ada antrean client lain tidak dapat dipilih kembali
                      </p>
                    </div>
                    {jamIngin && (
                      <span className="text-xs font-heading font-bold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2.5 py-1 rounded-full flex items-center gap-1 border border-[rgb(var(--color-forest)/0.2)]">
                        <Clock className="w-3.5 h-3.5" />
                        {jamIngin} WIB
                      </span>
                    )}
                  </div>

                  {!tanggal ? (
                    <div className="text-center py-6 px-3 bg-[rgb(var(--color-cream)/0.5)] rounded-2xl border border-dashed border-[rgb(var(--color-border))]">
                      <Clock className="w-6 h-6 text-[rgb(var(--color-text-muted))] mx-auto mb-1.5 opacity-40" />
                      <p className="text-xs font-medium text-[rgb(var(--color-text-muted))]">
                        Silakan pilih tanggal terlebih dahulu di atas untuk melihat slot jam
                      </p>
                    </div>
                  ) : loadingSlots ? (
                    <div className="flex flex-col items-center justify-center py-6 gap-2">
                      <div className="animate-spin w-6 h-6 border-2 border-[rgb(var(--color-forest))] border-t-transparent rounded-full" />
                      <p className="text-xs text-[rgb(var(--color-text-muted))]">Memeriksa ketersediaan jam...</p>
                    </div>
                  ) : sessionGroups.length === 0 ? (
                    <div className="text-center py-6 px-3 bg-red-50/50 rounded-2xl border border-red-200">
                      <p className="text-xs font-medium text-red-600">
                        Tidak ada slot jam operasional yang tersedia untuk tanggal ini.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 mt-1">
                      {sessionGroups.map(group => {
                        const Icon = group.icon
                        return (
                          <div key={group.title} className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-1.5 text-xs font-heading font-semibold text-[rgb(var(--color-text-muted))] pb-1 border-b border-[rgb(var(--color-border)/0.5)]">
                              <Icon className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                              <span>{group.title}</span>
                              <span className="text-[10px] opacity-60 font-normal">({group.sub})</span>
                            </div>

                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                              {group.items.map(slot => {
                                const isSelected = jamIngin === slot
                                const isWaitingList = waitingListSlots.includes(slot)
                                const isBooked = bookedSlots.includes(slot)
                                const isUnavailable = isWaitingList || isBooked

                                return (
                                  <button
                                    key={slot}
                                    type="button"
                                    disabled={isUnavailable}
                                    onClick={() => {
                                      if (!isUnavailable) {
                                        setJamIngin(isSelected ? '' : slot)
                                        setErrors(prev => ({ ...prev, jamIngin: '' }))
                                      }
                                    }}
                                    className={`
                                      relative py-2.5 px-2 rounded-xl text-center border-2 transition-all flex flex-col items-center justify-center
                                      ${
                                        isWaitingList
                                          ? 'bg-amber-50/70 border-amber-200 text-amber-800/80 cursor-not-allowed opacity-75'
                                          : isBooked
                                          ? 'bg-red-50/70 border-red-200 text-red-700/80 cursor-not-allowed opacity-75'
                                          : isSelected
                                          ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-blitz))] shadow-md font-bold'
                                          : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] text-[rgb(var(--color-text))] hover:border-[rgb(var(--color-forest)/0.5)]'
                                      }
                                    `}
                                  >
                                    <span className="font-heading text-xs sm:text-sm font-bold">
                                      {slot}
                                    </span>

                                    {isWaitingList ? (
                                      <span className="text-[9px] text-amber-700 font-semibold flex items-center gap-0.5 mt-0.5">
                                        <Lock className="w-2.5 h-2.5" /> Ada Antrean
                                      </span>
                                    ) : isBooked ? (
                                      <span className="text-[9px] text-red-600 font-semibold flex items-center gap-0.5 mt-0.5">
                                        <Lock className="w-2.5 h-2.5" /> Booked
                                      </span>
                                    ) : isSelected ? (
                                      <span className="text-[9px] text-[rgb(var(--color-blitz))] font-semibold mt-0.5">
                                        Dipilih
                                      </span>
                                    ) : (
                                      <span className="text-[9px] text-[rgb(var(--color-text-muted))] mt-0.5">
                                        Tersedia
                                      </span>
                                    )}

                                    {isSelected && (
                                      <div className="absolute top-1 right-1 w-3.5 h-3.5 rounded-full bg-[rgb(var(--color-blitz))] flex items-center justify-center">
                                        <Check className="w-2.5 h-2.5 text-black stroke-[3]" />
                                      </div>
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}

                      {/* Legend info slot */}
                      <div className="flex flex-wrap items-center gap-3 pt-2 text-[11px] text-[rgb(var(--color-text-muted))] border-t border-[rgb(var(--color-border)/0.5)]">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]" />
                          <span>Bisa Dipilih</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span>Ada Antrean Waiting List</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <span>Sudah Dibooking</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {errors.jamIngin && (
                    <p className="text-xs text-red-500 font-medium">{errors.jamIngin}</p>
                  )}
                </div>

                {/* 5. WAJIB DP MINIMAL 100RB & KETERANGAN BUKTI VIA WA */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-forest)/0.25)] flex flex-col gap-3 shadow-sm bg-gradient-to-br from-[rgb(var(--color-forest)/0.03)] to-transparent">
                  <div className="flex items-center justify-between pb-2 border-b border-[rgb(var(--color-border))]">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-[rgb(var(--color-forest))]" />
                      <span className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
                        Ketentuan DP Waiting List
                      </span>
                    </div>
                    <span className="font-heading font-bold text-sm text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-2.5 py-0.5 rounded-full border border-[rgb(var(--color-forest)/0.2)]">
                      Min. {formatRupiah(dpMinimal)}
                    </span>
                  </div>

                  <p className="text-xs text-[rgb(var(--color-text))] leading-relaxed">
                    Untuk mengunci slot jam antrean waiting list di atas agar tidak diambil orang lain, Anda diwajibkan melakukan transfer DP minimal <strong>{formatRupiah(dpMinimal)}</strong>.
                  </p>

                  {/* Box Rekening Bank */}
                  <div className="rounded-2xl bg-[rgb(var(--color-forest)/0.06)] border border-[rgb(var(--color-forest)/0.2)] p-3.5 flex items-center justify-between">
                    <div>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))]">Transfer Bank BNI:</p>
                      <p className="font-heading font-bold text-base text-[rgb(var(--color-text))]">
                        {settings?.rekening_bni || settings?.rekening_bri || '1234567890'}
                      </p>
                      <p className="text-[11px] text-[rgb(var(--color-text-muted))]">
                        a.n. {settings?.nama_rekening || 'Desara Studio'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={copyRekening}
                      className="border border-[rgb(var(--color-forest)/0.2)] text-xs h-8"
                    >
                      {copiedRekening ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedRekening ? 'Tersalin' : 'Salin'}
                    </Button>
                  </div>

                  {/* Keterangan Bukti Transfer via WA */}
                  <div className="rounded-2xl bg-emerald-50/80 border border-emerald-300 p-3 flex items-start gap-2.5">
                    <MessageCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-emerald-800 leading-relaxed font-medium">
                      <strong>Bukti transfer DP dikirimkan via WhatsApp ke Admin:</strong> Setelah Anda mengisi form ini, screenshot bukti transfer DP dapat langsung dikirimkan melalui WhatsApp agar admin studio memverifikasi antrean Anda.
                    </p>
                  </div>
                </div>

                {/* 6. CATATAN KHUSUS */}
                <div className="p-4 sm:p-5 rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] shadow-sm">
                  <Textarea
                    label="Catatan Khusus (opsional)"
                    placeholder="cth. Foto wisuda dengan keluarga 6 orang, preferensi background cerah, dll."
                    value={catatan}
                    onChange={e => setCatatan(e.target.value)}
                    rows={2}
                  />
                </div>

                {/* Tombol Aksi */}
                <div className="flex gap-3 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="flex-1"
                  >
                    Batal
                  </Button>
                  <Button
                    type="submit"
                    loading={loading}
                    className="flex-1 group"
                  >
                    Daftar Waiting List
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}
