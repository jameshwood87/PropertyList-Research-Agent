// Feed System Initialization
import { initializeFeedManager } from './feed-manager'

let isInitialized = false
let initializationPromise: Promise<void> | null = null

// Initialize feed system once
export async function initializeFeedSystem(): Promise<void> {
  if (isInitialized) {
    return
  }

  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = performInitialization()
  return initializationPromise
}

async function performInitialization(): Promise<void> {
  try {
    console.log('🔄 Initializing Property Feed System...')
    
    // Initialize the feed manager with scheduler
    await initializeFeedManager()
    
    isInitialized = true
    console.log('✅ Property Feed System initialized successfully')
    
    // Log system status
    const { FeedIntegration } = await import('./feed-integration')
    const stats = FeedIntegration.getFeedSystemStats()
    
    console.log(`📊 Feed System Status:`)
    console.log(`   • Active Feed: ${stats.activeFeed}`)
    console.log(`   • Total Properties: ${stats.totalProperties.toLocaleString()}`)
    console.log(`   • Last Update: ${stats.lastUpdate}`)
    console.log(`   • Available Cities: ${stats.cities.length}`)
    console.log(`   • Property Types: ${stats.propertyTypes.length}`)
    
  } catch (error) {
    console.error('❌ Failed to initialize Property Feed System:', error)
    // Don't throw error - allow app to continue with fallback methods
  }
}

// Auto-initialize when this module is imported (in server environments)
if (typeof window === 'undefined') {
  // Only initialize on server-side
  setTimeout(() => {
    initializeFeedSystem()
  }, 1000) // Delay to allow other systems to initialize first
} 