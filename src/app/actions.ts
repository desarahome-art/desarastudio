'use server'

import { createAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { BookingFormData, BookingStatus, CetakStatus, Package, ClosedDateItem } from '@/types'
import {
  isSlotBlocked,
  generateTimeSlots,
  parseWaitingListInfo,
  isSlotWithinOperatingHours,
} from '@/lib/utils'

// Helper to check if a date is closed by studio admin
async function checkIsDateClosed(supabase: Awaited<ReturnType<typeof createAdminClient>>, tanggal: string): Promise<ClosedDateItem | null> {
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


// ---- Public: submit booking ----
export async function submitBooking(formData: BookingFormData) {
  const supabase = await createAdminClient()

  // 0. Cek apakah studio tutup pada tanggal tersebut
  const closedInfo = await checkIsDateClosed(supabase, formData.tanggal)
  if (closedInfo) {
    return {
      error: `Studio tutup pada tanggal ${formData.tanggal}${closedInfo.keterangan ? ` (${closedInfo.keterangan})` : ''}. Silakan pilih tanggal lain.`,
    }
  }

  // Check slot availability server-side
  const jamMulai = formData.jam_mulai
  const durasiTotal =
    formData.package.durasi_menit +
    formData.addons
      .filter(a => a.addon.jenis === 'waktu')
      .reduce((sum, a) => sum + a.jumlah * 15, 0)

  // 0b. Cek jam operasional studio & batas jam tutup
  const { data: opSettings } = await supabase
    .from('settings')
    .select('key, value')
    .in('key', ['jam_buka', 'jam_tutup'])

  let jamBuka = '08:00'
  let jamTutup = '20:00'
  if (opSettings) {
    for (const s of opSettings) {
      if (s.key === 'jam_buka' && typeof s.value === 'string') jamBuka = s.value
      if (s.key === 'jam_tutup' && typeof s.value === 'string') jamTutup = s.value
    }
  }

  if (!isSlotWithinOperatingHours(jamMulai, durasiTotal, jamBuka, jamTutup)) {
    return {
      error: `Waktu sesi (${jamMulai} WIB dengan durasi ${durasiTotal} menit) berada di luar jam operasional atau melewati jam tutup studio (${jamBuka} - ${jamTutup}).`,
    }
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
    return { error: 'Slot jam sudah dipesan. Pilih jam lain.' }
  }

  const buktiPath = formData.bukti_transfer || null

  // Calculate total
  const totalAddons = formData.addons.reduce(
    (sum, a) => sum + a.addon.harga * a.jumlah,
    0
  )
  const totalHarga = formData.package.harga + totalAddons

  // Insert booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      kode: '', // trigger will generate
      nama_klien: formData.nama,
      wa_klien: formData.wa_klien,
      kampus: formData.kampus || null,
      tanggal: formData.tanggal,
      jam_mulai: jamMulai,
      durasi_total: durasiTotal,
      category_id: formData.category.id,
      category_nama: formData.category.nama,
      package_id: formData.package.id,
      package_nama: formData.package.nama,
      package_harga: formData.package.harga,
      package_snapshot: formData.package,
      total_harga: totalHarga,
      dp_dibayar: formData.dp_dibayar,
      catatan: formData.catatan || null,
      pilihan_background: formData.pilihan_background,
      bukti_transfer: buktiPath,
      status: 'pending',
    })
    .select()
    .single()

  if (bookingError || !booking) {
    return { error: bookingError?.message || 'Gagal menyimpan booking.' }
  }

  // Insert add-ons
  if (formData.addons.length > 0) {
    await supabase.from('booking_addons').insert(
      formData.addons.map(a => ({
        booking_id: booking.id,
        addon_id: a.addon.id,
        jenis: a.addon.jenis,
        nama: a.addon.nama,
        satuan: a.addon.satuan,
        harga: a.addon.harga,
        jumlah: a.jumlah,
      }))
    )
  }

  // Log status
  await supabase.from('booking_status_log').insert({
    booking_id: booking.id,
    status_dari: null,
    status_ke: 'pending',
    oleh: 'system',
    catatan: 'Booking dibuat oleh klien',
  })

  return { success: true, booking }
}

