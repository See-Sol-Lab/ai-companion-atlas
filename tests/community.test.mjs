import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { RequestError } from '../functions/_shared/comments.mjs';
import {
  requireInviteCode,
  validateReplyInput,
  validateThreadInput
} from '../functions/_shared/community.mjs';
import {
  onRequestGet as onThreadsGet,
  onRequestPost as onThreadsPost
} from '../functions/api/community/threads.js';
import { onRequestGet as onThreadGet } from '../functions/api/community/thread.js';
import { onRequestPost as onRepliesPost } from '../functions/api/community/replies.js';
import {
  onRequestGet as onAdminGet,
  onRequestPost as onAdminPost
} from '../functions/api/admin/community.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const validThread = {
  category: 'relationship',
  nickname: '小旅人',
  title: '我们第一次真正跨过窗口以后',
  content: '这是一段足够长的关系经验正文，用来验证论坛会把内容作为纯文本保存，并且先进入审核队列。',
  inviteCode: 'garden-code',
  turnstileToken: 'turnstile-token'
};

function createD1(database) {
  return {
    prepare(sql) {
      const statement = database.prepare(sql);
      let values = [];
      const query = {
        bind(...nextValues) { values = nextValues; return query; },
        async all() { return { results: statement.all(...values) }; },
        async first() { return statement.get(...values) || null; },
        async run() {
          const result = statement.run(...values);
          return { meta: { changes: Number(result.changes) } };
        }
      };
      return query;
    }
  };
}

