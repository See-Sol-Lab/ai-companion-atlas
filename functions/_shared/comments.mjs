import { PROJECT_SLUGS } from './project-slugs.mjs';

const encoder = new TextEncoder();
const COMMENT_RESULTS = new Set(['success', 'partial', 'failed']);
const MAX_BODY_BYTES = 16 * 1024;

export class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function json(data, status = 200, extraHeaders = {}) {
  return Response.json(data, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...extraHeaders
    }
  });
}

export function errorResponse(error) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  console.error('comments_api_error', error);
  return json({ error: '服务暂时不可用，请稍后再试。' }, 500);
}

export async function readJson(request) {
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new RequestError(413, '提交内容过大。');
  if (!request.body) throw new RequestError(400, '缺少请求内容。');

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new RequestError(413, '提交内容过大。');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new RequestError(400, '请求内容不是有效的 JSON。');
  }
}

export function cleanPlainText(value, { multiline = false } = {}) {
  if (typeof value !== 'string') return '';
  let text = value
    .replace(/<[^>]*>/gu, '')
    .replace(/[<>]/gu, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '');

  if (multiline) {
    text = text
      .replace(/\r\n?/gu, '\n')
      .replace(/[\t ]+/gu, ' ')
      .replace(/ *\n */gu, '\n')
      .replace(/\n{3,}/gu, '\n\n');
  } else {
    text = text.replace(/\s+/gu, ' ');
  }
  return text.trim();
}

export function validateSubmissionInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RequestError(400, '投稿内容格式不正确。');
  }

  const projectName = cleanPlainText(input.projectName);
  const projectUrl = cleanPlainText(input.projectUrl);
  const reason = cleanPlainText(input.reason, { multiline: true });
  const turnstileToken = typeof input.turnstileToken === 'string' ? input.turnstileToken.trim() : '';

  if (textLength(projectName) < 1 || textLength(projectName) > 100) {
    throw new RequestError(400, '项目名称需要 1–100 字。');
  }
  if (!projectUrl || projectUrl.length > 2048) throw new RequestError(400, '项目链接无效。');
  let parsedUrl;
  try {
    parsedUrl = new URL(projectUrl);
  } catch {
    throw new RequestError(400, '项目链接无效。');
  }
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new RequestError(400, '项目链接必须使用 http 或 https。');
  }
  if (textLength(reason) < 10 || textLength(reason) > 800) {
    throw new RequestError(400, '推荐理由需要 10–800 字。');
  }
  if (!turnstileToken || turnstileToken.length > 2048) {
    throw new RequestError(400, '请先完成人机验证。');
  }

  return {
    projectName,
    projectUrl: parsedUrl.href,
    reason,
    turnstileToken
  };
}

const textLength = (value) => [...value].length;

export function validateCommentInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RequestError(400, '提交内容格式不正确。');
  }

  const projectSlug = cleanPlainText(input.projectSlug).toLowerCase();
  const nickname = cleanPlainText(input.nickname);
  const content = cleanPlainText(input.content, { multiline: true });
  const platform = cleanPlainText(input.platform);
  const result = cleanPlainText(input.result).toLowerCase();
  const turnstileToken = typeof input.turnstileToken === 'string' ? input.turnstileToken.trim() : '';

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(projectSlug) || textLength(projectSlug) > 100) {
    throw new RequestError(400, '项目标识无效。');
  }
  if (textLength(nickname) > 40) throw new RequestError(400, '昵称最多 40 个字。');
  if (textLength(content) < 10 || textLength(content) > 800) {
    throw new RequestError(400, '留言正文需要 10–800 字。');
  }
  if (textLength(platform) > 60) throw new RequestError(400, '平台信息最多 60 个字。');
  if (!COMMENT_RESULTS.has(result)) throw new RequestError(400, '请选择有效的使用结果。');
  if (!turnstileToken || turnstileToken.length > 2048) {
    throw new RequestError(400, '请先完成人机验证。');
  }

  return {
    projectSlug,
    nickname: nickname || null,
    content,
    platform: platform || null,
    result,
    turnstileToken
  };
}

export function validateProjectSlug(value) {
  const slug = cleanPlainText(value).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug) || textLength(slug) > 100) {
    throw new RequestError(400, '项目标识无效。');
  }
  if (!PROJECT_SLUGS.has(slug)) throw new RequestError(404, '项目不存在。');
  return slug;
}

export function requireEnv(env, key) {
  const value = env?.[key];
  if (!value) throw new RequestError(503, '留言服务尚未完成配置。');
  return value;
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

export async function hashIp(request, salt) {
  const ip = request.headers.get('CF-Connecting-IP') || 'local-development';
  const digest = await sha256(`${salt}:${ip}`);
  return [...digest].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function verifyTurnstile({ secret, token, ip, expectedHostname, expectedAction = 'submit-comment' }) {
  const body = new FormData();
  body.set('secret', secret);
  body.set('response', token);
  if (ip) body.set('remoteip', ip);
  body.set('idempotency_key', crypto.randomUUID());

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
    body
  });
  if (!response.ok) throw new RequestError(503, '人机验证服务暂时不可用。');

  const result = await response.json();
  if (!result.success || result.action !== expectedAction) {
    throw new RequestError(400, '人机验证失败或已过期，请重试。');
  }
  if (expectedHostname && result.hostname !== expectedHostname) {
    throw new RequestError(400, '人机验证来源无效。');
  }
}

async function constantTimeEqual(left, right) {
  const [leftHash, rightHash] = await Promise.all([sha256(left), sha256(right)]);
  let difference = 0;
  for (let index = 0; index < leftHash.length; index += 1) {
    difference |= leftHash[index] ^ rightHash[index];
  }
  return difference === 0;
}

export async function requireAdmin(request, env) {
  const expected = requireEnv(env, 'ADMIN_TOKEN');
  const header = request.headers.get('authorization') || '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied || supplied.length > 512 || !(await constantTimeEqual(supplied, expected))) {
    throw new RequestError(401, '管理员凭据无效。');
  }
}

export function assertSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) {
    throw new RequestError(403, '请求来源无效。');
  }
}
