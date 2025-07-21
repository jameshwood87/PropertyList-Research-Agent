'use client'

import { useState } from 'react'

export default function DebugTavilyPage() {
  const [query, setQuery] = useState('real estate investment trends in Urbanización Monte Alto, Benahavis, Málaga')
  const [results, setResults] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testTavilySearch = async () => {
    setLoading(true)
    setError(null)
    setResults(null)

    try {
      console.log('Testing Tavily search with query:', query)
      
      // Call our API endpoint to test Tavily search
      const response = await fetch('/api/debug/tavily-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data = await response.json()
      setResults(data)
    } catch (err) {
      console.error('Tavily test error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const testQueries = [
    'real estate investment trends in Urbanización Monte Alto, Benahavis, Málaga',
    'property values and market analysis Urbanización Monte Alto, Benahavis, Málaga',
    'neighbourhood safety and crime rates Urbanización Monte Alto, Benahavis, Málaga',
    'real estate investment trends in Benahavis, Málaga',
    'property market Marbella Costa del Sol',
    'real estate investment Spain'
  ]

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Debug Tavily Search</h1>
      
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Search Query:</label>
        <div className="space-y-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full border rounded px-3 py-2 h-20"
            placeholder="Enter Tavily search query"
          />
          <div className="flex gap-2">
            <button
              onClick={testTavilySearch}
              disabled={loading}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Test Search'}
            </button>
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Quick Test Queries:</h3>
        <div className="grid grid-cols-1 gap-2">
          {testQueries.map((testQuery, index) => (
            <button
              key={index}
              onClick={() => setQuery(testQuery)}
              className="text-left p-2 border rounded hover:bg-gray-50 text-sm"
            >
              {testQuery}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-semibold text-red-800 mb-2">Error:</h3>
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {results && (
        <div className="space-y-6">
          <div className="bg-gray-50 p-4 rounded">
            <h2 className="font-semibold mb-2">Search Results Summary:</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Status: <span className="font-mono">{results.success ? 'Success' : 'Failed'}</span></div>
              <div>Results Count: <span className="font-mono">{results.results?.length || 0}</span></div>
              <div>Response Time: <span className="font-mono">{results.responseTime}ms</span></div>
              <div>Query Length: <span className="font-mono">{query.length} chars</span></div>
            </div>
          </div>

          {results.results && results.results.length > 0 && (
            <div className="bg-white border rounded">
              <h2 className="font-semibold p-4 border-b">Search Results:</h2>
              <div className="divide-y max-h-96 overflow-auto">
                {results.results.map((result: any, index: number) => (
                  <div key={index} className="p-4">
                    <div className="font-medium text-blue-600 mb-1">
                      <a href={result.url} target="_blank" rel="noopener noreferrer">
                        {result.title}
                      </a>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{result.content}</p>
                    <div className="text-xs text-gray-400">
                      Score: {result.score} | URL: {result.url}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {results.results && results.results.length === 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
              <h3 className="font-semibold text-yellow-800 mb-2">No Results Found</h3>
              <p className="text-yellow-700">
                The search query returned no results. This could be why neighbourhood insights failed.
              </p>
            </div>
          )}

          <div className="bg-gray-50 p-4 rounded">
            <h2 className="font-semibold mb-2">Full Response (JSON):</h2>
            <pre className="text-xs overflow-auto max-h-64 bg-white p-2 border rounded">
              {JSON.stringify(results, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
} 