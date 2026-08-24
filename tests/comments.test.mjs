import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  RequestError,
  hashIp,
  requireAdmin,
  validateCommentInput,
  validateProjectSlug,
  validateSubmissionInput
} from '../functions/_shared/comments.mjs';
import { onRequestGet, onRequestPost } from '../functions/api/comments.js';
import {
  onRequestGet as onAdminGet,
  onRequestPost as onAdminPost
} from '../functions/api/admin/comments.js';
import {
  onRequestGet as onLikesGet,
  onRequestPost as onLikesPost
} from '../functions/api/likes.js';
import { onRequestPost as onSubmissionPost } from '../functions/api/submissions.js';
import {
  onRequestGet as onAdminSubmissionsGet,
  onRequestPost as onAdminSubmissionsPost
} from '../functions/api/admin/submissions.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const validInput = {
  projectSlug: 'time-anchor',
  nickname: '',
  content: '这个项目已经顺利跑通，时间感反馈很自然。',
  platform: 'Windows',
  result: 'success',
  turnstileToken: 'valid-token'
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

test('comment input becomes bounded plain text', () => {
  const result = validateCommentInput({
    ...validInput,
    nickname: '<b>小旅人</b>',
    content: '<script>坏标签</script>\n但正文会作为纯文本保存。',
    platform: '<i>Windows</i>'
  });
  assert.equal(result.nickname, '小旅人');
  assert.equal(result.content, '坏标签\n但正文会作为纯文本保存。');
  assert.equal(result.platform, 'Windows');
});

test('comment input enforces content and result limits', () => {
  assert.throws(
    () => validateCommentInput({ ...validInput, content: '太短' }),
    (error) => error instanceof RequestError && error.status === 400
  );
  assert.throws(
    () => validateCommentInput({ ...validInput, result: 'unknown' }),
    (error) => error instanceof RequestError && error.status === 400
  );
});

test('submission input keeps only bounded plain text and an HTTP source URL', () => {
  const result = validateSubmissionInput({
    projectName: '<b>时间锚</b>',
    projectUrl: 'https://github.com/See-Sol-Lab/ai-companion-time-anchor',
    reason: '<i>它让 AI 感知真实时间间隔，值得被更多人看到。</i>',
    turnstileToken: 'valid-token'
  });
  assert.equal(result.projectName, '时间锚');
  assert.equal(result.projectUrl, 'https://github.com/See-Sol-Lab/ai-companion-time-anchor');
  assert.equal(result.reason, '它让 AI 感知真实时间间隔，值得被更多人看到。');
  assert.throws(
    () => validateSubmissionInput({ ...result, projectUrl: 'javascript:alert(1)' }),
    (error) => error instanceof RequestError && error.status === 400
  );
  assert.throws(
    () => validateSubmissionInput({ ...result, reason: '太短' }),
    (error) => error instanceof RequestError && error.status === 400
  );
});

test('project slug must belong to the generated project catalog', () => {
  assert.equal(validateProjectSlug('time-anchor'), 'time-anchor');
  assert.throws(
    () => validateProjectSlug('made-up-project'),
    (error) => error instanceof RequestError && error.status === 404
  );
});

test('IP hash is deterministic and does not expose the address', async () => {
  const request = new Request('https://atlas.test/api/comments', {
    headers: { 'CF-Connecting-IP': '203.0.113.8' }
  });
  const first = await hashIp(request, 'test-salt');
  const second = await hashIp(request, 'test-salt');
  assert.equal(first, second);
  assert.equal(first.length, 64);
  assert.ok(!first.includes('203.0.113.8'));
});

test('admin endpoint requires the configured bearer token', async () => {
  await requireAdmin(new Request('https://atlas.test/api/admin/comments', {
    headers: { Authorization: 'Bearer secret-token' }
  }), { ADMIN_TOKEN: 'secret-token' });

  await assert.rejects(
    requireAdmin(new Request('https://atlas.test/api/admin/comments'), { ADMIN_TOKEN: 'secret-token' }),
    (error) => error instanceof RequestError && error.status === 401
  );
});

