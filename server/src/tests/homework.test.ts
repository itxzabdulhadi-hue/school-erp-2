import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('homework', () => {
  it('teachers create homework; students of the class see it', async () => {
    const created = await request(fx.app).post('/api/v1/homework')
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({
        classId: fx.classId, subjectId: fx.subjectIds[0], title: 'Read ch. 2',
        assignedDate: '2026-10-06', dueDate: '2026-10-13',
      });
    expect(created.status).toBe(201);

    const mine = await request(fx.app).get('/api/v1/homework').set('Authorization', bearer(fx.tokens.student));
    expect(mine.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('students submit; teachers review', async () => {
    const sub = await request(fx.app).post(`/api/v1/homework/${fx.homeworkId}/submissions`)
      .set('Authorization', bearer(fx.tokens.student))
      .field('text', 'My answers attached in notebook.');
    expect(sub.status).toBe(201);

    const empty = await request(fx.app).post(`/api/v1/homework/${fx.homeworkId}/submissions`)
      .set('Authorization', bearer(fx.tokens.student))
      .field('text', '');
    expect(empty.status).toBe(422);

    const all = await request(fx.app).get(`/api/v1/homework/${fx.homeworkId}/submissions`)
      .set('Authorization', bearer(fx.tokens.teacher));
    expect(all.body.data).toHaveLength(1);

    const own = await request(fx.app).get(`/api/v1/homework/${fx.homeworkId}/submissions`)
      .set('Authorization', bearer(fx.tokens.student));
    expect(own.body.data).toHaveLength(1);

    const review = await request(fx.app).patch(`/api/v1/submissions/${all.body.data[0].id}`)
      .set('Authorization', bearer(fx.tokens.teacher))
      .send({ feedback: 'Well done', score: 9, status: 'reviewed' });
    expect(review.status).toBe(200);

    const detail = await request(fx.app).get(`/api/v1/homework/${fx.homeworkId}`)
      .set('Authorization', bearer(fx.tokens.student));
    expect(detail.body.data.mySubmission.feedback).toBe('Well done');
  });

  it('students cannot create homework', async () => {
    const res = await request(fx.app).post('/api/v1/homework')
      .set('Authorization', bearer(fx.tokens.student))
      .send({ classId: fx.classId, subjectId: fx.subjectIds[0], title: 'x', assignedDate: '2026-10-06', dueDate: '2026-10-13' });
    expect(res.status).toBe(403);
  });
});
