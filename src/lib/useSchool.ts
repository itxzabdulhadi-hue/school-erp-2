/** White-label access layer: branding, locale formatting, currency. */
import { useDB } from './db/store';
import type { SchoolSettings } from './db/types';
import { formatDate, formatDateTime, formatTime, numberWithCommas } from './utils';

export function useSchool(): SchoolSettings {
  return useDB((s) => s.school);
}

export function useMoney(): (n: number) => string {
  const school = useDB((s) => s.school);
  return (n: number) => `${school.currencySymbol}${numberWithCommas(n)}`;
}

export function money(school: SchoolSettings, n: number): string {
  return `${school.currencySymbol}${numberWithCommas(n)}`;
}

export function useFmt(): {
  date: (iso?: string | null) => string;
  time: (t?: string | null) => string;
  datetime: (iso?: string | null) => string;
} {
  const school = useDB((s) => s.school);
  return {
    date: (iso) => formatDate(iso ?? undefined, school.dateFormat),
    time: (t) => formatTime(t ?? undefined, school.timeFormat),
    datetime: (iso) => formatDateTime(iso ?? undefined, school.dateFormat),
  };
}