test('GET returns only the approved-query result for one project', async () => {
  let sql = '';
  let boundSlug = '';
  const database = {
    prepare(statement) {
      sql = statement;
      return {
        bind(slug) {
          boundSlug = slug;
          return { all: async () => ({ results: [{ id: 1, content: '公开留言' }] }) };
        }
      };
    }
  };
  const response = await onRequestGet({
    request: new Request('https://atlas.test/api/comments?project=time-anchor'),
    env: { COMMENTS_DB: database }
  });
  assert.equal(response.status, 200);
  assert.match(sql, /status = 'approved'/u);
  assert.equal(boundSlug, 'time-anchor');
  assert.deepEqual((await response.json()).comments, [{ id: 1, content: '公开留言' }]);
});

test('POST verifies Turnstile and inserts a pending comment with a hashed IP', async () => {
  const originalFetch = globalThis.fetch;
  const inserts = [];
  let siteverifyCalled = false;
  globalThis.fetch = async (url) => {
    assert.equal(url, 'https://challenges.cloudflare.com/turnstile/v0/siteverify');
    siteverifyCalled = true;
    return Response.json({ success: true, action: 'submit-comment', hostname: 'atlas.test' });
  };

  const database = {
    prepare(sql) {
      return {
        bind(...values) {
          if (sql.includes('COUNT(*)')) return { first: async () => ({ count: 0 }) };
          if (sql.includes('INSERT INTO comments')) {
            inserts.push(values);
            return { run: async () => ({ success: true }) };
          }
          throw new Error('Unexpected SQL');
        }
      };
    }
  };

  try {
    const response = await onRequestPost({
      request: new Request('https://atlas.test/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://atlas.test',
          'CF-Connecting-IP': '203.0.113.8'
        },
        body: JSON.stringify(validInput)
      }),
      env: {
        COMMENTS_DB: database,
        TURNSTILE_SECRET: 'turnstile-secret',
        TURNSTILE_HOSTNAME: 'atlas.test',
        IP_HASH_SALT: 'hash-salt'
      }
    });
    assert.equal(response.status, 201);
    assert.equal(siteverifyCalled, true);
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0][0], 'time-anchor');
    assert.equal(inserts[0][1], null);
    assert.equal(inserts[0][6].length, 64);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST rate limit rejects before consuming a Turnstile token', async () => {
  const originalFetch = globalThis.fetch;
  let siteverifyCalled = false;
  globalThis.fetch = async () => {
    siteverifyCalled = true;
    throw new Error('should not run');
  };
  const database = {
    prepare() {
      return { bind: () => ({ first: async () => ({ count: 3 }) }) };
    }
  };

  try {
    const response = await onRequestPost({
      request: new Request('https://atlas.test/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://atlas.test' },
        body: JSON.stringify(validInput)
      }),
      env: { COMMENTS_DB: database, TURNSTILE_SECRET: 'secret', IP_HASH_SALT: 'salt' }
    });
    assert.equal(response.status, 429);
    assert.equal(siteverifyCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('D1 migration creates the required comment fields and indexes', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0001_comments.sql'), 'utf8'));
  const columns = database.prepare('PRAGMA table_info(comments)').all().map((column) => column.name);
  assert.deepEqual(columns, [
    'id', 'project_slug', 'nickname', 'content', 'platform', 'result',
    'created_at', 'status', 'ip_hash'
  ]);
  const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()
    .map((row) => row.name);
  assert.ok(indexes.includes('comments_project_status_created'));
  assert.ok(indexes.includes('comments_status_created'));
  assert.ok(indexes.includes('comments_ip_created'));
  database.close();
});

