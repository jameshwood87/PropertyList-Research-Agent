// Location Learning Engine
// Learns geographic relationships and urbanisation patterns from property analyses

import { PropertyData } from '@/types'
import path from 'path'
import fs from 'fs'

export interface LocationRelationship {
  sourceArea: string
  targetArea: string
  relationshipType: 'urbanisation' | 'suburb' | 'street' | 'city'
  frequency: number
  lastSeen: string
  confidence: number // 0-1, based on frequency and recency
}

export interface UrbanisationPattern {
  name: string
  aliases: string[]
  frequency: number
  firstSeen: string
  lastSeen: string
  commonStreets: string[]
  nearbyAreas: string[]
  confidence: number
}

export interface GeographicCluster {
  centerArea: string
  memberAreas: string[]
  averageDistance: number
  frequency: number
  lastUpdated: string
}

export interface LocationLearningData {
  relationships: LocationRelationship[]
  urbanisations: UrbanisationPattern[]
  clusters: GeographicCluster[]
  analysisCount: number
  lastUpdated: string
}

export class LocationLearningEngine {
  private dataPath: string
  private data: LocationLearningData
  private readonly MAX_RELATIONSHIPS = 1000
  private readonly MAX_URBANISATIONS = 500
  private readonly CONFIDENCE_DECAY_DAYS = 30

  constructor() {
    this.dataPath = path.join(process.cwd(), 'data', 'learning', 'location-learning.json')
    this.data = this.loadData()
  }

  private loadData(): LocationLearningData {
    try {
      if (fs.existsSync(this.dataPath)) {
        const fileContent = fs.readFileSync(this.dataPath, 'utf8')
        return JSON.parse(fileContent)
      }
    } catch (error) {
      console.warn('Could not load location learning data:', error)
    }

    return {
      relationships: [],
      urbanisations: [],
      clusters: [],
      analysisCount: 0,
      lastUpdated: new Date().toISOString()
    }
  }

