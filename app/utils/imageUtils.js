// Utility functions for handling property images

/**
 * Convert S3 URL to proxied URL through our backend
 */
export function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return null;
  
  // Check if it's an S3 URL that needs proxying
  const s3Pattern = /https:\/\/propertylist-staging-assets-west\.s3\.eu-west-1\.amazonaws\.com\/(.+)/;
  const match = imageUrl.match(s3Pattern);
  
  if (match) {
    const imageId = match[1];
    return `http://localhost:3004/api/proxy-image/${imageId}`;
  }
  
  // Return original URL if it's not an S3 URL
  return imageUrl;
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