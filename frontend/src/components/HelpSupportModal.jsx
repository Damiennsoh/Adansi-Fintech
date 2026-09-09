import { useState } from 'react'
import { X, HelpCircle, MessageSquare, Phone, ChevronDown, ChevronUp, Send, CheckCircle2 } from 'lucide-react'

const FAQS = [
  {
    q: 'How does Adansi group savings (Susu) work?',
    a: 'Adansi lets you create or join digital savings and susu groups. Members contribute periodically via Mobile Money, and funds are held securely. Payouts follow rotational rules or require treasurer consensus signatures.',
  },
  {
    q: 'How are group withdrawals approved?',
    a: 'When a treasurer initiates a withdrawal, all designated signatories receive instant approval notifications on WhatsApp and the PWA. Funds are disbursed directly to the beneficiary only when the required threshold of votes is reached.',
  },
  {
    q: 'What Mobile Money networks are supported?',
    a: 'Adansi supports all major Ghana mobile networks including MTN Mobile Money, Telecel Cash (Vodafone), and AirtelTigo Money.',
  },
  {
    q: 'How do I boost my Credit Score and Loan Limit?',
    a: 'Make regular on-time contributions, maintain a good contribution streak in active groups, verify your Ghana Card, and repay micro-loans on schedule to boost your score up to 850.',
  },
  {
    q: 'Is my money secure with Adansi?',
    a: 'Yes. Adansi uses bank-grade 256-bit encryption, Row Level Security, two-treasurer digital signatures, and direct Hubtel/Bank of Ghana regulated payment gateways.',
  },
]

export default function HelpSupportModal({ isOpen, onClose }) {
  const [openIndex, setOpenIndex] = useState(0)
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')
  const [submitted, setSubmitted] = useState(false)

  if (!isOpen) return null

  const handleSendTicket = (e) => {
    e.preventDefault()
    if (!ticketMessage) return
    setSubmitted(true)
    setTimeout(() => {
      setSubmitted(false)
      setTicketSubject('')
      setTicketMessage('')
      onClose()
    }, 2000)
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
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Help & Support</h2>
            <p className="text-xs text-gray-500">FAQ, direct helpline & support desk</p>
          </div>
        </div>

        {/* Quick Contact Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          <a
            href="https://wa.me/233240000000?text=Hi%20Adansi%20Support,%20I%20need%20assistance%20with%20my%20account."
            target="_blank"
            rel="noreferrer"
            className="p-3.5 bg-green-50 hover:bg-green-100 border border-green-200 rounded-2xl flex items-center gap-3 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-green-600 text-white flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-900">WhatsApp</p>
              <p className="text-[10px] text-green-700">Instant Chat</p>
            </div>
          </a>

          <a
            href="tel:+233240000000"
            className="p-3.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl flex items-center gap-3 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-blue-900">Call Desk</p>
              <p className="text-[10px] text-blue-700">Toll-Free Helpline</p>
            </div>
          </a>
        </div>

        {/* FAQ Accordion */}
        <div className="mb-5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Frequently Asked Questions
          </h3>
          <div className="space-y-2">
            {FAQS.map((faq, idx) => {
              const isOpen = openIndex === idx
              return (
                <div key={idx} className="border border-gray-100 rounded-2xl overflow-hidden bg-gray-50/50">
                  <button
                    type="button"
                    onClick={() => setOpenIndex(isOpen ? -1 : idx)}
                    className="w-full p-3.5 text-left flex items-center justify-between gap-2"
                  >
                    <span className="text-xs font-bold text-gray-900">{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3.5 text-xs text-gray-600 leading-relaxed border-t border-gray-100/80 pt-2 bg-white">
                      {faq.a}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* In-App Ticket Form */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5">
            Send Us a Message
          </h3>
          {submitted ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-2xl flex items-center gap-3 text-xs text-green-700">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>Thank you! Your ticket has been logged. Support will reach out shortly.</span>
            </div>
          ) : (
            <form onSubmit={handleSendTicket} className="space-y-3">
              <input
                type="text"
                placeholder="Subject (e.g. Withdrawal enquiry)"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-adansi-primary focus:bg-white"
              />
              <textarea
                placeholder="Describe your issue or feedback..."
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
                rows={3}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:outline-none focus:border-adansi-primary focus:bg-white resize-none"
                required
              />
              <button
                type="submit"
                className="w-full bg-adansi-secondary text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform"
              >
                <Send className="w-3.5 h-3.5" /> Submit Ticket
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
