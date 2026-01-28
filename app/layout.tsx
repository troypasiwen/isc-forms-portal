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
    // This points to public/isc-logo.png
    icon: '/isc-logo.png', 
    // If you want to use the same logo for Apple devices
    apple: '/isc-logo.png', 
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