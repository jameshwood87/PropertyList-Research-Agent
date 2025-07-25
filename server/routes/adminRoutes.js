const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const router = express.Router();

// Admin configuration
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123'; // Change this in production!
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRES_IN = '24h';

/**
 * Admin Routes Module
 * 
 * Handles all admin-related functionality:
 * - Authentication (login/logout)
 * - Dashboard data serving
 * - Static admin page serving
 * - Health checks
 * 
 * Security Features:
 * - JWT-based authentication
 * - Password protection
 * - No links from main application
 * - Protected API endpoints
 */

// Authentication middleware for admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      error: 'Access denied. No token provided.',
      redirectTo: '/admin/login'
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('❌ Invalid admin token:', error.message);
    return res.status(403).json({
      error: 'Invalid token. Please log in again.',
      redirectTo: '/admin/login'
    });
  }
};

// Admin login endpoint
router.post('/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password !== ADMIN_PASSWORD) {
      console.warn('🚨 Failed admin login attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        admin: true,
        loginTime: new Date().toISOString(),
        ip: req.ip
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log('✅ Admin login successful from:', req.ip);

    res.json({
      success: true,
      token: token,
      expiresIn: JWT_EXPIRES_IN,
      message: 'Login successful'
    });

  } catch (error) {
    console.error('❌ Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Admin logout endpoint (protected)
router.post('/logout', authenticateAdmin, (req, res) => {
  console.log(`🔐 Admin logout from IP: ${req.ip}`);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Admin dashboard data endpoint (protected)
router.get('/dashboard-data', authenticateAdmin, async (req, res) => {
  try {
    console.log('📊 Fetching admin dashboard data...');

    const enterpriseDashboardService = req.app.locals.enterpriseDashboardService;
    
    if (!enterpriseDashboardService) {
      return res.status(503).json({
        error: 'Enterprise Dashboard Service not available',
        fallback: true
      });
    }

    // Get comprehensive dashboard data
    const dashboardData = await enterpriseDashboardService.getDashboardData();

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString(),
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);

    // Return fallback data structure
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      fallback: {
        systemStatus: {
          status: 'error',
          services: { monitoring: false, streaming: false, analytics: false },
          uptime: process.uptime()
        },
        metrics: {
          totalAnalyses: 0,
          avgResponseTime: 0,
          successRate: 0,
          totalCost: 0
        },
        message: 'Dashboard temporarily unavailable'
      }
    });
  }
});

// Health check endpoint for admin dashboard
router.get('/health', (req, res) => {
  const app = req.app;
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: !!app.locals.propertyDatabase,
      enterpriseDashboard: !!app.locals.enterpriseDashboardService,
      monitoring: !!app.locals.comparableService?.aiAnalysis?.monitoringService,
      streaming: !!app.locals.streamingService,
      predictiveAnalytics: !!app.locals.comparableService?.aiAnalysis?.predictiveAnalyticsService
    },
    memory: process.memoryUsage(),
    version: process.version
  };

  res.json(health);
});

// Static file serving for admin pages
router.get('/', (req, res) => {
  // Check if user has valid token, redirect accordingly
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      jwt.verify(token, JWT_SECRET);
      // Valid token, redirect to dashboard
      return res.redirect('/admin/dashboard');
    } catch (error) {
      // Invalid token, continue to login
    }
  }
  
  res.sendFile(path.join(__dirname, '../admin-login.html'));
});

router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-login.html'));
});

router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin-dashboard.html'));
});

module.exports = {
  router,
  authenticateAdmin,
  ADMIN_PASSWORD,
  JWT_SECRET,
  JWT_EXPIRES_IN
}; 