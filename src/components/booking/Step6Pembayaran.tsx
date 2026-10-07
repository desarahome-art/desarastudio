'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { formatRupiah } from '@/lib/utils'
import { Copy, Check, MessageCircle, ArrowRight, Sparkles } from 'lucide-react'
import type { Package, Settings, BookingFormAddon } from '@/types'

interface Step6PembayaranProps {
  pkg: Package
  addons: BookingFormAddon[]
  totalHarga: number
  dpMinimal: number
  settings: Settings
  onNext: (dp: number) => void
  onBack: () => void
  loading?: boolean
}

export function Step6Pembayaran({
  pkg,
  addons,
  totalHarga,
  dpMinimal,
  settings,
  onNext,
  onBack,
  loading,
}: Step6PembayaranProps) {
  const [dp, setDp] = useState<string>(String(dpMinimal))
  const [copied, setCopied] = useState(false)
  const [dpError, setDpError] = useState('')

  const dpValue = parseInt(dp) || 0
  const sisa = totalHarga - dpValue

  const copyRekening = async () => {
    await navigator.clipboard.writeText(settings.rekening_bri)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSubmit = () => {
    if (dpValue < dpMinimal) {
      setDpError(`DP minimal ${formatRupiah(dpMinimal)}`)
      return
    }
    if (dpValue > totalHarga) {
      setDpError('DP tidak boleh melebihi total harga')
      return
    }
    onNext(dpValue)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.35 }}
      className="flex flex-col min-h-screen px-4 sm:px-6 py-10 max-w-lg mx-auto w-full"
    >
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-1 font-heading">
          Langkah 5 dari 6
        </p>
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-[rgb(var(--color-text))]">
          Pembayaran Down Payment (DP)
        </h2>
        <p className="text-sm text-[rgb(var(--color-text-muted))] mt-1">
          Kunci jadwal pemotretan Anda dengan melakukan pembayaran DP
        </p>
      </div>

      {/* Ringkasan Biaya */}
      <div className="rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] p-5 sm:p-6 mb-5 shadow-sm">
        <h3 className="font-heading font-bold text-base text-[rgb(var(--color-text))] mb-3.5 pb-2.5 border-b border-[rgb(var(--color-border))]">
          Rincian Biaya
        </h3>
        <div className="flex justify-between text-sm mb-2 text-[rgb(var(--color-text-muted))]">
          <span>Paket {pkg.nama}</span>
          <span className="font-semibold text-[rgb(var(--color-text))]">{formatRupiah(pkg.harga)}</span>
        </div>
        {addons.map(a => (
          <div key={a.addon.id} className="flex justify-between text-sm mb-2 text-[rgb(var(--color-text-muted))]">
            <span>{a.addon.nama} ({a.jumlah} {a.addon.satuan})</span>
            <span className="font-semibold text-[rgb(var(--color-text))]">{formatRupiah(a.addon.harga * a.jumlah)}</span>
          </div>
        ))}
        <div className="flex justify-between font-heading font-bold text-base mt-3 pt-3 border-t border-[rgb(var(--color-border))]">
          <span>Total Biaya</span>
          <span className="text-[rgb(var(--color-forest))] text-lg">{formatRupiah(totalHarga)}</span>
        </div>
        <div className="flex justify-between text-sm mt-2 pt-2 border-t border-dashed border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))]">
          <span>DP yang dibayarkan sekarang</span>
          <span className="font-semibold text-[rgb(var(--color-forest))]">{formatRupiah(dpValue)}</span>
        </div>
        <div className="flex justify-between text-sm font-medium mt-1.5 text-[rgb(var(--color-text))]">
          <span>Sisa pelunasan di studio</span>
          <span className="font-bold">{formatRupiah(Math.max(0, sisa))}</span>
        </div>
      </div>

      {/* Rekening Pembayaran BRI */}
      <div className="rounded-3xl bg-gradient-to-br from-[rgb(var(--color-forest)/0.08)] to-[rgb(var(--color-forest)/0.03)] border-2 border-[rgb(var(--color-forest)/0.25)] p-5 mb-5 shadow-sm">
        <p className="text-xs font-heading font-bold uppercase tracking-wider text-[rgb(var(--color-forest))] mb-1">
          Rekening Pembayaran Studio
        </p>
        <p className="text-xs text-[rgb(var(--color-text-muted))] mb-2">
          Transfer ke Bank BRI:
        </p>
        <div className="flex items-center justify-between bg-[rgb(var(--color-surface))] p-3.5 rounded-2xl border border-[rgb(var(--color-border))]">
          <div>
            <p className="font-heading font-black text-xl sm:text-2xl text-[rgb(var(--color-text))] tracking-wider">
              {settings.rekening_bri}
            </p>
            <p className="text-xs text-[rgb(var(--color-text-muted))] mt-0.5">
              a.n. <strong className="text-[rgb(var(--color-text))]">{settings.nama_rekening}</strong>
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={copyRekening}
            className="border border-[rgb(var(--color-forest)/0.2)] h-9 px-3 text-xs"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin' : 'Salin Rekening'}
          </Button>
        </div>
      </div>

      {/* Input Nominal DP */}
      <div className="rounded-3xl bg-[rgb(var(--color-surface))] border-2 border-[rgb(var(--color-border))] p-5 mb-5 shadow-sm">
        <Input
          label={`Nominal DP Ditransfer (Min. ${formatRupiah(dpMinimal)})`}
          type="number"
          min={dpMinimal}
          max={totalHarga}
          value={dp}
          onChange={e => { setDp(e.target.value); setDpError('') }}
          error={dpError}
          hint={`Minimal pembayaran DP adalah ${formatRupiah(dpMinimal)}`}
        />
      </div>

      {/* Keterangan Pengiriman Bukti Transfer via WhatsApp (MENGGANTIKAN FORM UPLOAD) */}
      <div className="rounded-3xl bg-emerald-50/90 border-2 border-emerald-300 p-5 mb-8 shadow-sm">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-sm">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-heading font-bold text-sm text-emerald-900 leading-tight">
              Bukti Transfer Dikirimkan via WhatsApp
            </h4>
            <p className="text-[11px] text-emerald-700">
              Tidak perlu upload file di website
            </p>
          </div>
        </div>

        <p className="text-xs text-emerald-800 leading-relaxed mt-2.5">
          Setelah Anda melakukan transfer DP ke rekening studio di atas, <strong>bukti pembayaran DP bisa langsung dikirimkan melalui WhatsApp ke Admin</strong> pada langkah selanjutnya.
        </p>

        <div className="mt-3 pt-2.5 border-t border-emerald-200/80 flex items-center gap-2 text-[11px] text-emerald-800 font-medium">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Simpan screenshot bukti transfer Anda, lalu kirimkan saat chat dengan Admin.</span>
        </div>
      </div>

      {/* Tombol Aksi */}
      <div className="flex gap-3 mt-auto">
        <Button variant="ghost" onClick={onBack} className="flex-1" disabled={loading}>
          Kembali
        </Button>
        <Button onClick={handleSubmit} className="flex-1 group shadow-md" loading={loading}>
          Saya Sudah Transfer
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </Button>
      </div>
    </motion.div>
  )
}
