import {
  assertSameOrigin,
  errorResponse,
  hashIp,
  json,
  readJson,
  requireEnv,
  validateProjectSlug
} from '../_shared/comments.mjs';

async function getLikeState(database, projectSlug, ipHash) {
  const row = await database.prepare(`
    SELECT
      COUNT(*) AS count,
      COALESCE(MAX(CASE WHEN ip_hash = ? THEN 1 ELSE 0 END), 0) AS liked
    FROM project_likes
    WHERE project_slug = ?
  `).bind(ipHash, projectSlug).first();

  return {
    count: Number(row?.count || 0),
    liked: Boolean(row?.liked)
  };
}

export async function onRequestGet({ request, env }) {
  try {
    const database = requireEnv(env, 'COMMENTS_DB');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const projectSlug = validateProjectSlug(new URL(request.url).searchParams.get('project') || '');
    const ipHash = await hashIp(request, salt);
    return json(await getLikeState(database, projectSlug, ipHash));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function onRequestPost({ request, env }) {
  try {
    assertSameOrigin(request);
    const database = requireEnv(env, 'COMMENTS_DB');
    const salt = requireEnv(env, 'IP_HASH_SALT');
    const body = await readJson(request);
    const projectSlug = validateProjectSlug(body?.projectSlug || '');
    const ipHash = await hashIp(request, salt);
    const result = await database.prepare(`
      INSERT OR IGNORE INTO project_likes (project_slug, created_at, ip_hash)
      VALUES (?, ?, ?)
    `).bind(projectSlug, new Date().toISOString(), ipHash).run();
    const state = await getLikeState(database, projectSlug, ipHash);

    return json({ ...state, added: Boolean(result.meta?.changes) });
  } catch (error) {
    return errorResponse(error);
  }
}
