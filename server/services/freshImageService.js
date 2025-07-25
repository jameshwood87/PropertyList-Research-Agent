const axios = require('axios');
const sharp = require('sharp');

/**
 * Fresh Image Service
 * Handles downloading, optimizing, and converting images to base64 for PDF embedding
 * All processing is done in-memory to comply with no-caching requirements
 */
class FreshImageService {
  constructor() {
    // Configuration from environment
    this.config = {
      concurrency: parseInt(process.env.FRESH_IMAGE_CONCURRENCY) || 4,
      maxWidth: parseInt(process.env.FRESH_IMAGE_MAX_WIDTH) || 800,
      quality: parseInt(process.env.FRESH_IMAGE_QUALITY) || 70,
      timeout: parseInt(process.env.FRESH_IMAGE_TIMEOUT) || 10000
    };
    
    // Initialize concurrency control (manual implementation since p-limit v6 is ES module)
    this.runningPromises = new Set();
    
    // Performance metrics
    this.metrics = {
      totalImages: 0,
      successfulImages: 0,
      failedImages: 0,
      totalBytes: 0,
      optimizedBytes: 0,
      averageOptimization: 0,
      averageProcessingTime: 0,
      lastReset: new Date()
    };
    
    console.log('🖼️ Fresh Image Service initialized');
    console.log(`   Concurrency: ${this.config.concurrency}`);
    console.log(`   Max Width: ${this.config.maxWidth}px`);
    console.log(`   Quality: ${this.config.quality}%`);
  }
  
  /**
   * Manual concurrency control to replace p-limit
   */
  async limitConcurrency(fn) {
    // Wait if we're at the concurrency limit
    while (this.runningPromises.size >= this.config.concurrency) {
      await Promise.race(this.runningPromises);
    }
    
    const promise = fn().finally(() => {
      this.runningPromises.delete(promise);
    });
    
    this.runningPromises.add(promise);
    return promise;
  }
  
  /**
   * Process all images for a property (main property + comparables)
   */
  async processPropertyAnalysisImages(mainProperty, comparables) {
    console.log(`🖼️ Processing images for analysis: 1 main property + ${comparables.length} comparables`);
    
    const startTime = Date.now();
    const results = {
      mainProperty: null,
      comparables: [],
      summary: {
        totalProperties: 1 + comparables.length,
        processedImages: 0,
        failedImages: 0,
        totalSizeBefore: 0,
        totalSizeAfter: 0,
        processingTime: 0
      }
    };
    
    try {
      // Process main property images
      if (mainProperty) {
        console.log(`🏠 Processing main property images...`);
        results.mainProperty = await this.processPropertyImages(mainProperty, 3);
        
        if (results.mainProperty) {
          results.summary.processedImages += results.mainProperty.images.length;
          results.summary.totalSizeBefore += results.mainProperty.originalSize || 0;
          results.summary.totalSizeAfter += results.mainProperty.optimizedSize || 0;
        }
      }
      
      // Process comparable property images
      console.log(`🏘️ Processing ${comparables.length} comparable properties...`);
      const comparablePromises = comparables.map((comparable, index) => 
        this.limitConcurrency(async () => {
          console.log(`   Processing comparable ${index + 1}/${comparables.length}...`);
          return await this.processPropertyImages(comparable, 3);
        })
      );
      
      const comparableResults = await Promise.all(comparablePromises);
      
      // Collect results
      results.comparables = comparableResults.filter(result => result !== null);
      
      // Update summary
      results.comparables.forEach(comp => {
        if (comp) {
          results.summary.processedImages += comp.images.length;
          results.summary.totalSizeBefore += comp.originalSize || 0;
          results.summary.totalSizeAfter += comp.optimizedSize || 0;
        }
      });
      
      results.summary.failedImages = 
        (results.mainProperty ? 0 : 1) + 
        (comparables.length - results.comparables.length);
      
      results.summary.processingTime = Date.now() - startTime;
      
      // Calculate compression ratio
      const compressionRatio = results.summary.totalSizeBefore > 0 
        ? ((results.summary.totalSizeBefore - results.summary.totalSizeAfter) / results.summary.totalSizeBefore * 100)
        : 0;
      
      console.log(`✅ Image processing complete:`);
      console.log(`   Processed: ${results.summary.processedImages} images`);
      console.log(`   Failed: ${results.summary.failedImages} properties`);
      console.log(`   Compression: ${compressionRatio.toFixed(1)}% reduction`);
      console.log(`   Processing time: ${results.summary.processingTime}ms`);
      
      return results;
      
    } catch (error) {
      console.error('❌ Error in image processing pipeline:', error.message);
      throw error;
    }
  }
  
