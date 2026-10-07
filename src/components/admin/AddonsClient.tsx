'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatRupiah } from '@/lib/utils'
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

  const emptyForm = { jenis: 'waktu' as AddonJenis, nama: '', satuan: '', harga: '', maks: '5', ukuran: '' }
  const [form, setForm] = useState(emptyForm)

  const handleSave = async () => {
    const payload = {
      jenis: form.jenis,
      nama: form.nama,
      satuan: form.satuan,
      harga: parseInt(form.harga) || 0,
      maks: parseInt(form.maks) || 5,
      ukuran: form.ukuran || null,
    }

    if (editAddon) {
      const { data } = await supabase.from('addons').update(payload).eq('id', editAddon.id).select().single()
      if (data) setAddons(prev => prev.map(a => a.id === editAddon.id ? data : a))
    } else {
      const urutan = Math.max(0, ...addons.map(a => a.urutan)) + 1
      const { data } = await supabase.from('addons').insert({ ...payload, urutan }).select().single()
      if (data) {
        setAddons(prev => [...prev, data])
        // Aktifkan untuk semua kategori secara default
        const inserts = categories.map(c => ({ addon_id: data.id, category_id: c.id }))
        await supabase.from('addon_categories').insert(inserts)
        setAddonCats(prev => [...prev, ...inserts])
      }
    }
    setEditAddon(null)
    setShowForm(false)
    setForm(emptyForm)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus add-on ini?')) return
    await supabase.from('addons').delete().eq('id', id)
    setAddons(prev => prev.filter(a => a.id !== id))
    setAddonCats(prev => prev.filter(ac => ac.addon_id !== id))
  }

  const toggleCategory = async (addonId: string, catId: string) => {
    const exists = addonCats.some(ac => ac.addon_id === addonId && ac.category_id === catId)
    if (exists) {
      await supabase.from('addon_categories')
        .delete()
        .eq('addon_id', addonId)
        .eq('category_id', catId)
      setAddonCats(prev => prev.filter(ac => !(ac.addon_id === addonId && ac.category_id === catId)))
    } else {
      await supabase.from('addon_categories').insert({ addon_id: addonId, category_id: catId })
      setAddonCats(prev => [...prev, { addon_id: addonId, category_id: catId }])
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setShowForm(true); setEditAddon(null); setForm(emptyForm) }}>
          <Plus className="w-4 h-4" /> Tambah Add-on
        </Button>
      </div>

      {/* Form */}
      {(showForm || editAddon) && (
        <div className="rounded-2xl border-2 border-[rgb(var(--color-forest)/0.3)] p-4 bg-[rgb(var(--color-forest)/0.04)]">
          <h3 className="font-heading font-semibold mb-3">{editAddon ? 'Edit Add-on' : 'Tambah Add-on'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Jenis</label>
              <select
                value={form.jenis}
                onChange={e => setForm(f => ({ ...f, jenis: e.target.value as AddonJenis }))}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
              >
                {jenisOptions.map(j => <option key={j.value} value={j.value}>{j.label}</option>)}
              </select>
            </div>
            <Input label="Nama" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
            <Input label="Satuan (cth. +15 menit)" value={form.satuan} onChange={e => setForm(f => ({ ...f, satuan: e.target.value }))} />
            <Input label="Harga per satuan (Rp)" type="number" value={form.harga} onChange={e => setForm(f => ({ ...f, harga: e.target.value }))} />
            <Input label="Maks. penambahan" type="number" value={form.maks} onChange={e => setForm(f => ({ ...f, maks: e.target.value }))} />
            {form.jenis === 'cetak' && (
              <Input label="Ukuran cetak" placeholder="cth. 4R, 10R" value={form.ukuran} onChange={e => setForm(f => ({ ...f, ukuran: e.target.value }))} />
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={handleSave}>Simpan</Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setEditAddon(null) }}>Batal</Button>
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
                  {addon.jenis} · {addon.satuan} · {formatRupiah(addon.harga)}/satuan · Maks {addon.maks}
                  {addon.ukuran && ` · ${addon.ukuran}`}
                </p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    setEditAddon(addon)
                    setForm({ jenis: addon.jenis, nama: addon.nama, satuan: addon.satuan, harga: String(addon.harga), maks: String(addon.maks), ukuran: addon.ukuran || '' })
                    setShowForm(false)
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
