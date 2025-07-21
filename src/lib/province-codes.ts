// Spanish Province Codes Mapping for XML Feed Integration
// Maps 2-letter province codes to full province names

export const PROVINCE_CODES: Record<string, string> = {
  // Andalucía
  'AL': 'Almería',
  'CA': 'Cádiz',
  'CO': 'Córdoba',
  'GR': 'Granada',
  'H': 'Huelva',
  'J': 'Jaén',
  'MA': 'Málaga',
  'SE': 'Sevilla',
  
  // Aragón
  'HU': 'Huesca',
  'TE': 'Teruel',
  'Z': 'Zaragoza',
  
  // Asturias
  'O': 'Asturias',
  
  // Baleares
  'PM': 'Balears',
  
  // Canarias
  'GC': 'Las Palmas',
  'TF': 'Santa Cruz de Tenerife',
  
  // Cantabria
  'S': 'Cantabria',
  
  // Castilla-La Mancha
  'AB': 'Albacete',
  'CR': 'Ciudad Real',
  'CU': 'Cuenca',
  'GU': 'Guadalajara',
  'TO': 'Toledo',
  
  // Castilla y León
  'AV': 'Ávila',
  'BU': 'Burgos',
  'LE': 'León',
  'P': 'Palencia',
  'SA': 'Salamanca',
  'SG': 'Segovia',
  'SO': 'Soria',
  'VA': 'Valladolid',
  'ZA': 'Zamora',
  
  // Cataluña
  'B': 'Barcelona',
  'GI': 'Girona',
  'L': 'Lleida',
  'T': 'Tarragona',
  
  // Ceuta y Melilla
  'EA': 'Ceuta, Melilla',
  
  // Comunidad Valenciana
  'A': 'Alicante',
  'CS': 'Castellón',
  'V': 'Valencia',
  
  // Extremadura
  'BA': 'Badajoz',
  'CC': 'Cáceres',
  
  // Galicia
  'C': 'Coruña',
  'LU': 'Lugo',
  'OP': 'Ourense',
  'PO': 'Pontevedra',
  
  // La Rioja
  'LO': 'La Rioja',
  
  // Madrid
  'M': 'Madrid',
  
  // Murcia
  'MU': 'Murcia',
  
  // Navarra
  'NA': 'Navarra',
  
  // País Vasco
  'VI': 'Álava',
  'SS': 'Guipúzcoa',
  'BI': 'Vizcaya'
}

// Reverse mapping for looking up codes by province name
export const PROVINCE_NAMES_TO_CODES: Record<string, string> = Object.fromEntries(
  Object.entries(PROVINCE_CODES).map(([code, name]) => [name.toLowerCase(), code])
)

/**
 * Convert province code to full province name
 * @param code - 2-letter province code
 * @returns Full province name or the original code if not found
 */
export function getProvinceNameFromCode(code: string): string {
  if (!code) return ''
  
  const upperCode = code.toUpperCase()
  return PROVINCE_CODES[upperCode] || code
}

/**
 * Convert province name to 2-letter code
 * @param name - Full province name
 * @returns 2-letter province code or empty string if not found
 */
export function getProvinceCodeFromName(name: string): string {
  if (!name) return ''
  
  const lowerName = name.toLowerCase()
  return PROVINCE_NAMES_TO_CODES[lowerName] || ''
}

/**
 * Normalize province name/code for consistent display
 * Handles both codes and full names, returns the full name
 * @param input - Province code or name
 * @returns Standardized full province name
 */
export function normalizeProvinceName(input: string): string {
  if (!input) return ''
  
  // First try as a code
  const fromCode = getProvinceNameFromCode(input)
  if (fromCode !== input) {
    return fromCode
  }
  
  // Then try as a name (case-insensitive lookup)
  const lowerInput = input.toLowerCase()
  const exactMatch = PROVINCE_NAMES_TO_CODES[lowerInput]
  if (exactMatch) {
    return PROVINCE_CODES[exactMatch]
  }
  
  // Return original if no match found
  return input
}

/**
 * Check if a string is a valid Spanish province code
 * @param code - String to check
 * @returns True if valid province code
 */
export function isValidProvinceCode(code: string): boolean {
  return code.toUpperCase() in PROVINCE_CODES
}

/**
 * Check if a string is a valid Spanish province name
 * @param name - String to check
 * @returns True if valid province name
 */
export function isValidProvinceName(name: string): boolean {
  return name.toLowerCase() in PROVINCE_NAMES_TO_CODES
}

/**
 * Get all province codes
 * @returns Array of all valid province codes
 */
export function getAllProvinceCodes(): string[] {
  return Object.keys(PROVINCE_CODES)
}

/**
 * Get all province names
 * @returns Array of all province names
 */
export function getAllProvinceNames(): string[] {
  return Object.values(PROVINCE_CODES)
} 