import axios, { AxiosRequestConfig } from 'axios'
import { randomBytes } from 'crypto'

// User agent pool with real browser fingerprints
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36'
]

// Screen resolutions for realistic fingerprinting
const SCREEN_RESOLUTIONS = [
  '1920x1080',
  '1366x768',
  '1440x900',
  '1536x864',
  '1920x1200',
  '2560x1440',
  '1280x720',
  '1600x900'
]

// Browser languages
const LANGUAGES = [
  'en-US,en;q=0.9',
  'en-GB,en;q=0.9',
  'es-ES,es;q=0.9,en;q=0.8',
  'es-MX,es;q=0.9,en;q=0.8',
  'en-US,en;q=0.9,es;q=0.8',
  'en-US,en;q=0.9,fr;q=0.8',
  'en-US,en;q=0.9,de;q=0.8'
]

// Request delays to avoid rate limiting
const DELAY_RANGES = {
  idealista: { min: 2000, max: 5000 },
  fotocasa: { min: 1500, max: 4000 },
  kyero: { min: 1000, max: 3000 },
  generic: { min: 1000, max: 2500 }
}

interface ScrapingSession {
  userAgent: string
  language: string
  resolution: string
  sessionId: string
  cookies: Record<string, string>
  lastRequest: number
}

class AntiScrapingManager {
  private sessions: Map<string, ScrapingSession> = new Map()
  private requestCounts: Map<string, number> = new Map()
  private proxyPool: string[] = []
  
  constructor() {
    // Initialize with environment proxy if available
    if (process.env.HTTP_PROXY) {
      this.proxyPool.push(process.env.HTTP_PROXY)
    }
    if (process.env.HTTPS_PROXY) {
      this.proxyPool.push(process.env.HTTPS_PROXY)
    }
  }

  private getRandomElement<T>(array: T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }

  private generateSessionId(): string {
    return randomBytes(16).toString('hex')
  }

  private getDomainFromUrl(url: string): string {
    try {
      const parsedUrl = new URL(url)
      return parsedUrl.hostname.toLowerCase()
    } catch {
      return 'unknown'
    }
  }

  private getDelayForDomain(domain: string): number {
    let delayRange = DELAY_RANGES.generic
    
    if (domain.includes('idealista')) {
      delayRange = DELAY_RANGES.idealista
    } else if (domain.includes('fotocasa')) {
      delayRange = DELAY_RANGES.fotocasa
    } else if (domain.includes('kyero')) {
      delayRange = DELAY_RANGES.kyero
    }
    
    return Math.floor(Math.random() * (delayRange.max - delayRange.min + 1)) + delayRange.min
  }

  private createSession(domain: string): ScrapingSession {
    return {
      userAgent: this.getRandomElement(USER_AGENTS),
      language: this.getRandomElement(LANGUAGES),
      resolution: this.getRandomElement(SCREEN_RESOLUTIONS),
      sessionId: this.generateSessionId(),
      cookies: {},
      lastRequest: 0
    }
  }

  private async enforceRateLimit(domain: string, session: ScrapingSession): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - session.lastRequest
    const minDelay = this.getDelayForDomain(domain)
    
    if (timeSinceLastRequest < minDelay) {
      const waitTime = minDelay - timeSinceLastRequest
      console.log(`Rate limiting: waiting ${waitTime}ms for ${domain}`)
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }
    
    session.lastRequest = Date.now()
  }

  private buildHeaders(session: ScrapingSession, url: string): Record<string, string> {
    const domain = this.getDomainFromUrl(url)
    const [width, height] = session.resolution.split('x')
    
    const headers: Record<string, string> = {
      'User-Agent': session.userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': session.language,
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
      'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'Viewport-Width': width,
      'Device-Memory': '8',
      'Downlink': '10',
      'ECT': '4g',
      'RTT': '50'
    }

    // Add domain-specific headers
    if (domain.includes('idealista.com')) {
      headers['Referer'] = 'https://www.idealista.com/'
      headers['Origin'] = 'https://www.idealista.com'
      headers['X-Requested-With'] = 'XMLHttpRequest'
    } else if (domain.includes('fotocasa.es')) {
      headers['Referer'] = 'https://www.fotocasa.es/'
      headers['Origin'] = 'https://www.fotocasa.es'
    } else if (domain.includes('kyero.com')) {
      headers['Referer'] = 'https://www.kyero.com/'
      headers['Origin'] = 'https://www.kyero.com'
    }

    // Add session cookies
    if (Object.keys(session.cookies).length > 0) {
      headers['Cookie'] = Object.entries(session.cookies)
        .map(([key, value]) => `${key}=${value}`)
        .join('; ')
    }

    return headers
  }

  private getProxy(): string | undefined {
    if (this.proxyPool.length === 0) return undefined
    return this.getRandomElement(this.proxyPool)
  }

  async makeRequest(url: string, options: AxiosRequestConfig = {}): Promise<any> {
    const domain = this.getDomainFromUrl(url)
    
    // Get or create session for this domain
    let session = this.sessions.get(domain)
    if (!session) {
      session = this.createSession(domain)
      this.sessions.set(domain, session)
      console.log(`Created new session for ${domain}:`, {
        userAgent: session.userAgent.substring(0, 50) + '...',
        language: session.language,
        resolution: session.resolution
      })
    }

    // Enforce rate limiting
    await this.enforceRateLimit(domain, session)

    // Build headers
    const headers = this.buildHeaders(session, url)
    
    // Configure proxy if available
    const proxy = this.getProxy()
    const axiosConfig: AxiosRequestConfig = {
      ...options,
      headers: { ...headers, ...options.headers },
      timeout: 30000,
      maxRedirects: 10,
      validateStatus: (status) => status < 500,
      ...proxy && {
        proxy: {
          host: proxy.split(':')[0],
          port: parseInt(proxy.split(':')[1]) || 8080
        }
      }
    }

    // Track request count
    const currentCount = this.requestCounts.get(domain) || 0
    this.requestCounts.set(domain, currentCount + 1)

    try {
      console.log(`Making request to ${domain} (attempt ${currentCount + 1})`)
      const response = await axios.get(url, axiosConfig)
      
      // Store cookies from response
      const setCookieHeader = response.headers['set-cookie']
      if (setCookieHeader) {
        setCookieHeader.forEach(cookie => {
          const [nameValue] = cookie.split(';')
          const [name, value] = nameValue.split('=')
          if (name && value) {
            session!.cookies[name.trim()] = value.trim()
          }
        })
      }

      return response
    } catch (error: any) {
      console.error(`Request failed for ${domain}:`, error.message)
      
      // If blocked, try rotating session
      if (error.response?.status === 403 || error.response?.status === 429) {
        console.log(`Rotating session for ${domain} due to blocking`)
        this.sessions.delete(domain)
        this.requestCounts.delete(domain)
      }
      
      throw error
    }
  }

  // Method to add proxies dynamically
  addProxy(proxy: string): void {
    if (!this.proxyPool.includes(proxy)) {
      this.proxyPool.push(proxy)
      console.log(`Added proxy: ${proxy}`)
    }
  }

  // Method to clear sessions (useful for testing)
  clearSessions(): void {
    this.sessions.clear()
    this.requestCounts.clear()
    console.log('Cleared all sessions')
  }

  // Get session info for debugging
  getSessionInfo(domain: string): ScrapingSession | undefined {
    return this.sessions.get(domain)
  }
}

// Export singleton instance
export const antiScrapingManager = new AntiScrapingManager()

// Export the class for testing
export { AntiScrapingManager } 