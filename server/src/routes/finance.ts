import { randomUUID } from 'crypto';
import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS, adminOnly, requirePerm } from '../auth/permissions';
import { one, q, tx } from '../db';
import { authenticate, type AuthContext } from '../middleware/auth';
import { AppError } from '../middleware/errors';
import { dateString, validateBody } from '../middleware/validate';

export const router = Router();
router.use(authenticate);

const auth = (req: { auth?: AuthContext }): AuthContext => {
  if (!req.auth) throw new AppError(401, 'UNAUTHENTICATED', 'Authentication required');
  return req.auth;
};

const INV_COLS = `i.id, i.school_id AS "schoolId", i.invoice_no AS "invoiceNo", i.student_id AS "studentId",
  i.title, i.issue_date AS "issueDate", i.due_date AS "dueDate", i.subtotal, i.discount, i.tax,
  i.total, i.paid, (i.total - i.paid) AS "balance", i.status, i.notes,
  TRIM(s.first_name || ' ' || s.last_name) AS "studentName", s.admission_no AS "admissionNo"`;

router.get('/fee-types', requirePerm(PERMISSIONS.feesView), async (req, res, next) => {
  try {
    const rows = await q(
      `SELECT id, name, frequency, amount, description FROM fee_types WHERE school_id = $1 ORDER BY name`,
      [auth(req).schoolId],
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/fee-types', adminOnly, validateBody(z.object({
  name: z.string().min(1).max(120),
  frequency: z.enum(['one-time', 'monthly', 'quarterly', 'annual']).optional().default('monthly'),
  amount: z.number().min(0).max(10000000),
  description: z.string().max(300).optional().default(''),
})), async (req, res, next) => {
  try {
    const b = req.body as { name: string; frequency: string; amount: number; description: string };
    const row = await one<{ id: string }>(
      `INSERT INTO fee_types (id, school_id, name, frequency, amount, description)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
      [randomUUID(), auth(req).schoolId, b.name, b.frequency, b.amount, b.description],
    );
    res.status(201).json({ data: { id: row!.id } });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices', requirePerm(PERMISSIONS.feesView), async (req, res, next) => {
  try {
    const a = auth(req);
    let { studentId, status, from, to } = req.query as Record<string, string | undefined>;
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked.');
      studentId = a.linkedStudentId;
    }
    const params: unknown[] = [a.schoolId];
    const where = ['i.school_id = $1'];
    if (studentId) { params.push(studentId); where.push(`i.student_id = $${params.length}`); }
    if (status) { params.push(status); where.push(`i.status = $${params.length}`); }
    if (from) { params.push(from); where.push(`i.issue_date >= $${params.length}`); }
    if (to) { params.push(to); where.push(`i.issue_date <= $${params.length}`); }
    const rows = await q(
      `SELECT ${INV_COLS} FROM invoices i JOIN students s ON s.id = i.student_id
       WHERE ${where.join(' AND ')} ORDER BY i.issue_date DESC, i.created_at DESC LIMIT 300`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/invoices/:id', requirePerm(PERMISSIONS.feesView), async (req, res, next) => {
  try {
    const a = auth(req);
    const inv = await one<{ studentId: string } & Record<string, unknown>>(
      `SELECT ${INV_COLS} FROM invoices i JOIN students s ON s.id = i.student_id
       WHERE i.id = $1 AND i.school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!inv) throw new AppError(404, 'NOT_FOUND', 'Invoice not found.');
    if (a.role === 'student' && inv.studentId !== a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your invoice.');
    }
    const lines = await q(
      `SELECT id, fee_type_id AS "feeTypeId", label, qty, amount FROM invoice_lines WHERE invoice_id = $1`,
      [inv.id],
    );
    const payments = await q(
      `SELECT id, receipt_no AS "receiptNo", amount, method, reference,
              payment_date AS "paymentDate", received_by AS "receivedBy"
       FROM payments WHERE invoice_id = $1 ORDER BY payment_date DESC`,
      [inv.id],
    );
    res.json({ data: { ...inv, lines, payments } });
  } catch (err) {
    next(err);
  }
});

