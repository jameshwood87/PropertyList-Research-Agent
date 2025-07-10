# Property AI Agent

A full-stack AI-powered property market research and analysis tool built with Next.js. This application analyzes property listings, conducts market research, and generates comprehensive reports for real estate professionals and investors.

## Features

- 🏠 **Property Data Extraction**: Scrapes property listings from major Spanish portals (Idealista, Fotocasa, Kyero)
- 🔍 **Market Research**: Uses Tavily API to gather market trends, comparable properties, and local news
- 🧠 **AI Analysis**: Leverages OpenAI GPT-4 to generate comprehensive market insights and valuations
- 📊 **Professional Reports**: Creates client-ready PDF reports with investment recommendations
- 🎯 **Step-by-step Workflow**: Transparent process with real-time progress tracking
- 💰 **Price Analysis**: Fair market value estimation with confidence scoring
- 📈 **Investment Insights**: Risk assessment and opportunity identification

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o
- **Web Search**: Tavily API
- **PDF Generation**: jsPDF
- **Web Scraping**: Axios + Cheerio
- **Icons**: Lucide React

## Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key
- Tavily API key

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd property-ai-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   TAVILY_API_KEY=your_tavily_api_key_here
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open the application**
   Visit [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Basic Analysis

1. **Enter Property URL**: Paste a property listing URL from supported portals
2. **Optional Research Focus**: Specify what aspects to emphasize (e.g., "investment potential", "rental yield")
3. **Start Analysis**: Click "Start Analysis" to begin the automated research process

### Supported Property Portals

- **Idealista.com**: Spain's leading property portal
- **Fotocasa.es**: Major Spanish real estate platform
- **Kyero.com**: International property listings
- **Generic sites**: Basic extraction for other property websites

### Example URLs

```
https://www.idealista.com/inmueble/12345678/
https://www.fotocasa.es/vivienda/barcelona/12345
https://www.kyero.com/property/spain/12345
```

## API Endpoints

### POST /api/analyze
Analyzes a property listing and generates comprehensive market research.

**Request Body:**
```json
{
  "url": "https://www.idealista.com/inmueble/12345678/",
  "topic": "investment potential"
}
```

**Response:**
```json
{
  "propertyData": { ... },
  "marketData": { ... },
  "insights": { ... },
  "report": { ... },
  "steps": [ ... ]
}
```

### POST /api/generate-pdf
Generates a PDF report from analysis results.

**Request Body:**
```json
{
  "result": { ... },
  "propertyUrl": "https://...",
  "researchTopic": "investment potential"
}
```

**Response:** PDF file download

## Agent Workflow

The AI agent follows a systematic 5-step process:

1. **🏠 Extract Property Data**
   - Scrapes listing page for key information
   - Extracts price, size, location, features, etc.
   - Formats data for efficient AI processing

2. **🔍 Market Research**
   - Searches for comparable properties
   - Gathers market trends and statistics
   - Collects pricing data and market conditions

3. **📰 Local News & Trends**
   - Searches for local market news
   - Identifies development projects and zoning changes
   - Analyzes tourism and investment impacts

4. **🧠 AI Analysis**
   - Generates valuation estimates
   - Assesses investment potential and risks
   - Creates recommendations for different stakeholders

5. **📄 Generate Report**
   - Produces comprehensive market analysis
   - Creates client-ready PDF reports
   - Provides actionable insights and recommendations

## Project Structure

```
property-ai-agent/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   └── generate-pdf/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── PropertyAnalyzer.tsx
│   ├── lib/
│   │   ├── openai.ts
│   │   ├── property-scraper.ts
│   │   ├── tavily.ts
│   │   └── utils.ts
│   └── types/
│       └── index.ts
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── next.config.js
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | OpenAI API key for GPT-4 analysis | Yes |
| `TAVILY_API_KEY` | Tavily API key for web search | Yes |

## Features in Detail

### Property Data Extraction
- Supports multiple property portals with custom extractors
- Handles various property types (apartments, villas, townhouses)
- Extracts comprehensive data including price, size, location, features
- Fallback generic extraction for unknown sites

### Market Research
- Searches prioritized domains for relevant market data
- Filters results by relevance score
- Deduplicates and ranks search results
- Extracts price trends and market statistics

### AI Analysis
- Professional real estate analyst persona
- Structured JSON output for consistent processing
- Fallback text parsing for robust operation
- Confidence scoring for valuation estimates

### Report Generation
- Multi-page PDF reports with professional formatting
- Executive summary and detailed analysis
- Stakeholder-specific recommendations
- Market data visualization and trends

## Customization

### Adding New Property Portals
1. Update `src/lib/property-scraper.ts`
2. Add new extraction function for the portal
3. Update the portal detection logic
4. Test with sample URLs

### Modifying AI Prompts
1. Edit `src/lib/openai.ts`
2. Update the `createAnalysisPrompt` function
3. Adjust system prompts for different analysis styles
4. Test with various property types

### Custom Search Domains
1. Update `src/lib/tavily.ts`
2. Modify the `include_domains` arrays
3. Add region-specific news sources
4. Test search result quality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
- Create an issue in the GitHub repository
- Check the documentation for common problems
- Review API key configuration if experiencing authentication errors

## Roadmap

- [ ] Support for additional property portals
- [ ] Multi-language support
- [ ] Advanced chart generation
- [ ] Historical price analysis
- [ ] Email report delivery
- [ ] Saved analysis dashboard
- [ ] Batch analysis for multiple properties
- [ ] API rate limiting and caching
- [ ] Mobile-responsive design improvements 