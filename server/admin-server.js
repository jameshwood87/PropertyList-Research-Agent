/**
 * Separate Admin Server - Complete Isolation
 * 
 * This server runs independently on a different port (e.g., 3001)
 * and is completely hidden from regular users of the main application.
 * 
 * Usage: node server/admin-server.js
 * Access: http://localhost:3001/admin
 */

const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const app = express();
app.use(express.json());

// Admin-only configuration
const ADMIN_PORT = process.env.ADMIN_PORT || 3001;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

// Import necessary services (shared from main server)
const PostgresDatabase = require('./database/postgresDatabase');
const EnhancedAIAnalysisService = require('./services/enhancedAIAnalysisService');
const AdvancedMonitoringService = require('./services/advancedMonitoringService');
const PredictiveAnalyticsService = require('./services/predictiveAnalyticsService');
const StreamingResponseService = require('./services/streamingResponseService');
const EnterpriseDashboardService = require('./services/enterpriseDashboardService');

let enterpriseDashboardService;
let propertyDatabase;

// Initialize services
async function initializeAdminServices() {
  try {
    // Initialize database connection
    propertyDatabase = new PostgresDatabase();
    await propertyDatabase.initialize();
    
    // Initialize monitoring service
    const monitoringService = new AdvancedMonitoringService(propertyDatabase);
    await monitoringService.initialize();
    
    // Initialize predictive analytics
    const predictiveAnalyticsService = new PredictiveAnalyticsService(propertyDatabase);
    
    // Initialize streaming service
    const streamingService = new StreamingResponseService();
    
    // Initialize enterprise dashboard
    enterpriseDashboardService = new EnterpriseDashboardService(
      propertyDatabase,
      monitoringService,
      predictiveAnalyticsService,
      streamingService
    );
    
    console.log('✅ Admin server services initialized');
  } catch (error) {
    console.error('❌ Failed to initialize admin services:', error);
    process.exit(1);
  }
}

// Security middleware for admin server
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (error) {
    console.error('❌ Invalid admin token:', error.message);
    return res.status(403).json({ error: 'Invalid authentication' });
  }
}

// Admin login endpoint
app.post('/api/admin/login', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password !== ADMIN_PASSWORD) {
      console.warn('🚨 Failed admin login attempt from:', req.ip);
      return res.status(401).json({
        success: false,
        message: 'Invalid password'
      });
    }

    const token = jwt.sign(
      {
        admin: true,
        loginTime: new Date().toISOString(),
        ip: req.ip
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    console.log('✅ Admin login successful from:', req.ip);

    res.json({
      success: true,
      token: token,
      expiresIn: '24h',
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

// Admin dashboard data endpoint
app.get('/api/admin/dashboard-data', authenticateAdmin, async (req, res) => {
  try {
    if (!enterpriseDashboardService) {
      return res.status(503).json({
        error: 'Dashboard service not available'
      });
    }

    const dashboardData = await enterpriseDashboardService.getDashboardData();

    res.json({
      success: true,
      data: dashboardData,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error fetching dashboard data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

// Admin logout endpoint
app.post('/api/admin/logout', authenticateAdmin, (req, res) => {
  console.log(`🔐 Admin logout from IP: ${req.ip}`);
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

// Serve admin static files
app.get('/admin', (req, res) => {
  const loginPath = path.join(__dirname, '..', 'admin-login.html');
  if (fs.existsSync(loginPath)) {
    res.sendFile(loginPath);
  } else {
    res.status(404).send('Admin page not found');
  }
});

app.get('/admin/dashboard', (req, res) => {
  const dashboardPath = path.join(__dirname, '..', 'admin-dashboard.html');
  if (fs.existsSync(dashboardPath)) {
    res.sendFile(dashboardPath);
  } else {
    res.status(404).send('Dashboard not found');
  }
});

// Health check for admin server
app.get('/api/admin/health', (req, res) => {
  res.json({
    status: 'healthy',
    server: 'admin-only',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: !!propertyDatabase,
      dashboard: !!enterpriseDashboardService
    }
  });
});

// Start admin server
async function startAdminServer() {
  await initializeAdminServices();
  
  app.listen(ADMIN_PORT, () => {
    console.log(`🔐 Admin server running on port ${ADMIN_PORT}`);
    console.log(`🌐 Admin dashboard: http://localhost:${ADMIN_PORT}/admin`);
    console.log(`🔒 This server is COMPLETELY SEPARATE from main application`);
    console.log(`👤 Regular users have NO WAY to discover this exists`);
  });
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🔐 Shutting down admin server...');
  if (propertyDatabase) {
    await propertyDatabase.disconnect();
  }
  process.exit(0);
});

// Start the admin server
if (require.main === module) {
  startAdminServer().catch(console.error);
}

module.exports = { app, startAdminServer }; 