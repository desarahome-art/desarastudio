'use client'

import { useState, useRef } from 'react'
import { updateSetting, uploadBackgroundImage } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Save, Plus, X, Check, Upload, Trash2, Image as ImageIcon } from 'lucide-react'
import type { Settings, BackgroundItem } from '@/types'

interface SettingsClientProps {
  settings: Settings
}

export function SettingsClient({ settings: initialSettings }: SettingsClientProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  // Background states
  const [newBgName, setNewBgName] = useState('')
  const [uploadingBgIdx, setUploadingBgIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetBgIdx, setTargetBgIdx] = useState<number | null>(null)

  const normalizedBackgrounds: BackgroundItem[] = (settings.backgrounds || []).map(bg => {
    if (typeof bg === 'string') {
      return { nama: bg, image_url: undefined }
    }
    return bg
  })

  const save = async (key: string, value: unknown) => {
    setSaving(key)
    await updateSetting(key, value)
    setSaving(null)
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
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
                label="Nomor Rekening BRI"
                value={settings.rekening_bri || ''}
                onChange={e => setSettings(s => ({ ...s, rekening_bri: e.target.value }))}
              />
            </div>
            <SaveButton field="rekening_bri" />
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
              Unggah foto contoh asli hasil foto studio untuk setiap warna background agar klien melihat hasil nyata.
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
              save('tampilkan_waiting', newVal)
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
