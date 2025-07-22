-- Initialize PropertyList.es Development Database
-- This script runs automatically when the Docker container starts

-- Create extensions
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create database user (if needed)
-- The main user is created automatically by Docker

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE propertylist_db TO postgres;

-- Log successful initialization
SELECT 'PropertyList.es PostgreSQL database initialized successfully with PostGIS extensions' AS status; 