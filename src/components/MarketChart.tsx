'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'
import { MarketTrends } from '@/types'

interface MarketChartProps {
  marketTrends: MarketTrends
}

export default function MarketChart({ marketTrends }: MarketChartProps) {
  // Check if we have real market data - handle null values gracefully
  const hasValidAveragePrice = marketTrends.averagePrice > 0
  const hasValidPricePerM2 = marketTrends.averagePricePerM2 > 0
  const hasHistoricalData = marketTrends.historicalData && marketTrends.historicalData.length > 1
  
  // Progressive fallback: if we have historical data, we can calculate price per m²
  let effectivePricePerM2 = marketTrends.averagePricePerM2
  if (!hasValidPricePerM2 && hasHistoricalData && hasValidAveragePrice) {
    // Use the most recent historical price as fallback
    const sortedHistory = marketTrends.historicalData.sort((a, b) => parseInt(b.year) - parseInt(a.year))
    effectivePricePerM2 = sortedHistory[0]?.price || 0
  }
  
  // Check if we have enough data to show market information
  const hasMarketData = hasValidAveragePrice && (hasValidPricePerM2 || effectivePricePerM2 > 0)
  
  if (!hasMarketData) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center">
        <div className="w-12 h-12 bg-yellow-200 rounded-lg mx-auto mb-4 flex items-center justify-center">
          <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-yellow-800 mb-2">Market Data Not Available</h3>
        <p className="text-yellow-700">
          Real-time market trends and pricing data could not be retrieved.
          Charts and market analysis require live market data to be accurate.
        </p>
        {marketTrends.seasonalTrends && (
          <p className="text-sm text-yellow-600 mt-3 italic">
            {marketTrends.seasonalTrends}
          </p>
        )}
        {/* Progressive deepening indicator */}
        {hasHistoricalData && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-sm font-medium">Progressive Deepening Active</span>
            </div>
            <p className="text-xs text-blue-600 mt-1 text-center">
              Historical data from {marketTrends.historicalData!.length} years available. 
              Market data will improve with subsequent analyses.
            </p>
          </div>
        )}
      </div>
    )
  }

  // Use effective price per m² (either real or calculated from historical data)
  const displayPricePerM2 = effectivePricePerM2 || marketTrends.averagePricePerM2
  
  // Use real historical data if available, otherwise create minimal fallback
  const historicalData = hasHistoricalData
    ? marketTrends.historicalData.map(data => ({
        year: data.year,
        price: data.price,
        confidence: data.confidence
      }))
    : [
        // Minimal fallback - only current year if no historical data
        { year: new Date().getFullYear().toString(), price: displayPricePerM2, confidence: 'medium' }
      ]

  const marketStats = [
    { name: 'Average Price', value: marketTrends.averagePrice, color: '#00ae9a' },
    { name: 'Median Price', value: marketTrends.medianPrice, color: '#00c5ad' },
  ]

  const inventoryData = [
            { name: 'active listings', value: marketTrends.inventory, color: '#3B82F6' },
            { name: 'days on market', value: marketTrends.daysOnMarket, color: '#EF4444' },
  ]

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value)
  }

  return (
    <div className="space-y-6">
      {/* Progressive Deepening Indicator */}
      {hasHistoricalData && marketTrends.dataQuality && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-900">Progressive Market Intelligence</h4>
                <p className="text-xs text-blue-700">
                  {marketTrends.historicalData!.length} years of historical data • {marketTrends.dataQuality} quality
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-blue-600">
                {marketTrends.dataSource === 'hybrid' ? '🔄 Web + Feed' :
                 marketTrends.dataSource === 'web_research' ? '🌐 Web Research' :
                 '🏠 MLS Feed'}
              </div>
              <div className="text-xs text-blue-500">
                Last updated: {new Date(marketTrends.lastUpdated).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Price Trends Chart - Only show if we have enough historical data */}
      {hasHistoricalData && (
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Price Trends</h3>
            {marketTrends.dataSource && (
              <div className="flex items-center space-x-2 text-xs">
                <span className={`px-2 py-1 rounded-full ${
                  marketTrends.dataQuality === 'high' ? 'bg-green-100 text-green-700' :
                  marketTrends.dataQuality === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {marketTrends.dataQuality} quality
                </span>
                <span className="text-gray-500">
                  {marketTrends.dataSource === 'hybrid' ? '🔄 Web + Feed' :
                   marketTrends.dataSource === 'web_research' ? '🌐 Web Research' :
                   '🏠 MLS Feed'}
                </span>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Real historical data from {marketTrends.historicalData!.length} years of market research
          </p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis tickFormatter={(value) => `€${value}`} />
              <Tooltip 
                formatter={(value, name, props) => {
                  const confidence = props.payload?.confidence
                  return [
                    formatPrice(Number(value)), 
                    confidence ? `Price per m² (${confidence} confidence)` : 'Price per m²'
                  ]
                }}
                labelFormatter={(label) => `Year ${label}`}
              />
              <Line 
                type="monotone" 
                dataKey="price" 
                stroke="#00ae9a" 
                strokeWidth={3}
                dot={(props) => {
                  const confidence = props.payload?.confidence
                  const dotColor = confidence === 'high' ? '#00ae9a' : 
                                  confidence === 'medium' ? '#fbbf24' : '#9ca3af'
                  return <circle 
                    key={`dot-${props.payload?.index || props.cx}-${props.cy}`}
                    cx={props.cx} 
                    cy={props.cy} 
                    r={confidence === 'high' ? 5 : 4} 
                    fill={dotColor} 
                    stroke="#ffffff" 
                    strokeWidth={2}
                  />
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Price Comparison</h3>
          <p className="text-sm text-gray-600 mb-4">Average vs median property prices in the local market area</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={marketStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => {
                if (value >= 1000000) {
                  return `€${(value / 1000000).toFixed(1)}M`
                } else if (value >= 1000) {
                  return `€${(value / 1000).toFixed(0)}k`
                }
                return `€${value}`
              }} />
              <Tooltip formatter={(value) => [formatPrice(Number(value)), 'Price']} />
              <Bar dataKey="value" fill="#00ae9a" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Activity</h3>
          <p className="text-sm text-gray-600 mb-4">Current inventory levels and average time properties stay on the market</p>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={inventoryData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Price Change Indicators */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Price Changes</h3>
        <p className="text-sm text-gray-600 mb-4">Recent price appreciation rates showing short and medium-term market momentum</p>
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

      {/* Market Trend Indicator */}
      <div className="bg-white p-6 rounded-xl shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Market Trend</h3>
        <p className="text-sm text-gray-600 mb-4">Overall market direction based on pricing patterns and analyzed property data</p>
        <div className="flex items-center space-x-4">
          <div className={`w-4 h-4 rounded-full ${
            marketTrends.marketTrend === 'up' ? 'bg-[#00ae9a]' : 
            marketTrends.marketTrend === 'down' ? 'bg-red-500' : 
            'bg-gray-400'
          }`}></div>
          <span className="text-lg font-medium text-gray-900 capitalize">
            {marketTrends.marketTrend} Market
          </span>
          <span className="text-sm text-gray-600">
            {marketTrends.marketTrend === 'up' ? 'Prices are rising' :
             marketTrends.marketTrend === 'down' ? 'Prices are declining' :
             'Prices are stable'}
          </span>
        </div>
      </div>
    </div>
  )
} 