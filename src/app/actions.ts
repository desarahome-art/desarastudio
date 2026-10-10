'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BookingFormData, BookingStatus, CetakStatus, Package, ClosedDateItem } from '@/types'
import {
  isSlotBlocked,
  generateTimeSlots,
  parseWaitingListInfo,
  isSlotWithinOperatingHours,
  normalizeTime,
  timeToMinutes,
  hariIniWIB,
  menitSekarangWIB,
  formatTanggalValid,
  formatJamValid,
} from '@/lib/utils'
import { backgroundsUntukKategori, kuotaBackgroundEfektif } from '@/lib/background'
import {
  getMenitPerUnit,
  hitungMenitAddon,
  hitungHargaAddon,
  labelSatuanWaktu,
  rencanakanTambahAddon,
  rencanakanKurangiAddon,
  terapkanRencanaKeBaris,
  tentukanAksiCetak,
  paketPunyaCetak,
  type BarisBookingAddon,
  type MasterAddon,
  type RencanaPerubahan,
} from '@/lib/addon-calc'

type AdminClient = Awaited<ReturnType<typeof createAdminClient>>

const PESAN_SLOT_PENUH = 'Slot jam sudah dipesan. Pilih jam lain.'
// Kode error Postgres untuk pelanggaran unique index (dua orang mengambil jam yang sama bersamaan)
const KODE_UNIK_DILANGGAR = '23505'

// Helper: pastikan pemanggil adalah admin yang sudah login.
// Mengembalikan client bersesi admin (RLS Supabase berlaku) + email dari sesi.
// Opsional: isi ADMIN_EMAILS di .env.local ("a@x.com,b@y.com") agar HANYA email itu
// yang dianggap admin (berguna jika pendaftaran akun Supabase masih terbuka).
async function requireAdmin() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return { error: 'Sesi admin tidak valid. Silakan login ulang.' as const }
  }
  const email = data.user.email || 'admin'
  const daftarIzin = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  if (daftarIzin.length > 0 && !daftarIzin.includes(email.toLowerCase())) {
    return { error: 'Akun ini tidak punya akses admin.' as const }
  }
  return { supabase, email }
}

// Helper to check if a date is closed by studio admin
async function checkIsDateClosed(supabase: AdminClient, tanggal: string): Promise<ClosedDateItem | null> {
  try {
    const { data: settingRow } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'closed_dates')
      .single()

    if (settingRow && Array.isArray(settingRow.value)) {
      const closedList = settingRow.value as ClosedDateItem[]
      const match = closedList.find(c => c.tanggal === tanggal)
      return match || null
    }
    return null
  } catch {
    return null
  }
}

function pesanTutup(tanggal: string, info: ClosedDateItem) {
  return `Studio tutup pada tanggal ${tanggal}${info.keterangan ? ` (${info.keterangan})` : ''}. Silakan pilih tanggal lain.`
}

// Pengaturan operasional selalu dibaca dari database (bukan dari nilai yang dikirim browser)
async function bacaPengaturanOperasional(supabase: AdminClient) {
  const hasil = { jamBuka: '08:00', jamTutup: '20:00', slotInterval: 30, dpMinimal: 100000 }
  try {
    const { data } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['jam_buka', 'jam_tutup', 'slot_interval', 'dp_minimal'])
    for (const s of data || []) {
      if (s.key === 'jam_buka' && formatJamValid(s.value)) hasil.jamBuka = normalizeTime(s.value)
      if (s.key === 'jam_tutup' && formatJamValid(s.value)) hasil.jamTutup = normalizeTime(s.value)
      if (s.key === 'slot_interval' && Number(s.value) > 0) hasil.slotInterval = Number(s.value)
      if (s.key === 'dp_minimal' && Number(s.value) >= 0) hasil.dpMinimal = Number(s.value)
    }
  } catch {
    // pakai nilai bawaan
  }
  return hasil
}

// Background yang boleh dipilih untuk satu kategori, selalu dibaca dari database
async function bacaBackgroundKategori(supabase: AdminClient, categoryId: string | null | undefined) {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', 'backgrounds').maybeSingle()
    return backgroundsUntukKategori(Array.isArray(data?.value) ? data.value : [], categoryId)
  } catch {
    return []
  }
}

// Jam yang sudah lewat (hari ini) tidak boleh dipesan klien.
function sudahLewat(tanggal: string, jamMulai: string): boolean {
  const hariIni = hariIniWIB()
  if (tanggal < hariIni) return true
  if (tanggal === hariIni) return timeToMinutes(normalizeTime(jamMulai)) <= menitSekarangWIB()
  return false
}


