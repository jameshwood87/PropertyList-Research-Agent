# 🐳 Docker Deployment Guide

## Overview

This guide shows you how to deploy the AI Property Research Agent using Docker. This approach is much better than Vercel because:

- ✅ **Full Stack Support**: Runs Express backend + Next.js frontend together
- ✅ **Database Included**: PostgreSQL with PostGIS for location data
- ✅ **Redis Caching**: Fast data caching and session storage
- ✅ **Elasticsearch**: Advanced property search capabilities
- ✅ **Easy Deployment**: Deploy to any cloud platform that supports Docker

## Quick Start

### 1. **Setup Environment Variables**

```bash
# Copy the environment template
cp env.example .env.local

# Edit with your actual API keys
notepad .env.local  # Windows
nano .env.local     # Linux/Mac
```

**Required API Keys:**
- OpenAI API Key (for AI analysis)
- Google Maps API Key (for geocoding)
- Tavily API Key (for web search)
- PropertyList API Credentials
- OpenCage API Key (for enhanced geocoding)

### 2. **Build and Run with Docker Compose**

```bash
# Start the full stack (includes database, cache, search, and app)
docker-compose --profile app up -d

# Or start just the infrastructure (database, redis, elasticsearch)
docker-compose up -d

# View logs
docker-compose logs -f propertylist-agent
```

### 3. **Access the Application**

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3004
- **Database**: localhost:5432
- **Redis**: localhost:6379
- **Elasticsearch**: http://localhost:9200

## Development vs Production

### Development Mode
```bash
# Use the dev compose for development (database only)
docker-compose -f docker-compose.dev.yml up -d

# Run the app normally
npm run dev          # Frontend on :3000
npm run listener     # Backend on :3004
```

### Production Mode
```bash
# Full stack with Docker
docker-compose --profile app up -d
```

## Cloud Deployment Options

### 1. **Railway** (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### 2. **DigitalOcean App Platform**
```bash
# Connect your GitHub repo to DigitalOcean
# Use docker-compose.yml for deployment
```

### 3. **AWS ECS/Fargate**
```bash
# Push to ECR and deploy with ECS
aws ecr create-repository --repository-name propertylist-agent
docker build -t propertylist-agent .
docker tag propertylist-agent:latest [account].dkr.ecr.[region].amazonaws.com/propertylist-agent:latest
docker push [account].dkr.ecr.[region].amazonaws.com/propertylist-agent:latest
```

### 4. **Google Cloud Run**
```bash
# Build and deploy to Cloud Run
gcloud builds submit --tag gcr.io/[PROJECT]/propertylist-agent
gcloud run deploy --image gcr.io/[PROJECT]/propertylist-agent --platform managed
```

## Environment Variables for Production

When deploying to cloud platforms, set these environment variables:

```bash
# Database (use cloud database for production)
DATABASE_URL=postgres://username:password@host:5432/database
REDIS_URL=redis://username:password@host:6379

# API Keys
OPENAI_API_KEY=sk-...
GOOGLE_MAPS_API_KEY=AIza...
TAVILY_API_KEY=tvly-...
PROPERTYLIST_API_USERNAME=your_username
PROPERTYLIST_API_PASSWORD=your_password
OPENCAGE_API_KEY=your_key

# App Config
NODE_ENV=production
PORT=3004
NEXT_PUBLIC_API_URL=https://your-domain.com
```

## Docker Commands

### Build and Management
```bash
# Build the Docker image
docker build -t propertylist-agent .

# Run the container manually
docker run -p 3000:3000 -p 3004:3004 --env-file .env.local propertylist-agent

# View running containers
docker ps

# Stop all services
docker-compose down

# Remove all data (careful!)
docker-compose down -v
```

### Debugging
```bash
# Enter the running container
docker exec -it propertylist_agent sh

# View application logs
docker logs propertylist_agent

# Check service health
docker-compose ps
```

## Database Management

### Backup Database
```bash
# Export database
docker exec propertylist_postgres pg_dump -U propertylist propertylist_db > backup.sql

# Import database
docker exec -i propertylist_postgres psql -U propertylist propertylist_db < backup.sql
```

### Reset Database
```bash
# Stop and remove everything
docker-compose down -v

# Start fresh
docker-compose up -d
```

## Monitoring and Logs

### Health Checks
All services include health checks:
- **Database**: PostgreSQL connection test
- **Redis**: Ping test
- **Elasticsearch**: Cluster health check

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f propertylist-agent
docker-compose logs -f postgres
```

## Troubleshooting

### Common Issues

1. **Port Conflicts**
   ```bash
   # Change ports in docker-compose.yml if needed
   ports:
     - "3001:3000"  # Use different external port
   ```

2. **Environment Variables Not Loading**
   ```bash
   # Make sure .env.local exists and has correct values
   ls -la .env.local
   ```

3. **Database Connection Issues**
   ```bash
   # Check if database is running
   docker-compose ps postgres
   
   # Check logs
   docker-compose logs postgres
   ```

4. **Memory Issues**
   ```bash
   # Increase Docker memory limit in Docker Desktop
   # Or reduce Elasticsearch memory in docker-compose.yml
   ```

## Security Notes

- Change default passwords in `docker-compose.yml` for production
- Use cloud-managed databases for production (not Docker containers)
- Set up proper network security groups
- Use HTTPS in production with SSL certificates
- Keep API keys secure and rotate regularly

## Performance Optimization

- Use cloud-managed Redis for better performance
- Set up proper database indexing
- Configure Elasticsearch memory based on your server
- Use CDN for static assets
- Enable gzip compression

## Support

For deployment issues:
1. Check the logs: `docker-compose logs -f`
2. Verify environment variables are set correctly
3. Ensure all required API keys are valid
4. Check that ports are not being used by other services

---

**This Docker setup gives you a production-ready deployment that's much more suitable than Vercel for this full-stack application!** 🚀 