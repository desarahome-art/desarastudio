'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatRupiah } from '@/lib/utils'
import { Plus, Pencil, Trash2, ChevronDown, ChevronUp, ToggleLeft, ToggleRight } from 'lucide-react'
import type { Category, Package } from '@/types'

interface PackageFormData {
  nama: string
  harga: string
  durasi_menit: string
  jumlah_pilihan_background: string
  maks_orang: string
  cetak_ukuran: string
  cetak_jumlah: string
  jumlah_foto_edit: string
  bonus: string
}

const emptyForm: PackageFormData = {
  nama: '', harga: '', durasi_menit: '60',
  jumlah_pilihan_background: '2', maks_orang: '4',
  cetak_ukuran: '', cetak_jumlah: '',
  jumlah_foto_edit: '', bonus: '',
}

interface PackagesClientProps {
  initialCategories: Category[]
  initialPackages: Package[]
}

export function PackagesClient({ initialCategories, initialPackages }: PackagesClientProps) {
  const supabase = createClient()
  const [categories, setCategories] = useState(initialCategories)
  const [packages, setPackages] = useState(initialPackages)
  const [expandedCat, setExpandedCat] = useState<string | null>(null)

  // Category CRUD
  const [newCatName, setNewCatName] = useState('')

  // Package form
  const [pkgForm, setPkgForm] = useState<PackageFormData>(emptyForm)
  const [editPkg, setEditPkg] = useState<Package | null>(null)
  const [addingToCat, setAddingToCat] = useState<string | null>(null)

  const addCategory = async () => {
    if (!newCatName.trim()) return
    const slug = newCatName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    const maxUrutan = Math.max(0, ...categories.map(c => c.urutan)) + 1
    const { data } = await supabase
      .from('categories')
      .insert({ nama: newCatName.trim(), slug, urutan: maxUrutan })
      .select()
      .single()
    if (data) {
      setCategories(prev => [...prev, data])
      setNewCatName('')
    }
  }

  const toggleCatAktif = async (cat: Category) => {
    await supabase.from('categories').update({ aktif: !cat.aktif }).eq('id', cat.id)
    setCategories(prev => prev.map(c => c.id === cat.id ? { ...c, aktif: !c.aktif } : c))
  }

  const deleteCat = async (id: string) => {
    if (!confirm('Hapus kategori ini? Semua paket di dalamnya juga terhapus.')) return
    await supabase.from('categories').delete().eq('id', id)
    setCategories(prev => prev.filter(c => c.id !== id))
    setPackages(prev => prev.filter(p => p.category_id !== id))
  }

  const savePackage = async () => {
    const catId = editPkg?.category_id || addingToCat
    if (!catId) return
    const payload = {
      category_id: catId,
      nama: pkgForm.nama,
      harga: parseInt(pkgForm.harga) || 0,
      durasi_menit: parseInt(pkgForm.durasi_menit) || 60,
      jumlah_pilihan_background: parseInt(pkgForm.jumlah_pilihan_background) || 1,
      maks_orang: parseInt(pkgForm.maks_orang) || 1,
      cetak_ukuran: pkgForm.cetak_ukuran || null,
      cetak_jumlah: pkgForm.cetak_jumlah ? parseInt(pkgForm.cetak_jumlah) : null,
      jumlah_foto_edit: pkgForm.jumlah_foto_edit ? parseInt(pkgForm.jumlah_foto_edit) : null,
      bonus: pkgForm.bonus || null,
    }

    if (editPkg) {
      const { data } = await supabase.from('packages').update(payload).eq('id', editPkg.id).select().single()
      if (data) setPackages(prev => prev.map(p => p.id === editPkg.id ? data : p))
    } else {
      const maxUrutan = Math.max(0, ...packages.filter(p => p.category_id === catId).map(p => p.urutan)) + 1
      const { data } = await supabase.from('packages').insert({ ...payload, urutan: maxUrutan }).select().single()
      if (data) setPackages(prev => [...prev, data])
    }
    setEditPkg(null)
    setAddingToCat(null)
    setPkgForm(emptyForm)
  }

  const deletePkg = async (id: string) => {
    if (!confirm('Hapus paket ini?')) return
    await supabase.from('packages').delete().eq('id', id)
    setPackages(prev => prev.filter(p => p.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add category */}
      <div className="flex gap-2">
        <input
          type="text"
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          placeholder="Nama kategori baru"
          onKeyDown={e => e.key === 'Enter' && addCategory()}
          className="flex-1 px-4 py-2.5 rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] text-sm focus:outline-none focus:border-[rgb(var(--color-forest))]"
        />
        <Button size="sm" onClick={addCategory}>
          <Plus className="w-4 h-4" /> Tambah Kategori
        </Button>
      </div>

      {/* Category list */}
      {categories.sort((a, b) => a.urutan - b.urutan).map(cat => {
        const catPkgs = packages.filter(p => p.category_id === cat.id)
        const isExpanded = expandedCat === cat.id

        return (
          <div key={cat.id} className="rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] overflow-hidden">
            {/* Category header */}
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => setExpandedCat(isExpanded ? null : cat.id)} className="flex-1 flex items-center gap-3 text-left">
                <span className="font-heading font-bold">{cat.nama}</span>
                <span className="text-xs text-[rgb(var(--color-text-muted))]">{catPkgs.length} paket</span>
                {!cat.aktif && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">Nonaktif</span>}
              </button>
              <button onClick={() => toggleCatAktif(cat)} className="p-1" title={cat.aktif ? 'Nonaktifkan' : 'Aktifkan'}>
                {cat.aktif ? <ToggleRight className="w-5 h-5 text-[rgb(var(--color-forest))]" /> : <ToggleLeft className="w-5 h-5 text-[rgb(var(--color-text-muted))]" />}
              </button>
              <button onClick={() => deleteCat(cat.id)} className="p-1 text-red-400 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
              <button onClick={() => setExpandedCat(isExpanded ? null : cat.id)}>
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-[rgb(var(--color-border))] p-4">
                {/* Package list */}
                <div className="flex flex-col gap-2 mb-4">
                  {catPkgs.sort((a, b) => a.urutan - b.urutan).map(pkg => (
                    <div key={pkg.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgb(var(--color-cream-dark)/0.5)] text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{pkg.nama}</p>
                        <p className="text-xs text-[rgb(var(--color-text-muted))]">
                          {formatRupiah(pkg.harga)} · {pkg.durasi_menit} mnt · {pkg.jumlah_pilihan_background} bg · Maks {pkg.maks_orang} org
                          {pkg.cetak_ukuran && ` · Cetak ${pkg.cetak_ukuran}`}
                        </p>
                      </div>
                      <button onClick={() => { setEditPkg(pkg); setPkgForm({ nama: pkg.nama, harga: String(pkg.harga), durasi_menit: String(pkg.durasi_menit), jumlah_pilihan_background: String(pkg.jumlah_pilihan_background), maks_orang: String(pkg.maks_orang), cetak_ukuran: pkg.cetak_ukuran || '', cetak_jumlah: pkg.cetak_jumlah ? String(pkg.cetak_jumlah) : '', jumlah_foto_edit: pkg.jumlah_foto_edit ? String(pkg.jumlah_foto_edit) : '', bonus: pkg.bonus || '' }) }} className="p-1 hover:text-[rgb(var(--color-forest))]">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deletePkg(pkg.id)} className="p-1 text-red-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Package form */}
                {(addingToCat === cat.id || editPkg?.category_id === cat.id) ? (
                  <div className="rounded-xl border-2 border-[rgb(var(--color-forest)/0.3)] p-4 bg-[rgb(var(--color-forest)/0.04)]">
                    <h4 className="font-heading font-semibold text-sm mb-3">
                      {editPkg ? 'Edit Paket' : 'Tambah Paket'}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input label="Nama paket" value={pkgForm.nama} onChange={e => setPkgForm(p => ({ ...p, nama: e.target.value }))} />
                      <Input label="Harga (Rp)" type="number" value={pkgForm.harga} onChange={e => setPkgForm(p => ({ ...p, harga: e.target.value }))} />
                      <Input label="Durasi (menit)" type="number" value={pkgForm.durasi_menit} onChange={e => setPkgForm(p => ({ ...p, durasi_menit: e.target.value }))} />
                      <Input label="Jumlah background" type="number" value={pkgForm.jumlah_pilihan_background} onChange={e => setPkgForm(p => ({ ...p, jumlah_pilihan_background: e.target.value }))} />
                      <Input label="Maks. orang" type="number" value={pkgForm.maks_orang} onChange={e => setPkgForm(p => ({ ...p, maks_orang: e.target.value }))} />
                      <Input label="Ukuran cetak (opsional)" placeholder="cth. 12R" value={pkgForm.cetak_ukuran} onChange={e => setPkgForm(p => ({ ...p, cetak_ukuran: e.target.value }))} />
                      <Input label="Jumlah cetak" type="number" value={pkgForm.cetak_jumlah} onChange={e => setPkgForm(p => ({ ...p, cetak_jumlah: e.target.value }))} />
                      <Input label="Jumlah foto edit" type="number" value={pkgForm.jumlah_foto_edit} onChange={e => setPkgForm(p => ({ ...p, jumlah_foto_edit: e.target.value }))} />
                      <div className="sm:col-span-2">
                        <Input label="Bonus (opsional)" value={pkgForm.bonus} onChange={e => setPkgForm(p => ({ ...p, bonus: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" onClick={savePackage}>Simpan</Button>
                      <Button size="sm" variant="ghost" onClick={() => { setEditPkg(null); setAddingToCat(null); setPkgForm(emptyForm) }}>Batal</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => setAddingToCat(cat.id)}>
                    <Plus className="w-4 h-4" /> Tambah Paket
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
