'use client'

import { motion } from 'framer-motion'
import { Check, Sparkles, Image as ImageIcon } from 'lucide-react'
import type { BackgroundItem } from '@/types'

// Background style preset untuk fallback / styling ketika belum ada foto upload
const backgroundPresets: Record<
  string,
  {
    gradient: string
    textColor: string
    accentColor: string
    subtext: string
  }
> = {
  'Putih Bersih': {
    gradient: 'radial-gradient(circle at 50% 35%, #ffffff 0%, #f1f3f5 70%, #e2e6ea 100%)',
    textColor: '#1a1f1d',
    accentColor: '#94a3b8',
    subtext: 'Minimalis & Terang',
  },
  'Abu-abu Netral': {
    gradient: 'radial-gradient(circle at 50% 40%, #9ca3af 0%, #6b7280 65%, #4b5563 100%)',
    textColor: '#ffffff',
    accentColor: '#d1d5db',
    subtext: 'Profesional & Elegan',
  },
  'Krem Hangat': {
    gradient: 'radial-gradient(circle at 50% 35%, #fef3c7 0%, #fde68a 55%, #eed382 100%)',
    textColor: '#78350f',
    accentColor: '#b45309',
    subtext: 'Hangat & Estetis',
  },
  'Hijau Forest': {
    gradient: 'radial-gradient(circle at 50% 35%, #346b5a 0%, #264f43 60%, #16332b 100%)',
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    subtext: 'Signature Desara',
  },
  'Biru Muda': {
    gradient: 'radial-gradient(circle at 50% 35%, #e0f2fe 0%, #bae6fd 60%, #7dd3fc 100%)',
    textColor: '#0369a1',
    accentColor: '#38bdf8',
    subtext: 'Cerah & Segar',
  },
  'Pink Dusty': {
    gradient: 'radial-gradient(circle at 50% 35%, #ffe4e6 0%, #fecdd3 60%, #fda4af 100%)',
    textColor: '#9f1239',
    accentColor: '#fb7185',
    subtext: 'Lembut & Romantis',
  },
  'Hitam Elegan': {
    gradient: 'radial-gradient(circle at 50% 40%, #374151 0%, #1f2937 55%, #111827 100%)',
    textColor: '#ffffff',
    accentColor: '#fbbf24',
    subtext: 'Klasik & Berkarakter',
  },
  'Maroon': {
    gradient: 'radial-gradient(circle at 50% 35%, #991b1b 0%, #7f1d1d 60%, #450a0a 100%)',
    textColor: '#ffffff',
    accentColor: '#fca5a5',
    subtext: 'Mewah & Berani',
  },
  'Navy': {
    gradient: 'radial-gradient(circle at 50% 35%, #1e3a8a 0%, #172554 65%, #0f172a 100%)',
    textColor: '#ffffff',
    accentColor: '#93c5fd',
    subtext: 'Formal & Kontras',
  },
  'Sage Green': {
    gradient: 'radial-gradient(circle at 50% 35%, #d1e7dd 0%, #a3cfbb 60%, #75b798 100%)',
    textColor: '#144230',
    accentColor: '#479f76',
    subtext: 'Teduh & Modern',
  },
}

function getPreset(name: string) {
  if (backgroundPresets[name]) return backgroundPresets[name]
  return {
    gradient: 'linear-gradient(135deg, #e2e8f0 0%, #cbd5e1 50%, #94a3b8 100%)',
    textColor: '#1e293b',
    accentColor: '#64748b',
    subtext: 'Studio Backdrop',
  }
}

interface BackgroundSelectorProps {
  backgrounds: (string | BackgroundItem)[]
  selectedBg: string[]
  bgSlots: number
  onToggle: (bg: string) => void
  error?: string
}

