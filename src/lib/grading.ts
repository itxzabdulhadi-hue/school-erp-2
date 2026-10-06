import type { GradeScale } from './db/types';

export interface GradeResult {
  grade: string;
  gpa: number | null;
  remarks: string;
  passed: boolean;
  percent: number;
}

/** Resolve a percentage to a grade using the school-configured scale. */
export function gradeFor(
  percent: number,
  scales: GradeScale[],
  passingPercent = 40,
): GradeResult {
  const sorted = [...scales].sort((a, b) => b.minPercent - a.minPercent);
  const hit = sorted.find((s) => percent >= s.minPercent && percent <= s.maxPercent) ?? sorted[sorted.length - 1];
  return {
    grade: hit?.grade ?? '—',
    gpa: hit?.gpa ?? null,
    remarks: hit?.remarks ?? '',
    passed: percent >= passingPercent,
    percent: Math.round(percent * 100) / 100,
  };
}

export function percentOf(obtained: number, max: number): number {
  if (!max) return 0;
  return Math.round((obtained / max) * 10000) / 100;
}

export const DEFAULT_GRADE_SCALES: Omit<GradeScale, 'id'>[] = [
  { name: 'Outstanding', minPercent: 90, maxPercent: 100, grade: 'A+', gpa: 4.0, remarks: 'Outstanding' },
  { name: 'Excellent', minPercent: 80, maxPercent: 89.99, grade: 'A', gpa: 3.7, remarks: 'Excellent' },
  { name: 'Very Good', minPercent: 70, maxPercent: 79.99, grade: 'B', gpa: 3.0, remarks: 'Very Good' },
  { name: 'Good', minPercent: 60, maxPercent: 69.99, grade: 'C', gpa: 2.0, remarks: 'Good' },
  { name: 'Satisfactory', minPercent: 50, maxPercent: 59.99, grade: 'D', gpa: 1.0, remarks: 'Satisfactory' },
  { name: 'Pass', minPercent: 40, maxPercent: 49.99, grade: 'E', gpa: 0.7, remarks: 'Needs Improvement' },
  { name: 'Fail', minPercent: 0, maxPercent: 39.99, grade: 'F', gpa: 0, remarks: 'Fail — requires support' },
];
