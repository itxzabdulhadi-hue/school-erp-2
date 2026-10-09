/**
 * White-label configuration layer.
 *
 * Resolution order (highest priority first):
 *  1. Persisted overrides from the Settings module (stored in the DB layer).
 *  2. Build/deploy-time environment variables (`VITE_SCHOOL_*`).
 *  3. Bundled generic defaults below.
 *
 * To deploy for a new school WITHOUT touching source code, either:
 *  - set the VITE_SCHOOL_* env vars at build time, or
 *  - open Settings → School and update branding (persisted per deployment).
 *
 * No component may hardcode school identity — everything flows through `useSchool()`.
 */
import type { SchoolSettings } from '../lib/db/types';
import { nowISO } from '../lib/utils';

export const DEFAULT_SCHOOL: SchoolSettings = {
  id: 'school_default',
  name: 'Sunrise International School',
  tagline: 'Knowledge • Character • Excellence',
  logo: '',
  favicon: '',
  primaryColor: '#1d4ed8',
  secondaryColor: '#0f172a',
  accentColor: '#f59e0b',
  address: '123 Education Avenue',
  city: 'Springfield',
  country: 'United States',
  phone: '+1 (555) 123-4567',
  email: 'info@sunriseschool.edu',
  website: 'www.sunriseschool.edu',
  currency: 'USD',
  currencySymbol: '$',
  academicYear: '2025–26',
  currentTerm: 'Term 1',
  principalName: 'Dr. Evelyn Hart',
  registrationNo: 'REG-2025-0001',
  dateFormat: 'DD Mon YYYY',
  timeFormat: '12h',
  language: 'English',
  religionFieldEnabled: true,
  gpaEnabled: true,
  subjectWiseAttendance: false,
  enabledPaymentMethods: ['cash', 'bank', 'card', 'online', 'other'],
  defaultFine: 25,
  updatedAt: nowISO(),
};

type Env = Record<string, string | undefined>;

/** Read optional VITE_SCHOOL_* overrides (safe when `import.meta.env` is unavailable). */
export function getEnvOverrides(): Partial<SchoolSettings> {
  let env: Env = {};
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    env = (import.meta as any).env as Env;
  } catch {
    env = {};
  }
  const pick = (k: string): string | undefined => {
    const v = env[k];
    return v && v.trim() ? v.trim() : undefined;
  };
  const o: Partial<SchoolSettings> = {};
  const assign = <K extends keyof SchoolSettings>(key: K, v: string | undefined): void => {
    if (v !== undefined) o[key] = v as SchoolSettings[K];
  };
  assign('name', pick('VITE_SCHOOL_NAME'));
  assign('tagline', pick('VITE_SCHOOL_TAGLINE'));
  assign('logo', pick('VITE_SCHOOL_LOGO'));
  assign('primaryColor', pick('VITE_SCHOOL_PRIMARY'));
  assign('secondaryColor', pick('VITE_SCHOOL_SECONDARY'));
  assign('accentColor', pick('VITE_SCHOOL_ACCENT'));
  assign('address', pick('VITE_SCHOOL_ADDRESS'));
  assign('city', pick('VITE_SCHOOL_CITY'));
  assign('country', pick('VITE_SCHOOL_COUNTRY'));
  assign('phone', pick('VITE_SCHOOL_PHONE'));
  assign('email', pick('VITE_SCHOOL_EMAIL'));
  assign('website', pick('VITE_SCHOOL_WEBSITE'));
  assign('currency', pick('VITE_SCHOOL_CURRENCY'));
  assign('currencySymbol', pick('VITE_SCHOOL_CURRENCY_SYMBOL'));
  assign('academicYear', pick('VITE_SCHOOL_YEAR'));
  assign('currentTerm', pick('VITE_SCHOOL_TERM'));
  assign('principalName', pick('VITE_SCHOOL_PRINCIPAL'));
  assign('registrationNo', pick('VITE_SCHOOL_REG_NO'));
  return o;
}

export interface CurrencyOption {
  code: string;
  symbol: string;
  label: string;
}

export const CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'PKR', symbol: '₨', label: 'Pakistani Rupee' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', label: 'Saudi Riyal' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
  { code: 'NGN', symbol: '₦', label: 'Nigerian Naira' },
  { code: 'KES', symbol: 'KSh', label: 'Kenyan Shilling' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
];