async function nextDocNo(prefix: string, table: string, col: string, schoolId: string): Promise<string> {
  const year = new Date().getFullYear();
  const row = await one<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM ${table} WHERE school_id = $1`, [schoolId],
  );
  return `${prefix}-${year}-${String((row?.count ?? 0) + 1).padStart(4, '0')}`;
}

router.post('/invoices', adminOnly, validateBody(z.object({
  studentId: z.string().min(1),
  title: z.string().max(160).optional().default(''),
  issueDate: dateString,
  dueDate: dateString,
  lines: z.array(z.object({
    feeTypeId: z.string().nullable().optional(),
    label: z.string().min(1).max(160),
    qty: z.number().min(0).max(10000).optional().default(1),
    amount: z.number().min(0).max(10000000),
  })).min(1).max(50),
  discount: z.number().min(0).max(10000000).optional().default(0),
  tax: z.number().min(0).max(10000000).optional().default(0),
  notes: z.string().max(500).optional().default(''),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as {
      studentId: string; title: string; issueDate: string; dueDate: string;
      lines: { feeTypeId?: string | null; label: string; qty: number; amount: number }[];
      discount: number; tax: number; notes: string;
    };
    const stu = await one(`SELECT id FROM students WHERE id = $1 AND school_id = $2`, [b.studentId, a.schoolId]);
    if (!stu) throw new AppError(422, 'VALIDATION_ERROR', 'Student does not exist.');
    const subtotal = b.lines.reduce((t, l) => t + l.qty * l.amount, 0);
    const total = Math.max(0, subtotal - b.discount + b.tax);
    const id = randomUUID();
    await tx(async (client) => {
      await client.query(
        `INSERT INTO invoices (id, school_id, invoice_no, student_id, title, issue_date, due_date,
          subtotal, discount, tax, total, paid, status, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,0,'unpaid',$12)`,
        [id, a.schoolId, await nextDocNo('INV', 'invoices', 'invoice_no', a.schoolId),
          b.studentId, b.title, b.issueDate, b.dueDate, subtotal, b.discount, b.tax, total, b.notes],
      );
      for (const l of b.lines) {
        await client.query(
          `INSERT INTO invoice_lines (id, invoice_id, fee_type_id, label, qty, amount)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [randomUUID(), id, l.feeTypeId ?? null, l.label, l.qty, l.amount],
        );
      }
    });
    res.status(201).json({ data: { id } });
  } catch (err) {
    next(err);
  }
});

router.patch('/invoices/:id', adminOnly, validateBody(z.object({
  dueDate: dateString.optional(),
  notes: z.string().max(500).optional(),
  discount: z.number().min(0).max(10000000).optional(),
  status: z.enum(['cancelled']).optional(),
}).partial()), async (req, res, next) => {
  try {
    const a = auth(req);
    const inv = await one<{ subtotal: number; tax: number; paid: number; status: string }>(
      `SELECT subtotal, tax, paid, status FROM invoices WHERE id = $1 AND school_id = $2`,
      [req.params.id, a.schoolId],
    );
    if (!inv) throw new AppError(404, 'NOT_FOUND', 'Invoice not found.');
    const b = req.body as { dueDate?: string; notes?: string; discount?: number; status?: string };
    if (b.status === 'cancelled' && Number(inv.paid) > 0) {
      throw new AppError(422, 'VALIDATION_ERROR', 'Cannot cancel an invoice that has payments.');
    }
    const sets = ['updated_at = NOW()'];
    const params: unknown[] = [];
    const put = (frag: string, v?: unknown): void => { if (v !== undefined) params.push(v); sets.push(frag.replace('?', `$${params.length}`)); };
    if (b.dueDate) put('due_date = ?', b.dueDate);
    if (b.notes !== undefined) put('notes = ?', b.notes);
    if (b.status === 'cancelled') sets.push(`status = 'cancelled'`);
    if (b.discount !== undefined) {
      const total = Math.max(0, Number(inv.subtotal) - b.discount + Number(inv.tax));
      if (total < Number(inv.paid)) throw new AppError(422, 'VALIDATION_ERROR', 'Discount would take the total below amount paid.');
      params.push(b.discount, total);
      sets.push(`discount = $${params.length - 1}, total = $${params.length}`);
      if (inv.status !== 'cancelled') {
        sets.push(total <= Number(inv.paid) ? `status = 'paid'` : `status = 'partial'`);
      }
    }
    params.push(req.params.id);
    await q(`UPDATE invoices SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ data: { ok: true } });
  } catch (err) {
    next(err);
  }
});

router.get('/payments', requirePerm(PERMISSIONS.feesView), async (req, res, next) => {
  try {
    const a = auth(req);
    let { invoiceId, studentId } = req.query as Record<string, string | undefined>;
    if (a.role === 'student') {
      if (!a.linkedStudentId) throw new AppError(403, 'FORBIDDEN', 'No student profile linked.');
      studentId = a.linkedStudentId;
    }
    const params: unknown[] = [a.schoolId];
    const where = ['p.school_id = $1'];
    if (invoiceId) { params.push(invoiceId); where.push(`p.invoice_id = $${params.length}`); }
    if (studentId) { params.push(studentId); where.push(`p.student_id = $${params.length}`); }
    const rows = await q(
      `SELECT p.id, p.invoice_id AS "invoiceId", p.student_id AS "studentId",
              p.receipt_no AS "receiptNo", p.amount, p.method, p.reference,
              p.payment_date AS "paymentDate", p.received_by AS "receivedBy", p.notes,
              i.invoice_no AS "invoiceNo",
              TRIM(s.first_name || ' ' || s.last_name) AS "studentName"
       FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN students s ON s.id = p.student_id
       WHERE ${where.join(' AND ')} ORDER BY p.payment_date DESC LIMIT 300`,
      params,
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
});

router.post('/payments', requirePerm(PERMISSIONS.feesCollect), validateBody(z.object({
  invoiceId: z.string().min(1),
  amount: z.number().positive().max(10000000),
  method: z.enum(['cash', 'bank', 'card', 'online', 'cheque', 'other']).optional().default('cash'),
  reference: z.string().max(120).optional().default(''),
  paymentDate: dateString.optional(),
  receivedBy: z.string().max(120).optional().default(''),
  notes: z.string().max(500).optional().default(''),
})), async (req, res, next) => {
  try {
    const a = auth(req);
    const b = req.body as {
      invoiceId: string; amount: number; method: string; reference: string;
      paymentDate?: string; receivedBy: string; notes: string;
    };
    const out = await tx(async (client) => {
      const invRes = await client.query(
        `SELECT id, school_id, student_id, invoice_no, total, paid, status, due_date
         FROM invoices WHERE id = $1`,
        [b.invoiceId],
      );
      const inv = invRes.rows[0] as Record<string, string | number> | undefined;
      if (!inv || String(inv.school_id) !== a.schoolId) {
        throw new AppError(404, 'NOT_FOUND', 'Invoice not found.');
      }
      if (String(inv.status) === 'cancelled') throw new AppError(422, 'VALIDATION_ERROR', 'Invoice is cancelled.');
      if (String(inv.status) === 'paid') throw new AppError(422, 'VALIDATION_ERROR', 'Invoice is already fully paid.');
      const total = Number(inv.total);
      const paid = Number(inv.paid);
      const balance = Math.round((total - paid) * 100) / 100;
      if (b.amount - balance > 0.005) {
        throw new AppError(422, 'VALIDATION_ERROR', `Amount exceeds the outstanding balance (${balance}).`);
      }
      const paymentId = randomUUID();
      const receiptNo = await nextDocNo('RCP', 'payments', 'receipt_no', a.schoolId);
      await client.query(
        `INSERT INTO payments (id, school_id, invoice_id, student_id, receipt_no, amount, method,
          reference, payment_date, received_by, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [paymentId, a.schoolId, b.invoiceId, String(inv.student_id), receiptNo, b.amount, b.method,
          b.reference, b.paymentDate ?? new Date().toISOString().slice(0, 10), b.receivedBy || a.userName, b.notes],
      );
      const newPaid = Math.round((paid + b.amount) * 100) / 100;
      const today = new Date().toISOString().slice(0, 10);
      const due = String(inv.due_date).slice(0, 10);
      const status = newPaid >= total - 0.005 ? 'paid' : due < today ? 'overdue' : 'partial';
      await client.query(`UPDATE invoices SET paid = $1, status = $2, updated_at = NOW() WHERE id = $3`, [newPaid, status, b.invoiceId]);
      return { id: paymentId, receiptNo, newPaid, status };
    });
    // Only now — after the committed transaction — is the payment confirmed.
    res.status(201).json({ data: out });
  } catch (err) {
    next(err);
  }
});

