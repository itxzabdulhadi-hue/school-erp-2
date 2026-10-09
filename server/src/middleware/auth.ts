import type { NextFunction, Request, Response } from 'express';
import { one } from '../db';
import { verifyAccess } from '../auth/tokens';
import type { Role } from '../auth/permissions';
import { AppError } from './errors';

export interface AuthContext {
  userId: string;
  role: Role;
  schoolId: string;
  userName: string;
  linkedStudentId: string | null;
  linkedTeacherId: string | null;
  linkedStaffId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

interface UserRow {
  id: string;
  role: Role;
  schoolId: string;
  name: string;
  isActive: boolean;
  linkedStudentId: string | null;
  linkedTeacherId: string | null;
  linkedStaffId: string | null;
}

/** Verify Bearer access token and attach the live user context (active check included). */
export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) throw new AppError(401, 'UNAUTHENTICATED', 'Missing access token');
    let claims;
    try {
      claims = verifyAccess(token);
    } catch {
      throw new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired access token');
    }
    const user = await one<UserRow>(
      `SELECT id, role, school_id AS "schoolId", name, is_active AS "isActive",
              linked_student_id AS "linkedStudentId", linked_teacher_id AS "linkedTeacherId",
              linked_staff_id AS "linkedStaffId"
       FROM users WHERE id = $1`,
      [claims.sub],
    );
    if (!user || !user.isActive || user.schoolId !== claims.schoolId) {
      throw new AppError(401, 'UNAUTHENTICATED', 'Session is no longer valid');
    }
    req.auth = {
      userId: user.id,
      role: user.role,
      schoolId: user.schoolId,
      userName: user.name,
      linkedStudentId: user.linkedStudentId,
      linkedTeacherId: user.linkedTeacherId,
      linkedStaffId: user.linkedStaffId,
    };
    next();
  } catch (err) {
    next(err);
  }
}