// ---- Public: submit waiting list ----
export async function submitWaitingList(data: {
  nama: string
  wa: string
  category_id: string
  category_nama: string
  package_nama?: string
  kampus?: string
  acara_id?: string
  acara_nama?: string
  tanggal_ingin?: string
  jam_ingin: string
  catatan?: string
  dp_minimal?: number
}) {
  const supabase = await createAdminClient()

  if (!data.jam_ingin) {
    return { error: 'Jam sesi waiting list wajib dipilih.' }
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
      return {
        error: `Studio tutup pada tanggal ${data.tanggal_ingin}${closedInfo.keterangan ? ` (${closedInfo.keterangan})` : ''}. Silakan pilih tanggal lain.`,
      }
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

  const dpAmount = data.dp_minimal || 100000

  // Format catatan lengkap
  const detailList: string[] = [
    `[Jam: ${data.jam_ingin}]`,
    `DP: Rp ${dpAmount.toLocaleString('id-ID')} (via WA)`,
  ]
  if (data.kampus?.trim()) detailList.push(`Kampus/Instansi: ${data.kampus.trim()}`)
  if (data.package_nama?.trim()) detailList.push(`Paket: ${data.package_nama.trim()}`)
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
  adminEmail?: string
) {
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

  if (!tanggalFoto) {
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
    return {
      error: `Studio tutup pada tanggal ${tanggalFoto}${closedInfo.keterangan ? ` (${closedInfo.keterangan})` : ''}. Pilih tanggal lain.`,
    }
  }

  // 2. Ambil paket untuk kategori ini — prioritaskan package_nama dari waiting list jika ada
  const { data: packages } = await supabase
    .from('packages')
    .select('*')
    .eq('category_id', wl.category_id)
    .eq('aktif', true)
    .order('urutan', { ascending: true })

  // Coba cocokkan package_nama yang dipilih client di waiting list
  let selectedPkg: Package | undefined
  if (wl.package_nama && packages && packages.length > 0) {
    selectedPkg = packages.find(
      (p: Package) => p.nama.toLowerCase() === wl.package_nama.toLowerCase()
    )
  }
  // Fallback ke paket pertama jika tidak ditemukan
  if (!selectedPkg) {
    selectedPkg = packages && packages.length > 0
      ? packages[0]
      : {
          id: '00000000-0000-0000-0000-000000000000',
          category_id: wl.category_id || '',
          nama: 'Paket Standard (Waiting List)',
          harga: 100000,
          durasi_menit: 30,
          jumlah_pilihan_background: 1,
          maks_orang: 2,
          cetak_ukuran: null,
          cetak_jumlah: null,
          jumlah_foto_edit: null,
          bonus: null,
          urutan: 1,
          aktif: true,
          created_at: new Date().toISOString(),
        }
  }

  const tanggal = tanggalFoto
  const jamMulai = parsedInfo.jam || '09:00'
  const durasiTotal = selectedPkg!.durasi_menit || 30
  const dpDibayar = 100000
  const totalHarga = selectedPkg!.harga || 100000

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
      package_id: selectedPkg!.id,
      package_nama: selectedPkg!.nama,
      package_harga: selectedPkg!.harga,
      package_snapshot: selectedPkg!,
      total_harga: totalHarga,
      dp_dibayar: dpDibayar,
      catatan: `[Dikonversi dari Waiting List] ${wl.catatan || ''}`.trim(),
      pilihan_background: [],
      bukti_transfer: null,
      status: 'pending',
    })
    .select()
    .single()

  if (insertError || !newBooking) {
    return { error: insertError?.message || 'Gagal memasukkan data ke booking: ' + (insertError?.message || '') }
  }

  // 4. Log status ke booking_status_log
  await supabase.from('booking_status_log').insert({
    booking_id: newBooking.id,
    status_dari: null,
    status_ke: 'pending',
    oleh: adminEmail || 'admin',
    catatan: 'Booking dibuat otomatis dari data Waiting List oleh admin',
  })

  // 5. Update catatan di waiting_list agar tertandai sudah dikonversi
  const updatedWlCatatan = `${wl.catatan || ''} [Sudah Masuk Booking: ${newBooking.kode}]`.trim()
  await supabase
    .from('waiting_list')
    .update({
      sudah_dihubungi: true,
      catatan: updatedWlCatatan,
    })
    .eq('id', waitingListId)

  revalidatePath('/admin/waitinglist')
  revalidatePath('/admin/bookings')
  revalidatePath('/')

  return { success: true, bookingKode: newBooking.kode }
}


