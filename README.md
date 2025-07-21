# Property Analysis AI Agent

A comprehensive AI-powered property analysis system for the Spanish real estate market, providing detailed CMA reports, rental analysis, and market insights.

**Latest Update**: Enhanced with comprehensive features including XML feed processing, session management, and advanced AI analysis.

## 🏠 Features

### Core Analysis
- **CMA Reports**: Comprehensive Comparative Market Analysis with PDF generation
- **Rental Analysis**: Detailed rental market analysis and ROI calculations
- **Market Insights**: Real-time market data and trends
- **Property Valuation**: AI-powered valuation engine with multiple methodologies

### Data Integration
- **XML Feed Processing**: Real-time property data from PropertyList.es
- **Market Data Sources**: Integration with INE, Catastro, and local market data
- **Geocoding**: Google Maps integration for precise location analysis
- **Image Processing**: Automatic property image handling and optimization

### AI & Learning
- **Progressive Learning**: System learns from user feedback and market changes
- **Smart Comparables**: AI-selected comparable properties
- **Regional Intelligence**: Location-based market knowledge
- **Cost Optimization**: Intelligent API usage to minimise costs

### Technical Features
- **Session Management**: Multi-user session handling
- **Caching System**: Intelligent data caching for performance
- **Feedback System**: User feedback collection and analysis
- **Debug Tools**: Comprehensive debugging and monitoring

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- API Keys (OpenAI, Google Maps, Tavily)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-agent
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create `.env.local` with:
   ```env
   OPENAI_API_KEY=your_openai_key
   GOOGLE_MAPS_API_KEY=your_google_maps_key
   TAVILY_API_KEY=your_tavily_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Start the listener server**
   ```bash
   node server/listener.js
   ```

## 📁 Project Structure

```
ai-agent/
├── src/
│   ├── app/                 # Next.js app router
│   ├── components/          # React components
│   ├── lib/                 # Core libraries
│   └── types/              # TypeScript definitions
├── server/                 # Backend services
├── scripts/                # Utility scripts
├── data/                   # Data storage and cache
└── public/                 # Static assets
```

## 🔧 Configuration

### Environment Variables
- `OPENAI_API_KEY`: OpenAI API key for AI analysis
- `GOOGLE_MAPS_API_KEY`: Google Maps API key for geocoding
- `TAVILY_API_KEY`: Tavily API key for web research
- `PORT`: Server port (default: 3000)
- `LISTENER_PORT`: Listener server port (default: 3004)

### API Endpoints
- `/api/property-analysis`: Main property analysis endpoint
- `/api/generate-cma`: CMA report generation
- `/api/generate-pdf`: PDF report generation
- `/api/session/create`: Session management
- `/api/health`: Health check endpoint

## 🏗️ Development Workflow

### Branching Strategy
- `main`: Production-ready code
- `development`: Development and testing
- `feature/*`: Feature branches

### Making Changes
1. Create a feature branch: `git checkout -b feature/new-feature`
2. Make your changes
3. Test thoroughly
4. Commit with descriptive messages
5. Push and create a pull request

### Testing
```bash
# Run tests
npm test

# Run development server
npm run dev

# Build for production
npm run build
```

## 📊 Monitoring & Analytics

### Performance Monitoring
- API response times
- Cost tracking per analysis
- Cache hit rates
- User feedback analysis

### Debug Tools
- `/debug`: Debug dashboard
- `/debug-tavily`: Tavily API testing
- `/debug-steps`: Step-by-step analysis

## 🔒 Security

- API key protection
- Rate limiting
- Input validation
- Secure PDF generation
- Session management

## 📈 Deployment

### Local Development
```bash
npm run dev          # Next.js development server
node server/listener.js  # Backend listener server
```

### Production
```bash
npm run build        # Build for production
npm start           # Start production server
```

### Environment Setup
1. Set production environment variables
2. Configure database connections
3. Set up monitoring and logging
4. Configure backup systems

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:
- Check the documentation in `/docs`
- Review existing issues
- Create a new issue with detailed information

## 🔄 Updates

### Recent Updates
- Enhanced XML feed processing
- Improved cost optimization
- Better error handling
- Enhanced user feedback system

### Planned Features
- Mobile app integration
- Advanced analytics dashboard
- Multi-language support
- Enhanced AI models

---

**Built with Next.js, TypeScript, and AI-powered analysis** 