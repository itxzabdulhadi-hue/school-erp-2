import { beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { bearer, setupTestApp, type Fixtures } from './setup';

let fx: Fixtures;
beforeAll(async () => { fx = await setupTestApp(); });

describe('auth', () => {
  it('serves public school branding without a token', async () => {
    const res = await request(fx.app).get('/api/v1/school/public?slug=test-school');
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Test School');
    expect(res.body.data.gradingScale).toBeUndefined();
  });

  it('rejects unknown school slugs', async () => {
    const res = await request(fx.app).get('/api/v1/school/public?slug=nope');
    expect(res.status).toBe(404);
  });

  it('rejects wrong passwords without revealing the reason', async () => {
    const res = await request(fx.app).post('/api/v1/auth/login').send({ email: 'admin@test.edu', password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('returns user + permissions on /me', async () => {
    const res = await request(fx.app).get('/api/v1/auth/me').set('Authorization', bearer(fx.tokens.teacher));
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('teacher');
    expect(res.body.data.permissions).toContain('attendance.create');
    expect(res.body.data.user.passwordHash).toBeUndefined();
  });

  it('rejects requests without a token', async () => {
    const res = await request(fx.app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates refresh tokens (single use)', async () => {
    const login = await request(fx.app).post('/api/v1/auth/login').send({ email: 'staff@test.edu', password: 'School@123' });
    const first = login.body.data.refreshToken as string;
    const r1 = await request(fx.app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(r1.status).toBe(200);
    expect(r1.body.data.accessToken).toBeTruthy();
    const r2 = await request(fx.app).post('/api/v1/auth/refresh').send({ refreshToken: first });
    expect(r2.status).toBe(401);
  });

  it('revokes refresh tokens on logout', async () => {
    const login = await request(fx.app).post('/api/v1/auth/login').send({ email: 'staff@test.edu', password: 'School@123' });
    const rt = login.body.data.refreshToken as string;
    await request(fx.app).post('/api/v1/auth/logout').send({ refreshToken: rt });
    const r = await request(fx.app).post('/api/v1/auth/refresh').send({ refreshToken: rt });
    expect(r.status).toBe(401);
  });

  it('validates login input', async () => {
    const res = await request(fx.app).post('/api/v1/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
