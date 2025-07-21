'use client'

import { useState, useEffect } from 'react'
// import { motion } from 'framer-motion'
import dynamic from 'next/dynamic'
import { 
  MapPin, 
  Download, 
  TrendingUp, 
  Home, 
  Calendar,
  Euro,
  BarChart3,
  Building,
  Navigation,
  School,
  ShoppingCart,
  Car,
  Heart,
  TreePine,
  Utensils,
  Eye,
  EyeOff,
  Footprints,
  Train,
  X,
  ChevronLeft,
  ChevronRight,
  Camera,
  Bike,
  Zap,
  PawPrint,
  Waves,
  Video,
  Coins,
  Building2,
  Flag,
  Sun,
  Check,
  Loader2,
  Printer,
  Smartphone
} from 'lucide-react'
import { CMAReport } from '@/types'
import { fixSpanishCharacters, normalizeProvinceName } from '@/lib/utils'
import FeedbackPanel from './FeedbackPanel'
import SimpleFeedbackButtons from './SimpleFeedbackButtons'
import { LazyPropertyImage, LazyComparableImage, LazyGalleryImage } from './LazyImage'

// Extract urbanization/neighborhood name from full address - PRIORITIZE XML FEED DATA
function extractLocationName(address: string, city: string, urbanization?: string, suburb?: string): string {
  // FIRST PRIORITY: Use XML feed urbanization data
  if (urbanization && urbanization.trim()) {
    return urbanization.trim()
  }
  
  // SECOND PRIORITY: Use XML feed suburb data
  if (suburb && suburb.trim()) {
    return suburb.trim()
  }
  
  // THIRD PRIORITY: Look for urbanization keywords in the address
  let cleanAddress = address.trim()
  const urbanizationKeywords = [
    'urbanización', 'urbanizacion', 'urb.', 'urb',
    'residencial', 'conjunto', 'complejo'
  ]
  
  const addressLower = cleanAddress.toLowerCase()
  
  for (const keyword of urbanizationKeywords) {
    const keywordIndex = addressLower.indexOf(keyword)
    if (keywordIndex !== -1) {
      // Extract from keyword to the next comma or end
      const fromKeyword = cleanAddress.substring(keywordIndex)
      const nextComma = fromKeyword.indexOf(',')
      const extracted = nextComma !== -1 
        ? fromKeyword.substring(0, nextComma).trim()
        : fromKeyword.trim()
      
      if (extracted !== city && extracted.length > keyword.length) {
        return extracted
      }
    }
  }
  
  // FOURTH PRIORITY: Look for neighborhood/area keywords
  const neighborhoodKeywords = [
    'barrio', 'neighborhood', 'zona', 'sector'
  ]
  
  for (const keyword of neighborhoodKeywords) {
    const keywordIndex = addressLower.indexOf(keyword)
    if (keywordIndex !== -1) {
      // Extract from keyword to the next comma or end
      const fromKeyword = cleanAddress.substring(keywordIndex)
      const nextComma = fromKeyword.indexOf(',')
      const extracted = nextComma !== -1 
        ? fromKeyword.substring(0, nextComma).trim()
        : fromKeyword.trim()
      
      if (extracted !== city && extracted.length > keyword.length) {
        return extracted
      }
    }
  }
  
  // FIFTH PRIORITY: Split by comma to get the first part (street name)
  const parts = cleanAddress.split(',')
  if (parts.length > 1) {
    const firstPart = parts[0].trim()
    
    // If the first part is not just the city name, use it
    if (firstPart !== city && firstPart.length > 0) {
      return firstPart
    }
  }
  
  // Final fallback: use city name
  return city
}

// Direct imports for client-side components (they have 'use client' directive)
import GoogleMapView from './GoogleMapView'
import MarketChart from './MarketChart'

interface CMAReportDisplayProps {
  report: CMAReport
  sessionId: string
}

// Canonical feature mapping for normalization
const CANONICAL_FEATURES: { [canonical: string]: string[] } = {
  'Private Pool': ['private pool', 'pool', 'swimming pool', 'private swimming pool', 'pool-private'],
  'Sea Views': ['sea views', 'sea view', 'ocean view', 'sea vistas', 'views-sea'],
  'Mountain Views': ['mountain views', 'mountain view', 'hill view', 'views-mountain', 'mountain'],
  'Garden': ['garden', 'yard', 'landscaped garden', 'private garden', 'garden-private', 'garden-landscaped', 'garden-communal'],
  'Parking': ['parking', 'garage', 'carport', 'off-street parking', 'parking-private-space', 'parking-communal', 'parking-covered', 'parking-underground', 'parking-multiple'],
  'Air Conditioning': ['air conditioning', 'ac', 'air con', 'central air', 'air_conditioning', 'ducted-central-ac', 'cold-hot-ac-units', 'pre-installed-ac'],
  'Fitted Kitchen': ['fitted kitchen', 'kitchen', 'modern kitchen', 'fully-equipped-kitchen', 'partially-equipped-kitchen', 'kitchen-not-equipped'],
  'Fireplace': ['fireplace', 'chimney', 'wood burning stove'],
  'Storage Room': ['storage room', 'storage', 'utility room'],
  'Terrace': ['terrace', 'balcony', 'patio', 'deck', 'private-terrace', 'covered-terrace'],
  'Security System': ['security system', 'security', 'alarm', 'cctv', 'alarm-system', 'security-24-hour'],
  'BBQ Area': ['bbq area', 'bbq', 'barbecue', 'barbecue area', 'barbeque-area'],
  'Central Heating': ['central heating', 'central-heating'],
  'Double Glazing': ['double glazing', 'double-glazing'],
  'Close to Schools': ['close to schools', 'close-to-schools'],
  'Close to Beach': ['close to beach', 'close-to-beach'],
  'Close to Golf': ['close to golf', 'close-to-golf'],
  'Close to Shops': ['close to shops', 'close-to-shops'],
  'Close to Restaurants': ['close to restaurants', 'close-to-restaurants'],
  'Close to Town Centre': ['close to town centre', 'close-to-town-centre'],
  'Gated Complex': ['gated complex', 'gated-complex'],
  'Tennis Court': ['tennis court', 'tennis-court'],
  'Lift': ['lift'],
  'Fitted Wardrobes': ['fitted wardrobes', 'fitted-wardrobes'],
  'Marble Flooring': ['marble flooring', 'marble-flooring'],
  'Wooden Flooring': ['wooden flooring', 'wooden-flooring'],
  'Underfloor Heating': ['underfloor heating', 'underfloor-heating'],
  'Satellite TV': ['satellite tv', 'satellite-tv'],
  'WiFi': ['wifi'],
  'Fibre Internet': ['fibre internet', 'fibre-internet'],
  'Smart Home': ['smart home', 'smart-home'],
  'Home Automation': ['home automation', 'home-automation'],
  'Solar Power': ['solar power', 'solar-power'],
  'Solar Water Heating': ['solar water heating', 'solar-water-heating'],
  'Electric Blinds': ['electric blinds', 'electric-blinds'],
  'Heated Bathroom Floors': ['heated bathroom floors', 'heating-bathroom-floors'],
  'Jacuzzi': ['jacuzzi'],
  'Sauna': ['sauna'],
  'Solarium': ['solarium'],
  'Games Room': ['games room', 'games-room'],
  'Gym': ['gym'],
  'Paddle Court': ['paddle court', 'paddle-court'],
  'Children\'s Pool': ['children\'s pool', 'pool-childrens'],
  'Heated Pool': ['heated pool', 'pool-heated'],
  'Indoor Pool': ['indoor pool', 'pool-indoor'],
  'Communal Pool': ['communal pool', 'pool-communal'],
  'Pool Room': ['pool room', 'pool-room-for'],
  '24-hour Reception': ['24-hour reception', 'reception-24-hour'],
  '24-hour Security': ['24-hour security', 'security-24-hour'],
  'Entry Phone System': ['entry phone system', 'entry-phone-system'],
  'Basement': ['basement'],
  'Guest Apartment': ['guest apartment', 'guest-apartment'],
  'Guest House': ['guest house', 'guest-house'],
  'Staff Accommodation': ['staff accommodation', 'staff-accommodation'],
  'On-site Restaurant': ['on-site restaurant', 'on-site-restaurant'],
  'Open-plan Kitchen/Lounge': ['open-plan kitchen/lounge', 'open-plan-kitchen-lounge'],
  'Ensuite Bathroom': ['ensuite bathroom', 'ensuite-bathroom'],
  'Utility Room': ['utility room', 'utility-room'],
  'Beachfront': ['beachfront', 'beach-front'],
  'Golf-front': ['golf-front'],
  'Port/Marina': ['port/marina', 'port-marina'],
  'Private Water Well': ['private water well', 'private-well'],
  'Stables': ['stables'],
  'With Planning Permission': ['with planning permission', 'with-planning-permission'],
  'Recently Refurbished': ['recently refurbished', 'recently-refurbished'],
  'Recently Renovated': ['recently renovated', 'recently-renovated'],
  'Newly Built': ['newly built', 'newly-built'],
  'New Development': ['new development', 'new-development'],
  'Off-plan Project': ['off-plan project', 'off-plan-project'],
  'Distressed Property': ['distressed property', 'distressed-property'],
  'Bank Repossession': ['bank repossession', 'bank-repossession'],
  'Historic Property': ['historic property', 'historic-property'],
  'Investment Opportunity': ['investment opportunity', 'investment-opportunity'],
  'Luxury Property': ['luxury property', 'luxury-property'],
  'Modern': ['modern'],
  'Andalusian Style': ['andalusian style', 'style-andalucian'],
  'Rustic Style': ['rustic style', 'style-rustic'],
  'All Electric Home': ['all electric home', 'all-electric-home'],
  'Gas': ['gas'],
  'Drinkable Water': ['drinkable water', 'drinkable-water'],
  'Disabled Access': ['disabled access', 'disabled-access'],
  'Fully Furnished': ['fully furnished', 'fully-furnished'],
  'Partially Furnished': ['partially furnished', 'partially-furnished'],
  'Unfurnished': ['unfurnished'],
  'East-facing': ['east-facing', 'east'],
  'West-facing': ['west-facing', 'west'],
  'North-facing': ['north-facing', 'north'],
  'South-facing': ['south-facing', 'south'],
  'North-east-facing': ['north-east-facing', 'north-east'],
  'North-west-facing': ['north-west-facing', 'north-west'],
  'South-east-facing': ['south-east-facing', 'south-east'],
  'South-west-facing': ['south-west-facing', 'south-west'],
  'Panoramic Views': ['panoramic views', 'views-panoramic'],
  'City Views': ['city views', 'views-city'],
  'Countryside Views': ['countryside views', 'views-countryside'],
  'Forest Views': ['forest views', 'views-forest'],
  'Garden Views': ['garden views', 'views-garden'],
  'Golf Views': ['golf views', 'views-golf'],
  'Lake Views': ['lake views', 'views-lake'],
  'Marina Views': ['marina views', 'views-marina'],
  'Pool Views': ['pool views', 'views-pool'],
  'Ski Resort Views': ['ski resort views', 'views-ski-resort'],
  'Beach Views': ['beach views', 'views-beach'],
  'Walking Distance to Beach': ['walking distance to beach', 'walking-beach'],
  'Walking Distance to Amenities': ['walking distance to amenities', 'walking-amenities'],
  'Near Public Transport': ['near public transport', 'near-public-transport'],
  'Town Centre': ['town centre', 'town-centre'],
  'Suburban Area': ['suburban area', 'suburban-area'],
  'Village': ['village'],
  'Countryside': ['countryside'],
  'Commercial District': ['commercial district', 'commercial-district'],
  'Urban Living': ['urban living', 'urban-living'],
  'Surrounded by Nature': ['surrounded by nature', 'surrounded-by-nature'],
  'Close to Marina': ['close to marina', 'close-to-marina'],
  'Close to Ski Resort': ['close to ski resort', 'close-to-ski-resort'],
  'Excellent Condition': ['excellent condition', 'excellent-condition'],
  'Good Condition': ['good condition', 'good-condition'],
  'Fair Condition': ['fair condition', 'fair-condition'],
  'Requires Renovation': ['requires renovation', 'requires-renovation']
}

