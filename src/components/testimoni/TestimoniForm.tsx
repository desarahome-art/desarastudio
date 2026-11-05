'use client'

import { useState, useTransition } from 'react'
import { Star, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'
import { kirimTestimoni } from '@/app/actions'
import { ISI_MAX, ISI_MIN, NAMA_MAX } from '@/lib/testimoni'

const LABEL_BINTANG = ['', 'Kurang puas', 'Cukup', 'Bagus', 'Sangat bagus', 'Luar biasa']

export function TestimoniForm({ daftarPaket }: { daftarPaket: string[] }) {
  const [nama, setNama] = useState('')
  const [paket, setPaket] = useState('')
  const [bintang, setBintang] = useState(0)
  const [hover, setHover] = useState(0)
  const [isi, setIsi] = useState('')
  const [website, setWebsite] = useState('') // honeypot, tidak terlihat
  const [galat, setGalat] = useState('')
  const [terkirim, setTerkirim] = useState(false)
  const [pending, startTransition] = useTransition()

  const kirim = (e: React.FormEvent) => {
    e.preventDefault()
    setGalat('')
    if (nama.trim().length < 2) return setGalat('Nama wajib diisi.')
    if (bintang < 1) return setGalat('Pilih penilaian bintang dulu.')
    if (isi.trim().length < ISI_MIN) return setGalat(`Testimoni minimal ${ISI_MIN} karakter.`)

    startTransition(async () => {
      const hasil = await kirimTestimoni({ nama, paket, bintang, isi, website })
      if (hasil.error) setGalat(hasil.error)
      else setTerkirim(true)
    })
  }

  if (terkirim) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-8 text-center">
        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-[rgb(var(--color-forest))]" aria-hidden="true" />
        <h1 className="font-heading text-xl font-bold">Terima kasih, {nama.trim().split(' ')[0]}</h1>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-2">
          Testimoni kamu sudah kami terima dan akan tampil setelah ditinjau tim Desara.
        </p>
      </div>
    )
  }

  const aktif = hover || bintang

  return (
    <form
      onSubmit={kirim}
      noValidate
      className="w-full max-w-md rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-6 sm:p-8 flex flex-col gap-5"
    >
      <div>
        <h1 className="font-heading text-2xl font-bold">Ceritakan pengalaman kamu</h1>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
          Testimoni kamu membantu kami berkembang. Isi tidak sampai satu menit.
        </p>
      </div>

      <Input
        label="Nama"
        placeholder="Nama kamu"
        value={nama}
        maxLength={NAMA_MAX}
        onChange={e => setNama(e.target.value)}
        autoComplete="given-name"
      />

      {daftarPaket.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium mb-1.5">Paket yang diambil (opsional)</legend>
          <div className="flex flex-wrap gap-2">
            {daftarPaket.map(p => (
              <button
                key={p}
                type="button"
                aria-pressed={paket === p}
                onClick={() => setPaket(paket === p ? '' : p)}
                className={cn(
                  'px-3.5 py-1.5 rounded-full border-2 text-sm transition-colors',
                  paket === p
                    ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))]'
                    : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest))]'
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend className="text-sm font-medium mb-1.5">Penilaian</legend>
        <div className="flex items-center gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map(n => (
            <button
              key={n}
              type="button"
              aria-label={`${n} bintang`}
              aria-pressed={bintang === n}
              onMouseEnter={() => setHover(n)}
              onClick={() => setBintang(n)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  'w-8 h-8 transition-colors',
                  n <= aktif ? 'fill-[rgb(var(--color-blitz))] text-[rgb(var(--color-blitz))]' : 'text-[rgb(var(--color-border))]'
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm text-[rgb(var(--color-text-muted))]" aria-live="polite">
            {LABEL_BINTANG[aktif]}
          </span>
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="isi-testimoni" className="text-sm font-medium">Testimoni</label>
        <textarea
          id="isi-testimoni"
          rows={4}
          maxLength={ISI_MAX}
          value={isi}
          onChange={e => setIsi(e.target.value)}
          placeholder="Fotografernya ramah dan hasilnya bagus banget"
          className="w-full rounded-xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] px-4 py-3 text-[rgb(var(--color-text))] placeholder:text-[rgb(var(--color-text-muted))] focus:outline-none focus:border-[rgb(var(--color-forest))] resize-none"
        />
        <p className="text-xs text-[rgb(var(--color-text-muted))] text-right">{isi.length}/{ISI_MAX}</p>
      </div>

      {/* Honeypot: manusia tidak melihat kolom ini, bot biasanya mengisinya */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label>
          Website
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
        </label>
      </div>

      {galat && (
        <p role="alert" className="text-sm text-red-600">{galat}</p>
      )}

      <Button type="submit" loading={pending} size="lg" className="w-full">
        Kirim testimoni
      </Button>
      <p className="text-xs text-[rgb(var(--color-text-muted))] text-center -mt-2">
        Testimoni tampil setelah disetujui admin.
      </p>
    </form>
  )
}
