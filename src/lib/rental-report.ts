import { PropertyData } from '../types'
import { normalizeProvinceName } from './utils'

export interface RentalReport {
  type: 'long-term' | 'short-term',
  executiveSummary: string,
  rentalYield: string,
  incomeAnalysis: string,
  occupancyAnalysis: string,
  tenantAppeal: string,
  marketAnalysis: string,
  financialBreakdown: string,
  locationOverview: string,
  legalNotes: string,
  riskAssessment: string,
  investmentRecommendation: string,
  comparableRentals: string,
  saleValuation?: string
}

function calculateLongTermYield(property: PropertyData): { gross: number, net: number, details: string } {
  const annualRent = (property.monthlyPrice || 0) * 12
  // Commission defaults to 1 month's rent unless specified otherwise
  const commission = property.rentalCommission || (property.monthlyPrice || 0)
  const costs = (property.propertyTax || 0) + (property.communityFees || 0) * 12 + (property.garbageTax || 0) + commission
  const gross = property.price ? (annualRent / property.price) * 100 : 0
  const net = property.price ? ((annualRent - costs) / property.price) * 100 : 0
  return {
    gross,
    net,
    details: `Gross yield: ${(gross).toFixed(2)}%. Net yield (after costs): ${(net).toFixed(2)}%. Annual rent: €${annualRent.toLocaleString()}. Annual costs: €${costs.toLocaleString()}.`
  }
}

function calculateShortTermYield(property: PropertyData, occupancyRate = 0.65): { gross: number, net: number, details: string } {
  const weeks = 52
  const weeklyRate = property.weeklyPriceFrom || 0
  const annualRent = weeklyRate * weeks * occupancyRate
  const cleaningFee = (property as any).cleaningFee || 0
  // Commission defaults to 1 month's rent unless specified otherwise
  const commission = property.rentalCommission || (property.monthlyPrice || 0)
  const costs = (property.propertyTax || 0) + (property.communityFees || 0) * 12 + (property.garbageTax || 0) + commission + cleaningFee * weeks * occupancyRate
  const gross = property.price ? (annualRent / property.price) * 100 : 0
  const net = property.price ? ((annualRent - costs) / property.price) * 100 : 0
  return {
    gross,
    net,
    details: `Gross yield: ${(gross).toFixed(2)}%. Net yield (after costs): ${(net).toFixed(2)}%. Annual rent (est.): €${annualRent.toLocaleString()} (occupancy: ${(occupancyRate*100).toFixed(0)}%). Annual costs: €${costs.toLocaleString()}.`
  }
}

