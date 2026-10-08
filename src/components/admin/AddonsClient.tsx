'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatRupiah } from '@/lib/utils'
import { getMenitPerUnit, labelSatuanWaktu } from '@/lib/addon-calc'
import { Plus, Trash2, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Addon, Category, AddonJenis } from '@/types'

const jenisOptions: { value: AddonJenis; label: string }[] = [
  { value: 'waktu',      label: 'Waktu' },
  { value: 'background', label: 'Background' },
  { value: 'orang',      label: 'Orang' },
  { value: 'cetak',      label: 'Cetak' },
]

interface AddonsClientProps {
  initialAddons: Addon[]
  categories: Category[]
  initialAddonCategories: { addon_id: string; category_id: string }[]
}

export function AddonsClient({ initialAddons, categories, initialAddonCategories }: AddonsClientProps) {
  const supabase = createClient()
  const [addons, setAddons] = useState(initialAddons)
  const [addonCats, setAddonCats] = useState(initialAddonCategories)
  const [editAddon, setEditAddon] = useState<Addon | null>(null)
  const [showForm, setShowForm] = useState(false)

  const emptyForm = { jenis: 'waktu' as AddonJenis, nama: '', satuan: '+15 menit', harga: '', maks: '5', ukuran: '', menit_per_unit: '15' }
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState('')

  const pesanGagalSimpan = (msg?: string) =>
    msg && /menit_per_unit/i.test(msg)
      ? 'Gagal menyimpan: kolom "menit_per_unit" belum ada di database. Jalankan migrasi supabase/migrations/005_addon_lapangan_menit.sql di Supabase SQL Editor terlebih dahulu.'
      : `Gagal menyimpan add-on: ${msg || 'tidak ada respon dari database'}`

  const handleSave = async () => {
    setFormError('')
    if (!form.nama.trim()) {
      setFormError('Nama add-on wajib diisi.')
      return
    }

    let menit = 15
    if (form.jenis === 'waktu') {
      menit = parseInt(form.menit_per_unit, 10)
      if (isNaN(menit) || menit < 1) {
        setFormError('Menit per unit harus berupa angka bulat dan minimal 1 menit.')
        return
      }
    }

    const payload = {
      jenis: form.jenis,
      nama: form.nama.trim(),
      // Untuk add-on waktu, satuan selalu mengikuti angka menit_per_unit
      satuan: form.jenis === 'waktu' ? `+${menit} menit` : form.satuan.trim(),
      harga: parseInt(form.harga) || 0,
      maks: parseInt(form.maks) || 5,
      ukuran: form.ukuran?.trim() || null,
      menit_per_unit: form.jenis === 'waktu' ? menit : 15,
    }

    if (editAddon) {
      const { data, error } = await supabase.from('addons').update(payload).eq('id', editAddon.id).select().single()
      if (error || !data) {
        // Jangan tutup form: tampilkan alasan gagal simpan
        setFormError(pesanGagalSimpan(error?.message))
        return
      }
      setAddons(prev => prev.map(a => a.id === editAddon.id ? data : a))
    } else {
      const urutan = Math.max(0, ...addons.map(a => a.urutan)) + 1
      const { data, error } = await supabase.from('addons').insert({ ...payload, urutan }).select().single()
      if (error || !data) {
        setFormError(pesanGagalSimpan(error?.message))
        return
      }
      setAddons(prev => [...prev, data])
      // Aktifkan untuk semua kategori secara default
      const inserts = categories.map(c => ({ addon_id: data.id, category_id: c.id }))
      const { error: catError } = await supabase.from('addon_categories').insert(inserts)
      if (catError) {
        alert(`Add-on tersimpan, tetapi gagal mengaktifkan kategori: ${catError.message}`)
      } else {
        setAddonCats(prev => [...prev, ...inserts])
      }
    }
    setEditAddon(null)
    setShowForm(false)
    setForm(emptyForm)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus add-on ini?')) return
    const { error } = await supabase.from('addons').delete().eq('id', id)
    if (error) {
      alert(`Gagal menghapus add-on: ${error.message}`)
      return
    }
    setAddons(prev => prev.filter(a => a.id !== id))
    setAddonCats(prev => prev.filter(ac => ac.addon_id !== id))
  }

  const toggleCategory = async (addonId: string, catId: string) => {
    const exists = addonCats.some(ac => ac.addon_id === addonId && ac.category_id === catId)
    if (exists) {
      const { error } = await supabase.from('addon_categories')
        .delete()
        .eq('addon_id', addonId)
        .eq('category_id', catId)
      if (error) {
        alert(`Gagal menonaktifkan kategori: ${error.message}`)
        return
      }
      setAddonCats(prev => prev.filter(ac => !(ac.addon_id === addonId && ac.category_id === catId)))
    } else {
      const { error } = await supabase.from('addon_categories').insert({ addon_id: addonId, category_id: catId })
      if (error) {
        alert(`Gagal mengaktifkan kategori: ${error.message}`)
        return
      }
      setAddonCats(prev => [...prev, { addon_id: addonId, category_id: catId }])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setShowForm(true); setEditAddon(null); setForm(emptyForm); setFormError('') }}>
          <Plus className="w-4 h-4" /> Tambah Add-on
        </Button>
      </div>

      {/* Form */}
      {(showForm || editAddon) && (
        <div className="rounded-2xl border-2 border-[rgb(var(--color-forest)/0.3)] p-4 bg-[rgb(var(--color-forest)/0.04)]">
          <h3 className="font-heading font-semibold mb-3">{editAddon ? 'Edit Add-on' : 'Tambah Add-on'}</h3>
          {formError && (
            <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-xs font-medium border border-red-200">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Jenis</label>
              <select
                value={form.jenis}
                onChange={e => {
                  const j = e.target.value as AddonJenis
                  setForm(f => ({
                    ...f,
                    jenis: j,
                    satuan: j === 'waktu' ? `+${f.menit_per_unit || 15} menit` : f.satuan,
                  }))
                }}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
              >
                {jenisOptions.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
            <Input label="Nama" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
            
            {form.jenis === 'waktu' && (
              <Input
                label="Menit per unit *"
                type="number"
                min={1}
                value={form.menit_per_unit}
                onChange={e => {
                  const m = e.target.value
                  setForm(f => ({
                    ...f,
                    menit_per_unit: m,
                    satuan: m && Number(m) > 0 ? `+${m} menit` : f.satuan,
                  }))
                }}
                hint="Durasi tambahan waktu dalam satuan menit (minimal 1)"
              />
            )}

            <Input
              label="Satuan Tampilan"
              placeholder={form.jenis === 'waktu' ? '+15 menit' : '+1 orang'}
              value={form.satuan}
              onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))}
            />
            <Input label="Harga per satuan (Rp)" type="number" value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
            <Input label="Maks. penambahan" type="number" value={form.maks} onChange={e => setForm(f => ({ ...f, maks: e.target.value }))} />
            {form.jenis === 'cetak' && (
              <Input label="Ukuran cetak" placeholder="cth. 4R, 10R" value={form.ukuran} onChange={e => setForm(f => ({ ...f, ukuran: e.target.value }))} />
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleSave}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditAddon(null); setForm(emptyForm); setFormError('') }}>Batal</Button>
          </div>
        </div>
      )}

      {/* Addon list */}
      {addons.sort((a, b) => a.urutan - b.urutan).map(addon => {
        const activeCats = addonCats.filter(ac => ac.addon_id === addon.id).map(ac => ac.category_id)
        return (
          <div key={addon.id} className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p className="font-heading font-bold">{addon.nama}</p>
                <p className="text-xs text-[rgb(var(--color-text-muted))]">
                  {addon.jenis}
                  {addon.jenis === 'waktu' && ` (${getMenitPerUnit(addon)} mnt/unit)`} · {addon.jenis === 'waktu' ? labelSatuanWaktu(addon) : addon.satuan} · {formatRupiah(addon.harga)}/satuan · Maks {addon.maks}
                  {addon.ukuran && ` · ${addon.ukuran}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditAddon(addon)
                    setForm({
                      jenis: addon.jenis,
                      nama: addon.nama,
                      satuan: addon.satuan,
                      harga: String(addon.harga),
                      maks: String(addon.maks),
                      ukuran: addon.ukuran || '',
                      menit_per_unit: String(getMenitPerUnit({ ...addon, jenis: 'waktu' })),
                    })
                    setShowForm(false)
                    setFormError('')
                  }}
                  className="p-1.5 hover:text-[rgb(var(--color-forest))]"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(addon.id)} className="p-1.5 text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Category toggles */}
            <div>
              <p className="text-xs font-medium text-[rgb(var(--color-text-muted))] mb-2">Aktif untuk kategori:</p>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => {
                  const isActive = activeCats.includes(cat.id)
                  return (
                    <button
                      key={cat.id}
                      onClick={() => toggleCategory(addon.id, cat.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border-2 transition-all ${
                        isActive
                          ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))]'
                          : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                      }`}
                    >
                      {isActive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                      {cat.nama}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