  /**
   * Process images for a single property
   */
  async processPropertyImages(property, maxImages = 3) {
    try {
      const propertyRef = property.reference || property.id || 'unknown';
      console.log(`   🔍 Processing images for property: ${propertyRef}`);
      
      // Extract image URLs from property data
      const imageUrls = this.extractImageUrls(property);
      
      if (!imageUrls || imageUrls.length === 0) {
        console.log(`   ⚠️ No images found for property: ${propertyRef}`);
        return {
          propertyId: property.id,
          reference: propertyRef,
          images: [],
          originalSize: 0,
          optimizedSize: 0,
          processingTime: 0
        };
      }
      
      // Limit to max images
      const urlsToProcess = imageUrls.slice(0, maxImages);
      console.log(`   📸 Processing ${urlsToProcess.length} images for ${propertyRef}`);
      
      const startTime = Date.now();
      const results = {
        propertyId: property.id,
        reference: propertyRef,
        images: [],
        originalSize: 0,
        optimizedSize: 0,
        processingTime: 0
      };
      
      // Process images with concurrency control
      const imagePromises = urlsToProcess.map((url, index) => 
        this.limitConcurrency(async () => {
          return await this.processingleImage(url, `${propertyRef}_${index}`);
        })
      );
      
      const imageResults = await Promise.all(imagePromises);
      
      // Collect successful results
      imageResults.forEach(result => {
        if (result.success) {
          results.images.push({
            base64: result.base64,
            mimeType: result.mimeType,
            width: result.width,
            height: result.height,
            originalSize: result.originalSize,
            optimizedSize: result.optimizedSize
          });
          
          results.originalSize += result.originalSize;
          results.optimizedSize += result.optimizedSize;
        }
      });
      
      results.processingTime = Date.now() - startTime;
      
      console.log(`   ✅ ${propertyRef}: ${results.images.length}/${urlsToProcess.length} images processed`);
      
      return results;
      
    } catch (error) {
      console.error(`❌ Error processing property images:`, error.message);
      return null;
    }
  }
  
