#!/usr/bin/env node

/**
 * Cleanup Test Learning Data Script
 * Removes test property data from learning system while preserving real property data
 */

const fs = require('fs')
const path = require('path')

// Learning data files to clean
const LEARNING_FILES = {
  analysisHistory: './data/learning/analysis-history.json',
  userFeedback: './data/learning/user-feedback.json',
  marketPredictions: './data/learning/market-predictions.json',
  predictionValidations: './data/learning/prediction-validations.json',
  regionalKnowledge: './data/learning/regional-knowledge.json'
}

// Test identifiers to remove
const TEST_IDENTIFIERS = [
  'test_session_123',
  'test-session-123',
  'TEST-AI-LOCATION-001',
  'test-session',
  'test_session',
  'session_1752961514130_07ennf4fw', // Recent test session
  'session_1752961437042_gt4561hms', // Recent test session
  'session_1752960284299_f2mqbfih6', // Recent test session
  'session_1752960156841_cf6edvcol', // Recent test session
  'session_1752958930835_dqjtep87b' // Recent test session
]

// Test property addresses (common test addresses)
const TEST_ADDRESSES = [
  'Calle Test',
  'Avenida Test',
  'Test Street',
  'Test Address',
  'Calle Alameda, 15', // Common test address
  'Avenida del Mar, Marbella', // Another test address
  'Calle Marbella, 123', // Test property from recent sessions
  'Calle Marbella, 456', // Test property from recent sessions
  'Calle Marbella, 789', // Test property from recent sessions
  'Puerto Banus, Marbella, MA', // Test property from recent sessions
  'Nueva Andalucia, Marbella, MA', // Test property from recent sessions
  'Calle Marbella', // Any Calle Marbella test addresses
  'Test Address, Marbella', // Test addresses in Marbella
  'Test Property', // Generic test property
  'Test Villa', // Test villa
  'Test Apartment' // Test apartment
]

function isTestData(entry) {
  // Check session ID
  if (entry.sessionId && TEST_IDENTIFIERS.some(id => entry.sessionId.includes(id))) {
    return true
  }
  
  // Check property ID (base64 encoded addresses)
  if (entry.propertyId) {
    try {
      const decodedAddress = Buffer.from(entry.propertyId, 'base64').toString('utf-8')
      if (TEST_ADDRESSES.some(addr => decodedAddress.includes(addr))) {
        return true
      }
    } catch (error) {
      // If decoding fails, check if it contains test patterns
      if (entry.propertyId.includes('test') || entry.propertyId.includes('Test')) {
        return true
      }
    }
  }
  
  // Check for test patterns in other fields
  if (entry.id && entry.id.includes('test')) {
    return true
  }
  
  return false
}