// ---- Public: submit booking ----
export async function submitBooking(formData: BookingFormData) {
  const supabase = await createAdminClient()

  // Validasi dasar input dari browser
  const nama = String(formData?.nama || '').trim()
  const waKlien = String(formData?.wa_klien || '').trim()
  if (!nama) return { error: 'Nama wajib diisi.' }
  if (waKlien.replace(/[^0-9]/g, '').length < 8) return { error: 'Nomor WhatsApp tidak valid.' }
  if (!formatTanggalValid(formData?.tanggal)) return { error: 'Tanggal tidak valid.' }
  if (!formatJamValid(formData?.jam_mulai)) return { error: 'Jam sesi tidak valid.' }
  if (sudahLewat(formData.tanggal, formData.jam_mulai)) {
    return { error: 'Tanggal/jam yang dipilih sudah lewat. Silakan pilih jadwal lain.' }
  }

  // 0. Cek apakah studio tutup pada tanggal tersebut
  const closedInfo = await checkIsDateClosed(supabase, formData.tanggal)
  if (closedInfo) {
    return { error: pesanTutup(formData.tanggal, closedInfo) }
  }

  // 0a. Ambil paket & kategori dari database (harga/durasi dari browser tidak dipercaya)
  const { data: dbPackage } = await supabase
    .from('packages')
    .select('*')
    .eq('id', formData.package?.id)
    .eq('aktif', true)
    .maybeSingle()

  if (!dbPackage || dbPackage.category_id !== formData.category?.id) {
    return { error: 'Paket tidak ditemukan atau sudah tidak aktif. Silakan muat ulang halaman.' }
  }
  const pkg = dbPackage as Package

  const { data: dbCategory } = await supabase
    .from('categories')
    .select('id, nama')
    .eq('id', pkg.category_id)
    .maybeSingle()

  // 0b. Ambil data master add-on: harga, jenis & menit_per_unit selalu dari database
  const formAddons = (formData.addons || []).filter(a => Number(a.jumlah) > 0)
  const addonIds = formAddons.map(a => a.addon.id)
  const dbAddonsMap = new Map<string, MasterAddon>()
  const allowedAddonIds = new Set<string>()
  if (addonIds.length > 0) {
    const [{ data: dbAddons }, { data: addonCats }] = await Promise.all([
      supabase
        .from('addons')
        .select('id, harga, menit_per_unit, jenis, nama, satuan, maks')
        .in('id', addonIds),
      supabase
        .from('addon_categories')
        .select('addon_id')
        .eq('category_id', pkg.category_id)
        .in('addon_id', addonIds),
    ])
    ;(dbAddons || []).forEach(da => dbAddonsMap.set(da.id, da as MasterAddon))
    ;(addonCats || []).forEach(ac => allowedAddonIds.add(ac.addon_id))
  }

  const addonRows: Array<MasterAddon & { jumlah: number }> = []
  const sudahDipakai = new Set<string>()
  for (const a of formAddons) {
    const da = dbAddonsMap.get(a.addon.id)
    const qty = Number(a.jumlah)
    if (!da || !allowedAddonIds.has(da.id)) {
      return { error: 'Ada add-on yang tidak tersedia untuk kategori ini. Silakan muat ulang halaman.' }
    }
    if (sudahDipakai.has(da.id)) {
      return { error: `Add-on "${da.nama}" terkirim dua kali. Silakan muat ulang halaman.` }
    }
    sudahDipakai.add(da.id)
    if (!Number.isInteger(qty) || qty < 1 || qty > da.maks) {
      return { error: `Jumlah add-on "${da.nama}" tidak valid (maksimal ${da.maks}).` }
    }
    addonRows.push({ ...da, jumlah: qty })
  }

  // Validasi background: harus milik kategori paket & tidak melebihi kuota
  const bgTersedia = await bacaBackgroundKategori(supabase, pkg.category_id)
  const namaBgTersedia = new Set(bgTersedia.map(b => b.nama))
  const bgDipilih = Array.from(
    new Set((formData.pilihan_background || []).map(b => String(b).trim()).filter(Boolean))
  )
  if (bgDipilih.some(b => !namaBgTersedia.has(b))) {
    return { error: 'Ada pilihan background yang tidak tersedia untuk kategori ini. Silakan muat ulang halaman.' }
  }
  const bgTambahan = addonRows.filter(a => a.jenis === 'background').reduce((sum, a) => sum + a.jumlah, 0)
  const maksBg = kuotaBackgroundEfektif(pkg.jumlah_pilihan_background + bgTambahan, bgTersedia.length)
  if (bgDipilih.length > maksBg) {
    return { error: `Pilihan background maksimal ${maksBg}.` }
  }

  // Check slot availability server-side
  const jamMulai = normalizeTime(formData.jam_mulai)
  const durasiTotal = pkg.durasi_menit + hitungMenitAddon(addonRows)

  // 0c. Cek jam operasional studio & batas jam tutup (dari database)
  const { jamBuka, jamTutup, dpMinimal } = await bacaPengaturanOperasional(supabase)

  if (!isSlotWithinOperatingHours(jamMulai, durasiTotal, jamBuka, jamTutup)) {
    return {
      error: `Waktu sesi (${jamMulai} WIB dengan durasi ${durasiTotal} menit) berada di luar jam operasional atau melewati jam tutup studio (${jamBuka} - ${jamTutup}).`,
    }
  }

  // Hitung total harga dari database (paket + add-on)
  const totalHarga = pkg.harga + hitungHargaAddon(addonRows)

  // 0d. Validasi DP di server (sebelumnya hanya dicek di browser)
  const dpDibayar = Number(formData.dp_dibayar)
  const dpWajib = Math.min(dpMinimal, totalHarga)
  if (!Number.isFinite(dpDibayar) || !Number.isInteger(dpDibayar) || dpDibayar < dpWajib) {
    return { error: `DP minimal Rp ${dpWajib.toLocaleString('id-ID')}.` }
  }
  if (dpDibayar > totalHarga) {
    return { error: 'Nominal DP tidak boleh lebih besar dari total harga.' }
  }

  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('jam_mulai, durasi_total')
    .eq('tanggal', formData.tanggal)
    .in('status', ['pending', 'booking'])

  if (
    existingBookings &&
    isSlotBlocked(jamMulai, durasiTotal, existingBookings)
  ) {
    return { error: PESAN_SLOT_PENUH }
  }

  const buktiPath = formData.bukti_transfer || null

  const hasCetak = paketPunyaCetak(pkg) || addonRows.some(a => a.jenis === 'cetak')

  // Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      kode: '', // trigger will generate
      nama_klien: nama,
      wa_klien: waKlien,
      kampus: formData.kampus || null,
      tanggal: formData.tanggal,
      jam_mulai: jamMulai,
      durasi_total: durasiTotal,
      category_id: pkg.category_id,
      category_nama: dbCategory?.nama || formData.category.nama,
      package_id: pkg.id,
      package_nama: pkg.nama,
      package_harga: pkg.harga,
      package_snapshot: pkg,
      total_harga: totalHarga,
      dp_dibayar: dpDibayar,
      catatan: formData.catatan || null,
      pilihan_background: bgDipilih,
      bukti_transfer: buktiPath,
      status: 'pending',
      status_cetak: hasCetak ? 'menunggu' : null,
    })
    .select()
    .single()

  if (bookingError || !booking) {
    // Dua klien menekan kirim bersamaan: database menolak yang kedua (unique index)
    if (bookingError?.code === KODE_UNIK_DILANGGAR) return { error: PESAN_SLOT_PENUH }
    return { error: bookingError?.message || 'Gagal menyimpan booking.' }
  }

  // Insert add-ons dengan snapshot menit_per_unit
  if (addonRows.length > 0) {
    const { error: addonError } = await supabase.from('booking_addons').insert(
      addonRows.map(da => ({
        booking_id: booking.id,
        addon_id: da.id,
        jenis: da.jenis,
        nama: da.nama,
        satuan: da.jenis === 'waktu' ? labelSatuanWaktu(da) : da.satuan,
        harga: da.harga,
        jumlah: da.jumlah,
        menit_per_unit: da.jenis === 'waktu' ? getMenitPerUnit(da) : null,
        ditambah_oleh_admin: false,
      }))
    )
    if (addonError) {
      // Jangan biarkan booking tersimpan tanpa add-on-nya (total harga sudah termasuk add-on)
      await supabase.from('bookings').delete().eq('id', booking.id)
      return { error: `Gagal menyimpan add-on: ${addonError.message}. Silakan coba lagi.` }
    }
  }

  // Log status
  const { error: logError } = await supabase.from('booking_status_log').insert({
    booking_id: booking.id,
    status_dari: null,
    status_ke: 'pending',
    oleh: 'system',
    catatan: 'Booking dibuat oleh klien',
  })
  if (logError) console.error('Gagal menulis log booking:', logError.message)

  return { success: true, booking: { ...booking, jam_mulai: normalizeTime(booking.jam_mulai) } }
}

