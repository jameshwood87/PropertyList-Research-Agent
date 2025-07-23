const NodeCache = require('node-cache');

class AILearningService {
  constructor(propertyDatabase) {
    this.propertyDb = propertyDatabase;
    this.cache = new NodeCache({ stdTTL: 3600 }); // 1 hour cache
    this.learningWeights = {
      location: 0.40,
      size: 0.30,
      price: 0.20,
      bedrooms: 0.10
    };
  }

  /**
   * Process user feedback and update AI learning models
   */
  async processFeedback(sessionId, stepId, helpful, propertyData) {
    try {
      console.log(`🧠 Processing feedback: ${sessionId} - ${stepId} - ${helpful ? '👍' : '👎'}`);
      
      // Store feedback in analysis history
      await this.propertyDb.storeAnalysisHistory(
        sessionId,
        propertyData,
        { stepId, helpful, timestamp: new Date().toISOString() },
        { stepId, helpful, timestamp: new Date().toISOString() }
      );

      // If negative feedback, analyze and trigger improvements
      if (!helpful) {
        await this.handleNegativeFeedback(sessionId, stepId, propertyData);
      }

      // Update learning weights based on patterns
      await this.updateLearningWeights(stepId, helpful, propertyData);

      return {
        success: true,
        message: 'Feedback processed and learning models updated'
      };

    } catch (error) {
      console.error('Error processing feedback:', error);
      throw error;
    }
  }

  /**
   * Handle negative feedback by identifying improvement areas
   */
  async handleNegativeFeedback(sessionId, stepId, propertyData) {
    console.log(`🔍 Analyzing negative feedback for ${stepId} in ${propertyData.city}`);
    
    // Get recent feedback for this step and area
    const recentFeedback = await this.propertyDb.getRecentFeedback(stepId, propertyData.city, 30);
    
    // If multiple negative feedbacks, trigger improvement analysis
    const negativeFeedback = recentFeedback.filter(f => !f.helpful);
    if (negativeFeedback.length >= 2) {
      console.log(`⚠️ Multiple negative feedbacks detected for ${stepId} in ${propertyData.city}. Triggering improvement.`);
      await this.triggerStepImprovement(stepId, propertyData.city);
    }
  }

  /**
   * Update learning weights based on feedback patterns
   */
  async updateLearningWeights(stepId, helpful, propertyData) {
    const area = propertyData.city || 'general';
    const cacheKey = `weights_${area}`;
    
    // Get current area-specific weights
    let areaWeights = this.cache.get(cacheKey) || { ...this.learningWeights };
    
    // Adjust weights based on feedback
    if (stepId === 'comparables') {
      if (helpful) {
        // Positive feedback - slightly increase successful factors
        areaWeights.location *= 1.02;
        areaWeights.size *= 1.01;
      } else {
        // Negative feedback - slightly decrease current emphasis
        areaWeights.location *= 0.98;
        areaWeights.price *= 1.02; // Try emphasizing price more
      }
      
      // Normalize weights to sum to 1.0
      const total = Object.values(areaWeights).reduce((sum, w) => sum + w, 0);
      Object.keys(areaWeights).forEach(key => {
        areaWeights[key] = areaWeights[key] / total;
      });
      
      // Cache updated weights
      this.cache.set(cacheKey, areaWeights);
      
      console.log(`📊 Updated learning weights for ${area}:`, areaWeights);
    }
  }

  /**
   * Get enhanced AI prompt with learning insights
   */
  async getEnhancedPrompt(propertyData, comparablesData, chartData) {
    const area = propertyData.city || 'general';
    
    // Get learning insights for this area
    const areaInsights = await this.getAreaLearningInsights(area);
    const feedbackPatterns = await this.getFeedbackPatterns(area);
    
    // Build enhanced prompt
    let enhancedPrompt = this.buildBasePrompt(propertyData, comparablesData, chartData);
    
    // Add learning-based enhancements
    if (areaInsights.length > 0) {
      enhancedPrompt += `\n\n🧠 AI LEARNING INSIGHTS FOR ${area.toUpperCase()}:\n`;
      enhancedPrompt += `Based on ${areaInsights.length} previous analyses in this area:\n`;
      areaInsights.forEach(insight => {
        enhancedPrompt += `- ${insight}\n`;
      });
    }

    // Add feedback-based improvements
    if (feedbackPatterns.commonIssues.length > 0) {
      enhancedPrompt += `\n⚠️ AREAS TO FOCUS ON (based on user feedback):\n`;
      feedbackPatterns.commonIssues.forEach(issue => {
        enhancedPrompt += `- ${issue}\n`;
      });
    }

    if (feedbackPatterns.successFactors.length > 0) {
      enhancedPrompt += `\n✅ SUCCESSFUL ANALYSIS PATTERNS:\n`;
      feedbackPatterns.successFactors.forEach(factor => {
        enhancedPrompt += `- ${factor}\n`;
      });
    }

    return enhancedPrompt;
  }

  /**
   * Get area-specific learning insights
   */
  async getAreaLearningInsights(area) {
    try {
      const insights = await this.propertyDb.getAreaInsights(area);
      return insights.map(insight => {
        switch (insight.type) {
          case 'pricing_pattern':
            return `Properties in ${area} tend to be ${insight.trend} by ${insight.percentage}% compared to initial estimates`;
          case 'location_preference':
            return `Location factors are ${insight.importance} important in ${area} (weight: ${insight.weight})`;
          case 'size_correlation':
            return `Size-based comparisons show ${insight.correlation} correlation in ${area}`;
          default:
            return insight.description;
        }
      });
    } catch (error) {
      console.error('Error getting area insights:', error);
      return [];
    }
  }

