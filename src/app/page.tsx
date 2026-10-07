import { createClient } from '@/lib/supabase/server'
import { BookingWizard } from '@/components/booking/BookingWizard'
import type { Settings, Category, Package, Addon, BackgroundItem, WisudaEvent } from '@/types'

export const dynamic = 'force-dynamic'

const defaultSettings: Settings = {
  nama_studio: 'Desara Home Studio',
  wa_admin: '6281234567890',
  rekening_bni: '1234567890',
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
  closed_dates: [],
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
      { data: wisudaEvents },
    ] = await Promise.all([
      supabase.from('settings').select('key, value'),
      supabase.from('categories').select('*').eq('aktif', true).order('urutan'),
      supabase.from('packages').select('*').eq('aktif', true).order('urutan'),
      supabase.from('addons').select('*').order('urutan'),
      supabase.from('addon_categories').select('*'),
      supabase.from('wisuda_events').select('*').eq('aktif', true).order('created_at', { ascending: false }),
    ])

    const loadedSettings: Record<string, unknown> = {}
    for (const row of settingsRows || []) {
      loadedSettings[row.key] = row.value
    }

    const mergedSettings: Settings = {
      ...defaultSettings,
      ...loadedSettings,
      rekening_bni: String(
        loadedSettings.rekening_bni ||
        loadedSettings.rekening_bri ||
        defaultSettings.rekening_bni
      ),
      backgrounds: Array.isArray(loadedSettings.backgrounds)
        ? (loadedSettings.backgrounds as (string | BackgroundItem)[])
        : defaultSettings.backgrounds,
      closed_dates: Array.isArray(loadedSettings.closed_dates)
        ? (loadedSettings.closed_dates as import('@/types').ClosedDateItem[])
        : [],
    }

    return {
      settings: mergedSettings,
      categories: (categories || []) as Category[],
      packages: (packages || []) as Package[],
      addons: (addons || []) as Addon[],
      addonCategories: addonCategories || [],
      wisudaEvents: (wisudaEvents || []) as WisudaEvent[],
    }
  } catch (error) {
    console.error('Error fetching data from Supabase:', error)
    return {
      settings: defaultSettings,
      categories: [],
      packages: [],
      addons: [],
      addonCategories: [],
      wisudaEvents: [],
    }
  }
}

export default async function HomePage() {
  const { settings, categories, packages, addons, addonCategories, wisudaEvents } = await getData()

  return (
    <main className="min-h-screen bg-[rgb(var(--color-cream))]">
      <BookingWizard
        settings={settings}
        categories={categories}
        packages={packages}
        addons={addons}
        addonCategories={addonCategories}
        wisudaEvents={wisudaEvents}
      />
    </main>
  )
}

