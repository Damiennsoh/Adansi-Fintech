import { useState } from 'react'
import { Shield, CheckCircle2, Search, AlertCircle } from 'lucide-react'

export default function AgentVerifyMockPage() {
  const [code, setCode] = useState('')
  const [verified, setVerified] = useState(false)
  const [searching, setSearching] = useState(false)

  const handleVerify = (e) => {
    e.preventDefault()
    if (!code) return
    setSearching(true)
    setTimeout(() => {
      setSearching(false)
      setVerified(true)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 flex flex-col justify-center items-center">
      <div className="max-w-md w-full bg-gray-800 rounded-3xl p-6 border border-gray-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-700">
          <div className="w-12 h-12 bg-adansi-primary text-adansi-secondary rounded-2xl flex items-center justify-center font-bold">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold">MTN MoMo Agent Portal</h1>
            <p className="text-xs text-yellow-400">Future Concept Demo Page</p>
          </div>
        </div>

        {!verified ? (
          <form onSubmit={handleVerify} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-2">
                Enter Withdrawal Verification Code
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="AD-7X9K2M"
                  className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-700 rounded-xl text-center text-xl font-mono tracking-widest text-white focus:outline-none focus:border-adansi-primary"
                />
              </div>
            </div>

            <div className="bg-yellow-950/40 border border-yellow-700/40 rounded-xl p-3 flex items-start gap-2 text-xs text-yellow-300">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Verify Ghana Card photo against requester before entering OTP confirmation code.</span>
            </div>

            <button
              type="submit"
              disabled={!code || searching}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-4 rounded-xl active:scale-[0.98] transition-transform"
            >
              {searching ? 'Verifying Code...' : 'Verify Code & Match ID'}
            </button>
          </form>
        ) : (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold text-white">Biometric ID Verified!</h2>
            <div className="bg-gray-900 rounded-xl p-4 text-left text-xs space-y-2 border border-gray-700">
              <p><span className="text-gray-400">Group:</span> Asante Welfare Fund</p>
              <p><span className="text-gray-400">Treasurer:</span> Kofi Mensah (+23324...)</p>
              <p><span className="text-gray-400">Amount:</span> GHS 8,000.00</p>
              <p><span className="text-gray-400">Digital Signatures:</span> 2 of 3 Treasurers Verified</p>
            </div>
            <button
              onClick={() => { setVerified(false); setCode(''); }}
              className="w-full bg-gray-700 text-white font-medium py-3 rounded-xl text-xs"
            >
              Verify Another Transaction
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
