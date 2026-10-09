import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('documents', () => {
  it('uploads, lists and downloads with permission checks', async () => {
    const up = await request(fx.app).post('/api/v1/documents')
      .set('Authorization', bearer(fx.tokens.admin))
      .field('ownerType', 'school')
      .field('title', 'Calendar')
      .attach('file', Buffer.from('term dates'), 'calendar.txt');
    expect(up.status).toBe(201);

    const list = await request(fx.app).get('/api/v1/documents').set('Authorization', bearer(fx.tokens.student));
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThanOrEqual(1);

    const dl = await request(fx.app).get(`/api/v1/documents/${up.body.data.id}/download`)
      .set('Authorization', bearer(fx.tokens.student));
    expect(dl.status).toBe(200);
    expect(dl.text).toBe('term dates');
  });

  it('students cannot upload or read other students files', async () => {
    const up = await request(fx.app).post('/api/v1/documents')
      .set('Authorization', bearer(fx.tokens.student))
      .field('ownerType', 'school')
      .field('title', 'Sneaky')
      .attach('file', Buffer.from('x'), 'x.txt');
    expect(up.status).toBe(403);

    const other = await request(fx.app).post('/api/v1/documents')
      .set('Authorization', bearer(fx.tokens.teacher))
      .field('ownerType', 'student')
      .field('ownerId', fx.pupil2)
      .field('title', 'Private')
      .attach('file', Buffer.from('private'), 'private.txt');
    expect(other.status).toBe(201);

    const dl = await request(fx.app).get(`/api/v1/documents/${other.body.data.id}/download`)
      .set('Authorization', bearer(fx.tokens.student));
    expect(dl.status).toBe(403);
  });
});
