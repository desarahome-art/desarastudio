'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Download, Printer, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn, formatRupiah } from '@/lib/utils'
import { tambahPengeluaran, hapusPengeluaran } from '@/app/actions'
import {
  hitungLaporan,
  rentangBulan,
  bulanSebelumnya,
  selisihPersen,
  buatCsv,
  KATEGORI_PENGELUARAN,
  NAMA_BIAYA_CETAK,
  type BookingLaporan,
  type PengeluaranLaporan,
  type Laporan,
  type BarisRekap,
} from '@/lib/laporan'

type Tab = 'harian' | 'bulanan' | 'pengeluaran'

const NAMA_BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']
const NAMA_HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

function geserHari(t: string, n: number): string {
  const [y, m, d] = t.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}
function geserBulan(b: string, n: number): string {
  const [y, m] = b.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1 + n, 1))
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`
}
function labelTanggal(t: string): string {
  const [y, m, d] = t.split('-').map(Number)
  const hari = NAMA_HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
  return `${hari}, ${d} ${NAMA_BULAN[m - 1]} ${y}`
}
function labelBulan(b: string): string {
  const [y, m] = b.split('-').map(Number)
  return `${NAMA_BULAN[m - 1]} ${y}`
}
function keAngka(teks: string): number {
  const digit = teks.replace(/[^0-9]/g, '')
  return digit ? Number(digit) : 0
}
function unduh(nama: string, isi: string) {
  const url = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = nama
  a.click()
  URL.revokeObjectURL(url)
}

const kartu = 'rounded-2xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] p-4 mb-4 print:break-inside-avoid'
const inputCls = 'mt-1 w-full rounded-xl border-2 border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-forest))] bg-[rgb(var(--color-surface))] px-3 py-2 text-sm outline-none'

function Metrik({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <div className="rounded-xl bg-[rgb(var(--color-cream-dark)/0.45)] px-3.5 py-3">
      <p className="text-xs text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className={cn('font-heading font-semibold text-lg sm:text-xl mt-0.5', warna)}>{nilai}</p>
      {sub && <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">{sub}</p>}
    </div>
  )
}

function Ringkasan({ l }: { l: Laporan }) {
  return (
    <div className={kartu}>
      <h3 className="font-heading font-semibold text-sm mb-2">Ringkasan</h3>
      <Baris kiri="Pendapatan booking selesai" kanan={formatRupiah(l.pendapatan)} />
      <Baris kiri={<>Biaya cetak <span className="text-xs text-[rgb(var(--color-text-muted))]">otomatis</span></>} kanan={`-${formatRupiah(l.biayaCetak)}`} warna="text-rose-700" />
      <Baris kiri="Pengeluaran manual" kanan={`-${formatRupiah(l.pengeluaranManual)}`} warna="text-rose-700" />
      <Baris kiri="Laba bersih" kanan={formatRupiah(l.laba)} tebal warna={l.laba >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
    </div>
  )
}

function Baris({ kiri, kanan, tebal, warna }: { kiri: React.ReactNode; kanan: string; tebal?: boolean; warna?: string }) {
  return (
    <div className={cn('flex items-center justify-between gap-3 py-2 border-t first:border-t-0 border-[rgb(var(--color-border)/0.6)] text-sm', tebal && 'font-semibold')}>
      <span>{kiri}</span>
      <span className={cn('text-right', warna)}>{kanan}</span>
    </div>
  )
}

function Rekap({ judul, data, total, warna = 'bg-[rgb(var(--color-forest))]' }: { judul: string; data: { nama: string; sesi?: number; nilai: number }[]; total: number; warna?: string }) {
  return (
    <div className={kartu}>
      <h3 className="font-heading font-semibold text-sm mb-2">{judul}</h3>
      {data.length === 0 && <p className="text-sm text-[rgb(var(--color-text-muted))]">Belum ada data.</p>}
      {data.map(d => (
        <div key={d.nama} className="py-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span>{d.nama}{d.sesi != null && <span className="text-xs text-[rgb(var(--color-text-muted))]"> · {d.sesi} sesi</span>}</span>
            <span>{formatRupiah(d.nilai)}</span>
          </div>
          <div className="h-1.5 rounded bg-[rgb(var(--color-cream-dark))] mt-1">
            <div className={cn('h-1.5 rounded', warna)} style={{ width: `${total > 0 ? Math.max(2, Math.round((d.nilai / total) * 100)) : 0}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

const keRekap = (r: BarisRekap[]) => r.map(x => ({ nama: x.nama, sesi: x.sesi, nilai: x.pendapatan }))

