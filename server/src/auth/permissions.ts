/**
 * Server-side RBAC — the single enforcement point for the whole platform.
 * Mirrors the vocabulary of web `src/auth/roles.ts` (`module.action`) with a full
 * matrix for the four mobile roles. The mobile app mirrors this matrix for UI
 * gating ONLY; every mutation and scoped read is re-checked here.
 */
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../middleware/errors';

export const ROLES = ['admin', 'teacher', 'student', 'staff'] as const;

export type Role = (typeof ROLES)[number];

/** Canonical permission strings used by both API enforcement and mobile UI gating. */
export const PERMISSIONS = {
  dashboardView: 'dashboard.view',
  studentsView: 'students.view',
  studentsCreate: 'students.create',
  studentsEdit: 'students.edit',
  classesView: 'classes.view',
  teachersView: 'teachers.view',
  staffView: 'staff.view',
  attendanceView: 'attendance.view',
  attendanceMark: 'attendance.create',
  attendanceEdit: 'attendance.edit',
  subjectsView: 'subjects.view',
  timetableView: 'timetable.view',
  examsView: 'exams.view',
  resultsView: 'results.view',
  resultsEnter: 'results.create',
  resultsEdit: 'results.edit',
  feesView: 'fees.view',
  feesCollect: 'fees.create',
  homeworkView: 'homework.view',
  homeworkCreate: 'homework.create',
  homeworkEdit: 'homework.edit',
  homeworkSubmit: 'homework.submit',
  materialsView: 'materials.view',
  materialsCreate: 'materials.create',
  announcementsView: 'announcements.view',
  announcementsCreate: 'announcements.create',
  eventsView: 'events.view',
  eventsCreate: 'events.create',
  documentsView: 'documents.view',
  documentsCreate: 'documents.create',
  notificationsView: 'notifications.view',
  notificationsBroadcast: 'notifications.create',
  usersView: 'users.view',
  usersManage: 'users.create',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL = '*';

export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  admin: [ALL],
  teacher: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.studentsView,
    PERMISSIONS.classesView,
    PERMISSIONS.teachersView,
    PERMISSIONS.staffView,
    PERMISSIONS.attendanceView,
    PERMISSIONS.attendanceMark,
    PERMISSIONS.attendanceEdit,
    PERMISSIONS.subjectsView,
    PERMISSIONS.timetableView,
    PERMISSIONS.examsView,
    PERMISSIONS.resultsView,
    PERMISSIONS.resultsEnter,
    PERMISSIONS.resultsEdit,
    PERMISSIONS.homeworkView,
    PERMISSIONS.homeworkCreate,
    PERMISSIONS.homeworkEdit,
    PERMISSIONS.materialsView,
    PERMISSIONS.materialsCreate,
    PERMISSIONS.announcementsView,
    PERMISSIONS.announcementsCreate,
    PERMISSIONS.eventsView,
    PERMISSIONS.documentsView,
    PERMISSIONS.documentsCreate,
    PERMISSIONS.notificationsView,
  ],
  student: [
    PERMISSIONS.dashboardView,
    // NOTE: students hold students.view but routes force self-scope (list → [self]).
    PERMISSIONS.studentsView,
    PERMISSIONS.attendanceView,
    PERMISSIONS.timetableView,
    PERMISSIONS.examsView,
    PERMISSIONS.resultsView,
    PERMISSIONS.feesView,
    PERMISSIONS.homeworkView,
    PERMISSIONS.homeworkSubmit,
    PERMISSIONS.materialsView,
    PERMISSIONS.announcementsView,
    PERMISSIONS.eventsView,
    PERMISSIONS.documentsView,
    PERMISSIONS.notificationsView,
  ],
  staff: [
    PERMISSIONS.dashboardView,
    PERMISSIONS.studentsView,
    PERMISSIONS.teachersView,
    PERMISSIONS.staffView,
    PERMISSIONS.attendanceView,
    PERMISSIONS.timetableView,
    PERMISSIONS.announcementsView,
    PERMISSIONS.eventsView,
    PERMISSIONS.documentsView,
    PERMISSIONS.documentsCreate,
    PERMISSIONS.notificationsView,
  ],
};

export function permissionsFor(role: Role): string[] {
  return role === 'admin' ? [ALL, ...Object.values(PERMISSIONS)] : ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: string): boolean {
  if (role === 'admin') return true;
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Admin-only guard via a pseudo-permission that only the admin bypass satisfies. */
export const adminOnly = requirePerm('admin.only');
export function requirePerm(...perms: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const auth = req.auth;
    if (!auth) {
      next(new AppError(401, 'UNAUTHENTICATED', 'Authentication required'));
      return;
    }
    if (auth.role === 'admin' || perms.some((p) => hasPermission(auth.role, p))) {
      next();
      return;
    }
    next(new AppError(403, 'FORBIDDEN', `Requires permission: ${perms.join(' or ')}`));
  };
}
