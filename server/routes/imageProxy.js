const express = require('express');
const axios = require('axios');
const router = express.Router();

// Test route to verify routing is working
router.get('/proxy-test', (req, res) => {
  res.json({ status: 'Image proxy routing is working!', timestamp: new Date().toISOString() });
});

// Image proxy endpoint to handle S3 keys
router.get('/proxy-image/*', async (req, res) => {
  try {
    // Get the S3 key from the path
    const s3Key = req.params[0];
    
    console.log(`🖼️ Image proxy request for S3 key: ${s3Key}`);
    
    // Construct full S3 URL from key
    const s3BaseUrl = 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/';
    const imageUrl = s3BaseUrl + s3Key;
    
    console.log(`📡 Fetching image: ${imageUrl}`);
    
    // Fetch the image with appropriate headers
    const response = await axios.get(imageUrl, {
      responseType: 'stream',
      timeout: 10000,
      headers: {
        'User-Agent': 'Property-Research-Agent/1.0',
        'Accept': 'image/*',
        'Cache-Control': 'no-cache'
      }
    });
    
    // Set appropriate headers for the image
    res.set({
      'Content-Type': response.headers['content-type'] || 'image/jpeg',
      'Content-Length': response.headers['content-length'],
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    });
    
    // Pipe the image data
    response.data.pipe(res);
    
  } catch (error) {
    console.error('❌ Image proxy error:', error.message);
    console.error('   S3 key:', req.params[0]);
    
    // Return a helpful error response
    res.status(404).json({
      error: 'Image not available',
      s3Key: req.params[0],
      message: 'Image could not be loaded from S3. The image may not exist or access may be restricted.',
      suggestion: 'Try refreshing the page to get updated image data'
    });
  }
});

module.exports = router; 