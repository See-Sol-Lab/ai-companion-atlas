import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
  verifyTurnstile
} from '../../_shared/comments.mjs';
import { requireInviteCode, validateReplyInput } from '../../_shared/community.mjs';

const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const secret = requireEnv(env, 'TURNSTILE_SECRET');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const input = validateReplyInput(await readJson(request));
    await requireInviteCode(input.inviteCode, env);

    const thread = await database.prepare(`
      SELECT id FROM community_threads WHERE id = ? AND status = 'approved'
    `).bind(input.threadId).first();
    if (!thread) throw new RequestError(404, '帖子不存在或尚未公开。');

    const ipHash = await hashIp(request, salt);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recent = await database.prepare(`
      SELECT COUNT(*) AS count FROM community_replies WHERE ip_hash = ? AND created_at >= ?
    `).bind(ipHash, windowStart).first();
    if (Number(recent?.count || 0) >= RATE_LIMIT_COUNT) {
      throw new RequestError(429, '回复有点快，请十分钟后再试。');
    }

    await verifyTurnstile({
      secret,
      token: input.turnstileToken,
      ip: request.headers.get('CF-Connecting-IP') || '',
      expectedHostname: env.TURNSTILE_HOSTNAME || '',
      expectedAction: 'submit-community'
    });

    const createdAt = new Date().toISOString();
    await database.prepare(`
      INSERT INTO community_replies (thread_id, nickname, content, created_at, status, ip_hash)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).bind(input.threadId, input.nickname, input.content, createdAt, ipHash).run();

    return json({ ok: true, message: '回复已提交，审核通过后会公开显示。' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
