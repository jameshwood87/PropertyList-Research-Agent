# XML Field Standards Documentation

## Overview
This document defines the standard XML field names used in the property feed. These field names should be used consistently across all scripts, parsers, and database operations to ensure smooth data flow.

## XML Feed Source
- **URL**: `http://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/47/export/189963705804aee9/admin.xml`
- **Format**: XML with snake_case field names
- **Last Refreshed**: Successfully refreshed with latest data
- **Total Properties**: 4,689 properties

## Standard XML Field Names

### Core Property Fields
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `reference` | string | Property reference number | "PL10880", "R4829746" |
| `city` | string | City name | "Marbella", "Estepona" |
| `province` | string | Province code | "MA" (Málaga) |
| `suburb` | string | Suburb/area name | "Nueva Andalucia" |
| `urbanization` | string | Urbanization name | "La Campana" |

### Property Type & Status
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `property_type` | string | Property type | "villa", "apartment" |
| `is_sale` | boolean | For sale flag | true/false |
| `is_rental` | boolean | For rent flag | true/false |

### Property Details
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `bedrooms` | number | Number of bedrooms | 3, 4, 5 |
| `bathrooms` | number | Number of bathrooms | 2, 3, 5 |
| `parking_spaces` | number | Number of parking spaces | 1, 2 |
| `orientation` | string | Property orientation | "south-west" |

### Area Measurements
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `build_size` | number | Built area in m² | 83, 185, 403 |
| `plot_size` | number | Plot area in m² | 350, 2750 |
| `terrace_size` | number | Terrace area in m² | 36, 87 |

### Pricing
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `sale_price` | number | Sale price in euros | 675000, 3850000 |
| `rental_price` | number | Monthly rental price | 2500 |
| `monthly_price` | number | Monthly price (alternative) | 2500 |
| `property_tax` | number | Annual property tax | 300 |

### Additional Fields
| XML Field Name | Type | Description | Example |
|----------------|------|-------------|---------|
| `descriptions` | object | Multi-language descriptions | See structure below |
| `features` | array | Property features list | ["pool-private", "garden-private"] |
| `photos` | array | Property image URLs | [] |
| `created_at` | string | ISO date when created | "2025-06-29T09:59:58Z" |
| `last_updated_at` | string | ISO date last updated | "2025-07-12T16:26:17Z" |
| `direct` | boolean | Direct property flag | false |

## Description Structure
The `descriptions` field contains multi-language property descriptions:

```xml
<descriptions>
  <description language="en">
    <text><![CDATA[English description text]]></text>
  </description>
  <description language="es">
    <text><![CDATA[Spanish description text]]></text>
  </description>
  <description language="nl">
    <text><![CDATA[Dutch description text]]></text>
  </description>
  <!-- Additional languages: fr, de, no, ru -->
</descriptions>
```

## Features Structure
The `features` field contains an array of feature codes:

```xml
<features>
  <feature>alarm-system</feature>
  <feature>ducted-central-ac</feature>
  <feature>fireplace</feature>
  <feature>garden-private</feature>
  <feature>gated-complex</feature>
  <feature>pool-private</feature>
  <feature>storage-room</feature>
  <feature>underfloor-heating</feature>
  <feature>views-mountain</feature>
  <feature>views-sea</feature>
</features>
```

## Photos Structure
The `photos` field contains an array of photo URLs:

```xml
<photos>
  <photo><![CDATA[https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/...]]></photo>
  <photo><![CDATA[https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/...]]></photo>
</photos>
```

## Property Attributes
Each property has these XML attributes:
- `created_at`: ISO timestamp when property was created
- `last_updated_at`: ISO timestamp when property was last updated
- `direct`: Boolean flag (usually false)

## Field Mapping to JSON
When converting XML to JSON, these mappings are used:

