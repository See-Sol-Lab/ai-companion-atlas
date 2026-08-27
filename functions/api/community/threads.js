import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
} from '../../_shared/comments.mjs';
import { requireCommunityReader, requireCommunityUser } from '../../_shared/community-auth.mjs';
import {
  validateCommunityCategory,
  validateThreadInput
} from '../../_shared/community.mjs';

const RATE_LIMIT_COUNT = 2;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function onRequestGet({ request, env }) {
  try {
    await requireCommunityReader(request, env);
    const database = requireEnv(env, 'COMMENTS_DB');
    const search = new URL(request.url).searchParams;
    const category = validateCommunityCategory(search.get('category') || '', { optional: true });
    const filter = search.get('filter') === 'unanswered' ? 'unanswered' : 'latest';
    const clauses = ["t.status = 'approved'"];
    const values = [];
    if (category) {
      clauses.push('t.category = ?');
      values.push(category);
    }
    if (filter === 'unanswered') {
      clauses.push("NOT EXISTS (SELECT 1 FROM community_replies ur WHERE ur.thread_id = t.id AND ur.status = 'approved')");
    }

    const { results = [] } = await database.prepare(`
      SELECT
        t.id, t.category, t.title, t.nickname,
        substr(t.content, 1, 180) AS summary,
        t.created_at,
        (SELECT COUNT(*) FROM community_replies r WHERE r.thread_id = t.id AND r.status = 'approved') AS reply_count
      FROM community_threads t
      WHERE ${clauses.join(' AND ')}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 50
    `).bind(...values).all();

    return json({ threads: results }, 200, { 'Cache-Control': 'public, max-age=20' });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const input = validateThreadInput(await readJson(request));
    const user = await requireCommunityUser(request, env);

    const ipHash = await hashIp(request, salt);
    const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
    const recent = await database.prepare(`
      SELECT COUNT(*) AS count FROM community_threads WHERE user_id = ? AND created_at >= ?
    `).bind(user.id, windowStart).first();
    if (Number(recent?.count || 0) >= RATE_LIMIT_COUNT) {
      throw new RequestError(429, '发帖有点快，请一小时后再试。');
    }

    const createdAt = new Date().toISOString();
    await database.prepare(`
      INSERT INTO community_threads (category, title, nickname, content, created_at, status, ip_hash, user_id)
      VALUES (?, ?, ?, ?, ?, 'approved', ?, ?)
    `).bind(input.category, input.title, user.username, input.content, createdAt, ipHash, user.id).run();

    return json({ ok: true, message: '帖子已发布。' }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
