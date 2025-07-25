/**
 * Enhanced Quality Metrics Service - Phase 2
 * 
 * Implements sophisticated quality scoring algorithms that consider:
 * 1. Recency - How fresh is the comparable data (days old, market velocity)
 * 2. Proximity - Geographic distance weighting with smart fallbacks
 * 3. Similarity - Property type, size, features, and price range matching
 * 4. Market Context - Volatility, demand patterns, seasonal factors
 */
class EnhancedQualityMetricsService {
  constructor() {
    // Weighting factors for different quality components
    this.weights = {
      recency: 0.25,      // How fresh is the data
      proximity: 0.30,    // Geographic closeness 
      similarity: 0.35,   // Property characteristics match
      completeness: 0.10  // Data completeness
    };
    
    // Distance thresholds (in km)
    this.distanceThresholds = {
      excellent: 0.5,   // Within 500m
      good: 1.0,        // Within 1km
      fair: 2.0,        // Within 2km
      poor: 5.0         // Within 5km
    };
    
    // Recency thresholds (in days)
    this.recencyThresholds = {
      excellent: 7,     // Within a week
      good: 30,         // Within a month
      fair: 90,         // Within 3 months
      poor: 180         // Within 6 months
    };
    
    // Property type similarity matrix
    this.typeSimilarity = {
      'Villa': { 'Villa': 1.0, 'Detached House': 0.8, 'Semi-Detached House': 0.6, 'Townhouse': 0.5, 'Apartment': 0.2 },
      'Detached House': { 'Villa': 0.8, 'Detached House': 1.0, 'Semi-Detached House': 0.8, 'Townhouse': 0.6, 'Apartment': 0.3 },
      'Semi-Detached House': { 'Villa': 0.6, 'Detached House': 0.8, 'Semi-Detached House': 1.0, 'Townhouse': 0.8, 'Apartment': 0.4 },
      'Townhouse': { 'Villa': 0.5, 'Detached House': 0.6, 'Semi-Detached House': 0.8, 'Townhouse': 1.0, 'Apartment': 0.6 },
      'Apartment': { 'Villa': 0.2, 'Detached House': 0.3, 'Semi-Detached House': 0.4, 'Townhouse': 0.6, 'Apartment': 1.0 }
    };
  }

  /**
   * Calculate comprehensive quality score for comparable properties
   */
  async calculateQualityScore(mainProperty, comparables, maturityMetrics) {
    if (!comparables || comparables.length === 0) {
      return {
        overallScore: 0,
        breakdown: {
          recency: 0,
          proximity: 0,
          similarity: 0,
          completeness: 0
        },
        details: {
          totalComparables: 0,
          qualityDistribution: { excellent: 0, good: 0, fair: 0, poor: 0 },
          averageDistance: 0,
          averageAge: 0
        }
      };
    }

    // Calculate individual scores for each comparable
    const comparableScores = await Promise.all(
      comparables.map(comp => this.scoreComparable(mainProperty, comp))
    );

    // Calculate weighted averages
    const avgRecency = this.calculateWeightedAverage(comparableScores, 'recency');
    const avgProximity = this.calculateWeightedAverage(comparableScores, 'proximity');
    const avgSimilarity = this.calculateWeightedAverage(comparableScores, 'similarity');
    const avgCompleteness = this.calculateWeightedAverage(comparableScores, 'completeness');

    // Calculate overall quality score
    const overallScore = 
      this.weights.recency * avgRecency +
      this.weights.proximity * avgProximity +
      this.weights.similarity * avgSimilarity +
      this.weights.completeness * avgCompleteness;

    // Generate quality distribution
    const qualityDistribution = this.categorizeQuality(comparableScores);

    // Calculate additional metrics
    const details = {
      totalComparables: comparables.length,
      qualityDistribution,
      averageDistance: this.calculateAverageDistance(comparableScores),
      averageAge: this.calculateAverageAge(comparableScores),
      topPerformers: comparableScores
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 3)
        .map(score => ({
          reference: score.comparable.reference,
          overallScore: score.overall,
          strengths: this.identifyStrengths(score)
        }))
    };