// ---- Public: submit waiting list ----
export async function submitWaitingList(data: {
  nama: string
  wa: string
  category_id: string
  category_nama: string
  package_nama?: string
  pilihan_background?: string[]
  kampus?: string
  acara_id?: string
  acara_nama?: string
  tanggal_ingin?: string
  jam_ingin: string
  catatan?: string
  dp_minimal?: number
}) {
  const supabase = await createAdminClient()

  if (!data.jam_ingin || !formatJamValid(data.jam_ingin)) {
    return { error: 'Jam sesi waiting list wajib dipilih.' }
  }
  if (!String(data.nama || '').trim() || String(data.wa || '').replace(/[^0-9]/g, '').length < 8) {
    return { error: 'Nama dan nomor WhatsApp wajib diisi dengan benar.' }
  }
  if (data.tanggal_ingin && !formatTanggalValid(data.tanggal_ingin)) {
    return { error: 'Tanggal tidak valid.' }
  }
  if (data.tanggal_ingin && sudahLewat(data.tanggal_ingin, data.jam_ingin)) {
    return { error: 'Tanggal/jam yang dipilih sudah lewat. Silakan pilih jadwal lain.' }
  }

  // Jika menggunakan acara wisuda (mode baru)
  if (data.acara_id) {
    // Cek apakah jam sudah diambil orang lain di acara yang SAMA
    const { data: existingWaiting } = await supabase
      .from('waiting_list')
      .select('catatan, acara_id')
      .eq('acara_id', data.acara_id)

    const isAlreadyWaiting = (existingWaiting || []).some(w => {
      const parsed = parseWaitingListInfo(w.catatan)
      return parsed.jam === data.jam_ingin
    })

    if (isAlreadyWaiting) {
      return {
        error: `Jam ${data.jam_ingin} WIB untuk acara ini sudah dipilih client lain dari acara yang sama. Silakan pilih jam lain.`,
      }
    }
  } else if (data.tanggal_ingin) {
    // Mode lama: cek per tanggal
    const closedInfo = await checkIsDateClosed(supabase, data.tanggal_ingin)
    if (closedInfo) {
      return { error: pesanTutup(data.tanggal_ingin, closedInfo) }
    }

    const { data: existingWaiting } = await supabase
      .from('waiting_list')
      .select('catatan')
      .eq('tanggal_ingin', data.tanggal_ingin)

    const isAlreadyWaiting = (existingWaiting || []).some(w => {
      const parsed = parseWaitingListInfo(w.catatan)
      return parsed.jam === data.jam_ingin
    })

    if (isAlreadyWaiting) {
      return {
        error: `Jam ${data.jam_ingin} WIB pada tanggal ini sudah dipilih oleh client waiting list lain. Silakan pilih jam lain.`,
      }
    }

    const { data: existingBookings } = await supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', data.tanggal_ingin)
      .in('status', ['pending', 'booking'])

    if (
      existingBookings &&
      isSlotBlocked(data.jam_ingin, 30, existingBookings.map(b => ({
        jam_mulai: b.jam_mulai ? String(b.jam_mulai).slice(0, 5) : '00:00',
        durasi_total: Number(b.durasi_total) || 30,
      })))
    ) {
      return {
        error: `Jam ${data.jam_ingin} WIB pada tanggal ini sudah dipesan (booking). Silakan pilih jam lain.`,
      }
    }
  } else {
    return { error: 'Pilih acara wisuda atau tanggal sesi foto.' }
  }

  const { dpMinimal: dpPengaturan } = await bacaPengaturanOperasional(supabase)
  const dpAmount = dpPengaturan

  // Validasi background: harus milik kategori yang dipilih & tidak melebihi kuota paket
  const bgDipilih = Array.from(
    new Set((data.pilihan_background || []).map(b => String(b).trim()).filter(Boolean))
  )
  if (bgDipilih.length > 0) {
    const bgTersedia = await bacaBackgroundKategori(supabase, data.category_id)
    const namaBgTersedia = new Set(bgTersedia.map(b => b.nama))
    if (bgDipilih.some(b => !namaBgTersedia.has(b))) {
      return { error: 'Ada pilihan background yang tidak tersedia untuk kategori ini. Silakan muat ulang halaman.' }
    }
    const { data: paketRow } = await supabase
      .from('packages')
      .select('jumlah_pilihan_background')
      .eq('category_id', data.category_id)
      .eq('nama', data.package_nama || '')
      .maybeSingle()
    const maksBg = kuotaBackgroundEfektif(Number(paketRow?.jumlah_pilihan_background) || 0, bgTersedia.length)
    if (bgDipilih.length > maksBg) {
      return { error: `Pilihan background maksimal ${maksBg}.` }
    }
  }

  // Format catatan lengkap
  const detailList: string[] = [
    `[Jam: ${data.jam_ingin}]`,
    `DP: Rp ${dpAmount.toLocaleString('id-ID')} (via WA)`,
  ]
  if (data.kampus?.trim()) detailList.push(`Kampus/Instansi: ${data.kampus.trim()}`)
  if (data.package_nama?.trim()) detailList.push(`Paket: ${data.package_nama.trim()}`)
  if (bgDipilih.length > 0) detailList.push(`Background: ${bgDipilih.join(', ')}`)
  if (data.catatan?.trim()) detailList.push(`Catatan: ${data.catatan.trim()}`)

  const combinedCatatan = detailList.join(' | ')

  const payload: Record<string, unknown> = {
    nama: data.nama.trim(),
    wa: data.wa.trim(),
    category_id: data.category_id,
    category_nama: data.category_nama,
    package_nama: data.package_nama?.trim() || null,
    acara_id: data.acara_id || null,
    acara_nama: data.acara_nama?.trim() || null,
    tanggal_ingin: data.tanggal_ingin || null,
    catatan: combinedCatatan,
    sudah_dihubungi: false,
  }

  const { error } = await supabase.from('waiting_list').insert(payload)
  if (error) return { error: error.message }
  revalidatePath('/admin/waitinglist')
  return { success: true }
}

// ---- Public: get waiting list slot availability status (per tanggal, legacy) ----
export async function getWaitingListSlotStatus(
  tanggal: string,
  jamBuka: string = '08:00',
  jamTutup: string = '20:00',
  intervalMenit: number = 30
): Promise<{
  allSlots: string[]
  bookedSlots: string[]
  waitingListSlots: string[]
}> {
  try {
    const supabase = await createAdminClient()

    // Cek apakah studio tutup
    const closedInfo = await checkIsDateClosed(supabase, tanggal)
    if (closedInfo) {
      return { allSlots: [], bookedSlots: [], waitingListSlots: [] }
    }

    const intv = Number(intervalMenit) || 30
    const allSlots = generateTimeSlots(jamBuka || '08:00', jamTutup || '20:00', intv)

    // 1. Ambil booking aktif pada tanggal tersebut
    const { data: bookings } = await supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', tanggal)
      .in('status', ['pending', 'booking'])

    const normalizedBooked = (bookings || []).map(item => ({
      jam_mulai: item.jam_mulai ? String(item.jam_mulai).slice(0, 5) : '00:00',
      durasi_total: Number(item.durasi_total) || 30,
    }))

    const bookedSlots: string[] = []
    for (const slot of allSlots) {
      if (isSlotBlocked(slot, intv, normalizedBooked)) {
        bookedSlots.push(slot)
      }
    }

    // 2. Ambil waiting list pada tanggal tersebut
    const { data: waitingListItems } = await supabase
      .from('waiting_list')
      .select('catatan')
      .eq('tanggal_ingin', tanggal)

    const waitingListSlots: string[] = []
    for (const item of waitingListItems || []) {
      const parsed = parseWaitingListInfo(item.catatan)
      if (parsed.jam && allSlots.includes(parsed.jam)) {
        if (!waitingListSlots.includes(parsed.jam)) {
          waitingListSlots.push(parsed.jam)
        }
      }
    }

    return { allSlots, bookedSlots, waitingListSlots }
  } catch (err) {
    console.error('Error fetching waiting list slot status:', err)
    return { allSlots: [], bookedSlots: [], waitingListSlots: [] }
  }
}

