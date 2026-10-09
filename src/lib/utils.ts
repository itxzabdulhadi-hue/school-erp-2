import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Collision-resistant id generator (prefix-scoped). */
export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO.length === 10 ? `${dateISO}T12:00:00` : dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWeekend(dateISO: string): boolean {
  const d = new Date(`${dateISO}T12:00:00`).getDay();
  return d === 0 || d === 6;
}

/** Format ISO date using the school's configured date format. */
export function formatDate(
  iso: string | undefined | null,
  fmt = 'DD Mon YYYY',
): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '—';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const mon = d.toLocaleString('en', { month: 'short' });
  const yyyy = d.getFullYear();
  switch (fmt) {
    case 'MM/DD/YYYY':
      return `${mm}/${dd}/${yyyy}`;
    case 'DD/MM/YYYY':
      return `${dd}/${mm}/${yyyy}`;
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'DD Mon YYYY':
    default:
      return `${dd} ${mon} ${yyyy}`;
  }
}

export function formatTime(t: string | undefined | null, fmt = '12h'): string {
  if (!t) return '—';
  const [hStr, mStr] = t.split(':');
  const h = Number(hStr);
  const m = mStr ?? '00';
  if (Number.isNaN(h)) return t;
  if (fmt === '24h') return `${String(h).padStart(2, '0')}:${m}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m} ${suffix}`;
}

export function formatDateTime(iso: string | undefined | null, dateFmt = 'DD Mon YYYY'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hh = d.getHours();
  const suffix = hh >= 12 ? 'PM' : 'AM';
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(iso, dateFmt)} · ${h12}:${mm} ${suffix}`;
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic avatar hue from a string. */
export function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** Mix a hex color toward white/black. amt -1..1 */
export function shade(hex: string, amt: number): string {
  const n = hex.replace('#', '');
  const num = parseInt(n.length === 3 ? n.split('').map((c) => c + c).join('') : n, 16);
  let r = (num >> 16) & 255;
  let g = (num >> 8) & 255;
  let b = num & 255;
  if (amt >= 0) {
    r = Math.round(r + (255 - r) * amt);
    g = Math.round(g + (255 - g) * amt);
    b = Math.round(b + (255 - b) * amt);
  } else {
    r = Math.round(r * (1 + amt));
    g = Math.round(g * (1 + amt));
    b = Math.round(b * (1 + amt));
  }
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

export function numberWithCommas(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function calcAge(dobISO: string | undefined): number | null {
  if (!dobISO) return null;
  const dob = new Date(`${dobISO}T12:00:00`);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** Export rows to CSV and trigger download. */
export function exportCSV(filename: string, columns: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number): string => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [columns.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function fullName(first: string, middle: string | undefined, last: string): string {
  return [first, middle, last].filter(Boolean).join(' ');
}

/** Simple case-insensitive multi-field matcher for search boxes. */
export function matchesQuery(query: string, ...fields: (string | number | undefined | null)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => String(f ?? '').toLowerCase().includes(q));
}

export function percent(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Generate a default crest-style logo as a data URI tinted with the brand color. */
export function defaultLogoSVG(primary: string, initial: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${primary}'/><text x='32' y='42' font-family='Arial,sans-serif' font-size='28' font-weight='bold' fill='white' text-anchor='middle'>${(initial || 'S')[0].toUpperCase()}</text><circle cx='32' cy='32' r='29' fill='none' stroke='white' stroke-opacity='0.35' stroke-width='2'/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