test('like migration enforces one positive vote per project and IP hash', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0002_project_likes.sql'), 'utf8'));
  const columns = database.prepare('PRAGMA table_info(project_likes)').all().map((column) => column.name);
  assert.deepEqual(columns, ['id', 'project_slug', 'created_at', 'ip_hash']);
  database.prepare(`
    INSERT INTO project_likes (project_slug, created_at, ip_hash) VALUES (?, ?, ?)
  `).run('time-anchor', '2026-08-24T00:00:00.000Z', 'hash');
  assert.throws(() => database.prepare(`
    INSERT INTO project_likes (project_slug, created_at, ip_hash) VALUES (?, ?, ?)
  `).run('time-anchor', '2026-08-24T00:00:01.000Z', 'hash'), /UNIQUE constraint/u);
  database.close();
});

test('submission migration creates private pending records and review indexes', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0003_project_submissions.sql'), 'utf8'));
  const columns = database.prepare('PRAGMA table_info(project_submissions)').all().map((column) => column.name);
  assert.deepEqual(columns, [
    'id', 'project_name', 'project_url', 'reason', 'created_at', 'status', 'ip_hash'
  ]);
  const indexes = database.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all()
    .map((row) => row.name);
  assert.ok(indexes.includes('project_submissions_status_created'));
  assert.ok(indexes.includes('project_submissions_ip_created'));
  database.close();
});

test('every generated project detail page contains its own comment slug and shared client', async () => {
  const projectFiles = (await readdir(path.join(root, 'projects'))).filter((name) => name.endsWith('.json'));
  assert.equal(projectFiles.length, 176);

  for (const fileName of projectFiles) {
    const project = JSON.parse(await readFile(path.join(root, 'projects', fileName), 'utf8'));
    const html = await readFile(path.join(root, 'projects', project.slug, 'index.html'), 'utf8');
    assert.match(html, new RegExp(`data-comments-project="${project.slug}"`, 'u'));
    assert.match(html, new RegExp(`data-project-like="${project.slug}"`, 'u'));
    assert.match(html, /detail-comments\.js/u);
    assert.match(html, /当前版本为游客模式，留言不需要注册账号。/u);
    assert.match(html, /class="comment-success"/u);
    assert.match(html, /提交成功/u);
    assert.doesNotMatch(html, /游客留言功能施工中/u);
  }
});

test('pending comment stays private until the admin approves it', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0001_comments.sql'), 'utf8'));
  const d1 = createD1(database);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    success: true,
    action: 'submit-comment',
    hostname: 'atlas.test'
  });
  const publicEnv = {
    COMMENTS_DB: d1,
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
    const submitted = await onRequestPost({
      request: new Request('https://atlas.test/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Origin: 'https://atlas.test' },
        body: JSON.stringify(validInput)
      }),
      env: publicEnv
    });
    assert.equal(submitted.status, 201);

    const beforeApproval = await onRequestGet({
      request: new Request('https://atlas.test/api/comments?project=time-anchor'),
      env: publicEnv
    });
    assert.deepEqual((await beforeApproval.json()).comments, []);

    const pending = await onAdminGet({
      request: new Request('https://atlas.test/api/admin/comments', { headers: adminHeaders }),
      env: adminEnv
    });
    const pendingComments = (await pending.json()).comments;
    assert.equal(pendingComments.length, 1);

    const approved = await onAdminPost({
      request: new Request('https://atlas.test/api/admin/comments', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ id: pendingComments[0].id, action: 'approve' })
      }),
      env: adminEnv
    });
    assert.equal(approved.status, 200);

    const afterApproval = await onRequestGet({
      request: new Request('https://atlas.test/api/comments?project=time-anchor'),
      env: publicEnv
    });
    const publicComments = (await afterApproval.json()).comments;
    assert.equal(publicComments.length, 1);
    assert.equal(publicComments[0].content, validInput.content);
    assert.equal(publicComments[0].nickname, null);
    assert.equal('ip_hash' in publicComments[0], false);
    assert.equal('status' in publicComments[0], false);
  } finally {
    globalThis.fetch = originalFetch;
    database.close();
  }
});

