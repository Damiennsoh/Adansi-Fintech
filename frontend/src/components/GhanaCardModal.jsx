import { useState } from 'react'
import { X, CreditCard, ShieldCheck, Upload, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react'
import api from '../lib/api'

export default function GhanaCardModal({ isOpen, onClose, currentCard, onVerified }) {
  const [cardNumber, setCardNumber] = useState(currentCard || '')
  const [fileFront, setFileFront] = useState(null)
  const [fileBack, setFileBack] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!isOpen) return null

  const formatCardNumber = (val) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9]/g, '')
    if (clean.startsWith('GHA')) {
      clean = clean.substring(3)
    }
    const digits = clean.replace(/\D/g, '').substring(0, 10)
    if (digits.length <= 9) {
      return digits.length > 0 ? `GHA-${digits}` : ''
    }
    return `GHA-${digits.substring(0, 9)}-${digits.substring(9, 10)}`
  }

  const handleCardChange = (e) => {
    setError('')
    setCardNumber(formatCardNumber(e.target.value))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const regex = /^GHA-\d{9}-\d$/
    if (!regex.test(cardNumber)) {
      setError('Please enter a valid Ghana Card format: GHA-XXXXXXXXX-X')
      return
    }

    setIsSubmitting(true)
    setError('')
    try {
      await api.post('/users/me/kyc/ghana-card', {
        ghana_card_number: cardNumber,
      })
      setSuccess(true)
      if (onVerified) onVerified(cardNumber)
      setTimeout(() => {
        setSuccess(false)
        onClose()
      }, 1800)
    } catch (err) {
      setError(err.response?.data?.detail || 'Verification failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl bg-adansi-primary/15 text-adansi-secondary flex items-center justify-center">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">My Ghana Card</h2>
            <p className="text-xs text-gray-500">Identity verification & KYC</p>
          </div>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Identity Verified!</h3>
            <p className="text-xs text-gray-500 max-w-xs mx-auto">
              Your Ghana Card ({cardNumber}) has been successfully recorded and verified.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-adansi-primary/10 border border-adansi-primary/20 rounded-2xl p-3.5 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-adansi-secondary flex-shrink-0 mt-0.5" />
              <p className="text-xs text-gray-700 leading-relaxed">
                Verifying your Ghana Card increases your <strong>loan eligibility</strong>, allows larger group limits, and satisfies Bank of Ghana regulations.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Ghana Card PIN Number
              </label>
              <input
                type="text"
                value={cardNumber}
                onChange={handleCardChange}
                placeholder="GHA-123456789-0"
                maxLength={15}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl font-mono text-base font-bold text-gray-900 tracking-wider focus:outline-none focus:border-adansi-primary focus:bg-white transition-all"
                required
              />
              <p className="text-[11px] text-gray-400 mt-1">Format: GHA-XXXXXXXXX-X</p>
            </div>

            {/* Document Upload Simulation */}
            <div className="space-y-2 pt-1">
              <label className="block text-xs font-semibold text-gray-700">
                Card Photos (Optional for Tier 1)
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="border-2 border-dashed border-gray-200 hover:border-adansi-primary rounded-xl p-3 text-center cursor-pointer bg-gray-50 hover:bg-white transition-colors block">
                  <Upload className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <span className="text-[11px] font-medium text-gray-600 block">
                    {fileFront ? 'Front Added ✓' : 'Front Photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFileFront(e.target.files[0]?.name)}
                  />
                </label>
                <label className="border-2 border-dashed border-gray-200 hover:border-adansi-primary rounded-xl p-3 text-center cursor-pointer bg-gray-50 hover:bg-white transition-colors block">
                  <Upload className="w-4 h-4 text-gray-400 mx-auto mb-1" />
                  <span className="text-[11px] font-medium text-gray-600 block">
                    {fileBack ? 'Back Added ✓' : 'Back Photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setFileBack(e.target.files[0]?.name)}
                  />
                </label>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting || !cardNumber}
                className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  'Submit & Verify Identity'
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
