import { PropertyData, Comparable } from '@/types'
import { getFeedManager } from './feed-manager'
import { PropertySearchCriteria } from './property-database'
import { locationLearningEngine } from '@/lib/learning/location-learning-engine'

export class FeedIntegration {
  
  // Enhanced comparable properties using feed database with transaction type prioritization
  public static async getComparableListings(propertyData: PropertyData): Promise<{ comparables: Comparable[], totalFound: number }> {
    try {
      const feedManager = getFeedManager()
      
      // Determine transaction type and priority for the property being analyzed
      const transactionType = this.determineTransactionType(propertyData)
      const isRental = transactionType !== 'sale'
      


      // Enhanced search criteria with better filtering for high-end areas
      // Handle undefined property types by inferring from description or using flexible matching
      let searchPropertyType = propertyData.propertyType
      if (!searchPropertyType || searchPropertyType === 'undefined') {
        // Try to infer property type from description
        if (propertyData.description) {
          const desc = propertyData.description.toLowerCase()
          if (desc.includes('apartment') || desc.includes('apartamento')) {
            searchPropertyType = 'Apartment'
          } else if (desc.includes('villa') || desc.includes('casa')) {
            searchPropertyType = 'Villa'
          } else if (desc.includes('penthouse') || desc.includes('ático')) {
            searchPropertyType = 'Penthouse'
          } else if (desc.includes('townhouse') || desc.includes('casa adosada')) {
            searchPropertyType = 'Townhouse'
          } else {
            // Default to flexible matching (no property type filter)
            searchPropertyType = undefined
          }
        } else {
          // No description available, use flexible matching
          searchPropertyType = undefined
        }
      }
      
      // For testing, be more flexible with property type matching
      console.log(`🔍 Search property type: ${searchPropertyType}`)
      console.log(`🔍 Original property type: ${propertyData.propertyType}`)
      
      // Normalize city and province names for better matching
      const normalizeCity = (city: string) => {
        return city.toLowerCase().replace(/[áéíóúñ]/g, (match) => {
          const map: { [key: string]: string } = {
            'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n'
          };
          return map[match] || match;
        });
      };
      
      const normalizeProvince = (province: string) => {
        // Keep province codes as they are - the database uses codes like 'MA', 'CA', etc.
        // Only normalize if it's a full name that needs to be converted to code
        const provinceNameToCode: { [key: string]: string } = {
          'Málaga': 'MA',
          'Cádiz': 'CA',
          'Granada': 'GR',
          'Alicante': 'A',
          'Tarragona': 'T',
          'Palma': 'PM',
          'Girona': 'GI',
          'Córdoba': 'CO',
          'Almería': 'AL',
          'Madrid': 'M',
          'Sevilla': 'SE',
          'Barcelona': 'B',
          'Jaén': 'J',
          'Castellón': 'CS'
        };
        return provinceNameToCode[province] || province;
      };
      
      // Extract location details for priority-based search
      const locationDetails = this.extractLocationDetails(propertyData.address)
      
      const baseCriteria: PropertySearchCriteria = {
        propertyType: searchPropertyType?.toLowerCase(), // Normalize property type
        city: normalizeCity(propertyData.city),
        // Remove province filter since Marbella is always in Málaga
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        minAreaM2: Math.max((propertyData.build || propertyData.buildArea || propertyData.totalAreaM2) * 0.7, 40), // More flexible area range
        maxAreaM2: (propertyData.build || propertyData.buildArea || propertyData.totalAreaM2) * 1.5, // More flexible area range
        maxDistance: 5, // 5km radius for better relevance
        // Add location-based filters for priority
        urbanisation: locationDetails.urbanization,
        neighbourhood: locationDetails.suburb,
        // Add transaction type filters
        isSale: transactionType === 'sale',
        isShortTerm: transactionType === 'short-term-rental',
        isLongTerm: transactionType === 'long-term-rental',
        // Exclude current property from comparable search (prevents self-comparison)
        excludeId: propertyData.id,
        // Limit results to 12 for better focus
        maxResults: 12
      }
      
      console.log(`🔍 Base search criteria:`, {
        propertyType: baseCriteria.propertyType,
        city: baseCriteria.city,
        // Province filter removed - Marbella is always in Málaga
        bedrooms: baseCriteria.bedrooms,
        bathrooms: baseCriteria.bathrooms,
        minAreaM2: baseCriteria.minAreaM2,
        maxAreaM2: baseCriteria.maxAreaM2,
        maxDistance: baseCriteria.maxDistance,
        isSale: baseCriteria.isSale
      })
      


      // Add price range filtering for better comparables
      if (propertyData.price) {
        const priceRange = this.calculatePriceRange(propertyData.price, propertyData.city)
        baseCriteria.minPrice = priceRange.minPrice
        baseCriteria.maxPrice = priceRange.maxPrice
        console.log(`💰 Price range for ${propertyData.city}: €${priceRange.minPrice.toLocaleString()} - €${priceRange.maxPrice.toLocaleString()}`)
      }

      // Add neighbourhood/urbanization filtering for high-end areas
      const neighbourhoodFilter = this.getNeighborhoodFilter(propertyData)
      if (neighbourhoodFilter) {
        baseCriteria.neighbourhood = neighbourhoodFilter
        console.log(`📍 Neighbourhood filter: ${neighbourhoodFilter}`)
      }

      // For high-end areas, be more flexible with property types and bedroom/bathroom matching
      const isHighEndArea = this.isHighEndArea(propertyData.city)
      if (isHighEndArea) {
        console.log(`🏆 High-end area detected: ${propertyData.city} - applying flexible criteria`)
        
        // For high-end areas, allow related property types
        const relatedPropertyTypes = this.getRelatedPropertyTypesForHighEnd(propertyData.propertyType)
        if (relatedPropertyTypes.length > 1) {
          console.log(`🏠 Allowing related property types: ${relatedPropertyTypes.join(', ')}`)
        }
        
        // Keep bedroom/bathroom matching for high-end properties but allow more flexibility
        // Don't remove the criteria - let the database handle flexible matching
        console.log(`🛏️ Keeping bedroom/bathroom matching for high-end area with flexible ranges`)
      }

      // Add optional filters if available
      if (propertyData.condition) {
        baseCriteria.condition = [propertyData.condition]
      }

      if (propertyData.features && propertyData.features.length > 0) {
        baseCriteria.features = propertyData.features.slice(0, 5)
      }

      // Get comparables based on transaction type prioritization
      let comparables: Comparable[] = []
      let totalFound = 0

      if (transactionType === 'sale') {
        // For sale properties: prioritize sale comparables, then short-term, then long-term
        const saleCriteria = {
          ...baseCriteria,
          address: propertyData.address // Pass the full address for location hierarchy
        }
        const saleResult = await this.getSalePropertyComparables(saleCriteria, feedManager, isHighEndArea)
        comparables = saleResult?.comparables || []
        totalFound = saleResult?.totalFound || comparables.length
        console.log(`🔍 Sale comparables found: ${comparables.length} out of ${totalFound} total`)
      } else if (transactionType === 'short-term-rental') {
        // For short-term rentals: only show short-term rental comparables
        const shortTermResult = await this.getShortTermRentalComparables(baseCriteria, feedManager)
        comparables = shortTermResult || []
        totalFound = comparables.length
        console.log(`🔍 Short-term rental comparables found: ${comparables.length} out of ${totalFound} total`)
      } else if (transactionType === 'long-term-rental') {
        // For long-term rentals: only show long-term rental comparables
        const longTermResult = await this.getLongTermRentalComparables(baseCriteria, feedManager)
        comparables = longTermResult || []
        totalFound = comparables.length
        console.log(`🔍 Long-term rental comparables found: ${comparables.length} out of ${totalFound} total`)
      }

      // Post-process comparables to ensure quality and relevance
      comparables = this.postProcessComparables(comparables, propertyData)
      
      console.log(`🔍 Final comparables found: ${comparables.length} out of ${totalFound} total`)
      
      // Learn from this analysis to improve future searches
      try {
        const comparableData = comparables.map(comp => {
          // Extract location components from address since Comparable doesn't have these fields
          const locationComponents = this.extractLocationComponents(comp.address)
          return {
            address: comp.address,
            urbanisation: locationComponents.urbanisation,
            suburb: locationComponents.suburb,
            city: locationComponents.city
          }
        })
        locationLearningEngine.learnFromAnalysis(propertyData, comparableData)
        console.log('🧠 Location Learning: Analysis data recorded for future improvements')
      } catch (error) {
        console.warn('⚠️ Location Learning failed:', error)
      }
      
      // Only try fallback if we have absolutely no comparables
      if (comparables.length === 0) {
        console.log(`⚠️ No comparables found - trying fallback search...`)
        // Try a very broad search as fallback
        const fallbackCriteria = {
          ...baseCriteria,
          propertyType: undefined, // Remove property type filter
          bedrooms: undefined, // Remove bedroom filter
          bathrooms: undefined, // Remove bathroom filter
          minAreaM2: undefined, // Remove area filter
          maxAreaM2: undefined,
          maxDistance: 20 // Very broad distance
          // Province filter already removed from baseCriteria
        }
        console.log(`🔍 Fallback search criteria:`, fallbackCriteria)
        const fallbackResult = feedManager.findComparableProperties(fallbackCriteria)
        console.log(`🔍 Fallback search found: ${fallbackResult.comparables.length} properties out of ${fallbackResult.totalFound} total`)
        
        // Only use fallback results if we found some
        if (fallbackResult.comparables.length > 0) {
          // Convert to proper Comparable type
          comparables = fallbackResult.comparables.map((comp: any) => ({
            ...comp,
            areaType: comp.areaType as 'plot' | 'build' | 'terrace'
          }))
          totalFound = fallbackResult.totalFound
        }
      }



      return { comparables, totalFound }
      
    } catch (error) {
      console.error('Error getting comparable listings from feed:', error)
      return { comparables: [], totalFound: 0 }
    }
  }

