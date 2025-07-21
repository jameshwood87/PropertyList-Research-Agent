const fs = require('fs');
const path = require('path');
const { DOMParser } = require('xmldom');

class PropertyRegenerator {
  constructor() {
    this.xmlPath = path.join(__dirname, '..', 'data', 'feed-cache.xml');
    this.outputPath = path.join(__dirname, '..', 'data', 'properties.json');
  }

  // Parse properties from XML document
  parseXMLProperties(xmlDoc) {
    const properties = [];
    const propertyNodes = xmlDoc.getElementsByTagName('property');
    
    console.log(`📊 Found ${propertyNodes.length} properties in XML feed`);
    
    for (let i = 0; i < propertyNodes.length; i++) {
      const node = propertyNodes[i];
      const property = this.parsePropertyNode(node);
      if (property) {
        properties.push(property);
      }
    }
    
    return properties;
  }

  // Parse individual property node
  parsePropertyNode(node) {
    try {
      const getText = (tagName) => {
        const element = node.getElementsByTagName(tagName)[0];
        return element ? element.textContent.trim() : '';
      };

      const getNumber = (tagName) => {
        const text = getText(tagName);
        return text ? parseFloat(text) : 0;
      };

      const getBoolean = (tagName) => {
        const text = getText(tagName);
        return text === 'true' || text === '1';
      };

      const property = {
        refNumber: getText('reference'),
        address: getText('address'),
        city: getText('city'),
        province: getText('province'),
        propertyType: getText('property_type'),
        bedrooms: getNumber('bedrooms'),
        bathrooms: getNumber('bathrooms'),
        buildArea: getNumber('build_size'),
        plotArea: getNumber('plot_size'),
        terraceAreaM2: getNumber('terrace_size'),
        price: getNumber('sale_price') || getNumber('rental_price'),
        isSale: getBoolean('is_sale'),
        isShortTerm: getBoolean('is_short_term'),
        isLongTerm: getBoolean('is_long_term'),
        monthlyPrice: getNumber('monthly_price'),
        weeklyPriceFrom: getNumber('weekly_price_from'),
        weeklyPriceTo: getNumber('weekly_price_to'),
        description: getText('description'),
        features: this.parseFeatures(node),
        images: this.parseImages(node),
        urbanization: getText('urbanization'),
        neighbourhood: getText('suburb'),
        yearBuilt: getNumber('year_built'),
        condition: getText('condition'),
        architecturalStyle: getText('architectural_style'),
        orientation: getText('orientation'),
        parkingSpaces: getNumber('parking_spaces')
      };

      return property;
    } catch (error) {
      console.error('❌ Error parsing property node:', error.message);
      return null;
    }
  }

  // Parse features array
  parseFeatures(node) {
    const features = [];
    const featureNodes = node.getElementsByTagName('feature');
    
    for (let i = 0; i < featureNodes.length; i++) {
      const feature = featureNodes[i].textContent.trim();
      if (feature) {
        features.push(feature);
      }
    }
    
    return features;
  }

  // Parse images array
  parseImages(node) {
    const images = [];
    const photoNodes = node.getElementsByTagName('photo');
    
    for (let i = 0; i < photoNodes.length; i++) {
      const photo = photoNodes[i].textContent.trim();
      if (photo) {
        images.push(photo);
      }
    }
    
    return images;
  }

  // Regenerate properties from XML
  async regenerateProperties() {
    try {
      console.log('🔄 Starting property regeneration with images...');
      
      if (!fs.existsSync(this.xmlPath)) {
        console.error('❌ XML feed not found at:', this.xmlPath);
        return false;
      }

      console.log('📥 Loading XML feed...');
      const xmlData = fs.readFileSync(this.xmlPath, 'utf8');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlData, 'text/xml');
      
      // Parse properties from XML
      const properties = this.parseXMLProperties(xmlDoc);
      
      if (properties.length === 0) {
        console.error('❌ No properties found in XML feed');
        return false;
      }

      // Count properties with images
      const propertiesWithImages = properties.filter(p => p.images && p.images.length > 0);
      console.log(`📸 Properties with images: ${propertiesWithImages.length}/${properties.length}`);

      // Save to JSON file
      console.log('💾 Saving properties to JSON file...');
      fs.writeFileSync(this.outputPath, JSON.stringify(properties, null, 2));
      
      console.log(`✅ Successfully regenerated ${properties.length} properties with images`);
      console.log(`📁 Saved to: ${this.outputPath}`);
      
      return true;
      
    } catch (error) {
      console.error('❌ Error regenerating properties:', error.message);
      return false;
    }
  }
}

// Run the regeneration
async function main() {
  const regenerator = new PropertyRegenerator();
  const success = await regenerator.regenerateProperties();
  
  if (success) {
    console.log('🎉 Property regeneration completed successfully!');
    process.exit(0);
  } else {
    console.error('💥 Property regeneration failed!');
    process.exit(1);
  }
}

main(); 