// ---- Public: get slot status per acara wisuda ----
export async function getWisudaSlotStatus(
  acaraId: string,
  jamBuka: string = '08:00',
  jamTutup: string = '20:00',
  intervalMenit: number = 30
): Promise<{
  allSlots: string[]
  takenSlots: string[]   // jam yang sudah diambil client waiting list di acara ini
}> {
  try {
    const supabase = await createAdminClient()
    const intv = Number(intervalMenit) || 30
    const allSlots = generateTimeSlots(jamBuka || '08:00', jamTutup || '20:00', intv)

    // Ambil semua waiting list dengan acara_id yang sama
    const { data: waitingListItems } = await supabase
      .from('waiting_list')
      .select('catatan')
      .eq('acara_id', acaraId)

    const takenSlots: string[] = []
    for (const item of waitingListItems || []) {
      const parsed = parseWaitingListInfo(item.catatan)
      if (parsed.jam && allSlots.includes(parsed.jam)) {
        if (!takenSlots.includes(parsed.jam)) {
          takenSlots.push(parsed.jam)
        }
      }
    }

    return { allSlots, takenSlots }
  } catch (err) {
    console.error('Error fetching wisuda slot status:', err)
    return { allSlots: [], takenSlots: [] }
  }
}

// ---- Public: get all wisuda events ----
export async function getWisudaEvents(): Promise<{
  events: Array<{ id: string; nama: string; kampus: string; keterangan: string | null; aktif: boolean; created_at: string }>
  error?: string
}> {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from('wisuda_events')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) return { events: [], error: error.message }
    return { events: data || [] }
  } catch (err: unknown) {
    return { events: [], error: (err as Error)?.message || 'Gagal mengambil data acara wisuda' }
  }
}

// ---- Admin: create wisuda event ----
export async function createWisudaEvent(data: {
  nama: string
  kampus: string
  keterangan?: string
  aktif?: boolean
}) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  if (!String(data?.nama || '').trim() || !String(data?.kampus || '').trim()) {
    return { error: 'Nama acara dan kampus wajib diisi.' }
  }
  const supabase = await createAdminClient()
  const { error } = await supabase.from('wisuda_events').insert({
    nama: data.nama.trim(),
    kampus: data.kampus.trim(),
    keterangan: data.keterangan?.trim() || null,
    aktif: data.aktif !== false,
  })
  if (error) return { error: error.message }
  revalidatePath('/admin/waitinglist')
  revalidatePath('/')
  return { success: true }
}

// ---- Admin: update wisuda event ----
export async function updateWisudaEvent(id: string, data: {
  nama?: string
  kampus?: string
  keterangan?: string | null
  aktif?: boolean
}) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createAdminClient()
  const updates: Record<string, unknown> = {}
  if (data.nama !== undefined) updates.nama = data.nama.trim()
  if (data.kampus !== undefined) updates.kampus = data.kampus.trim()
  if ('keterangan' in data) updates.keterangan = data.keterangan?.trim() || null
  if (data.aktif !== undefined) updates.aktif = data.aktif

  const { error } = await supabase.from('wisuda_events').update(updates).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/waitinglist')
  revalidatePath('/')
  return { success: true }
}

// ---- Admin: delete wisuda event ----
export async function deleteWisudaEvent(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createAdminClient()
  const { error } = await supabase.from('wisuda_events').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/waitinglist')
  revalidatePath('/')
  return { success: true }
}

// ---- Admin: Convert waiting list directly to booking ----
export async function convertWaitingListToBooking(
  waitingListId: string,
  tanggalFoto: string,
  _adminEmail?: string
) {
  void _adminEmail // email diambil dari sesi login, bukan dari browser
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const adminEmail = auth.email
  const supabase = await createAdminClient()

  // 1. Ambil data waiting list
  const { data: wl, error: wlError } = await supabase
    .from('waiting_list')
    .select('*')
    .eq('id', waitingListId)
    .single()

  if (wlError || !wl) {
    return { error: 'Data waiting list tidak ditemukan.' }
  }

  if (!tanggalFoto || !formatTanggalValid(tanggalFoto)) {
    return { error: 'Tanggal foto wajib dipilih oleh admin.' }
  }

  const parsedInfo = parseWaitingListInfo(wl.catatan)

  // Cek apakah sudah pernah dikonversi
  if (parsedInfo.bookingKode) {
    return { error: `Waiting list ini sudah pernah dikonversi ke booking dengan kode ${parsedInfo.bookingKode}.` }
  }

  // Cek apakah studio tutup pada tanggal tersebut
  const closedInfo = await checkIsDateClosed(supabase, tanggalFoto)
  if (closedInfo) {
    return { error: pesanTutup(tanggalFoto, closedInfo) }
  }

  // 2. Ambil paket untuk kategori ini — prioritaskan package_nama dari waiting list jika ada
  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .eq('category_id', wl.category_id)
    .eq('aktif', true)
    .order('urutan', { ascending: true })

  if (!packages || packages.length === 0) {
    return {
      error: `Kategori "${wl.category_nama || '-'}" belum punya paket aktif. Aktifkan/tambahkan paket dulu di menu Paket, lalu coba lagi.`,
    }
  }

  // Coba cocokkan package_nama yang dipilih client di waiting list; kalau tidak ada pakai paket pertama
  let selectedPkg: Package | undefined
  if (wl.package_nama) {
    selectedPkg = (packages as Package[]).find(
      p => p.nama.toLowerCase() === String(wl.package_nama).toLowerCase()
    )
  }
  if (!selectedPkg) selectedPkg = packages[0] as Package

  const { jamBuka, jamTutup, dpMinimal } = await bacaPengaturanOperasional(supabase)

  const tanggal = tanggalFoto
  const jamDefault = timeToMinutes(jamBuka) > timeToMinutes('09:00') ? jamBuka : '09:00'
  const jamMulai = normalizeTime(parsedInfo.jam) || jamDefault
  const durasiTotal = selectedPkg.durasi_menit || 30
  const totalHarga = selectedPkg.harga || 0
  const dpDibayar = Math.min(dpMinimal, totalHarga) // mengikuti Pengaturan (maksimal sebesar total harga)

  // Cek jam operasional & bentrok dengan booking aktif lain
  if (!isSlotWithinOperatingHours(jamMulai, durasiTotal, jamBuka, jamTutup)) {
    return {
      error: `Jam ${jamMulai} WIB (durasi ${durasiTotal} menit) berada di luar jam operasional studio (${jamBuka} - ${jamTutup}).`,
    }
  }
  const { data: existingBookings } = await supabase
    .from('bookings')
    .select('jam_mulai, durasi_total')
    .eq('tanggal', tanggal)
    .in('status', ['pending', 'booking'])
  if (existingBookings && isSlotBlocked(jamMulai, durasiTotal, existingBookings)) {
    return { error: `Jam ${jamMulai} WIB pada ${tanggal} sudah dipakai booking lain. Pilih tanggal lain.` }
  }

  // Background pilihan klien dibawa ke booking (hanya yang masih tersedia untuk kategori itu)
  const bgBoleh = new Set((await bacaBackgroundKategori(supabase, wl.category_id)).map(b => b.nama))
  const bgKonversi = (parsedInfo.background || []).filter(b => bgBoleh.has(b))

  // 3. Masukkan ke tabel bookings dengan status 'pending' (Menunggu)
  const { data: newBooking, error: insertError } = await supabase
    .from('bookings')
    .insert({
      kode: '', // Trigger otomatis generate kode booking
      nama_klien: wl.nama,
      wa_klien: wl.wa,
      kampus: parsedInfo.kampus || null,
      tanggal: tanggal,
      jam_mulai: jamMulai,
      durasi_total: durasiTotal,
      category_id: wl.category_id,
      category_nama: wl.category_nama,
      package_id: selectedPkg.id,
      package_nama: selectedPkg.nama,
      package_harga: selectedPkg.harga,
      package_snapshot: selectedPkg,
      total_harga: totalHarga,
      dp_dibayar: dpDibayar,
      catatan: `[Dikonversi dari Waiting List] ${wl.catatan || ''}`.trim(),
      pilihan_background: bgKonversi,
      bukti_transfer: null,
      status: 'pending',
      status_cetak: paketPunyaCetak(selectedPkg) ? 'menunggu' : null,
    })
    .select()
    .single()

  if (insertError || !newBooking) {
    if (insertError?.code === KODE_UNIK_DILANGGAR) {
      return { error: `Jam ${jamMulai} WIB pada ${tanggal} baru saja dipakai booking lain. Pilih tanggal lain.` }
    }
    return { error: insertError?.message || 'Gagal memasukkan data ke booking.' }
  }

  // 4. Log status ke booking_status_log
  const { error: logError } = await supabase.from('booking_status_log').insert({
    booking_id: newBooking.id,
    status_dari: null,
    status_ke: 'pending',
    oleh: adminEmail,
    catatan: 'Booking dibuat otomatis dari data Waiting List oleh admin',
  })
  if (logError) console.error('Gagal menulis log konversi waiting list:', logError.message)

  // 5. Update catatan di waiting_list agar tertandai sudah dikonversi
  const updatedWlCatatan = `${wl.catatan || ''} [Sudah Masuk Booking: ${newBooking.kode}]`.trim()
  const { error: wlUpdateError } = await supabase
    .from('waiting_list')
    .update({
      sudah_dihubungi: true,
      catatan: updatedWlCatatan,
    })
    .eq('id', waitingListId)

  revalidatePath('/admin/waitinglist')
  revalidatePath('/admin/bookings')
  revalidatePath('/')

  if (wlUpdateError) {
    return {
      error: `Booking ${newBooking.kode} sudah dibuat, tetapi penanda di Waiting List gagal disimpan (${wlUpdateError.message}). Jangan konversi ulang; tandai manual atau hapus entri ini.`,
    }
  }

  return { success: true, bookingKode: newBooking.kode }
}


