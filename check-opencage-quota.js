const { Pool } = require('pg');
const geocodingConfig = require('./config/geocoding.config.js');

class OpenCageQuotaMonitor {
  constructor(silentMode = false) {
    this.pool = new Pool({
      connectionString: 'postgresql://postgres:dev_password_123@localhost:5433/propertylist_db'
    });
    this.silentMode = silentMode || !geocodingConfig.debug.enableConsoleOutput;
  }

  async checkQuotaStatus() {
    try {
      if (!this.silentMode) {
        console.log('📊 OPENCAGE FREE TIER QUOTA MONITOR');
        console.log('==================================');
      }
      
      // Ensure all tracking tables exist
      await this.createQuotaTablesIfNeeded();
      
      // Get today's usage
      const today = new Date().toISOString().split('T')[0];
      const todayUsage = await this.getDailyUsage(today);
      
      // Get hourly patterns for today
      const hourlyPattern = await this.getHourlyPattern(today);
      
      // Get this week's usage
      const weekUsage = await this.getWeeklyUsage();
      
      // Get performance metrics
      const performanceMetrics = await this.getPerformanceMetrics();
      
      // Check quota status
      const quotaStatus = this.analyzeQuotaStatus(todayUsage);
      
      if (!this.silentMode) {
        // Display detailed status for developers
        this.displayQuotaStatus(todayUsage, weekUsage, performanceMetrics);
        this.displayUsagePatterns(hourlyPattern, performanceMetrics);
        this.checkQuotaAlerts(todayUsage, hourlyPattern);
      }
      
      return {
        today: todayUsage,
        week: weekUsage,
        hourlyPattern: hourlyPattern,
        performance: performanceMetrics,
        status: quotaStatus,
        withinLimits: todayUsage < geocodingConfig.opencage.dailyQuotaLimit * 0.9
      };
      
    } catch (error) {
      if (!this.silentMode) {
        console.error('❌ Error checking quota:', error.message);
      }
      return {
        today: 0,
        week: 0,
        hourlyPattern: [],
        performance: { last24h: {}, methodPerformance: [] },
        status: 'error',
        withinLimits: true,
        error: error.message
      };
    } finally {
      await this.pool.end();
    }
  }

  analyzeQuotaStatus(todayUsage) {
    const limit = geocodingConfig.opencage.dailyQuotaLimit;
    const percentage = todayUsage / limit;
    
    if (todayUsage >= limit) return 'exceeded';
    if (percentage >= 0.9) return 'critical';
    if (percentage >= 0.8) return 'warning';
    if (percentage >= 0.6) return 'moderate';
    return 'good';
  }

  async createQuotaTablesIfNeeded() {
    try {
      // Daily quota table (existing)
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS opencage_daily_quota (
          date DATE PRIMARY KEY,
          request_count INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // Hourly usage tracking for AI learning
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS opencage_hourly_usage (
          id SERIAL PRIMARY KEY,
          date DATE NOT NULL,
          hour INTEGER NOT NULL, -- 0-23
          request_count INTEGER DEFAULT 0,
          success_count INTEGER DEFAULT 0,
          failure_count INTEGER DEFAULT 0,
          avg_response_time_ms INTEGER DEFAULT 0,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(date, hour)
        )
      `);

      // Request performance tracking
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS opencage_request_log (
          id SERIAL PRIMARY KEY,
          timestamp TIMESTAMP DEFAULT NOW(),
          query_text TEXT,
          success BOOLEAN,
          response_time_ms INTEGER,
          confidence_score REAL,
          method TEXT, -- 'opencage' or 'fallback_google'
          error_type TEXT,
          batch_operation BOOLEAN DEFAULT FALSE,
          property_count INTEGER DEFAULT 1, -- how many properties this request helped
          cache_hit BOOLEAN DEFAULT FALSE
        )
      `);

      if (!this.silentMode) {
        console.log('✅ Enhanced tracking tables ready for AI learning');
      }
    } catch (error) {
      if (!this.silentMode) {
        console.error('Error creating enhanced tables:', error);
      }
    }
  }

