# Location Learning Engine

## Overview

The Location Learning Engine is an intelligent system that automatically learns geographic relationships and urbanisation patterns from property analyses. It improves comparable property selection over time by understanding which areas are frequently found together and discovering new urbanisations automatically.

## Key Features

### 1. **Location Relationship Learning**
- Tracks which areas are frequently found together in comparable searches
- Learns **type-specific relationships** (streets with streets, urbanisations with urbanisations, etc.)
- Builds confidence scores based on frequency and recency
- Automatically cleans up old, low-confidence relationships
- **Prevents cross-type contamination** (e.g., streets never match with urbanisations)

### 2. **Dynamic Urbanisation Discovery**
- Automatically identifies new urbanisations from property addresses
- Learns common street names associated with each urbanisation
- Tracks urbanisation aliases and variations
- Builds confidence scores for discovered urbanisations

### 3. **Geographic Cluster Analysis**
- Groups areas that frequently appear together in analyses
- Identifies geographic clusters and their centers
- Tracks cluster frequency and member relationships
- Merges overlapping clusters automatically

### 4. **Intelligent Fallback System**
- Uses learned relationships for better comparable selection
- Falls back to hardcoded relationships when no learned data exists
- Gracefully handles missing or incomplete data
- Maintains system reliability during learning phase

## How It Works

### Learning Process

1. **Analysis Trigger**: Every property analysis triggers the learning engine
2. **Location Extraction**: Extracts location components from target and comparable properties
3. **Pattern Recognition**: Identifies urbanisation patterns and street associations
4. **Relationship Building**: Creates relationships between frequently co-occurring areas
5. **Cluster Formation**: Groups related areas into geographic clusters
6. **Data Persistence**: Saves learned data for future use

### Location Component Extraction

The system extracts these components from property addresses:

- **Urbanisations**: "Nueva Andalucía", "Puerto Banús", "Golden Mile"
- **Streets**: "Calle Benahavis", "Avenida del Mar", "Paseo Marítimo"
- **Suburbs**: "Centro", "Old Town", "Playa"
- **Cities**: "Marbella", "Estepona", "Benahavís"

### Confidence Scoring

- **Frequency**: More frequent relationships get higher confidence
- **Recency**: Recent relationships are weighted more heavily
- **Decay**: Old relationships lose confidence over time (30-day decay)
- **Threshold**: Only relationships with confidence > 0.3 are used

## Implementation Details

### File Structure

```
src/lib/learning/
├── location-learning-engine.ts    # Main learning engine
└── location-learning.json         # Learned data storage

scripts/
├── test-location-learning.js      # Test current learning state
└── test-location-learning-with-analysis.js  # Simulate learning process
```

### Data Storage

The learning engine stores data in `data/learning/location-learning.json`:

```json
{
  "relationships": [
    {
      "sourceArea": "benahavis",
      "targetArea": "nueva andalucia",
      "relationshipType": "urbanisation",
      "frequency": 15,
      "lastSeen": "2025-07-19T23:00:00.000Z",
      "confidence": 0.8
    }
  ],
  "urbanisations": [
    {
      "name": "benahavis",
      "aliases": ["benahavís"],
      "frequency": 25,
      "firstSeen": "2025-07-15T10:00:00.000Z",
      "lastSeen": "2025-07-19T23:00:00.000Z",
      "commonStreets": ["calle benahavis"],
      "nearbyAreas": ["nueva andalucia", "artola"],
      "confidence": 0.9
    }
  ],
  "clusters": [
    {
      "centerArea": "benahavis",
      "memberAreas": ["benahavis", "nueva andalucia", "artola", "cabopino"],
      "averageDistance": 2.5,
      "frequency": 8,
      "lastUpdated": "2025-07-19T23:00:00.000Z"
    }
  ],
  "analysisCount": 45,
  "lastUpdated": "2025-07-19T23:00:00.000Z"
}
```

### Integration Points

#### Feed Integration (`src/lib/feeds/feed-integration.ts`)

