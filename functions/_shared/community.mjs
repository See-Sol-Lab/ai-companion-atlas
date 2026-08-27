import { RequestError, cleanPlainText, requireEnv } from './comments.mjs';

export const COMMUNITY_CATEGORIES = new Set([
  'relationship',
  'continuity',
  'practice',
  'creation'
]);

const encoder = new TextEncoder();
const textLength = (value) => [...value].length;

function validateBaseInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RequestError(400, '提交内容格式不正确。');
  }

  const nickname = cleanPlainText(input.nickname);
  const content = cleanPlainText(input.content, { multiline: true });
  const inviteCode = typeof input.inviteCode === 'string' ? input.inviteCode.trim() : '';
  const turnstileToken = typeof input.turnstileToken === 'string' ? input.turnstileToken.trim() : '';

  if (textLength(nickname) < 1 || textLength(nickname) > 30) {
    throw new RequestError(400, '昵称需要 1–30 字。');
  }
  if (inviteCode.length < 4 || inviteCode.length > 128) {
    throw new RequestError(400, '邀请码格式不正确。');
  }
  if (!turnstileToken || turnstileToken.length > 2048) {
    throw new RequestError(400, '请先完成人机验证。');
  }

  return { nickname, content, inviteCode, turnstileToken };
}

export function validateCommunityCategory(value, { optional = false } = {}) {
  const category = cleanPlainText(value).toLowerCase();
  if (!category && optional) return '';
  if (!COMMUNITY_CATEGORIES.has(category)) throw new RequestError(400, '分区无效。');
  return category;
}

export function validateThreadId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new RequestError(400, '帖子编号无效。');
  return id;
}

export function validateThreadInput(input) {
  const base = validateBaseInput(input);
  const title = cleanPlainText(input.title);
  const category = validateCommunityCategory(input.category);

  if (textLength(title) < 4 || textLength(title) > 80) {
    throw new RequestError(400, '标题需要 4–80 字。');
  }
  if (textLength(base.content) < 20 || textLength(base.content) > 4000) {
    throw new RequestError(400, '正文需要 20–4000 字。');
  }

  return { ...base, title, category };
}

export function validateReplyInput(input) {
  const base = validateBaseInput(input);
  const threadId = validateThreadId(input.threadId);
  if (textLength(base.content) < 2 || textLength(base.content) > 1500) {
    throw new RequestError(400, '回复需要 2–1500 字。');
  }
  return { ...base, threadId };
}

async function digest(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function requireInviteCode(supplied, env) {
  const expected = requireEnv(env, 'COMMUNITY_INVITE_CODE');
  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  if (difference !== 0) throw new RequestError(403, '邀请码无效。');
}
