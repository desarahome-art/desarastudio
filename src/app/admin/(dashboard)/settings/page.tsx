import { createClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/admin/SettingsClient'
import type { Settings } from '@/types'

export const revalidate = 0

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: rows } = await supabase.from('settings').select('key, value')

  const settings: Record<string, unknown> = {}
  for (const row of rows || []) {
    settings[row.key] = row.value
  }

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold mb-6">Pengaturan Studio</h1>
      <SettingsClient settings={settings as unknown as Settings} />
    </div>
  )
}
