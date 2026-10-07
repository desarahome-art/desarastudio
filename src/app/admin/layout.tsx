import type { Metadata } from 'next'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Admin – Desara Home Studio',
}

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
