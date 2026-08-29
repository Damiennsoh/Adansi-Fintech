import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  ShoppingBag, ArrowLeft, Search, Tag, Users, 
  Star, ChevronRight, CheckCircle2, AlertCircle
} from 'lucide-react'
import { formatCurrency } from '../lib/utils'

const categories = [
  { key: 'all', label: 'All Deals' },
  { key: 'funeral', label: 'Funeral' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'health', label: 'Health' },
  { key: 'education', label: 'Education' },
]

const mockDeals = [
  {
    id: 1,
    title: 'Premium Coffin Package',
    merchant: 'Divine Funeral Services',
    category: 'funeral',
    originalPrice: 3500,
    dealPrice: 2800,
    minGroupSize: 20,
    sold: 45,
    rating: 4.8,
    image: '🪦',
    badge: '20% OFF',
  },
  {
    id: 2,
    title: 'Wedding Catering (100 guests)',
    merchant: 'Royal Feast Catering',
    category: 'wedding',
    originalPrice: 8000,
    dealPrice: 6400,
    minGroupSize: 15,
    sold: 28,
    rating: 4.9,
    image: '🍽️',
    badge: '20% OFF',
  },
  {
    id: 3,
    title: 'Hospital Cash Cover (1 year)',
    merchant: 'Enterprise Life',
    category: 'health',
    originalPrice: 240,
    dealPrice: 180,
    minGroupSize: 10,
    sold: 156,
    rating: 4.7,
    image: '🏥',
    badge: '25% OFF',
  },
  {
    id: 4,
    title: 'JHS Textbook Bundle (All Subjects)',
    merchant: 'Accra Book Depot',
    category: 'education',
    originalPrice: 450,
    dealPrice: 360,
    minGroupSize: 30,
    sold: 89,
    rating: 4.6,
    image: '📚',
    badge: '20% OFF',
  },
  {
    id: 5,
    title: 'Canopy & Chairs (50 sets)',
    merchant: 'Event Masters Ghana',
    category: 'wedding',
    originalPrice: 1200,
    dealPrice: 900,
    minGroupSize: 10,
    sold: 34,
    rating: 4.5,
    image: '⛺',
    badge: '25% OFF',
  },
]

export default function MarketplacePage() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('all')
  const [selectedDeal, setSelectedDeal] = useState(null)

  const filteredDeals = category === 'all' 
    ? mockDeals 
    : mockDeals.filter(d => d.category === category)

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-adansi-secondary px-5 pt-8 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/10 rounded-full">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">Group Marketplace</h1>
            <p className="text-gray-400 text-xs">Bulk deals for your contributions</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search deals..."
            className="w-full pl-12 pr-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-adansi-primary"
          />
        </div>
      </div>

      <div className="px-5 py-4 space-y-6">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {categories.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                category === cat.key
                  ? 'bg-adansi-primary text-adansi-secondary'
                  : 'bg-white border border-gray-200 text-gray-600'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Deals */}
        <div className="space-y-4">
          {filteredDeals.map(deal => (
            <button
              key={deal.id}
              onClick={() => setSelectedDeal(deal)}
              className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left active:scale-[0.98] transition-transform"
            >
              <div className="flex gap-4">
                <div className="w-20 h-20 bg-gray-100 rounded-xl flex items-center justify-center text-3xl flex-shrink-0">
                  {deal.image}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{deal.title}</h3>
                    <span className="flex-shrink-0 px-2 py-0.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-full">
                      {deal.badge}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{deal.merchant}</p>

                  <div className="flex items-center gap-1 mt-2">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    <span className="text-xs font-medium">{deal.rating}</span>
                    <span className="text-xs text-gray-400">• {deal.sold} sold</span>
                  </div>

                  <div className="flex items-end justify-between mt-2">
                    <div>
                      <p className="text-xs text-gray-400 line-through">{formatCurrency(deal.originalPrice)}</p>
                      <p className="text-lg font-bold text-gray-900">{formatCurrency(deal.dealPrice)}</p>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Users className="w-3 h-3" />
                      Min {deal.minGroupSize}
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Deal Detail Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6 animate-slide-up max-h-[90vh] overflow-y-auto">
            <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

            <div className="w-full h-32 bg-gray-100 rounded-2xl flex items-center justify-center text-5xl mb-4">
              {selectedDeal.image}
            </div>

            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-lg font-bold text-gray-900">{selectedDeal.title}</h3>
              <span className="flex-shrink-0 px-2 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full">
                {selectedDeal.badge}
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-4">{selectedDeal.merchant}</p>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-sm font-medium">{selectedDeal.rating}</span>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Users className="w-4 h-4" />
                {selectedDeal.sold} sold
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Tag className="w-4 h-4" />
                Min {selectedDeal.minGroupSize} members
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Original Price</span>
                <span className="text-gray-400 line-through">{formatCurrency(selectedDeal.originalPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Group Deal Price</span>
                <span className="font-bold text-green-600">{formatCurrency(selectedDeal.dealPrice)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">You Save</span>
                <span className="font-bold text-green-600">{formatCurrency(selectedDeal.originalPrice - selectedDeal.dealPrice)}</span>
              </div>
            </div>

            <div className="bg-blue-50 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-900">How It Works</p>
                <p className="text-xs text-blue-700 mt-1">
                  Your group pools contributions and purchases this deal at the bulk rate. Adansi takes a 3-5% commission from the merchant.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedDeal(null)}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-700"
              >
                Close
              </button>
              <button
                onClick={() => { alert('Group order initiated! (Mock for demo)'); setSelectedDeal(null) }}
                className="flex-1 py-3 bg-adansi-primary text-adansi-secondary rounded-xl font-bold flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                Group Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
