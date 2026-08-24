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
      SELECT id, project_name, project_url, reason, created_at
      FROM project_submissions
      WHERE status = 'pending'
      ORDER BY created_at ASC, id ASC
      LIMIT 100
    `).all();
    return json({ submissions: results });
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

    if (!Number.isSafeInteger(id) || id < 1) throw new RequestError(400, '投稿编号无效。');
    if (!['review', 'delete'].includes(action)) throw new RequestError(400, '处理操作无效。');

    const statement = action === 'review'
      ? database.prepare("UPDATE project_submissions SET status = 'reviewed' WHERE id = ? AND status = 'pending'")
      : database.prepare("DELETE FROM project_submissions WHERE id = ? AND status = 'pending'");
    const result = await statement.bind(id).run();
    if (!result.meta?.changes) throw new RequestError(404, '这条投稿已处理或不存在。');

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
