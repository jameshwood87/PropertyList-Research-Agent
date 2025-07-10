// Proxy configuration for anti-scraping measures
import { antiScrapingManager } from './anti-scraping'

// Free proxy services (for testing purposes)
// Note: These are public proxies and may not be reliable for production
const FREE_PROXIES: string[] = [
  // These are placeholder proxies - in production you'd use paid proxy services
  // 'proxy1.example.com:8080',
  // 'proxy2.example.com:8080',
  // 'proxy3.example.com:8080'
]

// Premium proxy services (add your own)
const PREMIUM_PROXIES: string[] = [
  // Example: 'premium-proxy.service.com:8080',
  // Add your premium proxy endpoints here
]

// Configuration for different proxy types
export interface ProxyConfig {
  type: 'free' | 'premium' | 'residential' | 'datacenter'
  endpoints: string[]
  username?: string
  password?: string
  rotation: 'random' | 'round-robin' | 'sticky'
  maxRetries: number
}

// Default proxy configurations
export const PROXY_CONFIGS: Record<string, ProxyConfig> = {
  free: {
    type: 'free',
    endpoints: FREE_PROXIES,
    rotation: 'random',
    maxRetries: 3
  },
  premium: {
    type: 'premium',
    endpoints: PREMIUM_PROXIES,
    rotation: 'round-robin',
    maxRetries: 5
  }
}

// Initialize proxy configuration
export function initializeProxyConfig(): void {
  console.log('Initializing proxy configuration...')
  
  // Add proxies from environment variables
  const envProxies = [
    process.env.HTTP_PROXY,
    process.env.HTTPS_PROXY,
    process.env.PROXY_1,
    process.env.PROXY_2,
    process.env.PROXY_3,
    process.env.PROXY_4,
    process.env.PROXY_5
  ].filter(Boolean) as string[]
  
  envProxies.forEach(proxy => {
    antiScrapingManager.addProxy(proxy)
  })
  
  // Add free proxies (if enabled)
  if (process.env.USE_FREE_PROXIES === 'true') {
    FREE_PROXIES.forEach(proxy => {
      antiScrapingManager.addProxy(proxy)
    })
  }
  
  // Add premium proxies (if configured)
  if (process.env.USE_PREMIUM_PROXIES === 'true') {
    PREMIUM_PROXIES.forEach(proxy => {
      antiScrapingManager.addProxy(proxy)
    })
  }
  
  console.log(`Proxy configuration initialized with ${envProxies.length} proxies`)
}

// Utility function to add proxies at runtime
export function addProxies(proxies: string[]): void {
  proxies.forEach(proxy => {
    antiScrapingManager.addProxy(proxy)
  })
  console.log(`Added ${proxies.length} proxies to the pool`)
}

// Utility function to get proxy recommendations
export function getProxyRecommendations(): string[] {
  return [
    'For production use, consider these proxy services:',
    '• Bright Data (formerly Luminati) - Premium residential proxies',
    '• Oxylabs - High-performance datacenter and residential proxies',
    '• Smartproxy - Rotating residential proxies',
    '• ProxyMesh - Rotating datacenter proxies',
    '• Scrapfly - Scraping-focused proxy service',
    '',
    'To configure proxies, set these environment variables:',
    '• HTTP_PROXY=http://proxy-server:port',
    '• HTTPS_PROXY=https://proxy-server:port',
    '• PROXY_1, PROXY_2, etc. for multiple proxies',
    '• USE_FREE_PROXIES=true (not recommended for production)',
    '• USE_PREMIUM_PROXIES=true (when premium proxies are configured)'
  ]
}

// Export for use in other modules
export default {
  initializeProxyConfig,
  addProxies,
  getProxyRecommendations,
  PROXY_CONFIGS
} 