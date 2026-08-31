const NETWORKS = [
  { value: 'mtn', label: 'MTN MoMo', short: 'MTN' },
  { value: 'telecel', label: 'Telecel Cash', short: 'Telecel' },
  { value: 'airteltigo', label: 'AirtelTigo Money', short: 'AT' },
]

export function detectNetworkFromPhone(phone) {
  if (!phone || phone.length < 6) return 'mtn'
  const digits = phone.replace(/\D/g, '')
  const prefix = digits.startsWith('233') ? digits.slice(3, 5) : digits.slice(0, 2)
  if (['20', '24', '54', '55', '59'].includes(prefix)) return 'mtn'
  if (prefix === '50') return 'telecel'
  if (['26', '56', '57', '27'].includes(prefix)) return 'airteltigo'
  return 'mtn'
}

export default function NetworkSelector({ value, onChange, label = 'Mobile Money Network' }) {
  return (
    <div className="min-w-0">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-3 sm:gap-2">
        {NETWORKS.map((n) => (
          <button
            key={n.value}
            type="button"
            onClick={() => onChange(n.value)}
            className={`w-full py-3 px-3 rounded-xl text-sm font-semibold border-2 transition-all text-left sm:text-center break-words ${
              value === n.value
                ? 'border-adansi-primary bg-adansi-primary/10 text-adansi-secondary'
                : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="sm:hidden">{n.label}</span>
            <span className="hidden sm:inline">{n.short}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export { NETWORKS }