  // Determine the primary transaction type for a property
  private static determineTransactionType(propertyData: PropertyData): 'sale' | 'short-term-rental' | 'long-term-rental' {
    // Check for explicit rental flags first (support both naming conventions)
    const isShortTerm = propertyData.isShortTerm || propertyData.is_short_term
    const isLongTerm = propertyData.isLongTerm || propertyData.is_long_term
    
    // Check for explicit sale flag
    const isSale = propertyData.isSale || propertyData.is_sale
    
    if (isShortTerm && !isLongTerm) {
      return 'short-term-rental'
    }
    if (isLongTerm && !isShortTerm) {
      return 'long-term-rental'
    }
    if (isShortTerm && isLongTerm) {
      // If both flags are set, prioritize based on price indicators
      if (propertyData.weeklyPriceFrom || propertyData.weeklyPriceTo) {
        return 'short-term-rental'
      }
      if (propertyData.monthlyPrice) {
        return 'long-term-rental'
      }
      // Default to long-term if both flags but no price indicators
      return 'long-term-rental'
    }

    // Check for rental price indicators
    if (propertyData.monthlyPrice) {
      return 'long-term-rental'
    }
    if (propertyData.weeklyPriceFrom || propertyData.weeklyPriceTo) {
      return 'short-term-rental'
    }

    // Check description for rental keywords
    if (propertyData.description) {
      const shortTermKeywords = ['weekly', 'holiday', 'vacation', 'temporary', 'short-term', 'semanal']
      const longTermKeywords = ['monthly', 'long-term', 'alquiler', 'rental', 'mensual']
      
      const hasShortTermKeywords = shortTermKeywords.some(keyword => 
        propertyData.description!.toLowerCase().includes(keyword.toLowerCase())
      )
      const hasLongTermKeywords = longTermKeywords.some(keyword => 
        propertyData.description!.toLowerCase().includes(keyword.toLowerCase())
      )

      if (hasShortTermKeywords && !hasLongTermKeywords) {
        return 'short-term-rental'
      }
      if (hasLongTermKeywords && !hasShortTermKeywords) {
        return 'long-term-rental'
      }
    }

    // Default to sale if no clear rental indicators
    return 'sale'
  }

  // Get comparables for sale properties with proper location hierarchy
  private static async getSalePropertyComparables(
    baseCriteria: PropertySearchCriteria, 
    feedManager: any,
    isHighEndArea: boolean = false
  ): Promise<{ comparables: Comparable[], totalFound: number }> {
    let allComparables: Comparable[] = []
    let allUniqueIds = new Set<string>() // Track unique properties across all searches
    let totalFound = 0
    
    // Extract location components from the property address
    const propertyAddress = baseCriteria.address || ''
    const locationComponents = this.extractLocationComponents(propertyAddress)
    
    console.log(`🏆 Location hierarchy search for: ${propertyAddress}`)
    console.log(`📍 Location components:`, locationComponents)
    
    // STRICT TYPE-SPECIFIC LOCATION HIERARCHY SEARCH
    // Each tier only compares the same location type to avoid incorrect matches
    
    // Tier 1: Same Street (highest priority - 1km radius)
    if (locationComponents.street) {
      console.log(`🎯 Tier 1: Searching same street: ${locationComponents.street}`)
      const tier1Criteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: true,
        maxDistance: 1, // Very tight radius for same street
        excludeId: baseCriteria.excludeId
      }
      const tier1Result = feedManager.findComparableProperties(tier1Criteria)
      // STRICT FILTERING: Only include properties that have the SAME street name
      const tier1Comparables = (tier1Result?.comparables || []).filter(comp => {
        const compLocationComponents = this.extractLocationComponents(comp.address)
        return compLocationComponents.street?.toLowerCase() === locationComponents.street?.toLowerCase()
      })
      // Track unique properties found in this tier
      tier1Result?.comparables?.forEach(comp => {
        const id = comp.refNumber || comp.address
        if (!allUniqueIds.has(id)) {
          allUniqueIds.add(id)
          totalFound++
        }
      })
      console.log(`✅ Tier 1 found: ${tier1Comparables.length} properties on same street (total unique: ${totalFound})`)
      allComparables.push(...tier1Comparables)
    }
    