| XML Field | JSON Field | Notes |
|-----------|------------|-------|
| `reference` | `ref_number` | Direct mapping |
| `property_type` | `property_type` | Direct mapping |
| `build_size` | `build_area` | Mapped to camelCase |
| `plot_size` | `plot_area` | Mapped to camelCase |
| `terrace_size` | `terrace_area_m2` | Mapped to camelCase |
| `sale_price` | `price` | Mapped to 'price' for consistency |
| `is_sale` | `is_sale` | Direct mapping |
| `bedrooms` | `bedrooms` | Direct mapping |
| `bathrooms` | `bathrooms` | Direct mapping |
| `city` | `city` | Direct mapping |
| `province` | `province` | Direct mapping |
| `suburb` | `suburb` | Direct mapping |
| `orientation` | `orientation` | Direct mapping |
| `parking_spaces` | `parking_spaces` | Direct mapping |

## Important Notes

1. **No Unique ID in XML**: The XML feed does NOT contain a unique ID field. The `reference` field is used as the primary identifier but may not be unique across different feeds.

2. **Generated IDs**: Our system generates unique property IDs by combining:
   - Feed source identifier
   - Reference number
   - Hash of key property data (address, city, property type, etc.)

3. **Field Consistency**: All scripts should use these exact field names when working with XML data to ensure consistency.

4. **Multi-language Support**: The feed supports multiple languages (en, es, nl, fr, de, no, ru) for descriptions.

5. **Data Quality**: 99.9% of properties have descriptions, ensuring good data coverage.

## Usage Guidelines

1. **Always use snake_case field names** when working with XML data
2. **Generate unique IDs** for database storage using the reference + hash method
3. **Handle missing fields gracefully** as not all properties have all fields
4. **Preserve multi-language descriptions** when processing property data
5. **Use the exact field names** listed above to avoid mapping errors

## Field Mapping Standards

### Database Storage
When storing in the properties database, we use the **snake_case field names** directly from the XML:
```javascript
{
  "ref_number": "PL10880",
  "property_type": "Villa",
  "build_area": 83,
  "sale_price": 675000,
  "is_sale": true
}
```

### Script Usage
All scripts should use the **snake_case field names**:
```javascript
// ✅ CORRECT - Use snake_case
const marbellaVillas = properties.filter(prop => 
  prop.city === 'Marbella' && 
  prop.property_type === 'Villa' &&
  prop.is_sale === true
);

// ❌ INCORRECT - Don't use camelCase
const marbellaVillas = properties.filter(prop => 
  prop.city === 'Marbella' && 
  prop.propertyType === 'Villa' &&  // Wrong!
  prop.isSale === true              // Wrong!
);
```

## Key Findings from Feed Analysis

### Marbella Villa Market Data
- **Total Marbella Villas**: 695 properties
- **Average Price**: €4,639,898
- **Median Price**: €3,899,000
- **Average Build Area**: 632m²
- **Median Build Area**: 434m²
- **Luxury Properties (>€2M)**: 493 (71% of market)

### Target Property (PL10880)
- **Price**: €675,000
- **Build Area**: 83m²
- **Price per m²**: €8,133
- **Status**: One of the smallest and cheapest villas in Marbella

## Implementation Guidelines

### 1. Refresh Scripts
Use `scripts/refresh-property-feed.js` to fetch latest XML data:
```bash
node scripts/refresh-property-feed.js
```

### 2. Debug Scripts
All debug scripts should use snake_case field names:
- `scripts/debug-marbella-market-data.js` ✅ (Fixed)
- `scripts/check-property-structure.js` ✅ (Working)

### 3. Property Database
The `data/properties.json` file uses snake_case field names directly from XML.

### 4. API Endpoints
When processing property data in APIs, ensure field mapping uses snake_case.

## Common Issues to Avoid

1. **Field Name Mismatches**: Don't mix snake_case and camelCase
2. **Price Field Confusion**: Use `sale_price` for sale properties, `rental_price` for rentals
3. **Area Field Names**: Use `build_area`, `plot_area`, `terrace_area_m2`
4. **Boolean Fields**: Use `is_sale` and `is_rental` as booleans

## Validation Checklist

Before running any property analysis:
- [ ] XML feed is refreshed with latest data
- [ ] All scripts use snake_case field names
- [ ] Property database contains current data
- [ ] Field mappings are consistent across all components
- [ ] Target property exists in database

## Notes
- The XML feed is the authoritative source for field names
- All internal processing should maintain snake_case consistency
- Field mapping should happen at the XML parsing stage, not in individual scripts
- Regular feed refreshes ensure data currency and accuracy 