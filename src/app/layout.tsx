import React, { Suspense } from 'react'
import './globals.css'

export const metadata = {
  title: 'PropertyList Research Agent',
  description: 'AI-powered CMA report generation tool',
  charset: 'utf-8',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="font-sans">
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
          <Suspense fallback={
            <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
                <p className="text-gray-600">Loading...</p>
              </div>
            </div>
          }>
            {children}
          </Suspense>
        </div>
      </body>
    </html>
  )
} 