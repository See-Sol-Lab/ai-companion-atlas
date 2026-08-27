import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
} from '../../_shared/comments.mjs';
import { requireCommunityUser } from '../../_shared/community-auth.mjs';
import { validateReplyInput } from '../../_shared/community.mjs';

const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const input = validateReplyInput(await readJson(request));
    const user = await requireCommunityUser(request, env);

    const thread = await database.prepare(`
      SELECT id FROM community_threads WHERE id = ? AND status = 'approved'
    `).bind(input.threadId).first();
    if (!thread) throw new RequestError(404, '帖子不存在或尚未公开。');

    const ipHash = await hashIp(request, salt);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recent = await database.prepare(`
      SELECT COUNT(*) AS count FROM community_replies WHERE user_id = ? AND created_at >= ?
    `).bind(user.id, windowStart).first();
    if (Number(recent?.count || 0) >= RATE_LIMIT_COUNT) {
      throw new RequestError(429, '回复有点快，请十分钟后再试。');
    }

    const createdAt = new Date().toISOString();
    await database.prepare(`
      INSERT INTO community_replies (thread_id, nickname, content, created_at, status, ip_hash, user_id)
      VALUES (?, ?, ?, ?, 'approved', ?, ?)
    `).bind(input.threadId, user.username, input.content, createdAt, ipHash, user.id).run();

    return json({ ok: true, message: '回复已发布。' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
