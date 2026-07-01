export const fmt = (amount: number, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

export const fmtDate = (dateStr: string) => {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export const todayStr = () => new Date().toISOString().split('T')[0];

export const getInitials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

export const CATEGORY_ICONS: Record<string, string> = {
  food: '🍕', transport: '🚗', entertainment: '🎬',
  utilities: '💡', shopping: '🛍️', health: '💊',
  travel: '✈️', other: '📦',
};

export const CATEGORY_COLORS: Record<string, string> = {
  food: '#f97316', transport: '#06b6d4', entertainment: '#8b5cf6',
  utilities: '#6366f1', shopping: '#ec4899', health: '#10b981',
  travel: '#f59e0b', other: '#94a3b8',
};

export const GROUP_CATEGORIES = [
  { value: 'home', label: '🏠 Home', color: '#6366f1' },
  { value: 'trip', label: '✈️ Trip', color: '#f59e0b' },
  { value: 'food', label: '🍕 Food', color: '#f97316' },
  { value: 'couple', label: '💑 Couple', color: '#ec4899' },
  { value: 'work', label: '💼 Work', color: '#06b6d4' },
  { value: 'other', label: '👥 Other', color: '#10b981' },
];

export const COVER_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

export const timeGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};
