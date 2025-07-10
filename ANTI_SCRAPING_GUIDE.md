# Anti-Scraping Guide for Property AI Agent

This guide explains the comprehensive anti-scraping measures implemented in the Property AI Agent to handle sophisticated website protections, particularly for property listing sites like Idealista, Fotocasa, and Kyero.

## Overview

The Property AI Agent includes advanced anti-scraping technologies to ensure reliable data extraction from property websites that employ various bot detection and blocking mechanisms.

## Key Features

### 1. Rotating User Agents
- **10 realistic browser fingerprints** from Chrome, Firefox, Safari, and Edge
- **Automatic rotation** per domain to avoid detection
- **Real browser headers** with proper Accept, Language, and Encoding values

### 2. Session Management
- **Persistent sessions** per domain with cookie storage
- **Session rotation** when blocked (403/429 errors)
- **Request tracking** and rate limiting per domain

### 3. Intelligent Rate Limiting
- **Domain-specific delays**: 
  - Idealista: 2-5 seconds between requests
  - Fotocasa: 1.5-4 seconds between requests
  - Kyero: 1-3 seconds between requests
  - Generic sites: 1-2.5 seconds between requests
- **Exponential backoff** on failures
- **Automatic retry** with session rotation

### 4. Advanced Browser Fingerprinting
- **Screen resolutions** (1920x1080, 1366x768, etc.)
- **Browser languages** (en-US, es-ES, etc.)
- **Device capabilities** (memory, network speed)
- **Security headers** (Sec-Fetch-*, sec-ch-ua)

### 5. Proxy Support
- **Environment-based proxy configuration**
- **Multiple proxy endpoints** with rotation
- **HTTP/HTTPS proxy support**
- **Automatic proxy rotation** on blocking

### 6. Error Handling & Recovery
- **Intelligent error detection** (403, 429, 404, 5xx)
- **Session clearing** on blocking
- **Retry logic** with different sessions
- **Graceful degradation** on failures

## Configuration

### Environment Variables

Add these to your `.env.local` file:

```env
# Proxy Configuration (Optional)
HTTP_PROXY=http://proxy-server:port
HTTPS_PROXY=https://proxy-server:port
PROXY_1=http://proxy1:port
PROXY_2=http://proxy2:port
PROXY_3=http://proxy3:port
PROXY_4=http://proxy4:port
PROXY_5=http://proxy5:port

# Proxy Options
USE_FREE_PROXIES=false
USE_PREMIUM_PROXIES=false

# Debug Mode
DEBUG_SCRAPING=true
```

### Proxy Services (Recommended for Production)

For production use, consider these proxy services:

1. **Bright Data (formerly Luminati)**
   - Premium residential proxies
   - High success rate with property sites
   - Expensive but reliable

2. **Oxylabs**
   - High-performance datacenter and residential proxies
   - Good for large-scale scraping
   - Competitive pricing

3. **Smartproxy**
   - Rotating residential proxies
   - Good for geo-targeted scraping
   - Moderate pricing

4. **ProxyMesh**
   - Rotating datacenter proxies
   - Simple setup and usage
   - Cost-effective

5. **Scrapfly**
   - Scraping-focused proxy service
   - Built-in anti-detection
   - Easy integration

## Usage

### Basic Usage

The anti-scraping measures are automatically applied when extracting property data:

```typescript
import { extractPropertyData } from '@/lib/property-scraper'

// Automatically uses anti-scraping measures
const propertyData = await extractPropertyData('https://www.idealista.com/inmueble/...')
```

### Advanced Usage

For custom scraping outside the property scraper:

```typescript
import { antiScrapingManager } from '@/lib/anti-scraping'

// Make a request with anti-scraping measures
const response = await antiScrapingManager.makeRequest('https://example.com')

// Add custom proxies
antiScrapingManager.addProxy('http://proxy-server:port')

// Clear sessions to force rotation
antiScrapingManager.clearSessions()

// Get session information
const sessionInfo = antiScrapingManager.getSessionInfo('idealista.com')
```

## How It Works

