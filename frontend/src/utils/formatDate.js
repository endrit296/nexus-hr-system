const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDate(input) {
  if (!input) return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const str = String(input).trim();
  // Date-only strings (YYYY-MM-DD): parse as local noon to avoid UTC-midnight timezone shifts
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str)
    ? new Date(str + 'T12:00:00')
    : new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateShort(input) {
  const d = toDate(input);
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateTime(input) {
  const d = toDate(input);
  if (!d) return '—';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hh}:${mm}`;
}

export function formatRelative(input) {
  const d = toDate(input);
  if (!d) return '—';

  const diffMs  = Date.now() - d.getTime(); // positive = past, negative = future
  const diffSec = Math.round(diffMs / 1000);
  const absSec  = Math.abs(diffSec);

  if (absSec > 30 * 24 * 3600) return formatDateShort(d);

  const future = diffSec < 0;

  if (absSec < 60)   return 'just now';

  const mins = Math.round(absSec / 60);
  if (mins < 60) {
    const label = `${mins} minute${mins !== 1 ? 's' : ''}`;
    return future ? `in ${label}` : `${label} ago`;
  }

  const hours = Math.round(absSec / 3600);
  if (hours < 24) {
    const label = `${hours} hour${hours !== 1 ? 's' : ''}`;
    return future ? `in ${label}` : `${label} ago`;
  }

  const days = Math.round(absSec / 86400);
  if (days === 1) return future ? 'tomorrow' : 'yesterday';

  return future ? `in ${days} days` : `${days} days ago`;
}