// Helper to normalize a feature string to its canonical form
function normalizeFeature(feature: string): string {
  const lower = feature.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(CANONICAL_FEATURES)) {
    if (variants.includes(lower)) return canonical;
  }
  // If not found, return the original (capitalized)
  return feature.charAt(0).toUpperCase() + feature.slice(1);
}

export default function CMAReportDisplay({ report, sessionId }: CMAReportDisplayProps) {
  // Safety check for missing propertyData
  if (!report.propertyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Report...</h2>
          <p className="text-gray-600">Your comprehensive CMA report is being prepared. This will only take a moment.</p>
        </div>
      </div>
    )
  }

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState<'price-low' | 'price-high' | 'distance' | 'size-large' | 'size-small' | 'price-per-m2-low' | 'price-per-m2-high'>('distance')
  const [mapLayers, setMapLayers] = useState({
    schools: true,
    shopping: true,
    transport: true,
    healthcare: true,
    recreation: true,
    dining: true,
    entertainment: true,
    zoo: true,
    waterpark: true,
    cinema: true,
    casino: true,
    museum: true,
    golf: true,
    beach: true
  })
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set())
  const [isHeaderVisible, setIsHeaderVisible] = useState(true)
  const [showDownloadModal, setShowDownloadModal] = useState(false)
  const [downloadingReportType, setDownloadingReportType] = useState<string | null>(null)
  const [successReportType, setSuccessReportType] = useState<string | null>(null)
  const [pdfFormat, setPdfFormat] = useState<'printable' | 'mobile'>('printable')

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price)
  }

  const formatDistance = (distanceInMiles: number) => {
    // Convert miles to kilometers and format to 2 decimal places
    const distanceInKm = distanceInMiles * 1.60934
    return `${distanceInKm.toFixed(2)}km`
  }

  const formatComparableAddress = (address: string) => {
    // Map province codes to full names
    const provinceMap: { [key: string]: string } = {
      'MA': 'Málaga',
      'CA': 'Cádiz',
      'GR': 'Granada',
      'A': 'Alicante',
      'T': 'Tarragona',
      'PM': 'Palma',
      'GI': 'Girona',
      'CO': 'Córdoba',
      'AL': 'Almería',
      'M': 'Madrid',
      'SE': 'Sevilla',
      'B': 'Barcelona',
      'J': 'Jaén',
      'CS': 'Castellón'
    }
    
    // Replace province codes with full names - more careful approach
    let formattedAddress = address
    
    // First, handle all multi-letter codes (MA, PM, GI, CO, AL, SE, CS)
    const multiLetterCodes = Object.keys(provinceMap).filter(code => code.length > 1);
    for (const code of multiLetterCodes) {
      const name = provinceMap[code];
      // Replace only standalone codes after comma and space
      const regex = new RegExp(`(, ${code}\\b|, ${code}$)`, 'g');
      formattedAddress = formattedAddress.replace(regex, `, ${name}`);
    }
    
    // Then handle single-letter codes (M, A, T, B, J) - but be very careful
    const singleLetterCodes = Object.keys(provinceMap).filter(code => code.length === 1);
    for (const code of singleLetterCodes) {
      const name = provinceMap[code];
      // For single letters, only replace if they are at the end of the string or followed by a space
      // This prevents replacing "M" in "Málaga"
      const regex = new RegExp(`(, ${code}(?=\\s|$)|, ${code}$)`, 'g');
      formattedAddress = formattedAddress.replace(regex, `, ${name}`);
    }
    
    return formattedAddress
  }

  // Helper function to get image URL, handling both string and object formats
  const getImageUrl = (image: any): string => {
    if (!image) return ''
    
    // If image is a string, return it directly
    if (typeof image === 'string') {
      return image.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
        ? `/api/proxy-image?url=${encodeURIComponent(image)}`
        : image
    }
    
    // If image is an object with url property
    if (image.url) {
      return image.url.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
        ? `/api/proxy-image?url=${encodeURIComponent(image.url)}`
        : image.url
    }
    
    // Fallback to empty string
    return ''
  }

  // Scroll detection for header visibility
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const isScrolled = scrollTop > 100 // Show fixed button after 100px scroll
      
      setIsHeaderVisible(!isScrolled)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Image gallery functions
  const getAllImages = () => {
    const images = []
    if (report.propertyData?.images && report.propertyData.images.length > 0) {
      images.push(...report.propertyData.images)
    } else if (report.propertyData?.image) {
      images.push(report.propertyData.image)
    }
    return images
  }

  const openGallery = (index: number = 0) => {
    setCurrentImageIndex(index)
    setIsGalleryOpen(true)
    setBrokenImages(new Set()) // Reset broken images when opening gallery
  }

  const closeGallery = () => {
    setIsGalleryOpen(false)
  }

  const nextImage = () => {
    const images = getAllImages()
    setCurrentImageIndex((prev) => (prev + 1) % images.length)
  }

  const prevImage = () => {
    const images = getAllImages()
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleImageError = (imageIndex: number) => {
    console.warn(`Image ${imageIndex + 1} failed to load:`, getAllImages()[imageIndex])
    setBrokenImages(prev => new Set(Array.from(prev).concat(imageIndex)))
  }

  const currentImages = getAllImages()
  const hasMultipleImages = currentImages.length > 1

  // Keyboard navigation for gallery
  useEffect(() => {
    if (!isGalleryOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          closeGallery()
          break
        case 'ArrowLeft':
          if (hasMultipleImages) prevImage()
          break
        case 'ArrowRight':
          if (hasMultipleImages) nextImage()
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isGalleryOpen, hasMultipleImages])

  const handleExportPDF = async (reportType?: string) => {
    try {
      // Validate report data is ready
      if (!report || !report.propertyData) {
        throw new Error('Report data is not ready. Please wait for the analysis to complete.')
      }

      // Set loading state
      setDownloadingReportType(reportType || 'default')
      setSuccessReportType(null)
      
      // Get API token
      const apiToken = process.env.NEXT_PUBLIC_API_TOKEN
      if (!apiToken) {
        throw new Error('API token not configured')
      }

      // Add a small delay to ensure all data is properly loaded
      await new Promise(resolve => setTimeout(resolve, 500))

      // Call server-side PDF generation with timeout
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 60000) // 60 second timeout

      // Enhanced property type detection with fallbacks
      const isSale = report.propertyData.isSale !== undefined ? report.propertyData.isSale : 
                    !report.propertyData.isShortTerm && !report.propertyData.isLongTerm && 
                    !report.propertyData.monthlyPrice && !report.propertyData.weeklyPriceFrom
      
      const isLongTerm = report.propertyData.isLongTerm || !!report.propertyData.monthlyPrice
      const isShortTerm = report.propertyData.isShortTerm || !!report.propertyData.weeklyPriceFrom

      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        body: JSON.stringify({ 
          report,
          reportType,
          format: pdfFormat,
          propertyTypeInfo: {
            isSale: report.propertyData.isSale,
            isLongTerm: report.propertyData.isLongTerm,
            isShortTerm: report.propertyData.isShortTerm,
            monthlyPrice: report.propertyData.monthlyPrice,
            weeklyPriceFrom: report.propertyData.weeklyPriceFrom,
            calculatedIsSale: isSale
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to generate PDF`)
      }

      // Download the PDF
      const blob = await response.blob()
      
      if (!blob || blob.size === 0) {
        throw new Error('Generated PDF is empty. Please try again.')
      }

      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      const reportTypeSuffix = reportType ? `_${reportType}` : ''
      const safeAddress = fixSpanishCharacters(report.propertyData.address)
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9-]/g, '')
        .substring(0, 50) // Limit length to prevent filename issues
      link.download = `CMA-Report-${safeAddress}${reportTypeSuffix}-${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
      // Show success state briefly before closing
      setDownloadingReportType(null)
      setSuccessReportType(reportType || 'default')
      setTimeout(() => {
        setSuccessReportType(null)
        setShowDownloadModal(false)
      }, 1500) // Increased to 1.5 seconds for better UX
    } catch (error) {
      console.error('Error generating PDF:', error)
      setDownloadingReportType(null)
      setSuccessReportType(null)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate PDF. Please try again.'
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = 'PDF generation timed out. Please try again.'
        } else if (error.message.includes('not ready')) {
          errorMessage = 'Report data is still loading. Please wait a moment and try again.'
        } else if (error.message.includes('empty')) {
          errorMessage = 'Generated PDF is empty. Please try again.'
        } else {
          errorMessage = error.message
        }
      }
      
      alert(errorMessage)
    }
  }

  const openDownloadModal = () => {
    // Reduced logging for production
    setShowDownloadModal(true)
  }

  const closeDownloadModal = () => {
    setShowDownloadModal(false)
  }

  const toggleMapLayer = (layer: keyof typeof mapLayers) => {
    setMapLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }))
  }

  // Use actual property coordinates from analysis, with fallback for specific Spanish cities
  const getPropertyCoordinates = (): [number, number] => {
    // First priority: Use coordinates from analysis
    if (report.coordinates) {
      return [report.coordinates.lat, report.coordinates.lng]
    }
    
    // Second priority: Use coordinates from mobility data
    if (report.walkabilityData?.coordinates) {
      return [report.walkabilityData.coordinates.lat, report.walkabilityData.coordinates.lng]
    }
    
    // Third priority: Smart fallback based on city/province
    const city = report.propertyData?.city?.toLowerCase() || ''
    const province = report.propertyData?.province?.toLowerCase() || ''
    
    // Spanish cities coordinates
    if (city.includes('málaga') || province.includes('málaga')) {
      return [36.7213, -4.4217] // Málaga, Spain
    }
    if (city.includes('san pedro') && (province.includes('málaga') || city.includes('alcántara'))) {
      return [36.4845, -5.0060] // San Pedro de Alcántara, Spain
    }
    if (city.includes('madrid') || province.includes('madrid')) {
      return [40.4168, -3.7038] // Madrid, Spain
    }
    if (city.includes('barcelona') || province.includes('barcelona')) {
      return [41.3851, 2.1734] // Barcelona, Spain
    }
    if (city.includes('sevilla') || province.includes('sevilla')) {
      return [37.3886, -5.9823] // Sevilla, Spain
    }
    if (city.includes('valencia') || province.includes('valencia')) {
      return [39.4699, -0.3763] // Valencia, Spain
    }
    
    // Final fallback: Madrid coordinates
    console.warn('Using Madrid coordinates as fallback for property location')
    return [40.4168, -3.7038]
  }
  
  const propertyCoordinates = getPropertyCoordinates()

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Not Specified'
    }
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive':
        return 'text-green-600 bg-green-50'
      case 'negative':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getReputationColor = (reputation: string | undefined) => {
    switch (reputation) {
      case 'excellent':
        return 'text-emerald-600 bg-emerald-50'
      case 'good':
        return 'text-blue-600 bg-blue-50'
      case 'fair':
        return 'text-yellow-600 bg-yellow-50'
      case 'poor':
        return 'text-red-600 bg-red-50'
      default:
        return 'text-yellow-600 bg-yellow-50' // Default to fair for undefined values
    }
  }

  const getConditionClass = (condition: string | undefined) => {
    const normalizedCondition = (condition || '').toLowerCase().trim()
    
    switch (normalizedCondition) {
      case 'excellent':
        return 'condition-excellent'
      case 'good':
        return 'condition-good'
      case 'fair':
        return 'condition-fair'
      case 'needs work':
        return 'condition-needs-work'
      case 'renovation project':
        return 'condition-renovation'
      case 'rebuild':
        return 'condition-renovation'
      default:
        return 'condition-fair'
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50'
      case 'under_construction':
        return 'text-[#00ae9a] bg-[#00ae9a]/10'
      case 'approved':
        return 'text-purple-600 bg-purple-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  const getAmenityIcon = (type: string) => {
    switch (type) {
      case 'school':
        return '🏫'
      case 'shopping':
        return '🛍️'
      case 'transport':
        return '🚊'
      case 'healthcare':
        return '🏥'
      case 'recreation':
        return '🏞️'
      case 'dining':
        return '🍽️'
      default:
        return '📍'
    }
  }

  // Sort comparable properties based on selected criteria
  const sortComparableProperties = (properties: any[]) => {
    if (!properties) return []
    
    return [...properties].sort((a, b) => {
      switch (sortBy) {
        case 'price-low':
          return a.price - b.price
        case 'price-high':
          return b.price - a.price
        case 'distance':
          return a.distance - b.distance
        case 'size-large':
          return (b.buildArea || 0) - (a.buildArea || 0)
        case 'size-small':
          return (a.buildArea || 0) - (b.buildArea || 0)
        case 'price-per-m2-low':
          const pricePerM2ALow = a.buildArea ? a.price / a.buildArea : 0
          const pricePerM2BLow = b.buildArea ? b.price / b.buildArea : 0
          return pricePerM2ALow - pricePerM2BLow
        case 'price-per-m2-high':
          const pricePerM2AHigh = a.buildArea ? a.price / a.buildArea : 0
          const pricePerM2BHigh = b.buildArea ? b.price / b.buildArea : 0
          return pricePerM2BHigh - pricePerM2AHigh
        default:
          return 0
      }
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header with Export Button */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-200 px-6 py-4 shadow-sm" id="report-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Analysis Report</h1>
            <p className="text-sm text-gray-600">Generated on {formatDate(report.reportDate)}</p>
          </div>
          <button
            onClick={openDownloadModal}
            disabled={!report || !report.propertyData || downloadingReportType !== null}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 shadow-lg transform hover:-translate-y-0.5 ${
              !report || !report.propertyData || downloadingReportType !== null
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#00ae9a] hover:bg-[#00c5ad] text-white hover:shadow-xl'
            }`}
          >
            {downloadingReportType !== null ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span>
              {downloadingReportType !== null 
                ? 'Generating PDF...' 
                : !report || !report.propertyData 
                ? 'Loading Report...' 
                : 'Download Full CMA'
              }
            </span>
          </button>
        </div>
      </div>

      {/* Fixed Download Button - Only visible when header is scrolled out of view */}
      {!isHeaderVisible && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={openDownloadModal}
            disabled={!report || !report.propertyData || downloadingReportType !== null}
            className={`flex items-center space-x-2 px-6 py-3 rounded-lg transition-all duration-200 shadow-lg transform hover:-translate-y-0.5 ${
              !report || !report.propertyData || downloadingReportType !== null
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-[#00ae9a] hover:bg-[#00c5ad] text-white hover:shadow-xl'
            }`}
          >
            {downloadingReportType !== null ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            <span>
              {downloadingReportType !== null 
                ? 'Generating PDF...' 
                : !report || !report.propertyData 
                ? 'Loading Report...' 
                : 'Download Full CMA'
              }
            </span>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div
          className="space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* 🔍 Property Summary */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Property Summary</h2>
              </div>
              {report.propertyData?.refNumber && (
                <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1.5 rounded-lg font-mono font-semibold">
                  Ref: {report.propertyData.refNumber}
                </span>
              )}
            </div>
            
            {/* Responsive Layout: Mobile vertical, Desktop side-by-side with proper alignment */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0 lg:items-end">
              <div className="space-y-4">
                {/* Location - Always at top */}
                <div className="flex items-start space-x-3 ml-4">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold text-gray-900">{report.propertyData ? extractLocationName(fixSpanishCharacters(report.propertyData.address || ''), fixSpanishCharacters(report.propertyData.city || ''), fixSpanishCharacters(report.propertyData.urbanization || ''), fixSpanishCharacters(report.propertyData.suburb || '')) : 'Location not available'}</h3>
                    <p className="text-gray-600">{report.propertyData ? `${report.propertyData.suburb && report.propertyData.suburb !== report.propertyData.urbanization ? fixSpanishCharacters(report.propertyData.suburb) + ', ' : ''}${fixSpanishCharacters(report.propertyData.city || '')}, ${normalizeProvinceName(fixSpanishCharacters(report.propertyData.province || ''))} ${report.propertyData.areaCode || ''}` : 'Address details not available'}</p>
                  </div>
                </div>

                {/* Property Details Grid - Show on mobile before images, on desktop after location */}
                <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Building className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Type</span>
                    </div>
                    <p className="font-semibold text-gray-900">{report.propertyData.propertyType}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Property Sizes</span>
                    </div>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      {report.propertyData.buildArea && report.propertyData.buildArea > 0 ? (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Build</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.buildArea.toLocaleString()} m²</div>
                        </div>
                      ) : null}
                      {report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 ? (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Terrace</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.terraceAreaM2.toLocaleString()} m²</div>
                        </div>
                      ) : null}
                      {report.propertyData.plotArea && report.propertyData.plotArea > 0 ? (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Plot</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.plotArea.toLocaleString()} m²</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Asking Price</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {report.propertyData.price ? formatPrice(report.propertyData.price) : 'Not specified'}
                    </p>
                    {report.propertyData.price && report.propertyData.buildArea && report.propertyData.buildArea > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea))}/m²
                      </p>
                    )}
                  </div>
                  
                  {(report.propertyData.bedrooms > 0 || report.propertyData.bathrooms > 0) && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Bedrooms/Bathrooms</span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {report.propertyData.bedrooms > 0 && `${report.propertyData.bedrooms}bd`}
                        {report.propertyData.bedrooms > 0 && report.propertyData.bathrooms > 0 && ' / '}
                        {report.propertyData.bathrooms > 0 && `${report.propertyData.bathrooms}ba`}
                      </p>
                    </div>
                  )}
                </div>

                {/* Desktop Property Details Grid - Hidden on mobile */}
                <div className="hidden lg:grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Building className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Type</span>
                    </div>
                    <p className="font-semibold text-gray-900">{report.propertyData.propertyType}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Property Sizes</span>
                    </div>
                    <div className="flex gap-6 mt-2">
                      {report.propertyData.buildArea && (
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Build</div>
                          <div className="font-semibold text-gray-900">{report.propertyData.buildArea.toLocaleString()} m²</div>
                        </div>
                      )}
                      {report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 && (
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Terrace</div>
                          <div className="font-semibold text-gray-900">{report.propertyData.terraceAreaM2.toLocaleString()} m²</div>
                        </div>
                      )}
                      {report.propertyData.plotArea && report.propertyData.plotArea > 0 ? (
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Plot</div>
                          <div className="font-semibold text-gray-900">{report.propertyData.plotArea.toLocaleString()} m²</div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Euro className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Asking Price</span>
                    </div>
                    <p className="font-semibold text-gray-900">
                      {report.propertyData.price ? formatPrice(report.propertyData.price) : 'Not specified'}
                    </p>
                    {report.propertyData.price && report.propertyData.buildArea && report.propertyData.buildArea > 0 && (
                      <p className="text-sm text-gray-600 mt-1">
                        {formatPrice(Math.round(report.propertyData.price / report.propertyData.buildArea))}/m²
                      </p>
                    )}
                  </div>
                  
                  {(report.propertyData.bedrooms > 0 || report.propertyData.bathrooms > 0) && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Bedrooms/Bathrooms</span>
                      </div>
                      <p className="font-semibold text-gray-900">
                        {report.propertyData.bedrooms > 0 && `${report.propertyData.bedrooms}bd`}
                        {report.propertyData.bedrooms > 0 && report.propertyData.bathrooms > 0 && ' / '}
                        {report.propertyData.bathrooms > 0 && `${report.propertyData.bathrooms}ba`}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Image Gallery - Mobile: full width, Desktop: aligned with grey boxes */}
              <div className="lg:h-64 space-y-4 lg:space-y-0 lg:flex lg:gap-4">
                {/* Image - Mobile: full width, Desktop: left half */}
                <div className="h-64 lg:w-1/2 lg:h-full relative">
                  {currentImages.length > 0 ? (
                    <div 
                      className="w-full h-full cursor-pointer group rounded-lg overflow-hidden relative"
                      onClick={() => openGallery(0)}
                    >
                      <LazyPropertyImage
                        src={getImageUrl(currentImages[0])}
                        alt={`${report.propertyData.propertyType} in ${fixSpanishCharacters(report.propertyData.city)}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        priority={true}
                      />
                      {/* Overlay on hover */}
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-white">
                          <Camera className="w-8 h-8 mx-auto mb-1" />
                          <p className="text-sm font-medium">View {hasMultipleImages ? `${currentImages.length} Photos` : 'Photo'}</p>
                        </div>
                      </div>
                      {/* Multiple images indicator */}
                      {hasMultipleImages && (
                        <div className="absolute top-3 right-3 bg-black bg-opacity-70 text-white px-2 py-1 rounded text-sm">
                          1 / {currentImages.length}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-full h-full bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <Home className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No image available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Map - Mobile: full width below image, Desktop: right half beside image */}
                <div className="h-64 lg:w-1/2 lg:h-full rounded-lg overflow-hidden">
                  <GoogleMapView 
                    center={propertyCoordinates}
                    amenities={report.nearbyAmenities || []}
                    layers={mapLayers}
                  />
                </div>
              </div>
            </div>
            

            
            {/* Property Features Section */}
            {report.propertyData.features && report.propertyData.features.length > 0 && (
              <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Property Features</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {report.propertyData.features.slice(0, 10).map((feature, index) => (
                    <span key={index} className="text-xs bg-gray-50 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                      {normalizeFeature(feature)}
                    </span>
                  ))}
                  {report.propertyData.features.length > 10 && (
                    <span className="text-xs text-gray-400">+{report.propertyData.features.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Enhanced AI Property Analysis */}
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-primary">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Property Analysis & Investment Highlights</h3>
                  
                  {/* AI Summary if available */}
                  {report.summary?.overview && (
                    <p className="text-gray-700 leading-relaxed mb-4">{report.summary.overview}</p>
                  )}
                  
                  {/* Location Highlights */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">📍 Location Advantages</h4>
                    <p className="text-gray-700 leading-relaxed">
                      This {report.propertyData.propertyType.toLowerCase()} is strategically located in {fixSpanishCharacters(report.propertyData.city)}, {fixSpanishCharacters(normalizeProvinceName(report.propertyData.province))} - 
                      a prime area on the Costa del Sol known for its excellent climate, proximity to international amenities, and strong rental market appeal. 
                      {fixSpanishCharacters(report.propertyData.city) === 'San Pedro de Alcántara' && 
                        ' The location offers easy access to Marbella, Puerto Banús, and pristine beaches, making it highly desirable for both residents and investors.'
                      }
                    </p>
                  </div>
                  

                  
                  {/* Investment Potential */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">💰 Investment Potential</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {report.summary.investmentPotential || (
                        <>
                          {fixSpanishCharacters(report.propertyData.city)} presents compelling investment opportunities with its established reputation as a prime Costa del Sol destination. 
                          {report.propertyData.propertyType === 'Penthouse' && 
                            `Premium penthouses in ${fixSpanishCharacters(report.propertyData.city)} command strong rental yields and attract affluent international buyers seeking luxury accommodations. `
                          }
                          {report.propertyData.propertyType === 'Villa' && 
                            `Luxury villas in ${fixSpanishCharacters(report.propertyData.city)} are highly sought after by international buyers and holiday rental markets, particularly from Northern Europe. `
                          }
                          {report.propertyData.propertyType === 'Apartment' && 
                            `Well-positioned apartments in ${fixSpanishCharacters(report.propertyData.city)} offer excellent rental potential from both permanent residents and the thriving vacation rental market. `
                          }
                          The neighbourhood's proximity to amenities, established infrastructure, and strong tourism appeal make this {report.propertyData.bedrooms}-bedroom property an attractive investment opportunity in the {fixSpanishCharacters(report.propertyData.city)} market.
                        </>
                      )}
                    </p>
                  </div>
                  
                  {/* Future Development & Market Outlook */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">🚀 Market Outlook</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {report.summary.marketPosition || (
                        <>
                          The {fixSpanishCharacters(report.propertyData.city)} property market benefits from its strategic location and established infrastructure, making it a preferred destination for international buyers. 
                          {report.futureDevelopment && report.futureDevelopment.length > 0 ? (
                            ` The neighbourhood outlook is enhanced by ${report.futureDevelopment.length} upcoming development projects, which will further improve local amenities and infrastructure.`
                          ) : (
                            ` The mature residential character of this ${fixSpanishCharacters(report.propertyData.city)} neighbourhood provides market stability while maintaining potential for steady appreciation.`
                          )}
                          {report.nearbyAmenities && report.nearbyAmenities.length > 0 && (
                            ` With ${report.nearbyAmenities.length} nearby amenities including schools, shopping, and recreational facilities, this area continues to attract families and investors seeking quality lifestyle options.`
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Feedback for Property Analysis & Investment Highlights Section */}
              <div className="flex justify-end mt-4">
                {(() => {
                  // Reduced logging for production
                  return null;
                })()}
                <SimpleFeedbackButtons 
                  sectionId="property-analysis"
                  sessionId={sessionId}
                  className="text-sm"
                />
              </div>
          </div>

          {/* 📈 Market Data */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Market Data & Trends</h2>
            </div>
            
            <MarketChart marketTrends={report.marketTrends} />
            
            {/* Feedback for Market Data & Trends Section */}
            <div className="flex justify-end mt-4">
              {(() => {
                // Reduced logging for production
                return null;
              })()}
              <SimpleFeedbackButtons 
                sectionId="market-data-trends"
                sessionId={sessionId}
                className="text-sm"
              />
            </div>
          </div>

          {/* 💰 Full Valuation Analysis */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Euro className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Valuation Analysis</h2>
            </div>
            
            <div className="space-y-6">
              {/* Market Value Estimation */}
              <div className="bg-gradient-to-r from-[#00ae9a]/10 to-[#00c5ad]/10 p-6 rounded-lg border-l-4 border-[#00ae9a]">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-gray-900">Estimated Market Value</h3>
                  <div className="text-right">
                    {report.valuationEstimate.estimated > 0 ? (
                      <div>
                        <div className="text-2xl font-bold text-[#00ae9a]">
                          {formatPrice(report.valuationEstimate.estimated)}
                        </div>
                        <div className="text-sm text-[#00ae9a]/80">
                          {report.valuationEstimate.confidence}% confidence
                        </div>
                      </div>
                    ) : (
                      <div className="text-lg text-gray-600">Valuation Pending</div>
                    )}
                  </div>
                </div>
                
                {report.valuationEstimate.estimated > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-sm text-gray-600">Conservative</div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(report.valuationEstimate.low)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-[#00ae9a] rounded-lg">
                      <div className="text-sm text-white">Market Value</div>
                      <div className="font-semibold text-white">
                        {formatPrice(report.valuationEstimate.estimated)}
                      </div>
                    </div>
                    <div className="text-center p-3 bg-white rounded-lg">
                      <div className="text-sm text-gray-600">Optimistic</div>
                      <div className="font-semibold text-gray-900">
                        {formatPrice(report.valuationEstimate.high)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Valuation Recommendation */}
              {report.valuationEstimate.estimated > 0 && report.propertyData.price && (
                <div className={`p-6 rounded-lg border-l-4 ${
                  (() => {
                    const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                    if (percentageDiff > 10) return 'bg-red-50 border-red-400'
                    if (percentageDiff < -10) return 'bg-green-50 border-green-400'
                    return 'bg-blue-50 border-blue-400'
                  })()
                }`}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-semibold text-gray-900">Valuation Recommendation</h3>
                    <div className={`px-4 py-2 rounded-full text-sm font-bold ${
                      (() => {
                        const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                        if (percentageDiff > 10) return 'bg-red-100 text-red-800'
                        if (percentageDiff < -10) return 'bg-green-100 text-green-800'
                        return 'bg-blue-100 text-blue-800'
                      })()
                    }`}>
                      {(() => {
                        const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                        if (percentageDiff > 10) return 'OVERPRICED'
                        if (percentageDiff < -10) return 'UNDERVALUED'
                        return 'FAIRLY PRICED'
                      })()}
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Asking Price:</span>
                      <span className="font-semibold text-gray-900">{formatPrice(report.propertyData.price)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Market Value:</span>
                      <span className="font-semibold text-[#00ae9a]">{formatPrice(report.valuationEstimate.estimated)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Difference:</span>
                      <span className={`font-semibold ${
                        (() => {
                          const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                          if (percentageDiff > 0) return 'text-red-600'
                          if (percentageDiff < 0) return 'text-green-600'
                          return 'text-gray-600'
                        })()
                      }`}>
                        {(() => {
                          const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                          const sign = percentageDiff > 0 ? '+' : ''
                          return `${sign}${percentageDiff.toFixed(1)}%`
                        })()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-4 bg-white rounded-lg border">
                    <div className="font-semibold text-gray-900 mb-2">
                      {(() => {
                        const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                        if (percentageDiff > 10) return '💡 Price Adjustment Recommended'
                        if (percentageDiff < -10) return '🎯 Excellent Opportunity!'
                        return '✅ Fair Market Value'
                      })()}
                    </div>
                    <div className="text-sm text-gray-700">
                      {(() => {
                        const percentageDiff = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                        const absPercentage = Math.abs(percentageDiff)
                        
                        if (percentageDiff > 10) {
                          if (report.marketTrends.marketTrend === 'up') {
                            return `Property is ${absPercentage.toFixed(1)}% above market value, but market conditions are favorable. Consider reducing price by 5-10% to attract more buyers while maintaining good returns.`
                          } else if (report.marketTrends.marketTrend === 'down') {
                            return `Property is ${absPercentage.toFixed(1)}% overpriced in a challenging market. Significant price reduction recommended (10-15%) to remain competitive.`
                          } else {
                            return `Property is ${absPercentage.toFixed(1)}% above market value. Consider price adjustment to align with market expectations.`
                          }
                        } else if (percentageDiff < -10) {
                          if (report.marketTrends.marketTrend === 'up') {
                            return `Excellent opportunity! Property is ${absPercentage.toFixed(1)}% below market value in a rising market. Buy now! This represents exceptional value with strong upside potential.`
                          } else {
                            return `Property appears ${absPercentage.toFixed(1)}% undervalued compared to market analysis. Strong buying opportunity with potential for value appreciation.`
                          }
                        } else {
                          if (report.marketTrends.marketTrend === 'up') {
                            return 'Property is fairly priced in a favorable market environment. Good timing for purchase with potential for moderate appreciation.'
                          } else if (report.marketTrends.marketTrend === 'down') {
                            return 'Property is fairly priced but market conditions are challenging. Consider waiting for better market conditions or negotiate for additional discounts.'
                          } else {
                            return 'Property is fairly priced relative to market value. Standard market conditions - proceed with normal due diligence.'
                          }
                        }
                      })()}
                    </div>
                  </div>
                </div>
              )}

              {/* Valuation Methodology */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Valuation Methodology</h3>
                  <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#00ae9a] rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">Base Value Calculation</div>
                      <div className="text-sm text-gray-600">
                        {report.comparableProperties.length > 0 ? 
                          `Based on ${report.comparablePropertiesTotal || report.comparableProperties.length} properties analyzed in the area` :
                          'Limited comparable data available'
                        }
                    </div>
                    </div>
                    </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#00ae9a] rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">Condition Assessment</div>
                      <div className="text-sm text-gray-600">
                        {report.propertyData.condition ? 
                          `Property condition: ${report.propertyData.condition} - affects valuation by ${(() => {
                            const impacts = {
                              'excellent': '+15%',
                              'good': '+5%',
                              'fair': '0%',
                              'needs work': '-10%',
                              'renovation project': '-15%',
                              'rebuild': '-20%'
                            }
                            return impacts[report.propertyData.condition] || '0%'
                          })()}` :
                          'Condition assessment not available'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#00ae9a] rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">Market Trends</div>
                      <div className="text-sm text-gray-600">
                        {report.marketTrends.marketTrend ? 
                          `Current market trend: ${report.marketTrends.marketTrend} (${report.marketTrends.priceChange6Month > 0 ? '+' : ''}${report.marketTrends.priceChange6Month}% 6-month change)` :
                          'Market trend data not available'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3">
                    <div className="w-2 h-2 bg-[#00ae9a] rounded-full mt-2 flex-shrink-0"></div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">Location Factors</div>
                      <div className="text-sm text-gray-600">
                        {report.nearbyAmenities.length > 0 ? 
                          `${report.nearbyAmenities.length} nearby amenities considered` :
                          'Amenity data not available'
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Valuation Factors */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Valuation Factors</h3>
                {report.valuationEstimate.adjustments.length > 0 ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <div className="text-sm text-gray-600">
                        {report.valuationEstimate.adjustments.map(adjustment => {
                          // Enhance the Comparable Properties factor to show the count
                          if (adjustment.factor === 'Comparable Properties') {
                            return `Comparable Properties (${report.comparablePropertiesTotal || report.comparableProperties.length} properties)`
                          }
                          return adjustment.factor
                        }).join(', ')}
                        </div>
                          </div>
                    <div className="text-xs text-gray-500">
                      Based on analysis of {report.comparablePropertiesTotal || report.comparableProperties.length} properties analyzed in the area
                        </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="w-12 h-12 bg-[#00ae9a] rounded-full flex items-center justify-center text-white mx-auto mb-2">
                        📍
                      </div>
                      <div className="text-sm font-medium text-gray-900">Location Premium</div>
                      <div className="text-xs text-gray-600">Prime area advantage</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-[#00ae9a] rounded-full flex items-center justify-center text-white mx-auto mb-2">
                        🏗️
                      </div>
                      <div className="text-sm font-medium text-gray-900">Property Condition</div>
                      <div className="text-xs text-gray-600">Well-maintained</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white mx-auto mb-2">
                        🌟
                      </div>
                      <div className="text-sm font-medium text-gray-900">Unique Features</div>
                      <div className="text-xs text-gray-600">{report.propertyData.features?.length || 0} amenities</div>
                    </div>
                    <div className="text-center">
                      <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white mx-auto mb-2">
                        📈
                      </div>
                      <div className="text-sm font-medium text-gray-900">Market Demand</div>
                      <div className="text-xs text-gray-600">High interest area</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Valuation Confidence */}
              <div className="bg-amber-50 p-6 rounded-lg border-l-4 border-amber-400">
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Valuation Confidence</h3>
                <div className="flex items-center mb-3">
                  <div className="flex-1 bg-gray-200 rounded-full h-3">
                    <div 
                      className="bg-amber-500 h-3 rounded-full" 
                      style={{ width: `${report.valuationEstimate.confidence}%` }}
                    ></div>
                  </div>
                  <span className="ml-3 text-sm font-medium text-amber-700">
                    {report.valuationEstimate.confidence}% Confidence
                  </span>
                </div>
                <p className="text-sm text-gray-700">
                  {report.valuationEstimate.methodology}
                </p>
              </div>

              {/* Property Condition Assessment */}
              {report.propertyData.condition && (
                <div className="bg-blue-50 p-6 rounded-lg border-l-4 border-blue-400">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">Property Condition Assessment</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getConditionClass(report.propertyData.condition)}`}>
                          {report.propertyData.condition.charAt(0).toUpperCase() + report.propertyData.condition.slice(1)}
                      </span>
                        {report.propertyData.architecturalStyle && (
                          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                            {report.propertyData.architecturalStyle}
                          </span>
                        )}
                    </div>
                      <p className="text-sm text-gray-700">
                        {report.propertyData.yearBuilt ? 
                          `Built in ${report.propertyData.yearBuilt} (${new Date().getFullYear() - report.propertyData.yearBuilt} years old)` :
                          'Year built not specified'
                        }
                      </p>
                  </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-600">Condition Impact</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {(() => {
                          const conditionImpacts = {
                            'excellent': '+15%',
                            'good': '+5%',
                            'fair': '0%',
                            'needs work': '-10%',
                            'renovation project': '-15%',
                            'rebuild': '-20%'
                          }
                          return conditionImpacts[report.propertyData.condition] || '0%'
                        })()}
                </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Assessment */}
              {(() => {
                // Calculate price difference percentage
                const priceDifference = ((report.propertyData.price - report.valuationEstimate.estimated) / report.valuationEstimate.estimated) * 100
                
                // Determine risk level based on overpricing and other factors
                let riskLevel = 'low'
                let riskColor = '#166534'
                let riskBackground = '#f0fdf4'
                let riskBorder = '#bbf7d0'
                let riskIcon = '✅'
                
                // Check for high overpricing (major risk factor)
                if (priceDifference > 15) {
                  riskLevel = 'high'
                  riskColor = '#dc2626'
                  riskBackground = '#fef2f2'
                  riskBorder = '#fecaca'
                  riskIcon = '🚨'
                } else if (priceDifference > 10) {
                  riskLevel = 'medium'
                  riskColor = '#d97706'
                  riskBackground = '#fffbeb'
                  riskBorder = '#fed7aa'
                  riskIcon = '⚠️'
                }
                
                // Additional risk factors
                const riskFactors = []
                const positiveFactors = []
                
                // Price-related risks
                if (priceDifference > 15) {
                  riskFactors.push(`Severely overpriced (+${priceDifference.toFixed(1)}%)`)
                } else if (priceDifference > 10) {
                  riskFactors.push(`Overpriced (+${priceDifference.toFixed(1)}%)`)
                } else if (priceDifference < -10) {
                  positiveFactors.push(`Undervalued (${priceDifference.toFixed(1)}%)`)
                }
                
                // Market and property risks
                if (report.comparableProperties.length < 3) riskFactors.push('Limited comparable data')
                if (report.marketTrends.marketTrend === 'down') riskFactors.push('Declining market')
                if (report.propertyData.condition === 'needs work' || report.propertyData.condition === 'renovation project') riskFactors.push('Renovation required')
                if (report.nearbyAmenities.length < 3) riskFactors.push('Limited amenities')
                
                // Positive factors
                if (report.comparableProperties.length >= 5) positiveFactors.push('Strong comparable data')
                if (report.marketTrends.inventory > 10) positiveFactors.push('Active market')
                if (report.nearbyAmenities.length > 5) positiveFactors.push('Good location')
                if (report.propertyData.condition === 'excellent' || report.propertyData.condition === 'good') positiveFactors.push('Good condition')
                
                return (
                  <div className="bg-white p-6 rounded-lg border border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Assessment</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div style={{ background: riskBackground, borderColor: riskBorder }} className="p-4 rounded-lg border">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-2">{riskIcon}</span>
                          <span className="font-semibold" style={{ color: riskColor }}>{riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} Risk</span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {riskLevel === 'high' && priceDifference > 15 ? `Severely overpriced (+${priceDifference.toFixed(1)}%)` : 
                            riskLevel === 'medium' && priceDifference > 10 ? `Overpriced (+${priceDifference.toFixed(1)}%)` :
                            positiveFactors.length > 0 ? positiveFactors.join(', ') : 'Limited positive factors'}
                        </div>
                      </div>
                      
                      <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                        <div className="flex items-center mb-2">
                          <span className="text-xl mr-2">⚠️</span>
                          <span className="font-semibold text-amber-800">Considerations</span>
                        </div>
                        <div className="text-sm text-gray-700">
                          {riskFactors.length > 0 ? riskFactors.join(', ') : 'Standard market considerations'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Valuation Disclaimer */}
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-sm font-bold">!</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-amber-800 mb-1">Important Valuation Notice</h4>
                    <p className="text-sm text-amber-700 leading-relaxed">
                      This valuation is based on properties currently <strong>for sale</strong> (asking prices) rather than actual sold properties. 
                      The real market value could be <strong>5-15% lower</strong> than the estimated valuation, as asking prices typically exceed 
                      final sale prices due to negotiation factors, market conditions, and seller expectations.
                    </p>
                    <p className="text-sm text-amber-700 mt-2">
                      <strong>Recommendation:</strong> Use this valuation as a starting point for negotiations, but consider that the actual 
                      sale price may be lower than the asking prices used in this analysis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Feedback for Valuation Analysis Section */}
            <div className="flex justify-end mt-4">
              {(() => {
                // Reduced logging for production
                return null;
              })()}
              <SimpleFeedbackButtons 
                sectionId="valuation-analysis"
                sessionId={sessionId}
                className="text-sm"
              />
            </div>
          </div>

          {/* 🏘️ Comparable Properties */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Comparable Properties</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Top {report.comparableProperties.length} of {report.comparablePropertiesTotal || report.comparableProperties.length} compared properties
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Sort Controls */}
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="text-sm border border-gray-300 rounded-lg px-3 py-1 focus:ring-2 focus:ring-primary focus:border-transparent"
                  >
                    <option value="distance">Distance</option>
                    <option value="price-low">Price: Low to High</option>
                    <option value="price-high">Price: High to Low</option>
                    <option value="size-large">Size: Largest First</option>
                    <option value="size-small">Size: Smallest First</option>
                    <option value="price-per-m2-low">€/m²: Low to High</option>
                    <option value="price-per-m2-high">€/m²: High to Low</option>
                  </select>
                </div>
                
                {/* View Mode Controls */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'bg-gray-100 text-gray-600'}`}
                  >
                    <BarChart3 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
            
            {report.comparableProperties && report.comparableProperties.length > 0 ? (
              <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}>
                {sortComparableProperties(report.comparableProperties).map((comp, index) => (
                  <div key={index} className={`bg-gray-50 rounded-lg overflow-hidden ${viewMode === 'list' ? 'flex items-start space-x-4' : ''}`}>
                    {/* Property Image - Collage Layout */}
                    {(() => {
                      // Debug: Log image data for first comparable
                      if (index === 0) {
                        // Reduced logging for production
                      }
                      
                      return comp.images && comp.images.length > 0 ? (
                        <div className={`${viewMode === 'list' ? 'w-32 h-24 flex-shrink-0' : 'w-full h-48'}`}>
                          {/* Always use collage layout for consistent alignment */}
                          <div className="w-full h-full flex gap-1">
                                                        {/* Large image on the left */}
                            <div className="w-2/3 h-full">
                              <LazyComparableImage
                                src={comp.images[0]?.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
                                  ? `/api/proxy-image?url=${encodeURIComponent(comp.images[0])}`
                                  : comp.images[0]
                                } 
                                alt={`${comp.address} property image`}
                                className="w-full h-full object-cover object-center rounded-l-lg comparable-property-image"
                                style={{ 
                                  objectPosition: 'center center',
                                  objectFit: 'cover',
                                  width: '100%',
                                  height: '100%',
                                  minWidth: '100%',
                                  minHeight: '100%',
                                  maxWidth: '100%',
                                  maxHeight: '100%'
                                }}
                              />
                            </div>
                            
                            {/* 2 equal-sized images on the right - using CSS Grid for better vertical image handling */}
                            <div className="w-1/3 h-full grid grid-rows-2 gap-1">
                              {comp.images.length > 1 ? (
                                // Show actual images if available
                                comp.images.slice(1, 3).map((image, imgIndex) => (
                                  <div key={imgIndex} className="relative w-full h-full overflow-hidden">
                                    <LazyComparableImage
                                      src={image?.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
                                        ? `/api/proxy-image?url=${encodeURIComponent(image)}`
                                        : image
                                      } 
                                      alt={`${comp.address} property image ${imgIndex + 2}`}
                                      className="w-full h-full object-cover object-center"
                                      style={{
                                        objectPosition: 'center center',
                                        objectFit: 'cover',
                                        width: '100%',
                                        height: '100%',
                                        minWidth: '100%',
                                        minHeight: '100%',
                                        maxWidth: '100%',
                                        maxHeight: '100%',
                                        borderTopRightRadius: imgIndex === 0 ? '0.5rem' : '0',
                                        borderBottomRightRadius: imgIndex === 1 ? '0.5rem' : '0'
                                      }}
                                    />
                                  </div>
                                ))
                              ) : null}
                              
                              {/* Always fill empty slots to maintain consistent layout */}
                              {Array.from({ length: Math.max(0, 2 - Math.min(comp.images.length - 1, 2)) }).map((_, fillIndex) => (
                                <div key={`fill-${fillIndex}`} className="w-full h-full bg-gray-200 flex items-center justify-center">
                                  <Building className="w-4 h-4 text-gray-400" />
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`${viewMode === 'list' ? 'w-32 h-24 flex-shrink-0' : 'w-full h-48'} bg-gray-200 flex items-center justify-center`}>
                          <div className="text-center text-gray-500">
                            <Building className="w-6 h-6 mx-auto mb-1 opacity-50" />
                            <p className="text-xs">No image</p>
                          </div>
                        </div>
                      );
                    })()}
                    
                    <div className={`p-4 ${viewMode === 'list' ? 'flex-1' : ''}`}>
                      <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-gray-900 text-sm">{formatComparableAddress(comp.address)}</h3>
                        {comp.refNumber && (
                          <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                            Ref: {comp.refNumber}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{comp.propertyType}</p>
                      
                      {/* Price and Distance in prominent position */}
                      <div className="mb-3 space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-primary text-lg">{formatPrice(comp.price)}</span>
                          <span className="text-xs bg-gray-200 px-2 py-1 rounded">{comp.distance === 0 ? 'Same Area' : formatDistance(comp.distance)}</span>
                        </div>
                        {comp.buildArea && comp.buildArea > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">{formatPrice(Math.round(comp.price / comp.buildArea))}/m²</span>
                          </div>
                        )}
                      </div>

                      {/* Compact grid layout for property details */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        {comp.bedrooms > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">🛏️</span>
                            <span className="font-medium">{comp.bedrooms} bed{comp.bedrooms !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {comp.bathrooms > 0 && (
                          <div className="flex items-center space-x-1">
                            <span className="text-gray-500">🚿</span>
                            <span className="font-medium">{comp.bathrooms} bath{comp.bathrooms !== 1 ? 's' : ''}</span>
                          </div>
                        )}
                        {(() => {
                          const areas = [];
                          if (comp.buildArea && comp.buildArea > 0) {
                            areas.push(`${comp.buildArea.toLocaleString()}m² build`);
                          }
                          if (comp.terraceArea && comp.terraceArea > 0) {
                            areas.push(`${comp.terraceArea.toLocaleString()}m² terrace`);
                          }
                          if (comp.plotArea && comp.plotArea > 0) {
                            areas.push(`${comp.plotArea.toLocaleString()}m² plot`);
                          }
                          
                          if (areas.length > 0) {
                            return (
                              <div className="text-xs text-gray-600">
                                {areas.join(' • ')}
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      {/* Features - prioritize matching main property features */}
                      {comp.features && comp.features.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <div className="flex flex-wrap gap-1">
                            {(() => {
                              // Debug: Log the raw features to see what we're getting
                              if (index === 0) {
                                // Reduced logging for production
                              }
                              
                              const mainFeatures = (report.propertyData.features || []).map(normalizeFeature);
                              const compFeatures = (comp.features || []).map(normalizeFeature);

                              // Debug: Log the normalized features
                              if (index === 0) {
                                // Reduced logging for production
                              }

                              // Find matching features first (canonical)
                              const matchingFeatures = compFeatures.filter(feature =>
                                mainFeatures.includes(feature)
                              );
                              // Find non-matching features
                              const nonMatchingFeatures = compFeatures.filter(feature =>
                                !mainFeatures.includes(feature)
                              );
                              // Combine: matching first, then non-matching, limit to 5 total
                              const prioritizedFeatures = [
                                ...matchingFeatures,
                                ...nonMatchingFeatures
                              ].slice(0, 5);

                              return prioritizedFeatures.map((feature, idx) => {
                                const isMatching = mainFeatures.includes(feature);
                                return (
                                  <span
                                    key={idx}
                                    className={`text-xs px-1.5 py-0.5 rounded border ${
                                      isMatching
                                        ? 'bg-teal-50 text-teal-600 border-teal-200'
                                        : 'bg-gray-50 text-gray-500 border-gray-200'
                                    }`}
                                  >
                                    {feature}
                                  </span>
                                );
                              });
                            })()}
                            {comp.features.length > 5 && (
                              <span className="text-xs text-gray-400">+{comp.features.length - 5} more</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <Building className="w-12 h-12 text-yellow-500 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-yellow-800 mb-2">Comparable Properties Not Available</h3>
                <p className="text-yellow-700">
                  No comparable properties were found in the area. This may affect the accuracy of the market analysis.
                  Please contact admin if this persists.
                </p>
              </div>
            )}
            
            {/* Feedback for Comparable Properties Section */}
            <div className="flex justify-end mt-4">
              {(() => {
                // Reduced logging for production
                return null;
              })()}
              <SimpleFeedbackButtons 
                sectionId="comparable-properties"
                sessionId={sessionId}
                className="text-sm"
              />
            </div>
          </div>

          {/* 🗺️ Map of Amenities */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Navigation className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Nearby Amenities</h2>
            </div>
            
            <div className="flex flex-wrap gap-3 mb-6">
              {Object.entries(mapLayers)
                .filter(([layer]) => {
                  // Only show toggle if there are amenities of this type
                  return report.nearbyAmenities && report.nearbyAmenities.some(amenity => amenity.type === layer)
                })
                .map(([layer, isVisible]) => {
                  const icons = {
                    schools: School,
                    shopping: ShoppingCart,
                    transport: Car,
                    healthcare: Heart,
                    recreation: TreePine,
                    dining: Utensils,
                    entertainment: Zap,
                    zoo: PawPrint,
                    waterpark: Waves,
                    cinema: Video,
                    casino: Coins,
                    museum: Building2,
                    golf: Flag,
                    beach: Sun
                  }
                  
                  // Color mapping for amenity types to match map pins
                  const colorMap = {
                    schools: '#3B82F6',
                    shopping: '#EF4444',
                    transport: '#8B5CF6',
                    healthcare: '#10B981',
                    recreation: '#F59E0B',
                    dining: '#EC4899',
                    entertainment: '#FF6B35',
                    zoo: '#8B4513',
                    waterpark: '#00CED1',
                    cinema: '#FF1493',
                    casino: '#FFD700',
                    museum: '#9932CC',
                    golf: '#228B22',
                    beach: '#87CEEB'
                  }
                  
                  const Icon = icons[layer as keyof typeof icons]
                  const borderColor = colorMap[layer as keyof typeof colorMap] || '#6B7280'
                  
                  return (
                    <button
                      key={layer}
                      onClick={() => toggleMapLayer(layer as keyof typeof mapLayers)}
                      className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all relative ${
                        isVisible 
                          ? 'bg-primary text-white border-primary' 
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary'
                      }`}
                      style={{
                        borderLeftColor: isVisible ? borderColor : borderColor,
                        borderLeftWidth: '4px'
                      }}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="capitalize">{layer}</span>
                      {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  )
                })}
            </div>
            
            {report.nearbyAmenities && report.nearbyAmenities.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <GoogleMapView 
                    center={propertyCoordinates}
                    amenities={report.nearbyAmenities}
                    layers={mapLayers}
                  />
                  <p className="text-xs text-gray-500 italic text-center">
                    Note: Map locations might be approximate*
                  </p>
                </div>
                
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {report.nearbyAmenities
                    .filter(amenity => mapLayers[amenity.type as keyof typeof mapLayers])
                    .map((amenity, index) => (
                    <div key={index} className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <span className="text-2xl">{getAmenityIcon(amenity.type)}</span>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{amenity.name}</h3>
                          <p className="text-sm text-gray-600 mb-2">{amenity.description}</p>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">{formatDistance(amenity.distance)}</span>
                            {amenity.rating && (
                              <span className="text-sm font-medium text-yellow-600">
                                ⭐ {amenity.rating}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <Navigation className="w-12 h-12 text-yellow-500 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-yellow-800 mb-2">Amenities Data Not Available</h3>
                <p className="text-yellow-700">
                  Real-time amenities information could not be retrieved for this location.
                  This may be due to API limitations or the location being outside our coverage area.
                </p>
              </div>
            )}
            
            {/* Enhanced Amenities Summary */}
            <div className="mt-6 bg-gradient-to-r from-[#00ae9a]/10 to-[#00c5ad]/10 p-6 rounded-lg border border-[#00ae9a]/30">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Location & Amenities Overview</h3>
                
                {/* AI-Generated Location Context */}
                <div className="mb-4">
                  <h4 className="font-medium text-gray-800 mb-2">🏘️ Area Context</h4>
                  <p className="text-gray-700 leading-relaxed">
                    {report.summary.locationOverview || (() => {
                      const address = fixSpanishCharacters(report.propertyData.address || '')
                      const city = fixSpanishCharacters(report.propertyData.city || '')
                      const province = fixSpanishCharacters(normalizeProvinceName(report.propertyData.province || ''))
                      
                      // Extract urbanization/neighborhood from address
                      const urbanization = extractLocationName(address, city)
                      
                      // Determine the most specific location context available
                      if (urbanization && urbanization !== city) {
                        // We have urbanization + street level detail
                        return `This property is located in ${urbanization}, a well-established area within ${city}, ${province}. The ${urbanization} neighborhood offers a mix of residential properties and local amenities, providing an excellent balance of tranquility and convenience.`
                      } else if (address && address !== city) {
                        // We have street + neighborhood level detail
                        const streetName = address.split(',')[0].trim()
                        return `Located on ${streetName} in ${city}, ${province}, this area benefits from the city's established infrastructure and growing reputation as a desirable residential destination. The neighborhood provides easy access to essential services and amenities.`
                      } else {
                        // We have neighborhood + city level detail
                        return `Situated in ${city}, ${province}, this property is part of a mature residential area with established amenities and infrastructure. ${city} is known for its excellent quality of life and strategic location within ${province}.`
                      }
                    })()}
                  </p>
                </div>

                {/* AI-Generated Amenities Analysis */}
                {report.nearbyAmenities && report.nearbyAmenities.length > 0 && (
                  <div className="mb-4">
                    <h4 className="font-medium text-gray-800 mb-2">🏪 Amenities Analysis</h4>
                    <div className="space-y-3">
                      <p className="text-gray-700 leading-relaxed">
                        {report.summary.amenitiesAnalysis || (() => {
                          const amenities = report.nearbyAmenities
                          const totalAmenities = amenities.length
                          const closestAmenity = amenities.reduce((closest, current) => 
                            current.distance < closest.distance ? current : closest
                          )
                          const averageDistance = amenities.reduce((sum, amenity) => 
                            sum + amenity.distance, 0
                          ) / totalAmenities
                          
                          return `The area features ${totalAmenities} nearby amenities within an average distance of ${formatDistance(averageDistance)}. The closest amenity is ${closestAmenity.name} at ${formatDistance(closestAmenity.distance)}.`
                        })()}
                      </p>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {(() => {
                          const amenities = report.nearbyAmenities
                          const amenityTypes = amenities.reduce((acc, amenity) => {
                            acc[amenity.type] = (acc[amenity.type] || 0) + 1
                            return acc
                          }, {} as Record<string, number>)
                          
                          return Object.entries(amenityTypes).map(([type, count]) => (
                            <div key={type} className="bg-white/50 rounded-lg p-3 border border-[#00ae9a]/20">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">{getAmenityIcon(type)}</span>
                                <div>
                                  <div className="font-medium text-gray-800 capitalize">{type}</div>
                                  <div className="text-sm text-gray-600">{count} {count === 1 ? 'location' : 'locations'}</div>
                                </div>
                              </div>
                            </div>
                          ))
                        })()}
                      </div>
                      
                      {report.nearbyAmenities.some(a => a.rating) && (
                        <div className="mt-3 p-3 bg-white/50 rounded-lg border border-[#00ae9a]/20">
                          <h5 className="font-medium text-gray-800 mb-2">⭐ Top Rated Amenities</h5>
                          <div className="space-y-2">
                            {report.nearbyAmenities
                              .filter(a => a.rating && a.rating >= 4.0)
                              .slice(0, 3)
                              .map((amenity, index) => (
                                <div key={index} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-700">{amenity.name}</span>
                                  <span className="text-yellow-600 font-medium">⭐ {amenity.rating}</span>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* AI-Generated Lifestyle Assessment */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-2">🌟 Lifestyle & Convenience</h4>
                  <p className="text-gray-700 leading-relaxed">
                    {report.summary.lifestyleAssessment || (() => {
                      const amenities = report.nearbyAmenities || []
                      const hasSchools = amenities.some(a => a.type === 'school')
                      const hasShopping = amenities.some(a => a.type === 'shopping')
                      const hasTransport = amenities.some(a => a.type === 'transport')
                      const hasHealthcare = amenities.some(a => a.type === 'healthcare')
                      const hasRecreation = amenities.some(a => a.type === 'recreation')
                      const hasDining = amenities.some(a => a.type === 'dining')
                      
                      const availableServices = []
                      if (hasSchools) availableServices.push('educational facilities')
                      if (hasShopping) availableServices.push('shopping centers')
                      if (hasTransport) availableServices.push('transportation options')
                      if (hasHealthcare) availableServices.push('healthcare services')
                      if (hasRecreation) availableServices.push('recreational activities')
                      if (hasDining) availableServices.push('dining establishments')
                      
                      const city = fixSpanishCharacters(report.propertyData.city || '')
                      const province = fixSpanishCharacters(normalizeProvinceName(report.propertyData.province || ''))
                      
                      if (availableServices.length >= 4) {
                        return `This location offers excellent lifestyle convenience with access to ${availableServices.slice(0, -1).join(', ')} and ${availableServices[availableServices.length - 1]}. The comprehensive amenity coverage makes ${city} an attractive destination for families and professionals seeking a well-connected residential environment in ${province}.`
                      } else if (availableServices.length >= 2) {
                        return `The area provides good access to ${availableServices.join(' and ')}, offering essential services for daily living. ${city} continues to develop its infrastructure, enhancing the quality of life for residents in ${province}.`
                      } else {
                        return `While the immediate area may have limited amenities, ${city} benefits from ${province}'s established infrastructure and ongoing development projects that will enhance local services and convenience for residents.`
                      }
                    })()}
                  </p>
                </div>
              </div>
            </div>
            
            {/* Feedback for Nearby Amenities Section */}
            <div className="flex justify-end mt-4">
              {(() => {
                // Reduced logging for production
                return null;
              })()}
              <SimpleFeedbackButtons 
                sectionId="nearby-amenities"
                sessionId={sessionId}
                className="text-sm"
              />
            </div>
          </div>

          {/* 🚶 Mobility & Transportation */}
          {report.walkabilityData && (
            <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#00ae9a' }}>
                  <Footprints className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Mobility & Transportation</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
                {/* Walking Score */}
                <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-6 rounded-lg border border-teal-200">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00ae9a' }}>
                      <Footprints className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Walking</h3>
                      <p className="text-sm text-gray-600">Pedestrian Access</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold mb-2" style={{ color: '#00ae9a' }}>
                      {report.walkabilityData.walkingScore || report.walkabilityData.walkScore || 0}
                    </div>
                    <div className="text-sm text-gray-700 font-medium">
                      {report.walkabilityData.walkingDescription || report.walkabilityData.walkDescription || 'Not Available'}
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full transition-all duration-1000"
                      style={{ 
                        background: `linear-gradient(to right, #00c5ad, #00ae9a)`,
                        width: `${Math.min(report.walkabilityData.walkingScore || report.walkabilityData.walkScore || 0, 100)}%` 
                      }}
                    />
                  </div>
                  {report.walkabilityData.averageWalkTime && (
                    <div className="mt-3 text-xs text-gray-600 text-center">
                      Avg. walk time: {report.walkabilityData.averageWalkTime} min
                    </div>
                  )}
                </div>

                {/* Driving Score */}
                {report.walkabilityData.drivingScore && (
                  <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-6 rounded-lg border border-purple-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center">
                        <Navigation className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Driving</h3>
                        <p className="text-sm text-gray-600">Vehicle Access</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold text-purple-600 mb-2">
                        {report.walkabilityData.drivingScore}
                      </div>
                      <div className="text-sm text-gray-700 font-medium">
                        {report.walkabilityData.drivingDescription}
                      </div>
                    </div>
                    <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-400 to-purple-600 transition-all duration-1000"
                        style={{ width: `${Math.min(report.walkabilityData.drivingScore, 100)}%` }}
                      />
                    </div>
                    {report.walkabilityData.averageDriveTime && (
                      <div className="mt-3 text-xs text-gray-600 text-center">
                        Avg. drive time: {report.walkabilityData.averageDriveTime} min
                      </div>
                    )}
                  </div>
                )}

                {/* Transit Score */}
                <div className="bg-gradient-to-br from-[#00ae9a]/10 to-[#00c5ad]/10 p-6 rounded-lg border border-[#00ae9a]/30">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-[#00ae9a] rounded-full flex items-center justify-center">
                      <Train className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">Transit</h3>
                      <p className="text-sm text-gray-600">Public Transport</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-[#00ae9a] mb-2">
                      {report.walkabilityData.transitScore || 0}
                    </div>
                    <div className="text-sm text-gray-700 font-medium">
                      {report.walkabilityData.transitDescription || 'Not Available'}
                    </div>
                  </div>
                  <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div 
                      className="h-full transition-all duration-1000"
                      style={{ 
                        background: `linear-gradient(to right, #00c5ad, #00ae9a)`,
                        width: `${Math.min(report.walkabilityData.transitScore || 0, 100)}%` 
                      }}
                    />
                  </div>
                  {report.walkabilityData.transitAccessibleDestinations && (
                    <div className="mt-3 text-xs text-gray-600 text-center">
                      {report.walkabilityData.transitAccessibleDestinations} destinations accessible
                    </div>
                  )}
                </div>

                {/* Overall Accessibility Score */}
                {report.walkabilityData.accessibilityScore && (
                  <div className="bg-gradient-to-br from-teal-50 to-cyan-50 p-6 rounded-lg border border-teal-200">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00ae9a' }}>
                        <MapPin className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">Overall</h3>
                        <p className="text-sm text-gray-600">Accessibility Score</p>
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-4xl font-bold mb-2" style={{ color: '#00ae9a' }}>
                        {report.walkabilityData.accessibilityScore}
                      </div>
                      <div className="text-sm text-gray-700 font-medium">
                        Combined Mobility Rating
                      </div>
                    </div>
                    <div className="mt-4 bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div 
                        className="h-full transition-all duration-1000"
                        style={{ 
                          background: `linear-gradient(to right, #00c5ad, #00ae9a)`,
                          width: `${Math.min(report.walkabilityData.accessibilityScore, 100)}%` 
                        }}
                      />
                    </div>
                    {report.walkabilityData.reachableDestinations && (
                      <div className="mt-3 text-xs text-gray-600 text-center">
                        {report.walkabilityData.reachableDestinations} key destinations analyzed
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Feedback for Mobility & Transportation Section */}
              <div className="flex justify-end mt-4">
                {(() => {
                  // Reduced logging for production
                  return null;
                })()}
                <SimpleFeedbackButtons 
                  sectionId="mobility-transportation"
                  sessionId={sessionId}
                  className="text-sm"
                />
              </div>

            </div>
          )}

          {/* 🚧 Future Developments */}
          <div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Building className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Future Developments</h2>
            </div>
            
            {report.futureDevelopment && report.futureDevelopment.length > 0 ? (
              <div className="space-y-4">
                {report.futureDevelopment.map((dev, index) => (
                  <div key={index} className="bg-gradient-to-r from-gray-50 to-blue-50 p-4 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 text-lg mb-1">{dev.project}</h3>
                        <div className="flex items-center space-x-3 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Building className="w-4 h-4 mr-1" />
                            {dev.type.charAt(0).toUpperCase() + dev.type.slice(1)}
                          </span>
                          <span className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            ETA: {formatDate(dev.completionDate)}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2 ml-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(dev.status)}`}>
                          {dev.status.replace('_', ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getImpactColor(dev.impact)}`}>
                          {dev.impact.charAt(0).toUpperCase() + dev.impact.slice(1)} Impact
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getReputationColor(dev.reputationRating || 'fair')}`}>
                          {(dev.reputationRating || 'fair').charAt(0).toUpperCase() + (dev.reputationRating || 'fair').slice(1)} Source
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-3">{dev.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-200 pt-2">
                      <span className="flex items-center">
                        <MapPin className="w-3 h-3 mr-1" />
                        {fixSpanishCharacters(report.propertyData.city)} Area
                      </span>
                      <span className="flex items-center">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        Property Value Impact
                      </span>
                    </div>
                  </div>
                ))}
                
                {/* Summary of developments */}
                <div className="bg-[#00ae9a]/10 border border-[#00ae9a]/30 rounded-lg p-4 mt-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="w-5 h-5 text-[#00ae9a]" />
                    <h4 className="font-medium text-[#00ae9a]">Development Summary</h4>
                  </div>
                  <p className="text-sm text-[#00ae9a]/80">
                    {report.futureDevelopment.length} development project{report.futureDevelopment.length !== 1 ? 's' : ''} identified in the {fixSpanishCharacters(report.propertyData.city)} area. 
                    {report.futureDevelopment.filter(d => d.impact === 'positive').length > 0 && 
                      ` ${report.futureDevelopment.filter(d => d.impact === 'positive').length} project${report.futureDevelopment.filter(d => d.impact === 'positive').length !== 1 ? 's' : ''} expected to have positive impact on property values.`
                    }
                    {report.futureDevelopment.filter(d => d.status === 'under_construction').length > 0 &&
                      ` ${report.futureDevelopment.filter(d => d.status === 'under_construction').length} project${report.futureDevelopment.filter(d => d.status === 'under_construction').length !== 1 ? 's' : ''} currently under construction.`
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
                <Building className="w-12 h-12 text-yellow-500 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-yellow-800 mb-2">Development Data Not Available</h3>
                <p className="text-yellow-700 mb-4">
                  No future development information could be retrieved for this area.
                  Future developments can significantly impact property values - consider researching local planning offices for upcoming projects.
                </p>
                <div className="bg-yellow-100 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Tip:</strong> Check with the {fixSpanishCharacters(report.propertyData.city)} planning department or regional government websites for the latest development information.
                  </p>
                </div>
              </div>
            )}
            
            {/* Feedback for Future Developments Section */}
            <div className="flex justify-end mt-4">
              {(() => {
                // Reduced logging for production
                return null;
              })()}
              <SimpleFeedbackButtons 
                sectionId="future-developments"
                sessionId={sessionId}
                className="text-sm"
              />
            </div>
          </div>

          {/* 🤖 AI Summary Report Card */}
          <div variants={itemVariants} className="bg-gradient-to-br from-primary to-primary-light rounded-xl shadow-lg p-6 text-white">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold">AI Analysis Summary</h2>
            </div>
            
            <div className="bg-[#eff6ff] rounded-lg p-6 space-y-6">
              {/* Executive Summary */}
              <div>
                <h3 className="font-semibold mb-2 text-gray-900">📌 Executive Summary</h3>
                <p className="text-gray-800">{report.summary.overview}</p>
              </div>
              
              {/* Investment & Market Analysis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-semibold mb-2 text-gray-900">💰 Investment Recommendation</h3>
                  <p className="text-gray-800">{report.summary.investmentPotential}</p>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2 text-gray-900">📊 Market Position</h3>
                  <p className="text-gray-800">{report.summary.marketPosition}</p>
                </div>
              </div>
              
              {/* Valuation Range */}
              <div>
                <h3 className="font-semibold mb-2 text-gray-900">🔮 Valuation Range</h3>
                {report.valuationEstimate.estimated > 0 ? (
                  <div className="flex items-center space-x-4">
                    <span className="text-lg font-bold text-gray-900">{formatPrice(report.valuationEstimate.low)} - {formatPrice(report.valuationEstimate.high)}</span>
                    <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                      {report.valuationEstimate.confidence}% confidence
                    </span>
                  </div>
                ) : (
                  <div className="bg-gray-100 rounded-lg p-3">
                    <p className="text-gray-700 text-sm">
                      {report.valuationEstimate.methodology || 'Valuation data not available'}
                    </p>
                  </div>
                )}
              </div>

              {/* Property Condition & Architecture */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.summary.propertyCondition && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">🏠 Property Condition</h3>
                    <p className="text-gray-800">{report.summary.propertyCondition}</p>
                  </div>
                )}
                
                {report.summary.architecturalAnalysis && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">🏛️ Architectural Analysis</h3>
                    <p className="text-gray-800">{report.summary.architecturalAnalysis}</p>
                  </div>
                )}
              </div>

              {/* Market Timing & Investment Timing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.summary.marketTiming && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">⏰ Market Timing</h3>
                    <p className="text-gray-800">{report.summary.marketTiming}</p>
                  </div>
                )}
                
                {report.summary.investmentTiming && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">🎯 Investment Timing</h3>
                    <p className="text-gray-800">{report.summary.investmentTiming}</p>
                  </div>
                )}
              </div>

              {/* Walkability & Development Impact */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.summary.walkabilityInsights && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">🚶 Walkability Insights</h3>
                    <p className="text-gray-800">{report.summary.walkabilityInsights}</p>
                  </div>
                )}
                
                {report.summary.developmentImpact && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">🏗️ Development Impact</h3>
                    <p className="text-gray-800">{report.summary.developmentImpact}</p>
                  </div>
                )}
              </div>

              {/* Comparable Insights & Risk Assessment */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {report.summary.comparableInsights && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">📈 Comparable Insights</h3>
                    <p className="text-gray-800">{report.summary.comparableInsights}</p>
                  </div>
                )}
                
                {report.summary.riskAssessment && (
                  <div>
                    <h3 className="font-semibold mb-2 text-gray-900">📋 Key Considerations & Recommendations</h3>
                    <p className="text-gray-800">{report.summary.riskAssessment}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery Modal */}
      {isGalleryOpen && currentImages.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center p-4">
            {/* Close Button */}
            <button
              onClick={closeGallery}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Previous Button */}
            {hasMultipleImages && (
              <button
                onClick={prevImage}
                className="absolute left-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
              >
                <ChevronLeft className="w-8 h-8" />
              </button>
            )}

            {/* Image */}
            <div className="relative max-w-full max-h-full flex items-center justify-center">
              {brokenImages.has(currentImageIndex) ? (
                <div className="max-w-full max-h-full min-h-[400px] min-w-[600px] bg-gray-800 rounded-lg flex items-center justify-center text-white">
                  <div className="text-center">
                    <Home className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <h3 className="text-xl font-medium mb-2">Image Not Available</h3>
                    <p className="text-gray-300 mb-2">Image {currentImageIndex + 1} of {currentImages.length}</p>
                    <p className="text-sm text-gray-400">This image could not be loaded</p>
                  </div>
                </div>
              ) : (
                <LazyGalleryImage
                  src={currentImages[currentImageIndex]?.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
                    ? `/api/proxy-image?url=${encodeURIComponent(currentImages[currentImageIndex])}`
                    : currentImages[currentImageIndex]
                  }
                  alt={`${report.propertyData.propertyType} in ${fixSpanishCharacters(report.propertyData.city)} - Image ${currentImageIndex + 1}`}
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              )}
              
              {/* Image Counter */}
              {hasMultipleImages && (
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-full">
                  {currentImageIndex + 1} / {currentImages.length}
                </div>
              )}
            </div>

            {/* Next Button */}
            {hasMultipleImages && (
              <button
                onClick={nextImage}
                className="absolute right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
              >
                <ChevronRight className="w-8 h-8" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Download Options Modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Download CMA Report</h3>
              <button
                onClick={closeDownloadModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-gray-600 mb-4">
                Choose the report type that best fits your needs:
              </p>
              
              {/* PDF Format Toggle */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PDF Format
                </label>
                <div className="flex bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setPdfFormat('printable')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#00ae9a] focus:border-[#00ae9a] ${
                      pdfFormat === 'printable'
                        ? 'bg-[#00ae9a] text-white shadow-sm border border-[#00ae9a]'
                        : 'text-gray-600 hover:text-[#00ae9a] hover:bg-[#00ae9a]/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Printer className="w-4 h-4" />
                      <span>Printable</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setPdfFormat('mobile')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-[#00ae9a] focus:border-[#00ae9a] ${
                      pdfFormat === 'mobile'
                        ? 'bg-[#00ae9a] text-white shadow-sm border border-[#00ae9a]'
                        : 'text-gray-600 hover:text-[#00ae9a] hover:bg-[#00ae9a]/10 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Smartphone className="w-4 h-4" />
                      <span>Mobile</span>
                    </div>
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {pdfFormat === 'printable' 
                    ? 'Optimized for printing and desktop viewing' 
                    : 'Optimized for mobile devices and touch interaction'
                  }
                </p>
              </div>
              
              {(() => {
                // Enhanced property type detection with fallbacks
                const isSale = report.propertyData.isSale !== undefined ? report.propertyData.isSale : 
                              !report.propertyData.isShortTerm && !report.propertyData.isLongTerm && 
                              !report.propertyData.monthlyPrice && !report.propertyData.weeklyPriceFrom
                
                const isLongTerm = report.propertyData.isLongTerm || !!report.propertyData.monthlyPrice
                const isShortTerm = report.propertyData.isShortTerm || !!report.propertyData.weeklyPriceFrom
                
                // Reduced logging for production
                
                return isSale ? (
                  // Sale property options
                  <div className="space-y-3">
                    <button
                      onClick={() => handleExportPDF('Buyer')}
                      disabled={downloadingReportType !== null}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all ${
                        successReportType === 'Buyer' 
                          ? 'border-green-500 bg-green-50' 
                          : downloadingReportType === 'Buyer'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-[#00ae9a] hover:bg-[#00ae9a]/5'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">Buyer</h4>
                        <p className="text-sm text-gray-600">For potential buyers</p>
                      </div>
                      {successReportType === 'Buyer' ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : downloadingReportType === 'Buyer' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-[#00ae9a]" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleExportPDF('Seller')}
                      disabled={downloadingReportType !== null}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all ${
                        successReportType === 'Seller' 
                          ? 'border-green-500 bg-green-50' 
                          : downloadingReportType === 'Seller'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-[#00ae9a] hover:bg-[#00ae9a]/5'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">Seller</h4>
                        <p className="text-sm text-gray-600">For property sellers</p>
                      </div>
                      {successReportType === 'Seller' ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : downloadingReportType === 'Seller' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-[#00ae9a]" />
                      )}
                    </button>
                  </div>
                ) : (
                  // Rental property options
                  <div className="space-y-3">
                    <button
                      onClick={() => handleExportPDF('Owner')}
                      disabled={downloadingReportType !== null}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all ${
                        successReportType === 'Owner' 
                          ? 'border-green-500 bg-green-50' 
                          : downloadingReportType === 'Owner'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-[#00ae9a] hover:bg-[#00ae9a]/5'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">Owner</h4>
                        <p className="text-sm text-gray-600">For property owners</p>
                      </div>
                      {successReportType === 'Owner' ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : downloadingReportType === 'Owner' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-[#00ae9a]" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleExportPDF('Tenant')}
                      disabled={downloadingReportType !== null}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all ${
                        successReportType === 'Tenant' 
                          ? 'border-green-500 bg-green-50' 
                          : downloadingReportType === 'Tenant'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-[#00ae9a] hover:bg-[#00ae9a]/5'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">Tenant</h4>
                        <p className="text-sm text-gray-600">For potential tenants</p>
                      </div>
                      {successReportType === 'Tenant' ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : downloadingReportType === 'Tenant' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-[#00ae9a]" />
                      )}
                    </button>
                    
                    <button
                      onClick={() => handleExportPDF('Investor')}
                      disabled={downloadingReportType !== null}
                      className={`w-full flex items-center justify-between p-4 border rounded-lg transition-all ${
                        successReportType === 'Investor' 
                          ? 'border-green-500 bg-green-50' 
                          : downloadingReportType === 'Investor'
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-[#00ae9a] hover:bg-[#00ae9a]/5'
                      }`}
                    >
                      <div className="text-left">
                        <h4 className="font-semibold text-gray-900">Investor</h4>
                        <p className="text-sm text-gray-600">For rental investors</p>
                      </div>
                      {successReportType === 'Investor' ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : downloadingReportType === 'Investor' ? (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                      ) : (
                        <Download className="w-5 h-5 text-[#00ae9a]" />
                      )}
                    </button>
                  </div>
                )
              })()}
              
              <div className="pt-4 border-t border-gray-200">
                <button
                  onClick={closeDownloadModal}
                  className="w-full py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Panel */}
      <FeedbackPanel 
        sessionId={sessionId}
        report={report}
      />
    </div>
  )
} 