export function BackgroundSelector({
  backgrounds,
  selectedBg,
  bgSlots,
  onToggle,
  error,
}: BackgroundSelectorProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-heading font-semibold text-[rgb(var(--color-text))]">
            Pilih Background Foto
          </label>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            Pilih tepat {bgSlots} warna latar untuk sesi fotomu
          </p>
        </div>
        <span
          className={`text-xs font-heading font-bold px-3 py-1 rounded-full border transition-colors ${
            selectedBg.length === bgSlots
              ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))]'
              : 'bg-[rgb(var(--color-blitz)/0.15)] text-[rgb(var(--color-forest))] border-[rgb(var(--color-blitz))]'
          }`}
        >
          {selectedBg.length} / {bgSlots} Dipilih
        </span>
      </div>

      {/* Grid kartu foto background */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {backgrounds.map((item, idx) => {
          const bgName = typeof item === 'string' ? item : item.nama
          const imageUrl = typeof item === 'string' ? null : item.image_url || null
          const isSelected = selectedBg.includes(bgName)
          const selectionOrder = selectedBg.indexOf(bgName) + 1
          const preset = getPreset(bgName)

          return (
            <motion.button
              key={`${bgName}-${idx}`}
              type="button"
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onToggle(bgName)}
              className={`
                group relative flex flex-col rounded-2xl overflow-hidden border-2 text-left
                transition-all duration-200 bg-[rgb(var(--color-surface))] shadow-sm
                ${
                  isSelected
                    ? 'border-[rgb(var(--color-forest))] ring-2 ring-[rgb(var(--color-forest)/0.25)] shadow-md'
                    : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.5)]'
                }
              `}
            >
              {/* Foto Contoh Hasil Studio */}
              <div
                className="relative w-full h-32 sm:h-36 flex items-center justify-center overflow-hidden bg-slate-100"
                style={imageUrl ? undefined : { background: preset.gradient }}
              >
                {imageUrl ? (
                  <>
                    <img
                      src={imageUrl}
                      alt={`Contoh hasil background ${bgName}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/10 pointer-events-none" />
                    <span className="absolute bottom-2 left-2 text-[10px] font-medium text-white/90 bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded-md flex items-center gap-1">
                      <ImageIcon className="w-3 h-3 text-[rgb(var(--color-blitz))]" />
                      Foto Asli Studio
                    </span>
                  </>
                ) : (
                  <>
                    {/* Lighting spotlight studio di dinding */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-white/10 pointer-events-none" />
                    {/* Lantai studio */}
                    <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-black/15 to-transparent" />
                    {/* Siluet subjek */}
                    <div className="relative z-10 flex flex-col items-center opacity-70 group-hover:opacity-90 transition-opacity">
                      <div
                        className="w-8 h-8 rounded-full border border-white/40 shadow-inner flex items-center justify-center backdrop-blur-[1px]"
                        style={{ background: 'rgba(255,255,255,0.18)' }}
                      >
                        <Sparkles className="w-4 h-4" style={{ color: preset.textColor }} />
                      </div>
                    </div>
                  </>
                )}

                {/* Badge urutan nomor terpilih */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-[rgb(var(--color-forest))] text-white flex items-center justify-center shadow-lg border-2 border-white z-20"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </motion.div>
                )}
              </div>

              {/* Info teks background */}
              <div className="p-3 flex flex-col justify-between flex-1 bg-[rgb(var(--color-surface))]">
                <div className="flex items-center justify-between gap-1 mb-0.5">
                  <p className="font-heading font-bold text-xs sm:text-sm text-[rgb(var(--color-text))] truncate">
                    {bgName}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-[rgb(var(--color-text-muted))] truncate">
                    {imageUrl ? 'Contoh Portofolio' : preset.subtext}
                  </span>
                  {isSelected && (
                    <span className="text-[10px] font-semibold text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.1)] px-1.5 py-0.5 rounded">
                      #{selectionOrder}
                    </span>
                  )}
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-500 mt-1 font-medium">{error}</p>}
    </div>
  )
}
