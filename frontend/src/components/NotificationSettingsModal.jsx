import { useState, useEffect } from 'react'
import { X, Bell, MessageSquare, Smartphone, Check, Loader2 } from 'lucide-react'
import api from '../lib/api'

export default function NotificationSettingsModal({ isOpen, onClose }) {
  const [preferences, setPreferences] = useState({
    whatsapp_enabled: true,
    sms_enabled: true,
    push_enabled: true,
    contributions_alert: true,
    withdrawals_alert: true,
    loans_alert: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)

  useEffect(() => {
    if (isOpen) {
      api.get('/users/me/preferences')
        .then(({ data }) => setPreferences((prev) => ({ ...prev, ...data })))
        .catch(() => {})
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleToggle = (key) => {
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await api.put('/users/me/preferences', preferences)
      setSavedMsg(true)
      setTimeout(() => {
        setSavedMsg(false)
        onClose()
      }, 1200)
    } catch (e) {
      alert('Failed to save preferences')
    } finally {
      setIsSaving(false)
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
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <Bell className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Notification Preferences</h2>
            <p className="text-xs text-gray-500">Push, WhatsApp & SMS alerts</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Notification Channels
            </p>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
                    <MessageSquare className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">WhatsApp Messages</p>
                    <p className="text-[11px] text-gray-500">Interactive approvals & alerts</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('whatsapp_enabled')}
                  className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${
                    preferences.whatsapp_enabled ? 'bg-adansi-primary' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                      preferences.whatsapp_enabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">SMS Alerts</p>
                    <p className="text-[11px] text-gray-500">Instant SMS receipts & OTPs</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('sms_enabled')}
                  className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${
                    preferences.sms_enabled ? 'bg-adansi-primary' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                      preferences.sms_enabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">In-App & Push</p>
                    <p className="text-[11px] text-gray-500">Real-time notification bell updates</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle('push_enabled')}
                  className={`w-12 h-6.5 rounded-full transition-colors relative p-0.5 ${
                    preferences.push_enabled ? 'bg-adansi-primary' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-5.5 h-5.5 rounded-full bg-white shadow-md transform transition-transform ${
                      preferences.push_enabled ? 'translate-x-5.5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
              Activity Alerts
            </p>
            <div className="space-y-2 bg-gray-50 p-3 rounded-2xl">
              {[
                { key: 'contributions_alert', label: 'Group Contributions', desc: 'When you or peers deposit' },
                { key: 'withdrawals_alert', label: 'Withdrawal Approvals', desc: 'When treasury votes are required' },
                { key: 'loans_alert', label: 'Credit & Repayment Reminders', desc: 'Score upgrades and due dates' },
              ].map(({ key, label, desc }) => (
                <label key={key} className="flex items-center justify-between py-1.5 cursor-pointer">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{label}</p>
                    <p className="text-[10px] text-gray-500">{desc}</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences[key]}
                    onChange={() => handleToggle(key)}
                    className="w-4 h-4 rounded text-adansi-primary focus:ring-adansi-primary border-gray-300"
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full bg-adansi-primary text-adansi-secondary font-bold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving...
              </>
            ) : savedMsg ? (
              <>
                <Check className="w-4 h-4" /> Preferences Saved!
              </>
            ) : (
              'Save Preferences'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