    // Tier 2: Same Urbanisation (only if target has urbanisation)
    if (locationComponents.urbanisation && allComparables.length < 6) {
      console.log(`🎯 Tier 2: Searching same urbanisation: ${locationComponents.urbanisation}`)
      const tier2Criteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: true,
        maxDistance: 2, // Tight radius for same urbanisation
        excludeId: baseCriteria.excludeId
      }
      const tier2Result = feedManager.findComparableProperties(tier2Criteria)
      // STRICT FILTERING: Only include properties that have the SAME urbanisation
      const tier2Comparables = (tier2Result?.comparables || []).filter(comp => {
        const compLocationComponents = this.extractLocationComponents(comp.address)
        return compLocationComponents.urbanisation?.toLowerCase() === locationComponents.urbanisation?.toLowerCase()
      })
      // Track unique properties found in this tier
      tier2Result?.comparables?.forEach(comp => {
        const id = comp.refNumber || comp.address
        if (!allUniqueIds.has(id)) {
          allUniqueIds.add(id)
          totalFound++
        }
      })
      console.log(`✅ Tier 2 found: ${tier2Comparables.length} properties in same urbanisation (total unique: ${totalFound})`)
      allComparables.push(...tier2Comparables)
    }
    
    // Tier 3: Same Suburb (only if target has suburb)
    if (locationComponents.suburb && allComparables.length < 10) {
      console.log(`🎯 Tier 3: Searching same suburb: ${locationComponents.suburb}`)
      const tier3Criteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: true,
        maxDistance: 2, // Tight radius for same suburb
        excludeId: baseCriteria.excludeId
      }
      const tier3Result = feedManager.findComparableProperties(tier3Criteria)
      // STRICT FILTERING: Only include properties that have the SAME suburb
      const tier3Comparables = (tier3Result?.comparables || []).filter(comp => {
        const compLocationComponents = this.extractLocationComponents(comp.address)
        return compLocationComponents.suburb?.toLowerCase() === locationComponents.suburb?.toLowerCase()
      })
      // Track unique properties found in this tier
      tier3Result?.comparables?.forEach(comp => {
        const id = comp.refNumber || comp.address
        if (!allUniqueIds.has(id)) {
          allUniqueIds.add(id)
          totalFound++
        }
      })
      console.log(`✅ Tier 3 found: ${tier3Comparables.length} properties in same suburb (total unique: ${totalFound})`)
      allComparables.push(...tier3Comparables)
    }
    
    // Tier 4: Nearby urbanisations (only if target has urbanisation)
    if (locationComponents.urbanisation && allComparables.length < 8) {
      console.log(`🎯 Tier 4: Searching nearby urbanisations`)
      const nearbyUrbanisations = this.getNearbyUrbanisations(locationComponents.urbanisation)
      console.log(`📍 Nearby urbanisations: ${nearbyUrbanisations.join(', ')}`)
      
      for (const nearbyUrban of nearbyUrbanisations) {
        if (allComparables.length >= 12) break
        
        const tier4Criteria: PropertySearchCriteria = {
          ...baseCriteria,
          isSale: true,
          maxDistance: 3, // Medium radius for nearby areas
          excludeId: baseCriteria.excludeId
        }
        const tier4Result = feedManager.findComparableProperties(tier4Criteria)
        // STRICT FILTERING: Only include properties that have the SPECIFIC nearby urbanisation
        const tier4Comparables = (tier4Result?.comparables || []).filter(comp => {
          const compLocationComponents = this.extractLocationComponents(comp.address)
          return compLocationComponents.urbanisation?.toLowerCase() === nearbyUrban.toLowerCase()
        })
        // Track unique properties found in this tier
        tier4Result?.comparables?.forEach(comp => {
          const id = comp.refNumber || comp.address
          if (!allUniqueIds.has(id)) {
            allUniqueIds.add(id)
            totalFound++
          }
        })
        console.log(`✅ Tier 4 found: ${tier4Comparables.length} properties in ${nearbyUrban} (total unique: ${totalFound})`)
        allComparables.push(...tier4Comparables)
      }
    }
    
    // Tier 5: Same city (only if target has city)
    if (locationComponents.city && allComparables.length < 6) {
      console.log(`🎯 Tier 5: Searching same city: ${locationComponents.city}`)
      const tier5Criteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: true,
        maxDistance: 5, // Tight radius for same city
        excludeId: baseCriteria.excludeId
      }
      const tier5Result = feedManager.findComparableProperties(tier5Criteria)
      // STRICT FILTERING: Only include properties that have the SAME city
      const tier5Comparables = (tier5Result?.comparables || []).filter(comp => {
        const compLocationComponents = this.extractLocationComponents(comp.address)
        return compLocationComponents.city?.toLowerCase() === locationComponents.city?.toLowerCase()
      })
      // Track unique properties found in this tier
      tier5Result?.comparables?.forEach(comp => {
        const id = comp.refNumber || comp.address
        if (!allUniqueIds.has(id)) {
          allUniqueIds.add(id)
          totalFound++
        }
      })
      console.log(`✅ Tier 5 found: ${tier5Comparables.length} properties in same city (total unique: ${totalFound})`)
      allComparables.push(...tier5Comparables)
    }
    
    // Tier 6: Broader search only if insufficient local properties (lowest priority)
    if (allComparables.length < 6) {
      console.log(`🎯 Tier 6: Broader search for remaining properties`)
      const tier6Criteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: true,
        maxDistance: 8, // Broader radius as last resort
        excludeId: baseCriteria.excludeId
      }
      const tier6Result = feedManager.findComparableProperties(tier6Criteria)
      const tier6Comparables = tier6Result?.comparables || []
      // Track unique properties found in this tier
      tier6Result?.comparables?.forEach(comp => {
        const id = comp.refNumber || comp.address
        if (!allUniqueIds.has(id)) {
          allUniqueIds.add(id)
          totalFound++
        }
      })
      console.log(`✅ Tier 6 found: ${tier6Comparables.length} properties in broader area (total unique: ${totalFound})`)
      allComparables.push(...tier6Comparables)
    }

    // Remove duplicates and sort by relevance (location proximity first)
    const uniqueComparables = this.removeDuplicateComparables(allComparables)
    const sortedComparables = this.sortComparablesByLocationRelevance(uniqueComparables, propertyAddress)
    
    // Return top 12 most relevant properties
    let topComparables = sortedComparables.slice(0, 12)
    console.log(`🏆 Returning top ${topComparables.length} most relevant properties from ${sortedComparables.length} total candidates (total unique properties analyzed: ${totalFound})`)
    
    // If we don't have 12 comparables, fill up with progressively relaxed criteria
    if (topComparables.length < 12) {
      console.log(`⚠️ Only found ${topComparables.length} comparables - filling up to 12 with relaxed criteria...`)
      const fillUpResult = await this.fillUpComparablesTo12(baseCriteria, feedManager, topComparables)
      topComparables = fillUpResult.comparables
      totalFound += fillUpResult.additionalFound
    }
    
    return { comparables: topComparables, totalFound }
  }

  // Get comparables for short-term rental properties
  private static async getShortTermRentalComparables(
    baseCriteria: PropertySearchCriteria, 
    feedManager: any
  ): Promise<Comparable[]> {
    // Only show short-term rental comparables
    const shortTermCriteria: PropertySearchCriteria = {
      ...baseCriteria,
      isSale: false,
      isShortTerm: true,
      isLongTerm: false,
      excludeId: baseCriteria.excludeId // Ensure exclusion is maintained
    }
    
    let result = feedManager.findComparableProperties(shortTermCriteria)
    let comparables = result?.comparables || []
    
    // If not enough found, try relaxed criteria
    if (comparables.length < 12) {
      const relaxedCriteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: false,
        isShortTerm: true,
        maxDistance: 8,
        excludeId: baseCriteria.excludeId // Ensure exclusion is maintained
      }
      const relaxedResult = feedManager.findComparableProperties(relaxedCriteria)
      comparables = relaxedResult?.comparables || []
    }

    // Return top 12 most similar properties from ALL candidates
    const topComparables = comparables.slice(0, 12)
    console.log(`🏆 Returning top ${topComparables.length} most similar short-term rental properties from ${comparables.length} total candidates`)
    return topComparables
  }

  // Get comparables for long-term rental properties
  private static async getLongTermRentalComparables(
    baseCriteria: PropertySearchCriteria, 
    feedManager: any
  ): Promise<Comparable[]> {
    // Only show long-term rental comparables
    const longTermCriteria: PropertySearchCriteria = {
      ...baseCriteria,
      isSale: false,
      isShortTerm: false,
      isLongTerm: true,
      excludeId: baseCriteria.excludeId // Ensure exclusion is maintained
    }
    
    let result = feedManager.findComparableProperties(longTermCriteria)
    let comparables = result?.comparables || []
    
    // If not enough found, try relaxed criteria
    if (comparables.length < 12) {
      const relaxedCriteria: PropertySearchCriteria = {
        ...baseCriteria,
        isSale: false,
        isLongTerm: true,
        maxDistance: 8,
        excludeId: baseCriteria.excludeId // Ensure exclusion is maintained
      }
      const relaxedResult = feedManager.findComparableProperties(relaxedCriteria)
      comparables = relaxedResult?.comparables || []
    }

    // Return top 12 most similar properties from ALL candidates
    const topComparables = comparables.slice(0, 12)
    console.log(`🏆 Returning top ${topComparables.length} most similar long-term rental properties from ${comparables.length} total candidates`)
    return topComparables
  }

  // Get comparable properties with relaxed search criteria (legacy method - kept for compatibility)
  private static async getComparablesWithRelaxedCriteria(
    propertyData: PropertyData, 
    feedManager: any
  ): Promise<Comparable[]> {
    console.log('Trying relaxed criteria for comparable properties')
    
    // Relax criteria progressively - compare with ALL candidates for best quality
    const relaxedCriteria: PropertySearchCriteria = {
      propertyType: propertyData.propertyType,
      city: propertyData.city,
      province: propertyData.province,
      maxDistance: 8, // Increase radius to 8km but not too much
      // Filter by transaction type (sale vs rental)
      isSale: !(propertyData.isShortTerm || propertyData.is_short_term) && !(propertyData.isLongTerm || propertyData.is_long_term), // true for sale, false for rental
      // Exclude current property from comparable search (prevents self-comparison)
      excludeId: propertyData.id
    }

    // Try without bedroom/bathroom restrictions first
    let comparables = feedManager.findComparableProperties(relaxedCriteria)
    
    if (comparables.length > 0) {
      console.log(`Found ${comparables.length} comparable properties with relaxed location criteria`)
      return comparables
    }

    // Try with different property types in the same category
    const relatedTypes = this.getRelatedPropertyTypes(propertyData.propertyType)
    
    for (const relatedType of relatedTypes) {
      const typeRelaxedCriteria: PropertySearchCriteria = {
        ...relaxedCriteria,
        propertyType: relatedType,
        excludeId: propertyData.id // Ensure exclusion is maintained
      }
      
      comparables = feedManager.findComparableProperties(typeRelaxedCriteria)
      
      if (comparables.length > 0) {
        console.log(`Found ${comparables.length} comparable properties with related property type: ${relatedType}`)
        return comparables
      }
    }

    // Last resort: try province-wide search - compare with ALL candidates for best quality
    const provinceWideCriteria: PropertySearchCriteria = {
      propertyType: propertyData.propertyType,
      city: propertyData.city,
      province: propertyData.province,
      maxDistance: 25, // Reduced from 50km to 25km for better relevance
      // Filter by transaction type (sale vs rental)
      isSale: !(propertyData.isShortTerm || propertyData.is_short_term) && !(propertyData.isLongTerm || propertyData.is_long_term), // true for sale, false for rental
      // Exclude current property from comparable search (prevents self-comparison)
      excludeId: propertyData.id
    }

    comparables = feedManager.findComparableProperties(provinceWideCriteria)
    
    if (comparables.length > 0) {
      console.log(`Found ${comparables.length} comparable properties province-wide`)
    } else {
      console.log('No comparable properties found even with relaxed criteria')
    }

    return comparables
  }

  // Get related property types for broader comparison
  private static getRelatedPropertyTypes(propertyType: string): string[] {
    const typeGroups: Record<string, string[]> = {
      'Apartment': ['Flat', 'Studio', 'Duplex'],
      'Penthouse': ['Apartment', 'Duplex'],
      'Villa': ['House', 'Bungalow'],
      'House': ['Villa', 'Townhouse', 'Bungalow'],
      'Townhouse': ['House', 'Duplex'],
      'Duplex': ['Apartment', 'Townhouse'],
      'Studio': ['Apartment'],
      'Bungalow': ['House', 'Villa']
    }

    return typeGroups[propertyType] || []
  }

  // Fill up comparables to always show 12 by progressively relaxing criteria
  private static async fillUpComparablesTo12(
    baseCriteria: PropertySearchCriteria, 
    feedManager: any, 
    existingComparables: Comparable[]
  ): Promise<{ comparables: Comparable[], additionalFound: number }> {
    const existingIds = new Set(existingComparables.map(c => c.refNumber || c.address))
    let allComparables = [...existingComparables]
    let additionalFound = 0
    
    console.log(`🔍 Filling up comparables: currently have ${existingComparables.length}, need 12 total`)
    
    // Step 1: Relax distance to 10km
    if (allComparables.length < 12) {
      console.log('🔍 Step 1: Relaxing distance to 10km...')
      const relaxedDistanceCriteria: PropertySearchCriteria = {
        ...baseCriteria,
        maxDistance: 10,
        excludeId: baseCriteria.excludeId
      }
      const distanceResult = feedManager.findComparableProperties(relaxedDistanceCriteria)
      const newComparables = distanceResult?.comparables?.filter(c => !existingIds.has(c.refNumber || c.address)) || []
      allComparables.push(...newComparables)
      newComparables.forEach(c => existingIds.add(c.refNumber || c.address))
      additionalFound += distanceResult?.comparables?.length || 0
      console.log(`🔍 Step 1 added ${newComparables.length} comparables (total: ${allComparables.length}, additional found: ${additionalFound})`)
    }
    
    // Step 2: Relax bedroom/bathroom matching
    if (allComparables.length < 12) {
      console.log('🔍 Step 2: Relaxing bedroom/bathroom matching...')
      const relaxedBedroomCriteria: PropertySearchCriteria = {
        ...baseCriteria,
        bedrooms: undefined, // Remove bedroom restriction
        bathrooms: undefined, // Remove bathroom restriction
        maxDistance: 10,
        excludeId: baseCriteria.excludeId
      }
      const bedroomResult = feedManager.findComparableProperties(relaxedBedroomCriteria)
      const newComparables = bedroomResult?.comparables?.filter(c => !existingIds.has(c.refNumber || c.address)) || []
      allComparables.push(...newComparables)
      newComparables.forEach(c => existingIds.add(c.refNumber || c.address))
      additionalFound += bedroomResult?.comparables?.length || 0
      console.log(`🔍 Step 2 added ${newComparables.length} comparables (total: ${allComparables.length}, additional found: ${additionalFound})`)
    }
    
    // Step 3: Try related property types
    if (allComparables.length < 12) {
      console.log('🔍 Step 3: Trying related property types...')
      const relatedTypes = this.getRelatedPropertyTypes(baseCriteria.propertyType)
      for (const relatedType of relatedTypes) {
        if (allComparables.length >= 12) break
        
        const relatedTypeCriteria: PropertySearchCriteria = {
          ...baseCriteria,
          propertyType: relatedType,
          bedrooms: undefined,
          bathrooms: undefined,
          maxDistance: 10,
          excludeId: baseCriteria.excludeId
        }
        const relatedResult = feedManager.findComparableProperties(relatedTypeCriteria)
        const newComparables = relatedResult?.comparables?.filter(c => !existingIds.has(c.refNumber || c.address)) || []
        allComparables.push(...newComparables)
        newComparables.forEach(c => existingIds.add(c.refNumber || c.address))
        additionalFound += relatedResult?.comparables?.length || 0
        console.log(`🔍 Step 3 added ${newComparables.length} comparables from ${relatedType} (total: ${allComparables.length}, additional found: ${additionalFound})`)
      }
    }
    
    // Step 4: Relax price range significantly
    if (allComparables.length < 12) {
      console.log('🔍 Step 4: Relaxing price range significantly...')
      const relaxedPriceCriteria: PropertySearchCriteria = {
        ...baseCriteria,
        bedrooms: undefined,
        bathrooms: undefined,
        maxDistance: 15,
        minPrice: undefined, // Remove price restrictions
        maxPrice: undefined,
        excludeId: baseCriteria.excludeId
      }
      const priceResult = feedManager.findComparableProperties(relaxedPriceCriteria)
      const newComparables = priceResult?.comparables?.filter(c => !existingIds.has(c.refNumber || c.address)) || []
      allComparables.push(...newComparables)
      newComparables.forEach(c => existingIds.add(c.refNumber || c.address))
      additionalFound += priceResult?.comparables?.length || 0
      console.log(`🔍 Step 4 added ${newComparables.length} comparables (total: ${allComparables.length}, additional found: ${additionalFound})`)
    }
    
    // Step 5: Last resort - any property in the same city
    if (allComparables.length < 12) {
      console.log('🔍 Step 5: Last resort - any property in the same city...')
      const lastResortCriteria: PropertySearchCriteria = {
        propertyType: baseCriteria.propertyType,
        city: baseCriteria.city,
        isSale: baseCriteria.isSale,
        excludeId: baseCriteria.excludeId
      }
      const lastResortResult = feedManager.findComparableProperties(lastResortCriteria)
      const newComparables = lastResortResult?.comparables?.filter(c => !existingIds.has(c.refNumber || c.address)) || []
      allComparables.push(...newComparables)
      additionalFound += lastResortResult?.comparables?.length || 0
      console.log(`🔍 Step 5 added ${newComparables.length} comparables (total: ${allComparables.length}, additional found: ${additionalFound})`)
    }
    
    // Return exactly 12 comparables, sorted by similarity score
    const finalComparables = allComparables.slice(0, 12)
    console.log(`✅ Filled up to ${finalComparables.length} comparables using progressive relaxation (additional properties analyzed: ${additionalFound})`)
    return { comparables: finalComparables, additionalFound }
  }

  // Check if feed system is available and has data
  public static isFeedSystemAvailable(): boolean {
    try {
      const feedManager = getFeedManager()
      const stats = feedManager.getStats()
      return stats.totalProperties > 0
    } catch (error) {
      console.error('Error checking feed system availability:', error)
      return false
    }
  }

  // Get feed system statistics
  public static getFeedSystemStats(): {
    available: boolean
    totalProperties: number
    lastUpdate: string
    activeFeed: string
    cities: string[]
    propertyTypes: string[]
  } {
    try {
      const feedManager = getFeedManager()
      const stats = feedManager.getStats()
      const dbStats = feedManager.getDatabase().getStats()
      
      return {
        available: true,
        totalProperties: stats.totalProperties,
        lastUpdate: stats.lastUpdate,
        activeFeed: stats.activeFeed,
        cities: Object.keys(dbStats.byCities),
        propertyTypes: Object.keys(dbStats.byPropertyType)
      }
    } catch (error) {
      console.error('Error getting feed system stats:', error)
      return {
        available: false,
        totalProperties: 0,
        lastUpdate: 'Never',
        activeFeed: 'None',
        cities: [],
        propertyTypes: []
      }
    }
  }

  // Initialize feed system if not already initialized
  public static async initializeFeedSystem(): Promise<boolean> {
    try {
      const { initializeFeedManager } = await import('./feed-manager')
      await initializeFeedManager()
      console.log('Feed system initialized successfully')
      return true
    } catch (error) {
      console.error('Error initializing feed system:', error)
      return false
    }
  }

  // Manually trigger feed update
  public static async updateFeedData(): Promise<{
    success: boolean
    message: string
    stats?: any
  }> {
    try {
      const feedManager = getFeedManager()
      const result = await feedManager.updateFeed()
      
      if (result.success) {
        return {
          success: true,
          message: `Feed update completed: ${result.propertiesProcessed} processed, ${result.propertiesAdded} added, ${result.propertiesUpdated} updated`,
          stats: result
        }
      } else {
        return {
          success: false,
          message: `Feed update failed: ${result.error}`,
          stats: result
        }
      }
    } catch (error) {
      console.error('Error updating feed data:', error)
      return {
        success: false,
        message: `Feed update error: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  // Enhanced market data using feed statistics
  public static getMarketDataFromFeed(propertyData: PropertyData): {
    averagePrice: number
    medianPrice: number
    averagePricePerM2: number
    totalComparables: number
    marketTrend: 'up' | 'down' | 'stable'
  } | null {
    try {
      const feedManager = getFeedManager()
      
      // Get all properties in the same city and type for market analysis
      const marketCriteria: PropertySearchCriteria = {
        propertyType: propertyData.propertyType,
        city: propertyData.city,
        province: propertyData.province,
        maxResults: 100 // Get more for market analysis
      }
      
      const marketComparablesResult = feedManager.findComparableProperties(marketCriteria)
      const marketComparables = marketComparablesResult.comparables
      
      if (marketComparables.length < 3) {
        return null // Not enough data for market analysis
      }
      
      // Calculate market statistics
      const prices = marketComparables.map(c => c.price).sort((a, b) => a - b)
      const pricesPerM2 = marketComparables.map(c => c.pricePerM2).filter(price => price > 0) // Use existing pricePerM2 field
      
      const averagePrice = prices.reduce((sum, price) => sum + price, 0) / prices.length
      const medianPrice = prices[Math.floor(prices.length / 2)]
      const averagePricePerM2 = pricesPerM2.length > 0 
        ? pricesPerM2.reduce((sum, price) => sum + price, 0) / pricesPerM2.length 
        : 0
      
      // Determine market trend based on days on market
      const avgDaysOnMarket = marketComparables.reduce((sum, c) => sum + c.daysOnMarket, 0) / marketComparables.length
      
      let marketTrend: 'up' | 'down' | 'stable' = 'stable'
      if (avgDaysOnMarket < 30) {
        marketTrend = 'up' // Fast selling = hot market
      } else if (avgDaysOnMarket > 60) {
        marketTrend = 'down' // Slow selling = cooling market
      }
      
      return {
        averagePrice: Math.round(averagePrice),
        medianPrice: Math.round(medianPrice),
        averagePricePerM2: Math.round(averagePricePerM2),
        totalComparables: marketComparables.length,
        marketTrend
      }
    } catch (error) {
      console.error('Error getting market data from feed:', error)
      return null
    }
  }

  // Calculate appropriate price range based on property price and city
  private static calculatePriceRange(price: number, city: string): { minPrice: number; maxPrice: number } {
    // High-end areas need tighter price ranges
    const isHighEndArea = this.isHighEndArea(city)
    const priceRange = isHighEndArea ? 0.3 : 0.5 // 30% for high-end, 50% for others
    
    const minPrice = Math.round(price * (1 - priceRange))
    const maxPrice = Math.round(price * (1 + priceRange))
    
    return { minPrice, maxPrice }
  }

  // Determine if a city/area is high-end
  private static isHighEndArea(city: string): boolean {
    const highEndAreas = [
      'banús', 'puerto banús', 'nueva andalucía', 'marbella', 'benahavís', 
      'estepona', 'mijas costa', 'fuengirola', 'benalmádena', 'torremolinos'
    ]
    return highEndAreas.some(area => city.toLowerCase().includes(area.toLowerCase()))
  }

  // Get neighbourhood filter for specific areas
  private static getNeighborhoodFilter(propertyData: PropertyData): string | null {
    const address = (propertyData.address || '').toLowerCase()
    const city = (propertyData.city || '').toLowerCase()
    
    // Specific neighbourhood mappings for high-end areas
    const neighborhoodMappings = {
      'banús': ['banús', 'puerto banús', 'nuevo banús', 'marina banús'],
      'nueva andalucía': ['nueva andalucía', 'nueva andalucia', 'marina banús', 'banús'],
      'golden mile': ['golden mile', 'marbella golden mile', 'km 178', 'km 179', 'km 180'],
      'marbella': ['marbella centro', 'marbella center', 'casco antiguo', 'marbella town'],
      'benahavís': ['benahavís', 'la quinta', 'monte mayor', 'guadalmina'],
      'estepona': ['estepona', 'puerto deportivo', 'marina estepona', 'kempinski'],
      'mijas costa': ['mijas costa', 'calahonda', 'la cala'],
      'fuengirola': ['fuengirola', 'los boliches', 'carvajal'],
      'benalmádena': ['benalmádena', 'arroyo de la miel', 'torremolinos']
    }
    
    // Check if the property is in a specific neighbourhood
    for (const [neighborhood, keywords] of Object.entries(neighborhoodMappings)) {
      if (keywords.some(keyword => address.includes(keyword) || city.includes(keyword))) {
        return neighborhood
      }
    }
    
    return null
  }

  // Enhanced location-based filtering with geographic hierarchy
  private static getLocationBasedCriteria(propertyData: PropertyData): {
    allowedAreas: string[]
    excludedAreas: string[]
    maxDistance: number
    urbanization?: string
    suburb?: string
  } {
    const address = (propertyData.address || '').toLowerCase()
    const city = (propertyData.city || '').toLowerCase()
    
    // Extract urbanization and suburb from address if available
    const urbanization = this.extractUrbanizationFromAddress(address)
    const suburb = this.extractSuburbFromAddress(address)
    
    // Dynamic location-based criteria that works for all areas
    const locationCriteria = this.generateDynamicLocationCriteria(address, city)
    
        return {
      ...locationCriteria,
          urbanization,
          suburb
    }
  }

  // Generate dynamic location criteria based on address analysis
  private static generateDynamicLocationCriteria(address: string, city: string): {
    allowedAreas: string[]
    excludedAreas: string[]
    maxDistance: number
  } {
    // Extract the main area/neighbourhood from the address
    const mainArea = this.extractMainAreaFromAddress(address, city)
    
    if (!mainArea) {
      // Default for unknown areas
    return {
      allowedAreas: [],
      excludedAreas: [],
        maxDistance: 5
      }
    }

    // Get nearby areas based on geographic proximity
    const nearbyAreas = this.getNearbyAreasByProximity(mainArea)
    
    // Get distant areas to exclude (areas that are geographically far)
    const distantAreas = this.getDistantAreasByProximity(mainArea)
    
    // Determine appropriate max distance based on area type
    const maxDistance = this.getAppropriateMaxDistance(mainArea)
    
    return {
      allowedAreas: nearbyAreas,
      excludedAreas: distantAreas,
      maxDistance
    }
  }

  // Extract the main area/neighbourhood from address
  private static extractMainAreaFromAddress(address: string, city: string): string | null {
    // Common area keywords in Marbella region
    const areaKeywords = [
      'banús', 'puerto banús', 'nueva andalucía', 'golden mile', 'marbella golden mile',
      'marbella centro', 'marbella center', 'casco antiguo', 'marbella town',
      'los monteros', 'altos de los monteros', 'la reserva de los monteros', 'santa clara golf',
      'elviria', 'las chapas', 'el rosario', 'nagueles', 'marbesa',
      'benahavís', 'la quinta', 'monte mayor', 'guadalmina',
      'estepona', 'puerto deportivo', 'marina estepona',
      'mijas costa', 'calahonda', 'la cala',
      'fuengirola', 'los boliches', 'carvajal',
      'benalmádena', 'arroyo de la miel', 'torremolinos'
    ]
    
    // Find the most specific area mentioned in the address
    for (const keyword of areaKeywords) {
      if (address.includes(keyword.toLowerCase())) {
        return keyword
      }
    }
    
    // If no specific area found, return the city
    return city || null
  }

  // Get nearby areas based on geographic proximity (not hardcoded relationships)
  private static getNearbyAreasByProximity(mainArea: string): string[] {
    // Return empty array - no hardcoded relationships
    // The system will use distance-based filtering instead
    return []
  }

  // Get distant areas to exclude (areas that are geographically far)
  private static getDistantAreasByProximity(mainArea: string): string[] {
    // Return empty array - no hardcoded exclusions
    // The system will use distance-based filtering instead
    return []
  }

  // Get appropriate max distance based on area type
  private static getAppropriateMaxDistance(mainArea: string): number {
    const areaLower = mainArea.toLowerCase()
    
    // High-end areas need tighter radius for better relevance
    const highEndAreas = ['banús', 'puerto banús', 'nueva andalucía', 'golden mile', 'marbella golden mile']
    if (highEndAreas.some(area => areaLower.includes(area))) {
      return 3 // Tighter radius for high-end areas
    }
    
    // Standard areas
    return 5 // Standard radius for most areas
  }

  // Extract urbanization from address (placeholder for when database includes this field)
  private static extractUrbanizationFromAddress(address: string): string | undefined {
    // This can be enhanced when urbanization field is available in database
    const urbanizationKeywords = ['urbanización', 'urbanizacion', 'urbanization', 'residencial', 'residential']
    for (const keyword of urbanizationKeywords) {
      if (address.includes(keyword)) {
        // Extract urbanization name after keyword
        const parts = address.split(keyword)
        if (parts.length > 1) {
          return parts[1].trim().split(',')[0].trim()
        }
      }
    }
    return undefined
  }

  // Extract suburb/neighbourhood from address (placeholder for when database includes this field)
  private static extractSuburbFromAddress(address: string): string | undefined {
    // This can be enhanced when suburb field is available in database
    const suburbKeywords = ['barrio', 'neighbourhood', 'neighborhood', 'zona', 'zone']
    for (const keyword of suburbKeywords) {
      if (address.includes(keyword)) {
        // Extract suburb name after keyword
        const parts = address.split(keyword)
        if (parts.length > 1) {
          return parts[1].trim().split(',')[0].trim()
        }
      }
    }
    return undefined
  }

  // Extract city from address
  private static extractCityFromAddress(address: string): string | undefined {
    // Most addresses end with "City, Province" format
    const parts = address.split(',')
    if (parts.length >= 2) {
      // Return the second-to-last part (before province)
      return parts[parts.length - 2].trim()
    }
    return undefined
  }

  // Remove duplicate comparable properties based on refNumber or address
  private static removeDuplicateComparables(comparables: Comparable[]): Comparable[] {
    const seen = new Set<string>()
    const unique: Comparable[] = []
    
    for (const comparable of comparables) {
      const key = comparable.refNumber || comparable.address
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(comparable)
      }
    }
    
    return unique
  }

  // Sort comparables by location relevance (closer properties first)
  private static sortComparablesByLocationRelevance(comparables: Comparable[], targetAddress: string): Comparable[] {
    return comparables.sort((a, b) => {
      // First, sort by distance if available
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance
      }
      
      // If no distance, try to sort by address similarity
      const aAddress = (a.address || '').toLowerCase()
      const bAddress = (b.address || '').toLowerCase()
      const targetAddressLower = targetAddress.toLowerCase()
      
      // Check if addresses contain similar location keywords
      const aSimilarity = this.calculateAddressSimilarity(aAddress, targetAddressLower)
      const bSimilarity = this.calculateAddressSimilarity(bAddress, targetAddressLower)
      
      return bSimilarity - aSimilarity // Higher similarity first
    })
  }

  // Calculate address similarity based on common location keywords
  private static calculateAddressSimilarity(address1: string, address2: string): number {
    const keywords1 = address1.split(/\s+/).filter(word => word.length > 2)
    const keywords2 = address2.split(/\s+/).filter(word => word.length > 2)
    
    let matches = 0
    for (const keyword of keywords1) {
      if (keywords2.some(k => k.includes(keyword) || keyword.includes(k))) {
        matches++
      }
    }
    
    return matches / Math.max(keywords1.length, keywords2.length, 1)
  }

  // Get immediate neighbouring areas for a given city
  private static getImmediateNeighbours(city: string): string[] {
    // Return empty array - no hardcoded relationships
    // The system will use distance-based filtering instead
    return []
  }

  // Get fallback areas for when strict filtering yields too few results
  private static getFallbackAreas(city: string, currentAllowedAreas: string[]): string[] {
    // Return empty array - no hardcoded relationships
    // The system will use distance-based filtering instead
    return []
  }

  // Post-process comparables to ensure quality and relevance
  private static postProcessComparables(comparables: Comparable[], propertyData: PropertyData): Comparable[] {
    if (comparables.length === 0) return comparables
    
    // Get location-based filtering criteria
    const locationCriteria = this.getLocationBasedCriteria(propertyData)
    
    // Calculate price per m² for all comparables
    const comparablesWithPricePerM2 = comparables.map(comp => ({
      ...comp,
      pricePerM2: comp.price / (comp.buildArea || comp.m2 || 100)
    }))
    
    // Calculate the target price per m²
    const targetPricePerM2 = propertyData.price / (propertyData.buildArea || propertyData.totalAreaM2 || 100)
    
    // Apply location-based filtering with flexible fallback strategy
    let filteredComparables = comparablesWithPricePerM2
    
    if (locationCriteria.allowedAreas.length > 0 || locationCriteria.excludedAreas.length > 0) {
      // First pass: strict filtering with allowed areas (only if addresses contain area info)
      let strictFiltered = filteredComparables.filter(comp => {
        const compAddress = (comp.address || '').toLowerCase()
        
        // Exclude properties from excluded areas
        if (locationCriteria.excludedAreas.some(excludedArea => 
          compAddress.includes(excludedArea.toLowerCase())
        )) {
          console.log(`🚫 Excluded comparable from ${comp.address} (excluded area)`)
          return false
        }
        
        // If we have allowed areas, only include properties from those areas
        if (locationCriteria.allowedAreas.length > 0) {
          const isInAllowedArea = locationCriteria.allowedAreas.some(allowedArea => 
            compAddress.includes(allowedArea.toLowerCase())
          )
          if (!isInAllowedArea) {
            console.log(`🚫 Excluded comparable from ${comp.address} (not in allowed area)`)
            return false
          }
        }
        
        return true
      })
      
      // If strict filtering yields too few results, apply flexible fallback strategy
      if (strictFiltered.length < 12) {
        console.log(`⚠️ Strict location filtering yielded only ${strictFiltered.length} comparables, applying flexible fallback strategy`)
        
        // Flexible fallback: Since most properties have generic addresses like "Marbella, MA",
        // we'll include all properties but prioritize them based on relevance scoring
        filteredComparables = filteredComparables.filter(comp => {
          const compAddress = (comp.address || '').toLowerCase()
          
          // Still exclude excluded areas if they can be identified
          if (locationCriteria.excludedAreas.some(excludedArea => 
            compAddress.includes(excludedArea.toLowerCase())
          )) {
            return false
          }
          
          return true
        })
        
                 // Add location relevance scoring with proper geographic hierarchy
         filteredComparables = filteredComparables.map(comp => {
           const compAddress = (comp.address || '').toLowerCase()
           let locationScore = 1.0
           
           // Priority 1: Same urbanization (highest priority)
           if (locationCriteria.urbanization) {
             const compUrbanization = this.extractUrbanizationFromAddress(compAddress)
             if (compUrbanization && compUrbanization.toLowerCase() === locationCriteria.urbanization.toLowerCase()) {
               locationScore += 2.0
               console.log(`🏆 Boosted comparable from ${comp.address} (same urbanization: ${compUrbanization})`)
               return { ...comp, locationScore }
             }
           }
           
           // Priority 2: Same suburb/neighbourhood
           if (locationCriteria.suburb) {
             const compSuburb = this.extractSuburbFromAddress(compAddress)
             if (compSuburb && compSuburb.toLowerCase() === locationCriteria.suburb.toLowerCase()) {
               locationScore += 1.5
               console.log(`🏆 Boosted comparable from ${comp.address} (same suburb: ${compSuburb})`)
               return { ...comp, locationScore }
             }
           }
           
           // Priority 3: Neighbouring suburbs (immediate neighbours)
           const immediateAreas = this.getImmediateNeighbours(propertyData.city)
           if (immediateAreas.some(area => 
             compAddress.includes(area.toLowerCase())
           )) {
             locationScore += 1.0
             console.log(`✅ Boosted comparable from ${comp.address} (neighbouring suburb)`)
           }
           // Priority 4: Same city but different area
           // Extract city from comparable address (since Comparable doesn't have city property)
           const compCity = this.extractCityFromAddress(compAddress)
           if (compCity && compCity.toLowerCase() === propertyData.city.toLowerCase()) {
             locationScore += 0.5
             console.log(`✅ Boosted comparable from ${comp.address} (same city: ${compCity})`)
           }
           // Priority 5: Nearby cities
           else {
             const fallbackAreas = this.getFallbackAreas(propertyData.city, locationCriteria.allowedAreas)
             if (fallbackAreas.some(area => 
               compAddress.includes(area.toLowerCase())
             )) {
               locationScore += 0.3
               console.log(`✅ Boosted comparable from ${comp.address} (nearby city)`)
             }
           }
           
           return { ...comp, locationScore }
         })
        
        // Sort by location score first, then by price per m² similarity
        filteredComparables.sort((a, b) => {
          if (Math.abs(a.locationScore - b.locationScore) > 0.1) {
            return b.locationScore - a.locationScore // Higher location score first
          }
          const aDiff = Math.abs(a.pricePerM2 - targetPricePerM2)
          const bDiff = Math.abs(b.pricePerM2 - targetPricePerM2)
          return aDiff - bDiff
        })
        
        console.log(`🔄 Flexible fallback applied: ${comparables.length} → ${filteredComparables.length} comparables`)
      } else {
        filteredComparables = strictFiltered
      }
    }
    
    // Progressive comparable selection: ensure we always get 12 if available
    const originalCount = filteredComparables.length
    let finalComparables = filteredComparables
    
    // Step 1: Try strict price filtering (40% range)
    const strictPriceFiltered = filteredComparables.filter(comp => {
      const priceDiff = Math.abs(comp.pricePerM2 - targetPricePerM2) / targetPricePerM2
      return priceDiff <= 0.4 // Within 40% of target price per m²
    })
    
    if (strictPriceFiltered.length >= 12) {
      console.log(`✅ Found ${strictPriceFiltered.length} comparables with strict price filtering (40% range)`)
      finalComparables = strictPriceFiltered
    } else {
      console.log(`⚠️ Strict filtering found only ${strictPriceFiltered.length}, trying relaxed criteria...`)
      
      // Step 2: Try moderate price filtering (50% range)
      const moderatePriceFiltered = filteredComparables.filter(comp => {
        const priceDiff = Math.abs(comp.pricePerM2 - targetPricePerM2) / targetPricePerM2
        return priceDiff <= 0.5 // Within 50% of target price per m²
      })
      
      if (moderatePriceFiltered.length >= 12) {
        console.log(`✅ Found ${moderatePriceFiltered.length} comparables with moderate price filtering (50% range)`)
        finalComparables = moderatePriceFiltered
      } else {
        console.log(`⚠️ Moderate filtering found only ${moderatePriceFiltered.length}, trying loose criteria...`)
        
        // Step 3: Try loose price filtering (60% range)
        const loosePriceFiltered = filteredComparables.filter(comp => {
          const priceDiff = Math.abs(comp.pricePerM2 - targetPricePerM2) / targetPricePerM2
          return priceDiff <= 0.6 // Within 60% of target price per m²
        })
        
        if (loosePriceFiltered.length >= 12) {
          console.log(`✅ Found ${loosePriceFiltered.length} comparables with loose price filtering (60% range)`)
          finalComparables = loosePriceFiltered
        } else {
          // Step 4: Use all available comparables if we still don't have 12
          console.log(`⚠️ Loose filtering found only ${loosePriceFiltered.length}, using all ${filteredComparables.length} available comparables`)
          finalComparables = filteredComparables
        }
      }
    }
    
    // Final sort by price per m² similarity (if no location scoring was applied)
    if (!finalComparables[0]?.locationScore) {
      finalComparables.sort((a, b) => {
        const aDiff = Math.abs(a.pricePerM2 - targetPricePerM2)
        const bDiff = Math.abs(b.pricePerM2 - targetPricePerM2)
        return aDiff - bDiff
      })
    }
    
    // Always return exactly 12 (or as many as available if less than 12 total)
    const result = finalComparables.slice(0, 12)
    console.log(`🏆 Progressive selection complete: ${result.length} comparables (target: 12) out of ${originalCount} original candidates`)
    
    return result.map(comp => ({
      ...comp,
      pricePerM2: Math.round(comp.pricePerM2)
    }))
  }

  // Get related property types for high-end areas
  private static getRelatedPropertyTypesForHighEnd(propertyType: string): string[] {
    const relatedTypes = this.getRelatedPropertyTypes(propertyType)
    const highEndRelatedTypes = relatedTypes.filter(type => {
      const highEndPropertyTypes = ['Villa', 'Penthouse', 'Apartment']
      return highEndPropertyTypes.includes(type)
    })
    return highEndRelatedTypes
  }

  // Extract location components from address for proper hierarchy filtering
  private static extractLocationComponents(address: string): {
    urbanisation?: string
    street?: string
    suburb?: string
    city?: string
  } {
    const addressLower = address.toLowerCase()
    
    // Common urbanisations in Marbella area
    const urbanisations = [
      'nueva andalucía', 'nueva andalucia', 'puerto banús', 'puerto banus', 'golden mile',
      'sierra blanca', 'la campana', 'elviria', 'las chapas', 'calahonda', 'marbella club',
      'marina puerto banús', 'marina puerto banus', 'puerto deportivo', 'san pedro alcántara',
      'san pedro alcantara', 'benahavís', 'benahavis', 'estepona', 'mijas', 'costabella',
      'artola', 'cabopino', 'nagueles', 'rio real', 'marina banús', 'marina banus'
    ]
    
    // Common suburbs/neighbourhoods
    const suburbs = [
      'centro', 'old town', 'casco antiguo', 'playa', 'beach', 'mountain', 'golf',
      'residential', 'commercial', 'tourist', 'resort', 'luxury', 'exclusive',
      'urbanización', 'urbanizacion', 'zona', 'area'
    ]
    
    // Street patterns
    const streetPatterns = [
      /calle\s+([a-záéíóúñü\s]+)/i,
      /avenida\s+([a-záéíóúñü\s]+)/i,
      /plaza\s+([a-záéíóúñü\s]+)/i,
      /paseo\s+([a-záéíóúñü\s]+)/i,
      /camino\s+([a-záéíóúñü\s]+)/i
    ]
    
    let urbanisation: string | undefined
    let street: string | undefined
    let suburb: string | undefined
    let city: string | undefined
    
    // Check for street first (highest priority for location matching)
    for (const pattern of streetPatterns) {
      const match = address.match(pattern)
      if (match) {
        street = match[1].trim()
        break
      }
    }
    
    // Check for urbanisation
    for (const urban of urbanisations) {
      if (addressLower.includes(urban)) {
        urbanisation = urban
        break
      }
    }
    
    // Check for suburb
    for (const sub of suburbs) {
      if (addressLower.includes(sub)) {
        suburb = sub
        break
      }
    }
    
    // Extract city (usually at the end)
    const cityMatch = address.match(/([A-Z][a-záéíóúñü\s]+),\s*[A-Z]{2}$/)
    if (cityMatch) {
      city = cityMatch[1].trim()
    }
    
    return { urbanisation, street, suburb, city }
  }

  // Get nearby urbanisations for tier 4 search
  private static getNearbyUrbanisations(urbanisation?: string): string[] {
    if (!urbanisation) return []
    
    // First, try to get learned relationships from the location learning engine
    try {
      const learnedNearby = locationLearningEngine.getNearbyAreas(urbanisation, 'urbanisation')
      if (learnedNearby.length > 0) {
        console.log(`🧠 Location Learning: Found ${learnedNearby.length} learned nearby areas for ${urbanisation}`)
        return learnedNearby
      }
    } catch (error) {
      console.warn('⚠️ Location Learning lookup failed:', error)
    }
    
    // Fallback to hardcoded relationships
    const urbanisationMap: { [key: string]: string[] } = {
      'benahavis': ['nueva andalucia', 'artola', 'cabopino'],
      'nueva andalucia': ['benahavis', 'artola', 'cabopino', 'costabella'],
      'artola': ['benahavis', 'nueva andalucia', 'cabopino'],
      'cabopino': ['benahavis', 'nueva andalucia', 'artola'],
      'costabella': ['nueva andalucia', 'artola', 'cabopino'],
      'nagueles': ['sierra blanca', 'la campana', 'golden mile'],
      'sierra blanca': ['nagueles', 'la campana', 'golden mile'],
      'la campana': ['nagueles', 'sierra blanca', 'golden mile'],
      'golden mile': ['nagueles', 'sierra blanca', 'la campana'],
      'elviria': ['las chapas', 'calahonda', 'marbella club'],
      'las chapas': ['elviria', 'calahonda', 'marbella club'],
      'calahonda': ['elviria', 'las chapas', 'marbella club'],
      'marbella club': ['elviria', 'las chapas', 'calahonda'],
      'puerto banus': ['marina puerto banus', 'puerto deportivo'],
      'marina puerto banus': ['puerto banus', 'puerto deportivo'],
      'puerto deportivo': ['puerto banus', 'marina puerto banus']
    }
    
    return urbanisationMap[urbanisation.toLowerCase()] || []
  }

  // Extract location details from address for priority-based search (legacy method)
  private static extractLocationDetails(address: string): {
    urbanization?: string
    suburb?: string
    neighbourhood?: string
  } {
    const addressLower = address.toLowerCase()
    
    // Common urbanizations in Marbella
    const urbanizations = [
      'nueva andalucía', 'puerto banús', 'golden mile', 'sierra blanca', 'la campana',
      'elviria', 'las chapas', 'calahonda', 'marbella club', 'marina puerto banús',
      'puerto deportivo', 'san pedro alcántara', 'benahavís', 'estepona', 'mijas'
    ]
    
    // Common suburbs/neighbourhoods
    const suburbs = [
      'centro', 'old town', 'casco antiguo', 'playa', 'beach', 'mountain', 'golf',
      'residential', 'commercial', 'tourist', 'resort', 'luxury', 'exclusive'
    ]
    
    let urbanization: string | undefined
    let suburb: string | undefined
    
    // Check for urbanization
    for (const urban of urbanizations) {
      if (addressLower.includes(urban)) {
        urbanization = urban
        break
      }
    }
    
    // Check for suburb
    for (const sub of suburbs) {
      if (addressLower.includes(sub)) {
        suburb = sub
        break
      }
    }
    
    return { urbanization, suburb, neighbourhood: suburb }
  }

  // Get comparable listings using optimized search
  public static async getComparableListingsOptimized(propertyData: PropertyData): Promise<Comparable[]> {
    try {
      const feedManager = getFeedManager()
      
      if (!feedManager) {
        console.warn('Feed manager not available for optimized search')
        return []
      }

      // Use optimized search criteria
      const searchCriteria: PropertySearchCriteria = {
        propertyType: propertyData.propertyType,
        city: propertyData.city,
        province: propertyData.province,
        bedrooms: propertyData.bedrooms,
        bathrooms: propertyData.bathrooms,
        minPrice: propertyData.price ? propertyData.price * 0.7 : undefined,
        maxPrice: propertyData.price ? propertyData.price * 1.3 : undefined,
        minAreaM2: propertyData.buildArea ? propertyData.buildArea * 0.8 : undefined,
        maxAreaM2: propertyData.buildArea ? propertyData.buildArea * 1.2 : undefined,
        maxDistance: 5, // 5km radius
        maxResults: 15,
        isSale: propertyData.isSale,
        isShortTerm: propertyData.isShortTerm,
        isLongTerm: propertyData.isLongTerm,
        // Exclude current property from comparable search (prevents self-comparison)
        excludeId: propertyData.id
      }

      // Use the existing database through feed manager
      const database = feedManager.getDatabase()
      const searchResult = database.findComparableProperties(searchCriteria)
      
      console.log(`🔍 Optimized search found ${searchResult.comparables.length} comparables out of ${searchResult.totalFound} total for ${propertyData.address}`)
      return searchResult.comparables.map(comp => ({
        ...comp,
        areaType: comp.areaType as 'build' | 'plot' | 'terrace' || 'build'
      }))

    } catch (error) {
      console.error('Error in optimized comparable search:', error)
      return []
    }
  }
} 