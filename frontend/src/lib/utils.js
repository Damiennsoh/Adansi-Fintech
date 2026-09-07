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

export function formatGroupType(type) {
  return String(type || 'group')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function getGroupColor(type) {
  const colors = {
    wedding: 'bg-gradient-to-br from-rose-950 via-pink-950 to-slate-900',
    funeral: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900',
    health: 'bg-gradient-to-br from-teal-950 via-emerald-950 to-slate-900',
    savings: 'bg-gradient-to-br from-blue-950 via-indigo-950 to-slate-900',
    susu: 'bg-gradient-to-br from-sky-950 via-blue-950 to-slate-900',
    investment: 'bg-gradient-to-br from-amber-950 via-stone-900 to-slate-950',
    business: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-slate-900',
    welfare: 'bg-gradient-to-br from-purple-950 via-violet-950 to-slate-900',
    school: 'bg-gradient-to-br from-indigo-950 via-blue-950 to-slate-900',
  };
  return colors[type] || 'bg-gradient-to-br from-slate-900 via-gray-900 to-slate-950';
}

export function getCreditTier(score) {
  if (score >= 700) return { tier: 'Gold', color: 'text-yellow-600', bg: 'bg-yellow-100' };
  if (score >= 550) return { tier: 'Silver', color: 'text-gray-600', bg: 'bg-gray-200' };
  return { tier: 'Bronze', color: 'text-orange-600', bg: 'bg-orange-100' };
}
