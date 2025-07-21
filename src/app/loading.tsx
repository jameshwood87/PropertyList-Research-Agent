export default function Loading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: '#00ae9a', borderTopColor: 'transparent' }}></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    </div>
  )
} 