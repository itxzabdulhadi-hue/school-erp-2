import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('rbac enforcement', () => {
  it('students only ever see their own record', async () => {
    const list = await request(fx.app).get('/api/v1/students').set('Authorization', bearer(fx.tokens.student));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].id).toBe(fx.pupil1);

    const other = await request(fx.app).get(`/api/v1/students/${fx.pupil2}`).set('Authorization', bearer(fx.tokens.student));
    expect(other.status).toBe(403);
  });

  it('teachers can read students but cannot touch money', async () => {
    const list = await request(fx.app).get('/api/v1/students').set('Authorization', bearer(fx.tokens.teacher));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);

    const pay = await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 100 });
    expect(pay.status).toBe(403);
  });

  it('students cannot collect payments', async () => {
    const pay = await request(fx.app).post('/api/v1/payments')
      .set('Authorization', bearer(fx.tokens.student))
      .send({ invoiceId: fx.invoiceUnpaid, amount: 100 });
    expect(pay.status).toBe(403);
  });

  it('teachers can mark attendance', async () => {
    const res = await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({
        date: '2026-10-06', classId: fx.classId,
        records: [
          { studentId: fx.pupil1, status: 'present' },
          { studentId: fx.pupil2, status: 'absent' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.saved).toBe(2);
  });

  it('students cannot mark attendance', async () => {
    const res = await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.student))
      .send({ date: '2026-10-06', classId: fx.classId, records: [{ studentId: fx.pupil1, status: 'present' }] });
    expect(res.status).toBe(403);
  });

  it('students see only their own results', async () => {
    const res = await request(fx.app)
      .get(`/api/v1/results?examId=${fx.examId}&classId=${fx.classId}&studentId=${fx.pupil2}`)
      .set('Authorization', bearer(fx.tokens.student));
    expect(res.status).toBe(200);
    // server forced the scope to the signed-in student despite the query param
    expect(res.body.data.rows).toHaveLength(1);
    expect(res.body.data.rows[0].studentId).toBe(fx.pupil1);
  });

  it('non-admins cannot manage users', async () => {
    for (const role of ['teacher', 'student', 'staff'] as const) {
      const res = await request(fx.app).get('/api/v1/users').set('Authorization', bearer(fx.tokens[role]));
      expect(res.status).toBe(403);
    }
    const ok = await request(fx.app).get('/api/v1/users').set('Authorization', bearer(fx.tokens.admin));
    expect(ok.status).toBe(200);
  });

  it('students cannot read other students invoices', async () => {
    const res = await request(fx.app).get('/api/v1/invoices').set('Authorization', bearer(fx.tokens.student));
    expect(res.status).toBe(200);
    for (const inv of res.body.data as { studentId: string }[]) expect(inv.studentId).toBe(fx.pupil1);
  });
});