// ---- Public: get available slots ----
export async function getAvailableSlots(
  tanggal: string,
  durasiMenit: number = 30,
  jamBuka: string = '08:00',
  jamTutup: string = '20:00',
  intervalMenit: number = 30
): Promise<string[]> {
  try {
    const supabase = await createAdminClient()

    // Cek apakah tanggal studio ditutup/libur
    const closedInfo = await checkIsDateClosed(supabase, tanggal)
    if (closedInfo) {
      return []
    }

    const { data: blocked, error } = await supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', tanggal)
      .in('status', ['pending', 'booking'])

    if (error) {
      console.error('Error fetching bookings for slots:', error)
    }

    const b = jamBuka || '08:00'
    const t = jamTutup || '20:00'
    const intv = Number(intervalMenit) || 30
    const durasi = Number(durasiMenit) || 30

    const slots: string[] = []
    const [bH, bM] = b.split(':').map(Number)
    const [tH, tM] = t.split(':').map(Number)
    const start = (Number.isFinite(bH) ? bH : 8) * 60 + (Number.isFinite(bM) ? bM : 0)
    const end = (Number.isFinite(tH) ? tH : 20) * 60 + (Number.isFinite(tM) ? tM : 0)

    const normalizedBlocked = (blocked || []).map(item => ({
      jam_mulai: item.jam_mulai ? String(item.jam_mulai).slice(0, 5) : '00:00',
      durasi_total: Number(item.durasi_total) || 0,
    }))

    for (let cur = start; cur + durasi <= end; cur += intv) {
      const h = Math.floor(cur / 60).toString().padStart(2, '0')
      const m = (cur % 60).toString().padStart(2, '0')
      const slot = `${h}:${m}`
      if (!isSlotBlocked(slot, durasi, normalizedBlocked)) {
        slots.push(slot)
      }
    }
    return slots
  } catch (err) {
    console.error('Failed getAvailableSlots, using default fallback:', err)
    const fallbackSlots: string[] = []
    const durasi = Number(durasiMenit) || 30
    for (let cur = 8 * 60; cur + durasi <= 20 * 60; cur += 30) {
      const h = Math.floor(cur / 60).toString().padStart(2, '0')
      const m = (cur % 60).toString().padStart(2, '0')
      fallbackSlots.push(`${h}:${m}`)
    }
    return fallbackSlots
  }
}

// ---- Admin: update booking status ----
export async function updateBookingStatus(
  bookingId: string,
  statusBaru: BookingStatus,
  catatan?: string,
  adminEmail?: string
) {
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

  if (!allowed[current].includes(statusBaru)) {
    return { error: `Tidak bisa mengubah status dari ${current} ke ${statusBaru}.` }
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: statusBaru })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: current,
    status_ke: statusBaru,
    catatan: catatan || null,
    oleh: adminEmail || 'admin',
  })

  revalidatePath('/admin/bookings')
  return { success: true }
}