// ---- Public: get available slots ----
// Jam buka/tutup/interval SELALU dibaca dari database (parameter jamBuka/jamTutup/intervalMenit
// dipertahankan hanya agar pemanggil lama tetap jalan, nilainya diabaikan).
// opsi.admin = true (hanya berlaku jika admin login): jam yang sudah lewat hari ini tetap ditampilkan.
// opsi.kecualiBookingId: abaikan booking ini (dipakai saat reschedule agar jam sendiri tidak dianggap penuh).
export async function getAvailableSlots(
  tanggal: string,
  durasiMenit: number = 30,
  _jamBuka?: string,
  _jamTutup?: string,
  _intervalMenit?: number,
  opsi?: { kecualiBookingId?: string; admin?: boolean }
): Promise<string[]> {
  void _jamBuka
  void _jamTutup
  void _intervalMenit
  try {
    if (!formatTanggalValid(tanggal)) return []
    const supabase = await createAdminClient()

    // Cek apakah tanggal studio ditutup/libur
    const closedInfo = await checkIsDateClosed(supabase, tanggal)
    if (closedInfo) {
      return []
    }

    let sebagaiAdmin = false
    if (opsi?.admin) {
      const auth = await requireAdmin()
      sebagaiAdmin = !('error' in auth)
    }

    let query = supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', tanggal)
      .in('status', ['pending', 'booking'])
    if (opsi?.kecualiBookingId) query = query.neq('id', opsi.kecualiBookingId)
    const { data: blocked, error } = await query

    if (error) {
      console.error('Error fetching bookings for slots:', error)
      return []
    }

    const { jamBuka: b, jamTutup: t, slotInterval: intv } = await bacaPengaturanOperasional(supabase)
    const durasi = Number(durasiMenit) || 30

    const start = timeToMinutes(b)
    const end = timeToMinutes(t)
    const hariIni = hariIniWIB()
    if (!sebagaiAdmin && tanggal < hariIni) return []
    const batasLewat = !sebagaiAdmin && tanggal === hariIni ? menitSekarangWIB() : -1

    const normalizedBlocked = (blocked || []).map(item => ({
      jam_mulai: item.jam_mulai ? String(item.jam_mulai).slice(0, 5) : '00:00',
      durasi_total: Number(item.durasi_total) || 0,
    }))

    const slots: string[] = []
    for (let cur = start; cur + durasi <= end; cur += intv) {
      if (cur <= batasLewat) continue // jam yang sudah lewat tidak ditawarkan
      const h = Math.floor(cur / 60).toString().padStart(2, '0')
      const m = (cur % 60).toString().padStart(2, '0')
      const slot = `${h}:${m}`
      if (!isSlotBlocked(slot, durasi, normalizedBlocked)) {
        slots.push(slot)
      }
    }
    return slots
  } catch (err) {
    console.error('Failed getAvailableSlots:', err)
    return []
  }
}

// ---- Admin: update booking status ----
export async function updateBookingStatus(
  bookingId: string,
  statusBaru: BookingStatus,
  catatan?: string,
  _adminEmail?: string
) {
  void _adminEmail // email diambil dari sesi login
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createAdminClient()

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) return { error: 'Booking tidak ditemukan.' }

  const current = existing.status as BookingStatus
  const allowed: Record<BookingStatus, BookingStatus[]> = {
    pending:    ['booking', 'dibatalkan'],
    booking:    ['selesai', 'dibatalkan'],
    selesai:    [],
    dibatalkan: [],
  }

  if (!allowed[current]?.includes(statusBaru)) {
    return { error: `Tidak bisa mengubah status dari ${current} ke ${statusBaru}.` }
  }

  // .eq('status', current): kalau admin lain sudah mengubahnya, update ini tidak menimpa
  const { data: updated, error } = await supabase
    .from('bookings')
    .update({ status: statusBaru })
    .eq('id', bookingId)
    .eq('status', current)
    .select('id')

  if (error) return { error: error.message }
  if (!updated || updated.length === 0) {
    return { error: 'Status booking sudah diubah pihak lain. Muat ulang halaman.' }
  }

  const { error: logError } = await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: current,
    status_ke: statusBaru,
    catatan: catatan || null,
    oleh: auth.email,
  })
  if (logError) console.error('Gagal menulis log status:', logError.message)

  revalidatePath('/admin/bookings')
  return { success: true }
}

