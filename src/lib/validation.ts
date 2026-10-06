/** Tiny form-validation toolkit shared by all module forms. */

export type Errors = Record<string, string>;

export const required = (v: unknown): string | null => {
  if (v === undefined || v === null) return 'Required';
  if (typeof v === 'string' && !v.trim()) return 'Required';
  if (Array.isArray(v) && v.length === 0) return 'Required';
  return null;
};

export const isEmail = (v: string): string | null => {
  if (!v.trim()) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Invalid email address';
};

export const isPhone = (v: string): string | null => {
  if (!v.trim()) return null;
  return /^[+()\-.\s\d]{6,20}$/.test(v) ? null : 'Invalid phone number';
};

export const isPositive = (v: unknown): string | null => {
  const n = Number(v);
  if (Number.isNaN(n)) return 'Must be a number';
  return n >= 0 ? null : 'Must be 0 or more';
};

export const minLength = (v: string, n: number): string | null =>
  v.trim().length >= n ? null : `At least ${n} characters`;

export function hasErrors(e: Errors): boolean {
  return Object.keys(e).length > 0;
}
