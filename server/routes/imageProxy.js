const express = require('express');
const axios = require('axios');
const router = express.Router();

// Test route to verify routing is working
router.get('/proxy-test', (req, res) => {
  res.json({ status: 'Image proxy routing is working!', timestamp: new Date().toISOString() });
});

// Image proxy endpoint to handle restricted S3 URLs
router.get('/proxy-image/:imageId', async (req, res) => {
  try {
    const imageId = req.params.imageId;
    const s3BaseUrl = 'https://propertylist-staging-assets-west.s3.eu-west-1.amazonaws.com/';
    const imageUrl = s3BaseUrl + imageId;
    
    console.log(`Proxying image: ${imageUrl}`);
    
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
    console.error('Image proxy error:', error.message);
    
    // Return a default property image placeholder
    res.status(404).json({
      error: 'Image not available',
      imageId: req.params.imageId,
      message: 'Using fallback placeholder'
    });
  }
});

module.exports = router; 