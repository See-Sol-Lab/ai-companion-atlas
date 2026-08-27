import { assertSameOrigin, errorResponse, json, requireEnv } from '../../../_shared/comments.mjs';
import { clearSessionCookie, hashSessionToken } from '../../../_shared/community-auth.mjs';

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const cookie = context.request.headers.get('cookie') || '';
    const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('atlas_community_session='))?.slice('atlas_community_session='.length) || '';
    if (token) await requireEnv(context.env, 'COMMENTS_DB').prepare('DELETE FROM community_sessions WHERE token_hash = ?').bind(await hashSessionToken(token)).run();
    return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  } catch (error) { return errorResponse(error); }
}
