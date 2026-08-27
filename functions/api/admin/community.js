import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  json,
  readJson,
  requireAdmin,
  requireEnv
} from '../../_shared/comments.mjs';
import { validateThreadId } from '../../_shared/community.mjs';

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const database = requireEnv(env, 'COMMENTS_DB');
    const [threads, replies] = await Promise.all([
      database.prepare(`
        SELECT id, category, title, nickname, content, created_at
        FROM community_threads
        WHERE status = 'pending'
        ORDER BY created_at ASC, id ASC
        LIMIT 100
      `).all(),
      database.prepare(`
        SELECT r.id, r.thread_id, r.nickname, r.content, r.created_at, t.title AS thread_title
        FROM community_replies r
        JOIN community_threads t ON t.id = r.thread_id
        WHERE r.status = 'pending'
        ORDER BY r.created_at ASC, r.id ASC
        LIMIT 100
      `).all()
    ]);
    return json({ threads: threads.results || [], replies: replies.results || [] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    await requireAdmin(request, env);
    const database = requireEnv(env, 'COMMENTS_DB');
    const body = await readJson(request);
    const id = validateThreadId(body?.id);
    const type = body?.type;
    const action = body?.action;

    if (!['thread', 'reply'].includes(type)) throw new RequestError(400, '审核类型无效。');
    if (!['approve', 'delete'].includes(action)) throw new RequestError(400, '审核操作无效。');

    const table = type === 'thread' ? 'community_threads' : 'community_replies';
    const statement = action === 'approve'
      ? database.prepare(`UPDATE ${table} SET status = 'approved' WHERE id = ? AND status = 'pending'`)
      : database.prepare(`DELETE FROM ${table} WHERE id = ? AND status = 'pending'`);
    const result = await statement.bind(id).run();
    if (!result.meta?.changes) throw new RequestError(404, '这条内容已处理或不存在。');

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
