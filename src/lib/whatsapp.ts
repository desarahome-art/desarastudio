// ============================================================
// Helper WhatsApp: normalisasi nomor & tautan yang membuka APLIKASI WhatsApp
// ============================================================

/**
 * Normalisasi nomor ke format internasional Indonesia tanpa tanda "+".
 * "0812-3456 789" -> "628123456789", "+62 812..." -> "62812...", "812..." -> "62812..."
 * "62 0812..." -> "62812...", "0062 812..." -> "62812..."
 */
export function normalisasiNomorWa(nomor: string | null | undefined): string {
  let p = String(nomor || '').replace(/[^0-9]/g, '')
  if (p.startsWith('00')) p = p.slice(2)
  if (p.startsWith('620')) p = '62' + p.slice(3)
  else if (p.startsWith('0')) p = '62' + p.slice(1)
  else if (p.startsWith('8')) p = '62' + p
  return p
}

/** Tautan yang langsung membuka aplikasi WhatsApp (desktop & HP). */
export function linkAppWhatsApp(nomor: string, teks?: string): string {
  const phone = normalisasiNomorWa(nomor)
  const text = teks ? `&text=${encodeURIComponent(teks)}` : ''
  return `whatsapp://send?phone=${phone}${text}`
}

/** Cadangan: WhatsApp Web (jika aplikasi tidak terpasang). */
export function linkWebWhatsApp(nomor: string, teks?: string): string {
  const phone = normalisasiNomorWa(nomor)
  const text = teks ? `?text=${encodeURIComponent(teks)}` : ''
  return `https://wa.me/${phone}${text}`
}
