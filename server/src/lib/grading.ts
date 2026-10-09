/** Server-side grading — mirrors web src/lib/grading.ts semantics. */

export interface GradeBand {
  grade: string;
  minPercent: number;
  maxPercent: number;
  gpa?: number | null;
  remarks?: string;
  name?: string;
}

export const DEFAULT_SCALE: GradeBand[] = [
  { name: 'Outstanding', minPercent: 90, maxPercent: 100, grade: 'A+', gpa: 4.0 },
  { name: 'Excellent', minPercent: 80, maxPercent: 89.99, grade: 'A', gpa: 3.7 },
  { name: 'Very Good', minPercent: 70, maxPercent: 79.99, grade: 'B', gpa: 3.0 },
  { name: 'Good', minPercent: 60, maxPercent: 69.99, grade: 'C', gpa: 2.0 },
  { name: 'Satisfactory', minPercent: 50, maxPercent: 59.99, grade: 'D', gpa: 1.0 },
  { name: 'Pass', minPercent: 40, maxPercent: 49.99, grade: 'E', gpa: 0.7 },
  { name: 'Fail', minPercent: 0, maxPercent: 39.99, grade: 'F', gpa: 0 },
];

export interface GradeResult {
  grade: string;
  gpa: number | null;
  passed: boolean;
  percent: number;
}

export function gradeFor(percent: number, scale: GradeBand[], passingPercent = 40): GradeResult {
  const sorted = [...scale].sort((a, b) => b.minPercent - a.minPercent);
  const hit = sorted.find((s) => percent >= s.minPercent && percent <= s.maxPercent)
    ?? sorted[sorted.length - 1];
  return {
    grade: hit?.grade ?? '—',
    gpa: hit?.gpa ?? null,
    passed: percent >= passingPercent,
    percent: Math.round(percent * 100) / 100,
  };
}

export function coerceScale(raw: unknown): GradeBand[] {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_SCALE;
  const bands = (raw as Record<string, unknown>[])
    .filter((b) => typeof b?.grade === 'string')
    .map((b) => ({
      grade: String(b.grade),
      minPercent: Number(b.minPercent ?? 0),
      maxPercent: Number(b.maxPercent ?? 100),
      gpa: typeof b.gpa === 'number' ? b.gpa : null,
    }));
  return bands.length > 0 ? bands : DEFAULT_SCALE;
}
