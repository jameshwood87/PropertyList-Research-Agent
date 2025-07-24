/**
 * Geocoding Configuration for AI Property Research Agent
 * 
 * This config controls geocoding behavior and debugging output.
 * End users will never see debug information - this is for developers only.
 */

module.exports = {
  // OpenCage API Settings
  opencage: {
    dailyQuotaLimit: 2500,        // Free tier daily limit
    rateLimit: 1100,              // Milliseconds between requests (1.1s for safety)
    maxRetries: 2,                // Max retry attempts on failure
    timeoutMs: 10000,             // Request timeout
    countryCode: 'es',            // Restrict to Spain
    language: 'en'                // Response language
  },

  // Google Maps Fallback Settings
  googleMaps: {
    timeoutMs: 10000,
    region: 'es',                 // Spain region bias
    maxRetries: 2
  },

  // AI Learning & Analytics
  analytics: {
    enableRequestLogging: true,   // Log requests for AI learning
    enableHourlyTracking: true,   // Track usage patterns
    enablePerformanceMetrics: true, // Response time tracking
    logRetentionDays: 90          // How long to keep analytics data
  },

  // Developer Settings (NEVER shown to end users)
  debug: {
    enableConsoleOutput: process.env.NODE_ENV === 'development', // Only in dev mode
    enableQuotaWarnings: process.env.NODE_ENV === 'development', // Only warn developers
    enablePerformanceLogging: process.env.NODE_ENV === 'development',
    enableDetailedErrors: process.env.NODE_ENV === 'development'
  },

  // Confidence Thresholds
  confidence: {
    excellent: 0.95,              // Accept immediately
    good: 0.85,                   // Good enough for most cases
    acceptable: 0.70,             // Minimum for enhanced geocoding
    minimum: 0.50                 // Fallback threshold
  },

  // Cache Settings
  cache: {
    enableLocationCache: true,
    enableResponseCache: true,
    defaultTTL: 86400 * 7,        // 7 days
    maxEntries: 10000
  },

  // Batch Processing
  batch: {
    defaultBatchSize: 10,         // Properties per batch
    defaultDelayMs: 1000,         // Delay between batches
    maxConcurrentRequests: 1      // Sequential for rate limiting
  },

  // Smart Grouping
  grouping: {
    enableSmartGrouping: true,    // Group properties by location
    minGroupSize: 2,              // Minimum properties to form a group
    maxGroupSize: 100,            // Maximum properties per group
    enableCostOptimization: true  // Optimize for minimum API calls
  }
};

/**
 * Helper function to check if debug output is enabled
 * This ensures user-facing code never shows debug info
 */
function isDebugEnabled() {
  return module.exports.debug.enableConsoleOutput;
}

/**
 * Safe debug logging that only outputs in development
 */
function debugLog(message, ...args) {
  if (isDebugEnabled()) {
    console.log(`[DEBUG] ${message}`, ...args);
  }
}

/**
 * Safe error logging for developers
 */
function debugError(message, error) {
  if (module.exports.debug.enableDetailedErrors) {
    console.error(`[DEBUG] ${message}`, error);
  }
}

/**
 * Performance logging for optimization
 */
function debugPerformance(operation, duration, details = {}) {
  if (module.exports.debug.enablePerformanceLogging) {
    console.log(`[PERF] ${operation}: ${duration}ms`, details);
  }
}

module.exports.helpers = {
  isDebugEnabled,
  debugLog,
  debugError,
  debugPerformance
}; 