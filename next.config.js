/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: [],
  
  // Disable webpack caching to prevent corruption issues
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      // Disable webpack caching in development to prevent corruption
      config.cache = false
    }
    
    // Optimize module resolution
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    
    return config
  },
  
  // Simplified rewrites
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: '/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig 