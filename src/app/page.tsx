import { createClient } from '@/lib/supabase/server'
import { BookingWizard } from '@/components/booking/BookingWizard'
import type { Settings, Category, Package, Addon, BackgroundItem } from '@/types'

export const dynamic = 'force-dynamic'

const defaultSettings: Settings = {
  nama_studio: 'Desara Home Studio',
  wa_admin: '6281234567890',
  rekening_bri: '1234-01-012345-53-6',
  nama_rekening: 'Desara Studio',
  dp_minimal: 100000,
  teks_sambutan: 'Selamat datang di Desara Home Studio, Pontianak 📸',
  tampilkan_waiting: true,
  jam_buka: '08:00',
  jam_tutup: '20:00',
  slot_interval: 30,
  backgrounds: [
    'Putih Bersih',
    'Abu-abu Netral',
    'Krem Hangat',
    'Hijau Forest',
    'Biru Muda',
    'Pink Dusty',
    'Hitam Elegan',
    'Maroon',
    'Navy',
    'Sage Green',
  ],
}

async function getData() {
  try {
    const supabase = await createClient()

    const [
      { data: settingsRows },
      { data: categories },
      { data: packages },
      { data: addons },
      { data: addonCategories },
    ] = await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('categories').select('*').eq('aktif', true).order('urutan'),
      supabase.from('packages').select('*').eq('aktif', true).order('urutan'),
      supabase.from('addons').select('*').order('urutan'),
      supabase.from('addon_categories').select('*'),
    ])

    const loadedSettings: Record<string, unknown> = {}
    for (const row of settingsRows || []) {
      loadedSettings[row.key] = row.value
    }

    const mergedSettings: Settings = {
      ...defaultSettings,
      ...loadedSettings,
      backgrounds: Array.isArray(loadedSettings.backgrounds)
        ? (loadedSettings.backgrounds as (string | BackgroundItem)[])
        : defaultSettings.backgrounds,
    }

    return {
      settings: mergedSettings,
      categories: (categories || []) as Category[],
      packages: (packages || []) as Package[],
      addons: (addons || []) as Addon[],
      addonCategories: addonCategories || [],
    }
  } catch (error) {
    console.error('Error fetching data from Supabase:', error)
    return {
      settings: defaultSettings,
      categories: [],
      packages: [],
      addons: [],
      addonCategories: [],
    }
  }
}

export default async function HomePage() {
  const { settings, categories, packages, addons, addonCategories } = await getData()

  return (
    <main className="min-h-screen bg-[rgb(var(--color-cream))]">
      <BookingWizard
        settings={settings}
        categories={categories}
        packages={packages}
        addons={addons}
        addonCategories={addonCategories}
      />
    </main>
  )
}
