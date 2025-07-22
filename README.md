# AI Property Research Agent

An advanced property market analysis platform that provides AI-powered market analysis, comparables research, and comprehensive property reports.

## Features

- **Session Management**: Support for multiple concurrent users with unique session URLs
- **Property Display**: Beautiful interface showing property details, images, and specifications
- **Market Analysis**: AI-powered market value estimation and trend analysis
- **Comparables Analysis**: Find and analyze similar properties in the market
- **Report Generation**: Create comprehensive, printable property analysis reports
- **Real-time Updates**: Live session status updates and analysis progress

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- API keys for OpenAI, Google Maps, and Tavily (optional for full functionality)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ai-property-research-agent
```

2. Install dependencies:
```bash
npm install
```

3. Create environment file:
```bash
cp .env.example .env.local
```

4. Add your API keys to `.env.local`:
```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

### Running the Application

1. Start both server and client:
```bash
npm run dev
```

2. Or run them separately:
```bash
# Terminal 1 - Start the listener server
npm run server

# Terminal 2 - Start the Next.js frontend
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- API Server: http://localhost:3004

## API Usage

### Send Property Data

Send a POST request to create a new analysis session:

```bash
curl -X POST http://localhost:3004/api/send_property_data \
  -H "Content-Type: application/json" \
  -d '{
    "id": 102,
    "is_sale": true,
    "reference": "PL0102",
    "price": 450000,
    "bedrooms": 3,
    "bathrooms": 2,
    "build_square_meters": 108,
    "property_type": 0,
    "city_id": 2,
    "suburb_id": 120,
    "images": [...]
  }'
```

Response:
```json
{
  "success": true,
  "sessionId": "uuid-here",
  "sessionUrl": "http://localhost:3000/?session=uuid-here",
  "message": "Property data received and session created successfully"
}
```

### Get Session Data

```bash
curl http://localhost:3004/api/session/{sessionId}
```

### Update Session Status

```bash
curl -X PUT http://localhost:3004/api/session/{sessionId}/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "analysis_complete",
    "data": {...}
  }'
```

## Property Data Format

The system accepts property data in the following format:

```json
{
  "id": 102,
  "is_sale": true,
  "reference": "PL0102",
  "price": 450000,
  "bedrooms": 3,
  "bathrooms": 2,
  "build_square_meters": 108,
  "plot_square_meters": null,
  "terrace_square_meters": null,
  "parking_spaces": 2,
  "furnished": false,
  "property_type": 0,
  "city_id": 2,
  "suburb_id": 120,
  "urbanization_name": "",
  "floor_number": 2,
  "ibi": 1900,
  "basura": 150,
  "community_fees": 250,
  "energy_rating": "B",
  "feature_ids": [27, 33, 36, 38, 39, 41, 42, 43, 47, 51, 58, 61, 62, 65, 76, 78, 83, 87, 91, 94, 98, 102, 103, 131, 134, 140, 155],
  "images": [
    {
      "id": 1306,
      "small": "https://...",
      "medium": "https://..."
    }
  ]
}
```

## Architecture

### Backend (Express.js)
- **Port**: 3004
- **Session Management**: In-memory storage with file persistence
- **API Endpoints**: RESTful API for property data and session management
- **File Storage**: JSON files for session data persistence

### Frontend (Next.js)
- **Port**: 3000
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **Components**: Modular React components for property display and analysis

### Key Components

1. **PropertyDisplay**: Shows property images, details, and specifications
2. **AnalysisPanel**: Tabbed interface for different analysis types
3. **MarketAnalysis**: AI-powered market value estimation
4. **ComparablesAnalysis**: Similar property search and analysis
5. **ReportGenerator**: PDF report generation (JSON for now)

## Development

### Project Structure

```
ai-property-research-agent/
├── app/                    # Next.js app directory
│   ├── components/        # React components
│   ├── globals.css       # Global styles
│   ├── layout.js         # Root layout
│   └── page.js           # Main page
├── server/               # Express.js server
│   └── listener.js       # Main server file
├── data/                 # Session data storage
├── package.json          # Dependencies and scripts
├── next.config.js        # Next.js configuration
├── tailwind.config.js    # Tailwind CSS configuration
└── README.md            # This file
```

### Available Scripts

- `npm run dev`: Start both server and client in development mode
- `npm run server`: Start only the Express.js server
- `npm run client`: Start only the Next.js frontend
- `npm run build`: Build the Next.js application
- `npm run start`: Start the production server
- `npm run lint`: Run ESLint

## Testing

### Test Property Data

Use the provided test script to send sample property data:

```bash
node test/send-test-data.js
```

### Manual Testing

1. Start the application
2. Send property data via API
3. Open the returned session URL in browser
4. Test different analysis features
5. Generate and download reports

## Production Deployment

### Environment Variables

Set the following environment variables for production:

```env
NODE_ENV=production
PORT=3004
OPENAI_API_KEY=your_production_openai_key
GOOGLE_MAPS_API_KEY=your_production_google_maps_key
TAVILY_API_KEY=your_production_tavily_key
```

### Build and Deploy

```bash
npm run build
npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For support and questions, please open an issue on GitHub or contact the development team. 