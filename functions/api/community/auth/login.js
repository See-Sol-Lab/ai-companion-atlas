import { RequestError, assertSameOrigin, errorResponse, json, readJson, requireEnv, verifyTurnstile } from '../../../_shared/comments.mjs';
import { createSession, sessionCookie, validateCredentials, verifyPassword } from '../../../_shared/community-auth.mjs';

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const database = requireEnv(context.env, 'COMMENTS_DB');
    const input = validateCredentials(await readJson(context.request));
    await verifyTurnstile({ secret: requireEnv(context.env, 'TURNSTILE_SECRET'), token: input.turnstileToken, ip: context.request.headers.get('CF-Connecting-IP') || '', expectedHostname: context.env.TURNSTILE_HOSTNAME || '', expectedAction: 'login-community' });
    const user = await database.prepare('SELECT * FROM community_users WHERE username = ? AND status = \'active\'').bind(input.username).first();
    if (!user || !await verifyPassword(input.password, user)) throw new RequestError(401, '用户名或密码不正确。');
    const session = await createSession(database, user.id);
    return json({ user: { id: user.id, username: user.username } }, 200, { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) });
  } catch (error) { return errorResponse(error); }
}
