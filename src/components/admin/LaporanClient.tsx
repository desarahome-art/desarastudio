'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Download, Pencil, Plus, Printer, Trash2, TriangleAlert, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn, formatRupiah } from '@/lib/utils'
import {
  simpanInputHarian,
  ubahPemasukan,
  ubahPengeluaran,
  hapusPemasukan,
  hapusPengeluaran,
} from '@/app/actions'
import {
  hitungLaporan,
  rentangBulan,
  bulanSebelumnya,
  selisihPersen,
  buatCsv,
  subtotal,
  JENIS_PEMASUKAN,
  KATEGORI_PENGELUARAN,
  type JenisPemasukan,
  type Laporan,
  type PemasukanLaporan,
  type PengeluaranLaporan,
} from '@/lib/laporan'

/** Saran harga untuk form: nama paket/add-on dari website → harga (tetap bisa diubah) */
export type SaranHarga = { Paket: Record<string, number>; 'Add-on': Record<string, number> }

type Tab = 'harian' | 'bulanan' | 'input'

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
  return `${NAMA_HARI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${NAMA_BULAN[m - 1]} ${y}`
}
function labelBulan(b: string): string {
  const [y, m] = b.split('-').map(Number)
  return `${NAMA_BULAN[m - 1]} ${y}`
}
function keAngka(teks: string): number {
  const d = teks.replace(/[^0-9]/g, '')
  return d ? Number(d) : 0
}
function ribuan(teks: string): string {
  const n = keAngka(teks)
  return n ? n.toLocaleString('id-ID') : ''
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
const inputCls = 'w-full rounded-lg border-2 border-[rgb(var(--color-border))] focus:border-[rgb(var(--color-forest))] bg-[rgb(var(--color-surface))] px-2.5 py-1.5 text-sm outline-none'
const labelCls = 'block text-[11px] font-semibold text-[rgb(var(--color-text-muted))] mb-0.5'
const ikonBtn = 'p-1.5 rounded-md text-[rgb(var(--color-text-muted))] hover:text-[rgb(var(--color-text))] disabled:opacity-40'
const garis = 'border-t first:border-t-0 border-[rgb(var(--color-border)/0.6)]'

function Metrik({ label, nilai, sub, warna }: { label: string; nilai: string; sub?: string; warna?: string }) {
  return (
    <div className="rounded-xl bg-[rgb(var(--color-cream-dark)/0.45)] px-3.5 py-3">
      <p className="text-xs text-[rgb(var(--color-text-muted))]">{label}</p>
      <p className={cn('font-heading font-semibold text-lg sm:text-xl mt-0.5', warna)}>{nilai}</p>
      {sub && <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-0.5">{sub}</p>}
    </div>
  )
}

const warnaLaba = (n: number) => (n >= 0 ? 'text-emerald-700' : 'text-rose-700')

function Rekap({ judul, data, total, warna }: { judul: string; data: { nama: string; info?: string; nilai: number }[]; total: number; warna: string }) {
  return (
    <div className={kartu}>
      <h3 className="font-heading font-semibold text-sm mb-2">{judul}</h3>
      {data.length === 0 && <p className="text-sm text-[rgb(var(--color-text-muted))]">Belum ada data.</p>}
      {data.map(d => (
        <div key={d.nama} className="py-1.5">
          <div className="flex justify-between gap-3 text-sm">
            <span>{d.nama}{d.info && <span className="text-xs text-[rgb(var(--color-text-muted))]"> · {d.info}</span>}</span>
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

function Alat({ l, judul, berkas }: { l: Laporan; judul: string; berkas: string }) {
  return (
    <div className="flex gap-2 justify-end mb-3 print:hidden">
      <Button variant="secondary" size="sm" onClick={() => unduh(berkas, buatCsv(l, judul))}>
        <Download className="w-4 h-4" /> Download CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={() => window.print()}>
        <Printer className="w-4 h-4" /> Cetak / PDF
      </Button>
    </div>
  )
}

function Navigasi({ onPrev, onNext, children, labelPrev, labelNext }: { onPrev: () => void; onNext: () => void; children: React.ReactNode; labelPrev: string; labelNext: string }) {
  return (
    <div className="flex items-center gap-2 mb-3 print:hidden">
      <button onClick={onPrev} aria-label={labelPrev} className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronLeft className="w-4 h-4" /></button>
      <div className="flex-1">{children}</div>
      <button onClick={onNext} aria-label={labelNext} className="p-2 rounded-lg border border-[rgb(var(--color-border))]"><ChevronRight className="w-4 h-4" /></button>
    </div>
  )
}

// ---------------- Baris tersimpan yang bisa diedit ----------------
function BarisPemasukan({ p, onError }: { p: PemasukanLaporan; onError: (m: string) => void }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [jenis, setJenis] = useState<JenisPemasukan>(p.jenis)
  const [nama, setNama] = useState(p.nama)
  const [jumlah, setJumlah] = useState(String(p.jumlah))
  const [harga, setHarga] = useState(p.harga_satuan.toLocaleString('id-ID'))
  const [sibuk, setSibuk] = useState(false)

  const simpan = async () => {
    setSibuk(true)
    const res = await ubahPemasukan(p.id, { jenis, nama, jumlah: keAngka(jumlah), harga_satuan: keAngka(harga) })
    setSibuk(false)
    if (res.error) return onError(res.error)
    setEdit(false)
    router.refresh()
  }
  const hapus = async () => {
    if (!window.confirm(`Hapus pemasukan "${p.nama} × ${p.jumlah}"?`)) return
    setSibuk(true)
    const res = await hapusPemasukan(p.id)
    setSibuk(false)
    if (res.error) return onError(res.error)
    router.refresh()
  }

  if (edit) {
    return (
      <div className={cn('py-2 grid grid-cols-2 sm:grid-cols-[1fr_1.4fr_64px_1fr_auto] gap-2 items-end', garis)}>
        <div><label className={labelCls}>Jenis</label><select value={jenis} onChange={e => setJenis(e.target.value as JenisPemasukan)} className={inputCls}>{JENIS_PEMASUKAN.map(j => <option key={j}>{j}</option>)}</select></div>
        <div><label className={labelCls}>Nama</label><input value={nama} onChange={e => setNama(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Jumlah</label><input inputMode="numeric" value={jumlah} onChange={e => setJumlah(String(keAngka(e.target.value) || ''))} className={inputCls} /></div>
        <div><label className={labelCls}>Harga satuan</label><input inputMode="numeric" value={harga} onChange={e => setHarga(ribuan(e.target.value))} className={inputCls} /></div>
        <div className="flex gap-1">
          <button onClick={simpan} disabled={sibuk} className={ikonBtn} aria-label="Simpan perubahan"><Check className="w-4 h-4 text-emerald-700" /></button>
          <button onClick={() => setEdit(false)} className={ikonBtn} aria-label="Batal"><X className="w-4 h-4" /></button>
        </div>
      </div>
    )
  }
  return (
    <div className={cn('flex justify-between items-center gap-3 py-2 text-sm', garis)}>
      <div className="min-w-0">
        <p className="truncate">{p.nama} × {p.jumlah}</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{p.jenis} · {formatRupiah(p.harga_satuan)} per unit</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="mr-1">{formatRupiah(subtotal(p))}</span>
        <button onClick={() => setEdit(true)} className={cn(ikonBtn, 'print:hidden')} aria-label={`Edit ${p.nama}`}><Pencil className="w-4 h-4" /></button>
        <button onClick={hapus} disabled={sibuk} className={cn(ikonBtn, 'hover:text-rose-700 print:hidden')} aria-label={`Hapus ${p.nama}`}><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

function BarisPengeluaran({ p, onError }: { p: PengeluaranLaporan; onError: (m: string) => void }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [kategori, setKategori] = useState(p.kategori)
  const [ket, setKet] = useState(p.keterangan)
  const [jumlah, setJumlah] = useState(p.jumlah.toLocaleString('id-ID'))
  const [sibuk, setSibuk] = useState(false)
  const pilihan = (KATEGORI_PENGELUARAN as readonly string[]).includes(p.kategori) ? KATEGORI_PENGELUARAN : [p.kategori, ...KATEGORI_PENGELUARAN]

  const simpan = async () => {
    setSibuk(true)
    const res = await ubahPengeluaran(p.id, { kategori, keterangan: ket, jumlah: keAngka(jumlah) })
    setSibuk(false)
    if (res.error) return onError(res.error)
    setEdit(false)
    router.refresh()
  }
  const hapus = async () => {
    if (!window.confirm(`Hapus pengeluaran "${p.keterangan}"?`)) return
    setSibuk(true)
    const res = await hapusPengeluaran(p.id)
    setSibuk(false)
    if (res.error) return onError(res.error)
    router.refresh()
  }

  if (edit) {
    return (
      <div className={cn('py-2 grid grid-cols-2 sm:grid-cols-[1.2fr_1.6fr_1fr_auto] gap-2 items-end', garis)}>
        <div><label className={labelCls}>Kategori</label><select value={kategori} onChange={e => setKategori(e.target.value)} className={inputCls}>{pilihan.map(k => <option key={k}>{k}</option>)}</select></div>
        <div><label className={labelCls}>Keterangan</label><input value={ket} onChange={e => setKet(e.target.value)} className={inputCls} /></div>
        <div><label className={labelCls}>Jumlah</label><input inputMode="numeric" value={jumlah} onChange={e => setJumlah(ribuan(e.target.value))} className={inputCls} /></div>
        <div className="flex gap-1">
          <button onClick={simpan} disabled={sibuk} className={ikonBtn} aria-label="Simpan perubahan"><Check className="w-4 h-4 text-emerald-700" /></button>
          <button onClick={() => setEdit(false)} className={ikonBtn} aria-label="Batal"><X className="w-4 h-4" /></button>
        </div>
      </div>
    )
  }
  return (
    <div className={cn('flex justify-between items-center gap-3 py-2 text-sm', garis)}>
      <div className="min-w-0">
        <p className="truncate">{p.keterangan}</p>
        <p className="text-xs text-[rgb(var(--color-text-muted))]">{p.kategori}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="mr-1">{formatRupiah(p.jumlah)}</span>
        <button onClick={() => setEdit(true)} className={cn(ikonBtn, 'print:hidden')} aria-label={`Edit ${p.keterangan}`}><Pencil className="w-4 h-4" /></button>
        <button onClick={hapus} disabled={sibuk} className={cn(ikonBtn, 'hover:text-rose-700 print:hidden')} aria-label={`Hapus ${p.keterangan}`}><Trash2 className="w-4 h-4" /></button>
      </div>
    </div>
  )
}

// ---------------- Form input harian ----------------
interface FormMasuk { id: number; jenis: JenisPemasukan; nama: string; jumlah: string; harga: string }
interface FormKeluar { id: number; kategori: string; ket: string; jumlah: string }
let urut = 1
const masukBaru = (): FormMasuk => ({ id: urut++, jenis: 'Paket', nama: '', jumlah: '', harga: '' })
const keluarBaru = (): FormKeluar => ({ id: urut++, kategori: KATEGORI_PENGELUARAN[0], ket: '', jumlah: '' })

function FormInput({ hariIni, saran, sudahAda, onTersimpan }: { hariIni: string; saran: SaranHarga; sudahAda: (t: string) => boolean; onTersimpan: (t: string) => void }) {
  const router = useRouter()
  const [tanggal, setTanggal] = useState(hariIni)
  const [masuk, setMasuk] = useState<FormMasuk[]>([masukBaru()])
  const [keluar, setKeluar] = useState<FormKeluar[]>([keluarBaru()])
  const [pesan, setPesan] = useState('')
  const [menyimpan, setMenyimpan] = useState(false)

  const ubahMasuk = (id: number, patch: Partial<FormMasuk>) => {
    setMasuk(rows => rows.map(r => {
      if (r.id !== id) return r
      const n = { ...r, ...patch }
      if (patch.jenis && patch.jenis !== r.jenis) { n.nama = ''; n.harga = '' }
      // Pilih nama dari daftar website: isi harga bila masih kosong
      if (patch.nama !== undefined && !keAngka(n.harga) && n.jenis !== 'Lainnya') {
        const h = saran[n.jenis][patch.nama]
        if (h) n.harga = h.toLocaleString('id-ID')
      }
      return n
    }))
    setPesan('')
  }
  const ubahKeluar = (id: number, patch: Partial<FormKeluar>) => {
    setKeluar(rows => rows.map(r => (r.id === id ? { ...r, ...patch } : r)))
    setPesan('')
  }

  const ringkas = useMemo(() => {
    const totalMasuk = masuk.reduce((s, r) => s + keAngka(r.jumlah) * keAngka(r.harga), 0)
    const totalKeluar = keluar.reduce((s, r) => s + keAngka(r.jumlah), 0)
    const client = masuk.filter(r => r.jenis === 'Paket').reduce((s, r) => s + keAngka(r.jumlah), 0)
    return { totalMasuk, totalKeluar, client, laba: totalMasuk - totalKeluar }
  }, [masuk, keluar])

  const simpan = async () => {
    if (!tanggal) return setPesan('Isi tanggal.')
    const m = masuk.filter(r => r.nama.trim() || r.jumlah || r.harga)
    const k = keluar.filter(r => r.ket.trim() || r.jumlah)
    if (m.length + k.length === 0) return setPesan('Isi minimal satu baris pemasukan atau pengeluaran.')
    for (const r of m) {
      if (!r.nama.trim()) return setPesan('Isi nama pada setiap baris pemasukan.')
      if (keAngka(r.jumlah) < 1) return setPesan(`Isi jumlah untuk "${r.nama}".`)
      if (!r.harga) return setPesan(`Isi harga untuk "${r.nama}".`)
    }
    for (const r of k) {
      if (!r.ket.trim()) return setPesan('Isi keterangan pada setiap pengeluaran.')
      if (keAngka(r.jumlah) < 1) return setPesan(`Isi jumlah untuk "${r.ket}".`)
    }
    setMenyimpan(true)
    setPesan('')
    const res = await simpanInputHarian({
      tanggal,
      pemasukan: m.map(r => ({ jenis: r.jenis, nama: r.nama, jumlah: keAngka(r.jumlah), harga_satuan: keAngka(r.harga) })),
      pengeluaran: k.map(r => ({ kategori: r.kategori, keterangan: r.ket, jumlah: keAngka(r.jumlah) })),
    })
    setMenyimpan(false)
    if (res.error) return setPesan(res.error)
    setMasuk([masukBaru()])
    setKeluar([keluarBaru()])
    onTersimpan(tanggal)
    router.refresh()
  }

  return (
    <div className={kartu}>
      <h3 className="font-heading font-semibold text-sm mb-3">Input harian</h3>
      <label htmlFor="in-tgl" className="text-xs font-semibold">Tanggal</label>
      <input id="in-tgl" type="date" value={tanggal} onChange={e => { setTanggal(e.target.value); setPesan('') }} className={cn(inputCls, 'mt-1 max-w-[220px] block')} />
      {tanggal && sudahAda(tanggal) && (
        <p className="flex gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-3">
          <TriangleAlert className="w-4 h-4 shrink-0" />
          Tanggal ini sudah punya catatan. Baris baru akan ditambahkan, bukan menimpa. Edit baris lama di tab Harian.
        </p>
      )}

      <h4 className="text-xs font-semibold mt-4 mb-2">Pemasukan</h4>
      {masuk.map(r => (
        <div key={r.id} className="grid grid-cols-2 sm:grid-cols-[1fr_1.4fr_64px_1fr_1fr_auto] gap-2 mb-2 items-end">
          <div><label className={labelCls}>Jenis</label><select value={r.jenis} onChange={e => ubahMasuk(r.id, { jenis: e.target.value as JenisPemasukan })} className={inputCls} aria-label="Jenis pemasukan">{JENIS_PEMASUKAN.map(j => <option key={j}>{j}</option>)}</select></div>
          <div>
            <label className={labelCls}>Nama</label>
            <input list={r.jenis !== 'Lainnya' ? `saran-${r.jenis}` : undefined} value={r.nama} placeholder={r.jenis === 'Paket' ? 'Bronze' : r.jenis === 'Add-on' ? 'Tambah orang' : 'Keterangan'} onChange={e => ubahMasuk(r.id, { nama: e.target.value })} className={inputCls} aria-label="Nama pemasukan" />
          </div>
          <div><label className={labelCls}>Jumlah</label><input inputMode="numeric" value={r.jumlah} placeholder="1" onChange={e => ubahMasuk(r.id, { jumlah: String(keAngka(e.target.value) || '') })} className={inputCls} aria-label="Jumlah pemasukan" /></div>
          <div><label className={labelCls}>Harga satuan</label><input inputMode="numeric" value={r.harga} placeholder="0" onChange={e => ubahMasuk(r.id, { harga: ribuan(e.target.value) })} className={inputCls} aria-label="Harga satuan" /></div>
          <div><label className={labelCls}>Subtotal</label><p className="text-sm py-1.5">{formatRupiah(keAngka(r.jumlah) * keAngka(r.harga))}</p></div>
          <button onClick={() => setMasuk(rows => rows.filter(x => x.id !== r.id))} className={ikonBtn} aria-label="Hapus baris pemasukan"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => setMasuk(rows => [...rows, masukBaru()])} className="text-xs text-[rgb(var(--color-forest))] inline-flex items-center gap-1 font-medium"><Plus className="w-3.5 h-3.5" /> Tambah pemasukan</button>

      <h4 className="text-xs font-semibold mt-4 mb-2">Pengeluaran</h4>
      {keluar.map(r => (
        <div key={r.id} className="grid grid-cols-2 sm:grid-cols-[1.2fr_1.6fr_1fr_auto] gap-2 mb-2 items-end">
          <div><label className={labelCls}>Kategori</label><select value={r.kategori} onChange={e => ubahKeluar(r.id, { kategori: e.target.value })} className={inputCls} aria-label="Kategori pengeluaran">{KATEGORI_PENGELUARAN.map(k => <option key={k}>{k}</option>)}</select></div>
          <div><label className={labelCls}>Keterangan</label><input value={r.ket} placeholder="Cetak 12R x 5" onChange={e => ubahKeluar(r.id, { ket: e.target.value })} className={inputCls} aria-label="Keterangan pengeluaran" /></div>
          <div><label className={labelCls}>Jumlah</label><input inputMode="numeric" value={r.jumlah} placeholder="0" onChange={e => ubahKeluar(r.id, { jumlah: ribuan(e.target.value) })} className={inputCls} aria-label="Jumlah pengeluaran" /></div>
          <button onClick={() => setKeluar(rows => rows.filter(x => x.id !== r.id))} className={ikonBtn} aria-label="Hapus baris pengeluaran"><X className="w-4 h-4" /></button>
        </div>
      ))}
      <button onClick={() => setKeluar(rows => [...rows, keluarBaru()])} className="text-xs text-[rgb(var(--color-forest))] inline-flex items-center gap-1 font-medium"><Plus className="w-3.5 h-3.5" /> Tambah pengeluaran</button>

      <div className="mt-4 rounded-xl bg-[rgb(var(--color-cream-dark)/0.45)] p-3 text-sm grid grid-cols-2 sm:grid-cols-4 gap-2" aria-live="polite">
        <div><p className={labelCls}>Client</p><p className="font-semibold">{ringkas.client}</p></div>
        <div><p className={labelCls}>Pemasukan</p><p className="font-semibold">{formatRupiah(ringkas.totalMasuk)}</p></div>
        <div><p className={labelCls}>Pengeluaran</p><p className="font-semibold">{formatRupiah(ringkas.totalKeluar)}</p></div>
        <div><p className={labelCls}>Laba</p><p className={cn('font-semibold', warnaLaba(ringkas.laba))}>{formatRupiah(ringkas.laba)}</p></div>
      </div>

      {pesan && <p role="alert" className="text-sm text-rose-700 mt-3">{pesan}</p>}
      <div className="mt-3"><Button size="sm" onClick={simpan} loading={menyimpan}>Simpan</Button></div>

      <datalist id="saran-Paket">{Object.keys(saran.Paket).map(n => <option key={n} value={n} />)}</datalist>
      <datalist id="saran-Add-on">{Object.keys(saran['Add-on']).map(n => <option key={n} value={n} />)}</datalist>
    </div>
  )
}

// ---------------- Halaman ----------------
export function LaporanClient({
  pemasukan,
  pengeluaran,
  saran,
  hariIni,
  galat = [],
}: {
  pemasukan: PemasukanLaporan[]
  pengeluaran: PengeluaranLaporan[]
  saran: SaranHarga
  hariIni: string
  galat?: string[]
}) {
  const [tab, setTab] = useState<Tab>('harian')
  const [hari, setHari] = useState(hariIni)
  const [bulan, setBulan] = useState(hariIni.slice(0, 7))
  const [pesan, setPesan] = useState('')

  const harian = useMemo(() => hitungLaporan(pemasukan, pengeluaran, hari, hari), [pemasukan, pengeluaran, hari])
  const { dari, sampai } = rentangBulan(bulan)
  const bulanan = useMemo(() => hitungLaporan(pemasukan, pengeluaran, dari, sampai), [pemasukan, pengeluaran, dari, sampai])
  const lalu = useMemo(() => {
    const r = rentangBulan(bulanSebelumnya(bulan))
    return hitungLaporan(pemasukan, pengeluaran, r.dari, r.sampai)
  }, [pemasukan, pengeluaran, bulan])
  const delta = selisihPersen(bulanan.totalPemasukan, lalu.totalPemasukan)

  const sudahAda = (t: string) => pemasukan.some(p => p.tanggal === t) || pengeluaran.some(p => p.tanggal === t)

  return (
    <div className="max-w-3xl">
      {galat.length > 0 && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 print:hidden">
          {galat.map(g => <p key={g}>{g}</p>)}
          <p className="text-xs mt-1">Laporan di bawah belum lengkap. Pastikan migrasi 008 sudah dijalankan, lalu muat ulang halaman.</p>
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-xl bg-[rgb(var(--color-cream-dark)/0.6)] mb-4 print:hidden" role="tablist">
        {([['harian', 'Harian'], ['bulanan', 'Bulanan'], ['input', 'Input']] as [Tab, string][]).map(([k, n]) => (
          <button
            key={k}
            role="tab"
            aria-selected={tab === k}
            onClick={() => { setTab(k); setPesan('') }}
            className={cn(
              'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
              tab === k ? 'bg-[rgb(var(--color-surface))] shadow-sm text-[rgb(var(--color-text))]' : 'text-[rgb(var(--color-text-muted))]'
            )}
          >
            {n}
          </button>
        ))}
      </div>

      {pesan && <p role="alert" className="text-sm text-rose-700 mb-3">{pesan}</p>}

      {tab === 'harian' && (
        <>
          <Navigasi onPrev={() => setHari(geserHari(hari, -1))} onNext={() => setHari(geserHari(hari, 1))} labelPrev="Hari sebelumnya" labelNext="Hari berikutnya">
            <input type="date" value={hari} onChange={e => e.target.value && setHari(e.target.value)} className={cn(inputCls, 'text-center')} aria-label="Pilih tanggal" />
          </Navigasi>
          <div className="flex items-center justify-between mb-3">
            <p className="font-heading font-semibold">{labelTanggal(hari)}</p>
            {hari !== hariIni && <button onClick={() => setHari(hariIni)} className="text-xs underline text-[rgb(var(--color-forest))] print:hidden">Hari ini</button>}
          </div>
          <Alat l={harian} judul={`Laporan harian ${hari}`} berkas={`laporan-harian-${hari}.csv`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <Metrik label="Client" nilai={String(harian.client)} />
            <Metrik label="Pemasukan" nilai={formatRupiah(harian.totalPemasukan)} />
            <Metrik label="Pengeluaran" nilai={formatRupiah(harian.totalPengeluaran)} />
            <Metrik label="Laba bersih" nilai={formatRupiah(harian.laba)} sub={`${harian.margin}% margin`} warna={warnaLaba(harian.laba)} />
          </div>
          {harian.pemasukan.length === 0 && harian.pengeluaran.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[rgb(var(--color-border))] p-4 text-sm">
              <p className="font-medium">Belum ada catatan di tanggal ini</p>
              <p className="text-xs text-[rgb(var(--color-text-muted))] mt-1">Isi lewat tab Input.</p>
            </div>
          ) : (
            <>
              <div className={kartu}>
                <h3 className="font-heading font-semibold text-sm mb-1">Pemasukan</h3>
                {harian.pemasukan.length === 0 && <p className="text-sm text-[rgb(var(--color-text-muted))] py-2">Tidak ada.</p>}
                {harian.pemasukan.map(p => <BarisPemasukan key={`${p.id}-${p.jenis}-${p.nama}-${p.jumlah}-${p.harga_satuan}`} p={p} onError={setPesan} />)}
                <div className="flex justify-between pt-2 mt-1 border-t border-[rgb(var(--color-border))] text-sm font-semibold"><span>Total pemasukan</span><span>{formatRupiah(harian.totalPemasukan)}</span></div>
              </div>
              <div className={kartu}>
                <h3 className="font-heading font-semibold text-sm mb-1">Pengeluaran</h3>
                {harian.pengeluaran.length === 0 && <p className="text-sm text-[rgb(var(--color-text-muted))] py-2">Tidak ada.</p>}
                {harian.pengeluaran.map(p => <BarisPengeluaran key={`${p.id}-${p.kategori}-${p.keterangan}-${p.jumlah}`} p={p} onError={setPesan} />)}
                <div className="flex justify-between pt-2 mt-1 border-t border-[rgb(var(--color-border))] text-sm font-semibold"><span>Total pengeluaran</span><span>{formatRupiah(harian.totalPengeluaran)}</span></div>
              </div>
              <div className={cn(kartu, 'flex justify-between font-semibold text-sm')}>
                <span>Laba bersih</span><span className={warnaLaba(harian.laba)}>{formatRupiah(harian.laba)}</span>
              </div>
            </>
          )}
        </>
      )}

      {tab === 'bulanan' && (
        <>
          <Navigasi onPrev={() => setBulan(geserBulan(bulan, -1))} onNext={() => setBulan(geserBulan(bulan, 1))} labelPrev="Bulan sebelumnya" labelNext="Bulan berikutnya">
            <input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)} className={cn(inputCls, 'text-center')} aria-label="Pilih bulan" />
          </Navigasi>
          <p className="font-heading font-semibold mb-3">{labelBulan(bulan)}</p>
          <Alat l={bulanan} judul={`Laporan bulanan ${bulan}`} berkas={`laporan-bulanan-${bulan}.csv`} />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
            <Metrik label="Pemasukan" nilai={formatRupiah(bulanan.totalPemasukan)} sub={`${bulanan.client} client`} />
            <Metrik label="Pengeluaran" nilai={formatRupiah(bulanan.totalPengeluaran)} />
            <Metrik label="Laba bersih" nilai={formatRupiah(bulanan.laba)} sub={`${bulanan.margin}% margin`} warna={warnaLaba(bulanan.laba)} />
            <Metrik
              label="Vs bulan lalu"
              nilai={delta === null ? '-' : `${delta >= 0 ? '+' : ''}${delta}%`}
              sub={`${labelBulan(bulanSebelumnya(bulan))}: ${formatRupiah(lalu.totalPemasukan)}`}
              warna={delta === null ? undefined : warnaLaba(delta)}
            />
          </div>
          <div className={kartu}>
            <h3 className="font-heading font-semibold text-sm mb-2">Per tanggal</h3>
            {bulanan.perHari.length === 0 ? (
              <p className="text-sm text-[rgb(var(--color-text-muted))]">Belum ada catatan bulan ini.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-[rgb(var(--color-text-muted))]">
                      <th className="py-1 text-left font-medium">Tanggal</th>
                      <th className="text-right font-medium">Client</th>
                      <th className="text-right font-medium">Pemasukan</th>
                      <th className="text-right font-medium">Pengeluaran</th>
                      <th className="text-right font-medium">Laba</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulanan.perHari.map(h => (
                      <tr key={h.tanggal} className="border-t border-[rgb(var(--color-border)/0.6)]">
                        <td className="py-1.5">
                          <button onClick={() => { setHari(h.tanggal); setTab('harian') }} className="underline-offset-2 hover:underline text-left print:no-underline">{labelTanggal(h.tanggal)}</button>
                        </td>
                        <td className="text-right">{h.client}</td>
                        <td className="text-right">{formatRupiah(h.pemasukan)}</td>
                        <td className="text-right">{formatRupiah(h.pengeluaran)}</td>
                        <td className={cn('text-right', warnaLaba(h.laba))}>{formatRupiah(h.laba)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[rgb(var(--color-border))] font-semibold">
                      <td className="py-1.5">Total</td>
                      <td className="text-right">{bulanan.client}</td>
                      <td className="text-right">{formatRupiah(bulanan.totalPemasukan)}</td>
                      <td className="text-right">{formatRupiah(bulanan.totalPengeluaran)}</td>
                      <td className={cn('text-right', warnaLaba(bulanan.laba))}>{formatRupiah(bulanan.laba)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <Rekap
            judul="Pemasukan per paket dan add-on"
            data={bulanan.perItem.map(x => ({ nama: x.nama, info: `${x.jenis} × ${x.jumlah}`, nilai: x.nilai }))}
            total={bulanan.totalPemasukan}
            warna="bg-[rgb(var(--color-forest))]"
          />
          <Rekap
            judul="Pengeluaran per kategori"
            data={bulanan.perKategori.map(x => ({ nama: x.nama, nilai: x.jumlah }))}
            total={bulanan.totalPengeluaran}
            warna="bg-orange-500"
          />
        </>
      )}

      {tab === 'input' && (
        <FormInput
          hariIni={hariIni}
          saran={saran}
          sudahAda={sudahAda}
          onTersimpan={t => { setHari(t); setBulan(t.slice(0, 7)) }}
        />
      )}
    </div>
  )
}
