'use client'

import Image from 'next/image'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError('Email atau password salah')
      setLoading(false)
      return
    }

    router.push('/admin/bookings')
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-[rgb(var(--color-border))] flex items-center justify-center p-1.5 shadow-sm">
          <Image
            src="/logo.png"
            alt="Desara Studio"
            width={48}
            height={48}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div>
          <p className="font-heading font-bold text-lg">Desara Studio</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Admin Dashboard</p>
        </div>
      </div>

      <h1 className="font-heading text-2xl font-bold mb-6">Masuk</h1>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Input
          label="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          autoComplete="current-password"
        />
        <Button type="submit" loading={loading} size="lg" className="w-full mt-2">
          Masuk
        </Button>
      </form>
    </div>
  )
}
