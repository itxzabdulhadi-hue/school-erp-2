import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('attendance', () => {
  it('saves and replaces a day sheet atomically', async () => {
    const first = await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({
        date: '2026-10-06', classId: fx.classId,
        records: [
          { studentId: fx.pupil1, status: 'present' },
          { studentId: fx.pupil2, status: 'present' },
        ],
      });
    expect(first.status).toBe(201);

    const second = await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({
        date: '2026-10-06', classId: fx.classId,
        records: [
          { studentId: fx.pupil1, status: 'present' },
          { studentId: fx.pupil2, status: 'absent' },
        ],
      });
    expect(second.status).toBe(201);

    const sheet = await request(fx.app).get(`/api/v1/attendance?date=2026-10-06&classId=${fx.classId}`)
      .set('Authorization', bearer(fx.tokens.teacher));
    expect(sheet.body.data).toHaveLength(2);
    expect(sheet.body.data.find((r: { studentId: string }) => r.studentId === fx.pupil2).status).toBe('absent');
  });

  it('rejects students outside the class', async () => {
    const res = await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({ date: '2026-10-06', classId: fx.classId, records: [{ studentId: 'no-such-id', status: 'present' }] });
    expect(res.status).toBe(422);
  });

  it('gives students their own history with a summary', async () => {
    await request(fx.app).post('/api/v1/attendance/bulk')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({
        date: '2026-10-07', classId: fx.classId,
        records: [
          { studentId: fx.pupil1, status: 'present' },
          { studentId: fx.pupil2, status: 'present' },
        ],
      });
    const me = await request(fx.app).get('/api/v1/attendance/me').set('Authorization', bearer(fx.tokens.student));
    expect(me.status).toBe(200);
    expect(me.body.data.summary.total).toBe(2);
    expect(me.body.data.summary.present).toBe(2);
    expect(me.body.data.summary.pct).toBe(100);

    const summary = await request(fx.app).get(`/api/v1/attendance/summary?studentId=${fx.pupil2}`)
      .set('Authorization', bearer(fx.tokens.teacher));
    expect(summary.body.data.total).toBe(2);
    expect(summary.body.data.pct).toBe(50);
  });
});
