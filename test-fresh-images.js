#!/usr/bin/env node

/**
 * Fresh Image Service Test
 * Tests image downloading, optimization, and base64 conversion
 */

require('dotenv').config({ path: '.env.local' });
const FreshImageService = require('./server/services/freshImageService');

// Sample property data with various image URL formats
const samplePropertyData = {
  id: 'test-property',
  reference: 'TEST-001',
  photos: [
    {
      large: 'https://via.placeholder.com/800x600.jpg?text=Large+Image',
      medium: 'https://via.placeholder.com/400x300.jpg?text=Medium+Image',
      small: 'https://via.placeholder.com/200x150.jpg?text=Small+Image'
    },
    {
      large: 'https://picsum.photos/800/600',
      medium: 'https://picsum.photos/400/300',
      small: 'https://picsum.photos/200/150'
    }
  ]
};

const sampleComparables = [
  {
    id: 'comp-1',
    reference: 'COMP-001',
    photos: [
      {
        large: 'https://via.placeholder.com/800x600.jpg?text=Comp1+Image1',
        small: 'https://via.placeholder.com/200x150.jpg?text=Comp1+Image1'
      }
    ]
  },
  {
    id: 'comp-2',
    reference: 'COMP-002',
    photos: [
      {
        large: 'https://picsum.photos/800/600?random=1',
        small: 'https://picsum.photos/200/150?random=1'
      },
      {
        large: 'https://picsum.photos/800/600?random=2',
        small: 'https://picsum.photos/200/150?random=2'
      }
    ]
  }
];

