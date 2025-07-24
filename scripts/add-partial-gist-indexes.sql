-- OPTIMIZATION: Partial GiST indexes for faster spatial queries
-- Only index active properties to reduce index size and improve performance

BEGIN;

-- Drop existing spatial indexes if they exist
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_geom;
DROP INDEX CONCURRENTLY IF EXISTS idx_properties_coordinates;

-- Create partial GiST index on geom column (PostGIS geometry) - ACTIVE PROPERTIES ONLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_geom_active 
ON properties USING GIST (geom) 
WHERE is_active = true AND geom IS NOT NULL;

-- Create partial GiST index on lat/lng coordinates - ACTIVE PROPERTIES ONLY  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_coordinates_active 
ON properties USING GIST (ST_Point(longitude, latitude)) 
WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL;

-- Create composite index for common property search patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_search_active
ON properties (property_type, bedrooms, is_active)
WHERE is_active = true AND sale_price > 0 AND build_size > 0;

-- Create partial index for price range queries  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_price_active
ON properties (sale_price, build_size)
WHERE is_active = true AND sale_price > 0 AND build_size > 0;

-- Update table statistics
ANALYZE properties;

COMMIT;

-- Performance verification queries
SELECT 
  'Spatial Index Performance Test' as test,
  COUNT(*) as total_active_properties_with_coordinates
FROM properties 
WHERE is_active = true 
  AND latitude IS NOT NULL 
  AND longitude IS NOT NULL;

-- Index usage stats
SELECT 
  'Index Stats' as category,
  schemaname, tablename, indexname, 
  idx_tup_read, idx_tup_fetch,
  ROUND(100.0 * idx_tup_fetch / NULLIF(idx_tup_read, 0), 2) AS hit_rate_percent
FROM pg_stat_user_indexes 
WHERE tablename = 'properties' 
  AND indexname LIKE '%_active%'
ORDER BY idx_tup_read DESC;

-- Index sizes  
SELECT 
  'Index Sizes' as category,
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes 
WHERE tablename = 'properties' 
  AND indexname LIKE '%_active%'
ORDER BY pg_relation_size(indexname::regclass) DESC; 