import React from "react"
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { WelcomeAnimation } from '@/components/welcome-animation'
import './globals.css'

const _geist = Geist({ subsets: ["latin"] });
const _geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: 'ISC Forms Portal',
  description: 'Forms Portal Dedicated for Inter-World Shipping Corporation',
  generator: 'v0.app',
  icons: {
    // Multiple sizes for better compatibility
    icon: [
      { url: '/isc-logo.png?v=2', sizes: '32x32', type: 'image/png' },
      { url: '/isc-logo.png?v=2', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.ico?v=2', sizes: 'any' }, // Fallback to .ico if you have it
    ],
    // Apple touch icon
    apple: [
      { url: '/isc-logo.png?v=2', sizes: '180x180', type: 'image/png' },
    ],
    // Shortcut icon (legacy support)
    shortcut: '/isc-logo.png?v=2',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        <AuthProvider>
          <WelcomeAnimation />
          {children}
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}