```typescript
// Learn from each analysis
locationLearningEngine.learnFromAnalysis(propertyData, comparableData)

// Use learned relationships for better search
const learnedNearby = locationLearningEngine.getNearbyAreas(urbanisation, 'urbanisation')
```

#### Location Hierarchy Filtering

The system implements **strict type-specific location hierarchy** to ensure accurate comparable selection:

1. **Tier 1**: Same Street (exact street name matches only)
2. **Tier 2**: Same Urbanisation (exact urbanisation matches only)
3. **Tier 3**: Same Suburb (exact suburb matches only)
4. **Tier 4**: Nearby Urbanisations (learned + hardcoded relationships)
5. **Tier 5**: Same City (exact city matches only)
6. **Tier 6**: Broader Search (fallback only)

**Key Principle**: Each tier only compares the same location type to prevent incorrect cross-type matches (e.g., "Calle Benahavis" will never match "Benahavis city").

## Benefits

### Immediate Benefits

- **Better Comparable Selection**: Uses learned relationships to find more relevant comparables
- **Strict Type-Specific Filtering**: Prevents incorrect cross-type matches (streets vs urbanisations)
- **Automatic Discovery**: Discovers new urbanisations without manual configuration
- **Improved Accuracy**: Geographic relationships become more accurate over time
- **Fallback Safety**: Maintains system reliability with hardcoded fallbacks

### Long-term Benefits

- **Self-Improving System**: Gets better with each analysis
- **Market Intelligence**: Builds comprehensive knowledge of property market geography
- **Scalability**: Can handle new areas and markets automatically
- **Data-Driven Insights**: Provides insights into market relationships and patterns

## Testing and Monitoring

### Test Scripts

```bash
# Check current learning state
node scripts/test-location-learning.js

# Simulate learning process
node scripts/test-location-learning-with-analysis.js
```

### Monitoring Metrics

- **Total Analyses**: Number of analyses processed
- **Total Relationships**: Number of learned relationships
- **Total Urbanisations**: Number of discovered urbanisations
- **Total Clusters**: Number of geographic clusters
- **Confidence Distribution**: Quality of learned relationships

### Performance Considerations

- **Memory Usage**: Limited to 1000 relationships and 500 urbanisations
- **Storage**: JSON file with automatic cleanup of old data
- **Processing Time**: Minimal impact on analysis performance
- **Fallback**: Graceful degradation when learning engine unavailable

## Future Enhancements

### Planned Features

1. **Geographic Distance Learning**: Learn actual geographic distances between areas
2. **Market Segmentation**: Learn which areas are comparable in terms of market value
3. **Seasonal Patterns**: Learn seasonal variations in area relationships
4. **User Feedback Integration**: Incorporate user feedback to improve learning
5. **Cross-Market Learning**: Apply learned patterns to new markets

### Advanced Analytics

- **Market Clustering**: Identify market segments based on geographic patterns
- **Price Correlation**: Learn price relationships between areas
- **Demand Patterns**: Understand demand patterns across geographic areas
- **Investment Hotspots**: Identify emerging investment areas

## Usage Examples

### Basic Usage

The learning engine works automatically - no manual intervention required:

```typescript
// Automatically called during property analysis
const comparables = await FeedIntegration.getComparableListings(propertyData)
// Learning happens automatically in the background
```

### Advanced Usage

```typescript
// Get learned nearby areas
const nearbyAreas = locationLearningEngine.getNearbyAreas('benahavis', 'urbanisation')

// Get learning statistics
const stats = locationLearningEngine.getLearningStats()

// Export learning data for analysis
const data = locationLearningEngine.exportLearningData()
```

## Conclusion

The Location Learning Engine transforms the property analysis system from a static, rule-based system into an intelligent, self-improving platform. By learning from every analysis, it continuously improves comparable selection accuracy and discovers new market insights automatically.

The system maintains reliability through intelligent fallbacks while providing increasingly sophisticated geographic intelligence over time. This creates a virtuous cycle where better comparables lead to better learning, which leads to even better comparables. 