  /**
   * Process a single image: download, optimize, convert to base64
   */
  async processingleImage(imageUrl, identifier = 'image') {
    const startTime = Date.now();
    
    try {
      console.log(`     📥 Downloading: ${identifier}`);
      
      // Validate URL
      if (!imageUrl || !this.isValidImageUrl(imageUrl)) {
        throw new Error('Invalid image URL');
      }
      
      // Fix URL if it starts with //
      const fullUrl = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
      
      // Download image with timeout
      const response = await axios({
        url: fullUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'PropertyList-AI-Agent/1.0',
          'Accept': 'image/*'
        },
        maxContentLength: 10 * 1024 * 1024, // 10MB max
        maxBodyLength: 10 * 1024 * 1024
      });
      
      if (!response.data) {
        throw new Error('No image data received');
      }
      
      const originalSize = response.data.length;
      this.metrics.totalBytes += originalSize;
      
      console.log(`     🔧 Optimizing: ${identifier} (${(originalSize / 1024).toFixed(1)}KB)`);
      
      // Process with Sharp
      const imageBuffer = Buffer.from(response.data);
      const sharpInstance = sharp(imageBuffer);
      
      // Get image metadata
      const metadata = await sharpInstance.metadata();
      
      // Optimize image
      const optimizedBuffer = await sharpInstance
        .resize({
          width: this.config.maxWidth,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .jpeg({
          quality: this.config.quality,
          progressive: true,
          mozjpeg: true
        })
        .toBuffer();
      
      const optimizedSize = optimizedBuffer.length;
      this.metrics.optimizedBytes += optimizedSize;
      
      // Convert to base64
      const base64 = optimizedBuffer.toString('base64');
      const dataUri = `data:image/jpeg;base64,${base64}`;
      
      const processingTime = Date.now() - startTime;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100);
      
      console.log(`     ✅ ${identifier}: ${(optimizedSize / 1024).toFixed(1)}KB (${compressionRatio.toFixed(1)}% reduction)`);
      
      // Update metrics
      this.metrics.totalImages++;
      this.metrics.successfulImages++;
      this.updateProcessingTimeMetrics(processingTime);
      
      return {
        success: true,
        base64: dataUri,
        mimeType: 'image/jpeg',
        width: metadata.width,
        height: metadata.height,
        originalSize,
        optimizedSize,
        processingTime,
        compressionRatio
      };
      
    } catch (error) {
      console.error(`     ❌ Failed to process ${identifier}:`, error.message);
      
      this.metrics.totalImages++;
      this.metrics.failedImages++;
      
      return {
        success: false,
        error: error.message,
        processingTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Extract image URLs from property data
   * Priority: 1) PropertyList API photos, 2) XML feed URLs (database), 3) Legacy S3 keys
   */
  extractImageUrls(property) {
    const urls = [];
    
    try {
      // PRIORITY 1: PropertyList API Detail format (photos array)
      if (property.photos && Array.isArray(property.photos)) {
        console.log(`   🔥 Using fresh PropertyList API photos array (${property.photos.length} photos)`);
        property.photos.forEach(photo => {
          // Prefer xlarge, then large, then small (as per API format)
          const url = photo.xlarge || photo.large || photo.small;
          if (url) {
            // Fix URL format - add https: if starts with //
            const fullUrl = url.startsWith('//') ? `https:${url}` : url;
            urls.push(fullUrl);
          }
        });
      }
      
      // PRIORITY 2: PropertyList API List format (single photo fields)
      if (urls.length === 0) {
        const photoUrl = property.photo_large || property.photo;
        if (photoUrl) {
          console.log(`   📷 Using PropertyList API list photo (${photoUrl ? 'photo_large' : 'photo'})`);
          // Fix URL format - add https: if starts with //
          const fullUrl = photoUrl.startsWith('//') ? `https:${photoUrl}` : photoUrl;
          urls.push(fullUrl);
        }
      }
      
             // PRIORITY 3: Database images array (XML feed fallback - NOTE: URLs expire every 24h)
       if (urls.length === 0 && (property.images || property.fallbackImages)) {
         let imageArray = [];
         
         // First try fallbackImages (for enhanced dual-source approach)
         const imageSource = property.fallbackImages || property.images;
         
         // Handle both JSON string and actual array
         if (typeof imageSource === 'string') {
           try {
             imageArray = JSON.parse(imageSource);
           } catch (e) {
             console.warn(`   ⚠️ Could not parse images JSON: ${imageSource}`);
             imageArray = [];
           }
         } else if (Array.isArray(imageSource)) {
           imageArray = imageSource;
         }
         
         if (imageArray.length > 0) {
           const sourceType = property.fallbackImages ? 'enhanced fallback' : 'database fallback';
           console.log(`   🔄 Using ${sourceType} images (${imageArray.length} available) - NOTE: URLs may have 24h expiry`);
           imageArray.forEach(image => {
             let imageUrl = null;
             
             if (typeof image === 'string') {
               imageUrl = image;
             } else if (image.url || image.large || image.medium) {
               imageUrl = image.url || image.large || image.medium;
             }
             
             if (imageUrl) {
               // Check if it's already a full URL (from XML feed)
               if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                 console.log(`   📸 Using XML feed URL: ${imageUrl.substring(0, 60)}...`);
                 urls.push(imageUrl);
               } else {
                 // Legacy S3 key - convert to full URL
                 const fullUrl = this.convertS3KeyToUrl(imageUrl);
                 if (fullUrl) {
                   console.log(`   🔑 Converting S3 key to URL: ${imageUrl}`);
                   urls.push(fullUrl);
                 }
               }
             }
           });
         }
       }
      
      // Limit to first 3 images as requested by user
      const limitedUrls = urls.slice(0, 3);
      console.log(`   📋 Found ${limitedUrls.length}/${urls.length} image URLs for property (limited to 3)`);
      return limitedUrls;
      
    } catch (error) {
      console.error('❌ Error extracting image URLs:', error.message);
      return [];
    }
  }
  
  /**
   * Convert S3 key to full S3 URL if needed
   */
  convertS3KeyToUrl(imageUrl) {
    if (!imageUrl || typeof imageUrl !== 'string') {
      return null;
    }
    
    // If it's already a full URL, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // Check if it looks like an S3 key (alphanumeric string without slashes)
    const s3KeyPattern = /^[a-zA-Z0-9]+$/;
    if (s3KeyPattern.test(imageUrl)) {
      console.log(`   🔑 Converting S3 key to URL: ${imageUrl}`);
      const s3BaseUrl = 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/';
      return s3BaseUrl + imageUrl;
    }
    
    // Return original if we can't identify the format
    return imageUrl;
  }
  
  /**
   * Validate image URL
   */
  isValidImageUrl(url) {
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // Check for valid image extensions or PropertyList image patterns
    const imagePattern = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i;
    const propertyListPattern = /propertylist.*\.(jpg|jpeg|png|gif|webp)/i;
    const assetsPropertyListPattern = /assets\.propertylist\.es.*\.(jpg|jpeg|png|gif|webp)/i;
    const s3Pattern = /s3.*amazonaws.*\.(jpg|jpeg|png|gif|webp)/i;
    
    return imagePattern.test(url) || propertyListPattern.test(url) || assetsPropertyListPattern.test(url) || s3Pattern.test(url);
  }
  
  /**
   * Update processing time metrics
   */
  updateProcessingTimeMetrics(processingTime) {
    const totalSuccessful = this.metrics.successfulImages;
    this.metrics.averageProcessingTime = 
      ((this.metrics.averageProcessingTime * (totalSuccessful - 1)) + processingTime) / totalSuccessful;
  }
  
  /**
   * Create optimized image variants
   */
  async createImageVariants(base64Data, variants = ['thumbnail', 'medium']) {
    try {
      // Extract base64 data
      const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
      const imageBuffer = Buffer.from(base64, 'base64');
      
      const results = {};
      
      for (const variant of variants) {
        let width, quality;
        
        switch (variant) {
          case 'thumbnail':
            width = 200;
            quality = 60;
            break;
          case 'medium':
            width = 400;
            quality = 75;
            break;
          case 'large':
            width = 800;
            quality = 80;
            break;
          default:
            width = this.config.maxWidth;
            quality = this.config.quality;
        }
        
        const optimizedBuffer = await sharp(imageBuffer)
          .resize({ width, withoutEnlargement: true, fit: 'inside' })
          .jpeg({ quality, progressive: true })
          .toBuffer();
        
        results[variant] = `data:image/jpeg;base64,${optimizedBuffer.toString('base64')}`;
      }
      
      return results;
      
    } catch (error) {
      console.error('❌ Error creating image variants:', error.message);
      return {};
    }
  }
  
  /**
   * Get service metrics
   */
  getMetrics() {
    const compressionRatio = this.metrics.totalBytes > 0 
      ? ((this.metrics.totalBytes - this.metrics.optimizedBytes) / this.metrics.totalBytes * 100)
      : 0;
    
    return {
      ...this.metrics,
      compressionRatio: compressionRatio,
      successRate: this.metrics.totalImages > 0 
        ? (this.metrics.successfulImages / this.metrics.totalImages * 100)
        : 0,
      averageCompressionRatio: compressionRatio
    };
  }
  
  /**
   * Clean up resources (called after processing)
   */
  cleanup() {
    // Sharp cleanup
    if (sharp.cache) {
      sharp.cache(false);
      sharp.simd(false);
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('🧹 Fresh Image Service cleanup completed');
  }
  
  /**
   * Reset metrics
   */
  resetMetrics() {
    this.metrics = {
      totalImages: 0,
      successfulImages: 0,
      failedImages: 0,
      totalBytes: 0,
      optimizedBytes: 0,
      averageOptimization: 0,
      averageProcessingTime: 0,
      lastReset: new Date()
    };
    console.log('📊 Fresh Image Service metrics reset');
  }
  
  /**
   * Test image processing with a sample URL
   */
  async testImageProcessing(testUrl = 'https://via.placeholder.com/800x600.jpg') {
    try {
      console.log('🧪 Testing image processing...');
      
      const result = await this.processingleImage(testUrl, 'test');
      
      if (result.success) {
        console.log('✅ Image processing test successful');
        console.log(`   Original: ${(result.originalSize / 1024).toFixed(1)}KB`);
        console.log(`   Optimized: ${(result.optimizedSize / 1024).toFixed(1)}KB`);
        console.log(`   Compression: ${result.compressionRatio.toFixed(1)}%`);
        return { success: true, result };
      } else {
        console.error('❌ Image processing test failed:', result.error);
        return { success: false, error: result.error };
      }
      
    } catch (error) {
      console.error('❌ Image processing test error:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = FreshImageService; 