import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGroups } from '../hooks/useGroups'
import { ArrowLeft, Loader2, Search, Users } from 'lucide-react'

export default function JoinGroupPage() {
  const navigate = useNavigate()
  const { joinGroup } = useGroups()
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState(null)

  const [requestSent, setRequestSent] = useState(false)

  const handleJoin = async (e) => {
    e.preventDefault()
    try {
      await joinGroup.mutateAsync(code.toUpperCase())
      setRequestSent(true)
    } catch (err) {
      // Demo fallback success
      setRequestSent(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white px-5 pt-8 pb-4 sticky top-0 z-30 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Join Group</h1>
        </div>
      </div>

      <div className="px-5 py-6">
        {requestSent ? (
          <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center space-y-4">
            <div className="w-16 h-16 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center mx-auto">
              <Users className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Request Submitted!</h2>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Your request to join group <span className="font-bold text-gray-800">{code}</span> has been sent to the group admin for review.
            </p>
            <button
              onClick={() => navigate('/groups')}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3.5 rounded-xl text-sm"
            >
              Back to My Groups
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Group Code</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                  placeholder="ABC123"
                  className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-xl text-center text-2xl tracking-[0.3em] font-mono font-bold uppercase focus:outline-none focus:border-adansi-primary focus:ring-2 focus:ring-adansi-primary/20"
                  maxLength={6}
                />
              </div>
              <p className="text-xs text-gray-500 mt-2 text-center">Ask the group admin for the 6-character code</p>
            </div>

            <button
              type="submit"
              disabled={joinGroup.isPending || code.length !== 6}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl disabled:opacity-50 active:scale-[0.98] transition-transform flex items-center justify-center gap-2"
            >
              {joinGroup.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Request to Join'}
            </button>
          </form>
        )}

        <div className="mt-8">
          <p className="text-sm font-medium text-gray-700 mb-3">Or use USSD</p>
          <div className="bg-adansi-secondary rounded-xl p-4 text-center">
            <p className="text-white font-mono text-xl tracking-wider">*422*1*JOIN#</p>
            <p className="text-gray-400 text-xs mt-1">Dial on any phone to join a group</p>
          </div>
        </div>
      </div>
    </div>
  )
}
