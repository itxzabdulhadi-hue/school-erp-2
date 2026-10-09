import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('results', () => {
  it('computes grades, ranks and class stats', async () => {
    const res = await request(fx.app)
      .get(`/api/v1/results?examId=${fx.examId}&classId=${fx.classId}`)
      .set('Authorization', bearer(fx.tokens.teacher));
    expect(res.status).toBe(200);
    expect(res.body.data.rows).toHaveLength(2);
    const [first, second] = res.body.data.rows as { studentId: string; grade: string; rank: number; percent: number }[];
    expect(first.studentId).toBe(fx.pupil1);
    expect(first.grade).toBe('A');
    expect(first.rank).toBe(1);
    expect(second.grade).toBe('C');
    expect(second.rank).toBe(2);
    expect(res.body.data.stats.average).toBe(73.5);
    expect(res.body.data.stats.passPct).toBe(100);
  });

  it('teachers can enter marks; ranks update', async () => {
    const save = await request(fx.app).post('/api/v1/marks')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({ scheduleId: fx.scheduleId, studentId: fx.pupil2, obtainedMarks: 95 });
    expect(save.status).toBe(201);

    const res = await request(fx.app)
      .get(`/api/v1/results?examId=${fx.examId}&classId=${fx.classId}`)
      .set('Authorization', bearer(fx.tokens.teacher));
    // Rows come back in name order; rank/grade carry the standing.
    const rows = res.body.data.rows as { studentId: string; grade: string; rank: number }[];
    const second = rows.find((r) => r.studentId === fx.pupil2)!;
    const first = rows.find((r) => r.studentId === fx.pupil1)!;
    expect(second.grade).toBe('A+');
    expect(second.rank).toBe(1);
    expect(first.rank).toBe(2);
  });

  it('rejects marks above the maximum', async () => {
    const res = await request(fx.app).post('/api/v1/marks')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({ scheduleId: fx.scheduleId, studentId: fx.pupil2, obtainedMarks: 500 });
    expect(res.status).toBe(422);
  });

  it('students cannot enter marks', async () => {
    const res = await request(fx.app).post('/api/v1/marks')
      .set('Authorization', bearer(fx.tokens.student))
      .send({ scheduleId: fx.scheduleId, studentId: fx.pupil1, obtainedMarks: 100 });
    expect(res.status).toBe(403);
  });
});
