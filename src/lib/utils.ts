/**
 * Utility functions for the property analysis application
 */

// UTF-8 utilities for Spanish character support
export function fixSpanishCharacters(text: string | null | undefined): string | null | undefined {
  if (!text || typeof text !== 'string') return text;
  
  let processedText = text;
  
  // Handle the specific corruption pattern we found in the data
  if (processedText.includes('ï¿½')) {
    processedText = processedText
      .replace(/Mï¿½laga/g, 'Málaga')
      .replace(/histï¿½rico/g, 'histórico')
      .replace(/balcï¿½n/g, 'balcón')
      .replace(/Urbanizaciï¿½n/g, 'Urbanización')
      .replace(/Jardï¿½n/g, 'Jardín')
      .replace(/Pequeï¿½a/g, 'Pequeña')
      .replace(/Espaï¿½a/g, 'España')
      .replace(/Alcalï¿½/g, 'Alcalá')
      .replace(/Cï¿½diz/g, 'Cádiz')
      .replace(/Cï¿½rdoba/g, 'Córdoba')
      .replace(/Sevillaï¿½a/g, 'Sevillana')
      .replace(/Valï¿½ncia/g, 'València')
      .replace(/Cataluï¿½a/g, 'Cataluña')
      .replace(/Andalucï¿½a/g, 'Andalucía')
      .replace(/ï¿½/g, 'á'); // Generic fallback for any remaining ï¿½
  }
  
  // Handle question mark corruption
  if (processedText.includes('?')) {
    processedText = processedText
      .replace(/M\?laga/g, 'Málaga')
      .replace(/Urbanizaci\?n/g, 'Urbanización')
      .replace(/Jard\?n/g, 'Jardín')
      .replace(/Peque\?a/g, 'Pequeña')
      .replace(/Espa\?a/g, 'España')
      .replace(/Alcal\?/g, 'Alcalá')
      .replace(/C\?diz/g, 'Cádiz')
      .replace(/C\?rdoba/g, 'Córdoba')
      .replace(/Sevilla\?a/g, 'Sevillana')
      .replace(/Val\?ncia/g, 'València')
      .replace(/Catalu\?a/g, 'Cataluña')
      .replace(/Andaluc\?a/g, 'Andalucía');
  }
  
  return processedText;
}

export function fixPropertySpanishCharacters(property: any): any {
  if (!property || typeof property !== 'object') return property;
  
  const fixed = { ...property };
  
  // Fix common property fields that contain Spanish text
  const textFields = [
    'description', 'title', 'address', 'city', 'province', 
    'urbanization', 'suburb', 'features', 'amenities'
  ];
  
  textFields.forEach(field => {
    if (fixed[field]) {
      if (Array.isArray(fixed[field])) {
        fixed[field] = fixed[field].map(item => fixSpanishCharacters(item));
      } else {
        fixed[field] = fixSpanishCharacters(fixed[field]);
      }
    }
  });
  
  return fixed;
}

export function ensureUTF8Encoding(data: any): any {
  if (typeof data === 'string') {
    return fixSpanishCharacters(data);
  }
  
  if (Array.isArray(data)) {
    return data.map(item => ensureUTF8Encoding(item));
  }
  
  if (typeof data === 'object' && data !== null) {
    const encoded: any = {};
    for (const [key, value] of Object.entries(data)) {
      encoded[key] = ensureUTF8Encoding(value);
    }
    return encoded;
  }
  
  return data;
}

export function hasSpanishCharacters(text: string | null | undefined): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const spanishPattern = /[áéíóúñüÁÉÍÓÚÑÜ]/;
  return spanishPattern.test(text);
}

export function countSpanishCharacters(text: string | null | undefined): number {
  if (!text || typeof text !== 'string') return 0;
  
  const spanishPattern = /[áéíóúñüÁÉÍÓÚÑÜ]/g;
  const matches = text.match(spanishPattern);
  return matches ? matches.length : 0;
}

export function createUTF8SafeJSON(data: any): string {
  try {
    return JSON.stringify(data, null, 2);
  } catch (error) {
    return '{}';
  }
}

export function parseUTF8SafeJSON(jsonString: string): any {
  try {
    const parsed = JSON.parse(jsonString);
    return fixPropertySpanishCharacters(parsed);
  } catch (error) {
    return null;
  }
}

/**
 * Format price with Euro symbol and thousand separators
 */
export function formatPrice(price: number): string {
  if (!price) return '€0';
  
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

/**
 * Format square meters with m² symbol
 */
export function formatSquareMeters(area: number): string {
  if (!area) return '0 m²';
  
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(area) + ' m²';
}

/**
 * Capitalize first letter of each word
 */
export function capitalizeWords(text: string): string {
  if (!text) return text;
  
  return text.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Clean and normalize text
 */
export function cleanText(text: string): string {
  if (!text) return text;
  
  return fixSpanishCharacters(text.trim());
}

// Export province utilities for consistent location handling
export { 
  getProvinceNameFromCode, 
  getProvinceCodeFromName, 
  normalizeProvinceName,
  isValidProvinceCode,
  isValidProvinceName,
  PROVINCE_CODES
} from './province-codes' 