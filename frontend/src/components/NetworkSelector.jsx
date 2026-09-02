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
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none focus:border-adansi-primary"
      >
        {NETWORKS.map((n) => (
          <option key={n.value} value={n.value}>{n.label}</option>
        ))}
      </select>
    </div>
  )
}

export { NETWORKS }
