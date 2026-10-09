import { createHash, randomBytes, randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { one, q } from '../db';
import type { Role } from './permissions';

export interface AccessClaims {
  sub: string; // user id
  role: Role;
  schoolId: string;
}

export function signAccess(userId: string, role: Role, schoolId: string): string {
  const claims: AccessClaims = { sub: userId, role, schoolId };
  return jwt.sign(claims, config.jwtAccessSecret, { expiresIn: `${config.accessTtlMinutes}m` });
}

export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, config.jwtAccessSecret) as AccessClaims;
}

const hashToken = (token: string): string => createHash('sha256').update(token).digest('hex');

/** Issue a refresh token (stored hashed, rotated on every use). */
export async function issueRefresh(userId: string, deviceLabel = ''): Promise<string> {
  const token = randomBytes(48).toString('hex');
  const expires = new Date(Date.now() + config.refreshTtlDays * 24 * 3600 * 1000);
  await q(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, device_label, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), userId, hashToken(token), deviceLabel.slice(0, 120), expires.toISOString()],
  );
  return token;
}

export interface RefreshRecord {
  id: string;
  userId: string;
  expiresAt: string;
  revokedAt: string | null;
}

/** Validate + rotate a refresh token. Returns the user id or null. Single-use. */
export async function rotateRefresh(token: string): Promise<string | null> {
  const rec = await one<RefreshRecord>(
    `SELECT id, user_id AS "userId", expires_at AS "expiresAt", revoked_at AS "revokedAt"
     FROM refresh_tokens WHERE token_hash = $1`,
    [hashToken(token)],
  );
  if (!rec || rec.revokedAt) return null;
  if (new Date(rec.expiresAt).getTime() < Date.now()) return null;
  await q(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`, [rec.id]);
  return rec.userId;
}

export async function revokeRefresh(token: string): Promise<void> {
  await q(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`, [hashToken(token)]);
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await q(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, [userId]);
}
