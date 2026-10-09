import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, requirePerm } from '../auth/permissions';
import { one, q } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { upload } from '../middleware/upload';
import { downloadFile } from './files';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

const OWNER_TYPES = ['school', 'student', 'teacher', 'staff', 'class'] as const;

router.get('/', requirePerm(PERMISSIONS.documentsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const { ownerType, ownerId } = req.query as Record<string, string | undefined>;
    const params: unknown[] = [a.schoolId];
    const where = ['d.school_id = $1'];
    if (a.role === 'student') {
      // Students see school-wide documents plus their own.
      where.push(`(d.owner_type = 'school' OR (d.owner_type = 'student' AND d.owner_id = '${a.linkedStudentId ?? ''}'))`);
    } else {
      if (ownerType) { params.push(ownerType); where.push(`d.owner_type = $${params.length}`); }
      if (ownerId) { params.push(ownerId); where.push(`d.owner_id = $${params.length}`); }
    }
    const rows = await q(
      `SELECT d.id, d.owner_type AS "ownerType", d.owner_id AS "ownerId", d.title, d.kind,
              d.description, d.file_name AS "fileName", d.mime_type AS "mimeType",
              d.size_bytes AS "sizeBytes", d.uploaded_by AS "uploadedBy", d.created_at AS "createdAt",
              (d.file_path <> '') AS "hasFile", u.name AS "uploadedByName"
       FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by
       WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT 200`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

const metaSchema = z.object({
  ownerType: z.enum(OWNER_TYPES),
  ownerId: z.string().max(80).optional().default(''),
  title: z.string().min(1).max(200),
  kind: z.string().max(60).optional().default('other'),
  description: z.string().max(2000).optional().default(''),
});

router.post('/', requirePerm(PERMISSIONS.documentsCreate), upload.single('file'), async (req, res, next) => {
  try {
    const a = auth(req);
    const parsed = metaSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new AppError(422, 'VALIDATION_ERROR', 'Invalid document fields', parsed.error.flatten());
    if (!req.file) throw new AppError(422, 'VALIDATION_ERROR', 'A file is required.');
    const m = parsed.data;
    const row = await one<{ id: string }>(
      `INSERT INTO documents (id, school_id, owner_type, owner_id, title, kind, description,
        file_path, file_name, mime_type, size_bytes, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
      [randomUUID(), a.schoolId, m.ownerType, m.ownerId, m.title, m.kind, m.description,
        req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, a.userId],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/download', requirePerm(PERMISSIONS.documentsView), async (req, res, next) => {
  try {
    const a = auth(req);
    const doc = await one<{ filePath: string; fileName: string; ownerType: string; ownerId: string }>(
      `SELECT file_path AS "filePath", file_name AS "fileName",
              owner_type AS "ownerType", owner_id AS "ownerId"
       FROM documents WHERE id = $1 AND school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!doc || !doc.filePath) throw new AppError(404, 'NOT_FOUND', 'Document not found.');
    if (a.role === 'student' && !(doc.ownerType === 'school' || (doc.ownerType === 'student' && doc.ownerId === a.linkedStudentId))) {
      throw new AppError(403, 'FORBIDDEN', 'Not your document.');
    }
    downloadFile(res, doc.filePath, doc.fileName || 'document', next);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requirePerm(PERMISSIONS.documentsCreate), async (req, res, next) => {
  try {
    const a = auth(req);
    const doc = await one<{ uploadedBy: string }>(
      `SELECT uploaded_by AS "uploadedBy" FROM documents WHERE id = $1 AND school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!doc) throw new AppError(404, 'NOT_FOUND', 'Document not found.');
    if (a.role !== 'admin' && doc.uploadedBy !== a.userId) {
      throw new AppError(403, 'FORBIDDEN', 'Only the uploader (or admin) can delete this.');
    }
    await q(`DELETE FROM documents WHERE id = $1`, [req.params.id]);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});
