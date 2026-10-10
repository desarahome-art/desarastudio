'use client'

import { useState, useRef } from 'react'
import { updateSetting, uploadBackgroundImage } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Save, Plus, X, Check, Upload, Trash2, Image as ImageIcon, CalendarX, CalendarDays } from 'lucide-react'
import type { Settings, BackgroundItem, ClosedDateItem, Category } from '@/types'

interface SettingsClientProps {
  settings: Settings
  categories?: Category[]
}

export function SettingsClient({ settings: initialSettings, categories = [] }: SettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')

  // Background states
  const [newBgName, setNewBgName] = useState('')
  const [uploadingBgIdx, setUploadingBgIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetBgIdx, setTargetBgIdx] = useState<number | null>(null)

  // Kalender Close states
  const [closeDateInput, setCloseDateInput] = useState('')
  const [closeKetInput, setCloseKetInput] = useState('')
  const [closeError, setCloseError] = useState('')

  const normalizedBackgrounds: BackgroundItem[] = (settings.backgrounds || []).map(bg => {
    if (typeof bg === 'string') {
      return { nama: bg, image_url: undefined }
    }
    return bg
  })

  // Mengembalikan true jika berhasil disimpan; jika gagal, pesan error ditampilkan di atas halaman.
  const save = async (key: string, value: unknown): Promise<boolean> => {
    setSaving(key)
    setSaveError('')
    try {
      const res = await updateSetting(key, value)
      if (res?.error) {
        setSaveError(`Gagal menyimpan pengaturan: ${res.error}`)
        return false
      }
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
      return true
    } catch (err: unknown) {
      setSaveError(`Gagal menyimpan pengaturan: ${(err as Error)?.message || 'terjadi kesalahan'}`)
      return false
    } finally {
      setSaving(null)
    }
  }

  // Tambah tanggal close / libur studio
  const addClosedDate = () => {
    if (!closeDateInput) {
      setCloseError('Pilih tanggal yang ingin ditutup terlebih dahulu.')
      return
    }
    if (!closeKetInput.trim()) {
      setCloseError('Isi keterangan/alasan tanggal ditutup (cth. Libur Bersama, Renovasi).')
      return
    }

    const currentList = Array.isArray(settings.closed_dates) ? settings.closed_dates : []
    // Jika tanggal sudah ada, update keterangannya atau replace
    const filtered = currentList.filter(item => item.tanggal !== closeDateInput)
    const updated: ClosedDateItem[] = [
      ...filtered,
      { tanggal: closeDateInput, keterangan: closeKetInput.trim() },
    ].sort((a, b) => a.tanggal.localeCompare(b.tanggal))

    setSettings(s => ({ ...s, closed_dates: updated }))
    save('closed_dates', updated)
    setCloseDateInput('')
    setCloseKetInput('')
    setCloseError('')
  }

  // Hapus / Buka kembali tanggal close
  const removeClosedDate = (tanggalToRemove: string) => {
    const currentList = Array.isArray(settings.closed_dates) ? settings.closed_dates : []
    const updated = currentList.filter(item => item.tanggal !== tanggalToRemove)
    setSettings(s => ({ ...s, closed_dates: updated }))
    save('closed_dates', updated)
  }

  // Tambah background baru
  const addBackground = () => {
    if (!newBgName.trim()) return
    const updated: BackgroundItem[] = [
      ...normalizedBackgrounds,
      { nama: newBgName.trim(), image_url: undefined },
    ]
    setSettings(s => ({ ...s, backgrounds: updated }))
    save('backgrounds', updated)
    setNewBgName('')
  }

  // Hapus background
  const removeBackground = (indexToRemove: number) => {
    const updated = normalizedBackgrounds.filter((_, idx) => idx !== indexToRemove)
    setSettings(s => ({ ...s, backgrounds: updated }))
    save('backgrounds', updated)
  }

  // Trigger file dialog
  const handlePickPhoto = (idx: number) => {
    setTargetBgIdx(idx)
    fileInputRef.current?.click()
  }

  // Upload file foto hasil background
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || targetBgIdx === null) return

    setUploadingBgIdx(targetBgIdx)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await uploadBackgroundImage(formData)
      if (res.url) {
        const updated = [...normalizedBackgrounds]
        updated[targetBgIdx] = {
          ...updated[targetBgIdx],
          image_url: res.url,
        }
        setSettings(s => ({ ...s, backgrounds: updated }))
        await save('backgrounds', updated)
      } else if (res.error) {
        alert(`Gagal upload foto: ${res.error}`)
      }
    } catch (err) {
      console.error(err)
      alert('Terjadi kesalahan saat mengunggah foto.')
    } finally {
      setUploadingBgIdx(null)
      setTargetBgIdx(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  // Kategori tempat background tampil. kategori_ids tidak ada = semua kategori.
  const bgKategoriAktif = (bg: BackgroundItem): string[] =>
    Array.isArray(bg.kategori_ids) ? bg.kategori_ids : categories.map(c => c.id)

  const setBgKategori = (idx: number, ids: string[]) => {
    const updated = [...normalizedBackgrounds]
    const semua = categories.length > 0 && categories.every(c => ids.includes(c.id))
    const { kategori_ids: _lama, ...sisa } = updated[idx]
    void _lama
    // Semua kategori terpilih -> simpan tanpa kategori_ids, supaya kategori baru otomatis ikut
    updated[idx] = semua ? sisa : { ...sisa, kategori_ids: ids }
    setSettings(s => ({ ...s, backgrounds: updated }))
    save('backgrounds', updated)
  }

  const toggleBgKategori = (idx: number, categoryId: string) => {
    const aktif = bgKategoriAktif(normalizedBackgrounds[idx])
    setBgKategori(
      idx,
      aktif.includes(categoryId) ? aktif.filter(id => id !== categoryId) : [...aktif, categoryId]
    )
  }

  // Hapus foto hasil dari background tertentu
  const removePhotoFromBg = (idx: number) => {
    const updated = [...normalizedBackgrounds]
    updated[idx] = {
      ...updated[idx],
      image_url: undefined,
    }
    setSettings(s => ({ ...s, backgrounds: updated }))
    save('backgrounds', updated)
  }

  const SaveButton = ({ field }: { field: string }) => (
    <Button
      size="sm"
      onClick={() => save(field, (settings as unknown as Record<string, unknown>)[field])}
      loading={saving === field}
      className="self-end"
    >
      {saved === field ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
      {saved === field ? 'Tersimpan' : 'Simpan'}
    </Button>
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {saveError && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 text-red-700 text-sm border border-red-200">
          {saveError}
        </div>
      )}
      {/* Hidden file input untuk upload foto background */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png,image/jpeg,image/webp,image/jpg"
        className="hidden"
      />

      {/* Studio info */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-lg mb-4 text-[rgb(var(--color-text))]">
          Info Studio
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Nama Studio"
                value={settings.nama_studio || ''}
                onChange={e => setSettings(s => ({ ...s, nama_studio: e.target.value }))}
              />
            </div>
            <SaveButton field="nama_studio" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Teks Sambutan"
                value={settings.teks_sambutan || ''}
                onChange={e => setSettings(s => ({ ...s, teks_sambutan: e.target.value }))}
              />
            </div>
            <SaveButton field="teks_sambutan" />
          </div>
        </div>
      </section>

      {/* Kontak & Pembayaran */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-lg mb-4 text-[rgb(var(--color-text))]">
          Kontak & Pembayaran
        </h2>
        <div className="flex flex-col gap-4">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Nomor WA Admin"
                value={settings.wa_admin || ''}
                hint="Format: 628xxxxxxxxxx"
                onChange={e => setSettings(s => ({ ...s, wa_admin: e.target.value }))}
              />
            </div>
            <SaveButton field="wa_admin" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Nomor Rekening BNI"
                value={settings.rekening_bni || settings.rekening_bri || ''}
                onChange={e => setSettings(s => ({ ...s, rekening_bni: e.target.value }))}
              />
            </div>
            <SaveButton field="rekening_bni" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="Nama Rekening"
                value={settings.nama_rekening || ''}
                onChange={e => setSettings(s => ({ ...s, nama_rekening: e.target.value }))}
              />
            </div>
            <SaveButton field="nama_rekening" />
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                label="DP Minimal (Rp)"
                type="number"
                value={settings.dp_minimal || 100000}
                onChange={e => setSettings(s => ({ ...s, dp_minimal: parseInt(e.target.value) || 100000 }))}
              />
            </div>
            <SaveButton field="dp_minimal" />
          </div>
        </div>
      </section>

      {/* Jam Operasional */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-lg mb-4 text-[rgb(var(--color-text))]">
          Jam Operasional
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Input
              label="Jam Buka"
              type="time"
              value={settings.jam_buka || '08:00'}
              onChange={e => setSettings(s => ({ ...s, jam_buka: e.target.value }))}
            />
            <SaveButton field="jam_buka" />
          </div>
          <div className="flex flex-col gap-3">
            <Input
              label="Jam Tutup"
              type="time"
              value={settings.jam_tutup || '20:00'}
              onChange={e => setSettings(s => ({ ...s, jam_tutup: e.target.value }))}
            />
            <SaveButton field="jam_tutup" />
          </div>
        </div>
        <div className="flex gap-3 items-end mt-4">
          <div className="flex-1">
            <Input
              label="Interval slot (menit)"
              type="number"
              value={settings.slot_interval || 30}
              onChange={e => setSettings(s => ({ ...s, slot_interval: parseInt(e.target.value) || 30 }))}
              hint="Interval antar slot yang ditampilkan ke klien"
            />
          </div>
          <SaveButton field="slot_interval" />
        </div>
      </section>

      {/* Pengaturan Background Foto & Upload Contoh Hasil */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="font-heading font-semibold text-lg text-[rgb(var(--color-text))]">
              Daftar Background & Foto Contoh Hasil
            </h2>
            <p className="text-xs text-[rgb(var(--color-text-muted))]">
              Unggah foto contoh asli hasil foto studio untuk setiap warna background agar klien melihat hasil nyata. Centang kategori agar background hanya tampil di kategori tersebut; jika tidak ada yang dicentang, background tidak tampil di mana pun.
            </p>
          </div>
        </div>

        {/* List Background Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 my-4">
          {normalizedBackgrounds.map((bg, idx) => (
            <div
              key={`${bg.nama}-${idx}`}
              className="flex items-center gap-3 p-3 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-forest)/0.4)] transition-all"
            >
              {/* Preview Foto Thumbnail */}
              <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-100 flex items-center justify-center border shrink-0">
                {bg.image_url ? (
                  <>
                    <img
                      src={bg.image_url}
                      alt={bg.nama}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhotoFromBg(idx)}
                      title="Hapus foto ini"
                      className="absolute top-1 right-1 p-0.5 rounded-md bg-black/60 text-white hover:bg-red-600 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-slate-400 p-1 text-center">
                    <ImageIcon className="w-5 h-5 opacity-50" />
                    <span className="text-[9px] mt-0.5">Belum ada</span>
                  </div>
                )}
              </div>

              {/* Info & Tombol Upload */}
              <div className="flex-1 min-w-0">
                <p className="font-heading font-bold text-sm text-[rgb(var(--color-text))] truncate">
                  {bg.nama}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handlePickPhoto(idx)}
                    loading={uploadingBgIdx === idx}
                    className="text-xs h-7 px-2.5 bg-[rgb(var(--color-cream))] hover:bg-[rgb(var(--color-forest)/0.1)] border border-[rgb(var(--color-border))]"
                  >
                    <Upload className="w-3 h-3 mr-1" />
                    {bg.image_url ? 'Ganti Foto' : 'Upload Foto'}
                  </Button>
                </div>
                {categories.length > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--color-text-muted))]">
                        Tampil di kategori
                      </span>
                      <button
                        type="button"
                        onClick={() => setBgKategori(idx, categories.map(c => c.id))}
                        className="text-[10px] font-semibold text-[rgb(var(--color-forest))] hover:underline"
                      >
                        Pilih semua
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {categories.map(cat => {
                        const on = bgKategoriAktif(bg).includes(cat.id)
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            aria-pressed={on}
                            onClick={() => toggleBgKategori(idx, cat.id)}
                            className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                              on
                                ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] font-semibold'
                                : 'bg-[rgb(var(--color-cream))] text-[rgb(var(--color-text-muted))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]'
                            }`}
                          >
                            {cat.nama}
                          </button>
                        )
                      })}
                    </div>
                    {bgKategoriAktif(bg).length === 0 && (
                      <p className="text-[10px] text-amber-600 mt-1">Belum tampil di kategori mana pun.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Hapus Background */}
              <button
                type="button"
                onClick={() => removeBackground(idx)}
                className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                title="Hapus background ini"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Form Tambah Background Baru */}
        <div className="flex gap-2 pt-2 border-t border-[rgb(var(--color-border))]">
          <input
            type="text"
            value={newBgName}
            onChange={e => setNewBgName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addBackground()}
            placeholder="Nama background baru (cth. Putih Bersih, Terracotta)"
            className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
          />
          <Button size="sm" onClick={addBackground}>
            <Plus className="w-4 h-4 mr-1" /> Tambah Background
          </Button>
        </div>
      </section>

      {/* Kalender Close / Jadwal Libur Studio */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 sm:p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center font-bold shrink-0">
              <CalendarX className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading font-semibold text-lg text-[rgb(var(--color-text))]">
                Kalender Close / Jadwal Libur Studio
              </h2>
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Tutup tanggal tertentu di kalender beserta keterangan alasan tutup. Klien tidak dapat memilih tanggal ini saat booking.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200 shrink-0">
            {(settings.closed_dates || []).length} Tanggal Tutup
          </span>
        </div>

        {/* Form Tambah Tanggal Close */}
        <div className="p-4 sm:p-5 rounded-2xl bg-[rgb(var(--color-cream)/0.5)] border-2 border-[rgb(var(--color-border))] mb-4">
          <p className="text-xs font-heading font-bold text-[rgb(var(--color-forest))] mb-3 uppercase tracking-wider">
            Tambah Tanggal Tutup
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
                Pilih Tanggal Tutup:
              </label>
              <input
                type="date"
                value={closeDateInput}
                onChange={e => {
                  setCloseDateInput(e.target.value)
                  setCloseError('')
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-1 block">
                Keterangan / Alasan Tutup:
              </label>
              <input
                type="text"
                value={closeKetInput}
                onChange={e => {
                  setCloseKetInput(e.target.value)
                  setCloseError('')
                }}
                placeholder="cth. Libur Bersama, Renovasi Studio, Jadwal Khusus"
                onKeyDown={e => e.key === 'Enter' && addClosedDate()}
                className="w-full px-3.5 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
              />
            </div>
          </div>

          {closeError && (
            <p className="text-xs text-red-500 font-medium mb-3">{closeError}</p>
          )}

          <Button
            size="sm"
            onClick={addClosedDate}
            loading={saving === 'closed_dates'}
            className="w-full sm:w-auto"
          >
            <Plus className="w-4 h-4 mr-1" /> Simpan Tanggal Tutup
          </Button>
        </div>

        {/* Daftar Tanggal Close */}
        <div className="flex flex-col gap-2">
          {(!settings.closed_dates || settings.closed_dates.length === 0) ? (
            <div className="text-center py-6 px-4 bg-[rgb(var(--color-cream)/0.3)] rounded-xl border border-dashed border-[rgb(var(--color-border))]">
              <CalendarDays className="w-8 h-8 text-[rgb(var(--color-text-muted))] mx-auto mb-1.5 opacity-40" />
              <p className="text-xs text-[rgb(var(--color-text-muted))]">
                Belum ada tanggal libur / close yang ditambahkan.
              </p>
            </div>
          ) : (
            settings.closed_dates
              .slice()
              .sort((a, b) => a.tanggal.localeCompare(b.tanggal))
              .map(item => {
                const dateObj = new Date(item.tanggal)
                const dateFormatted = !isNaN(dateObj.getTime())
                  ? dateObj.toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })
                  : item.tanggal

                return (
                  <div
                    key={item.tanggal}
                    className="flex items-center justify-between p-3.5 rounded-xl border-2 border-red-200 bg-red-50/40 text-sm"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0 mt-0.5">
                        <CalendarX className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-heading font-bold text-[rgb(var(--color-text))]">
                            {dateFormatted}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.2 bg-red-100 text-red-700 border border-red-200 rounded-md">
                            TUTUP
                          </span>
                        </div>
                        <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
                          Keterangan: <strong className="text-red-900">{item.keterangan || 'Studio Tutup'}</strong>
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeClosedDate(item.tanggal)}
                      className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-100/60 rounded-lg transition-colors ml-2 shrink-0"
                      title="Buka kembali tanggal ini (hapus jadwal close)"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })
          )}
        </div>
      </section>

      {/* Waiting list toggle */}
      <section className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-lg mb-4 text-[rgb(var(--color-text))]">
          Fitur Tambahan
        </h2>
        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => {
              const newVal = !settings.tampilkan_waiting
              setSettings(s => ({ ...s, tampilkan_waiting: newVal }))
              save('tampilkan_waiting', newVal).then(ok => {
                if (!ok) setSettings(s => ({ ...s, tampilkan_waiting: !newVal })) // batalkan tampilan jika gagal
              })
            }}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.tampilkan_waiting ? 'bg-[rgb(var(--color-forest))]' : 'bg-[rgb(var(--color-border))]'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.tampilkan_waiting ? 'left-7' : 'left-1'
              }`}
            />
          </div>
          <span className="text-sm font-medium text-[rgb(var(--color-text))]">
            Tampilkan tombol Waiting List
          </span>
        </label>
      </section>
    </div>
  )
}
