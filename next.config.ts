import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' }],
      },
    ]
  },
  // The login page moved to `/` when the app became a hub — keep old bookmarks working.
  async redirects() {
    return [{ source: '/login', destination: '/', permanent: true }]
  },
}

export default nextConfig
