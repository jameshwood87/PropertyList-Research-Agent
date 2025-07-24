-- OPTIMIZATION: Add normalized text columns for bulletproof Spanish diacritics matching
-- This prevents missed matches between "Málaga" vs "Malaga", "Estepóna" vs "Estepona", etc.

BEGIN;

-- Add normalized columns for location fields
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS suburb_norm TEXT,
ADD COLUMN IF NOT EXISTS urbanization_norm TEXT,
ADD COLUMN IF NOT EXISTS city_norm TEXT,
ADD COLUMN IF NOT EXISTS address_norm TEXT;

-- Create function to normalize Spanish text (remove accents, lowercase)
CREATE OR REPLACE FUNCTION normalize_spanish_text(input_text TEXT)
RETURNS TEXT AS $$
BEGIN
  IF input_text IS NULL OR input_text = '' THEN
    RETURN NULL;
  END IF;
  
  RETURN LOWER(
    TRANSLATE(
      input_text,
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÑñÇç',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuYynNcc'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update all existing records with normalized values
UPDATE properties 
SET 
  suburb_norm = normalize_spanish_text(suburb),
  urbanization_norm = normalize_spanish_text(urbanization),
  city_norm = normalize_spanish_text(city),
  address_norm = normalize_spanish_text(address)
WHERE is_active = true;

-- Create indexes on normalized columns for fast lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_suburb_norm 
ON properties (suburb_norm) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_urbanization_norm 
ON properties (urbanization_norm) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_city_norm 
ON properties (city_norm) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_address_norm 
ON properties (address_norm) WHERE is_active = true;

-- Create trigger to automatically update normalized columns on INSERT/UPDATE
CREATE OR REPLACE FUNCTION update_normalized_location_columns()
RETURNS TRIGGER AS $$
BEGIN
  NEW.suburb_norm = normalize_spanish_text(NEW.suburb);
  NEW.urbanization_norm = normalize_spanish_text(NEW.urbanization);
  NEW.city_norm = normalize_spanish_text(NEW.city);
  NEW.address_norm = normalize_spanish_text(NEW.address);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_normalized_location_columns ON properties;
CREATE TRIGGER trigger_update_normalized_location_columns
    BEFORE INSERT OR UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION update_normalized_location_columns();

-- Create composite index for common search patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_properties_location_search 
ON properties (suburb_norm, urbanization_norm, city_norm) 
WHERE is_active = true;

COMMIT;

-- Verification queries
SELECT 
  'Normalization Test' as test,
  suburb, suburb_norm,
  urbanization, urbanization_norm,
  city, city_norm
FROM properties 
WHERE (suburb LIKE '%á%' OR suburb LIKE '%é%' OR suburb LIKE '%í%' OR suburb LIKE '%ó%' OR suburb LIKE '%ú%' OR suburb LIKE '%ñ%')
   OR (urbanization LIKE '%á%' OR urbanization LIKE '%é%' OR urbanization LIKE '%í%' OR urbanization LIKE '%ó%' OR urbanization LIKE '%ú%' OR urbanization LIKE '%ñ%')
   OR (city LIKE '%á%' OR city LIKE '%é%' OR city LIKE '%í%' OR city LIKE '%ó%' OR city LIKE '%ú%' OR city LIKE '%ñ%')
LIMIT 10;

SELECT 
  'Index Status' as status,
  schemaname, tablename, indexname, indexdef
FROM pg_indexes 
WHERE tablename = 'properties' 
  AND indexname LIKE '%_norm%'
ORDER BY indexname; 