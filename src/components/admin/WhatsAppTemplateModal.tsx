'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { formatRupiah } from '@/lib/utils'
import {
  X,
  MessageCircle,
  Copy,
  Check,
  CalendarCheck,
  ClockAlert,
  Image as ImageIcon,
  Printer,
  ExternalLink,
  Sparkles,
} from 'lucide-react'
import type { Booking } from '@/types'
import { linkAppWhatsApp, linkWebWhatsApp } from '@/lib/whatsapp'

export type WhatsAppTemplateType =
  | 'konfirmasi'
  | 'reminder_h'
  | 'link_foto'
  | 'ambil_cetakan'

interface WhatsAppTemplateModalProps {
  booking: Booking
  namaStudio?: string
  onClose: () => void
}

export function WhatsAppTemplateModal({
  booking,
  namaStudio = 'Desara Home Studio',
  onClose,
}: WhatsAppTemplateModalProps) {
  const [activeTab, setActiveTab] = useState<WhatsAppTemplateType>('konfirmasi')
  const [copied, setCopied] = useState(false)

  // Input tambahan opsional untuk kustomisasi pesan
  const [linkDrive, setLinkDrive] = useState('')
  const catatanLokasi = namaStudio // nama studio dari Pengaturan

  // Deteksi info cetak
  const hasCetakPaket = Boolean(
    booking.package_snapshot?.cetak_ukuran ||
      (booking.package_snapshot?.cetak_jumlah &&
        booking.package_snapshot.cetak_jumlah > 0)
  )
  const cetakAddons = (booking.booking_addons || []).filter(
    a => a.jenis === 'cetak'
  )
  const hasCetak = hasCetakPaket || cetakAddons.length > 0

  const formatTanggalIndo = (tglStr: string) => {
    try {
      return new Date(tglStr).toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    } catch {
      return tglStr
    }
  }

  const tanggalFormatted = formatTanggalIndo(booking.tanggal)

  // Deskripsi rincian cetak foto
  const detailCetakList: string[] = []
  if (hasCetakPaket) {
    detailCetakList.push(
      `${booking.package_snapshot.cetak_ukuran || 'Cetak Foto'} (${
        booking.package_snapshot.cetak_jumlah || 1
      } lembar)`
    )
  }
  if (cetakAddons.length > 0) {
    cetakAddons.forEach(a => {
      detailCetakList.push(`${a.nama} (${a.jumlah}x)`)
    })
  }
  const detailCetakText =
    detailCetakList.length > 0 ? detailCetakList.join(', ') : 'Cetak Foto'

  // Add-on (pesanan awal & tambahan di lapangan) — selalu dari data booking terbaru
  const addonAwal = (booking.booking_addons || []).filter(a => !a.ditambah_oleh_admin)
  const addonTambahan = (booking.booking_addons || []).filter(a => a.ditambah_oleh_admin)
  const barisAddon = [
    addonAwal.length > 0
      ? `• Add-on: ${addonAwal.map(a => `${a.nama} x${a.jumlah}`).join(', ')}`
      : null,
    addonTambahan.length > 0
      ? `• Add-on Tambahan di Studio: ${addonTambahan.map(a => `${a.nama} x${a.jumlah}`).join(', ')}`
      : null,
    hasCetak ? `• Rincian Cetak: ${detailCetakText}` : null,
  ]

  // Generator template pesan WA
  const getMessageText = (tab: WhatsAppTemplateType): string => {
    switch (tab) {
      case 'konfirmasi':
        return [
          `Halo Kak *${booking.nama_klien}*! 👋`,
          ``,
          `Terima kasih telah melakukan pemesanan di *${catatanLokasi}*. Booking kamu sudah *DIKONFIRMASI* ✅`,
          ``,
          `📌 *Detail Reservasi:*`,
          `• Kode Booking: *${booking.kode}*`,
          `• Paket: ${booking.category_nama} - ${booking.package_nama}`,
          ...barisAddon,
          `• Tanggal: *${tanggalFormatted}*`,
          `• Jam Sesi: *${booking.jam_mulai} WIB* (Durasi: ${booking.durasi_total} menit)`,
          booking.pilihan_background?.length
            ? `• Pilihan Background: ${booking.pilihan_background.join(', ')}`
            : null,
          booking.kampus ? `• Instansi/Kampus: ${booking.kampus}` : null,
          ``,
          `💰 *Rincian Pembayaran:*`,
          `• Total Biaya: ${formatRupiah(booking.total_harga)}`,
          `• DP Dibayar: ${formatRupiah(booking.dp_dibayar)}`,
          `• Sisa Pelunasan: *${formatRupiah(booking.sisa_pelunasan)}*`,
          ``,
          `Mohon hadir tepat waktu (disarankan tiba 10-15 menit sebelum sesi dimulai). Sampai jumpa di studio! ✨`,
        ]
          .filter(Boolean)
          .join('\n')

      case 'reminder_h':
        return [
          `Halo Kak *${booking.nama_klien}*! ⏰`,
          ``,
          `Ini pengingat untuk jadwal sesi foto kamu *HARI INI* di *${catatanLokasi}*:`,
          ``,
          `📍 *Jadwal Sesi:*`,
          `• Tanggal: *${tanggalFormatted}*`,
          `• Jam Sesi: *${booking.jam_mulai} WIB*`,
          `• Durasi: ${booking.durasi_total} menit`,
          `• Paket: ${booking.category_nama} - ${booking.package_nama}`,
          ...barisAddon,
          booking.sisa_pelunasan > 0
            ? `• Sisa Pelunasan: *${formatRupiah(booking.sisa_pelunasan)}*`
            : `• Status Pembayaran: *Lunas*`,
          ``,
          `💡 *Tips Penting:*`,
          `1. Mohon hadir 10-15 menit sebelum waktu sesi agar persiapan lebih santai.`,
          `2. Siapkan pakaian, outfit ganti, dan properti yang ingin digunakan.`,
          ``,
          `Jika ada kendala di perjalanan, silakan kabari kami ya. Ditunggu kedatangannya! 🙏✨`,
        ]
          .filter(Boolean)
          .join('\n')

      case 'link_foto':
        const linkDriveText = linkDrive.trim()
          ? linkDrive.trim()
          : '[MASUKKAN_LINK_GOOGLE_DRIVE_DISINI]'

        return [
          `Halo Kak *${booking.nama_klien}*! 📸✨`,
          ``,
          `Terima kasih banyak sudah berfoto di *${catatanLokasi}*!`,
          `Hasil foto sesi kamu (*${booking.kode}*) sudah selesai dan siap diakses melalui tautan berikut:`,
          ``,
          `🔗 *Link Hasil Foto:*`,
          `${linkDriveText}`,
          ``,
          `Mohon untuk segera mendownload dan mem-backup foto-fotonya ya Kak.`,
          hasCetak
            ? `\nℹ️ *Catatan Cetakan:* Pesanan cetak foto kamu sedang kami proses dan akan kami kabari segera setelah selesai ya! 🖼️`
            : ``,
          ``,
          `Jangan lupa tag akun kami di Instagram/TikTok jika kamu mengunggah fotonya ya! Semoga suka dengan hasilnya! 💖`,
        ]
          .filter(Boolean)
          .join('\n')

      case 'ambil_cetakan':
        return [
          `Halo Kak *${booking.nama_klien}*! 🖼️🎉`,
          ``,
          `Kabar baik! Hasil cetakan foto kamu dari sesi (*${booking.kode}*) sudah *SELESAI DICETAK* dan siap diambil:`,
          ``,
          `📦 *Detail Cetakan:*`,
          `• ${detailCetakText}`,
          ``,
          `📍 *Lokasi Pengambilan:*`,
          `*${catatanLokasi}*`,
          ``,
          `Kamu bisa mengambil cetakan pada jam operasional studio. Mohon konfirmasi perkiraan waktu kedatangan sebelum mengambil ya Kak. Terima kasih! 🙏✨`,
        ]
          .filter(Boolean)
          .join('\n')
    }
  }

  const currentMessage = getMessageText(activeTab)

  // Tautan langsung ke aplikasi WhatsApp + cadangan WhatsApp Web
  const waUrl = linkAppWhatsApp(booking.wa_klien, currentMessage)
  const waWebUrl = linkWebWhatsApp(booking.wa_klien, currentMessage)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentMessage)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Gagal menyalin:', err)
    }
  }

  const tabsConfig = [
    {
      id: 'konfirmasi' as WhatsAppTemplateType,
      label: 'Konfirmasi Booking',
      icon: CalendarCheck,
      desc: 'Kirim saat booking baru disetujui',
    },
    {
      id: 'reminder_h' as WhatsAppTemplateType,
      label: 'Reminder Hari-H',
      icon: ClockAlert,
      desc: 'Pengingat sesi di hari sesi foto',
    },
    {
      id: 'link_foto' as WhatsAppTemplateType,
      label: 'Kirim Link Foto',
      icon: ImageIcon,
      desc: 'Kirim link Google Drive/cloud hasil foto',
    },
    {
      id: 'ambil_cetakan' as WhatsAppTemplateType,
      label: 'Pengambilan Cetak',
      icon: Printer,
      desc: 'Pemberitahuan cetak foto selesai & siap diambil',
      badge: hasCetak ? 'Ada Cetak' : undefined,
    },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.95, y: 15 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 15 }}
          className="w-full max-w-2xl bg-[rgb(var(--color-cream))] rounded-3xl shadow-2xl border-2 border-[rgb(var(--color-border))] overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 bg-[#075E54] text-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#25D366] text-white flex items-center justify-center font-bold shadow-md">
                <MessageCircle className="w-5 h-5 fill-white text-transparent" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-heading font-bold text-base sm:text-lg">
                    Template Chat WhatsApp
                  </h3>
                  <span className="text-[11px] bg-white/20 px-2 py-0.5 rounded-full font-medium">
                    {booking.nama_klien}
                  </span>
                </div>
                <p className="text-xs text-white/80">
                  WA: {booking.wa_klien} · Kode: {booking.kode}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Content Body */}
          <div className="p-4 sm:p-6 overflow-y-auto flex-1 flex flex-col gap-4">
            {/* Pilihan Tab Template */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {tabsConfig.map(tab => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id)
                      setCopied(false)
                    }}
                    className={`p-3 rounded-2xl border-2 text-left transition-all relative flex flex-col justify-between ${
                      isActive
                        ? 'border-[#075E54] bg-[#075E54]/10 shadow-xs'
                        : 'border-[rgb(var(--color-border))] bg-[rgb(var(--color-surface))] hover:border-[#075E54]/40'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <div
                          className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                            isActive
                              ? 'bg-[#075E54] text-white'
                              : 'bg-[rgb(var(--color-cream-dark))] text-[rgb(var(--color-text-muted))]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        {tab.badge && (
                          <span className="text-[9px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded-md">
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs font-heading font-bold ${
                          isActive
                            ? 'text-[#075E54]'
                            : 'text-[rgb(var(--color-text))]'
                        }`}
                      >
                        {tab.label}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Input khusus bila tab link_foto */}
            {activeTab === 'link_foto' && (
              <div className="p-3.5 rounded-2xl bg-[rgb(var(--color-surface))] border border-[rgb(var(--color-border))]">
                <label className="text-xs font-heading font-bold text-[rgb(var(--color-text))] mb-1.5 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-[#075E54]" />
                  Masukkan Link Google Drive / Cloud Foto:
                </label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/drive/folders/..."
                  value={linkDrive}
                  onChange={e => setLinkDrive(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-[rgb(var(--color-border))] bg-[rgb(var(--color-cream))] text-xs focus:outline-none focus:border-[#075E54]"
                />
                <p className="text-[11px] text-[rgb(var(--color-text-muted))] mt-1">
                  Link ini akan otomatis disisipkan ke dalam isi pesan di bawah.
                </p>
              </div>
            )}

            {/* Preview Box Pesan WhatsApp */}
            <div className="flex flex-col flex-1">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-heading font-bold text-[rgb(var(--color-text))] flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Pratinjau Pesan:
                </span>
                <span className="text-[11px] text-[rgb(var(--color-text-muted))]">
                  Format tebal (*teks*) otomatis didukung WhatsApp
                </span>
              </div>

              <div className="relative rounded-2xl border-2 border-[rgb(var(--color-border))] bg-[#E5DDD5]/40 p-4 font-sans text-xs sm:text-sm leading-relaxed whitespace-pre-wrap text-[#111B21] max-h-64 overflow-y-auto shadow-inner">
                {currentMessage}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-[rgb(var(--color-surface))] border-t border-[rgb(var(--color-border))] flex flex-col sm:flex-row items-center gap-2.5 shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={handleCopy}
              className="w-full sm:w-auto border border-[rgb(var(--color-border))] text-xs sm:text-sm"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600 mr-1.5" />
                  Tersalin ke Clipboard!
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1.5" />
                  Salin Teks Pesan
                </>
              )}
            </Button>

            <a
              href={waUrl}
              className="w-full sm:flex-1"
            >
              <Button
                type="button"
                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white border-0 font-heading font-bold shadow-md flex items-center justify-center gap-2 py-2.5"
              >
                <MessageCircle className="w-4 h-4 fill-white" />
                <span>Buka & Kirim di WhatsApp</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-80" />
              </Button>
            </a>
            <a
              href={waWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-[rgb(var(--color-text-muted))] hover:underline self-center"
              title="Jika aplikasi WhatsApp belum terpasang"
            >
              Buka di WhatsApp Web
            </a>

            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="w-full sm:w-auto text-xs sm:text-sm text-[rgb(var(--color-text-muted))]"
            >
              Tutup
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
