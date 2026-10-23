import { MetadataRoute } from 'next'
import { SITE_URL as baseUrl } from '@/lib/constants'

export default function sitemap(): MetadataRoute.Sitemap {
  
  // Public routes
  const routes = [
    '',
    '/login',
    '/signup',
    '/privacy',
    '/terms',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: route === '' ? 1 : 0.8,
  }))

  return routes
}