test('project likes are positive-only and idempotent for one IP hash', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0002_project_likes.sql'), 'utf8'));
  const env = { COMMENTS_DB: createD1(database), IP_HASH_SALT: 'hash-salt' };
  const commonHeaders = {
    'CF-Connecting-IP': '203.0.113.8',
    'Content-Type': 'application/json',
    Origin: 'https://atlas.test'
  };

  const initial = await onLikesGet({
    request: new Request('https://atlas.test/api/likes?project=time-anchor', {
      headers: { 'CF-Connecting-IP': '203.0.113.8' }
    }),
    env
  });
  assert.deepEqual(await initial.json(), { count: 0, liked: false });

  const first = await onLikesPost({
    request: new Request('https://atlas.test/api/likes', {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ projectSlug: 'time-anchor' })
    }),
    env
  });
  assert.deepEqual(await first.json(), { count: 1, liked: true, added: true });

  const repeated = await onLikesPost({
    request: new Request('https://atlas.test/api/likes', {
      method: 'POST',
      headers: commonHeaders,
      body: JSON.stringify({ projectSlug: 'time-anchor' })
    }),
    env
  });
  assert.deepEqual(await repeated.json(), { count: 1, liked: true, added: false });
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM project_likes').get().count, 1);
  database.close();
});

test('online submission stays private and can be marked reviewed by the admin', async () => {
  const database = new DatabaseSync(':memory:');
  database.exec(await readFile(path.join(root, 'migrations', '0003_project_submissions.sql'), 'utf8'));
  const d1 = createD1(database);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    success: true,
    action: 'submit-project',
    hostname: 'atlas.test'
  });
  const publicEnv = {
    COMMENTS_DB: d1,
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
    const submitted = await onSubmissionPost({
      request: new Request('https://atlas.test/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://atlas.test',
          'CF-Connecting-IP': '203.0.113.8'
        },
        body: JSON.stringify({
          projectName: '时间锚',
          projectUrl: 'https://github.com/See-Sol-Lab/ai-companion-time-anchor',
          reason: '它让 AI 感知真实时间间隔，值得被更多人看到。',
          turnstileToken: 'valid-token'
        })
      }),
      env: publicEnv
    });
    assert.equal(submitted.status, 201);

    const pending = await onAdminSubmissionsGet({
      request: new Request('https://atlas.test/api/admin/submissions', { headers: adminHeaders }),
      env: adminEnv
    });
    const submissions = (await pending.json()).submissions;
    assert.equal(submissions.length, 1);
    assert.equal(submissions[0].project_name, '时间锚');
    assert.equal('ip_hash' in submissions[0], false);

    const reviewed = await onAdminSubmissionsPost({
      request: new Request('https://atlas.test/api/admin/submissions', {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ id: submissions[0].id, action: 'review' })
      }),
      env: adminEnv
    });
    assert.equal(reviewed.status, 200);
    assert.equal(database.prepare('SELECT status FROM project_submissions').get().status, 'reviewed');

    const afterReview = await onAdminSubmissionsGet({
      request: new Request('https://atlas.test/api/admin/submissions', { headers: adminHeaders }),
      env: adminEnv
    });
    assert.deepEqual((await afterReview.json()).submissions, []);
  } finally {
    globalThis.fetch = originalFetch;
    database.close();
  }
});

test('homepage exposes online submission and the dedicated GitHub issue route', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /class="button submit-online-toggle"/u);
  assert.match(html, /issues\/new\?template=project-submission\.yml/u);
  assert.match(html, /id="online-submit-panel"/u);
  assert.match(html, /项目名称/u);
  assert.match(html, /项目链接/u);
  assert.match(html, /推荐理由/u);
});
