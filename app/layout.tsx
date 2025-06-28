import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'MedSync - Healthcare Collaboration Platform',
  description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians through real-time communication and intelligent insights.',
  keywords: 'healthcare, AI, medical collaboration, patient portal, doctor dashboard, lab management',
  authors: [{ name: 'MedSync Team' }],
  viewport: 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no',
  robots: 'index, follow',
  openGraph: {
    title: 'MedSync - Healthcare Collaboration Platform',
    description: 'AI-powered healthcare collaboration platform connecting patients, doctors, and laboratory technicians.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'MedSync - Healthcare Collaboration Platform',
    description: 'AI-powered healthcare collaboration platform',
  },
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
      </head>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