/** Full receipt payload (payment + invoice + student + school branding) for rendering. */
router.get('/receipts/:paymentId', requirePerm(PERMISSIONS.feesView), async (req, res, next) => {
  try {
    const a = auth(req);
    const pay = await one<Record<string, unknown>>(
      `SELECT p.id, p.receipt_no AS "receiptNo", p.amount, p.method, p.reference,
              p.payment_date AS "paymentDate", p.received_by AS "receivedBy", p.notes,
              p.student_id AS "studentId", p.invoice_id AS "invoiceId"
       FROM payments p WHERE p.id = $1 AND p.school_id = $2`,
      [req.params.paymentId, a.schoolId],
    );
    if (!pay) throw new AppError(404, 'NOT_FOUND', 'Receipt not found.');
    if (a.role === 'student' && pay.studentId !== a.linkedStudentId) {
      throw new AppError(403, 'FORBIDDEN', 'Not your receipt.');
    }
    const invoice = await one(
      `SELECT invoice_no AS "invoiceNo", title, issue_date AS "issueDate", due_date AS "dueDate",
              subtotal, discount, tax, total, paid, status
       FROM invoices WHERE id = $1`, [pay.invoiceId],
    );
    const student = await one(
      `SELECT s.id, s.student_id_code AS "studentIdCode", s.admission_no AS "admissionNo",
              s.first_name AS "firstName", s.last_name AS "lastName", c.name AS "className"
       FROM students s LEFT JOIN classes c ON c.id = s.class_id WHERE s.id = $1`, [pay.studentId],
    );
    const school = await one(
      `SELECT name, tagline, logo_url AS "logoUrl", primary_color AS "primaryColor",
              currency, currency_symbol AS "currencySymbol"
       FROM schools WHERE id = $1`, [a.schoolId],
    );
    res.json({ data: { payment: pay, invoice, student, school } });
  } catch (err) {
    next(err);
  }
});
