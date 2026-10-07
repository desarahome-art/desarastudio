'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ArrowRight } from 'lucide-react'

interface Step2NamaProps {
  defaultValue: string
  onNext: (nama: string) => void
  onBack: () => void
}

export function Step2Nama({ defaultValue, onNext, onBack }: Step2NamaProps) {
  const [nama, setNama] = useState(defaultValue)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim()) {
      setError('Masukkan nama kamu')
      return
    }
    onNext(nama.trim())
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col justify-center min-h-[70vh] px-6 py-12 max-w-sm mx-auto w-full"
    >
      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-2 font-heading">
        Langkah 1 dari 6
      </p>
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-8">
        Siapa namamu?
      </h2>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input
          label="Nama lengkap"
          placeholder="cth. Anisa Ramadhani"
          value={nama}
          onChange={e => { setNama(e.target.value); setError('') }}
          error={error}
          autoFocus
          autoComplete="name"
        />

        <div className="flex gap-3">
          <Button type="button" variant="ghost" onClick={onBack} className="flex-1">
            Kembali
          </Button>
          <Button type="submit" className="flex-1 group">
            Lanjut
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </form>
    </motion.div>
  )
}
