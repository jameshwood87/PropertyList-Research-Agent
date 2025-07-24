// Utility functions for handling property images

/**
 * Convert S3 key to proxied URL through our backend
 * Database now stores S3 keys (like "mmQ3QNSwaLg8pFjLyQ5vwWn3") instead of full URLs
 */
export function getProxiedImageUrl(imageKey) {
  if (!imageKey) return null;
  
  // If it's already a full URL (backwards compatibility), use directly
  if (imageKey.startsWith('http')) {
    return imageKey;
  }
  
  // Convert S3 key to proxy URL
  return `http://localhost:3004/api/proxy-image/${imageKey}`;
}

/**
 * Process property images and convert to proxied URLs
 */
export function processPropertyImages(images) {
  if (!images || !Array.isArray(images)) return [];
  
  return images.map(image => {
    if (typeof image === 'string') {
      return {
        small: getProxiedImageUrl(image),
        medium: getProxiedImageUrl(image),
        original: image
      };
    }
    
    return {
      ...image,
      small: getProxiedImageUrl(image.small),
      medium: getProxiedImageUrl(image.medium),
      original: image.small || image.medium
    };
  });
}

/**
 * Get the best available image URL from an image object
 */
export function getBestImageUrl(image) {
  if (!image) return null;
  
  if (typeof image === 'string') {
    return getProxiedImageUrl(image);
  }
  
  // Try medium first, then small, then original
  return getProxiedImageUrl(image.medium || image.small || image.original) || null;
} 