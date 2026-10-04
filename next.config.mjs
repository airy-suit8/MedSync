/** @type {import('next').NextConfig} */
const useWindowsBuildWorkaround = process.platform === 'win32'

const nextConfig = {
  // Security: Ignore errors during build to ensure deployment success in demo/dev phases, 
  // but recommended to fix them for true production robustness.
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    // Enabled for Vercel production deployment
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    // Keep the default worker path on Linux/macOS; Windows local builds need
    // the non-worker path because of the local Node/webpack WasmHash failure.
    webpackBuildWorker: !useWindowsBuildWorkaround,
    ...(useWindowsBuildWorkaround ? { cpus: 2 } : {}),
  },
  webpack(config) {
    if (useWindowsBuildWorkaround) {
      config.output.hashFunction = 'sha256'
    }
    return config
  },
}

export default nextConfig
