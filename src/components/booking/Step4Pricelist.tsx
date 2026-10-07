'use client'

import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Check, Clock, Users, Image as ImageIcon, Printer } from 'lucide-react'
import { formatRupiah } from '@/lib/utils'
import type { Package } from '@/types'

interface Step4PricelistProps {
  packages: Package[]
  selected: Package | null
  onSelect: (pkg: Package) => void
  onNext: () => void
  onBack: () => void
  categoryNama: string
  onWaitingList?: () => void
}

export function Step4Pricelist({
  packages,
  selected,
  onSelect,
  onNext,
  onBack,
  categoryNama,
  onWaitingList,
}: Step4PricelistProps) {
  const activePackages = packages.filter(p => p.aktif).sort((a, b) => a.urutan - b.urutan)

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col min-h-[70vh] px-6 py-12 max-w-lg mx-auto w-full"
    >
      <p className="text-sm font-medium text-[rgb(var(--color-text-muted))] mb-2 font-heading">
        Langkah 3 dari 6
      </p>
      <h2 className="font-heading text-2xl sm:text-3xl font-bold mb-1">
        Pilih paket
      </h2>
      <p className="text-[rgb(var(--color-text-muted))] text-sm mb-8">
        Kategori: <span className="font-medium text-[rgb(var(--color-text))]">{categoryNama}</span>
      </p>

      {activePackages.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-[rgb(var(--color-border))] p-8 text-center bg-[rgb(var(--color-surface))] mb-8 shadow-sm">
          <div className="w-14 h-14 rounded-2xl bg-[rgb(var(--color-blitz)/0.2)] text-[rgb(var(--color-forest))] flex items-center justify-center mx-auto mb-4 border border-[rgb(var(--color-blitz)/0.4)]">
            <Clock className="w-7 h-7 text-[rgb(var(--color-forest))]" />
          </div>
          <p className="font-heading font-bold text-xl mb-1.5 text-[rgb(var(--color-text))]">
            Paket Belum Tersedia
          </p>
          <p className="text-xs sm:text-sm text-[rgb(var(--color-text-muted))] max-w-sm mx-auto mb-6 leading-relaxed">
            Admin belum membuka paket untuk kategori <strong className="text-[rgb(var(--color-forest))]">{categoryNama}</strong>. Daftar waiting list agar kamu mendapatkan giliran pertama saat slot dibuka!
          </p>
          {onWaitingList && (
            <Button variant="primary" size="md" onClick={onWaitingList} className="w-full sm:w-auto">
              Daftar Waiting List Kategori Ini
            </Button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 mb-8">
          {activePackages.map((pkg, i) => (
            <motion.button
              key={pkg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              onClick={() => onSelect(pkg)}
              className={`
                relative flex flex-col w-full px-5 py-4 rounded-2xl border-2 text-left
                transition-all duration-150
                ${selected?.id === pkg.id
                  ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.06)]'
                  : 'border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.4)] bg-[rgb(var(--color-surface))]'
                }
              `}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-heading font-bold text-lg">{pkg.nama}</p>
                  <p className="font-heading text-2xl font-bold text-[rgb(var(--color-forest))]">
                    {formatRupiah(pkg.harga)}
                  </p>
                </div>
                {selected?.id === pkg.id && (
                  <div className="w-6 h-6 rounded-full bg-[rgb(var(--color-forest))] flex items-center justify-center mt-1">
                    <Check className="w-4 h-4 text-white" />
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="grid grid-cols-2 gap-2 text-sm text-[rgb(var(--color-text-muted))]">
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {pkg.durasi_menit} menit
                </span>
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5" />
                  {pkg.jumlah_pilihan_background} background
                </span>
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  Maks. {pkg.maks_orang} orang
                </span>
                {pkg.cetak_ukuran && (
                  <span className="flex items-center gap-1.5">
                    <Printer className="w-3.5 h-3.5" />
                    Cetak {pkg.cetak_ukuran}
                    {pkg.cetak_jumlah ? ` (${pkg.cetak_jumlah} lbr)` : ''}
                  </span>
                )}
              </div>

              {/* Extras */}
              {(pkg.jumlah_foto_edit || pkg.bonus) && (
                <div className="mt-3 pt-3 border-t border-[rgb(var(--color-border))] text-xs text-[rgb(var(--color-text-muted))]">
                  {pkg.jumlah_foto_edit && (
                    <p>✓ {pkg.jumlah_foto_edit} foto edit</p>
                  )}
                  {pkg.bonus && <p>✓ {pkg.bonus}</p>}
                </div>
              )}
            </motion.button>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" onClick={onBack} className="flex-1">
          Kembali
        </Button>
        <Button onClick={onNext} className="flex-1" disabled={!selected}>
          Pilih Paket Ini
        </Button>
      </div>
    </motion.div>
  )
}
