import { useState } from 'react'
import { X, Shield, Lock, CheckCircle2, AlertCircle, Loader2, Fingerprint } from 'lucide-react'
import api from '../lib/api'

export default function SecurityModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('pin') // 'pin' or '2fa'
  const [currentPin, setCurrentPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [biometrics, setBiometrics] = useState(false)
  const [twoFactor, setTwoFactor] = useState(true)

  if (!isOpen) return null

  const handleChangePin = async (e) => {
    e.preventDefault()
    setError('')
    setSuccessMsg('')

    if (newPin.length !== 4 && newPin.length !== 6) {
      setError('PIN must be 4 or 6 digits')
      return
    }
    if (newPin !== confirmPin) {
      setError('New PIN and confirmation do not match')
      return
    }
    if (currentPin === newPin) {
      setError('New PIN cannot be the same as your current PIN')
      return
    }

    setIsSubmitting(true)
    try {
      await api.post('/auth/change-pin', {
        current_pin: currentPin,
        new_pin: newPin,
      })
      setSuccessMsg('PIN successfully updated!')
      setCurrentPin('')
      setNewPin('')
      setConfirmPin('')
      setTimeout(() => {
        setSuccessMsg('')
        onClose()
      }, 1500)
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to change PIN. Verify your current PIN.')
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
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Security & Access</h2>
            <p className="text-xs text-gray-500">PIN, biometrics & 2FA protection</p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-gray-100 p-1 rounded-xl mb-5">
          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'pin' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            Change PIN
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('2fa')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === '2fa' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            2FA & Biometrics
          </button>
        </div>

        {activeTab === 'pin' ? (
          <form onSubmit={handleChangePin} className="space-y-4">
            {successMsg && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2 text-xs text-green-700">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Current PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-lg tracking-widest text-gray-900 focus:outline-none focus:border-adansi-primary focus:bg-white"
                  required
                />
                <Lock className="w-4 h-4 text-gray-400 absolute right-4 top-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                New PIN (4 or 6 Digits)
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-lg tracking-widest text-gray-900 focus:outline-none focus:border-adansi-primary focus:bg-white"
                  required
                />
                <Lock className="w-4 h-4 text-gray-400 absolute right-4 top-4" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Confirm New PIN
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-lg tracking-widest text-gray-900 focus:outline-none focus:border-adansi-primary focus:bg-white"
                  required
                />
                <Lock className="w-4 h-4 text-gray-400 absolute right-4 top-4" />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !currentPin || !newPin || !confirmPin}
              className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Updating PIN...
                </>
              ) : (
                'Update Security PIN'
              )}
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Biometric Sign-In</p>
                  <p className="text-xs text-gray-500">Touch ID / Face ID quick unlock</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={biometrics}
                onChange={() => setBiometrics(!biometrics)}
                className="w-5 h-5 rounded text-adansi-primary focus:ring-adansi-primary border-gray-300"
              />
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">2-Factor OTP on Withdrawals</p>
                  <p className="text-xs text-gray-500">Require SMS OTP for large payouts</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={twoFactor}
                onChange={() => setTwoFactor(!twoFactor)}
                className="w-5 h-5 rounded text-adansi-primary focus:ring-adansi-primary border-gray-300"
              />
            </div>

            <div className="bg-adansi-primary/10 border border-adansi-primary/20 rounded-xl p-3 text-xs text-gray-700 leading-relaxed">
              Security Notice: Adansi employees will <strong>never</strong> ask for your PIN, OTP, or password.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