    return {
      overallScore: Math.min(overallScore, 1.0),
      breakdown: {
        recency: avgRecency,
        proximity: avgProximity,
        similarity: avgSimilarity,
        completeness: avgCompleteness
      },
      details,
      maturityBonus: this.calculateMaturityBonus(maturityMetrics),
      recommendation: this.generateQualityRecommendation(overallScore, details)
    };
  }

  /**
   * Score an individual comparable against the main property
   */
  async scoreComparable(mainProperty, comparable) {
    const recencyScore = this.calculateRecencyScore(comparable);
    const proximityScore = this.calculateProximityScore(mainProperty, comparable);
    const similarityScore = this.calculateSimilarityScore(mainProperty, comparable);
    const completenessScore = this.calculateCompletenessScore(comparable);

    const overall = 
      this.weights.recency * recencyScore +
      this.weights.proximity * proximityScore +
      this.weights.similarity * similarityScore +
      this.weights.completeness * completenessScore;

    return {
      comparable,
      recency: recencyScore,
      proximity: proximityScore,
      similarity: similarityScore,
      completeness: completenessScore,
      overall,
      distance: this.calculateDistance(mainProperty, comparable),
      ageInDays: this.calculateAgeInDays(comparable)
    };
  }

  /**
   * Calculate recency score based on how fresh the comparable data is
   */
  calculateRecencyScore(comparable) {
    const ageInDays = this.calculateAgeInDays(comparable);
    
    if (ageInDays <= this.recencyThresholds.excellent) return 1.0;
    if (ageInDays <= this.recencyThresholds.good) return 0.8;
    if (ageInDays <= this.recencyThresholds.fair) return 0.6;
    if (ageInDays <= this.recencyThresholds.poor) return 0.4;
    
    // Exponential decay for very old data
    const decayFactor = Math.exp(-(ageInDays - this.recencyThresholds.poor) / 180);
    return Math.max(0.1, 0.4 * decayFactor);
  }

  /**
   * Calculate proximity score based on geographic distance
   */
  calculateProximityScore(mainProperty, comparable) {
    const distance = this.calculateDistance(mainProperty, comparable);
    
    if (distance === null) return 0.5; // No coordinates available
    
    if (distance <= this.distanceThresholds.excellent) return 1.0;
    if (distance <= this.distanceThresholds.good) return 0.85;
    if (distance <= this.distanceThresholds.fair) return 0.65;
    if (distance <= this.distanceThresholds.poor) return 0.45;
    
    // Gradual decline for distant properties
    const decayFactor = Math.exp(-(distance - this.distanceThresholds.poor) / 10);
    return Math.max(0.1, 0.45 * decayFactor);
  }

  /**
   * Calculate similarity score based on property characteristics
   */
  calculateSimilarityScore(mainProperty, comparable) {
    let similarityScore = 0;
    let factors = 0;

    // Property type similarity (40% weight)
    const typeScore = this.getTypeSimilarity(mainProperty.property_type, comparable.property_type);
    similarityScore += typeScore * 0.4;
    factors += 0.4;

    // Size similarity (25% weight)
    if (mainProperty.build_size && comparable.build_size) {
      const sizeScore = this.calculateSizeSimilarity(mainProperty.build_size, comparable.build_size);
      similarityScore += sizeScore * 0.25;
      factors += 0.25;
    }

    // Bedroom similarity (20% weight)
    if (mainProperty.bedrooms && comparable.bedrooms) {
      const bedroomScore = this.calculateBedroomSimilarity(mainProperty.bedrooms, comparable.bedrooms);
      similarityScore += bedroomScore * 0.20;
      factors += 0.20;
    }

    // Price range similarity (15% weight)
    if (mainProperty.sale_price && comparable.sale_price) {
      const priceScore = this.calculatePriceSimilarity(mainProperty.sale_price, comparable.sale_price);
      similarityScore += priceScore * 0.15;
      factors += 0.15;
    }

    return factors > 0 ? similarityScore / factors : 0.5;
  }

  /**
   * Calculate data completeness score
   */
  calculateCompletenessScore(comparable) {
    const fields = [
      'sale_price', 'build_size', 'bedrooms', 'bathrooms', 
      'property_type', 'latitude', 'longitude', 'last_updated_at'
    ];
    
    const presentFields = fields.filter(field => 
      comparable[field] !== null && 
      comparable[field] !== undefined && 
      comparable[field] !== ''
    );

    const completeness = presentFields.length / fields.length;
    
    // Bonus for having images
    const imageBonus = (comparable.images && comparable.images.length > 0) ? 0.1 : 0;
    
    return Math.min(completeness + imageBonus, 1.0);
  }

  /**
   * Get property type similarity score
   */
  getTypeSimilarity(type1, type2) {
    if (!type1 || !type2) return 0.5;
    
    const normalizedType1 = this.normalizePropertyType(type1);
    const normalizedType2 = this.normalizePropertyType(type2);
    
    return this.typeSimilarity[normalizedType1]?.[normalizedType2] || 0.3;
  }

  /**
   * Calculate size similarity (penalize significant differences)
   */
  calculateSizeSimilarity(size1, size2) {
    if (!size1 || !size2) return 0.5;
    
    const ratio = Math.min(size1, size2) / Math.max(size1, size2);
    
    if (ratio >= 0.9) return 1.0;   // Very similar
    if (ratio >= 0.8) return 0.9;   // Similar
    if (ratio >= 0.7) return 0.7;   // Somewhat similar
    if (ratio >= 0.5) return 0.5;   // Different but usable
    
    return 0.3; // Very different
  }

  /**
   * Calculate bedroom similarity
   */
  calculateBedroomSimilarity(bedrooms1, bedrooms2) {
    if (!bedrooms1 || !bedrooms2) return 0.5;
    
    const diff = Math.abs(bedrooms1 - bedrooms2);
    
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.8;
    if (diff === 2) return 0.6;
    if (diff === 3) return 0.4;
    
    return 0.2;
  }

  /**
   * Calculate price similarity
   */
  calculatePriceSimilarity(price1, price2) {
    if (!price1 || !price2) return 0.5;
    
    const ratio = Math.min(price1, price2) / Math.max(price1, price2);
    
    if (ratio >= 0.9) return 1.0;
    if (ratio >= 0.8) return 0.9;
    if (ratio >= 0.7) return 0.8;
    if (ratio >= 0.6) return 0.6;
    if (ratio >= 0.5) return 0.4;
    
    return 0.2;
  }

  /**
   * Calculate distance between two properties using Haversine formula
   */
  calculateDistance(property1, property2) {
    if (!property1.latitude || !property1.longitude || 
        !property2.latitude || !property2.longitude) {
      return null;
    }

    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(property2.latitude - property1.latitude);
    const dLon = this.toRadians(property2.longitude - property1.longitude);
    
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(this.toRadians(property1.latitude)) * 
              Math.cos(this.toRadians(property2.latitude)) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
              
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  }

  /**
   * Calculate age of comparable in days
   */
  calculateAgeInDays(comparable) {
    const lastUpdated = comparable.last_updated_at || comparable.updated_at || comparable.created_at;
    
    if (!lastUpdated) return 365; // Assume 1 year old if no date
    
    const updateDate = new Date(lastUpdated);
    const now = new Date();
    return Math.floor((now - updateDate) / (1000 * 60 * 60 * 24));
  }

  /**
   * Calculate weighted average of scores
   */
  calculateWeightedAverage(scores, field) {
    if (scores.length === 0) return 0;
    
    const weightedSum = scores.reduce((sum, score) => {
      // Weight by overall quality - better comparables have more influence
      const weight = Math.max(0.1, score.overall);
      return sum + (score[field] * weight);
    }, 0);
    
    const totalWeight = scores.reduce((sum, score) => sum + Math.max(0.1, score.overall), 0);
    
    return weightedSum / totalWeight;
  }

  /**
   * Categorize comparables by quality level
   */
  categorizeQuality(scores) {
    const distribution = { excellent: 0, good: 0, fair: 0, poor: 0 };
    
    scores.forEach(score => {
      if (score.overall >= 0.8) distribution.excellent++;
      else if (score.overall >= 0.6) distribution.good++;
      else if (score.overall >= 0.4) distribution.fair++;
      else distribution.poor++;
    });
    
    return distribution;
  }

  /**
   * Calculate average distance of comparables
   */
  calculateAverageDistance(scores) {
    const validDistances = scores
      .map(score => score.distance)
      .filter(distance => distance !== null);
    
    if (validDistances.length === 0) return null;
    
    return validDistances.reduce((sum, distance) => sum + distance, 0) / validDistances.length;
  }

  /**
   * Calculate average age of comparables
   */
  calculateAverageAge(scores) {
    const ages = scores.map(score => score.ageInDays);
    return ages.reduce((sum, age) => sum + age, 0) / ages.length;
  }

  /**
   * Calculate maturity bonus based on data accumulation
   */
  calculateMaturityBonus(maturityMetrics) {
    const { nComparables, nAnalyses } = maturityMetrics;
    
    let bonus = 0;
    
    // Bonus for having many comparables
    if (nComparables >= 50) bonus += 0.1;
    else if (nComparables >= 20) bonus += 0.05;
    
    // Bonus for frequent analysis (indicates active market)
    if (nAnalyses >= 20) bonus += 0.1;
    else if (nAnalyses >= 10) bonus += 0.05;
    
    return Math.min(bonus, 0.2); // Cap at 20% bonus
  }

  /**
   * Identify strengths of a comparable
   */
  identifyStrengths(score) {
    const strengths = [];
    
    if (score.recency >= 0.8) strengths.push('Fresh data');
    if (score.proximity >= 0.8) strengths.push('Close location');
    if (score.similarity >= 0.8) strengths.push('Similar property');
    if (score.completeness >= 0.8) strengths.push('Complete information');
    
    return strengths;
  }

  /**
   * Generate quality recommendation
   */
  generateQualityRecommendation(overallScore, details) {
    if (overallScore >= 0.8) {
      return {
        level: 'excellent',
        message: 'High-quality comparable data provides reliable analysis foundation.',
        confidence: 'high',
        suggestion: 'Proceed with system-based analysis for optimal efficiency.'
      };
    }
    
    if (overallScore >= 0.6) {
      return {
        level: 'good',
        message: 'Good comparable data quality with some limitations.',
        confidence: 'medium',
        suggestion: 'Consider AI enhancement for critical analysis sections.'
      };
    }
    
    if (overallScore >= 0.4) {
      return {
        level: 'fair',
        message: 'Moderate data quality may impact analysis accuracy.',
        confidence: 'medium',
        suggestion: 'Use AI analysis for better interpretation of limited data.'
      };
    }
    
    return {
      level: 'poor',
      message: 'Limited comparable data quality requires careful interpretation.',
      confidence: 'low',
      suggestion: 'Recommend AI analysis and consider expanding search radius.'
    };
  }

  /**
   * Normalize property type for consistency
   */
  normalizePropertyType(type) {
    if (!type) return 'Unknown';
    
    const normalized = type.toLowerCase();
    
    if (normalized.includes('villa')) return 'Villa';
    if (normalized.includes('detached') && normalized.includes('house')) return 'Detached House';
    if (normalized.includes('semi') && normalized.includes('detached')) return 'Semi-Detached House';
    if (normalized.includes('townhouse') || normalized.includes('town house')) return 'Townhouse';
    if (normalized.includes('apartment') || normalized.includes('flat')) return 'Apartment';
    
    return 'Detached House'; // Default fallback
  }

  /**
   * Convert degrees to radians
   */
  toRadians(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Get quality metrics summary for reporting
   */
  getQualityMetricsSummary(qualityResult) {
    return {
      score: qualityResult.overallScore,
      level: qualityResult.recommendation.level,
      comparables: qualityResult.details.totalComparables,
      avgDistance: qualityResult.details.averageDistance,
      avgAge: qualityResult.details.averageAge,
      distribution: qualityResult.details.qualityDistribution,
      recommendation: qualityResult.recommendation.suggestion
    };
  }
}

module.exports = EnhancedQualityMetricsService; 