// ---- Admin: update booking schedule and/or package (reschedule & edit paket) ----
export async function updateBookingSchedule(
  bookingId: string,
  tanggal: string,
  jamMulai: string,
  _adminEmail?: string,
  keterangan?: string,
  newPackageId?: string
) {
  void _adminEmail // email diambil dari sesi login
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createAdminClient()

  if (!formatTanggalValid(tanggal)) return { error: 'Tanggal tidak valid.' }
  if (!formatJamValid(jamMulai)) return { error: 'Jam tidak valid.' }
  const jamBaru = normalizeTime(jamMulai)

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('*, booking_addons(*)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) return { error: 'Booking tidak ditemukan.' }

  // Booking yang sudah selesai / dibatalkan tidak boleh dijadwal ulang
  if (!['pending', 'booking'].includes(existing.status)) {
    return { error: 'Jadwal hanya bisa diubah pada booking berstatus Menunggu atau Dikonfirmasi.' }
  }

  const ketTrimmed = keterangan?.trim()
  const jamLama = normalizeTime(existing.jam_mulai)
  const updates: Record<string, unknown> = {
    tanggal,
    jam_mulai: jamBaru,
  }

  let packageChangeNote = ''
  let paketBerubah = false
  if (newPackageId && newPackageId !== existing.package_id) {
    const { data: pkgData, error: pkgError } = await supabase
      .from('packages')
      .select('*, categories(nama)')
      .eq('id', newPackageId)
      .single()

    if (pkgError || !pkgData) {
      return { error: 'Paket foto baru tidak ditemukan.' }
    }

    paketBerubah = true
    const categoryNama = (pkgData.categories as { nama?: string })?.nama || existing.category_nama

    // Hitung total durasi baru (durasi paket baru + addon jenis waktu jika ada)
    const addons = (existing.booking_addons || []) as { jenis: string; jumlah: number; total: number; harga: number; menit_per_unit?: number | null }[]
    const addonWaktuMenit = hitungMenitAddon(addons)
    const durasiTotal = (pkgData.durasi_menit || 30) + addonWaktuMenit

    // Hitung total harga baru (harga paket baru + sum total addon)
    const totalAddons = addons.reduce((sum, a) => sum + (a.total || (a.harga * a.jumlah) || 0), 0)
    const totalHarga = (pkgData.harga || 0) + totalAddons

    // Clean snapshot without relations
    const cleanPkg = { ...pkgData }
    delete (cleanPkg as { categories?: unknown }).categories

    updates.category_id = pkgData.category_id
    updates.category_nama = categoryNama
    updates.package_id = pkgData.id
    updates.package_nama = pkgData.nama
    updates.package_harga = pkgData.harga
    updates.package_snapshot = cleanPkg
    updates.durasi_total = durasiTotal
    updates.total_harga = totalHarga

    // Status cetak ikut menyesuaikan paket baru
    const adaCetakAddon = addons.some(a => a.jenis === 'cetak')
    const butuhCetak = paketPunyaCetak(pkgData as Package) || adaCetakAddon
    if (butuhCetak && !existing.status_cetak) updates.status_cetak = 'menunggu'
    if (!butuhCetak && existing.status_cetak === 'menunggu') updates.status_cetak = null

    packageChangeNote = `Paket diubah dari "${existing.package_nama}" ke "${pkgData.nama}" (${pkgData.harga ? 'Rp ' + Number(pkgData.harga).toLocaleString('id-ID') : 'Rp 0'})`
  }

  // Bangun catatan riwayat
  const changes: string[] = []
  const jadwalBerubah = existing.tanggal !== tanggal || jamLama !== jamBaru
  if (jadwalBerubah || paketBerubah) {
    const effectiveDuration = (updates.durasi_total as number) || existing.durasi_total || 30

    // Tanggal libur (hanya dicek jika jadwal diganti)
    if (jadwalBerubah) {
      const closedInfo = await checkIsDateClosed(supabase, tanggal)
      if (closedInfo) return { error: pesanTutup(tanggal, closedInfo) }
    }

    // Jam operasional (dari Pengaturan) + batas jam tutup
    const { jamBuka, jamTutup } = await bacaPengaturanOperasional(supabase)
    if (!isSlotWithinOperatingHours(jamBaru, effectiveDuration, jamBuka, jamTutup)) {
      return {
        error: `Jam ${jamBaru} WIB dengan durasi ${effectiveDuration} menit berada di luar jam operasional atau melewati jam tutup studio (${jamBuka} - ${jamTutup}).`,
      }
    }

    // Cek ketersediaan slot (kecuali booking yang sedang di-edit)
    const { data: clashingBookings } = await supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', tanggal)
      .in('status', ['pending', 'booking'])
      .neq('id', bookingId)

    if (clashingBookings && isSlotBlocked(jamBaru, effectiveDuration, clashingBookings)) {
      return { error: 'Slot jam pada tanggal tersebut sudah dipesan. Pilih jam lain.' }
    }

    if (jadwalBerubah) {
      changes.push(`Jadwal: ${existing.tanggal} ${jamLama} ➔ ${tanggal} ${jamBaru}`)
    }
  }
  if (packageChangeNote) {
    changes.push(packageChangeNote)
  }
  if (ketTrimmed) {
    changes.push(`Keterangan: ${ketTrimmed}`)
  }

  if (changes.length === 0) {
    return { success: true } // tidak ada yang berubah
  }

  const noteText = `[Update: ${changes.join(' | ')}]`
  updates.catatan = existing.catatan
    ? `${existing.catatan}\n${noteText}`
    : noteText

  const { data: updated, error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)
    .in('status', ['pending', 'booking'])
    .select('id')

  if (error) {
    if (error.code === KODE_UNIK_DILANGGAR) return { error: PESAN_SLOT_PENUH }
    return { error: error.message }
  }
  if (!updated || updated.length === 0) {
    return { error: 'Status booking baru saja berubah. Muat ulang halaman lalu coba lagi.' }
  }

  const { error: logError } = await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: existing.status,
    status_ke: existing.status, // status tidak berubah; kolom ini wajib terisi
    catatan: `Diperbarui oleh admin. ${changes.join('. ')}`,
    oleh: auth.email,
  })
  if (logError) console.error('Gagal menulis log jadwal:', logError.message)

  revalidatePath('/admin/bookings')
  revalidatePath('/')
  return { success: true }
}

// ---- Admin: mark waiting list contacted ----
export async function markWaitingListContacted(id: string) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }
  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('waiting_list')
    .update({ sudah_dihubungi: true })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/waitinglist')
  return { success: true }
}

// ---- Admin: update settings ----
const KUNCI_PENGATURAN = new Set([
  'nama_studio', 'wa_admin', 'rekening_bni', 'rekening_bri', 'nama_rekening',
  'dp_minimal', 'teks_sambutan', 'tampilkan_waiting', 'jam_buka', 'jam_tutup',
  'slot_interval', 'max_booking_per_slot', 'backgrounds', 'closed_dates',
])

