'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Step1Welcome } from './Step1Welcome'
import { Step2Nama } from './Step2Nama'
import { Step3Kategori } from './Step3Kategori'
import { Step4Pricelist } from './Step4Pricelist'
import { Step5Form } from './Step5Form'
import { Step6Pembayaran } from './Step6Pembayaran'
import { Step7Sukses } from './Step7Sukses'
import { WaitingListModal } from './WaitingListModal'
import { submitBooking } from '@/app/actions'
import type {
  Settings, Category, Package, Addon,
  BookingFormAddon, Booking, BookingAddon
} from '@/types'

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

interface BookingWizardProps {
  settings: Settings
  categories: Category[]
  packages: Package[]
  addons: Addon[]
  addonCategories: { addon_id: string; category_id: string }[]
}

export function BookingWizard({
  settings,
  categories,
  packages,
  addons,
  addonCategories,
}: BookingWizardProps) {
  const [step, setStep] = useState<Step>(1)
  const [showWaiting, setShowWaiting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [nama, setNama] = useState('')
  const [category, setCategory] = useState<Category | null>(null)
  const [pkg, setPkg] = useState<Package | null>(null)
  const [formData, setFormData] = useState({
    pilihan_background: [] as string[],
    wa_klien: '',
    kampus: '',
    tanggal: '',
    jam_mulai: '',
    catatan: '',
    addons: [] as BookingFormAddon[],
    durasi_total: 0,
    total_harga: 0,
  })
  const [booking, setBooking] = useState<Booking | null>(null)
  const [bookingAddons, setBookingAddons] = useState<BookingAddon[]>([])

  const backgrounds = Array.isArray(settings.backgrounds)
    ? settings.backgrounds
    : []

  const categoryPackages = category
    ? packages.filter(p => p.category_id === category.id)
    : []

  const categoryAddons = category
    ? addons.filter(a =>
        addonCategories.some(
          ac => ac.addon_id === a.id && ac.category_id === category.id
        )
      )
    : []

  const goTo = (s: Step) => setStep(s)
  const back = () => setStep(prev => (prev > 1 ? ((prev - 1) as Step) : prev))

  const handleStep5 = (data: typeof formData) => {
    setFormData(data)
    goTo(6)
  }

  const handleStep6 = async (dpAmount: number) => {
    if (!category || !pkg) return
    setLoading(true)
    setError('')

    const result = await submitBooking({
      nama,
      category,
      package: pkg,
      pilihan_background: formData.pilihan_background,
      wa_klien: formData.wa_klien,
      kampus: formData.kampus,
      tanggal: formData.tanggal,
      jam_mulai: formData.jam_mulai,
      catatan: formData.catatan,
      addons: formData.addons,
      dp_dibayar: dpAmount,
      bukti_transfer: undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
      return
    }

    if (result.booking) {
      setBooking(result.booking as Booking)
      // Map addons from form data to BookingAddon shape for display
      setBookingAddons(
        formData.addons.map(a => ({
          id: '',
          booking_id: result.booking!.id,
          addon_id: a.addon.id,
          jenis: a.addon.jenis,
          nama: a.addon.nama,
          satuan: a.addon.satuan,
          harga: a.addon.harga,
          jumlah: a.jumlah,
          total: a.addon.harga * a.jumlah,
        }))
      )
      goTo(7)
    }
  }

  const reset = () => {
    setStep(1)
    setNama('')
    setCategory(null)
    setPkg(null)
    setFormData({
      pilihan_background: [],
      wa_klien: '',
      kampus: '',
      tanggal: '',
      jam_mulai: '',
      catatan: '',
      addons: [],
      durasi_total: 0,
      total_harga: 0,
    })
    setBooking(null)
    setBookingAddons([])
    setError('')
  }

  return (
    <>
      {/* Progress bar (steps 2-6) */}
      {step >= 2 && step <= 6 && (
        <div className="fixed top-0 left-0 right-0 z-40 h-1 bg-[rgb(var(--color-cream-dark))]">
          <div
            className="h-full bg-[rgb(var(--color-forest))] transition-all duration-500"
            style={{ width: `${((step - 1) / 5) * 100}%` }}
          />
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="fixed top-4 left-4 right-4 z-50 bg-red-500 text-white px-5 py-3 rounded-2xl text-sm shadow-lg">
          {error}
          <button onClick={() => setError('')} className="ml-3 underline">Tutup</button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <Step1Welcome
            key="step1"
            settings={settings}
            onNext={() => goTo(2)}
            onWaitingList={() => setShowWaiting(true)}
          />
        )}
        {step === 2 && (
          <Step2Nama
            key="step2"
            defaultValue={nama}
            onNext={n => { setNama(n); goTo(3) }}
            onBack={back}
          />
        )}
        {step === 3 && (
          <Step3Kategori
            key="step3"
            categories={categories}
            selected={category}
            onSelect={cat => { setCategory(cat); setPkg(null) }}
            onNext={() => goTo(4)}
            onBack={back}
          />
        )}
        {step === 4 && category && (
          <Step4Pricelist
            key="step4"
            packages={categoryPackages}
            selected={pkg}
            onSelect={setPkg}
            onNext={() => goTo(5)}
            onBack={back}
            categoryNama={category.nama}
            onWaitingList={() => setShowWaiting(true)}
          />
        )}
        {step === 5 && pkg && category && (
          <Step5Form
            key="step5"
            nama={nama}
            pkg={pkg}
            settings={settings}
            addons={categoryAddons}
            backgrounds={backgrounds}
            defaultValues={formData}
            onNext={handleStep5}
            onBack={back}
          />
        )}
        {step === 6 && pkg && (
          <Step6Pembayaran
            key="step6"
            pkg={pkg}
            addons={formData.addons}
            totalHarga={formData.total_harga}
            dpMinimal={settings.dp_minimal}
            settings={settings}
            onNext={handleStep6}
            onBack={back}
            loading={loading}
          />
        )}
        {step === 7 && booking && (
          <Step7Sukses
            key="step7"
            booking={booking}
            bookingAddons={bookingAddons}
            waAdmin={settings.wa_admin}
            namaStudio={settings.nama_studio}
            onReset={reset}
          />
        )}
      </AnimatePresence>

      {/* Waiting list modal */}
      <AnimatePresence>
        {showWaiting && (
          <WaitingListModal
            categories={categories}
            waAdmin={settings.wa_admin}
            namaStudio={settings.nama_studio}
            settings={settings}
            onClose={() => setShowWaiting(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
