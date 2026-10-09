import { createContext, useContext, useMemo } from 'react';
import { usePublicBrand, useSchool } from '../api/query';
import { useSession } from '../auth/session';
import { appConfig } from '../config';

export interface Brand {
  name: string;
  tagline: string;
  logoUrl: string;
  primary: string;
  accent: string;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
}

const FALLBACK_BRAND: Brand = {
  name: 'School ERP',
  tagline: '',
  logoUrl: '',
  primary: '#1d4ed8',
  accent: '#0ea5e9',
  currency: 'PKR',
  currencySymbol: 'Rs',
  dateFormat: 'DD/MM/YYYY',
};

interface ThemeValue {
  brand: Brand;
  loading: boolean;
}

const ThemeContext = createContext<ThemeValue>({ brand: FALLBACK_BRAND, loading: true });

/**
 * White-label theme. Public branding loads pre-login (school slug); the full
 * school record refines it post-login. Build-time EXPO_PUBLIC_* overrides win
 * over server values for per-school app variants. See docs/BRANDING.md.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { status } = useSession();
  const pub = usePublicBrand(appConfig.schoolSlug);
  const school = useSchool({ enabled: status === 'authed' });

  const brand = useMemo<Brand>(() => {
    const p = pub.data;
    const s = school.data;
    return {
      name: appConfig.schoolNameOverride || s?.name || p?.name || FALLBACK_BRAND.name,
      tagline: s?.tagline ?? p?.tagline ?? '',
      logoUrl: s?.logoUrl ?? p?.logoUrl ?? '',
      primary: appConfig.primaryOverride || s?.primaryColor || p?.primaryColor || FALLBACK_BRAND.primary,
      accent: appConfig.accentOverride || s?.accentColor || p?.accentColor || FALLBACK_BRAND.accent,
      currency: s?.currency || p?.currency || FALLBACK_BRAND.currency,
      currencySymbol: s?.currencySymbol || p?.currencySymbol || FALLBACK_BRAND.currencySymbol,
      dateFormat: s?.dateFormat || p?.dateFormat || FALLBACK_BRAND.dateFormat,
    };
  }, [pub.data, school.data]);

  const value = useMemo(
    () => ({ brand, loading: status === 'authed' && school.isLoading }),
    [brand, status, school.isLoading],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}

export interface Format {
  money: (n: number | string) => string;
  date: (iso: string | null | undefined) => string;
  time: (hhmmss: string | null | undefined) => string;
  dateTime: (iso: string | null | undefined) => string;
}

/** Locale-aware formatting bound to the active school brand. */
export function useFormat(): Format {
  const { brand } = useTheme();
  return useMemo<Format>(() => {
    const money = (n: number | string): string => {
      const v = Number(n);
      if (!Number.isFinite(v)) return `${brand.currencySymbol} 0`;
      return `${brand.currencySymbol} ${v.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
    };
    const date = (iso: string | null | undefined): string => {
      if (!iso) return '—';
      const d = iso.slice(0, 10);
      const [y, m, dd] = d.split('-');
      if (!y || !m || !dd) return d;
      if (brand.dateFormat === 'MM/DD/YYYY') return `${m}/${dd}/${y}`;
      if (brand.dateFormat === 'YYYY-MM-DD') return d;
      return `${dd}/${m}/${y}`;
    };
    const time = (hhmmss: string | null | undefined): string => {
      if (!hhmmss) return '';
      const [h, mi] = hhmmss.split(':');
      const hr = Number(h);
      if (!Number.isFinite(hr)) return hhmmss.slice(0, 5);
      const suffix = hr >= 12 ? 'PM' : 'AM';
      const h12 = hr % 12 === 0 ? 12 : hr % 12;
      return `${h12}:${mi ?? '00'} ${suffix}`;
    };
    const dateTime = (iso: string | null | undefined): string => {
      if (!iso) return '—';
      return `${date(iso.slice(0, 10))} ${time(iso.slice(11, 19))}`;
    };
    return { money, date, time, dateTime };
  }, [brand]);
}
