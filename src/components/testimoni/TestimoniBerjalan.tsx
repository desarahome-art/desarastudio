import { Star } from 'lucide-react'
import { susunBarisMarquee } from '@/lib/testimoni'
import { cn } from '@/lib/utils'

export interface TestimoniTampil {
  id: string
  nama: string
  paket: string | null
  bintang: number
  isi: string
}

function Kartu({ t, tersembunyi, kompak }: { t: TestimoniTampil; tersembunyi?: boolean; kompak?: boolean }) {
  return (
    <figure
      aria-hidden={tersembunyi || undefined}
      className={cn('marquee-kartu', tersembunyi && 'marquee-salinan', kompak ? 'w-60 sm:w-72 p-3 rounded-xl' : 'w-72 sm:w-80 p-5 rounded-2xl', 'shrink-0 border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))]')}
    >
      <div className="flex gap-0.5" role="img" aria-label={`${t.bintang} dari 5 bintang`}>
        {[1, 2, 3, 4, 5].map(n => (
          <Star
            key={n}
            className={cn(
              kompak ? 'w-3 h-3' : 'w-4 h-4',
              n <= t.bintang ? 'fill-[rgb(var(--color-blitz))] text-[rgb(var(--color-blitz))]' : 'text-[rgb(var(--color-border))]'
            )}
          />
        ))}
      </div>
      <blockquote className={cn('text-[rgb(var(--color-text))] break-words', kompak ? 'mt-1.5 text-xs leading-snug line-clamp-2' : 'mt-3 text-sm leading-relaxed')}>{t.isi}</blockquote>
      <figcaption className={kompak ? 'mt-1.5 flex items-baseline gap-1.5' : 'mt-4'}>
        <p className={cn('font-heading font-semibold', kompak ? 'text-xs' : 'text-sm')}>{t.nama}</p>
        {t.paket && <p className="text-[11px] text-[rgb(var(--color-text-muted))]">{kompak ? `· ${t.paket}` : `Paket ${t.paket}`}</p>}
      </figcaption>
    </figure>
  )
}

/** Dua baris kartu berlawanan arah. Isi tiap baris digandakan agar putarannya mulus. */
export function TestimoniBerjalan({
  items,
  kompak = false,
}: {
  items: TestimoniTampil[]
  /** Satu baris dengan kartu kecil, untuk bilah tetap di bawah layar */
  kompak?: boolean
}) {
  const baris = susunBarisMarquee(items, kompak ? 1 : 2, 6)

  return (
    <div className="flex flex-col gap-4" data-testid="testimoni-berjalan">
      {baris.map((isiBaris, i) => {
        // Kecepatan konstan: makin banyak kartu, makin lama satu putaran
        const durasi = Math.max(30, isiBaris.length * 7)
        return (
          <div
            key={i}
            className="marquee-baris overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]"
          >
            <div
              className={cn('marquee-track', i % 2 === 0 ? 'marquee-kiri' : 'marquee-kanan')}
              style={{ ['--marquee-durasi' as string]: `${durasi}s` }}
            >
              {isiBaris.map((t, k) => <Kartu key={`a-${t.id}-${k}`} t={t} kompak={kompak} />)}
              {isiBaris.map((t, k) => <Kartu key={`b-${t.id}-${k}`} t={t} kompak={kompak} tersembunyi />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
