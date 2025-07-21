import { NextRequest } from 'next/server'

interface AuthResult {
  isValid: boolean
  error?: string
}

/**
 * Validates API token from request headers
 * @param request - The incoming NextRequest
 * @returns AuthResult indicating if the token is valid
 */
export function validateApiToken(request: NextRequest): AuthResult {
  // Get the authorization header
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader) {
    return {
      isValid: false,
      error: 'Missing authorization header'
    }
  }

  // Check for Bearer token format
  if (!authHeader.startsWith('Bearer ')) {
    return {
      isValid: false,
      error: 'Invalid authorization format. Expected: Bearer <token>'
    }
  }

  // Extract the token
  const token = authHeader.substring(7) // Remove 'Bearer ' prefix
  
  if (!token) {
    return {
      isValid: false,
      error: 'Missing API token'
    }
  }

  // Get the expected token from environment variables
  const expectedToken = process.env.API_TOKEN
  
  if (!expectedToken) {
    console.error('⚠️ API_TOKEN not configured in environment variables')
    return {
      isValid: false,
      error: 'Server configuration error'
    }
  }

  // Validate the token using constant-time comparison to prevent timing attacks
  if (!constantTimeEqual(token, expectedToken)) {
    return {
      isValid: false,
      error: 'Invalid API token'
    }
  }

  return {
    isValid: true
  }
}

/**
 * Constant-time string comparison to prevent timing attacks
 * @param a - First string
 * @param b - Second string
 * @returns boolean indicating if strings are equal
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generates a secure random API token for development/testing
 * @param length - Length of the token (default: 32)
 * @returns A random token string
 */
export function generateApiToken(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  
  return result
}

/**
 * Rate limiting storage (in-memory for development)
 * In production, use Redis or similar external storage
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

/**
 * Simple rate limiting based on IP address
 * @param request - The incoming NextRequest
 * @param maxRequests - Maximum requests allowed per window (default: 10)
 * @param windowMs - Time window in milliseconds (default: 15 minutes)
 * @returns boolean indicating if request is allowed
 */
export function checkRateLimit(
  request: NextRequest, 
  maxRequests: number = 10, 
  windowMs: number = 15 * 60 * 1000
): boolean {
  // Get client IP (consider x-forwarded-for in production behind proxy)
  const ip = request.headers.get('x-forwarded-for') || 
             request.headers.get('x-real-ip') || 
             'unknown'

  const now = Date.now()
  const key = `rate_limit:${ip}`
  
  // Clean up expired entries
  const entries = Array.from(rateLimitStore.entries())
  for (const [k, v] of entries) {
    if (v.resetTime < now) {
      rateLimitStore.delete(k)
    }
  }

  const current = rateLimitStore.get(key)
  
  if (!current) {
    // First request from this IP
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (current.resetTime < now) {
    // Reset window has passed
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (current.count >= maxRequests) {
    // Rate limit exceeded
    return false
  }

  // Increment counter
  current.count++
  return true
} 