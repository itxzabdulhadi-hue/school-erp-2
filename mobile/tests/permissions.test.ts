import { describe, expect, it } from 'vitest';
import { can, canAny, PERM } from '../src/auth/permissions';

describe('UI permission gating (server list is the source of truth)', () => {
  it('grants everything to admin wildcard', () => {
    const admin = ['*'];
    expect(can(admin, PERM.feesCollect)).toBe(true);
    expect(can(admin, PERM.usersManage)).toBe(true);
  });

  it('gates teacher abilities', () => {
    const teacher = ['attendance.view', 'attendance.create', 'results.create', 'homework.create'];
    expect(can(teacher, PERM.attendanceMark)).toBe(true);
    expect(can(teacher, PERM.resultsEnter)).toBe(true);
    expect(can(teacher, PERM.feesCollect)).toBe(false);
    expect(can(teacher, PERM.usersView)).toBe(false);
  });

  it('gates student abilities', () => {
    const student = ['homework.view', 'homework.submit', 'fees.view', 'results.view'];
    expect(can(student, PERM.homeworkSubmit)).toBe(true);
    expect(can(student, PERM.homeworkCreate)).toBe(false);
    expect(can(student, PERM.attendanceMark)).toBe(false);
  });

  it('is null-safe and supports any-of checks', () => {
    expect(can(null, PERM.feesView)).toBe(false);
    expect(can(undefined, PERM.feesView)).toBe(false);
    expect(canAny(['a', 'b'], ['x', 'b'])).toBe(true);
    expect(canAny(['a'], ['x', 'y'])).toBe(false);
  });
});
