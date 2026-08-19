import crypto from 'crypto';
import { query } from '../db/connection';

// Where the set-password page lives. In link-shown mode this builds the link we
// display to the admin / log for a reset; in production it's the same URL that
// gets emailed.
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

export type TokenPurpose = 'invite' | 'reset';

export const hashToken = (raw: string): string =>
  crypto.createHash('sha256').update(raw).digest('hex');

export const buildSetPasswordLink = (rawToken: string): string =>
  `${FRONTEND_URL}/set-password?token=${rawToken}`;

/**
 * Create a one-time token for a user, store only its hash, and return the raw
 * token + the set-password link. Any earlier unused token of the same purpose
 * for this user is invalidated first.
 */
export async function createAuthToken(
  userId: number,
  purpose: TokenPurpose,
  ttlHours: number,
): Promise<{ raw: string; link: string }> {
  const raw = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(raw);
  const expires = new Date(Date.now() + ttlHours * 3600 * 1000);

  await query(
    `UPDATE auth_tokens SET used_at = NOW()
     WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`,
    [userId, purpose],
  );
  await query(
    `INSERT INTO auth_tokens (user_id, token_hash, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [userId, tokenHash, purpose, expires],
  );

  return { raw, link: buildSetPasswordLink(raw) };
}

/** Look up a still-valid (unused, unexpired) token by its raw value. */
export async function findValidToken(raw: string) {
  if (!raw) return null;
  const result = await query(
    `SELECT t.id, t.user_id, t.purpose, u.email, u.name
     FROM auth_tokens t
     JOIN users u ON t.user_id = u.id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > NOW()`,
    [hashToken(raw)],
  );
  return result.rows[0] || null;
}

export async function markTokenUsed(id: number): Promise<void> {
  await query(`UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`, [id]);
}
