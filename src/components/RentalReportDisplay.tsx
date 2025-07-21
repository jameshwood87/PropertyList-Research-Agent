"use client";

import React, { useState, useEffect } from 'react';
// import { motion } from 'framer-motion';
import dynamic from 'next/dynamic';
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
  Clock,
  Users,
  Bed,
  Bath,
  Zap,
  PawPrint,
  Waves,
  Video,
  Coins,
  Building2,
  Flag,
  Sun
} from 'lucide-react';
import { fixSpanishCharacters, normalizeProvinceName } from '@/lib/utils';
import FeedbackPanel from './FeedbackPanel';
import SimpleFeedbackButtons from './SimpleFeedbackButtons';
import { LazyPropertyImage, LazyGalleryImage } from './LazyImage';

// Dynamic imports for client-side only components
const GoogleMapView = dynamic(() => import('./GoogleMapView'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
});

const MarketChart = dynamic(() => import('./MarketChart'), {
  ssr: false,
  loading: () => <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
});

// Rental-specific market chart component
const RentalMarketChart: React.FC<{ marketTrends: any, propertyData: any }> = ({ marketTrends, propertyData }) => {
  const isShortTerm = propertyData.isShortTerm;
  const isLongTerm = propertyData.isLongTerm;
  
  // Check if we have real market data
  const hasMarketData = marketTrends.averagePrice > 0 && marketTrends.averagePricePerM2 > 0;
  
  if (!hasMarketData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <div className="w-12 h-12 bg-yellow-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-yellow-800 mb-2">Rental Market Data Not Available</h3>
        <p className="text-yellow-700">
          Real-time rental market trends and pricing data could not be retrieved.
          Charts and rental analysis require live market data to be accurate.
        </p>
        {marketTrends.seasonalTrends && (
          <p className="text-sm text-yellow-600 mt-3 italic">
            {marketTrends.seasonalTrends}
          </p>
        )}
      </div>
    );
  }

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Rental-specific data based on property type - prioritizing real data
  const getRentalStats = () => {
    if (isShortTerm) {
      // Use real weekly prices if available, otherwise calculate from market data
      const lowRate = propertyData.weeklyPriceFrom || 
                     (marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                      Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 52 * 0.7) : null);
      const highRate = propertyData.weeklyPriceTo || 
                      (marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                       Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 52 * 1.3) : null);
      
      return [
        { name: 'Weekly Rate (Low)', value: lowRate || marketTrends.averagePrice / 4, color: '#00ae9a', isReal: !!propertyData.weeklyPriceFrom },
        { name: 'Weekly Rate (High)', value: highRate || marketTrends.averagePrice / 3, color: '#00c5ad', isReal: !!propertyData.weeklyPriceTo },
      ];
    } else {
      // Use real monthly price if available, otherwise calculate from market data
      const monthlyRent = propertyData.monthlyPrice || 
                         (marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                          Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 12) : null);
      const annualIncome = monthlyRent ? monthlyRent * 12 : null;
      
      return [
        { name: 'Monthly Rent', value: monthlyRent || marketTrends.averagePrice / 12, color: '#00ae9a', isReal: !!propertyData.monthlyPrice },
        { name: 'Annual Income', value: annualIncome || (marketTrends.averagePrice / 12) * 12, color: '#00c5ad', isReal: !!propertyData.monthlyPrice },
      ];
    }
  };

  const getRentalActivity = () => {
    // Use real market data for occupancy if available, otherwise use realistic estimates
    const marketOccupancy = marketTrends.occupancyRate;
    const marketDaysVacant = marketTrends.daysVacant;
    
    if (isShortTerm) {
      return [
        { name: 'Peak Occupancy', value: marketOccupancy || 85, color: '#3B82F6', isReal: !!marketOccupancy },
        { name: 'Low Season', value: marketOccupancy ? Math.round(marketOccupancy * 0.47) : 40, color: '#EF4444', isReal: !!marketOccupancy },
      ];
    } else {
      return [
        { name: 'Occupancy Rate', value: marketOccupancy || 95, color: '#3B82F6', isReal: !!marketOccupancy },
        { name: 'Days Vacant', value: marketDaysVacant || 18, color: '#EF4444', isReal: !!marketDaysVacant },
      ];
    }
  };

  const getRentalYield = () => {
    const propertyValue = marketTrends.averagePrice;
    if (!propertyValue) return null;
    
    if (isShortTerm) {
      const weeklyIncome = propertyData.weeklyPriceFrom || 
                          (marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                           Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 52) : null);
      if (!weeklyIncome) return null;
      
      const occupancyRate = marketTrends.occupancyRate || 0.65;
      const annualIncome = weeklyIncome * 52 * occupancyRate;
      return ((annualIncome / propertyValue) * 100).toFixed(1);
    } else {
      const monthlyIncome = propertyData.monthlyPrice || 
                           (marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                            Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 12) : null);
      if (!monthlyIncome) return null;
      
      const annualIncome = monthlyIncome * 12;
      return ((annualIncome / propertyValue) * 100).toFixed(1);
    }
  };

  const rentalStats = getRentalStats();
  const rentalActivity = getRentalActivity();
  const rentalYield = getRentalYield();

  return (
    <div className="space-y-6">
      {/* Data Source Summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center space-x-2 mb-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h4 className="font-semibold text-blue-900">Data Sources</h4>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center space-x-2 mb-1">
                              <span className="w-3 h-3 bg-[#00ae9a] rounded-full"></span>
              <span className="font-medium text-blue-800">Real Data Available:</span>
            </div>
            <ul className="text-blue-700 space-y-1 ml-5">
              {propertyData.weeklyPriceFrom && <li>• Weekly rental rates</li>}
              {propertyData.monthlyPrice && <li>• Monthly rental rates</li>}
              {marketTrends.averagePrice > 0 && <li>• Market property values</li>}
              {marketTrends.averagePricePerM2 > 0 && <li>• Price per square meter</li>}
              {marketTrends.priceChange6Month !== undefined && <li>• 6-month price changes</li>}
              {marketTrends.priceChange12Month !== undefined && <li>• 12-month price changes</li>}
              {marketTrends.occupancyRate && <li>• Occupancy rates</li>}
              {marketTrends.daysVacant && <li>• Vacancy periods</li>}
            </ul>
          </div>
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
              <span className="font-medium text-blue-800">Calculated/Estimated:</span>
            </div>
            <ul className="text-blue-700 space-y-1 ml-5">
              {!propertyData.weeklyPriceFrom && !propertyData.monthlyPrice && <li>• Rental rates (from market data)</li>}
              {!marketTrends.occupancyRate && <li>• Occupancy rates (industry averages)</li>}
              {!marketTrends.daysVacant && <li>• Vacancy periods (estimates)</li>}
              {!rentalYield && <li>• Yield calculations</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Rental Yield Overview */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rental Yield Analysis</h3>
        <p className="text-sm text-gray-600 mb-4">
          {isShortTerm 
            ? 'Short-term rental yield based on weekly rates and seasonal occupancy patterns'
            : 'Long-term rental yield based on monthly rates and stable occupancy'
          }
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gradient-to-r from-[#00ae9a]/10 to-[#00c5ad]/10 rounded-lg">
            <div className="text-2xl font-bold text-[#00ae9a]">
              {rentalYield ? `${rentalYield}%` : 'N/A'}
            </div>
            <div className="text-sm text-gray-600">Gross Yield</div>
            {rentalYield && (
              <div className="text-xs text-gray-500 mt-1">
                {propertyData.weeklyPriceFrom || propertyData.monthlyPrice ? 'Based on actual rates' : 'Based on market data'}
              </div>
            )}
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              {isShortTerm ? 
                (marketTrends.occupancyRate ? `${Math.round(marketTrends.occupancyRate)}%` : '65%') : 
                (marketTrends.occupancyRate ? `${Math.round(marketTrends.occupancyRate)}%` : '95%')
              }
            </div>
            <div className="text-sm text-gray-600">
              {isShortTerm ? 'Avg Occupancy' : 'Occupancy Rate'}
            </div>
            {marketTrends.occupancyRate && (
              <div className="text-xs text-gray-500 mt-1">Real market data</div>
            )}
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">
              {isShortTerm ? 
                (propertyData.weeklyPriceFrom ? 
                  `€${(propertyData.weeklyPriceFrom * 52 * (marketTrends.occupancyRate || 0.65)).toLocaleString()}` :
                  '€' + ((marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                         Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 52) : 1000) * 52 * 0.65).toLocaleString()
                ) : 
                (propertyData.monthlyPrice ? 
                  `€${(propertyData.monthlyPrice * 12).toLocaleString()}` :
                  '€' + ((marketTrends.averagePricePerM2 && propertyData.buildArea ? 
                         Math.round(marketTrends.averagePricePerM2 * propertyData.buildArea / 12) : 2000) * 12).toLocaleString()
                )
              }
            </div>
            <div className="text-sm text-gray-600">Annual Income</div>
            {(propertyData.weeklyPriceFrom || propertyData.monthlyPrice) && (
              <div className="text-xs text-gray-500 mt-1">Based on actual rates</div>
            )}
          </div>
        </div>
      </div>

      {/* Rental Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {isShortTerm ? 'Weekly Rate Comparison' : 'Monthly Rent Comparison'}
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            {isShortTerm 
              ? 'Low season vs high season weekly rental rates'
              : 'Monthly rent vs annual income potential'
            }
          </p>
          <div className="space-y-4">
            {rentalStats.map((stat, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-700">{stat.name}</span>
                  {stat.isReal && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Real</span>
                  )}
                </div>
                <span className="font-semibold text-gray-900">{formatPrice(stat.value)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Occupancy Analysis</h3>
          <p className="text-sm text-gray-600 mb-4">
            {isShortTerm 
              ? 'Seasonal occupancy patterns for short-term rentals'
              : 'Occupancy rates and vacancy periods for long-term rentals'
            }
          </p>
          <div className="space-y-4">
            {rentalActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-700">{activity.name}</span>
                  {activity.isReal && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Real</span>
                  )}
                </div>
                <span className="font-semibold text-gray-900">{activity.value}{activity.name.includes('Rate') || activity.name.includes('Occupancy') ? '%' : ' days'}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Rental Market Changes */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rental Market Changes</h3>
        <p className="text-sm text-gray-600 mb-4">
          Recent rental rate changes showing short and medium-term market momentum
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-700">6-Month Change</span>
            <span className={`font-semibold text-lg ${marketTrends.priceChange6Month > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {marketTrends.priceChange6Month > 0 ? '+' : ''}{marketTrends.priceChange6Month}%
            </span>
          </div>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <span className="text-gray-700">12-Month Change</span>
            <span className={`font-semibold text-lg ${marketTrends.priceChange12Month > 0 ? 'text-green-600' : 'text-red-600'}`}>
              {marketTrends.priceChange12Month > 0 ? '+' : ''}{marketTrends.priceChange12Month}%
            </span>
          </div>
        </div>
      </div>

      {/* Rental Market Trend */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Rental Market Trend</h3>
        <p className="text-sm text-gray-600 mb-4">
          Overall rental market direction based on pricing patterns and analyzed property data
        </p>
        <div className="flex items-center space-x-4">
          <div className={`w-4 h-4 rounded-full ${
            marketTrends.marketTrend === 'up' ? 'bg-[#00ae9a]' : 
            marketTrends.marketTrend === 'down' ? 'bg-red-500' : 'bg-yellow-500'
          }`}></div>
          <span className="font-semibold text-gray-900">
            {marketTrends.marketTrend === 'up' ? 'Up Trend' : 
             marketTrends.marketTrend === 'down' ? 'Down Trend' : 'Stable Trend'}
          </span>
          <span className="text-gray-500">
            ({marketTrends.inventory || 0} similar {isShortTerm ? 'short-term' : 'long-term'} rentals analyzed)
          </span>
        </div>
      </div>
    </div>
  );
};

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

interface RentalReportDisplayProps {
  report: any;
  sessionId: string;
}

// Canonical feature mapping for normalization
const CANONICAL_FEATURES: { [canonical: string]: string[] } = {
  'Private Pool': ['private pool', 'pool', 'swimming pool', 'private swimming pool'],
  'Sea Views': ['sea views', 'sea view', 'ocean view', 'sea vistas'],
  'Mountain Views': ['mountain views', 'mountain view', 'hill view'],
  'Garden': ['garden', 'yard', 'landscaped garden', 'private garden'],
  'Parking': ['parking', 'garage', 'carport', 'off-street parking'],
  'Air Conditioning': ['air conditioning', 'ac', 'air con', 'central air'],
  'Fitted Kitchen': ['fitted kitchen', 'kitchen', 'modern kitchen'],
  'Fireplace': ['fireplace', 'chimney', 'wood burning stove'],
  'Storage Room': ['storage room', 'storage', 'utility room'],
  'Terrace': ['terrace', 'balcony', 'patio', 'deck'],
  'Security System': ['security system', 'security', 'alarm', 'cctv'],
  'BBQ Area': ['bbq area', 'bbq', 'barbecue', 'barbecue area']
};

// Helper to normalize a feature string to its canonical form
function normalizeFeature(feature: string): string {
  const lower = feature.toLowerCase().trim();
  for (const [canonical, variants] of Object.entries(CANONICAL_FEATURES)) {
    if (variants.includes(lower)) return canonical;
  }
  // If not found, return the original (capitalized)
  return feature.charAt(0).toUpperCase() + feature.slice(1);
}

const RentalReportDisplay: React.FC<RentalReportDisplayProps> = ({ report, sessionId }) => {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [brokenImages, setBrokenImages] = useState<Set<number>>(new Set());
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
  });
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);

  // Safety check for missing propertyData
  if (!report || !report.propertyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 text-center">
          <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Loading Rental Report...</h2>
          <p className="text-gray-600">Your comprehensive rental analysis is being prepared. This will only take a moment.</p>
        </div>
      </div>
    );
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return new Date().toLocaleDateString('en-GB');
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Image gallery functions
  const getAllImages = () => {
    const images = [];
    if (report.propertyData?.images && report.propertyData.images.length > 0) {
      images.push(...report.propertyData.images);
    } else if (report.propertyData?.image) {
      images.push(report.propertyData.image);
    }
    return images;
  };

  const currentImages = getAllImages();
  const hasMultipleImages = currentImages.length > 1;

  const openGallery = (index: number = 0) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
    setBrokenImages(new Set());
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % currentImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + currentImages.length) % currentImages.length);
  };

  const handleImageError = (imageIndex: number) => {
    setBrokenImages(prev => new Set(prev).add(imageIndex));
  };

  // Keyboard navigation for gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGalleryOpen) return;
      
      switch (e.key) {
        case 'Escape':
          closeGallery();
          break;
        case 'ArrowRight':
          nextImage();
          break;
        case 'ArrowLeft':
          prevImage();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen]);

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

  const handleExportPDF = async () => {
    try {
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: report.sessionId,
          reportType: 'rental'
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rental-analysis-${report.propertyData.city}-${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        console.error('Failed to generate PDF');
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  const getPropertyCoordinates = (): [number, number] => {
    if (report.coordinates && report.coordinates.lat && report.coordinates.lng) {
      return [report.coordinates.lat, report.coordinates.lng];
    }
    // Fallback coordinates for Benahavis
    return [36.5233, -5.0443];
  };

  const propertyCoordinates = getPropertyCoordinates();

  const toggleMapLayer = (layer: keyof typeof mapLayers) => {
    setMapLayers(prev => ({
      ...prev,
      [layer]: !prev[layer]
    }));
  };

  const formatDistance = (distanceInMiles: number) => {
    // Convert miles to kilometers and format to 2 decimal places
    const distanceInKm = distanceInMiles * 1.60934
    return `${distanceInKm.toFixed(2)}km`
  };

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
      case 'entertainment':
        return '🎢'
      case 'zoo':
        return '🦁'
      case 'waterpark':
        return '🏊'
      case 'cinema':
        return '🎬'
      case 'casino':
        return '🎰'
      case 'museum':
        return '🏛️'
      case 'golf':
        return '⛳'
      case 'beach':
        return '🏖️'
      default:
        return '📍'
    }
  };

  const getAmenityTypeCounts = () => {
    if (!report.nearbyAmenities) return [];
    const amenities = report.nearbyAmenities;
    const amenityTypes = amenities.reduce((acc, amenity) => {
      acc[amenity.type] = (acc[amenity.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return Object.entries(amenityTypes).map(([type, count]) => ({
      type,
      count
    }));
  };

  // Get rental type description
  const getRentalType = () => {
    if (report.propertyData.isShortTerm && report.propertyData.isLongTerm) {
      return 'Short-term & Long-term Rental';
    } else if (report.propertyData.isShortTerm) {
      return 'Short-term Rental';
    } else if (report.propertyData.isLongTerm) {
      return 'Long-term Rental';
    }
    return 'Rental Property';
  };

  // Get rental price display
  const getRentalPriceDisplay = () => {
    if (report.propertyData.monthlyPrice) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Euro className="w-5 h-5 text-primary" />
            <span className="text-sm text-gray-600">Monthly Rent</span>
          </div>
          <p className="font-semibold text-gray-900">{formatPrice(report.propertyData.monthlyPrice)}</p>
          {report.propertyData.buildArea && report.propertyData.buildArea > 0 && (
            <p className="text-sm text-gray-600 mt-1">
              {formatPrice(Math.round(report.propertyData.monthlyPrice / report.propertyData.buildArea))}/m²/month
            </p>
          )}
        </div>
      );
    } else if (report.propertyData.weeklyPriceFrom) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2">
            <Euro className="w-5 h-5 text-primary" />
            <span className="text-sm text-gray-600">Weekly Rent</span>
          </div>
          <p className="font-semibold text-gray-900">
            {formatPrice(report.propertyData.weeklyPriceFrom)}
            {report.propertyData.weeklyPriceTo && report.propertyData.weeklyPriceTo !== report.propertyData.weeklyPriceFrom && 
              ` - ${formatPrice(report.propertyData.weeklyPriceTo)}`
            }
          </p>
          {report.propertyData.sleeps && (
            <p className="text-sm text-gray-600 mt-1">
              Sleeps {report.propertyData.sleeps} people
            </p>
          )}
        </div>
      );
    }
    return null;
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header with Export Button */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-sm border-b border-gray-200/50 px-6 py-4" id="report-header">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Rental Property Analysis Report</h1>
            <p className="text-sm text-gray-600">Generated on {formatDate(report.reportDate)}</p>
          </div>
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-2 bg-[#00ae9a] hover:bg-[#00c5ad] text-white px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            <span>Download Full Rental Report</span>
          </button>
        </div>
      </div>

      {/* Fixed Download Button - Only visible when header is scrolled out of view */}
      {!isHeaderVisible && (
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={handleExportPDF}
            className="flex items-center space-x-2 bg-[#00ae9a] hover:bg-[#00c5ad] text-white px-6 py-3 rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <Download className="w-5 h-5" />
            <span>Download Full Rental Report</span>
          </button>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-8">
        <motion.div
          className="space-y-8"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* 🔍 Property Summary */}
          <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Property Summary</h2>
            </div>
            
            {/* Responsive Layout: Mobile vertical, Desktop side-by-side with proper alignment */}
            <div className="lg:grid lg:grid-cols-2 lg:gap-6 space-y-6 lg:space-y-0">
              <div className="space-y-4">
                {/* Location - Always at top */}
                <div className="flex items-start space-x-3 ml-4">
                  <MapPin className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900">
                      {report.propertyData ? extractLocationName(fixSpanishCharacters(report.propertyData.address || ''), fixSpanishCharacters(report.propertyData.city || ''), fixSpanishCharacters(report.propertyData.urbanization || ''), fixSpanishCharacters(report.propertyData.suburb || '')) : 'Location not available'}
                    </h3>
                      {report.propertyData?.refNumber && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                          Ref: {report.propertyData.refNumber}
                        </span>
                      )}
                    </div>
                                          <p className="text-gray-600">
                        {report.propertyData ? `${report.propertyData.suburb && report.propertyData.suburb !== report.propertyData.urbanization ? fixSpanishCharacters(report.propertyData.suburb) + ', ' : ''}${fixSpanishCharacters(report.propertyData.city || '')}, ${normalizeProvinceName(fixSpanishCharacters(report.propertyData.province || ''))} ${report.propertyData.areaCode || ''}` : 'Address details not available'}
                      </p>
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
                    <p className="text-xs text-gray-600 mt-1">{getRentalType()}</p>
                  </div>
                  
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Home className="w-5 h-5 text-primary" />
                      <span className="text-sm text-gray-600">Property Sizes</span>
                    </div>
                    <div className="flex gap-3 mt-2 flex-wrap">
                      {report.propertyData.buildArea && (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Build</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.buildArea.toLocaleString()} m²</div>
                        </div>
                      )}
                      {report.propertyData.terraceAreaM2 && report.propertyData.terraceAreaM2 > 0 && (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Terrace</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.terraceAreaM2.toLocaleString()} m²</div>
                        </div>
                      )}
                      {report.propertyData.plotArea && (
                        <div className="text-center">
                          <div className="text-xs text-gray-600">Plot</div>
                          <div className="font-semibold text-gray-900 text-sm">{report.propertyData.plotArea.toLocaleString()} m²</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {getRentalPriceDisplay()}
                  
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

                  {/* Rental-specific fields */}
                  {report.propertyData.sleeps && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Sleeps</span>
                      </div>
                      <p className="font-semibold text-gray-900">{report.propertyData.sleeps} people</p>
                    </div>
                  )}

                  {report.propertyData.furnished !== undefined && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Building className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Furnished</span>
                      </div>
                      <p className="font-semibold text-gray-900">{report.propertyData.furnished ? 'Yes' : 'No'}</p>
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
                    <p className="text-xs text-gray-600 mt-1">{getRentalType()}</p>
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
                      {report.propertyData.plotArea && (
                        <div className="text-center">
                          <div className="text-sm text-gray-600">Plot</div>
                          <div className="font-semibold text-gray-900">{report.propertyData.plotArea.toLocaleString()} m²</div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {getRentalPriceDisplay()}
                  
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

                  {/* Rental-specific fields */}
                  {report.propertyData.sleeps && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Users className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Sleeps</span>
                      </div>
                      <p className="font-semibold text-gray-900">{report.propertyData.sleeps} people</p>
                    </div>
                  )}

                  {report.propertyData.furnished !== undefined && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <Building className="w-5 h-5 text-primary" />
                        <span className="text-sm text-gray-600">Furnished</span>
                      </div>
                      <p className="font-semibold text-gray-900">{report.propertyData.furnished ? 'Yes' : 'No'}</p>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Image Gallery - Mobile: full width, Desktop: aligned with grey boxes */}
              <div className="lg:h-80 space-y-4 lg:space-y-0 lg:flex lg:gap-4 lg:pt-16">
                {/* Image - Mobile: full width, Desktop: left half */}
                <div className="h-64 lg:w-1/2 lg:h-full relative">
                  {currentImages.length > 0 ? (
                    <div 
                      className="w-full h-full cursor-pointer group rounded-lg overflow-hidden relative"
                      onClick={() => openGallery(0)}
                    >
                      <LazyPropertyImage
                        src={currentImages[0]?.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
                          ? `/api/proxy-image?url=${encodeURIComponent(currentImages[0])}`
                          : currentImages[0]
                        } 
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
                    center={getPropertyCoordinates()}
                    amenities={report.nearbyAmenities || []}
                    layers={mapLayers}
                  />
                </div>
              </div>
            </div>
            
            {/* Property Features - Within Property Summary */}
            {report.propertyData.features && report.propertyData.features.length > 0 && (
              <div className="mt-6 p-6 bg-gray-50 rounded-lg">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Property Features</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {report.propertyData.features.slice(0, 10).map((feature: string, index: number) => (
                    <span
                      key={index}
                      className="text-xs bg-gray-50 text-gray-500 px-1 py-0.5 rounded border border-gray-200"
                    >
                      {normalizeFeature(feature)}
                    </span>
                  ))}
                  {report.propertyData.features.length > 10 && (
                    <span className="text-xs text-gray-400">+{report.propertyData.features.length - 10} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Property Analysis & Investment Highlights */}
            <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border-l-4 border-primary">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Property Analysis & Investment Highlights</h3>
                  
                  {/* AI Summary if available */}
                  {report.summary?.overview && (
                    <p className="text-gray-700 leading-relaxed mb-4">{report.summary.overview}</p>
                  )}
                  
                  {/* Location Highlights - Rental Type Specific */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">📍 Location Advantages</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {report.propertyData.isShortTerm ? (
                        <>
                          This {report.propertyData.propertyType.toLowerCase()} is ideally positioned in {fixSpanishCharacters(report.propertyData.city)}, {fixSpanishCharacters(report.propertyData.province)} for short-term rental success. 
                          The location offers prime access to tourist attractions, beaches, and entertainment venues that attract high-value vacation rentals. 
                          {fixSpanishCharacters(report.propertyData.city) === 'San Pedro de Alcántara' && 
                            ' Proximity to Marbella, Puerto Banús, and pristine beaches ensures strong demand from luxury holidaymakers seeking premium accommodations.'
                          }
                          {fixSpanishCharacters(report.propertyData.city) === 'Marbella' && 
                            ' The prestigious Marbella location commands premium rates from international tourists and business travelers seeking luxury short-term stays.'
                          }
                          {fixSpanishCharacters(report.propertyData.city) === 'Benahavís' && 
                            ' The exclusive Benahavís area attracts discerning tourists seeking privacy and luxury, with proximity to world-class golf courses and amenities.'
                          }
                        </>
                      ) : (
                        <>
                          This {report.propertyData.propertyType.toLowerCase()} is strategically located in {fixSpanishCharacters(report.propertyData.city)}, {fixSpanishCharacters(report.propertyData.province)} for long-term rental stability. 
                          The area offers excellent infrastructure, schools, and amenities that attract quality long-term tenants including professionals and families. 
                          {fixSpanishCharacters(report.propertyData.city) === 'San Pedro de Alcántara' && 
                            ' The location provides easy access to Marbella\'s business district while maintaining a family-friendly residential atmosphere.'
                          }
                          {fixSpanishCharacters(report.propertyData.city) === 'Marbella' && 
                            ' Marbella\'s established residential areas offer stable long-term rental demand from professionals and families seeking quality accommodation.'
                          }
                          {fixSpanishCharacters(report.propertyData.city) === 'Benahavís' && 
                            ' Benahavís provides a peaceful residential environment with excellent amenities, attracting long-term tenants seeking quality of life.'
                          }
                        </>
                      )}
                    </p>
                  </div>
                  
                  {/* Rental Investment Potential - Type Specific */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-800 mb-2">💰 Rental Investment Potential</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {report.summary?.investmentPotential || (
                        <>
                          {report.propertyData.isShortTerm ? (
                            <>
                              Short-term rental investment in {fixSpanishCharacters(report.propertyData.city)} offers high-yield potential with premium rates during peak seasons. 
                              {report.propertyData.propertyType === 'Penthouse' && 
                                `Premium penthouses in ${fixSpanishCharacters(report.propertyData.city)} command €${report.propertyData.weeklyPriceFrom?.toLocaleString() || 'N/A'}+ per week during high season, with 65-90% occupancy rates. `
                              }
                              {report.propertyData.propertyType === 'Villa' && 
                                `Luxury villas in ${fixSpanishCharacters(report.propertyData.city)} attract affluent international tourists, particularly from Northern Europe, with premium weekly rates and high seasonal demand. `
                              }
                              {report.propertyData.propertyType === 'Apartment' && 
                                `Well-positioned apartments in ${fixSpanishCharacters(report.propertyData.city)} offer excellent short-term rental potential with strong tourist demand year-round and competitive weekly rates. `
                              }
                              The {report.propertyData.bedrooms}-bedroom configuration is ideal for family vacations and group travel, maximizing rental income potential.
                            </>
                          ) : (
                            <>
                              Long-term rental investment in {fixSpanishCharacters(report.propertyData.city)} provides stable, predictable income with lower management overhead. 
                              {report.propertyData.propertyType === 'Penthouse' && 
                                `Premium penthouses in ${fixSpanishCharacters(report.propertyData.city)} attract high-quality long-term tenants willing to pay premium monthly rates for luxury accommodations. `
                              }
                              {report.propertyData.propertyType === 'Villa' && 
                                `Luxury villas in ${fixSpanishCharacters(report.propertyData.city)} appeal to affluent long-term tenants, including executives and families seeking premium residential options. `
                              }
                              {report.propertyData.propertyType === 'Apartment' && 
                                `Well-positioned apartments in ${fixSpanishCharacters(report.propertyData.city)} offer consistent long-term rental demand from professionals and families seeking quality residential options. `
                              }
                              The {report.propertyData.bedrooms}-bedroom property provides stable monthly income of €{report.propertyData.monthlyPrice?.toLocaleString() || 'N/A'} with 90-100% occupancy rates.
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  
                  {/* Rental Market Outlook - Type Specific */}
                  <div>
                    <h4 className="font-semibold text-gray-800 mb-2">🚀 Rental Market Outlook</h4>
                    <p className="text-gray-700 leading-relaxed">
                      {report.summary?.marketPosition || (
                        <>
                          {report.propertyData.isShortTerm ? (
                            <>
                              The {fixSpanishCharacters(report.propertyData.city)} short-term rental market shows strong growth potential with increasing tourist demand. 
                              Peak season occupancy rates reach 85-95% with premium pricing, while shoulder seasons maintain 60-75% occupancy. 
                              {report.futureDevelopment && report.futureDevelopment.length > 0 ? (
                                ` Upcoming ${report.futureDevelopment.length} development projects will enhance tourist infrastructure and potentially increase rental demand.`
                              ) : (
                                ` The established tourist infrastructure in ${fixSpanishCharacters(report.propertyData.city)} ensures consistent demand from international visitors.`
                              )}
                              {report.nearbyAmenities && report.nearbyAmenities.length > 0 && (
                                ` With ${report.nearbyAmenities.length} nearby tourist amenities and attractions, this area continues to attract high-value short-term tenants.`
                              )}
                            </>
                          ) : (
                            <>
                              The {fixSpanishCharacters(report.propertyData.city)} long-term rental market offers stability with consistent demand from quality tenants. 
                              Long-term rentals typically achieve 90-100% occupancy with minimal vacancy periods and stable monthly income streams. 
                              {report.futureDevelopment && report.futureDevelopment.length > 0 ? (
                                ` Upcoming ${report.futureDevelopment.length} development projects will enhance local infrastructure and potentially increase long-term rental demand.`
                              ) : (
                                ` The mature residential character of ${fixSpanishCharacters(report.propertyData.city)} provides rental market stability with steady appreciation potential.`
                              )}
                              {report.nearbyAmenities && report.nearbyAmenities.length > 0 && (
                                ` With ${report.nearbyAmenities.length} nearby amenities including schools, shopping, and healthcare facilities, this area attracts quality long-term tenants.`
                              )}
                            </>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Feedback for Property Summary Section */}
              <div className="flex justify-end mt-4">
                <SimpleFeedbackButtons 
                  sectionId="property-summary"
                  sessionId={sessionId}
                  className="text-sm"
                />
              </div>
          </motion.div>

          {/* 📈 Rental Market Data & Trends */}
          {report.marketTrends && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Rental Market Data & Trends</h2>
              </div>
              
              <RentalMarketChart marketTrends={report.marketTrends} propertyData={report.propertyData} />
              
              {/* Feedback for Rental Market Data Section */}
              <div className="flex justify-end mt-4">
                <SimpleFeedbackButtons 
                  sectionId="rental-market-data"
                  sessionId={sessionId}
                  className="text-sm"
                />
              </div>
            </motion.div>
          )}

          {/* Rental Comparables Section */}
          {report.comparableProperties && report.comparableProperties.length > 0 && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center">
                  <Building className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Rental Comparables</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {report.comparableProperties.map((comp: any, idx: number) => (
                  <div key={idx} className="bg-gray-50 rounded-lg p-4 border border-gray-200 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-900">{comp.address || 'No address'}</div>
                      {comp.refNumber && (
                        <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                          {comp.refNumber}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 mb-3">{comp.propertyType || ''}</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rent:</span>
                        <span className="font-medium">{comp.price ? formatPrice(comp.price) : '-'}</span>
                      </div>
                      {comp.displayArea && comp.displayArea > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">
                            {comp.areaType === 'build' ? 'Build Area:' : 
                             comp.areaType === 'plot' ? 'Plot Area:' : 
                             comp.areaType === 'terrace' ? 'Terrace Area:' : 'Size:'}
                          </span>
                          <span className="font-medium">
                            {comp.displayArea} m²
                            {comp.areaType && comp.areaType !== 'build' && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({comp.areaType})
                              </span>
                            )}
                          </span>
                        </div>
                      )}
                      {comp.distance !== undefined && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Distance:</span>
                          <span className="font-medium">{comp.distance === 0 ? 'Same Area' : `${comp.distance.toFixed(2)} km`}</span>
                        </div>
                      )}
                    </div>
                    {comp.bedrooms !== undefined && (
                      <div className="mt-3 pt-3 border-t border-gray-200 text-xs text-gray-600">
                        {comp.bedrooms} bd / {comp.bathrooms} ba
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Feedback for Rental Comparables Section */}
              <div className="flex justify-end mt-4">
                <SimpleFeedbackButtons 
                  sectionId="rental-comparables"
                  sessionId={sessionId}
                  className="text-sm"
                />
              </div>
            </motion.div>
          )}

          {/* 🗺️ Map of Amenities */}
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-[#00ae9a] rounded-lg flex items-center justify-center">
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
                          ? 'bg-[#00ae9a] text-white border-[#00ae9a]' 
                          : 'bg-white text-gray-600 border-gray-200 hover:border-[#00ae9a]'
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
                    {report.summary?.locationOverview || (() => {
                      const address = fixSpanishCharacters(report.propertyData.address || '')
                      const city = fixSpanishCharacters(report.propertyData.city || '')
                      const province = fixSpanishCharacters(report.propertyData.province || '')
                      
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
                        {report.summary?.amenitiesAnalysis || (() => {
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
                        {getAmenityTypeCounts().map(({ type, count }) => (
                          <div key={type} className="bg-white/50 rounded-lg p-3 border border-[#00ae9a]/20">
                            <div className="flex items-center space-x-2">
                              <span className="text-lg">{getAmenityIcon(type)}</span>
                              <div>
                                <div className="font-medium text-gray-800 capitalize">{type}</div>
                                <div className="text-sm text-gray-600">{count as number} {(count as number) === 1 ? 'location' : 'locations'}</div>
                              </div>
                            </div>
                          </div>
                        ))}
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
              </div>
            </div>
          </motion.div>

          {/* Occupancy & Tenant Appeal Section */}
          {(report.summary?.occupancyAnalysis || report.summary?.tenantAppeal || report.summary?.lifestyleAssessment) && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-yellow-500 rounded-lg flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Occupancy & Tenant Appeal</h2>
              </div>
              <div className="space-y-4">
                {report.summary.occupancyAnalysis && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-yellow-800 mb-2">Occupancy Analysis</h3>
                    <div className="text-gray-800">{report.summary.occupancyAnalysis}</div>
                  </div>
                )}
                {report.summary.tenantAppeal && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-yellow-800 mb-2">Tenant/Guest Appeal</h3>
                    <div className="text-gray-800">{report.summary.tenantAppeal}</div>
                  </div>
                )}
                {report.summary.lifestyleAssessment && (
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h3 className="font-semibold text-yellow-800 mb-2">Lifestyle Assessment</h3>
                    <div className="text-gray-800">{report.summary.lifestyleAssessment}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Financial Breakdown & Legal Notes Section */}
          {(report.propertyData.rentalDeposit || report.propertyData.rentalCommission || report.propertyData.communityFees || report.propertyData.propertyTax || report.summary?.legalNotes) && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
                  <Euro className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Financial Breakdown & Legal Notes</h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <h3 className="font-semibold text-purple-800 mb-3">Rental Costs</h3>
                  <div className="space-y-2">
                    {report.propertyData.rentalDeposit && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Deposit:</span>
                        <span className="font-medium">{formatPrice(report.propertyData.rentalDeposit)}</span>
                      </div>
                    )}
                    {report.propertyData.rentalCommission && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Commission:</span>
                        <span className="font-medium">{formatPrice(report.propertyData.rentalCommission)}</span>
                      </div>
                    )}
                    {report.propertyData.communityFees && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Community Fees:</span>
                        <span className="font-medium">{formatPrice(report.propertyData.communityFees)}/month</span>
                      </div>
                    )}
                    {report.propertyData.propertyTax && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Property Tax:</span>
                        <span className="font-medium">{formatPrice(report.propertyData.propertyTax)}/year</span>
                      </div>
                    )}
                    {report.propertyData.garbageTax && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Garbage Tax:</span>
                        <span className="font-medium">{formatPrice(report.propertyData.garbageTax)}/year</span>
                      </div>
                    )}
                  </div>
                </div>
                {report.summary.legalNotes && (
                  <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                    <h3 className="font-semibold text-purple-800 mb-2">Legal Notes</h3>
                    <div className="text-gray-800 text-sm">{report.summary.legalNotes}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Executive Summary Section */}
          {report.summary && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-teal-500 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">Executive Summary</h2>
              </div>
              <div className="space-y-4">
                {report.summary.overview && (
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <h3 className="font-semibold text-teal-800 mb-2">Overview</h3>
                    <div className="text-gray-800">{report.summary.overview}</div>
                  </div>
                )}
                {report.summary.investmentPotential && (
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <h3 className="font-semibold text-teal-800 mb-2">Investment Potential</h3>
                    <div className="text-gray-800">{report.summary.investmentPotential}</div>
                  </div>
                )}
                {report.summary.riskAssessment && (
                  <div className="bg-teal-50 p-4 rounded-lg border border-teal-200">
                    <h3 className="font-semibold text-teal-800 mb-2">Risk Assessment</h3>
                    <div className="text-gray-800">{report.summary.riskAssessment}</div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Image Gallery Modal */}
      {isGalleryOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center">
          <div className="relative max-w-4xl max-h-full p-4">
            <button
              onClick={closeGallery}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <X className="w-8 h-8" />
            </button>
            
            {hasMultipleImages && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 text-white hover:text-gray-300 z-10"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </>
            )}
            
            <LazyGalleryImage
              src={currentImages[currentImageIndex]?.includes('propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com') 
                ? `/api/proxy-image?url=${encodeURIComponent(currentImages[currentImageIndex])}`
                : currentImages[currentImageIndex]
              }
              alt={`Property image ${currentImageIndex + 1}`}
              className="max-w-full max-h-full object-contain"
            />
            
            {hasMultipleImages && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-center">
                <p className="text-sm">
                  {currentImageIndex + 1} of {currentImages.length}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feedback Panel */}
      <FeedbackPanel 
        sessionId={sessionId}
        report={report}
      />
    </div>
  );
};

export default RentalReportDisplay; 