function cleanupAnalysisHistory() {
  console.log('🧹 Cleaning analysis history...')
  
  try {
    const filePath = LEARNING_FILES.analysisHistory
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ Analysis history file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = Object.keys(data).length
    const cleaned = {}
    let removed = 0
    
    for (const [propertyId, history] of Object.entries(data)) {
      if (isTestData({ propertyId })) {
        console.log(`   🗑️ Removing test property: ${propertyId}`)
        removed++
      } else {
        cleaned[propertyId] = history
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test entries, kept ${Object.keys(cleaned).length} real entries`)
    
    return { removed, kept: Object.keys(cleaned).length }
  } catch (error) {
    console.error('   ❌ Error cleaning analysis history:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function cleanupUserFeedback() {
  console.log('🧹 Cleaning user feedback...')
  
  try {
    const filePath = LEARNING_FILES.userFeedback
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ User feedback file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = data.length
    const cleaned = data.filter(entry => !isTestData(entry))
    const removed = originalCount - cleaned.length
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test entries, kept ${cleaned.length} real entries`)
    
    return { removed, kept: cleaned.length }
  } catch (error) {
    console.error('   ❌ Error cleaning user feedback:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function cleanupMarketPredictions() {
  console.log('🧹 Cleaning market predictions...')
  
  try {
    const filePath = LEARNING_FILES.marketPredictions
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ Market predictions file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = data.length
    const cleaned = data.filter(entry => !isTestData(entry))
    const removed = originalCount - cleaned.length
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test entries, kept ${cleaned.length} real entries`)
    
    return { removed, kept: cleaned.length }
  } catch (error) {
    console.error('   ❌ Error cleaning market predictions:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function cleanupPredictionValidations() {
  console.log('🧹 Cleaning prediction validations...')
  
  try {
    const filePath = LEARNING_FILES.predictionValidations
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ Prediction validations file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = data.length
    const cleaned = data.filter(entry => !isTestData(entry))
    const removed = originalCount - cleaned.length
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test entries, kept ${cleaned.length} real entries`)
    
    return { removed, kept: cleaned.length }
  } catch (error) {
    console.error('   ❌ Error cleaning prediction validations:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function cleanupRegionalKnowledge() {
  console.log('🧹 Cleaning regional knowledge...')
  
  try {
    const filePath = LEARNING_FILES.regionalKnowledge
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ Regional knowledge file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = Object.keys(data).length
    const cleaned = {}
    let removed = 0
    
    for (const [regionId, knowledge] of Object.entries(data)) {
      if (isTestData({ propertyId: regionId })) {
        console.log(`   🗑️ Removing test region: ${regionId}`)
        removed++
      } else {
        cleaned[regionId] = knowledge
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test entries, kept ${Object.keys(cleaned).length} real entries`)
    
    return { removed, kept: Object.keys(cleaned).length }
  } catch (error) {
    console.error('   ❌ Error cleaning regional knowledge:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function cleanupSessions() {
  console.log('🧹 Cleaning sessions...')
  
  try {
    const filePath = './server/sessions.json'
    if (!fs.existsSync(filePath)) {
      console.log('   ⚠️ Sessions file not found')
      return { removed: 0, kept: 0 }
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
    const originalCount = data.length
    const cleaned = data.filter(session => {
      // Check if session is a test session
      const isTest = isTestData(session) || 
                    (session.property && isTestData(session.property)) ||
                    (session.userContext && session.userContext.toLowerCase().includes('test'))
      
      if (isTest) {
        console.log(`   🗑️ Removing test session: ${session.sessionId} (${session.property?.address || 'unknown'})`)
      }
      
      return !isTest
    })
    
    const removed = originalCount - cleaned.length
    
    fs.writeFileSync(filePath, JSON.stringify(cleaned, null, 2))
    console.log(`   ✅ Removed ${removed} test sessions, kept ${cleaned.length} real sessions`)
    
    return { removed, kept: cleaned.length }
  } catch (error) {
    console.error('   ❌ Error cleaning sessions:', error.message)
    return { removed: 0, kept: 0, error: error.message }
  }
}

function showSummary(results) {
  console.log('\n📊 Cleanup Summary')
  console.log('=' .repeat(50))
  
  let totalRemoved = 0
  let totalKept = 0
  
  Object.entries(results).forEach(([file, result]) => {
    const fileName = file.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
    console.log(`${fileName}:`)
    console.log(`   Removed: ${result.removed} test entries`)
    console.log(`   Kept: ${result.kept} real entries`)
    if (result.error) {
      console.log(`   Error: ${result.error}`)
    }
    console.log()
    
    totalRemoved += result.removed || 0
    totalKept += result.kept || 0
  })
  
  console.log(`Total: Removed ${totalRemoved} test entries, kept ${totalKept} real entries`)
  
  if (totalRemoved > 0) {
    console.log('\n✅ Test data cleanup completed successfully!')
    console.log('📦 Real property data and XML feed data have been preserved.')
  } else {
    console.log('\nℹ️ No test data found to remove.')
  }
}

async function runCleanup() {
  console.log('🚀 Starting Test Learning Data Cleanup\n')
  console.log('This will remove test property data while preserving:')
  console.log('✅ Real property analysis data')
  console.log('✅ XML feed property data')
  console.log('✅ Regional knowledge from real properties')
  console.log('✅ User feedback from real sessions')
  console.log()
  
  const results = {
    analysisHistory: cleanupAnalysisHistory(),
    userFeedback: cleanupUserFeedback(),
    marketPredictions: cleanupMarketPredictions(),
    predictionValidations: cleanupPredictionValidations(),
    regionalKnowledge: cleanupRegionalKnowledge(),
    sessions: cleanupSessions()
  }
  
  showSummary(results)
}

// Run cleanup if this script is executed directly
if (require.main === module) {
  runCleanup()
}

module.exports = {
  runCleanup,
  cleanupAnalysisHistory,
  cleanupUserFeedback,
  cleanupMarketPredictions,
  cleanupPredictionValidations,
  cleanupRegionalKnowledge,
  isTestData
} 