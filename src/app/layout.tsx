import type { Metadata } from 'next'
import '@fontsource/bricolage-grotesque/400.css'
import '@fontsource/bricolage-grotesque/600.css'
import '@fontsource/bricolage-grotesque/700.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Desara Home Studio',
  description: 'Booking foto profesional di Pontianak',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="font-body antialiased">
        {children}
      </body>
    </html>
  )
}
