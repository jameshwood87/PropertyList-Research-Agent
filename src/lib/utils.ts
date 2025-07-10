import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price)
}

export function formatNumber(number: number): string {
  return new Intl.NumberFormat('es-ES').format(number)
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

export function extractDomain(url: string): string {
  try {
    const domain = new URL(url).hostname
    return domain.replace('www.', '')
  } catch {
    return 'unknown'
  }
}

export function calculatePricePerSqm(price: number, sqm: number): number {
  if (sqm <= 0) return 0
  return Math.round(price / sqm)
}

export function getPriceAssessmentColor(assessment: 'overpriced' | 'fairly_priced' | 'underpriced'): string {
  switch (assessment) {
    case 'overpriced':
      return 'text-red-600'
    case 'underpriced':
      return 'text-green-600'
    case 'fairly_priced':
      return 'text-yellow-600'
    default:
      return 'text-gray-600'
  }
}

export function getInvestmentPotentialColor(potential: 'high' | 'medium' | 'low'): string {
  switch (potential) {
    case 'high':
      return 'text-green-600'
    case 'medium':
      return 'text-yellow-600'
    case 'low':
      return 'text-red-600'
    default:
      return 'text-gray-600'
  }
}

export function getMarketTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  switch (trend) {
    case 'up':
      return '📈'
    case 'down':
      return '📉'
    case 'stable':
      return '➡️'
    default:
      return '➡️'
  }
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
} 