# Feedback System Documentation

## Overview

The feedback system allows users to rate the quality of property analysis results, helping the AI system learn and improve over time. This system is integrated into both CMA (Comparative Market Analysis) and Rental reports.

## How It Works

### User Interface
- A "Provide Feedback" button appears at the bottom right of both report displays
- Users can rate the overall analysis quality (1-5 stars)
- Users can provide detailed ratings for specific components:
  - Property Valuation
  - Comparable Properties
  - Market Analysis
  - Nearby Amenities
  - Future Outlook
  - AI Analysis Summary

### Feedback Collection
The system collects:
1. **Overall Rating**: General satisfaction with the analysis
2. **Component Ratings**: Detailed ratings for each analysis component
   - Rating: How good the information was
   - Accuracy: How accurate the data was
   - Usefulness: How helpful the information was
3. **Comments**: Optional text feedback
4. **Corrections**: Property data corrections if needed

### Learning Integration
The feedback is automatically processed by the learning system to:
- Identify areas needing improvement
- Update AI prompt optimization
- Improve comparable property selection
- Enhance regional intelligence
- Track prediction accuracy

## API Endpoints

### Submit Feedback
```
POST /api/learning/feedback
```

### Get Feedback Analytics
```
GET /api/learning/feedback?action=analytics
```

### Get Session Feedback
```
GET /api/learning/feedback?action=session&sessionId={sessionId}
```

### Get Feedback Insights
```
GET /api/learning/feedback?action=insights
```

## Benefits

### For Users
- Helps improve analysis quality for future reports
- Provides a way to report inaccurate data
- Contributes to system improvement

### For the System
- Identifies weak areas in analysis
- Improves AI prompt effectiveness
- Enhances comparable property selection
- Tracks system performance over time
- Enables data-driven improvements

## Data Storage

Feedback is stored in:
- `data/learning/user-feedback.json`
- Includes timestamps, session IDs, and detailed ratings
- Supports analytics and trend analysis

## Testing

Run the test script to verify the system:
```bash
node scripts/test-feedback-system.js
```

## Future Enhancements

Potential improvements:
- Email notifications for low-rated analyses
- Automatic retry for failed components
- Feedback-based prompt optimization
- User feedback dashboard for administrators
- Integration with property data corrections 