// ---- Admin: update booking schedule and/or package (reschedule & edit paket) ----
export async function updateBookingSchedule(
  bookingId: string,
  tanggal: string,
  jamMulai: string,
  adminEmail?: string,
  keterangan?: string,
  newPackageId?: string
) {
  const supabase = await createAdminClient()

  const { data: existing, error: fetchError } = await supabase
    .from('bookings')
    .select('*, booking_addons(*)')
    .eq('id', bookingId)
    .single()

  if (fetchError || !existing) return { error: 'Booking tidak ditemukan.' }

  const ketTrimmed = keterangan?.trim()
  const updates: Record<string, unknown> = {
    tanggal,
    jam_mulai: jamMulai,
  }

  let packageChangeNote = ''
  if (newPackageId && newPackageId !== existing.package_id) {
    const { data: pkgData, error: pkgError } = await supabase
      .from('packages')
      .select('*, categories(nama)')
      .eq('id', newPackageId)
      .single()

    if (pkgError || !pkgData) {
      return { error: 'Paket foto baru tidak ditemukan.' }
    }

    const categoryNama = (pkgData.categories as { nama?: string })?.nama || existing.category_nama

    // Hitung total durasi baru (durasi paket baru + addon jenis waktu jika ada)
    const addons = (existing.booking_addons || []) as { jenis: string; jumlah: number; total: number; harga: number }[]
    const addonWaktuMenit = addons
      .filter(a => a.jenis === 'waktu')
      .reduce((sum, a) => sum + (a.jumlah * 15), 0)
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

    packageChangeNote = `Paket diubah dari "${existing.package_nama}" ke "${pkgData.nama}" (${pkgData.harga ? 'Rp ' + Number(pkgData.harga).toLocaleString('id-ID') : 'Rp 0'})`
  }

  // Bangun catatan riwayat
  const changes: string[] = []
  if (existing.tanggal !== tanggal || existing.jam_mulai !== jamMulai) {
    const effectiveDuration = (updates.durasi_total as number) || existing.durasi_total || 30

    // Cek ketersediaan slot (kecuali booking yang sedang di-edit)
    const { data: clashingBookings } = await supabase
      .from('bookings')
      .select('jam_mulai, durasi_total')
      .eq('tanggal', tanggal)
      .in('status', ['pending', 'booking'])
      .neq('id', bookingId)

    if (clashingBookings && isSlotBlocked(jamMulai, effectiveDuration, clashingBookings)) {
      return { error: 'Slot jam pada tanggal tersebut sudah dipesan. Pilih jam lain.' }
    }

    changes.push(`Jadwal: ${existing.tanggal} ${existing.jam_mulai} ➔ ${tanggal} ${jamMulai}`)
  }
  if (packageChangeNote) {
    changes.push(packageChangeNote)
  }
  if (ketTrimmed) {
    changes.push(`Keterangan: ${ketTrimmed}`)
  }

  if (changes.length > 0) {
    const noteText = `[Update: ${changes.join(' | ')}]`
    updates.catatan = existing.catatan
      ? `${existing.catatan}\n${noteText}`
      : noteText
  }

  const { error } = await supabase
    .from('bookings')
    .update(updates)
    .eq('id', bookingId)

  if (error) return { error: error.message }

  const logCatatan = changes.length > 0
    ? `Diperbarui oleh admin. ${changes.join('. ')}`
    : `Data diperbarui oleh admin`

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: null,
    status_ke: null,
    catatan: logCatatan,
    oleh: adminEmail || 'admin',
  })

  revalidatePath('/admin/bookings')
  revalidatePath('/')
  return { success: true }
}

// ---- Admin: mark waiting list contacted ----
export async function markWaitingListContacted(id: string) {
  const supabase = await createAdminClient()
  await supabase
    .from('waiting_list')
    .update({ sudah_dihubungi: true })
    .eq('id', id)
  revalidatePath('/admin/waitinglist')
  return { success: true }
}

// ---- Admin: update settings ----
export async function updateSetting(key: string, value: unknown) {
  const supabase = await createAdminClient()
  await supabase
    .from('settings')
    .upsert({ key, value })
  revalidatePath('/')
  revalidatePath('/admin/settings')
  return { success: true }
}

// ---- Admin: upload background photo ----
export async function uploadBackgroundImage(formData: FormData) {
  const file = formData.get('file') as File | null
  if (!file) return { error: 'File foto tidak ditemukan' }

  const supabase = await createAdminClient()
  const ext = file.name.split('.').pop() || 'jpg'
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
  adminEmail?: string
) {
  const supabase = await createAdminClient()

  const { error } = await supabase
    .from('bookings')
    .update({ status_cetak: statusCetak })
    .eq('id', bookingId)

  if (error) return { error: error.message }

  await supabase.from('booking_status_log').insert({
    booking_id: bookingId,
    status_dari: null,
    status_ke: null,
    catatan: statusCetak
      ? `Status cetak foto diubah ke: ${statusCetak}`
      : 'Status cetak foto direset',
    oleh: adminEmail || 'admin',
  })

  revalidatePath('/admin/bookings')
  return { success: true }
}

// ---- Admin: delete booking permanently ----
export async function deleteBooking(bookingId: string) {
  try {
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