  async logRequest(queryText, success, responseTimeMs, confidenceScore = null, method = 'opencage', errorType = null, batchOperation = false, propertyCount = 1, cacheHit = false) {
    try {
      await this.pool.query(`
        INSERT INTO opencage_request_log 
        (query_text, success, response_time_ms, confidence_score, method, error_type, batch_operation, property_count, cache_hit)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [queryText, success, responseTimeMs, confidenceScore, method, errorType, batchOperation, propertyCount, cacheHit]);

      // Update hourly tracking
      const now = new Date();
      const date = now.toISOString().split('T')[0];
      const hour = now.getHours();

      await this.pool.query(`
        INSERT INTO opencage_hourly_usage (date, hour, request_count, success_count, failure_count, avg_response_time_ms)
        VALUES ($1, $2, 1, $3, $4, $5)
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          request_count = opencage_hourly_usage.request_count + 1,
          success_count = opencage_hourly_usage.success_count + $3,
          failure_count = opencage_hourly_usage.failure_count + $4,
          avg_response_time_ms = (opencage_hourly_usage.avg_response_time_ms + $5) / 2
      `, [date, hour, success ? 1 : 0, success ? 0 : 1, responseTimeMs || 0]);

    } catch (error) {
      // Silent fail - logging is non-critical
      if (!this.silentMode) {
        console.error('Error logging request:', error);
      }
    }
  }

  async getHourlyPattern(date) {
    try {
      const result = await this.pool.query(`
        SELECT 
          hour,
          request_count,
          success_count,
          failure_count,
          avg_response_time_ms,
          CASE WHEN request_count > 0 THEN (success_count::REAL / request_count::REAL * 100) ELSE 0 END as success_rate
        FROM opencage_hourly_usage 
        WHERE date = $1 
        ORDER BY hour
      `, [date]);
      
      return result.rows;
    } catch (error) {
      return [];
    }
  }

  async getPerformanceMetrics() {
    try {
      const last24h = await this.pool.query(`
        SELECT 
          COUNT(*) as total_requests,
          COUNT(*) FILTER (WHERE success = true) as successful_requests,
          COUNT(*) FILTER (WHERE method = 'opencage') as opencage_requests,
          COUNT(*) FILTER (WHERE method = 'fallback_google') as fallback_requests,
          COUNT(*) FILTER (WHERE cache_hit = true) as cache_hits,
          AVG(response_time_ms) as avg_response_time,
          AVG(confidence_score) FILTER (WHERE confidence_score IS NOT NULL) as avg_confidence,
          SUM(property_count) as total_properties_helped
        FROM opencage_request_log 
        WHERE timestamp >= NOW() - INTERVAL '24 hours'
      `);

      const queryPatterns = await this.pool.query(`
        SELECT 
          method,
          COUNT(*) as count,
          AVG(confidence_score) as avg_confidence,
          AVG(response_time_ms) as avg_response_time
        FROM opencage_request_log 
        WHERE timestamp >= NOW() - INTERVAL '7 days'
        GROUP BY method
        ORDER BY count DESC
      `);

      return {
        last24h: last24h.rows[0],
        methodPerformance: queryPatterns.rows
      };
    } catch (error) {
      return { last24h: {}, methodPerformance: [] };
    }
  }

  async getDailyUsage(date) {
    const result = await this.pool.query(
      'SELECT request_count FROM opencage_daily_quota WHERE date = $1',
      [date]
    );
    
    return result.rows.length > 0 ? result.rows[0].request_count : 0;
  }

  async getWeeklyUsage() {
    const result = await this.pool.query(`
      SELECT COALESCE(SUM(request_count), 0) as total
      FROM opencage_daily_quota 
      WHERE date >= CURRENT_DATE - INTERVAL '7 days'
    `);
    
    return parseInt(result.rows[0].total);
  }

  displayQuotaStatus(todayUsage, weekUsage, performanceMetrics) {
    const dailyLimit = geocodingConfig.opencage.dailyQuotaLimit;
    const dailyPercentage = (todayUsage / dailyLimit * 100).toFixed(1);
    
    console.log(`📅 Today's Usage: ${todayUsage}/${dailyLimit} requests (${dailyPercentage}%)`);
    console.log(`📅 Weekly Usage: ${weekUsage} requests`);
    console.log('');
    
    // Visual progress bar for today
    const barLength = 20;
    const filled = Math.floor(todayUsage / dailyLimit * barLength);
    const empty = barLength - filled;
    const progressBar = '█'.repeat(filled) + '░'.repeat(empty);
    
    console.log(`Daily Progress: [${progressBar}] ${dailyPercentage}%`);
    console.log('');
    
    // Enhanced status with AI learning data
    if (performanceMetrics.last24h.total_requests > 0) {
      const successRate = (performanceMetrics.last24h.successful_requests / performanceMetrics.last24h.total_requests * 100).toFixed(1);
      const avgResponseTime = Math.round(performanceMetrics.last24h.avg_response_time || 0);
      const cacheEfficiency = (performanceMetrics.last24h.cache_hits / performanceMetrics.last24h.total_requests * 100).toFixed(1);
      
      console.log(`📊 24h Performance:`);
      console.log(`   Success Rate: ${successRate}%`);
      console.log(`   Avg Response: ${avgResponseTime}ms`);
      console.log(`   Cache Efficiency: ${cacheEfficiency}%`);
      console.log(`   Properties Helped: ${performanceMetrics.last24h.total_properties_helped || 0}`);
      console.log('');
    }
    
    // Status indicator
    const status = this.analyzeQuotaStatus(todayUsage);
    const statusMessages = {
      good: '✅ Status: GOOD - Well within limits',
      moderate: '🟡 Status: MODERATE - Regular usage',
      warning: '🟠 Status: WARNING - High usage',
      critical: '🔴 Status: CRITICAL - Near limit',
      exceeded: '🚫 Status: EXCEEDED - Quota exhausted'
    };
    
    console.log(statusMessages[status] || statusMessages.good);
  }

  displayUsagePatterns(hourlyPattern, performanceMetrics) {
    console.log('\n🧠 AI LEARNING DATA:');
    console.log('===================');
    
    if (hourlyPattern.length > 0) {
      console.log('📈 Hourly Usage Pattern (Today):');
      
      // Find peak hours
      const peakHour = hourlyPattern.reduce((peak, current) => 
        current.request_count > peak.request_count ? current : peak
      );
      
      const lowHours = hourlyPattern.filter(h => h.request_count === 0);
      
      hourlyPattern.forEach(hour => {
        const bar = '█'.repeat(Math.floor(hour.request_count / 10)) || '░';
        const successRate = hour.request_count > 0 ? (hour.success_rate || 0).toFixed(0) : '0';
        console.log(`   ${hour.hour.toString().padStart(2, '0')}:00 [${bar.padEnd(5, '░')}] ${hour.request_count} req (${successRate}% success)`);
      });
      
      console.log(`\n🎯 Peak Hour: ${peakHour.hour}:00 (${peakHour.request_count} requests)`);
      console.log(`💤 Quiet Hours: ${lowHours.length} hours with no usage`);
    }
    
    if (performanceMetrics.methodPerformance.length > 0) {
      console.log('\n🔧 Method Performance (7 days):');
      performanceMetrics.methodPerformance.forEach(method => {
        const avgConf = method.avg_confidence ? (method.avg_confidence * 100).toFixed(1) + '%' : 'N/A';
        const avgTime = Math.round(method.avg_response_time || 0);
        console.log(`   ${method.method}: ${method.count} uses, ${avgConf} confidence, ${avgTime}ms avg`);
      });
    }
    
    console.log('\n💡 AI Optimization Opportunities:');
    if (hourlyPattern.length > 0) {
      const quietHours = hourlyPattern.filter(h => h.request_count === 0).map(h => `${h.hour}:00`);
      if (quietHours.length > 0) {
        console.log(`   ⏰ Schedule batch jobs during quiet hours: ${quietHours.slice(0, 3).join(', ')}`);
      }
    }
    
    if (performanceMetrics.last24h.cache_hits && performanceMetrics.last24h.total_requests) {
      const cacheRate = performanceMetrics.last24h.cache_hits / performanceMetrics.last24h.total_requests;
      if (cacheRate < 0.3) {
        console.log(`   💾 Low cache hit rate (${(cacheRate * 100).toFixed(1)}%) - consider warming more locations`);
      }
    }
  }

  checkQuotaAlerts(todayUsage, hourlyPattern) {
    const dailyLimit = geocodingConfig.opencage.dailyQuotaLimit;
    const remaining = dailyLimit - todayUsage;
    
    console.log('\n🚨 QUOTA ALERTS:');
    
    if (todayUsage >= dailyLimit) {
      console.log('❌ DAILY LIMIT EXCEEDED!');
      console.log('   - All OpenCage requests will fail today');
      console.log('   - System will fallback to Google Maps');
      console.log('   - Quota resets at midnight UTC');
    } else if (remaining < 100) {
      console.log('⚠️ CRITICAL: Less than 100 requests remaining today');
      console.log(`   - Only ${remaining} requests left`);
      console.log('   - Consider pausing batch operations');
    } else if (remaining < 500) {
      console.log('🟡 WARNING: Less than 500 requests remaining today');
      console.log(`   - ${remaining} requests left`);
      console.log('   - Monitor usage carefully');
    } else {
      console.log('✅ No alerts - quota is healthy');
    }

    // Predictive alerts based on hourly patterns
    if (hourlyPattern.length > 0) {
      const currentHour = new Date().getHours();
      const recentUsage = hourlyPattern.filter(h => h.hour >= currentHour - 2 && h.hour <= currentHour);
      const avgRecentUsage = recentUsage.reduce((sum, h) => sum + h.request_count, 0) / Math.max(recentUsage.length, 1);
      
      const remainingHours = 24 - currentHour;
      const projectedUsage = todayUsage + (avgRecentUsage * remainingHours);
      
      if (projectedUsage > dailyLimit * 0.9) {
        console.log(`\n🔮 PREDICTIVE ALERT: Current usage trend suggests ${Math.round(projectedUsage)} total requests today`);
        console.log('   - Consider reducing batch size or frequency');
      }
    }
  }

  async resetQuotaForTesting() {
    try {
      const today = new Date().toISOString().split('T')[0];
      await this.pool.query(
        'UPDATE opencage_daily_quota SET request_count = 0 WHERE date = $1',
        [today]
      );
      if (!this.silentMode) {
        console.log('✅ Today\'s quota reset to 0 for testing');
      }
    } catch (error) {
      if (!this.silentMode) {
        console.error('❌ Error resetting quota:', error);
      }
    }
  }

  async simulateUsage(requests = 100) {
    try {
      const today = new Date().toISOString().split('T')[0];
      await this.pool.query(`
        INSERT INTO opencage_daily_quota (date, request_count) 
        VALUES ($1, $2)
        ON CONFLICT (date) 
        DO UPDATE SET request_count = opencage_daily_quota.request_count + $2
      `, [today, requests]);
      
      // Also simulate some hourly data for AI learning
      const currentHour = new Date().getHours();
      await this.pool.query(`
        INSERT INTO opencage_hourly_usage (date, hour, request_count, success_count, failure_count, avg_response_time_ms)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date, hour) 
        DO UPDATE SET 
          request_count = opencage_hourly_usage.request_count + $3,
          success_count = opencage_hourly_usage.success_count + $4,
          failure_count = opencage_hourly_usage.failure_count + $5
      `, [today, currentHour, requests, Math.floor(requests * 0.9), Math.floor(requests * 0.1), 250]);
      
      if (!this.silentMode) {
        console.log(`✅ Simulated ${requests} additional requests for testing`);
      }
    } catch (error) {
      if (!this.silentMode) {
        console.error('❌ Error simulating usage:', error);
      }
    }
  }

  async analyzeOptimalTiming() {
    try {
      if (!this.silentMode) {
        console.log('\n🕐 OPTIMAL TIMING ANALYSIS');
        console.log('=========================');
      }
      
      const result = await this.pool.query(`
        SELECT 
          hour,
          AVG(request_count) as avg_requests,
          AVG(success_count::REAL / NULLIF(request_count, 0) * 100) as avg_success_rate,
          AVG(avg_response_time_ms) as avg_response_time
        FROM opencage_hourly_usage 
        WHERE date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY hour
        ORDER BY avg_requests ASC
      `);
      
      const bestHours = result.rows.slice(0, 5);
      const worstHours = result.rows.slice(-5);
      
      if (!this.silentMode) {
        console.log('🟢 Best Hours for Batch Operations:');
        bestHours.forEach(hour => {
          console.log(`   ${hour.hour.toString().padStart(2, '0')}:00 - Low usage (${Math.round(hour.avg_requests)} avg), ${(hour.avg_success_rate || 0).toFixed(1)}% success`);
        });
        
        console.log('\n🔴 Avoid These Peak Hours:');
        worstHours.forEach(hour => {
          console.log(`   ${hour.hour.toString().padStart(2, '0')}:00 - High usage (${Math.round(hour.avg_requests)} avg), ${(hour.avg_success_rate || 0).toFixed(1)}% success`);
        });
      }
      
      return { bestHours, worstHours };
      
    } catch (error) {
      if (!this.silentMode) {
        console.log('❌ Error analyzing timing:', error);
      }
      return { bestHours: [], worstHours: [] };
    }
  }

  /**
   * Simple status check for production use (silent)
   */
  async getSimpleStatus() {
    const monitor = new OpenCageQuotaMonitor(true); // Silent mode
    const status = await monitor.checkQuotaStatus();
    return {
      withinLimits: status.withinLimits,
      usage: status.today,
      status: status.status
    };
  }
}

// Main execution
async function main() {
  const monitor = new OpenCageQuotaMonitor();
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'reset') {
    await monitor.resetQuotaForTesting();
  } else if (command === 'simulate') {
    const requests = parseInt(args[1]) || 100;
    await monitor.simulateUsage(requests);
  } else if (command === 'timing') {
    await monitor.analyzeOptimalTiming();
  } else if (command === 'status') {
    // Simple status for production monitoring
    const status = await monitor.getSimpleStatus();
    console.log(JSON.stringify(status));
  } else {
    await monitor.checkQuotaStatus();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = OpenCageQuotaMonitor; 