'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Star, Check, EyeOff, Trash2, Undo2, ExternalLink, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ubahStatusTestimoni, hapusTestimoni } from '@/app/actions'
import type { StatusTestimoni } from '@/lib/testimoni'

export interface TestimoniAdmin {
  id: string
  nama: string
  paket: string | null
  bintang: number
  isi: string
  status: StatusTestimoni
  created_at: string
}

const TAB: { id: StatusTestimoni; label: string }[] = [
  { id: 'menunggu', label: 'Menunggu' },
  { id: 'disetujui', label: 'Tampil' },
  { id: 'disembunyikan', label: 'Disembunyikan' },
]

export function TestimoniAdminClient({ items }: { items: TestimoniAdmin[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<StatusTestimoni>('menunggu')
  const [galat, setGalat] = useState('')
  const [tersalin, setTersalin] = useState(false)
  const [pending, startTransition] = useTransition()

  const hitung = useMemo(() => {
    const h: Record<StatusTestimoni, number> = { menunggu: 0, disetujui: 0, disembunyikan: 0 }
    for (const t of items) h[t.status] += 1
    return h
  }, [items])
  const tampil = items.filter(t => t.status === tab)

  const jalankan = (aksi: () => Promise<{ error?: string }>) => {
    setGalat('')
    startTransition(async () => {
      const hasil = await aksi()
      if (hasil.error) setGalat(hasil.error)
      else router.refresh()
    })
  }

  const salinLink = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/testimoni`)
      setTersalin(true)
      setTimeout(() => setTersalin(false), 2000)
    } catch {
      setGalat('Link gagal disalin. Salin manual: /testimoni')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={salinLink} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-forest))]">
          <Copy className="w-4 h-4" /> {tersalin ? 'Link tersalin' : 'Salin link form'}
        </button>
        <a href="/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[rgb(var(--color-forest))]">
          <ExternalLink className="w-4 h-4" /> Lihat di halaman utama
        </a>
      </div>

      <div className="flex gap-2 flex-wrap" role="tablist">
        {TAB.map(t => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium border transition-colors',
              tab === t.id
                ? 'bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))] border-transparent'
                : 'bg-[rgb(var(--color-surface))] border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]'
            )}
          >
            {t.label} ({hitung[t.id]})
          </button>
        ))}
      </div>

      {galat && <p role="alert" className="text-sm text-red-600">{galat}</p>}

      {tampil.length === 0 ? (
        <p className="text-sm text-[rgb(var(--color-text-muted))] py-8 text-center">
          {tab === 'menunggu' ? 'Tidak ada testimoni yang menunggu persetujuan.' : 'Belum ada testimoni di sini.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {tampil.map(t => (
            <li key={t.id} className="rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-sm">
                    {t.nama}
                    {t.paket && <span className="font-normal text-[rgb(var(--color-text-muted))]"> · Paket {t.paket}</span>}
                  </p>
                  <div className="flex gap-0.5 mt-1" role="img" aria-label={`${t.bintang} dari 5 bintang`}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className={cn('w-3.5 h-3.5', n <= t.bintang ? 'fill-[rgb(var(--color-blitz))] text-[rgb(var(--color-blitz))]' : 'text-[rgb(var(--color-border))]')} />
                    ))}
                  </div>
                </div>
                <time className="text-[11px] text-[rgb(var(--color-text-muted))] shrink-0" dateTime={t.created_at}>
                  {new Date(t.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Pontianak' })}
                </time>
              </div>
              <p className="mt-2 text-sm leading-relaxed break-words">{t.isi}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {t.status !== 'disetujui' && (
                  <button disabled={pending} onClick={() => jalankan(() => ubahStatusTestimoni(t.id, 'disetujui'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))] disabled:opacity-50">
                    <Check className="w-3.5 h-3.5" /> Tampilkan
                  </button>
                )}
                {t.status === 'disetujui' && (
                  <button disabled={pending} onClick={() => jalankan(() => ubahStatusTestimoni(t.id, 'disembunyikan'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[rgb(var(--color-border))] disabled:opacity-50">
                    <EyeOff className="w-3.5 h-3.5" /> Sembunyikan
                  </button>
                )}
                {t.status === 'menunggu' && (
                  <button disabled={pending} onClick={() => jalankan(() => ubahStatusTestimoni(t.id, 'disembunyikan'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[rgb(var(--color-border))] disabled:opacity-50">
                    <EyeOff className="w-3.5 h-3.5" /> Tolak
                  </button>
                )}
                {t.status === 'disembunyikan' && (
                  <button disabled={pending} onClick={() => jalankan(() => ubahStatusTestimoni(t.id, 'menunggu'))} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[rgb(var(--color-border))] disabled:opacity-50">
                    <Undo2 className="w-3.5 h-3.5" /> Kembalikan ke menunggu
                  </button>
                )}
                <button
                  disabled={pending}
                  onClick={() => { if (window.confirm('Hapus testimoni ini secara permanen?')) jalankan(() => hapusTestimoni(t.id)) }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-700 border border-red-200 hover:bg-red-50 disabled:opacity-50 ml-auto"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
