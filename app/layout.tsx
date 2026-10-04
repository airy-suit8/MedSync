import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster as SonnerToaster } from '@/components/ui/sonner'
import { Toaster } from '@/components/ui/toaster'

const geist = localFont({
  src: './fonts/geist-latin.woff2',
  display: 'swap',
  weight: '400 600',
  variable: '--font-geist-sans',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#2563eb',
}

export const metadata: Metadata = {
  metadataBase: new URL('https://medsync.health'),
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
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'MedSync Platform' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedSync - Healthcare Collaboration Platform',
    description: 'AI-powered healthcare collaboration platform',
    images: ['/og-image.jpg'],
  },
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'MedicalOrganization',
  name: 'MedSync Healthcare',
  description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians.',
  url: 'https://medsync.health',
  logo: 'https://medsync.health/medi.png',
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+1-800-555-1234',
    contactType: 'customer service'
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="MedSync" />
        <link rel="icon" href="/medi.png" />
        <link rel="apple-touch-icon" href="/medi.png" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${geist.className} antialiased`} suppressHydrationWarning>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          forcedTheme="light"
          disableTransitionOnChange
        >
          {children}
          <SonnerToaster />
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