export function generateRentalReport(
  property: PropertyData, 
  context: string = '',
  marketData?: any,
  amenities?: any[],
  comparables?: any[],
  developments?: any[],
  insights?: string,
  valuation?: any,
  mobilityData?: any
): RentalReport {
  const isShortTerm = property.isShortTerm || false
  const isLongTerm = property.isLongTerm || false
  let type: 'long-term' | 'short-term' = 'long-term'
  if (isShortTerm && !isLongTerm) type = 'short-term'
  if (isShortTerm && isLongTerm) type = 'long-term' // default to long-term if both

  // Enhanced analysis with additional data
  const amenitiesCount = amenities?.length || 0
  const comparablesCount = comparables?.length || 0
  const developmentsCount = developments?.length || 0
  const walkingScore = mobilityData?.walkingScore || 0

  // Long-term rental logic
  if (type === 'long-term') {
    const yieldData = calculateLongTermYield(property)
    const addressParts = property.address.split(',').map(part => part.trim())
    const primaryLocation = addressParts[0] || property.city
    
    return {
      type,
      executiveSummary: `Long-term rental analysis for ${primaryLocation}: This ${property.propertyType.toLowerCase()} offers a monthly rent of €${property.monthlyPrice?.toLocaleString() || 'N/A'}, with a gross yield of ${yieldData.gross.toFixed(2)}% and net yield of ${yieldData.net.toFixed(2)}%. ${comparablesCount > 0 ? `The property is well-positioned in the ${primaryLocation} rental market with ${amenitiesCount} nearby amenities and strong tenant demand.` : `The property offers ${amenitiesCount} nearby amenities, though market positioning analysis is limited due to lack of comparable properties in the area.`}`,
      rentalYield: yieldData.details,
      incomeAnalysis: `Expected annual rental income: €${((property.monthlyPrice || 0) * 12).toLocaleString()}. Long-term rentals in ${primaryLocation} typically achieve 90-100% occupancy rates, providing stable, predictable income for investors.`,
      occupancyAnalysis: `Long-term rentals in ${primaryLocation} typically have high occupancy rates (90-100%), providing stable income. The area shows strong demand from professionals and families seeking quality accommodation.`,
      tenantAppeal: `Key features for tenants: ${property.features?.join(', ') || 'N/A'}. The ${primaryLocation} area offers excellent lifestyle amenities including ${amenitiesCount} nearby facilities. Walking score: ${walkingScore}/100.`,
      marketAnalysis: comparablesCount > 0 
        ? `Compared to ${comparablesCount} similar long-term rentals in ${primaryLocation}, this property is competitively priced and well-located. The rental market in ${property.city} shows ${marketData?.marketTrend || 'stable'} trends.`
        : `No comparable long-term rentals found in ${primaryLocation} for direct market comparison. This limits our ability to assess competitive pricing. The rental market in ${property.city} shows ${marketData?.marketTrend || 'stable'} trends, but local market data is limited.`,
      financialBreakdown: `Deposit: €${property.rentalDeposit?.toLocaleString() || 'N/A'}, Commission: €${(property.rentalCommission || property.monthlyPrice || 0).toLocaleString()}, Community Fees: €${property.communityFees?.toLocaleString() || 'N/A'}/month, Property Tax: €${property.propertyTax?.toLocaleString() || 'N/A'}/year. Total annual costs: €${((property.propertyTax || 0) + (property.communityFees || 0) * 12 + (property.garbageTax || 0) + (property.rentalCommission || property.monthlyPrice || 0)).toLocaleString()}.`,
      locationOverview: `${primaryLocation}, ${property.city}, ${normalizeProvinceName(property.province)} is attractive for long-term tenants due to its ${amenitiesCount} amenities, transport links, and established residential character. ${developmentsCount > 0 ? `${developmentsCount} future developments planned for the area.` : ''}`,
      legalNotes: 'Standard long-term rental contracts apply. Ensure compliance with local rental laws and tenant protections. Deposit typically 2 months rent, minimum contract 1 year.',
      riskAssessment: `Risks: Vacancy (mitigated by strong demand in ${primaryLocation}), tenant default (mitigated by screening), maintenance costs. Overall risk level: Low to Moderate.`,
      investmentRecommendation: `Recommended for investors seeking stable, long-term income with low management overhead. The ${primaryLocation} area offers strong rental demand and capital appreciation potential.`,
      comparableRentals: comparablesCount > 0 
        ? `Analysis of ${comparablesCount} comparable long-term rentals in ${primaryLocation} shows competitive positioning. Average monthly rent in the area: €${Math.round(comparables!.reduce((sum, c) => sum + (c.price || 0), 0) / comparables!.length).toLocaleString()}.`
        : `No comparable long-term rentals found in ${primaryLocation}. This limits our market analysis and competitive positioning assessment. Consider expanding the search area or using broader market data for comparison.`,
      saleValuation: valuation?.valuationRange?.marketValue ? `Estimated sale value: €${valuation.valuationRange.marketValue.toLocaleString()}` : undefined
    }
  }

  // Short-term rental logic
  const yieldData = calculateShortTermYield(property)
  const addressParts = property.address.split(',').map(part => part.trim())
  const primaryLocation = addressParts[0] || property.city
  
  return {
    type,
    executiveSummary: `Short-term rental analysis for ${primaryLocation}: This ${property.propertyType.toLowerCase()} can achieve an estimated weekly rate of €${property.weeklyPriceFrom?.toLocaleString() || 'N/A'}, with a gross yield of ${yieldData.gross.toFixed(2)}% and net yield of ${yieldData.net.toFixed(2)}% (at 65% occupancy). ${comparablesCount > 0 ? `The property is ideally positioned for tourist demand in ${primaryLocation}.` : `Tourist demand analysis is limited due to lack of comparable short-term rentals in the area.`}`,
    rentalYield: yieldData.details,
    incomeAnalysis: `Potential annual rental income: €${((property.weeklyPriceFrom || 0) * 52 * 0.65).toLocaleString()} (assuming 65% occupancy). Peak season occupancy can reach 90% while low season averages 40%.`,
    occupancyAnalysis: `Short-term rentals in ${primaryLocation} are highly seasonal. Occupancy rates vary from 40% (low season) to 90% (peak season). Tourist demand is strong year-round with peak periods during summer and holidays.`,
    tenantAppeal: `Key features for guests: ${property.features?.join(', ') || 'N/A'}. The ${primaryLocation} area offers ${amenitiesCount} tourist attractions and amenities. Walking score: ${walkingScore}/100.`,
    marketAnalysis: comparablesCount > 0 
      ? `Compared to ${comparablesCount} similar short-term rentals in ${primaryLocation}, this property is well-positioned for tourist demand. The short-term rental market in ${property.city} shows strong growth potential.`
      : `No comparable short-term rentals found in ${primaryLocation} for direct market comparison. This limits our ability to assess competitive positioning. The short-term rental market in ${property.city} shows strong growth potential, but local market data is limited.`,
    financialBreakdown: `Deposit: €${property.rentalDeposit?.toLocaleString() || 'N/A'}, Commission: €${(property.rentalCommission || property.monthlyPrice || 0).toLocaleString()}, Cleaning: €${((property as any).cleaningFee || 0).toLocaleString() || 'N/A'}/stay, Community Fees: €${property.communityFees?.toLocaleString() || 'N/A'}/month, Property Tax: €${property.propertyTax?.toLocaleString() || 'N/A'}/year.`,
    locationOverview: `${primaryLocation}, ${property.city}, ${normalizeProvinceName(property.province)} is attractive for short-term guests due to its proximity to ${amenitiesCount} attractions and amenities. ${developmentsCount > 0 ? `${developmentsCount} future developments planned for the area.` : ''}`,
    legalNotes: 'Short-term rentals may require a tourist license and must comply with local regulations. Check for restrictions and tax obligations. Consider professional management services.',
    riskAssessment: `Risks: Seasonality (mitigated by strong tourist demand in ${primaryLocation}), regulatory changes, guest damage, higher management costs. Overall risk level: Moderate to High.`,
    investmentRecommendation: `Recommended for investors seeking higher returns and willing to manage seasonal fluctuations. The ${primaryLocation} area offers strong tourist demand and premium rental rates.`,
    comparableRentals: comparablesCount > 0 
      ? `Analysis of ${comparablesCount} comparable short-term rentals in ${primaryLocation} shows competitive positioning. Average weekly rate in the area: €${Math.round(comparables!.reduce((sum, c) => sum + (c.price || 0), 0) / comparables!.length).toLocaleString()}.`
      : `No comparable short-term rentals found in ${primaryLocation}. This limits our market analysis and competitive positioning assessment. Consider expanding the search area or using broader market data for comparison.`,
    saleValuation: valuation?.valuationRange?.marketValue ? `Estimated sale value: €${valuation.valuationRange.marketValue.toLocaleString()}` : undefined
  }
} 