export function LaporanClient({
  bookings,
  pengeluaran,
  hariIni,
}: {
  bookings: BookingLaporan[]
  pengeluaran: PengeluaranLaporan[]
  hariIni: string
}) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('harian')
  const [hari, setHari] = useState(hariIni)
  const [bulan, setBulan] = useState(hariIni.slice(0, 7))

  const harian = useMemo(() => hitungLaporan(bookings, pengeluaran, hari, hari), [bookings, pengeluaran, hari])
  const { dari, sampai } = rentangBulan(bulan)
  const bulanan = useMemo(() => hitungLaporan(bookings, pengeluaran, dari, sampai), [bookings, pengeluaran, dari, sampai])
  const lalu = useMemo(() => {
    const r = rentangBulan(bulanSebelumnya(bulan))
    return hitungLaporan(bookings, pengeluaran, r.dari, r.sampai)
  }, [bookings, pengeluaran, bulan])
  const delta = selisihPersen(bulanan.pendapatan, lalu.pendapatan)

  // booking yang statusnya belum selesai pada hari dipilih tidak diambil dari server; info ini hanya penjelasan
  const maksHari = Math.max(0, ...bulanan.perHari.map(h => h.pendapatan))

  // ---- form pengeluaran ----
  const [fTanggal, setFTanggal] = useState(hariIni)
  const [fKategori, setFKategori] = useState<string>(KATEGORI_PENGELUARAN[0])
  const [fKet, setFKet] = useState('')
  const [fJumlah, setFJumlah] = useState('')
  const [pesan, setPesan] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)
  const [menghapus, setMenghapus] = useState<string | null>(null)

  const { dari: bDari, sampai: bSampai } = rentangBulan(bulan)
  const daftarPeng = useMemo(
    () => pengeluaran.filter(p => p.tanggal >= bDari && p.tanggal <= bSampai).sort((a, b) => b.tanggal.localeCompare(a.tanggal)),
    [pengeluaran, bDari, bSampai]
  )
  const totalPeng = daftarPeng.reduce((s, p) => s + p.jumlah, 0)

  const simpan = async () => {
    const jumlah = keAngka(fJumlah)
    if (!fTanggal) return setPesan('Isi tanggal pengeluaran.')
    if (!fKet.trim()) return setPesan('Isi keterangan pengeluaran.')
    if (jumlah <= 0) return setPesan('Isi jumlah lebih dari nol.')
    setMenyimpan(true)
    setPesan('')
    const res = await tambahPengeluaran({ tanggal: fTanggal, kategori: fKategori, keterangan: fKet, jumlah })
    setMenyimpan(false)
    if (res.error) return setPesan(res.error)
    setFKet('')
    setFJumlah('')
    router.refresh()
  }

  const hapus = async (id: string) => {
    if (!window.confirm('Hapus pengeluaran ini?')) return
    setMenghapus(id)
    const res = await hapusPengeluaran(id)
    setMenghapus(null)
    if (res.error) return setPesan(res.error)
    router.refresh()
  }

  const Alat = ({ l, judul, berkas }: { l: Laporan; judul: string; berkas: string }) => (
    <div className="flex gap-2 justify-end mb-3 print:hidden">
      <Button variant="secondary" size="sm" onClick={() => unduh(berkas, buatCsv(l, judul))}>
        <Download className="w-4 h-4" /> Download CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer className="w-4 h-4" /> Cetak / PDF
      </Button>
    </div>
  )

  return (
    <div className="max-w-3xl">
      <div className="flex gap-1 p-1 rounded-xl bg-[rgb(var(--color-cream-dark)/0.6)] mb-4 print:hidden" role="tablist">
        {([['harian', 'Harian'], ['bulanan', 'Bulanan'], ['pengeluaran', 'Pengeluaran']] as [Tab, string][]).map(([k, n]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === k ? 'bg-[rgb(var(--color-surface))] shadow-sm text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-muted))]'
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {tab === 'harian' && (
        <>
          <div className="flex items-center gap-2 mb-3 print:hidden">
            <button onClick={() => setHari(geserHari(hari, -1))} aria-label="Hari sebelumnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronLeft className="w-4 h-4" /></button>
            <input type="date" value={hari} onChange={e => e.target.value && setHari(e.target.value)} className={cn(inputCls, 'mt-0 flex-1 text-center')} aria-label="Pilih tanggal" />
            <button onClick={() => setHari(geserHari(hari, 1))} aria-label="Hari berikutnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronRight className="w-4 h-4" /></button>
            {hari !== hariIni && <button onClick={() => setHari(hariIni)} className="text-xs underline text-[rgb(var(--color-forest))]">Hari ini</button>}
          </div>
          <p className="font-heading font-semibold mb-3">{labelTanggal(hari)}</p>
          <Alat l={harian} judul={`Laporan harian ${hari}`} berkas={`laporan-harian-${hari}.csv`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <Metrik label="Pendapatan" nilai={formatRupiah(harian.pendapatan)} sub={`${harian.sesi.length} sesi selesai`} />
            <Metrik label="Pengeluaran" nilai={formatRupiah(harian.totalPengeluaran)} sub="cetak + manual" />
            <Metrik label="Laba bersih" nilai={formatRupiah(harian.laba)} sub={`${harian.margin}% margin`} warna={harian.laba >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <Metrik label="Rata-rata per sesi" nilai={formatRupiah(harian.rataRata)} />
          </div>
          {harian.sesi.length === 0 && daftarKosong()}
          <Ringkasan l={harian} />
          {harian.sesi.length > 0 && (
            <div className={kartu}>
              <h3 className="font-heading font-semibold text-sm mb-2">Sesi selesai</h3>
              {harian.sesi.map(s => (
                <div key={s.id} className="flex justify-between gap-3 py-2 border-t first:border-t-0 border-[rgb(var(--color-border)/0.6)] text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{s.jam} · {s.nama}</p>
                    <p className="text-xs text-[rgb(var(--color-text-muted))] truncate">{s.paket} · {s.kategori}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p>{formatRupiah(s.harga)}</p>
                    {s.cetak > 0 && <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">cetak {formatRupiah(s.cetak)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {harian.pengeluaran.length > 0 && (
            <div className={kartu}>
              <h3 className="font-heading font-semibold text-sm mb-2">Pengeluaran manual hari ini</h3>
              {harian.pengeluaran.map(p => (
                <Baris key={p.id} kiri={<>{p.keterangan} <span className="text-xs text-[rgb(var(--color-text-muted))]">· {p.kategori}</span></>} kanan={formatRupiah(p.jumlah)} />
              ))}
            </div>
          )}
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Booking baru dihitung setelah statusnya Selesai, pada tanggal sesi foto.</p>
        </>
      )}

      {tab === 'bulanan' && (
        <>
          <div className="flex items-center gap-2 mb-3 print:hidden">
            <button onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} className={cn(inputCls, 'mt-0 flex-1 text-center')} aria-label="Pilih bulan" />
            <button onClick={() => setBulan(geserBulan(bulan, 1))} aria-label="Bulan berikutnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronRight className="w-4 h-4" /></button>
          </div>
          <p className="font-heading font-semibold mb-3">{labelBulan(bulan)}</p>
          <Alat l={bulanan} judul={`Laporan bulanan ${bulan}`} berkas={`laporan-bulanan-${bulan}.csv`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <Metrik label="Pendapatan" nilai={formatRupiah(bulanan.pendapatan)} sub={`${bulanan.sesi.length} sesi selesai`} />
            <Metrik label="Pengeluaran" nilai={formatRupiah(bulanan.totalPengeluaran)} sub="cetak + manual" />
            <Metrik label="Laba bersih" nilai={formatRupiah(bulanan.laba)} sub={`${bulanan.margin}% margin`} warna={bulanan.laba >= 0 ? 'text-emerald-700' : 'text-rose-700'} />
            <Metrik
              label="Vs bulan lalu"
              nilai={delta === null ? '-' : `${delta >= 0 ? '+' : ''}${delta}%`}
              sub={`${labelBulan(bulanSebelumnya(bulan))}: ${formatRupiah(lalu.pendapatan)}`}
              warna={delta === null ? undefined : delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}
            />
          </div>
          {bulanan.sesi.length === 0 && daftarKosong()}
          <Ringkasan l={bulanan} />
          {bulanan.perHari.length > 0 && (
            <div className={kartu}>
              <h3 className="font-heading font-semibold text-sm mb-1">Pendapatan per hari</h3>
              <div className="flex items-end gap-[3px] h-28">
                {bulanan.perHari.map(h => (
                  <div
                    key={h.tanggal}
                    title={`${labelTanggal(h.tanggal)}: ${formatRupiah(h.pendapatan)} (${h.sesi} sesi)`}
                    className={cn('flex-1 rounded-t bg-[rgb(var(--color-forest))] min-w-[3px]', h.tanggal === bulanan.hariTersibuk ? 'opacity-100' : 'opacity-40')}
                    style={{ height: `${maksHari > 0 ? Math.max(2, Math.round((h.pendapatan / maksHari) * 100)) : 2}%` }}
                  />
                ))}
              </div>
              <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-2">
                Hari tersibuk: {bulanan.hariTersibuk ? `${labelTanggal(bulanan.hariTersibuk)} (${formatRupiah(maksHari)})` : '-'}. Arahkan kursor ke batang untuk detail.
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-[rgb(var(--color-text-muted))]"><th className="py-1 font-medium">Tanggal</th><th className="font-medium text-right">Sesi</th><th className="font-medium text-right">Pendapatan</th><th className="font-medium text-right">Pengeluaran</th></tr></thead>
                  <tbody>
                    {bulanan.perHari.map(h => (
                      <tr key={h.tanggal} className="border-t border-[rgb(var(--color-border)/0.6)]">
                        <td className="py-1">{labelTanggal(h.tanggal)}</td>
                        <td className="text-right">{h.sesi}</td>
                        <td className="text-right">{formatRupiah(h.pendapatan)}</td>
                        <td className="text-right">{formatRupiah(h.pengeluaran)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Rekap judul="Pendapatan per kategori" data={keRekap(bulanan.perKategori)} total={bulanan.pendapatan} />
          <Rekap judul="Paket terlaris" data={keRekap(bulanan.perPaket).slice(0, 6)} total={bulanan.pendapatan} />
          <Rekap
            judul="Pengeluaran per kategori"
            data={bulanan.pengeluaranPerKategori.map(x => ({ nama: x.nama, nilai: x.jumlah }))}
            total={bulanan.totalPengeluaran}
            warna="bg-orange-500"
          />
        </>
      )}

      {tab === 'pengeluaran' && (
        <>
          <div className={kartu}>
            <h3 className="font-heading font-semibold text-sm mb-2">Catat pengeluaran</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="p-tgl" className="text-xs font-semibold">Tanggal</label>
                <input id="p-tgl" type="date" value={fTanggal} onChange={e => { setFTanggal(e.target.value); setPesan('') }} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-kat" className="text-xs font-semibold">Kategori</label>
                <select id="p-kat" value={fKategori} onChange={e => setFKategori(e.target.value)} className={inputCls}>
                  {KATEGORI_PENGELUARAN.map(k => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="p-ket" className="text-xs font-semibold">Keterangan</label>
                <input id="p-ket" value={fKet} maxLength={200} placeholder="Beli lampu LED" onChange={e => { setFKet(e.target.value); setPesan('') }} className={inputCls} />
              </div>
              <div>
                <label htmlFor="p-jml" className="text-xs font-semibold">Jumlah (Rp)</label>
                <input
                  id="p-jml"
                  inputMode="numeric"
                  value={fJumlah}
                  placeholder="150.000"
                  onChange={e => { const n = keAngka(e.target.value); setFJumlah(n ? n.toLocaleString('id-ID') : ''); setPesan('') }}
                  className={inputCls}
                />
              </div>
            </div>
            {pesan && <p role="alert" className="text-sm text-rose-700 mt-3">{pesan}</p>}
            <div className="mt-3">
              <Button size="sm" onClick={simpan} loading={menyimpan}>Simpan pengeluaran</Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <button onClick={() => setBulan(geserBulan(bulan, -1))} aria-label="Bulan sebelumnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronLeft className="w-4 h-4" /></button>
            <input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} className={cn(inputCls, 'mt-0 flex-1 text-center')} aria-label="Pilih bulan" />
            <button onClick={() => setBulan(geserBulan(bulan, 1))} aria-label="Bulan berikutnya" className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronRight className="w-4 h-4" /></button>
          </div>

          <div className={kartu}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-heading font-semibold text-sm">Daftar {labelBulan(bulan)}</h3>
              <span className="font-semibold text-sm">{formatRupiah(totalPeng)}</span>
            </div>
            {daftarPeng.length === 0 && <p className="text-sm text-[rgb(var(--color-text-muted))]">Belum ada pengeluaran bulan ini.</p>}
            {daftarPeng.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-t first:border-t-0 border-[rgb(var(--color-border)/0.6)] text-sm">
                <div className="min-w-0">
                  <p className="truncate">{p.keterangan}</p>
                  <p className="text-xs text-[rgb(var(--color-text-muted))]">{p.tanggal} · {p.kategori}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span>{formatRupiah(p.jumlah)}</span>
                  <button onClick={() => hapus(p.id)} disabled={menghapus === p.id} aria-label={`Hapus ${p.keterangan}`} className="p-1.5 text-[rgb(var(--color-text-muted))] hover:text-rose-700 disabled:opacity-40">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">
            {NAMA_BIAYA_CETAK.replace(' (otomatis)', '')} tidak perlu dicatat di sini. Sistem menghitungnya otomatis dari booking yang selesai.
          </p>
        </>
      )}
    </div>
  )
}

function daftarKosong() {
  return (
    <div className="rounded-2xl border border-dashed border-[rgb(var(--color-border))] p-4 mb-4 text-sm">
      <p className="font-medium">Belum ada sesi selesai</p>
      <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">Booking baru masuk laporan setelah statusnya Selesai.</p>
    </div>
  )
}
