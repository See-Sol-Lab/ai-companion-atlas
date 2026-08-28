import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
  validateCommentInput,
  validateProjectSlug,
  verifyTurnstile
} from '../_shared/comments.mjs';

const RATE_LIMIT_COUNT = 3;
const RATE_LIMIT_WINDOW_MS = 2 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  try {
    const database = requireEnv(env, 'COMMENTS_DB');
    const projectSlug = validateProjectSlug(new URL(request.url).searchParams.get('project') || '');
    const { results = [] } = await database.prepare(`
      SELECT id, project_slug, nickname, content, platform, result, created_at
      FROM comments
      WHERE project_slug = ? AND status = 'approved'
      ORDER BY created_at DESC, id DESC
      LIMIT 30
    `).bind(projectSlug).all();

    return json({ comments: results }, 200, { 'Cache-Control': 'public, max-age=30' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const secret = requireEnv(env, 'TURNSTILE_SECRET');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const input = validateCommentInput(await readJson(request));
    input.projectSlug = validateProjectSlug(input.projectSlug);
    const ipHash = await hashIp(request, salt);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recent = await database.prepare(`
      SELECT COUNT(*) AS count
      FROM comments
      WHERE ip_hash = ? AND created_at >= ?
    `).bind(ipHash, windowStart).first();

    if (Number(recent?.count || 0) >= RATE_LIMIT_COUNT) {
      throw new RequestError(429, '提交得有点快，请两分钟后再试。');
    }

    const ip = request.headers.get('CF-Connecting-IP') || '';
    await verifyTurnstile({
      secret,
      token: input.turnstileToken,
      ip,
      expectedHostname: env.TURNSTILE_HOSTNAME || ''
    });

    const createdAt = new Date().toISOString();
    await database.prepare(`
      INSERT INTO comments (
        project_slug, nickname, content, platform, result, created_at, status, ip_hash
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
    `).bind(
      input.projectSlug,
      input.nickname,
      input.content,
      input.platform,
      input.result,
      createdAt,
      ipHash
    ).run();

    return json({ ok: true, message: '留言已提交，审核通过后会公开显示。' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
