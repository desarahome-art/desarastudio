'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar, Clock, ListOrdered, Package, Settings,
  LogOut, Camera, X, Menu
} from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/admin/bookings',     label: 'Booking',      icon: Calendar },
  { href: '/admin/waitinglist',  label: 'Waiting List', icon: Clock },
  { href: '/admin/packages',     label: 'Paket',        icon: Package },
  { href: '/admin/addons',       label: 'Add-on',       icon: ListOrdered },
  { href: '/admin/settings',     label: 'Pengaturan',   icon: Settings },
]

export function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/admin/login')
    router.refresh()
  }

  const NavLinks = () => (
    <nav className="flex flex-col gap-1">
      {navItems.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={cn(
            'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
            pathname.startsWith(href)
              ? 'bg-[rgb(var(--color-forest))] text-[rgb(var(--color-cream))]'
              : 'hover:bg-[rgb(var(--color-cream-dark))] text-[rgb(var(--color-text))]'
          )}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  )

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-6 mb-2">
        <div className="w-9 h-9 rounded-xl bg-[rgb(var(--color-forest))] flex items-center justify-center">
          <Camera className="w-5 h-5 text-[rgb(var(--color-blitz))]" />
        </div>
        <div>
          <p className="font-heading font-bold text-sm leading-tight">Desara Studio</p>
          <p className="text-xs text-[rgb(var(--color-text-muted))]">Admin</p>
        </div>
      </div>

      <NavLinks />

      {/* User */}
      <div className="mt-auto border-t border-[rgb(var(--color-border))] pt-4 px-4 pb-6">
        <p className="text-xs text-[rgb(var(--color-text-muted))] truncate mb-3">{userEmail}</p>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Keluar
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 bottom-0 w-64 flex-col bg-[rgb(var(--color-surface))] border-r border-[rgb(var(--color-border))] p-4">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-[rgb(var(--color-surface))] border-b border-[rgb(var(--color-border))] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[rgb(var(--color-forest))] flex items-center justify-center">
            <Camera className="w-4 h-4 text-[rgb(var(--color-blitz))]" />
          </div>
          <span className="font-heading font-bold text-sm">Desara Admin</span>
        </div>
        <button onClick={() => setOpen(true)} className="p-1">
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative w-64 bg-[rgb(var(--color-surface))] h-full p-4 shadow-2xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 p-1"
            >
              <X className="w-5 h-5" />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Mobile top padding spacer */}
      <div className="lg:hidden h-14" />
    </>
  )
}
