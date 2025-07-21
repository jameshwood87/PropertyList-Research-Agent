'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { 
  Database, 
  Zap, 
  Shield, 
  CheckCircle,
  Globe,
  FileText
} from 'lucide-react'

export default function APILandingPage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  }

  return (
    <motion.div
      className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <div className="max-w-6xl mx-auto px-4 py-16">
        
        {/* Hero Section */}
        <motion.div variants={itemVariants} className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            PropertyList Research Agent
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Professional CMA report generation API for real estate applications. 
            Integrate comprehensive property analysis directly into your platform.
          </p>
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-5 h-5 mr-2" />
              <span className="font-medium">API Ready</span>
            </div>
            <div className="flex items-center text-blue-600">
              <Shield className="w-5 h-5 mr-2" />
              <span className="font-medium">Authenticated</span>
            </div>
            <div className="flex items-center text-purple-600">
              <Zap className="w-5 h-5 mr-2" />
              <span className="font-medium">AI Powered</span>
            </div>
          </div>
        </motion.div>

        {/* API Workflow Cards */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          
          {/* Step 1: Submit Property Data */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-6">
              <Database className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">1. Submit Property Data</h3>
            <p className="text-gray-600 mb-4">
              Click the "AI Analysis" button on any property on PropertyList.es to get started.
            </p>
          </div>

          {/* Step 2: AI Processing */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-6">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">2. AI Processing</h3>
            <p className="text-gray-600 mb-4">
              Our AI analyzes market data, comparables, amenities, and generates insights.
            </p>
          </div>

          {/* Step 3: Receive CMA Report */}
          <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200">
            <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-6">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">3. Receive CMA Report</h3>
            <p className="text-gray-600 mb-4">
              Get comprehensive CMA report with PDF download capability.
            </p>
          </div>
        </motion.div>

        {/* API Features */}
        <motion.div variants={itemVariants} className="bg-gradient-to-r from-primary to-primary-dark rounded-xl p-8 text-white">
          <h2 className="text-2xl font-bold mb-6">What You Get</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            <div className="text-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Market Analysis</h3>
              <p className="text-sm opacity-90">
                Real-time market data and pricing trends
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">Comparables</h3>
              <p className="text-sm opacity-90">
                Similar properties with detailed analysis
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <Zap className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">AI Insights</h3>
              <p className="text-sm opacity-90">
                Professional investment recommendations
              </p>
            </div>

            <div className="text-center">
              <div className="w-12 h-12 bg-white bg-opacity-20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-semibold mb-2">PDF Reports</h3>
              <p className="text-sm opacity-90">
                Professional CMA reports for download
              </p>
            </div>
          </div>
        </motion.div>

        {/* Status Footer */}
        <motion.div variants={itemVariants} className="text-center mt-16">
          <p className="text-gray-600">
            Ready to integrate? Check our{' '}
            <a href="/debug" className="text-primary hover:text-primary-dark font-medium">
              debug console
            </a>{' '}
            for API logs and system status.
          </p>
        </motion.div>
      </div>
    </motion.div>
  )
} 