export async function updateSetting(key: string, value: unknown) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (!KUNCI_PENGATURAN.has(key)) return { error: `Pengaturan "${key}" tidak dikenal.` }
  if (['dp_minimal', 'slot_interval', 'max_booking_per_slot'].includes(key)) {
    const n = Number(value)
    if (!Number.isFinite(n) || n < 0 || (key !== 'dp_minimal' && n < 1)) {
      return { error: 'Angka tidak valid.' }
    }
  }
  if (['jam_buka', 'jam_tutup'].includes(key) && !formatJamValid(value)) {
    return { error: 'Format jam tidak valid (contoh 08:00).' }
  }
  if (['closed_dates', 'backgrounds'].includes(key) && !Array.isArray(value)) {
    return { error: 'Format data tidak valid.' }
  }

  const supabase = await createAdminClient()
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value })
  if (error) return { error: error.message }
  revalidatePath('/')
  revalidatePath('/admin/settings')
  return { success: true }
}

// ---- Admin: upload background photo ----
export async function uploadBackgroundImage(formData: FormData) {
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  const file = formData.get('file') as File | null
  if (!file) return { error: 'File foto tidak ditemukan' }
  if (!file.type.startsWith('image/')) return { error: 'File harus berupa gambar.' }
  if (file.size > 8 * 1024 * 1024) return { error: 'Ukuran foto maksimal 8 MB.' }

  const supabase = await createAdminClient()
  const extAsli = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '')
  const ext = extAsli || 'jpg'
  const fileName = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error: uploadError } = await supabase.storage
    .from('backgrounds')
    .upload(fileName, buffer, {
      contentType: file.type || 'image/jpeg',
      cacheControl: '3600',
      upsert: true,
    })

  if (uploadError) {
    console.error('Error uploading background image:', uploadError)
    return { error: uploadError.message }
  }

  const { data: publicUrlData } = supabase.storage
    .from('backgrounds')
    .getPublicUrl(fileName)

  return { success: true, url: publicUrlData.publicUrl }
}

// ---- Admin: get signed URL untuk bukti transfer ----
export async function getBuktiTransferSignedUrl(fileName: string): Promise<{ url?: string; error?: string }> {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return { error: auth.error }
    const supabase = await createAdminClient()
    const { data, error } = await supabase.storage
      .from('bukti-transfer')
      .createSignedUrl(fileName, 3600) // berlaku 1 jam

    if (error || !data) {
      return { error: error?.message || 'Gagal memuat URL bukti transfer' }
    }
    return { url: data.signedUrl }
  } catch (err: unknown) {
    return { error: (err as Error)?.message || 'Terjadi kesalahan' }
  }
}

// ---- Admin: update status cetak foto ----
export async function updateCetakStatus(
  bookingId: string,
  statusCetak: CetakStatus | null,
  _adminEmail?: string
) {
  void _adminEmail // email diambil dari sesi login
  const auth = await requireAdmin()
  if ('error' in auth) return { error: auth.error }

  if (statusCetak !== null && !['menunggu', 'proses', 'selesai'].includes(statusCetak)) {
    return { error: 'Status cetak tidak valid.' }
  }

  const supabase = await createAdminClient()

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('status')
    .eq('id', bookingId)
    .single()
  if (fetchError || !existing) return { error: 'Booking tidak ditemukan.' }

  const { error } = await supabase
    .from('bookings')
    .update({ status_cetak: statusCetak })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  const { error: logError } = await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: existing.status,
    status_ke: existing.status, // status booking tidak berubah; kolom ini wajib terisi
    catatan: statusCetak
      ? `Status cetak foto diubah ke: ${statusCetak}`
      : 'Status cetak foto direset',
    oleh: auth.email,
  })
  if (logError) console.error('Gagal menulis log cetak:', logError.message)

  revalidatePath('/admin/bookings')
  return { success: true }
}

// ---- Admin: delete booking permanently ----
export async function deleteBooking(bookingId: string) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return { error: auth.error }
    const supabase = await createAdminClient()

    // Ambil info bukti transfer jika ada untuk dibersihkan dari storage
    const { data: booking } = await supabase
      .from('bookings')
      .select('bukti_transfer')
      .eq('id', bookingId)
      .single()

    if (booking?.bukti_transfer) {
      try {
        await supabase.storage
          .from('bukti-transfer')
          .remove([booking.bukti_transfer])
      } catch (storageErr) {
        console.warn('Gagal menghapus file bukti transfer:', storageErr)
      }
    }

    // Hapus booking (booking_addons & booking_status_log ikut terhapus via CASCADE)
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', bookingId)

    if (error) return { error: error.message }

    revalidatePath('/admin/bookings')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: (err as Error)?.message || 'Gagal menghapus data booking' }
  }
}

// ---- Admin: delete waiting list permanently ----
export async function deleteWaitingList(id: string) {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return { error: auth.error }
    const supabase = await createAdminClient()
    const { error } = await supabase
      .from('waiting_list')
      .delete()
      .eq('id', id)

    if (error) return { error: error.message }

    revalidatePath('/admin/waitinglist')
    revalidatePath('/')
    return { success: true }
  } catch (err: unknown) {
    return { error: (err as Error)?.message || 'Gagal menghapus data waiting list' }
  }
}

// ============================================================
// ADMIN: ADD-ON DI LAPANGAN
// Semua penulisan lewat fungsi Postgres `terapkan_addon_lapangan`
// (satu transaksi, RLS admin berlaku). Rumus di src/lib/addon-calc.ts.
// ============================================================

export interface AddonLapanganItem {
  addon_id: string
  jumlah: number
}

const STATUS_BOLEH_LAPANGAN = ['pending', 'booking']

function rupiahLog(n: number) {
  return `Rp ${Math.abs(n).toLocaleString('id-ID')}`
}

async function terapkanRencanaLapangan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  booking: {
    id: string
    updated_at: string | null
    status_cetak: string | null
    package_snapshot: Package | null
    booking_addons?: BarisBookingAddon[]
  },
  rencana: RencanaPerubahan,
  opts: { pilihanBackground: string[] | null; log: string; email: string }
) {
  const barisSetelah = terapkanRencanaKeBaris(booking.booking_addons || [], rencana)
  const aksiCetak = tentukanAksiCetak({
    statusCetak: booking.status_cetak,
    paketPunyaCetak: paketPunyaCetak(booking.package_snapshot),
    barisSetelah,
    adaCetakBaru: rencana.adaCetak,
  })

  const { data, error } = await supabase.rpc('terapkan_addon_lapangan', {
    p_booking_id: booking.id,
    p_expected_updated_at: booking.updated_at,
    p_update_rows: rencana.updateRows,
    p_insert_rows: rencana.insertRows,
    p_delta_harga: rencana.deltaHarga,
    p_delta_menit: rencana.deltaMenit,
    p_cetak_aksi: aksiCetak,
    p_pilihan_background: opts.pilihanBackground,
    p_log: opts.log,
    p_oleh: opts.email,
  })

  if (error) {
    if (/terapkan_addon_lapangan/i.test(error.message) && /(not find|does not exist|schema cache)/i.test(error.message)) {
      return { error: 'Fungsi database belum tersedia. Jalankan migrasi 005_addon_lapangan_menit.sql di Supabase terlebih dahulu.' }
    }
    return { error: error.message }
  }

  revalidatePath('/admin/bookings')
  return {
    success: true as const,
    hasil: data as { total_harga: number; durasi_total: number; sisa_pelunasan: number },
  }
}

