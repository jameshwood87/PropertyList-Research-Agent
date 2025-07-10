import OpenAI from 'openai'
import { PropertyData, TavilySearchResult, MarketData } from '@/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function generateAnalysis(
  propertyData: PropertyData,
  marketData: TavilySearchResult[],
  researchTopic?: string
) {
  try {
    // Prepare market data summary
    const marketSummary = marketData.map(result => ({
      title: result.title,
      content: result.content.substring(0, 500), // Limit content to save tokens
      url: result.url,
      score: result.score
    }))

    // Create the analysis prompt
    const prompt = createAnalysisPrompt(propertyData, marketSummary, researchTopic)

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a professional real estate analyst and market research expert specializing in Spanish property markets. You provide comprehensive, data-driven analysis for real estate investments, valuations, and market trends.

Your analysis should be:
- Professional and client-ready
- Based on provided data and market research
- Focused on actionable insights
- Structured and well-organized
- Include specific recommendations for buyers, sellers, and investors

Always provide realistic valuations and honest assessments of risks and opportunities.`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 3000,
      temperature: 0.3
    })

    const analysis = response.choices[0].message.content

    if (!analysis) {
      throw new Error('No analysis generated')
    }

    // Parse the structured analysis
    return parseAnalysisResponse(analysis, propertyData, marketData)

  } catch (error) {
    console.error('Error generating analysis:', error)
    throw new Error('Failed to generate analysis')
  }
}

function createAnalysisPrompt(
  propertyData: PropertyData,
  marketData: any[],
  researchTopic?: string
): string {
  return `
# Comprehensive Property Market Analysis Request

You are a senior real estate analyst with 15+ years of experience in the Spanish property market. Provide an extremely detailed, professional analysis for institutional investors.

## Property Details
- Location: ${propertyData.location}
- Listed Price: €${propertyData.price.toLocaleString()}
- Property Size: ${propertyData.sqm} m²
- Price per m²: €${propertyData.pricePerSqm || 'N/A'}
- Property Type: ${propertyData.type}
- Bedrooms: ${propertyData.bedrooms}
- Bathrooms: ${propertyData.bathrooms}
- Transaction Type: ${propertyData.saleOrRent}
- New Construction: ${propertyData.isNewConstruction ? 'Yes' : 'No'}
- Views: ${propertyData.views?.join(', ') || 'Not specified'}
- Features: ${propertyData.features?.join(', ') || 'Not specified'}
- Property Description: ${propertyData.description || 'No description available'}

## Market Research Data (${marketData.length} Sources)
${marketData.map((data, index) => `
${index + 1}. ${data.title}
   Source: ${data.url}
   Content: ${data.content}
   Relevance Score: ${data.score}
`).join('\n')}

## Research Focus
${researchTopic || 'Comprehensive market analysis covering investment potential, market positioning, and strategic recommendations'}

## Required Comprehensive Analysis Format

Provide an extremely detailed analysis in the following JSON format:

{
  "marketData": {
    "averagePricePerSqm": number,
    "priceRange": {"min": number, "max": number},
    "marketSegment": "luxury" | "premium" | "mid_market" | "affordable",
    "competitionLevel": "high" | "medium" | "low",
    "salesVolume": number,
    "daysOnMarket": number,
    "priceGrowth": number,
    "marketTrend": "strong_growth" | "moderate_growth" | "stable" | "declining" | "volatile",
    "seasonality": "high_seasonal" | "moderate_seasonal" | "low_seasonal",
    "liquidity": "high" | "medium" | "low",
    "comparableListings": [
      {
        "address": "string",
        "price": number,
        "pricePerSqm": number,
        "sqm": number,
        "bedrooms": number,
        "similarity": "very_similar" | "similar" | "somewhat_similar",
        "priceComparison": "higher" | "similar" | "lower",
        "keyDifferences": "string"
      }
    ]
  },
  "insights": {
    "valuation": {
      "estimatedValue": number,
      "estimatedValueRange": {"min": number, "max": number},
      "priceAssessment": "significantly_overpriced" | "overpriced" | "fairly_priced" | "underpriced" | "significantly_underpriced",
      "confidence": number,
      "valuationMethod": "string",
      "keyFactors": ["primary factor", "secondary factor", "tertiary factor"],
      "negotiationPotential": number,
      "timeToSell": number,
      "pricePerSqmComparison": "above_market" | "at_market" | "below_market"
    },
    "investment": {
      "potential": "exceptional" | "high" | "medium" | "low" | "poor",
      "expectedROI": number,
      "paybackPeriod": number,
      "rentalYield": number,
      "appreciationForecast": number,
      "liquidityRisk": "high" | "medium" | "low",
      "riskScore": number,
      "risks": [
        {
          "risk": "string",
          "impact": "high" | "medium" | "low",
          "likelihood": "high" | "medium" | "low",
          "mitigation": "string"
        }
      ],
      "opportunities": [
        {
          "opportunity": "string",
          "potential": "high" | "medium" | "low",
          "timeframe": "short_term" | "medium_term" | "long_term",
          "strategy": "string"
        }
      ]
    },
    "location": {
      "accessibility": "excellent" | "good" | "average" | "poor",
      "publicTransport": "excellent" | "good" | "average" | "poor",
      "amenities": "excellent" | "good" | "average" | "poor",
      "schools": "excellent" | "good" | "average" | "poor",
      "safety": "excellent" | "good" | "average" | "poor",
      "futureProspects": "excellent" | "good" | "average" | "poor",
      "gentrification": "rapid" | "moderate" | "slow" | "none",
      "infrastructure": ["upcoming project 1", "upcoming project 2"],
      "walkScore": number,
      "beachDistance": number,
      "cityDistance": number
    },
    "recommendations": {
      "buyerAdvice": {
        "recommendation": "buy_immediately" | "buy_with_conditions" | "negotiate_price" | "wait" | "avoid",
        "reasoning": "detailed explanation of recommendation",
        "conditions": ["condition 1", "condition 2"],
        "negotiationPoints": ["point 1", "point 2"],
        "maxPrice": number,
        "inspectionFocus": ["area 1", "area 2"],
        "timeline": "optimal timing strategy"
      },
      "sellerAdvice": {
        "pricingStrategy": "price_premium" | "market_price" | "competitive_price" | "price_reduction",
        "marketingStrategy": "detailed marketing approach",
        "timing": "sell_now" | "wait_for_market" | "seasonal_timing",
        "improvements": ["improvement 1", "improvement 2"],
        "targetBuyer": "ideal buyer profile",
        "expectedTimeToSell": number
      },
      "investorAdvice": {
        "strategy": "buy_and_hold" | "flip" | "rental_income" | "development" | "avoid",
        "financing": "optimal financing strategy",
        "exitStrategy": "detailed exit plan",
        "holdPeriod": number,
        "renovationNeeds": ["need 1", "need 2"],
        "targetTenant": "ideal tenant profile",
        "breakEvenAnalysis": "detailed financial breakdown"
      }
    }
  },
  "swotAnalysis": {
    "strengths": ["internal strength 1", "internal strength 2", "internal strength 3"],
    "weaknesses": ["internal weakness 1", "internal weakness 2"],
    "opportunities": ["external opportunity 1", "external opportunity 2", "external opportunity 3"],
    "threats": ["external threat 1", "external threat 2"]
  },
  "financialProjections": {
    "purchaseScenario": {
      "acquisitionCosts": number,
      "renovationCosts": number,
      "legalFees": number,
      "totalInvestment": number,
      "closingCosts": number
    },
    "rentalScenario": {
      "monthlyRent": number,
      "annualRent": number,
      "vacancyRate": number,
      "netYield": number,
      "managementCosts": number,
      "maintenanceCosts": number
    },
    "saleScenario": {
      "year1Value": number,
      "year3Value": number,
      "year5Value": number,
      "sellingCosts": number,
      "netProfit": number,
      "annualizedReturn": number
    }
  },
  "report": {
    "executiveSummary": "4-5 sentence comprehensive summary highlighting key findings and primary recommendation",
    "strengths": ["key strength 1", "key strength 2", "key strength 3"],
    "weaknesses": ["key weakness 1", "key weakness 2"],
    "marketPosition": "detailed analysis of how this property compares to local market",
    "futureOutlook": "1-3 year forecast with specific predictions",
    "keyRisks": ["primary risk", "secondary risk", "tertiary risk"],
    "bestCase": "optimal scenario with supporting factors",
    "worstCase": "downside scenario with risk factors",
    "actionItems": [
      {
        "action": "specific action required",
        "priority": "high" | "medium" | "low",
        "timeframe": "immediate" | "short_term" | "medium_term",
        "responsible": "buyer" | "seller" | "agent" | "investor"
      }
    ],
    "fullReport": "2500+ word professional market analysis covering all aspects including local market dynamics, economic factors, demographic trends, infrastructure development, comparable analysis, risk assessment, and strategic recommendations with specific reasoning and data-backed conclusions"
  }
}

## Critical Analysis Requirements:

1. **Valuation Analysis**: Use comparative market analysis with at least 3-5 similar properties. Consider location premiums, condition, unique features, and market timing.

2. **Investment Metrics**: Calculate detailed financial metrics including IRR, NPV, cash-on-cash returns, cap rates, and risk-adjusted returns.

3. **Location Deep-Dive**: Analyze neighborhood dynamics, planned developments, demographic trends, accessibility improvements, and gentrification patterns.

4. **Risk Assessment**: Identify and quantify specific risks including market risk, liquidity risk, regulatory risk, operational risk, and concentration risk.

5. **Strategic Recommendations**: Provide actionable advice with specific timelines, conditions, success metrics, and exit strategies.

6. **Market Dynamics**: Analyze current trends, seasonal patterns, supply/demand dynamics, and future market drivers affecting this specific location and property type.

7. **Competitive Positioning**: Position this property against similar offerings and identify competitive advantages, disadvantages, and unique selling propositions.

8. **Financial Modeling**: Create realistic scenarios for purchase, rental, and resale with supporting calculations and sensitivity analysis.

9. **Due Diligence**: Identify specific areas requiring further investigation and potential red flags.

10. **Stakeholder Analysis**: Consider perspectives of different stakeholder types (first-time buyers, investors, retirees, families, etc.)

CRITICAL REQUIREMENTS:
- Be extremely specific with numbers and calculations
- Provide detailed reasoning for all assessments
- Include confidence levels for predictions
- Reference specific market data points
- Ensure recommendations are actionable and time-bound
- Consider local Spanish market regulations and tax implications
- Account for seasonal tourism patterns if applicable
- Address foreign buyer considerations if relevant

The analysis should be professional-grade suitable for institutional investors, banks, wealth managers, and sophisticated real estate professionals. Use data-driven insights and avoid generic statements.
`
}

function parseAnalysisResponse(analysis: string, propertyData: PropertyData, marketData: TavilySearchResult[]) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = analysis.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed;
    }
    
    // Fallback: create structured analysis from text
    return createFallbackAnalysis(analysis, propertyData, marketData);
    
  } catch (error) {
    console.error('Error parsing analysis:', error);
    return createFallbackAnalysis(analysis, propertyData, marketData);
  }
}

function createFallbackAnalysis(analysis: string, propertyData: PropertyData, marketData: TavilySearchResult[]) {
  // Extract estimated value from text
  const valueMatch = analysis.match(/€\s*(\d+(?:[.,]\d+)*)/);
  const estimatedValue = valueMatch ? parseInt(valueMatch[1].replace(/[.,]/g, '')) : propertyData.price;
  
  // Determine price assessment
  const priceDiff = (propertyData.price - estimatedValue) / estimatedValue;
  let priceAssessment: 'overpriced' | 'fairly_priced' | 'underpriced' = 'fairly_priced';
  
  if (priceDiff > 0.15) {
    priceAssessment = 'overpriced';
  } else if (priceDiff < -0.15) {
    priceAssessment = 'underpriced';
  }
  
  // Determine investment potential
  const analysisLower = analysis.toLowerCase();
  let potential: 'high' | 'medium' | 'low' = 'medium';
  
  if (analysisLower.includes('excellent') || analysisLower.includes('high potential') || analysisLower.includes('strong investment')) {
    potential = 'high';
  } else if (analysisLower.includes('risky') || analysisLower.includes('poor') || analysisLower.includes('low potential')) {
    potential = 'low';
  }
  
  // Extract market trend
  let marketTrend: 'up' | 'down' | 'stable' = 'stable';
  if (analysisLower.includes('rising') || analysisLower.includes('increasing') || analysisLower.includes('growing')) {
    marketTrend = 'up';
  } else if (analysisLower.includes('falling') || analysisLower.includes('declining') || analysisLower.includes('dropping')) {
    marketTrend = 'down';
  }
  
  // Extract average price per sqm from market data
  const pricePerSqmValues: number[] = [];
  marketData.forEach(result => {
    const content = `${result.title} ${result.content}`.toLowerCase();
    const matches = content.match(/€\s*(\d+(?:[.,]\d+)*)\s*\/?\s*m²/g);
    if (matches) {
      matches.forEach(match => {
        const price = parseInt(match.replace(/[€.,\s\/m²]/g, ''));
        if (price > 100 && price < 50000) {
          pricePerSqmValues.push(price);
        }
      });
    }
  });
  
  const averagePricePerSqm = pricePerSqmValues.length > 0 
    ? pricePerSqmValues.reduce((sum, price) => sum + price, 0) / pricePerSqmValues.length
    : propertyData.pricePerSqm || 0;
  
  return {
    marketData: {
      averagePricePerSqm: Math.round(averagePricePerSqm),
      priceRange: {
        min: Math.round(averagePricePerSqm * 0.8),
        max: Math.round(averagePricePerSqm * 1.2)
      },
      salesVolume: 50, // Default estimate
      daysOnMarket: 90, // Default estimate
      priceGrowth: 5, // Default estimate
      marketTrend,
      comparableListings: []
    },
    insights: {
      valuation: {
        estimatedValue,
        priceAssessment,
        confidence: 75
      },
      investment: {
        potential,
        risks: [
          'Market volatility',
          'Economic uncertainty',
          'Local competition'
        ],
        opportunities: [
          'Tourism growth',
          'Infrastructure development',
          'Market appreciation'
        ]
      },
      recommendations: {
        buyerAdvice: 'Conduct thorough due diligence and consider market timing for your purchase decision.',
        sellerAdvice: 'Price competitively based on recent comparable sales and current market conditions.',
        investorAdvice: 'Analyze rental yield potential and long-term appreciation prospects for this location.'
      }
    },
    report: {
      summary: `Property analysis for ${propertyData.location} shows ${priceAssessment} pricing with ${potential} investment potential in a ${marketTrend} market.`,
      fullReport: analysis
    }
  };
}

export async function generatePDFContent(
  analysisResult: any,
  propertyUrl: string,
  researchTopic?: string
): Promise<string> {
  try {
    const prompt = `
Generate a professional PDF-ready property analysis report based on the following data:

Property URL: ${propertyUrl}
Research Focus: ${researchTopic || 'General market analysis'}

Analysis Data:
${JSON.stringify(analysisResult, null, 2)}

Please create a comprehensive, client-ready report with:
1. Executive Summary
2. Property Overview
3. Market Analysis
4. Valuation Assessment
5. Investment Insights
6. Risk Analysis
7. Recommendations by Stakeholder
8. Appendix with Data Sources

Format the report professionally with clear sections and bullet points.
Keep it concise but comprehensive, suitable for real estate professionals and investors.
`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are a professional real estate report writer. Create formal, structured reports suitable for clients and investors.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.2
    })

    return response.choices[0].message.content || 'Report generation failed'

  } catch (error) {
    console.error('Error generating PDF content:', error)
    throw new Error('Failed to generate PDF content')
  }
} 