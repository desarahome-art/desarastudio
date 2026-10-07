'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { formatRupiah } from '@/lib/utils'
import {
  X,
  Sparkles,
  Clock,
  Users,
  Image as ImageIcon,
  Printer,
  ArrowRight,
  Tag,
  PlusCircle,
  HelpCircle,
} from 'lucide-react'
import type { Category, Package, Addon } from '@/types'

interface PricelistModalProps {
  categories: Category[]
  packages: Package[]
  addons: Addon[]
  addonCategories?: { addon_id: string; category_id: string }[]
  namaStudio: string
  onClose: () => void
  onSelectPackage?: (category: Category, pkg: Package) => void
  onStartBooking?: () => void
}

export function PricelistModal({
  categories,
  packages,
  addons,
  namaStudio,
  onClose,
  onSelectPackage,
  onStartBooking,
}: PricelistModalProps) {
  const activeCategories = categories
    .filter(c => c.aktif)
    .sort((a, b) => a.urutan - b.urutan)

  const [selectedCatId, setSelectedCatId] = useState<string>(
    activeCategories[0]?.id || 'all'
  )
  const [activeTab, setActiveTab] = useState<'packages' | 'addons'>('packages')

  // Filter paket berdasarkan kategori terpilih
  const displayPackages = (
    selectedCatId === 'all'
      ? packages.filter(p => p.aktif)
      : packages.filter(p => p.aktif && p.category_id === selectedCatId)
  ).sort((a, b) => a.urutan - b.urutan)

  // Addons aktif
  const sortedAddons = [...addons].sort((a, b) => a.urutan - b.urutan)

  const handleChoosePackage = (pkg: Package) => {
    const cat = categories.find(c => c.id === pkg.category_id)
    if (cat && onSelectPackage) {
      onSelectPackage(cat, pkg)
    } else if (onStartBooking) {
      onStartBooking()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.35, ease: [0.34, 1.2, 0.64, 1] }}
        className="w-full max-w-3xl bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-5 bg-[rgb(var(--color-forest))] text-white border-b-4 border-[rgb(var(--color-blitz))] shrink-0">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4 text-white" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[rgb(var(--color-blitz))] text-black flex items-center justify-center shadow-lg font-heading font-black">
              <Sparkles className="w-6 h-6 text-[rgb(var(--color-forest))]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-blitz))] bg-white/10 px-2 py-0.5 rounded-full">
                  Pricelist Resmi
                </span>
                <span className="text-[10px] text-white/70">
                  {namaStudio}
                </span>
              </div>
              <h2 className="font-heading font-bold text-xl sm:text-2xl text-white leading-tight mt-0.5">
                Daftar Paket & Harga Foto
              </h2>
            </div>
          </div>
          <p className="text-white/80 text-xs sm:text-sm mt-2.5 leading-relaxed">
            Pilih kategori dan paket foto sesuai kebutuhan sesi Anda. Transparan tanpa biaya tersembunyi.
          </p>

          {/* Toggle Tab: Paket Utama vs Add-ons */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-white/15">
            <button
              type="button"
              onClick={() => setActiveTab('packages')}
              className={`px-4 py-1.5 rounded-xl font-heading text-xs font-bold transition-all ${
                activeTab === 'packages'
                  ? 'bg-[rgb(var(--color-blitz))] text-[rgb(var(--color-forest))] shadow-sm'
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              Paket Foto ({packages.filter(p => p.aktif).length})
            </button>
            {sortedAddons.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('addons')}
                className={`px-4 py-1.5 rounded-xl font-heading text-xs font-bold transition-all ${
                  activeTab === 'addons'
                    ? 'bg-[rgb(var(--color-blitz))] text-[rgb(var(--color-forest))] shadow-sm'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                Layanan Tambahan / Add-ons ({sortedAddons.length})
              </button>
            )}
          </div>
        </div>

        {/* Category Pills (Hanya saat di Tab Paket) */}
        {activeTab === 'packages' && (
          <div className="px-5 py-3 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] overflow-x-auto flex items-center gap-2 shrink-0 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all border ${
                selectedCatId === 'all'
                  ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] shadow-xs'
                  : 'bg-[rgb(var(--color-cream-dark)/0.6)] text-[rgb(var(--color-text))] border-transparent hover:border-[rgb(var(--color-forest)/0.4)]'
              }`}
            >
              Semua Kategori
            </button>

            {activeCategories.map(cat => {
              const isSelected = selectedCatId === cat.id
              const pkgCount = packages.filter(p => p.aktif && p.category_id === cat.id).length
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-heading font-bold whitespace-nowrap transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? 'bg-[rgb(var(--color-forest))] text-white border-[rgb(var(--color-forest))] shadow-xs'
                      : 'bg-[rgb(var(--color-cream-dark)/0.6)] text-[rgb(var(--color-text))] border-transparent hover:border-[rgb(var(--color-forest)/0.4)]'
                  }`}
                >
                  <span>{cat.nama}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]'
                  }`}>
                    {pkgCount}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {activeTab === 'packages' ? (
              <motion.div
                key={selectedCatId}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                {displayPackages.length === 0 ? (
                  <div className="text-center py-12 px-4 bg-[rgb(var(--color-surface))] rounded-2xl border-2 border-dashed border-[rgb(var(--color-border))]">
                    <Tag className="w-10 h-10 text-[rgb(var(--color-text-muted))] mx-auto mb-2 opacity-40" />
                    <p className="font-heading font-bold text-base text-[rgb(var(--color-text))]">
                      Belum Ada Paket Aktif
                    </p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1 max-w-sm mx-auto">
                      Paket untuk kategori ini sedang dipersiapkan oleh studio.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {displayPackages.map(pkg => {
                      const cat = categories.find(c => c.id === pkg.category_id)
                      return (
                        <div
                          key={pkg.id}
                          className="flex flex-col justify-between rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 sm:p-5 shadow-xs hover:border-[rgb(var(--color-forest)/0.4)] transition-all"
                        >
                          <div>
                            {/* Header Paket */}
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div>
                                {cat && (
                                  <span className="text-[10px] font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] px-2 py-0.5 rounded-md mb-1 inline-block">
                                    {cat.nama}
                                  </span>
                                )}
                                <h3 className="font-heading font-bold text-lg text-[rgb(var(--color-text))]">
                                  {pkg.nama}
                                </h3>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="font-heading font-black text-xl text-[rgb(var(--color-forest))]">
                                  {formatRupiah(pkg.harga)}
                                </p>
                              </div>
                            </div>

                            {/* Benefit Grid */}
                            <div className="grid grid-cols-2 gap-2 my-3.5 text-xs text-[rgb(var(--color-text))] bg-[rgb(var(--color-cream)/0.6)] p-3 rounded-xl border border-[rgb(var(--color-border)/0.7)]">
                              <span className="flex items-center gap-1.5 font-medium">
                                <Clock className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                                Durasi {pkg.durasi_menit} mnt
                              </span>
                              <span className="flex items-center gap-1.5 font-medium">
                                <ImageIcon className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                                {pkg.jumlah_pilihan_background} background
                              </span>
                              <span className="flex items-center gap-1.5 font-medium">
                                <Users className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                                Maks. {pkg.maks_orang} orang
                              </span>
                              {pkg.cetak_ukuran ? (
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Printer className="w-3.5 h-3.5 text-[rgb(var(--color-forest))]" />
                                  Cetak {pkg.cetak_ukuran}
                                  {pkg.cetak_jumlah ? ` (${pkg.cetak_jumlah} lbr)` : ''}
                                </span>
                              ) : (
                                <span className="flex items-center gap-1.5 text-[rgb(var(--color-text-muted))]">
                                  <Printer className="w-3.5 h-3.5 opacity-40" />
                                  File Digital
                                </span>
                              )}
                            </div>

                            {/* Extra inclusions / Bonus */}
                            {pkg.bonus && (
                              <div className="space-y-1 text-xs text-[rgb(var(--color-text))] mb-4 px-1">
                                <div className="flex items-start gap-1.5 font-medium text-amber-900">
                                  <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                  <span>Bonus: {pkg.bonus}</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Action Button */}
                          <Button
                            size="sm"
                            onClick={() => handleChoosePackage(pkg)}
                            className="w-full mt-1 group"
                          >
                            Pilih Paket Ini
                            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            ) : (
              /* TAB ADDONS */
              <motion.div
                key="addons"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col gap-4"
              >
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Add-ons dapat ditambahkan langsung saat mengisi formulir booking setelah memilih paket utama Anda.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sortedAddons.map(addon => (
                    <div
                      key={addon.id}
                      className="p-4 rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] flex items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))] flex items-center justify-center shrink-0">
                          <PlusCircle className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-heading font-bold text-sm text-[rgb(var(--color-text))]">
                            {addon.nama}
                          </p>
                          <span className="text-[11px] text-[rgb(var(--color-text-muted))]">
                            {addon.satuan} {addon.ukuran ? `· ${addon.ukuran}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-heading font-bold text-sm text-[rgb(var(--color-forest))]">
                          +{formatRupiah(addon.harga)}
                        </p>
                        <span className="text-[10px] text-[rgb(var(--color-text-muted))]">
                          / {addon.satuan}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex items-center justify-between gap-3 shrink-0">
          <Button
            variant="ghost"
            size="md"
            onClick={onClose}
          >
            Tutup
          </Button>

          {onStartBooking && (
            <Button
              size="md"
              onClick={() => {
                onClose()
                onStartBooking()
              }}
              className="group"
            >
              Mulai Booking
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
