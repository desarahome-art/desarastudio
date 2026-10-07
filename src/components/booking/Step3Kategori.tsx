'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Check } from 'lucide-react'
import type { Category } from '@/types'

interface Step3KategoriProps {
  categories: Category[]
  selected: Category | null
  onSelect: (cat: Category) => void
  onNext: () => void
  onBack: () => void
}

export function Step3Kategori({
  categories,
  selected,
  onSelect,
  onNext,
  onBack,
}: Step3KategoriProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col justify-center min-h-[70vh] px-6 py-12 max-w-sm mx-auto w-full"
    >
      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-2 font-heading">
        Langkah 2 dari 6
      </p>
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-2">
        Pilih kategori foto
      </h2>
      <p className="text-[rgb(var(--color-text-muted))] text-sm mb-8">
        Jenis sesi yang kamu inginkan
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {categories
          .filter(c => c.aktif)
          .sort((a, b) => a.urutan - b.urutan)
          .map((cat, i) => (
            <motion.button
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => onSelect(cat)}
              className={`
                flex items-center justify-between w-full px-5 py-4 rounded-2xl border-2
                font-heading font-semibold text-left transition-all duration-150
                ${selected?.id === cat.id
                  ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))]'
                  : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.5)]'
                }
              `}
            >
              {cat.nama}
              {selected?.id === cat.id && (
                <Check className="w-5 h-5 text-[rgb(var(--color-forest))]" />
              )}
            </motion.button>
          ))}
      </div>

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Kembali
        </Button>
        <Button
          onClick={onNext}
          className="flex-1"
          disabled={!selected}
        >
          Lanjut
        </Button>
      </div>
    </motion.div>
  )
}
