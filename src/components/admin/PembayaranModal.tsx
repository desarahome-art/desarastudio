'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X, Wallet, Banknote, Landmark, PencilLine } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { formatRupiah, cn } from '@/lib/utils'
import { catatPembayaran, koreksiPembayaran, type MetodePembayaran } from '@/app/actions'
import type { Booking } from '@/types'

export type ModePembayaran = 'cicil' | 'lunasi' | 'koreksi'

interface PembayaranModalProps {
  booking: Booking
  mode: ModePembayaran
  onClose: () => void
  onSuccess: () => void
}

// "350.000" / "Rp 350.000" → 350000
function keAngka(teks: string): number {
  const digit = teks.replace(/[^0-9]/g, '')
  return digit ? Number(digit) : 0
}

function formatInput(n: number): string {
  return n > 0 ? new Intl.NumberFormat('id-ID').format(n) : ''
}

export function PembayaranModal({ booking, mode, onClose, onSuccess }: PembayaranModalProps) {
  const total = Number(booking.total_harga) || 0
  const sudah = Number(booking.dp_dibayar) || 0
  const sisa = Math.max(0, total - sudah)

  const [jumlahTeks, setJumlahTeks] = useState(() =>
    formatInput(mode === 'lunasi' ? sisa : mode === 'koreksi' ? sudah : 0)
  )
  const [metode, setMetode] = useState<MetodePembayaran>('transfer')
  const [catatan, setCatatan] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, loading])

  const jumlah = keAngka(jumlahTeks)
  const isKoreksi = mode === 'koreksi'

  // Pratinjau hasil
  const dibayarSetelah = isKoreksi ? jumlah : sudah + jumlah
  const sisaSetelah = total - dibayarSetelah
  const akanLunas = !isKoreksi && jumlah > 0 && sisaSetelah === 0

  let pesanValidasi = ''
  if (isKoreksi) {
    if (jumlah > total) pesanValidasi = `Tidak boleh melebihi total harga (${formatRupiah(total)}).`
    else if (jumlah === sudah) pesanValidasi = 'Nominal masih sama dengan sebelumnya.'
    else if (catatan.trim().length < 3) pesanValidasi = 'Isi alasan koreksi.'
  } else {
    if (jumlah <= 0) pesanValidasi = 'Isi jumlah pembayaran.'
    else if (jumlah > sisa) pesanValidasi = `Melebihi sisa pelunasan (${formatRupiah(sisa)}).`
  }

  const judul = isKoreksi ? 'Koreksi Pembayaran' : mode === 'lunasi' ? 'Pelunasan' : 'Catat Cicilan'

  const simpan = async () => {
    if (pesanValidasi) { setError(pesanValidasi); return }
    setLoading(true)
    setError('')
    try {
      const res = isKoreksi
        ? await koreksiPembayaran(booking.id, jumlah, catatan)
        : await catatPembayaran(booking.id, jumlah, metode, catatan)
      if (res.error) {
        setError(res.error)
        return
      }
      onSuccess()
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Terjadi kesalahan saat menyimpan pembayaran.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto"
      onClick={e => e.target === e.currentTarget && !loading && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pembayaran-judul"
        initial={{ y: 20, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-md bg-[rgb(var(--color-surface))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative px-5 py-4 bg-[rgb(var(--color-forest))] text-white shrink-0">
          <button
            onClick={onClose}
            disabled={loading}
            className="absolute top-3.5 right-3.5 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2.5 pr-10">
            {isKoreksi ? <PencilLine className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
            <div>
              <h2 id="pembayaran-judul" className="font-heading font-bold text-lg leading-tight">{judul}</h2>
              <p className="text-xs text-white/80">
                {booking.nama_klien} · <span className="font-mono">{booking.kode}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {/* Ringkasan saat ini */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Total', nilai: total, kelas: 'text-[rgb(var(--color-text))]' },
              { label: 'Sudah Dibayar', nilai: sudah, kelas: 'text-emerald-700' },
              { label: 'Sisa', nilai: total - sudah, kelas: total - sudah > 0 ? 'text-rose-700' : 'text-emerald-700' },
            ].map(r => (
              <div key={r.label} className="rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream-dark)/0.25)] px-2 py-2">
                <p className="text-[10px] text-[rgb(var(--color-text-muted))]">{r.label}</p>
                <p className={cn('font-heading font-bold text-xs sm:text-sm', r.kelas)}>{formatRupiah(r.nilai)}</p>
              </div>
            ))}
          </div>

          {/* Nominal */}
          <div>
            <label htmlFor="nominal-bayar" className="text-xs font-semibold text-[rgb(var(--color-text))]">
              {isKoreksi ? 'Total yang benar-benar sudah dibayar' : 'Jumlah dibayar sekarang'}
            </label>
            <div className="mt-1.5 flex items-center rounded-xl border-2 border-[rgb(var(--color-border))] focus-within:border-[rgb(var(--color-forest))] bg-[rgb(var(--color-surface))] px-3">
              <span className="text-sm text-[rgb(var(--color-text-muted))] font-medium">Rp</span>
              <input
                id="nominal-bayar"
                inputMode="numeric"
                autoFocus
                value={jumlahTeks}
                onChange={e => { setJumlahTeks(formatInput(keAngka(e.target.value))); setError('') }}
                placeholder="0"
                className="flex-1 bg-transparent py-2.5 pl-2 text-base font-heading font-bold outline-none"
              />
            </div>
            {!isKoreksi && sisa > 0 && (
              <div className="mt-2 flex gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => { setJumlahTeks(formatInput(sisa)); setError('') }}
                  className="text-[11px] font-semibold px-2.5 py-1 rounded-full border border-[rgb(var(--color-forest)/0.4)] text-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.06)] hover:bg-[rgb(var(--color-forest)/0.12)]"
                >
                  Lunasi semua ({formatRupiah(sisa)})
                </button>
                {sisa >= 2000 && (
                  <button
                    type="button"
                    onClick={() => { setJumlahTeks(formatInput(Math.round(sisa / 2 / 1000) * 1000)); setError('') }}
                    className="text-[11px] font-medium px-2.5 py-1 rounded-full border border-[rgb(var(--color-border))] hover:border-[rgb(var(--color-forest)/0.4)]"
                  >
                    Setengah sisa
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Metode */}
          {!isKoreksi && (
            <div>
              <p className="text-xs font-semibold text-[rgb(var(--color-text))] mb-1.5">Metode</p>
              <div className="grid grid-cols-2 gap-2">
                {([
                  { v: 'transfer', label: 'Transfer', Icon: Landmark },
                  { v: 'tunai', label: 'Tunai', Icon: Banknote },
                ] as const).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setMetode(v)}
                    aria-pressed={metode === v}
                    className={cn(
                      'flex items-center justify-center gap-2 rounded-xl border-2 py-2.5 text-sm font-semibold transition-colors',
                      metode === v
                        ? 'border-[rgb(var(--color-forest))] bg-[rgb(var(--color-forest)/0.08)] text-[rgb(var(--color-forest))]'
                        : 'border-[rgb(var(--color-border))] text-[rgb(var(--color-text-muted))] hover:border-[rgb(var(--color-forest)/0.4)]'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Catatan / alasan */}
          <div>
            <label htmlFor="catatan-bayar" className="text-xs font-semibold text-[rgb(var(--color-text))]">
              {isKoreksi ? 'Alasan koreksi (wajib)' : 'Catatan (opsional)'}
            </label>
            <input
              id="catatan-bayar"
              value={catatan}
              maxLength={200}
              onChange={e => { setCatatan(e.target.value); setError('') }}
              placeholder={isKoreksi ? 'cth. salah input nominal cicilan' : 'cth. transfer BNI a.n. Anisa'}
              className="mt-1.5 w-full rounded-xl border-2 border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-forest))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm outline-none"
            />
          </div>

          {/* Pratinjau */}
          {jumlah > 0 && !pesanValidasi && (
            <div
              className={cn(
                'rounded-xl px-3 py-2.5 text-xs border',
                akanLunas || sisaSetelah === 0
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              )}
            >
              Setelah disimpan: dibayar <strong>{formatRupiah(dibayarSetelah)}</strong>
              {sisaSetelah > 0
                ? <> · sisa <strong>{formatRupiah(sisaSetelah)}</strong></>
                : <> · <strong>LUNAS</strong></>}
            </div>
          )}

          {/* Pesan validasi langsung tampil (tombol Simpan nonaktif selama masih ada masalah) */}
          {(error || (jumlahTeks && pesanValidasi && !(isKoreksi && jumlah === sudah))) && (
            <p role="alert" className="text-xs font-medium text-rose-600">{error || pesanValidasi}</p>
          )}
        </div>

        <div className="shrink-0 px-5 py-3.5 border-t border-[rgb(var(--color-border))] flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading} className="flex-1">
            Batal
          </Button>
          <Button type="button" size="sm" onClick={simpan} loading={loading} disabled={Boolean(pesanValidasi)} className="flex-[2]">
            {isKoreksi ? 'Simpan Koreksi' : akanLunas ? 'Simpan · Lunas' : 'Simpan Pembayaran'}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  )
}
