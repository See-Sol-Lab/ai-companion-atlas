import { RequestError, assertSameOrigin, errorResponse, json, readJson, requireEnv, verifyTurnstile } from '../../../_shared/comments.mjs';
import { createSession, hashInviteCode, passwordRecord, sessionCookie, validateCredentials } from '../../../_shared/community-auth.mjs';

export async function onRequestPost(context) {
  try {
    assertSameOrigin(context.request);
    const database = requireEnv(context.env, 'COMMENTS_DB');
    const input = validateCredentials(await readJson(context.request), { registration: true });
    await verifyTurnstile({ secret: requireEnv(context.env, 'TURNSTILE_SECRET'), token: input.turnstileToken, ip: context.request.headers.get('CF-Connecting-IP') || '', expectedHostname: context.env.TURNSTILE_HOSTNAME || '', expectedAction: 'register-community' });
    const invite = await database.prepare('SELECT id FROM community_invites WHERE code_hash = ? AND used_at IS NULL')
      .bind(await hashInviteCode(input.inviteCode)).first();
    if (!invite) throw new RequestError(403, '邀请码无效或已使用。');
    const password = await passwordRecord(input.password);
    const createdAt = new Date().toISOString();
    try {
      await database.batch([
        database.prepare(`INSERT INTO community_users (username,password_salt,password_hash,password_iterations,invite_id,created_at,status) VALUES (?,?,?,?,?,?,'active')`).bind(input.username, password.salt, password.hash, password.iterations, invite.id, createdAt),
        database.prepare(`UPDATE community_invites SET used_at = ?, used_by = (SELECT id FROM community_users WHERE username = ?) WHERE id = ? AND used_at IS NULL`).bind(createdAt, input.username, invite.id)
      ]);
    } catch {
      throw new RequestError(409, '用户名已存在，或邀请码刚刚被使用。');
    }
    const user = await database.prepare('SELECT id, username FROM community_users WHERE username = ?').bind(input.username).first();
    const session = await createSession(database, user.id);
    return json({ user }, 201, { 'Set-Cookie': sessionCookie(session.token, session.expiresAt) });
  } catch (error) { return errorResponse(error); }
}
