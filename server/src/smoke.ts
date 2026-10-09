/**
 * Belt-and-braces API verification that runs under plain tsx (no test runner):
 *   npx tsx src/smoke.ts
 * Migrates an in-memory Postgres, loads fixtures, and asserts the critical flows.
 */
import assert from 'node:assert/strict';
import request from 'supertest';

async function main(): Promise<void> {
  const { setupTestApp, bearer } = await import('./tests/setup');
  const { closePool } = await import('./db');
  const fx = await setupTestApp();
  const t = fx.tokens;
  let n = 0;
  const ok = (cond: unknown, name: string): void => {
    n += 1;
    assert.ok(cond, `SMOKE FAIL: ${name}`);
    // eslint-disable-next-line no-console
    console.log(`ok ${n} - ${name}`);
  };

  // auth
  const bad = await request(fx.app).post('/api/v1/auth/login').send({ email: 'admin@test.edu', password: 'nope' });
  ok(bad.status === 401, 'wrong password rejected');
  const me = await request(fx.app).get('/api/v1/auth/me').set('Authorization', bearer(t.teacher));
  ok(me.status === 200 && me.body.data.permissions.includes('attendance.create'), 'teacher /me with permissions');
  const anon = await request(fx.app).get('/api/v1/students');
  ok(anon.status === 401, 'anonymous student list rejected');

  // rbac
  const selfList = await request(fx.app).get('/api/v1/students').set('Authorization', bearer(t.student));
  ok(selfList.status === 200 && selfList.body.data.length === 1 && selfList.body.data[0].id === fx.pupil1, 'student scoped to self');
  const other = await request(fx.app).get(`/api/v1/students/${fx.pupil2}`).set('Authorization', bearer(t.student));
  ok(other.status === 403, 'student cannot read another pupil');
  const tpay = await request(fx.app).post('/api/v1/payments').set('Authorization', bearer(t.teacher)).send({ invoiceId: fx.invoiceUnpaid, amount: 10 });
  ok(tpay.status === 403, 'teacher cannot collect payments');
  const search = await request(fx.app).get('/api/v1/students?search=Pupil').set('Authorization', bearer(t.teacher));
  ok(search.status === 200 && search.body.data.length === 1 && search.body.data[0].id === fx.pupil1, 'student search filters');

  // finance
  const pay = await request(fx.app).post('/api/v1/payments').set('Authorization', bearer(t.admin)).send({ invoiceId: fx.invoiceUnpaid, amount: 2000 });
  ok(pay.status === 201 && /^RCP-/.test(pay.body.data.receiptNo), 'partial payment accepted with receipt no');
  const over = await request(fx.app).post('/api/v1/payments').set('Authorization', bearer(t.admin)).send({ invoiceId: fx.invoiceUnpaid, amount: 99999 });
  ok(over.status === 422, 'overpayment rejected');
  const inv = await request(fx.app).get(`/api/v1/invoices/${fx.invoiceUnpaid}`).set('Authorization', bearer(t.admin));
  ok(inv.body.data.paid === 2000 && inv.body.data.balance === 3000, 'invoice balances updated');

  // results + marks
  const res = await request(fx.app).get(`/api/v1/results?examId=${fx.examId}&classId=${fx.classId}`).set('Authorization', bearer(t.teacher));
  ok(res.body.data.rows[0].grade === 'A' && res.body.data.stats.average === 73.5, 'results graded + ranked');
  const mk = await request(fx.app).post('/api/v1/marks').set('Authorization', bearer(t.teacher)).send({ scheduleId: fx.scheduleId, studentId: fx.pupil2, obtainedMarks: 500 });
  ok(mk.status === 422, 'marks above max rejected');

  // attendance
  const bulk = await request(fx.app).post('/api/v1/attendance/bulk').set('Authorization', bearer(t.teacher)).send({
    date: '2026-10-06', classId: fx.classId,
    records: [{ studentId: fx.pupil1, status: 'present' }, { studentId: fx.pupil2, status: 'absent' }],
  });
  ok(bulk.status === 201 && bulk.body.data.saved === 2, 'attendance bulk saved');
  const mine = await request(fx.app).get('/api/v1/attendance/me').set('Authorization', bearer(t.student));
  ok(mine.body.data.summary.pct === 100, 'student attendance summary');

  // homework + documents + broadcast
  const sub = await request(fx.app).post(`/api/v1/homework/${fx.homeworkId}/submissions`).set('Authorization', bearer(t.student)).field('text', 'done');
  ok(sub.status === 201, 'homework submitted');
  const up = await request(fx.app).post('/api/v1/documents').set('Authorization', bearer(t.admin))
    .field('ownerType', 'school').field('title', 'Cal').attach('file', Buffer.from('dates'), 'cal.txt');
  ok(up.status === 201, 'document uploaded');
  const bc = await request(fx.app).post('/api/v1/notifications/broadcast').set('Authorization', bearer(t.admin)).send({ title: 'Hi', audience: 'student' });
  ok(bc.status === 201 && bc.body.data.delivered === 1, 'broadcast fanned out');
  const nt = await request(fx.app).get('/api/v1/notifications').set('Authorization', bearer(t.student));
  ok(nt.body.data.unreadCount === 1, 'student received broadcast');

  await closePool();
  // eslint-disable-next-line no-console
  console.log(`\nSMOKE PASS (${n} assertions)`);
}

main().then(
  () => process.exit(0),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  },
);
