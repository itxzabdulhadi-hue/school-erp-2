/**
 * FUTURE-READY AUTH / RBAC SCAFFOLD — intentionally NOT enforced in this version.
 *
 * Per product scope, this release ships without login, sessions, or permission
 * enforcement. This module defines the role & permission vocabulary now so a
 * future auth release can:
 *   1. add a `User` table (id, name, email, passwordHash, role, scopeIds),
 *   2. implement `useSession()` / `useCan()` for real checks,
 *   3. wrap actions with `<Can permission="students.delete">` without refactoring.
 *
 * Until then, `useCan()` always returns true and `Can` always renders children.
 */
import type { ReactNode } from 'react';

export type Role =
  | 'super-admin'
  | 'school-admin'
  | 'principal'
  | 'accountant'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'librarian'
  | 'transport-manager';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type PermissionModule =
  | 'dashboard'
  | 'students'
  | 'classes'
  | 'teachers'
  | 'staff'
  | 'attendance'
  | 'leaves'
  | 'subjects'
  | 'timetable'
  | 'exams'
  | 'results'
  | 'fees'
  | 'homework'
  | 'materials'
  | 'announcements'
  | 'events'
  | 'messages'
  | 'library'
  | 'transport'
  | 'inventory'
  | 'discipline'
  | 'certificates'
  | 'documents'
  | 'reports'
  | 'notifications'
  | 'settings';

export type Permission = `${PermissionModule}.${PermissionAction}`;

/** Draft permission matrix for the future auth release (reference only). */
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  'super-admin': ['dashboard.view'],
  'school-admin': ['dashboard.view'],
  principal: ['dashboard.view'],
  accountant: ['dashboard.view', 'fees.view'],
  teacher: ['dashboard.view'],
  student: ['dashboard.view'],
  parent: ['dashboard.view'],
  librarian: ['dashboard.view', 'library.view'],
  'transport-manager': ['dashboard.view', 'transport.view'],
};

export interface FutureUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Scoping ids, e.g. teacherId / studentIds / classIds depending on role. */
  scope: Record<string, string[]>;
}

/** Stub: always allows. A future release will check the live session here. */
export function useCan(_permission?: Permission): boolean {
  void _permission;
  return true;
}

/** Stub gate: always renders children. */
export function Can(props: { permission?: Permission; children: ReactNode }): ReactNode {
  void props.permission;
  return props.children;
}