  /**
   * Get feedback patterns for continuous improvement
   */
  async getFeedbackPatterns(area) {
    try {
      const recentFeedback = await this.propertyDb.getRecentFeedback(null, area, 90); // Last 90 days
      
      const positive = recentFeedback.filter(f => f.helpful);
      const negative = recentFeedback.filter(f => !f.helpful);
      
      // Analyze common issues in negative feedback
      const commonIssues = this.analyzeCommonIssues(negative);
      
      // Analyze success factors in positive feedback
      const successFactors = this.analyzeSuccessFactors(positive);
      
      return {
        commonIssues,
        successFactors,
        helpfulnessRate: positive.length / (positive.length + negative.length) || 0
      };
    } catch (error) {
      console.error('Error analyzing feedback patterns:', error);
      return { commonIssues: [], successFactors: [], helpfulnessRate: 0 };
    }
  }

  /**
   * Analyze common issues from negative feedback
   */
  analyzeCommonIssues(negativeFeedback) {
    const stepCounts = {};
    negativeFeedback.forEach(feedback => {
      stepCounts[feedback.step_id] = (stepCounts[feedback.step_id] || 0) + 1;
    });

    const issues = [];
    Object.entries(stepCounts).forEach(([step, count]) => {
      if (count >= 2) {
        switch (step) {
          case 'market':
            issues.push('Market analysis accuracy needs improvement - focus on local market conditions');
            break;
          case 'comparables':
            issues.push('Comparable property selection needs refinement - improve similarity matching');
            break;
          case 'insights':
            issues.push('Investment insights need more depth - provide more specific recommendations');
            break;
          case 'report':
            issues.push('Report generation needs enhancement - improve readability and actionability');
            break;
        }
      }
    });

    return issues;
  }

  /**
   * Analyze success factors from positive feedback
   */
  analyzeSuccessFactors(positiveFeedback) {
    const stepCounts = {};
    positiveFeedback.forEach(feedback => {
      stepCounts[feedback.step_id] = (stepCounts[feedback.step_id] || 0) + 1;
    });

    const factors = [];
    Object.entries(stepCounts).forEach(([step, count]) => {
      if (count >= 3) {
        switch (step) {
          case 'market':
            factors.push('Market analysis is performing well - maintain current approach');
            break;
          case 'comparables':
            factors.push('Comparable property matching is effective - current weights are optimal');
            break;
          case 'insights':
            factors.push('Investment insights are valuable - continue detailed recommendations');
            break;
          case 'report':
            factors.push('Report format is user-friendly - maintain current structure');
            break;
        }
      }
    });

    return factors;
  }

  /**
   * Build base prompt for AI analysis
   */
  buildBasePrompt(propertyData, comparablesData, chartData) {
    const { comparables, summary, criteria } = comparablesData;
    const { priceComparison, marketPosition, sizeComparison } = chartData;

    return `
Please provide a comprehensive property analysis for this Spanish property:

SUBJECT PROPERTY:
- Reference: ${propertyData.reference || 'N/A'}
- Location: ${propertyData.city || 'N/A'}
- Price: €${propertyData.price?.toLocaleString() || 'N/A'}
- Size: ${propertyData.build_square_meters || propertyData.build_area}m²
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}

COMPARABLE PROPERTIES ANALYSIS:
${summary}

MARKET DATA:
- Found ${comparables.length} comparable properties
- Average market price: €${priceComparison.average?.toLocaleString()}
- Price range: €${priceComparison.min?.toLocaleString()} - €${priceComparison.max?.toLocaleString()}
- Subject property percentile: ${marketPosition.percentile}th

Please provide analysis covering:
1. MARKET POSITIONING: How this property compares to the local market
2. PRICING ANALYSIS: Is the property fairly priced, overpriced, or underpriced?
3. INVESTMENT POTENTIAL: Rental yield potential, capital appreciation prospects
4. LOCATION INSIGHTS: Neighbourhood characteristics and growth potential
5. RECOMMENDATIONS: Specific advice for buyers/sellers/investors
    `;
  }

  /**
   * Trigger improvement for specific analysis step
   */
  async triggerStepImprovement(stepId, area) {
    const improvement = {
      stepId,
      area,
      triggeredAt: new Date().toISOString(),
      reason: 'Multiple negative feedback instances',
      status: 'pending'
    };

    await this.propertyDb.storeImprovementTrigger(improvement);
    console.log(`🔧 Improvement triggered for ${stepId} in ${area}`);
  }

  /**
   * Get learning statistics for admin dashboard
   */
  async getLearningStats() {
    try {
      const stats = await this.propertyDb.getLearningAnalytics();
      
      return {
        totalFeedback: stats.totalFeedback || 0,
        helpfulnessRate: stats.helpfulnessRate || 0,
        topPerformingSteps: stats.topPerformingSteps || [],
        improvementAreas: stats.improvementAreas || [],
        learningProgress: {
          thisWeek: stats.thisWeekAccuracy || 0,
          lastWeek: stats.lastWeekAccuracy || 0,
          improvement: stats.weeklyImprovement || 0
        }
      };
    } catch (error) {
      console.error('Error getting learning stats:', error);
      return {
        totalFeedback: 0,
        helpfulnessRate: 0,
        topPerformingSteps: [],
        improvementAreas: [],
        learningProgress: { thisWeek: 0, lastWeek: 0, improvement: 0 }
      };
    }
  }

  /**
   * Get optimized weights for area
   */
  getOptimizedWeights(area) {
    const cacheKey = `weights_${area}`;
    return this.cache.get(cacheKey) || this.learningWeights;
  }
}

module.exports = AILearningService; 