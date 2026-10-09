/**
 * UI gating helpers. These ONLY decide what to show — every endpoint re-checks
 * permissions server-side (`server/src/auth/permissions.ts`). The permission list
 * comes from the server (/auth/me), never from a local matrix copy.
 */

/** Canonical permission strings (must match the server). */
export const PERM = {
  studentsView: 'students.view',
  studentsCreate: 'students.create',
  teachersView: 'teachers.view',
  staffView: 'staff.view',
  classesView: 'classes.view',
  attendanceView: 'attendance.view',
  attendanceMark: 'attendance.create',
  timetableView: 'timetable.view',
  examsView: 'exams.view',
  resultsView: 'results.view',
  resultsEnter: 'results.create',
  feesView: 'fees.view',
  feesCollect: 'fees.create',
  homeworkView: 'homework.view',
  homeworkCreate: 'homework.create',
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

export function can(permissions: readonly string[] | null | undefined, permission: string): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(permission);
}

export function canAny(permissions: readonly string[] | null | undefined, list: string[]): boolean {
  return list.some((p) => can(permissions, p));
}