// ---- Admin: tambah add-on di lapangan ke booking yang sudah ada ----
export async function addAddonsToBooking(
  bookingId: string,
  items: AddonLapanganItem[],
  catatan?: string,
  backgroundsDipilih?: string[],
  izinkanLewatJamTutup: boolean = false
): Promise<{ error?: string; perluKonfirmasiJamTutup?: boolean; success?: boolean }> {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return { error: auth.error }
    const { supabase, email } = auth

    // 1. Booking + add-on yang sudah ada
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('*, booking_addons(*)')
      .eq('id', bookingId)
      .single()

    if (fetchError || !booking) return { error: 'Booking tidak ditemukan.' }

    if (!STATUS_BOLEH_LAPANGAN.includes(booking.status)) {
      return { error: `Add-on di lapangan hanya untuk booking berstatus Pending atau Booking. Status saat ini: ${booking.status}.` }
    }

    // 2. Harga, maks & menit_per_unit TERBARU dari tabel addons + add-on aktif untuk kategori
    const addonIds = Array.from(new Set((items || []).map(it => it.addon_id).filter(Boolean)))
    if (addonIds.length === 0) return { error: 'Pilih minimal satu add-on dengan jumlah lebih dari 0.' }

    const [{ data: masters, error: masterError }, { data: addonCats }] = await Promise.all([
      supabase.from('addons').select('id, jenis, nama, satuan, harga, maks, menit_per_unit').in('id', addonIds),
      booking.category_id
        ? supabase.from('addon_categories').select('addon_id').eq('category_id', booking.category_id)
        : Promise.resolve({ data: null }),
    ])
    if (masterError) return { error: 'Gagal mengambil data add-on.' }

    const allowed = addonCats ? new Set<string>(addonCats.map((r: { addon_id: string }) => r.addon_id)) : null

    // 3. Susun rencana (validasi maks, penggabungan baris, hitung harga & durasi)
    const existing = (booking.booking_addons || []) as BarisBookingAddon[]
    const hasil = rencanakanTambahAddon(existing, (masters || []) as MasterAddon[], items, allowed)
    if (!hasil.ok) return { error: hasil.error }
    const rencana = hasil.rencana

    // 4. Warna background tambahan (maksimal sebanyak unit add-on background yang ditambah)
    const bgLama: string[] = Array.isArray(booking.pilihan_background) ? booking.pilihan_background : []
    const bgBaru = Array.from(new Set((backgroundsDipilih || []).map(b => String(b).trim()).filter(Boolean)))
      .filter(b => !bgLama.includes(b))
    const bgBoleh = new Set((await bacaBackgroundKategori(supabase, booking.category_id)).map(b => b.nama))
    if (bgBaru.some(b => !bgBoleh.has(b))) {
      return { error: 'Ada warna background yang tidak tersedia untuk kategori booking ini.' }
    }
    if (bgBaru.length > rencana.tambahanBackground) {
      return { error: `Warna background tambahan maksimal ${rencana.tambahanBackground}.` }
    }
    const pilihanBackground = bgBaru.length > 0 ? [...bgLama, ...bgBaru] : null

    // 5. Cek jam tutup (boleh lanjut hanya dengan konfirmasi admin)
    const durasiBaru = (booking.durasi_total || 0) + rencana.deltaMenit
    let lewatJamTutup = false
    if (rencana.deltaMenit > 0) {
      const { data: tutupRow } = await supabase.from('settings').select('value').eq('key', 'jam_tutup').maybeSingle()
      const jamTutup = typeof tutupRow?.value === 'string' ? tutupRow.value : '20:00'
      const jamMulai = String(booking.jam_mulai).slice(0, 5)
      lewatJamTutup = !isSlotWithinOperatingHours(jamMulai, durasiBaru, '00:00', jamTutup)
      if (lewatJamTutup && !izinkanLewatJamTutup) {
        return {
          error: `Durasi baru (${durasiBaru} menit) membuat sesi selesai melewati jam tutup ${jamTutup}. Centang konfirmasi untuk tetap melanjutkan.`,
          perluKonfirmasiJamTutup: true,
        }
      }
    }

    // 6. Catatan log
    const bagian = [`+${rupiahLog(rencana.deltaHarga)}`]
    if (rencana.deltaMenit > 0) bagian.push(`+${rencana.deltaMenit} menit`)
    let log = `Add-on di lapangan: ${rencana.rincian.join(', ')} (${bagian.join(', ')})`
    if (bgBaru.length > 0) log += `. Warna tambahan: ${bgBaru.join(', ')}`
    if (lewatJamTutup) log += '. Melewati jam tutup (disetujui admin)'
    if (catatan?.trim()) log += `. Catatan: ${catatan.trim()}`

    // 7. Simpan (satu transaksi)
    const res = await terapkanRencanaLapangan(supabase, booking, rencana, {
      pilihanBackground,
      log,
      email,
    })
    if ('error' in res) return { error: res.error }
    return { success: true }
  } catch (err: unknown) {
    return { error: (err as Error)?.message || 'Terjadi kesalahan saat menambahkan add-on di lapangan.' }
  }
}

// ---- Admin: kurangi / hapus add-on tambahan di lapangan ----
// Hanya baris ditambah_oleh_admin = true. Add-on pesanan awal klien tidak bisa disentuh.
export async function kurangiAddonLapangan(
  bookingAddonId: string,
  jumlahKurang: number
): Promise<{ error?: string; success?: boolean }> {
  try {
    const auth = await requireAdmin()
    if ('error' in auth) return { error: auth.error }
    const { supabase, email } = auth

    const { data: row, error: rowError } = await supabase
      .from('booking_addons')
      .select('*')
      .eq('id', bookingAddonId)
      .single()
    if (rowError || !row) return { error: 'Data add-on tidak ditemukan.' }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('*, booking_addons(*)')
      .eq('id', row.booking_id)
      .single()
    if (bookingError || !booking) return { error: 'Booking terkait tidak ditemukan.' }

    if (!STATUS_BOLEH_LAPANGAN.includes(booking.status)) {
      return { error: `Add-on tidak bisa diubah untuk booking berstatus ${booking.status}.` }
    }

    const hasil = rencanakanKurangiAddon(row as BarisBookingAddon, jumlahKurang)
    if (!hasil.ok) return { error: hasil.error }
    const rencana = hasil.rencana

    const sisa = row.jumlah - jumlahKurang
    const bagian = [`-${rupiahLog(rencana.deltaHarga)}`]
    if (rencana.deltaMenit < 0) bagian.push(`${rencana.deltaMenit} menit`)
    const log = `Koreksi add-on di lapangan: ${row.nama} -${jumlahKurang}${sisa > 0 ? ` (sisa ${sisa})` : ' (dihapus)'} (${bagian.join(', ')})`

    const res = await terapkanRencanaLapangan(supabase, booking, rencana, {
      pilihanBackground: null,
      log,
      email,
    })
    if ('error' in res) return { error: res.error }
    return { success: true }
  } catch (err: unknown) {
    return { error: (err as Error)?.message || 'Gagal mengoreksi add-on di lapangan.' }
  }
}
