'use client'

import Image from 'next/image'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Clock, ArrowRight, Sparkles } from 'lucide-react'
import type { Settings } from '@/types'

interface Step1WelcomeProps {
  settings: Settings
  onNext: () => void
  onWaitingList: () => void
  onPricelist: () => void
}

export function Step1Welcome({ settings, onNext, onWaitingList, onPricelist }: Step1WelcomeProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col items-center justify-center min-h-[70vh] px-6 py-12 text-center"
    >
      {/* Logo / Avatar */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative mb-8"
      >
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl overflow-hidden bg-white flex items-center justify-center shadow-xl border-2 border-[rgb(var(--color-forest)/0.15)] p-3">
          <Image
            src="/logo.png"
            alt={settings.nama_studio || 'Desara Home Studio'}
            width={128}
            height={128}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        {/* Decorative ring */}
        <div className="absolute -inset-3 rounded-[2rem] border-2 border-[rgb(var(--color-blitz)/0.4)] animate-pulse pointer-events-none" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="font-heading text-3xl sm:text-4xl font-bold text-[rgb(var(--color-text))] mb-3"
      >
        {settings.nama_studio}
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-[rgb(var(--color-text-muted))] text-base max-w-xs mb-2"
      >
        {settings.teks_sambutan}
      </motion.p>

      {/* Jam operasional */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
        className="flex items-center gap-2 text-sm text-[rgb(var(--color-text-muted))] mb-8"
      >
        <Clock className="w-4 h-4" />
        <span>
          Buka {settings.jam_buka} – {settings.jam_tutup}
        </span>
      </motion.div>

      {/* CTA Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <Button
          onClick={onNext}
          size="lg"
          className="w-full group shadow-md"
        >
          Mulai Booking
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </Button>

        <Button
          onClick={onPricelist}
          variant="secondary"
          size="lg"
          className="w-full border-2 border-[rgb(var(--color-forest)/0.25)] flex items-center justify-center gap-2"
        >
          <Sparkles className="w-4 h-4 text-[rgb(var(--color-forest))]" />
          Lihat Pricelist
        </Button>

        {settings.tampilkan_waiting && (
          <Button
            onClick={onWaitingList}
            variant="ghost"
            size="md"
            className="w-full text-xs text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))]"
          >
            Antrean / Waiting List
          </Button>
        )}
      </motion.div>
    </motion.div>
  )
}