### 1. Request Flow
1. **URL Analysis**: Determine target domain and apply domain-specific settings
2. **Session Management**: Get or create session for domain
3. **Rate Limiting**: Enforce delays based on domain and last request
4. **Header Building**: Generate realistic browser headers with session data
5. **Proxy Selection**: Choose proxy from pool (if available)
6. **Request Execution**: Make request with full anti-detection measures
7. **Response Processing**: Handle cookies, errors, and session rotation

### 2. Anti-Detection Measures
- **Realistic browser fingerprints** matching real user behavior
- **Consistent session data** across requests
- **Proper cookie handling** and persistence
- **Variable request timing** to avoid pattern detection
- **Header consistency** matching selected user agent
- **Proxy rotation** to avoid IP-based blocking

### 3. Error Handling
- **403 Forbidden**: Session rotation and retry
- **429 Too Many Requests**: Increased delay and retry
- **404 Not Found**: Property-specific error (listing removed)
- **5xx Server Errors**: Retry with backoff
- **Network Errors**: Proxy rotation and retry

## Best Practices

### 1. Respectful Scraping
- **Respect robots.txt** files
- **Use reasonable delays** between requests
- **Don't overwhelm servers** with concurrent requests
- **Monitor your usage** and adjust as needed

### 2. Production Deployment
- **Use paid proxy services** for reliability
- **Configure multiple proxies** for redundancy
- **Monitor success rates** and adjust settings
- **Implement proper logging** for debugging

### 3. Legal Compliance
- **Check terms of service** for each website
- **Respect rate limits** and blocking measures
- **Use data responsibly** and ethically
- **Consider API alternatives** when available

## Troubleshooting

### Common Issues

1. **403 Forbidden Errors**
   - Check if proxies are configured
   - Verify user agent is recent
   - Ensure cookies are being handled
   - Try clearing sessions

2. **429 Too Many Requests**
   - Increase delay between requests
   - Use more proxies
   - Implement longer backoff periods
   - Check if rate limits are being respected

3. **Connection Timeouts**
   - Increase timeout values
   - Check proxy connectivity
   - Verify network connectivity
   - Monitor server response times

4. **Inconsistent Results**
   - Check for JavaScript-rendered content
   - Verify selectors are still valid
   - Monitor for site structure changes
   - Implement fallback extraction methods

### Debug Mode

Enable debug mode for detailed logging:

```env
DEBUG_SCRAPING=true
```

This will provide detailed logs of:
- Session creation and rotation
- Request headers and timing
- Proxy usage and rotation
- Error details and retry attempts
- Success/failure rates

## Monitoring

### Key Metrics to Track

1. **Success Rate**: Percentage of successful requests
2. **Average Response Time**: Time per request
3. **Error Distribution**: Types and frequency of errors
4. **Session Rotation Rate**: How often sessions are rotated
5. **Proxy Performance**: Success rate per proxy

### Logging

The system provides comprehensive logging for monitoring:

```
Created new session for idealista.com: Mozilla/5.0... (1920x1080, en-US)
Rate limiting: waiting 3245ms for idealista.com
Making request to idealista.com (attempt 1)
Success! Status: 200
403 Forbidden - session will be rotated, retrying...
Clearing sessions due to blocking
```

## Future Enhancements

### Planned Features

1. **CAPTCHA Solving**: Integration with CAPTCHA solving services
2. **JavaScript Rendering**: Headless browser support for SPA sites
3. **Machine Learning**: Adaptive anti-detection based on success rates
4. **Distributed Scraping**: Multiple server coordination
5. **Advanced Analytics**: Success rate optimization and reporting

### Contributing

If you encounter issues or have suggestions for improving the anti-scraping measures:

1. **Report Issues**: Provide detailed logs and error messages
2. **Suggest Improvements**: Share successful configurations
3. **Submit PRs**: Contribute enhancements and bug fixes
4. **Share Insights**: Help improve detection avoidance

## Legal Notice

This anti-scraping system is designed to facilitate legitimate data collection for business purposes. Users are responsible for:

- Complying with website terms of service
- Respecting robots.txt files
- Following applicable laws and regulations
- Using data ethically and responsibly

The developers assume no responsibility for misuse of this system or violations of website terms of service. 