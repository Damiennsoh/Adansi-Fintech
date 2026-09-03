export function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}

export function formatCurrency(amount, currency = 'GHS') {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatRelativeTime(dateString) {
  if (!dateString) return 'Recently';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Recently';
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function generateGroupCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getGroupColor(type) {
  const colors = {
    funeral: 'bg-adansi-funeral',
    wedding: 'bg-adansi-wedding',
    health: 'bg-adansi-health',
    savings: 'bg-adansi-savings',
    investment: 'bg-adansi-investment',
    business: 'bg-emerald-700',
    susu: 'bg-adansi-savings',
    welfare: 'bg-purple-700',
  };
  return colors[type] || 'bg-gray-500';
}

export function getCreditTier(score) {
  if (score >= 700) return { tier: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  if (score >= 550) return { tier: 'Silver', color: 'text-gray-600', bg: 'bg-gray-200' };
  return { tier: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-100' };
}
