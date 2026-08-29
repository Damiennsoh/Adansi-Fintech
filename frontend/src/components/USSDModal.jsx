import { X, Copy, Phone } from 'lucide-react'
import { useState } from 'react'

export default function USSDModal({ isOpen, onClose, groupCode }) {
  const [copied, setCopied] = useState(false)
  const ussdCode = `*422*1*${groupCode || ''}#`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(ussdCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center animate-slide-up">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-bold text-gray-900">Use USSD Instead</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="bg-adansi-secondary rounded-2xl p-6 text-center mb-6">
          <Phone className="w-8 h-8 text-adansi-primary mx-auto mb-3" />
          <p className="text-2xl font-mono font-bold text-white tracking-wider">{ussdCode}</p>
          <p className="text-gray-400 text-sm mt-2">Dial on any phone — no app needed</p>
        </div>

        <button
          onClick={copyToClipboard}
          className="w-full flex items-center justify-center gap-2 bg-adansi-primary text-adansi-secondary font-semibold py-3.5 rounded-xl active:scale-[0.98] transition-transform"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : 'Copy USSD Code'}
        </button>

        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p className="font-medium text-gray-900">How it works:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-500">
            <li>Dial the code above</li>
            <li>Select "Contribute" or "Check Balance"</li>
            <li>Enter your MoMo PIN when prompted</li>
            <li>Done! You will receive an SMS receipt</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
