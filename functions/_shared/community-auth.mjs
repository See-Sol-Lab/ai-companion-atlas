import { RequestError, cleanPlainText, requireEnv } from './comments.mjs';

const encoder = new TextEncoder();
const SESSION_COOKIE = 'atlas_community_session';
const SESSION_DAYS = 30;
const PASSWORD_ITERATIONS = 100000;

const hex = (bytes) => [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
const bytes = (value) => Uint8Array.from(value.match(/.{2}/gu) || [], (part) => Number.parseInt(part, 16));
const randomHex = (size) => { const value = new Uint8Array(size); crypto.getRandomValues(value); return hex(value); };

async function sha256(value) {
  return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

async function constantTimeEqual(left, right) {
  const [a, b] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

async function derivePassword(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  return hex(new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, 256
  )));
}

export function validateCredentials(input, { registration = false } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new RequestError(400, '账号内容格式不正确。');
  const username = cleanPlainText(input.username);
  const password = typeof input.password === 'string' ? input.password : '';
  const inviteCode = typeof input.inviteCode === 'string' ? input.inviteCode.trim() : '';
  const turnstileToken = typeof input.turnstileToken === 'string' ? input.turnstileToken.trim() : '';
  if (!/^[\p{L}\p{N}_-]{2,20}$/u.test(username)) throw new RequestError(400, '用户名需要 2–20 个字，只能使用文字、数字、下划线或短横线。');
  if (password.length < 10 || password.length > 128 || !/[A-Za-z]/u.test(password) || !/[0-9]/u.test(password)) {
    throw new RequestError(400, '密码需要 10–128 位，并同时包含字母和数字。');
  }
  if (registration && (inviteCode.length < 8 || inviteCode.length > 128)) throw new RequestError(400, '邀请码格式不正确。');
  if (!turnstileToken || turnstileToken.length > 2048) throw new RequestError(400, '请先完成人机验证。');
  return { username, password, inviteCode, turnstileToken };
}

export async function passwordRecord(password) {
  const salt = randomHex(16);
  return { salt, hash: await derivePassword(password, salt, PASSWORD_ITERATIONS), iterations: PASSWORD_ITERATIONS };
}

export async function verifyPassword(password, user) {
  const candidate = await derivePassword(password, user.password_salt, user.password_iterations);
  return constantTimeEqual(candidate, user.password_hash);
}

function cookieValue(request) {
  const cookie = request.headers.get('cookie') || '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE) return rest.join('=');
  }
  return '';
}

export async function createSession(database, userId) {
  const token = randomHex(32);
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await database.prepare(`INSERT INTO community_sessions (user_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)`)
    .bind(userId, await sha256(token), createdAt, expiresAt).run();
  return { token, expiresAt };
}

export function sessionCookie(token, expiresAt) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
}

export async function getCommunityUser(request, env) {
  const token = cookieValue(request);
  if (!token) return null;
  const database = requireEnv(env, 'COMMENTS_DB');
  return database.prepare(`
    SELECT u.id, u.username, u.status
    FROM community_sessions s JOIN community_users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
  `).bind(await sha256(token), new Date().toISOString()).first();
}

export async function requireCommunityUser(request, env) {
  const user = await getCommunityUser(request, env);
  if (!user) throw new RequestError(401, '请先登录社区账号。');
  return user;
}

export async function requireCommunityReader(request, env) {
  const user = await getCommunityUser(request, env);
  if (user) return { kind: 'human', user };
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  const expected = env?.COMMUNITY_AI_READ_TOKEN || '';
  if (supplied && expected && await constantTimeEqual(supplied, expected)) return { kind: 'ai', user: null };
  throw new RequestError(401, '请先登录社区账号。');
}

export async function hashInviteCode(code) { return sha256(code); }
export function generateInviteCode() { return `atlas-${randomHex(12)}`; }
export async function hashSessionToken(token) { return sha256(token); }
