# Security Documentation

## API Token Authentication

The PropertyList Research Agent uses a secure API token-based authentication system to protect the `/api/property-analysis` endpoint. This provides robust security without requiring a user login system.

## 🔐 How It Works

### Authentication Flow
1. **Token Generation**: Secure random tokens are generated using cryptographically secure methods
2. **Header Validation**: Each API request must include a valid Bearer token in the Authorization header
3. **Constant-Time Comparison**: Token validation uses constant-time comparison to prevent timing attacks
4. **Rate Limiting**: Built-in rate limiting prevents abuse (10 requests per 15 minutes per IP)

### Request Format
```javascript
fetch('/api/property-analysis', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_TOKEN_HERE'
  },
  body: JSON.stringify(propertyData)
})
```

## 🛠️ Setup Instructions

### 1. Generate API Token
Run the token generator script:
```bash
node scripts/generate-token.js
```

This will:
- Generate secure random tokens of different strengths
- Create or update your `.env.local` file
- Provide setup instructions

### 2. Environment Variables
Add these variables to your `.env.local` file:
```env
# API Authentication
API_TOKEN=your_secure_token_here
NEXT_PUBLIC_API_TOKEN=your_secure_token_here

# External API Keys
OPENAI_API_KEY=your_openai_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_key_here

TAVILY_API_KEY=your_tavily_key_here

```

### 3. Restart Application
```bash
npm run dev
```

## 🔒 Security Features

### Token Validation
- **Bearer Token Format**: Standard `Authorization: Bearer <token>` header
- **Constant-Time Comparison**: Prevents timing attacks during validation
- **Environment-Based**: Tokens stored securely in environment variables
- **No Database Required**: Stateless authentication system

### Rate Limiting
- **IP-Based Limiting**: 10 requests per 15-minute window per IP address
- **Automatic Cleanup**: Expired rate limit entries are automatically cleaned up
- **Configurable**: Easy to adjust limits for different environments

### Error Handling
- **Secure Error Messages**: No sensitive information exposed in error responses
- **Proper HTTP Status Codes**: 
  - `401 Unauthorized`: Invalid or missing token
  - `429 Too Many Requests`: Rate limit exceeded
  - `400 Bad Request`: Invalid request data

## 🚨 Security Best Practices

### Token Management
1. **Use Strong Tokens**: Minimum 32 characters, preferably 64 for production
2. **Keep Tokens Secret**: Never commit tokens to version control
3. **Environment-Specific**: Use different tokens for dev/staging/production
4. **Regular Rotation**: Regenerate tokens periodically
5. **Secure Storage**: Store in environment variables, not in code

### Production Deployment
1. **HTTPS Only**: Always use HTTPS in production
2. **Environment Variables**: Set tokens via hosting platform's environment settings
3. **Rate Limiting**: Consider using Redis for distributed rate limiting
4. **Monitoring**: Log authentication failures for security monitoring
5. **Firewall**: Consider additional IP-based restrictions if needed

### Network Security
- **CORS Configuration**: Properly configured for your domain
- **Headers**: Secure headers implemented (CSP, HSTS, etc.)
- **Input Validation**: All inputs validated and sanitized
- **Error Handling**: No sensitive data exposed in error messages

## 🔧 Development vs Production

### Development
- Use the generated token from the script
- Rate limits can be more permissive
- Detailed error logging enabled

### Production
- Use 64-character cryptographically secure tokens
- Implement stricter rate limits
- Enable comprehensive security monitoring
- Consider additional security layers (WAF, DDoS protection)

## 📋 API Endpoints Security

### Protected Endpoints
- `POST /api/property-analysis` - Requires valid API token

### Public Endpoints
- `GET /api/health` - Health check (no authentication required)
- `GET /api/status` - Service status (no authentication required)

## 🛡️ Implementation Details

### Authentication Middleware
Located in `src/lib/auth.ts`:
- `validateApiToken()` - Validates Bearer tokens
- `checkRateLimit()` - IP-based rate limiting
- `generateApiToken()` - Secure token generation

### Frontend Integration
The React frontend automatically includes the token from `NEXT_PUBLIC_API_TOKEN` environment variable in all API requests to protected endpoints.

### Error Responses
```json
// Invalid token
{
  "error": "Unauthorized",
  "details": "Invalid API token"
}

// Rate limit exceeded
{
  "error": "Too many requests. Please try again later."
}
```

## 🔄 Token Rotation

To rotate your API token:
1. Run `node scripts/generate-token.js` to generate a new token
2. Update both `API_TOKEN` and `NEXT_PUBLIC_API_TOKEN` in your environment
3. Restart your application
4. Update any external clients with the new token

## 📞 Support

If you encounter any security issues or have questions about the authentication system, please refer to this documentation or check the implementation in:
- `src/lib/auth.ts` - Authentication utilities
- `src/app/api/property-analysis/route.ts` - Protected endpoint implementation
- `scripts/generate-token.js` - Token generation utility

---

**Remember**: Security is only as strong as your weakest link. Always follow security best practices and keep your tokens secure! 