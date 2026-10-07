'use client'

import { useState, useTransition } from 'react'
import { createWisudaEvent, updateWisudaEvent, deleteWisudaEvent } from '@/app/actions'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { WisudaEvent } from '@/types'

interface WisudaEventManagerProps {
  events: WisudaEvent[]
}

export function WisudaEventManager({ events }: WisudaEventManagerProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  // Add form state
  const [showAdd, setShowAdd] = useState(false)
  const [addNama, setAddNama] = useState('')
  const [addKampus, setAddKampus] = useState('')
  const [addKeterangan, setAddKeterangan] = useState('')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState('')

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editNama, setEditNama] = useState('')
  const [editKampus, setEditKampus] = useState('')
  const [editKeterangan, setEditKeterangan] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 4000)
  }

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!addNama.trim() || !addKampus.trim()) {
      setAddError('Nama acara dan kampus wajib diisi.')
      return
    }
    setAddLoading(true)
    setAddError('')
    const res = await createWisudaEvent({
      nama: addNama,
      kampus: addKampus,
      keterangan: addKeterangan || undefined,
    })
    setAddLoading(false)
    if (res.error) {
      setAddError(res.error)
    } else {
      setAddNama('')
      setAddKampus('')
      setAddKeterangan('')
      setShowAdd(false)
      showFeedback('success', 'Acara wisuda berhasil ditambahkan.')
      router.refresh()
    }
  }

  const startEdit = (event: WisudaEvent) => {
    setEditingId(event.id)
    setEditNama(event.nama)
    setEditKampus(event.kampus)
    setEditKeterangan(event.keterangan || '')
  }

  const handleEdit = async (id: string) => {
    setEditLoading(true)
    const res = await updateWisudaEvent(id, {
      nama: editNama,
      kampus: editKampus,
      keterangan: editKeterangan || null,
    })
    setEditLoading(false)
    if (res.error) {
      showFeedback('error', res.error)
    } else {
      setEditingId(null)
      showFeedback('success', 'Acara wisuda berhasil diperbarui.')
      router.refresh()
    }
  }

  const handleToggleAktif = (event: WisudaEvent) => {
    startTransition(async () => {
      const res = await updateWisudaEvent(event.id, { aktif: !event.aktif })
      if (res.error) {
        showFeedback('error', res.error)
      } else {
        showFeedback('success', `Acara ${event.aktif ? 'dinonaktifkan' : 'diaktifkan'}.`)
        router.refresh()
      }
    })
  }

  const handleDelete = async (event: WisudaEvent) => {
    const confirmed = window.confirm(
      `Hapus acara "${event.nama}"?\n\nPerhatian: Data waiting list yang terhubung ke acara ini tidak akan ikut terhapus.`
    )
    if (!confirmed) return
    setDeletingId(event.id)
    const res = await deleteWisudaEvent(event.id)
    setDeletingId(null)
    if (res.error) {
      showFeedback('error', res.error)
    } else {
      showFeedback('success', `Acara "${event.nama}" berhasil dihapus.`)
      router.refresh()
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-[rgb(var(--color-forest))]" />
          <h2 className="font-heading font-bold text-base text-[rgb(var(--color-text))]">
            Manajemen Acara Wisuda
          </h2>
          <span className="text-xs bg-[rgb(var(--color-forest)/0.1)] text-[rgb(var(--color-forest))] font-semibold px-2 py-0.5 rounded-full">
            {events.filter(e => e.aktif).length} aktif
          </span>
        </div>
        <Button
          size="sm"
          onClick={() => { setShowAdd(!showAdd); setAddError('') }}
          variant={showAdd ? 'ghost' : 'primary'}
        >
          {showAdd ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAdd ? 'Batal' : 'Tambah Acara'}
        </Button>
      </div>

      {/* Feedback banner */}
      {feedback && (
        <div className={`rounded-2xl p-3.5 flex items-center gap-2.5 text-sm font-medium border-2 ${
          feedback.type === 'success'
            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
            : 'bg-red-50 border-red-300 text-red-900'
        }`}>
          {feedback.type === 'success'
            ? <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            : <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <form
          onSubmit={handleAdd}
          className="rounded-3xl border-2 border-[rgb(var(--color-forest)/0.3)] bg-[rgb(var(--color-forest)/0.03)] p-4 sm:p-5 flex flex-col gap-3"
        >
          <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))]">
            Tambah Acara Wisuda Baru
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Input
              label="Nama Acara *"
              placeholder="cth. Wisuda UNTAN Oktober 2026"
              value={addNama}
              onChange={e => setAddNama(e.target.value)}
            />
            <Input
              label="Kampus / Instansi *"
              placeholder="cth. Universitas Tanjungpura"
              value={addKampus}
              onChange={e => setAddKampus(e.target.value)}
            />
          </div>
          <Input
            label="Keterangan (opsional)"
            placeholder="cth. Gelombang 1, Semester Gasal 2026"
            value={addKeterangan}
            onChange={e => setAddKeterangan(e.target.value)}
          />
          {addError && (
            <p className="text-xs text-red-500 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" /> {addError}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowAdd(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" loading={addLoading}>
              <Plus className="w-3.5 h-3.5" />
              Simpan Acara
            </Button>
          </div>
        </form>
      )}

      {/* Events list */}
      {events.length === 0 ? (
        <div className="text-center py-10 rounded-3xl border-2 border-dashed border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]">
          <GraduationCap className="w-8 h-8 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-30" />
          <p className="font-heading font-semibold text-sm text-[rgb(var(--color-text-muted))]">
            Belum ada acara wisuda
          </p>
          <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">
            Tambahkan acara wisuda agar client dapat mendaftar waiting list
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {events.map(event => (
            <div
              key={event.id}
              className={`rounded-2xl border-2 p-4 transition-all ${
                event.aktif
                  ? 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]'
                  : 'border-[rgb(var(--color-border)/0.5)] bg-[rgb(var(--color-surface)/0.5)] opacity-60'
              }`}
            >
              {editingId === event.id ? (
                /* Edit inline */
                <div className="flex flex-col gap-3">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Input
                      label="Nama Acara *"
                      value={editNama}
                      onChange={e => setEditNama(e.target.value)}
                    />
                    <Input
                      label="Kampus *"
                      value={editKampus}
                      onChange={e => setEditKampus(e.target.value)}
                    />
                  </div>
                  <Input
                    label="Keterangan (opsional)"
                    value={editKeterangan}
                    onChange={e => setEditKeterangan(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      <X className="w-3.5 h-3.5" /> Batal
                    </Button>
                    <Button size="sm" loading={editLoading} onClick={() => handleEdit(event.id)}>
                      <Check className="w-3.5 h-3.5" /> Simpan
                    </Button>
                  </div>
                </div>
              ) : (
                /* Display */
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      event.aktif ? 'bg-[rgb(var(--color-forest)/0.1)]' : 'bg-gray-100'
                    }`}>
                      <GraduationCap className={`w-4.5 h-4.5 ${event.aktif ? 'text-[rgb(var(--color-forest))]' : 'text-gray-400'}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-heading font-bold text-sm text-[rgb(var(--color-text))] leading-tight">
                        {event.nama}
                      </p>
                      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">{event.kampus}</p>
                      {event.keterangan && (
                        <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5 italic">{event.keterangan}</p>
                      )}
                      <p className="text-[10px] text-[rgb(var(--color-text-muted))] mt-1">
                        Dibuat: {new Date(event.created_at).toLocaleDateString('id-ID', {
                          day: 'numeric', month: 'short', year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Toggle aktif */}
                    <button
                      type="button"
                      title={event.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                      onClick={() => handleToggleAktif(event)}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-cream-dark))] transition-colors"
                    >
                      {event.aktif
                        ? <ToggleRight className="w-5 h-5 text-[rgb(var(--color-forest))]" />
                        : <ToggleLeft className="w-5 h-5 text-[rgb(var(--color-text-muted))]" />
                      }
                    </button>

                    {/* Edit */}
                    <button
                      type="button"
                      title="Edit"
                      onClick={() => startEdit(event)}
                      className="p-1.5 rounded-lg hover:bg-[rgb(var(--color-cream-dark))] transition-colors"
                    >
                      <Pencil className="w-4 h-4 text-[rgb(var(--color-text-muted))]" />
                    </button>

                    {/* Delete */}
                    <button
                      type="button"
                      title="Hapus"
                      onClick={() => handleDelete(event)}
                      disabled={deletingId === event.id}
                      className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
