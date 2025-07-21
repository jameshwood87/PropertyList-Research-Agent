import { useState } from 'react'
import { PropertyData } from '@/types'

interface PropertyFormProps {
  onSubmit: (data: PropertyData) => void
}

const propertyTypes = [
  'Single Family Home',
  'Townhouse',
  'Condominium',
  'Apartment',
  'Villa',
  'Penthouse',
  'Duplex',
  'Studio'
]

const transactionTypes = [
  { value: 'sale', label: 'For Sale' },
  { value: 'short-term-rental', label: 'Short-term Rental (Weekly)' },
  { value: 'long-term-rental', label: 'Long-term Rental (Monthly)' }
]

const commonFeatures = [
  'Swimming Pool',
  'Garage',
  'Garden',
  'Balcony',
  'Terrace',
  'Fireplace',
  'Air Conditioning',
  'Heating',
  'Elevator',
  'Security System',
  'Basement',
  'Attic',
  'Walk-in Closet',
  'Hardwood Floors',
  'Updated Kitchen',
  'Master Suite'
]

export default function PropertyForm({ onSubmit }: PropertyFormProps) {
  const [formData, setFormData] = useState<PropertyData>({
    address: '',
    city: '',
    province: '',
    areaCode: '',
    propertyType: '',
    isSale: true, // Default to sale
    isShortTerm: false,
    isLongTerm: false,
    bedrooms: 1,
    bathrooms: 1,
    totalAreaM2: 0,
    buildArea: 0,
    plotArea: undefined,
    terraceAreaM2: undefined,
    lotSize: '',
    yearBuilt: undefined,
    features: [],
    description: '',
    price: undefined,
    dateListed: undefined
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  const handleFeatureToggle = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature]
    }))
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Property Details</h2>
        <p className="text-gray-600">
          Enter the property information to generate a comprehensive CMA report
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Address Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
              Property Address *
            </label>
            <input
              type="text"
              id="address"
              required
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="123 Main Street"
            />
          </div>
          
          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
              City *
            </label>
            <input
              type="text"
              id="city"
              required
              value={formData.city}
              onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Madrid"
            />
          </div>
          
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
              State/Region *
            </label>
            <input
              type="text"
              id="state"
              required
              value={formData.province}
                              onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Madrid"
            />
          </div>
          
          <div>
            <label htmlFor="areaCode" className="block text-sm font-medium text-gray-700 mb-1">
              Area Code
            </label>
            <input
              type="text"
              id="areaCode"
              value={formData.areaCode}
              onChange={(e) => setFormData(prev => ({ ...prev, areaCode: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="28001"
            />
          </div>
          
          <div>
            <label htmlFor="propertyType" className="block text-sm font-medium text-gray-700 mb-1">
              Property Type *
            </label>
            <select
              id="propertyType"
              required
              value={formData.propertyType}
              onChange={(e) => setFormData(prev => ({ ...prev, propertyType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="">Select type</option>
              {propertyTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="transactionType" className="block text-sm font-medium text-gray-700 mb-1">
              Transaction Type *
            </label>
            <select
              id="transactionType"
              required
              value={formData.isSale ? 'sale' : formData.isShortTerm ? 'short-term-rental' : 'long-term-rental'}
              onChange={(e) => {
                const value = e.target.value;
                setFormData(prev => ({
                  ...prev,
                  isSale: value === 'sale',
                  isShortTerm: value === 'short-term-rental',
                  isLongTerm: value === 'long-term-rental'
                }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            >
              <option value="sale">For Sale</option>
              <option value="short-term-rental">Short-term Rental (Weekly)</option>
              <option value="long-term-rental">Long-term Rental (Monthly)</option>
            </select>
          </div>
        </div>

        {/* Property Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="bedrooms" className="block text-sm font-medium text-gray-700 mb-1">
              Bedrooms *
            </label>
            <input
              type="number"
              id="bedrooms"
              min="0"
              required
              value={formData.bedrooms}
              onChange={(e) => setFormData(prev => ({ ...prev, bedrooms: parseInt(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="bathrooms" className="block text-sm font-medium text-gray-700 mb-1">
              Bathrooms *
            </label>
            <input
              type="number"
              id="bathrooms"
              min="0"
              step="0.5"
              required
              value={formData.bathrooms}
              onChange={(e) => setFormData(prev => ({ ...prev, bathrooms: parseFloat(e.target.value) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="yearBuilt" className="block text-sm font-medium text-gray-700 mb-1">
              Year Built
            </label>
            <input
              type="number"
              id="yearBuilt"
              min="1800"
              max={new Date().getFullYear()}
              value={formData.yearBuilt || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, yearBuilt: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="2020"
            />
          </div>
        </div>

        {/* Area Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Area Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label htmlFor="totalAreaM2" className="block text-sm font-medium text-gray-700 mb-1">
                Total Area (m²) *
              </label>
              <input
                type="number"
                id="totalAreaM2"
                min="0"
                required
                value={formData.totalAreaM2}
                onChange={(e) => setFormData(prev => ({ ...prev, totalAreaM2: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="120"
              />
            </div>
            
            <div>
              <label htmlFor="buildArea" className="block text-sm font-medium text-gray-700 mb-1">
                Build Area (m²) *
              </label>
              <input
                type="number"
                id="buildArea"
                min="0"
                required
                value={formData.buildArea || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, buildArea: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="100"
              />
            </div>
            
            <div>
              <label htmlFor="terraceAreaM2" className="block text-sm font-medium text-gray-700 mb-1">
                Terrace Area (m²)
              </label>
              <input
                type="number"
                id="terraceAreaM2"
                min="0"
                value={formData.terraceAreaM2 || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, terraceAreaM2: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="20"
              />
            </div>
            
            <div>
              <label htmlFor="plotArea" className="block text-sm font-medium text-gray-700 mb-1">
                Plot Area (m²)
              </label>
              <input
                type="number"
                id="plotArea"
                min="0"
                value={formData.plotArea || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, plotArea: e.target.value ? parseInt(e.target.value) : undefined }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="200"
              />
            </div>
          </div>
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
          <div>
            <label htmlFor="lotSize" className="block text-sm font-medium text-gray-700 mb-1">
              Lot Size Description
            </label>
            <input
              type="text"
              id="lotSize"
              value={formData.lotSize}
              onChange={(e) => setFormData(prev => ({ ...prev, lotSize: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Corner lot, flat terrain, south-facing"
            />
          </div>
        </div>

        {/* Pricing Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1">
              Asking Price
            </label>
            <input
              type="number"
              id="price"
              min="0"
              value={formData.price || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value ? parseInt(e.target.value) : undefined }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="450000"
            />
          </div>
          
          <div>
            <label htmlFor="dateListed" className="block text-sm font-medium text-gray-700 mb-1">
              Date Listed
            </label>
            <input
              type="date"
              id="dateListed"
              value={formData.dateListed || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, dateListed: e.target.value || undefined }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            />
          </div>
        </div>

        {/* Features */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Property Features
          </label>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {commonFeatures.map(feature => (
              <label key={feature} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.features.includes(feature)}
                  onChange={() => handleFeatureToggle(feature)}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <span className="text-sm text-gray-700">{feature}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
            Additional Description
          </label>
          <textarea
            id="description"
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
            placeholder="Any additional details about the property..."
          />
        </div>

        {/* Submit Button */}
        <div className="pt-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-primary to-primary-light text-white font-medium py-3 px-6 rounded-lg hover:from-primary-dark hover:to-primary transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            Generate Property Analysis
          </button>
        </div>
      </form>
    </div>
  )
} 