async function testFreshImageService() {
  console.log('🧪 Testing Fresh Image Service...\n');
  
  try {
    // Initialize service
    const imageService = new FreshImageService();
    
    // Test 1: Check service configuration
    console.log('📋 Test 1: Checking service configuration...');
    console.log(`   Concurrency: ${process.env.FRESH_IMAGE_CONCURRENCY || 4}`);
    console.log(`   Max Width: ${process.env.FRESH_IMAGE_MAX_WIDTH || 800}px`);
    console.log(`   Quality: ${process.env.FRESH_IMAGE_QUALITY || 70}%`);
    console.log(`   Timeout: ${process.env.FRESH_IMAGE_TIMEOUT || 10000}ms`);
    
    // Test 2: Test single image processing
    console.log('\n📋 Test 2: Testing single image processing...');
    const testImageUrl = 'https://via.placeholder.com/800x600.jpg?text=Test+Image';
    
    const singleImageResult = await imageService.processingleImage(testImageUrl, 'test-single');
    
    if (singleImageResult.success) {
      console.log('✅ Single image processing successful');
      console.log(`   Original size: ${(singleImageResult.originalSize / 1024).toFixed(1)}KB`);
      console.log(`   Optimized size: ${(singleImageResult.optimizedSize / 1024).toFixed(1)}KB`);
      console.log(`   Compression: ${singleImageResult.compressionRatio.toFixed(1)}%`);
      console.log(`   Processing time: ${singleImageResult.processingTime}ms`);
      console.log(`   Base64 length: ${singleImageResult.base64.length} characters`);
      console.log(`   Image dimensions: ${singleImageResult.width}x${singleImageResult.height}`);
    } else {
      console.log('❌ Single image processing failed:', singleImageResult.error);
    }
    
    // Test 3: Test property image processing
    console.log('\n📋 Test 3: Testing property image processing...');
    const propertyResult = await imageService.processPropertyImages(samplePropertyData, 3);
    
    if (propertyResult) {
      console.log(`✅ Property image processing successful`);
      console.log(`   Property: ${propertyResult.reference}`);
      console.log(`   Images processed: ${propertyResult.images.length}`);
      console.log(`   Total original size: ${(propertyResult.originalSize / 1024).toFixed(1)}KB`);
      console.log(`   Total optimized size: ${(propertyResult.optimizedSize / 1024).toFixed(1)}KB`);
      console.log(`   Processing time: ${propertyResult.processingTime}ms`);
      
      if (propertyResult.images.length > 0) {
        console.log('   Sample processed image:');
        const sample = propertyResult.images[0];
        console.log(`     Dimensions: ${sample.width}x${sample.height}`);
        console.log(`     Size: ${(sample.optimizedSize / 1024).toFixed(1)}KB`);
        console.log(`     Base64 preview: ${sample.base64.substring(0, 50)}...`);
      }
    } else {
      console.log('❌ Property image processing failed');
    }
    
    // Test 4: Test complete analysis image processing
    console.log('\n📋 Test 4: Testing complete analysis processing...');
    console.log('   This will process main property + comparable properties...');
    
    const analysisResult = await imageService.processPropertyAnalysisImages(
      samplePropertyData,
      sampleComparables
    );
    
    if (analysisResult) {
      console.log('✅ Complete analysis processing successful');
      console.log('   Summary:');
      console.log(`     Total properties: ${analysisResult.summary.totalProperties}`);
      console.log(`     Images processed: ${analysisResult.summary.processedImages}`);
      console.log(`     Failed images: ${analysisResult.summary.failedImages}`);
      console.log(`     Total size before: ${(analysisResult.summary.totalSizeBefore / 1024).toFixed(1)}KB`);
      console.log(`     Total size after: ${(analysisResult.summary.totalSizeAfter / 1024).toFixed(1)}KB`);
      console.log(`     Processing time: ${analysisResult.summary.processingTime}ms`);
      
      const compressionRatio = analysisResult.summary.totalSizeBefore > 0 
        ? ((analysisResult.summary.totalSizeBefore - analysisResult.summary.totalSizeAfter) / analysisResult.summary.totalSizeBefore * 100)
        : 0;
      console.log(`     Compression: ${compressionRatio.toFixed(1)}%`);
      
      console.log('   Main Property:');
      if (analysisResult.mainProperty) {
        console.log(`     Images: ${analysisResult.mainProperty.images.length}`);
        console.log(`     Size: ${(analysisResult.mainProperty.optimizedSize / 1024).toFixed(1)}KB`);
      } else {
        console.log('     Failed to process');
      }
      
      console.log('   Comparables:');
      console.log(`     Processed: ${analysisResult.comparables.length}/${sampleComparables.length}`);
      analysisResult.comparables.forEach((comp, index) => {
        console.log(`     ${index + 1}. ${comp.reference}: ${comp.images.length} images, ${(comp.optimizedSize / 1024).toFixed(1)}KB`);
      });
    } else {
      console.log('❌ Complete analysis processing failed');
    }
    
    // Test 5: Test image variants creation
    if (singleImageResult && singleImageResult.success) {
      console.log('\n📋 Test 5: Testing image variants creation...');
      
      const variants = await imageService.createImageVariants(
        singleImageResult.base64,
        ['thumbnail', 'medium']
      );
      
      if (variants && Object.keys(variants).length > 0) {
        console.log('✅ Image variants created successfully');
        Object.keys(variants).forEach(variant => {
          console.log(`   ${variant}: ${variants[variant].length} characters`);
        });
      } else {
        console.log('❌ Image variants creation failed');
      }
    }
    
    // Test 6: Test error handling with invalid URL
    console.log('\n📋 Test 6: Testing error handling...');
    const invalidResult = await imageService.processingleImage('https://invalid-url-test.com/image.jpg', 'error-test');
    
    if (!invalidResult.success) {
      console.log('✅ Error handling working correctly');
      console.log(`   Error: ${invalidResult.error}`);
    } else {
      console.log('⚠️ Expected error handling to fail for invalid URL');
    }
    
    // Test 7: Service metrics and cleanup
    console.log('\n📋 Test 7: Checking service metrics...');
    const metrics = imageService.getMetrics();
    console.log('   Performance Metrics:');
    console.log(`     Total images: ${metrics.totalImages}`);
    console.log(`     Successful: ${metrics.successfulImages}`);
    console.log(`     Failed: ${metrics.failedImages}`);
    console.log(`     Success rate: ${metrics.successRate.toFixed(1)}%`);
    console.log(`     Compression ratio: ${metrics.compressionRatio.toFixed(1)}%`);
    console.log(`     Average processing time: ${metrics.averageProcessingTime.toFixed(0)}ms`);
    console.log(`     Total bytes processed: ${(metrics.totalBytes / 1024).toFixed(1)}KB`);
    console.log(`     Optimized bytes: ${(metrics.optimizedBytes / 1024).toFixed(1)}KB`);
    
    // Test 8: Cleanup
    console.log('\n📋 Test 8: Testing cleanup...');
    imageService.cleanup();
    console.log('✅ Cleanup completed');
    
    console.log('\n✅ Fresh Image Service test completed successfully!');
    
    // Test with image processing test
    console.log('\n📋 Bonus Test: Built-in image processing test...');
    const builtInTest = await imageService.testImageProcessing();
    
    if (builtInTest.success) {
      console.log('✅ Built-in test passed');
    } else {
      console.log('❌ Built-in test failed:', builtInTest.error);
    }
    
  } catch (error) {
    console.error('❌ Fresh Image Service test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testFreshImageService();
}

module.exports = testFreshImageService; 