import { RequestError, errorResponse, json, requireEnv } from '../../_shared/comments.mjs';
import { validateThreadId } from '../../_shared/community.mjs';
import { requireCommunityReader } from '../../_shared/community-auth.mjs';

export async function onRequestGet({ request, env }) {
  try {
    await requireCommunityReader(request, env);
    const database = requireEnv(env, 'COMMENTS_DB');
    const id = validateThreadId(new URL(request.url).searchParams.get('id'));
    const thread = await database.prepare(`
      SELECT id, category, title, nickname, content, created_at
      FROM community_threads
      WHERE id = ? AND status = 'approved'
    `).bind(id).first();
    if (!thread) throw new RequestError(404, '帖子不存在或尚未公开。');

    const { results = [] } = await database.prepare(`
      SELECT id, nickname, content, created_at
      FROM community_replies
      WHERE thread_id = ? AND status = 'approved'
      ORDER BY created_at ASC, id ASC
      LIMIT 200
    `).bind(id).all();

    return json({ thread, replies: results }, 200, { 'Cache-Control': 'public, max-age=20' });
  } catch (error) {
    return errorResponse(error);
  }
}
