import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
import { promisify } from 'node:util';
import { query } from './db';
import { assert, HttpError } from './http';
const scrypt = promisify(scryptCallback);
export type Actor = {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'therapist' | 'admin';
};
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return salt + ':' + key.toString('hex');
}
export async function verifyPassword(password: string, encoded: string) {
  const [salt, hex] = encoded.split(':');
  if (!salt || !hex) return false;
  const key = (await scrypt(password, salt, 64)) as Buffer;
  const stored = Buffer.from(hex, 'hex');
  return key.length === stored.length && timingSafeEqual(key, stored);
}
export const tokenHash = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export function requestToken(request: Request) {
  return request.headers
    .get('cookie')
    ?.match(/(?:^|;\s*)medito_session=([a-f0-9]{64})(?:;|$)/)?.[1];
}
export async function currentUser(request: Request): Promise<Actor | null> {
  const token = requestToken(request);
  if (!token) return null;
  return (
    (
      await query<Actor>(
        'SELECT u.id,u.name,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()',
        [tokenHash(token)],
      )
    )[0] || null
  );
}
export async function requireUser(request: Request, role?: Actor['role']) {
  const user = await currentUser(request);
  assert(user, 401, 'ابتدا وارد حساب خود شوید.');
  assert(
    !role || user.role === role,
    403,
    'اجازه دسترسی به این بخش را ندارید.',
  );
  return user;
}
export async function newSession(userId: string) {
  const token = randomBytes(32).toString('hex');
  await query('DELETE FROM sessions WHERE expires_at<now()');
  await query(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '7 days')",
    [tokenHash(token), userId],
  );
  return token;
}
export function sessionCookie(token: string, clear = false) {
  const secure = (process.env.APP_URL || '').startsWith('https:');
  return `medito_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${clear ? 0 : 604800}${secure ? '; Secure' : ''}`;
}
export async function rateLimit(key: string, max = 10, seconds = 900) {
  const [row] = await query(
    `INSERT INTO rate_limits(key,hits,reset_at) VALUES($1,1,now()+make_interval(secs=>$2)) ON CONFLICT(key) DO UPDATE SET hits=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.hits+1 END, reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+make_interval(secs=>$2) ELSE rate_limits.reset_at END RETURNING hits`,
    [tokenHash(key), seconds],
  );
  if (row.hits > max)
    throw new HttpError(
      429,
      'تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید.',
    );
}