  private saveData(): void {
    try {
      const dir = path.dirname(this.dataPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      this.data.lastUpdated = new Date().toISOString()
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2))
    } catch (error) {
      console.error('Could not save location learning data:', error)
    }
  }

  /**
   * Learn from a property analysis by tracking location relationships
   */
  public learnFromAnalysis(
    targetProperty: PropertyData,
    comparableProperties: Array<{ address: string; urbanisation?: string; suburb?: string; city?: string }>
  ): void {
    console.log('🧠 Location Learning: Processing analysis for location patterns')
    
    this.data.analysisCount++
    
    // Extract location components from target property
    const targetComponents = this.extractLocationComponents(targetProperty.address)
    
    // Learn urbanisation patterns
    this.learnUrbanisationPatterns(targetComponents, comparableProperties)
    
    // Learn geographic relationships
    this.learnGeographicRelationships(targetComponents, comparableProperties)
    
    // Update geographic clusters
    this.updateGeographicClusters(targetComponents, comparableProperties)
    
    // Clean up old data
    this.cleanupOldData()
    
    // Save updated data
    this.saveData()
    
    console.log(`🧠 Location Learning: Updated with ${this.data.analysisCount} total analyses`)
  }

  /**
   * Extract location components from address
   */
  private extractLocationComponents(address: string): {
    urbanisation?: string
    suburb?: string
    street?: string
    city?: string
  } {
    const addressLower = address.toLowerCase()
    
    // Common urbanisation patterns
    const urbanisationPatterns = [
      /urbanización\s+([a-záéíóúñü\s]+)/i,
      /urb\.\s+([a-záéíóúñü\s]+)/i,
      /urbanization\s+([a-záéíóúñü\s]+)/i
    ]
    
    // Street patterns
    const streetPatterns = [
      /calle\s+([a-záéíóúñü\s]+)/i,
      /avenida\s+([a-záéíóúñü\s]+)/i,
      /plaza\s+([a-záéíóúñü\s]+)/i,
      /paseo\s+([a-záéíóúñü\s]+)/i,
      /camino\s+([a-záéíóúñü\s]+)/i
    ]
    
    // Known urbanisations (from existing knowledge)
    const knownUrbanisations = [
      'nueva andalucía', 'nueva andalucia', 'puerto banús', 'puerto banus', 'golden mile',
      'sierra blanca', 'la campana', 'elviria', 'las chapas', 'calahonda', 'marbella club',
      'marina puerto banús', 'marina puerto banus', 'puerto deportivo', 'san pedro alcántara',
      'san pedro alcantara', 'benahavís', 'benahavis', 'estepona', 'mijas', 'costabella',
      'artola', 'cabopino', 'nagueles', 'rio real', 'marina banús', 'marina banus'
    ]
    
    let urbanisation: string | undefined
    let suburb: string | undefined
    let street: string | undefined
    let city: string | undefined
    
    // Check for urbanisation patterns first
    for (const pattern of urbanisationPatterns) {
      const match = address.match(pattern)
      if (match) {
        urbanisation = match[1].trim()
        break
      }
    }
    
    // Check for known urbanisations if no pattern found
    if (!urbanisation) {
      for (const known of knownUrbanisations) {
        if (addressLower.includes(known)) {
          urbanisation = known
          break
        }
      }
    }
    
    // Check for street patterns
    for (const pattern of streetPatterns) {
      const match = address.match(pattern)
      if (match) {
        street = match[1].trim()
        break
      }
    }
    
    // Extract city (usually at the end)
    const cityMatch = address.match(/([A-Z][a-záéíóúñü\s]+),\s*[A-Z]{2}$/)
    if (cityMatch) {
      city = cityMatch[1].trim()
    }
    
    return { urbanisation, suburb, street, city }
  }

  /**
   * Learn urbanisation patterns from property addresses
   */
  private learnUrbanisationPatterns(
    targetComponents: ReturnType<typeof this.extractLocationComponents>,
    comparableProperties: Array<{ address: string; urbanisation?: string; suburb?: string; city?: string }>
  ): void {
    // Learn from target property
    if (targetComponents.urbanisation) {
      this.updateUrbanisationPattern(targetComponents.urbanisation, targetComponents.street)
    }
    
    // Learn from comparable properties
    for (const comp of comparableProperties) {
      const compComponents = this.extractLocationComponents(comp.address)
      if (compComponents.urbanisation) {
        this.updateUrbanisationPattern(compComponents.urbanisation, compComponents.street)
      }
    }
  }

  /**
   * Update or create urbanisation pattern
   */
  private updateUrbanisationPattern(urbanisationName: string, streetName?: string): void {
    const normalizedName = urbanisationName.toLowerCase().trim()
    
    let pattern = this.data.urbanisations.find(u => 
      u.name.toLowerCase() === normalizedName ||
      u.aliases.some(alias => alias.toLowerCase() === normalizedName)
    )
    
    if (!pattern) {
      // Create new pattern
      pattern = {
        name: normalizedName,
        aliases: [],
        frequency: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        commonStreets: [],
        nearbyAreas: [],
        confidence: 0.1
      }
      this.data.urbanisations.push(pattern)
    }
    
    // Update pattern
    pattern.frequency++
    pattern.lastSeen = new Date().toISOString()
    
    // Add street if provided
    if (streetName && !pattern.commonStreets.includes(streetName.toLowerCase())) {
      pattern.commonStreets.push(streetName.toLowerCase())
    }
    
    // Update confidence based on frequency
    pattern.confidence = Math.min(1.0, pattern.frequency / 10)
    
    // Limit urbanisations
    if (this.data.urbanisations.length > this.MAX_URBANISATIONS) {
      this.data.urbanisations.sort((a, b) => b.frequency - a.frequency)
      this.data.urbanisations = this.data.urbanisations.slice(0, this.MAX_URBANISATIONS)
    }
  }

  /**
   * Learn geographic relationships between areas
   */
  private learnGeographicRelationships(
    targetComponents: ReturnType<typeof this.extractLocationComponents>,
    comparableProperties: Array<{ address: string; urbanisation?: string; suburb?: string; city?: string }>
  ): void {
    const targetAreas = this.getAreasFromComponents(targetComponents)
    
    for (const comp of comparableProperties) {
      const compComponents = this.extractLocationComponents(comp.address)
      const compAreas = this.getAreasFromComponents(compComponents)
      
      // STRICT TYPE-SPECIFIC RELATIONSHIPS: Only learn relationships between same location types
      for (const targetArea of targetAreas) {
        for (const compArea of compAreas) {
          // Only create relationships between the same location types
          if (targetArea.name !== compArea.name && targetArea.type === compArea.type) {
            this.updateRelationship(targetArea.name, compArea.name, targetArea.type)
          }
        }
      }
    }
  }

  /**
   * Get areas from location components
   */
  private getAreasFromComponents(components: ReturnType<typeof this.extractLocationComponents>): Array<{ name: string; type: 'urbanisation' | 'suburb' | 'street' | 'city' }> {
    const areas: Array<{ name: string; type: 'urbanisation' | 'suburb' | 'street' | 'city' }> = []
    
    if (components.urbanisation) {
      areas.push({ name: components.urbanisation.toLowerCase(), type: 'urbanisation' })
    }
    if (components.suburb) {
      areas.push({ name: components.suburb.toLowerCase(), type: 'suburb' })
    }
    if (components.street) {
      areas.push({ name: components.street.toLowerCase(), type: 'street' })
    }
    if (components.city) {
      areas.push({ name: components.city.toLowerCase(), type: 'city' })
    }
    
    return areas
  }

  /**
   * Update or create relationship between areas
   */
  private updateRelationship(sourceArea: string, targetArea: string, relationshipType: 'urbanisation' | 'suburb' | 'street' | 'city'): void {
    const relationshipKey = `${sourceArea}:${targetArea}:${relationshipType}`
    
    let relationship = this.data.relationships.find(r => 
      r.sourceArea === sourceArea && 
      r.targetArea === targetArea && 
      r.relationshipType === relationshipType
    )
    
    if (!relationship) {
      relationship = {
        sourceArea,
        targetArea,
        relationshipType,
        frequency: 0,
        lastSeen: new Date().toISOString(),
        confidence: 0.1
      }
      this.data.relationships.push(relationship)
    }
    
    // Update relationship
    relationship.frequency++
    relationship.lastSeen = new Date().toISOString()
    relationship.confidence = Math.min(1.0, relationship.frequency / 5)
    
    // Limit relationships
    if (this.data.relationships.length > this.MAX_RELATIONSHIPS) {
      this.data.relationships.sort((a, b) => b.frequency - a.frequency)
      this.data.relationships = this.data.relationships.slice(0, this.MAX_RELATIONSHIPS)
    }
  }

  /**
   * Update geographic clusters
   */
  private updateGeographicClusters(
    targetComponents: ReturnType<typeof this.extractLocationComponents>,
    comparableProperties: Array<{ address: string; urbanisation?: string; suburb?: string; city?: string }>
  ): void {
    const targetAreas = this.getAreasFromComponents(targetComponents)
    const allAreas = [...targetAreas]
    
    // Add comparable areas
    for (const comp of comparableProperties) {
      const compComponents = this.extractLocationComponents(comp.address)
      const compAreas = this.getAreasFromComponents(compComponents)
      allAreas.push(...compAreas)
    }
    
    // Find or create cluster
    const areaNames = allAreas.map(a => a.name)
    let cluster = this.data.clusters.find(c => 
      c.memberAreas.some(member => areaNames.includes(member))
    )
    
    if (!cluster) {
      // Create new cluster
      cluster = {
        centerArea: targetAreas[0]?.name || 'unknown',
        memberAreas: Array.from(new Set(areaNames)),
        averageDistance: 0,
        frequency: 0,
        lastUpdated: new Date().toISOString()
      }
      this.data.clusters.push(cluster)
    }
    
    // Update cluster
    cluster.frequency++
    cluster.lastUpdated = new Date().toISOString()
    
    // Merge overlapping clusters
    this.mergeOverlappingClusters()
  }

  /**
   * Merge clusters that have overlapping areas
   */
  private mergeOverlappingClusters(): void {
    const merged: boolean[] = new Array(this.data.clusters.length).fill(false)
    
    for (let i = 0; i < this.data.clusters.length; i++) {
      if (merged[i]) continue
      
      for (let j = i + 1; j < this.data.clusters.length; j++) {
        if (merged[j]) continue
        
        const cluster1 = this.data.clusters[i]
        const cluster2 = this.data.clusters[j]
        
        // Check for overlap
        const overlap = cluster1.memberAreas.filter(area => 
          cluster2.memberAreas.includes(area)
        )
        
        if (overlap.length > 0) {
          // Merge clusters
                  const mergedCluster: GeographicCluster = {
          centerArea: cluster1.frequency > cluster2.frequency ? cluster1.centerArea : cluster2.centerArea,
          memberAreas: Array.from(new Set([...cluster1.memberAreas, ...cluster2.memberAreas])),
          averageDistance: (cluster1.averageDistance + cluster2.averageDistance) / 2,
          frequency: cluster1.frequency + cluster2.frequency,
          lastUpdated: new Date().toISOString()
        }
          
          this.data.clusters[i] = mergedCluster
          merged[j] = true
        }
      }
    }
    
    // Remove merged clusters
    this.data.clusters = this.data.clusters.filter((_, index) => !merged[index])
  }

  /**
   * Clean up old data
   */
  private cleanupOldData(): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.CONFIDENCE_DECAY_DAYS)
    
    // Remove old relationships
    this.data.relationships = this.data.relationships.filter(r => 
      new Date(r.lastSeen) > cutoffDate || r.confidence > 0.3
    )
    
    // Remove old urbanisations
    this.data.urbanisations = this.data.urbanisations.filter(u => 
      new Date(u.lastSeen) > cutoffDate || u.confidence > 0.3
    )
    
    // Remove old clusters
    this.data.clusters = this.data.clusters.filter(c => 
      new Date(c.lastUpdated) > cutoffDate || c.frequency > 2
    )
  }

  /**
   * Get nearby areas for a given area
   */
  public getNearbyAreas(areaName: string, relationshipType?: 'urbanisation' | 'suburb' | 'street' | 'city'): string[] {
    const normalizedName = areaName.toLowerCase()
    
    const relationships = this.data.relationships.filter(r => 
      r.sourceArea === normalizedName &&
      r.confidence > 0.3 &&
      (!relationshipType || r.relationshipType === relationshipType)
    )
    
    // Sort by confidence and frequency
    relationships.sort((a, b) => {
      const scoreA = a.confidence * a.frequency
      const scoreB = b.confidence * b.frequency
      return scoreB - scoreA
    })
    
    return relationships.map(r => r.targetArea)
  }

  /**
   * Get learned urbanisations
   */
  public getLearnedUrbanisations(): UrbanisationPattern[] {
    return this.data.urbanisations
      .filter(u => u.confidence > 0.3)
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Get geographic clusters
   */
  public getGeographicClusters(): GeographicCluster[] {
    return this.data.clusters
      .filter(c => c.frequency > 2)
      .sort((a, b) => b.frequency - a.frequency)
  }

  /**
   * Get learning statistics
   */
  public getLearningStats(): {
    totalAnalyses: number
    totalRelationships: number
    totalUrbanisations: number
    totalClusters: number
    lastUpdated: string
  } {
    return {
      totalAnalyses: this.data.analysisCount,
      totalRelationships: this.data.relationships.length,
      totalUrbanisations: this.data.urbanisations.length,
      totalClusters: this.data.clusters.length,
      lastUpdated: this.data.lastUpdated
    }
  }

  /**
   * Export learning data for debugging
   */
  public exportLearningData(): LocationLearningData {
    return { ...this.data }
  }
}

// Singleton instance
export const locationLearningEngine = new LocationLearningEngine() 