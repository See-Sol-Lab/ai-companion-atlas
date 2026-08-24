import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
  validateSubmissionInput,
  verifyTurnstile
} from '../_shared/comments.mjs';

const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function onRequestGet() {
  return json({ error: '投稿内容不公开。' }, 405, { Allow: 'POST' });
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const secret = requireEnv(env, 'TURNSTILE_SECRET');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const input = validateSubmissionInput(await readJson(request));
    const ipHash = await hashIp(request, salt);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recent = await database.prepare(`
      SELECT COUNT(*) AS count
      FROM project_submissions
      WHERE ip_hash = ? AND created_at >= ?
    `).bind(ipHash, windowStart).first();

    if (Number(recent?.count || 0) >= RATE_LIMIT_COUNT) {
      throw new RequestError(429, '今天提交得有点多，请明天再试。');
    }

    await verifyTurnstile({
      secret,
      token: input.turnstileToken,
      ip: request.headers.get('CF-Connecting-IP') || '',
      expectedHostname: env.TURNSTILE_HOSTNAME || '',
      expectedAction: 'submit-project'
    });

    await database.prepare(`
      INSERT INTO project_submissions (
        project_name, project_url, reason, created_at, status, ip_hash
      ) VALUES (?, ?, ?, ?, 'pending', ?)
    `).bind(
      input.projectName,
      input.projectUrl,
      input.reason,
      new Date().toISOString(),
      ipHash
    ).run();

    return json({ ok: true, message: '投稿已进入人工核验队列。' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
