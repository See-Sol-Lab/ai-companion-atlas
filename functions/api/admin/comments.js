import {
  RequestError,
  assertSameOrigin,
  errorResponse,
  json,
  readJson,
  requireAdmin,
  requireEnv
} from '../../_shared/comments.mjs';

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const database = requireEnv(env, 'COMMENTS_DB');
    const { results = [] } = await database.prepare(`
      SELECT id, project_slug, nickname, content, platform, result, created_at
      FROM comments
      WHERE status = 'pending'
      ORDER BY created_at ASC, id ASC
      LIMIT 100
    `).all();
    return json({ comments: results });
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
    const id = Number(body?.id);
    const action = body?.action;

    if (!Number.isSafeInteger(id) || id < 1) throw new RequestError(400, '评论编号无效。');
    if (!['approve', 'delete'].includes(action)) throw new RequestError(400, '审核操作无效。');

    const statement = action === 'approve'
      ? database.prepare("UPDATE comments SET status = 'approved' WHERE id = ? AND status = 'pending'")
      : database.prepare("DELETE FROM comments WHERE id = ? AND status = 'pending'");
    const result = await statement.bind(id).run();
    if (!result.meta?.changes) throw new RequestError(404, '这条评论已处理或不存在。');

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
