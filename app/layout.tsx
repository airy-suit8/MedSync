import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { SITE_URL } from '@/lib/constants'

const geist = localFont({
  src: './fonts/geist-latin.woff2',
  display: 'swap',
  weight: '400 600',
  variable: '--font-geist-sans',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#2563eb',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'MedSync - Healthcare Collaboration Platform',
  description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians through real-time communication and intelligent insights.',
  keywords: 'healthcare, AI, medical collaboration, patient portal, doctor dashboard, lab management',
  authors: [{ name: 'MedSync Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'MedSync - Healthcare Collaboration Platform',
    description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians.',
    type: 'website',
    locale: 'en_US',
    // Image: app/opengraph-image.png
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedSync - Healthcare Collaboration Platform',
    description: 'AI-powered healthcare collaboration platform',
  },
}

// A web app, not a medical organization, and there is no support phone line.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'MedSync',
  description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians.',
  url: SITE_URL,
  applicationCategory: 'HealthApplication',
  operatingSystem: 'Web',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MedSync" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geist.className} antialiased`} suppressHydrationWarning>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