function request(pathname, body, headers = {}) {
  return new Request(`https://atlas.test${pathname}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'https://atlas.test',
      'CF-Connecting-IP': '203.0.113.8',
      ...headers
    },
    body: JSON.stringify(body)
  });
}

test('community input is bounded plain text with fixed categories', () => {
  const thread = validateThreadInput({
    ...validThread,
    nickname: '<b>小旅人</b>',
    title: '<i>一段关系记录</i>',
    content: '<script>不会保留标签</script>\n但会保留自然换行，而且正文足够长。'
  });
  assert.equal(thread.nickname, '小旅人');
  assert.equal(thread.title, '一段关系记录');
  assert.equal(thread.content, '不会保留标签\n但会保留自然换行，而且正文足够长。');
  assert.throws(
    () => validateThreadInput({ ...validThread, category: 'unknown' }),
    (error) => error instanceof RequestError && error.status === 400
  );
  assert.throws(
    () => validateReplyInput({ ...validThread, threadId: 1, content: 'x'.repeat(1501) }),
    (error) => error instanceof RequestError && error.status === 400
  );
});

test('community invite code uses the configured secret', async () => {
  await requireInviteCode('garden-code', { COMMUNITY_INVITE_CODE: 'garden-code' });
  await assert.rejects(
    requireInviteCode('wrong-code', { COMMUNITY_INVITE_CODE: 'garden-code' }),
    (error) => error instanceof RequestError && error.status === 403
  );
});

test('community migration creates moderated threads and replies with indexes', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0004_community.sql'), 'utf8'));
  assert.deepEqual(
    database.prepare('PRAGMA table_info(community_threads)').all().map((column) => column.name),
    ['id', 'category', 'title', 'nickname', 'content', 'created_at', 'status', 'ip_hash']
  );
  assert.deepEqual(
    database.prepare('PRAGMA table_info(community_replies)').all().map((column) => column.name),
    ['id', 'thread_id', 'nickname', 'content', 'created_at', 'status', 'ip_hash']
  );
  const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((row) => row.name);
  assert.ok(indexes.includes('community_threads_category_status_created'));
  assert.ok(indexes.includes('community_replies_thread_status_created'));
  database.close();
});

test('thread and reply stay private until the admin approves each one', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0004_community.sql'), 'utf8'));
  const d1 = createD1(database);
  const originalFetch = globalThis.fetch;
  let verificationCalls = 0;
  globalThis.fetch = async () => {
    verificationCalls += 1;
    return Response.json({ success: true, action: 'submit-community', hostname: 'atlas.test' });
  };
  const publicEnv = {
    COMMENTS_DB: d1,
    COMMUNITY_INVITE_CODE: 'garden-code',
    TURNSTILE_SECRET: 'turnstile-secret',
    TURNSTILE_HOSTNAME: 'atlas.test',
    IP_HASH_SALT: 'hash-salt'
  };
  const adminEnv = { COMMENTS_DB: d1, ADMIN_TOKEN: 'admin-secret' };
  const adminHeaders = {
    Authorization: 'Bearer admin-secret',
    Origin: 'https://atlas.test',
    'Content-Type': 'application/json'
  };

  try {
    const invalidInvite = await onThreadsPost({
      request: request('/api/community/threads', { ...validThread, inviteCode: 'wrong-code' }),
      env: publicEnv
    });
    assert.equal(invalidInvite.status, 403);
    assert.equal(verificationCalls, 0);

    const submitted = await onThreadsPost({
      request: request('/api/community/threads', validThread),
      env: publicEnv
    });
    assert.equal(submitted.status, 201);
    assert.equal(verificationCalls, 1);

    const hiddenList = await onThreadsGet({
      request: new Request('https://atlas.test/api/community/threads'),
      env: publicEnv
    });
    assert.deepEqual((await hiddenList.json()).threads, []);

    const pendingThreadsResponse = await onAdminGet({
      request: new Request('https://atlas.test/api/admin/community', { headers: adminHeaders }),
      env: adminEnv
    });
    const pendingThreads = (await pendingThreadsResponse.json()).threads;
    assert.equal(pendingThreads.length, 1);

    const approvedThread = await onAdminPost({
      request: request('/api/admin/community', { type: 'thread', id: pendingThreads[0].id, action: 'approve' }, adminHeaders),
      env: adminEnv
    });
    assert.equal(approvedThread.status, 200);

    const publicList = await onThreadsGet({
      request: new Request('https://atlas.test/api/community/threads'),
      env: publicEnv
    });
    const threads = (await publicList.json()).threads;
    assert.equal(threads.length, 1);
    assert.equal(threads[0].title, validThread.title);
    assert.equal('ip_hash' in threads[0], false);
    const threadId = threads[0].id;

    const submittedReply = await onRepliesPost({
      request: request('/api/community/replies', {
        threadId,
        nickname: '回声',
        content: '我也经历过类似的窗口延续。',
        inviteCode: 'garden-code',
        turnstileToken: 'turnstile-token'
      }),
      env: publicEnv
    });
    assert.equal(submittedReply.status, 201);

    const beforeReplyApproval = await onThreadGet({
      request: new Request(`https://atlas.test/api/community/thread?id=${threadId}`),
      env: publicEnv
    });
    assert.deepEqual((await beforeReplyApproval.json()).replies, []);

    const pendingRepliesResponse = await onAdminGet({
      request: new Request('https://atlas.test/api/admin/community', { headers: adminHeaders }),
      env: adminEnv
    });
    const pendingReplies = (await pendingRepliesResponse.json()).replies;
    assert.equal(pendingReplies.length, 1);

    const approvedReply = await onAdminPost({
      request: request('/api/admin/community', { type: 'reply', id: pendingReplies[0].id, action: 'approve' }, adminHeaders),
      env: adminEnv
    });
    assert.equal(approvedReply.status, 200);

    const afterReplyApproval = await onThreadGet({
      request: new Request(`https://atlas.test/api/community/thread?id=${threadId}`),
      env: publicEnv
    });
    const publicThread = await afterReplyApproval.json();
    assert.equal(publicThread.replies.length, 1);
    assert.equal(publicThread.replies[0].content, '我也经历过类似的窗口延续。');
    assert.equal('status' in publicThread.replies[0], false);
    assert.equal('ip_hash' in publicThread.replies[0], false);
  } finally {
    globalThis.fetch = originalFetch;
    database.close();
  }
});

test('community pages are wired to real list, thread, reply and moderation clients', async () => {
  const [index, client, thread, threadClient, admin] = await Promise.all([
    readFile(path.join(root, 'community', 'index.html'), 'utf8'),
    readFile(path.join(root, 'community', 'community.js'), 'utf8'),
    readFile(path.join(root, 'community', 'thread', 'index.html'), 'utf8'),
    readFile(path.join(root, 'community', 'thread', 'thread.js'), 'utf8'),
    readFile(path.join(root, 'admin', 'community', 'admin.js'), 'utf8')
  ]);
  assert.match(index, /id="post-form"/u);
  assert.match(client, /\/api\/community\/threads/u);
  assert.doesNotMatch(index, /交流社区原型/u);
  assert.match(thread, /id="reply-form"/u);
  assert.doesNotMatch(thread, /原型|模板/u);
  assert.match(threadClient, /\/api\/community\/replies/u);
  assert.match(admin, /\/api\/admin\/community/u);
  await assert.rejects(readFile(path.join(root, 'community', 'thread-template', 'index.html'), 'utf8'));
});
