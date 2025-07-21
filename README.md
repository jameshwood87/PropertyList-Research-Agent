# PropertyList Research Agent

A modern, AI-powered web application for generating Comparative Market Analysis (CMA) reports for real estate properties.

## Features

- **Modern UI Design**: Clean, minimalistic interface with soft shadows and rounded corners
- **Property Input Form**: Comprehensive form for entering property details
- **Real-time Progress Tracking**: Visual progress panel showing analysis steps
- **API Status Monitoring**: Live status indicators for external APIs
- **CMA Report Generation**: Automated property valuation and market analysis with real data only
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **No Mock Data**: System uses only authentic market data from XML feeds and external APIs

## Technology Stack

- **Frontend**: React 18, Next.js 14
- **Styling**: Tailwind CSS
- **TypeScript**: Full type safety
- **Icons**: Lucide React
- **APIs**: Comprehensive real estate data integration

### API Integrations

- **Google Maps API**: Geolocation and nearby amenities
- **Property Feed Database**: Market data, comparable property listings from XML feeds
- **Tavily API**: Future developments and neighborhood insights
- **OpenAI API**: AI-powered analysis and recommendations

### Official Spanish Data Sources

The system integrates official Spanish government data sources for maximum accuracy and reliability:

- **INE - Instituto Nacional de Estadística**: Official Spanish statistics including housing market data
- **Catastro - Dirección General del Catastro**: Official property registry with cadastral data
- **Junta de Andalucía - Datos Abiertos**: Regional government open data and planning information
- **Estadísticas de Criminalidad - Ministerio del Interior**: Official crime statistics and safety data
- **Sede Catastro**: Property data consultation and cadastral information

These official sources are prioritized over commercial data for critical market analysis and valuation.

## Getting Started

### Prerequisites

- Node.js 16+ 
- npm or yarn
- API keys for external services (see Environment Variables)

### Environment Variables

Create a `.env.local` file in the root directory:

```bash
# Google Maps and Places API
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here

# Tavily API for web search
TAVILY_API_KEY=your_tavily_api_key_here

# OpenAI API
OPENAI_API_KEY=your_openai_api_key_here

# Base URLs (optional)
TAVILY_BASE_URL=https://api.tavily.com/v1
```

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables (see above)

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

```bash
npm run build
npm start
```

## Usage

1. **Enter Property Details**: Fill out the comprehensive property form with:
   - Address information
   - Property specifications (bedrooms, bathrooms, square footage)
   - Property type and features
   - Pricing information (asking price, date listed)
   - Additional details

2. **Generate Property Analysis**: Click "Generate Property Analysis" to start the comprehensive analysis process

3. **Monitor Real-Time Progress**: Watch the 6-step analysis process:
   - 🔄 **Geolocation, Amenities & Walkability**: Google Maps API for coordinates and nearby facilities, Walk Score API for walkability ratings
   - 🔄 **Market & Historical Trends**: Property feed database + Tavily web research for pricing data and trends
   - 🔄 **Comparable Listings**: Property feed database for similar properties
   - 🔄 **Future Developments**: Tavily API for urban planning projects
   - 🔄 **Neighborhood Insights**: Tavily API for investment trends and safety
   - 🔄 **AI Summary Generation**: OpenAI for comprehensive analysis and recommendations

4. **Review Comprehensive Report**: The final report includes:
   - 📋 Executive Summary with AI insights
   - 💰 Detailed Valuation Estimate
   - 📈 Market Trends and Historical Data
   - 🏘️ Comparable Properties Analysis
   - 🏪 Nearby Amenities with ratings
   - 🚶 Walkability & Transportation Scores
   - 🚧 Future Development Impact Analysis

5. **View API Status**: Check the live API status panel for service connectivity

## API Endpoints

- `POST /api/property-analysis` - Comprehensive property analysis using multiple APIs

## Analysis Process

The system uses a sophisticated 6-step process:

### 1. Geolocation & Amenities
- Uses Google Maps API to get precise coordinates
- Finds nearby schools, shopping centers, transport, healthcare, recreation, and dining
- Calculates distances and retrieves ratings

### 2. Market & Historical Trends
- **Official Spanish Sources**: INE, Catastro, Junta de Andalucía for official market statistics and cadastral data
- **Property Feed Database**: Analyzes current €/m² prices and market statistics from comparable properties
- **Tavily Web Research**: Searches for historical trends, market reports, and investment insights with priority on official sources
- **Combined Analysis**: Determines market trends based on official government data plus commercial market research

### 3. Comparable Listings
   - Uses property feed database for similar properties
- Finds 5-10 comparable listings by type, size, and location
- Calculates adjusted pricing based on differences

### 4. Future Developments
- Tavily API searches for urban planning projects
- Identifies infrastructure investments
- Analyzes impact on property values

### 5. Neighborhood Insights
- **Official Crime Statistics**: Ministerio del Interior data for neighborhood safety assessment
- **INE Demographics**: Official population and demographic data
- **Regional Government Data**: Junta de Andalucía statistics for regional context
- **General Analysis**: Searches for real estate investment trends and foreign investment patterns

### 6. AI Summary Generation
- OpenAI processes all gathered data
- Generates executive summary and recommendations
- Provides investment analysis and price forecasts
- Creates pros/cons analysis and market comparison

### Smart Search Feature
The system uses AI to generate dynamic search queries based on property characteristics, enabling self-directed research for comprehensive analysis.

## Color Scheme

- Primary: #00ae9a (Teal/Turquoise)
- Primary Light: #00c5ad
- Primary Dark: #009688

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── generate-cma/
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ApiStatusPanel.tsx
│   ├── Header.tsx
│   ├── ProgressPanel.tsx
│   └── PropertyForm.tsx
└── types/
    └── index.ts
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is proprietary software for PropertyList Research Agent. 