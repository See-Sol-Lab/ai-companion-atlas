const authForm = document.querySelector('#admin-auth');
const tokenInput = document.querySelector('#admin-token');
const feedback = document.querySelector('#admin-feedback');
const list = document.querySelector('#review-list');
const categoryLabels = { relationship: '关系与日常', continuity: '记忆与延续', practice: '技术与部署', creation: '共同创作' };
let adminToken = sessionStorage.getItem('atlas-admin-token') || '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(options = {}) {
  const response = await fetch('/api/admin/community', {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}`, ...options.headers }
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401) {
      adminToken = '';
      sessionStorage.removeItem('atlas-admin-token');
    }
    throw new Error(data.error || '请求失败。');
  }
  return data;
}

function reviewCard(item, type) {
  const article = element('article', 'review-card');
  const heading = element('div', 'review-heading');
  const title = element('div');
  const label = type === 'thread'
    ? `${categoryLabels[item.category] || item.category} · 帖子 #${item.id}`
    : `回复 #${item.id} · 帖子 #${item.thread_id}`;
  title.append(element('strong', '', type === 'thread' ? item.title : item.nickname), element('span', '', label));
  heading.append(title, element('time', '', new Date(item.created_at).toLocaleString('zh-CN')));
  article.append(heading);
  if (type === 'reply') article.append(element('p', 'review-platform', `原帖：${item.thread_title}`));
  if (type === 'thread') article.append(element('p', 'review-platform', `作者：${item.nickname}`));
  article.append(element('p', 'review-content', item.content));

  const actions = element('div', 'review-actions');
  const approve = element('button', 'approve', '通过');
  const remove = element('button', 'delete', '删除');
  approve.type = 'button';
  remove.type = 'button';
  approve.addEventListener('click', () => moderate(type, item.id, 'approve', article));
  remove.addEventListener('click', () => {
    if (window.confirm('确定永久删除这条社区内容吗？')) moderate(type, item.id, 'delete', article);
  });
  actions.append(approve, remove);
  article.append(actions);
  return article;
}

function render(threads, replies) {
  list.replaceChildren();
  if (!threads.length && !replies.length) {
    list.append(element('p', 'review-empty', '目前没有待审核社区内容。'));
    return;
  }
  threads.forEach((thread) => list.append(reviewCard(thread, 'thread')));
  replies.forEach((reply) => list.append(reviewCard(reply, 'reply')));
}

async function loadPending() {
  feedback.textContent = '正在读取…';
  try {
    const data = await api();
    render(data.threads || [], data.replies || []);
    feedback.textContent = `待审核帖子 ${data.threads?.length || 0} 篇，回复 ${data.replies?.length || 0} 条`;
  } catch (error) {
    list.replaceChildren();
    feedback.textContent = error.message;
  }
}

async function moderate(type, id, action, article) {
  article.querySelectorAll('button').forEach((button) => { button.disabled = true; });
  try {
    await api({ method: 'POST', body: JSON.stringify({ type, id, action }) });
    article.remove();
    if (!list.children.length) render([], []);
    feedback.textContent = action === 'approve' ? '内容已公开。' : '内容已删除。';
  } catch (error) {
    feedback.textContent = error.message;
    article.querySelectorAll('button').forEach((button) => { button.disabled = false; });
  }
}

authForm.addEventListener('submit', (event) => {
  event.preventDefault();
  adminToken = tokenInput.value.trim();
  sessionStorage.setItem('atlas-admin-token', adminToken);
  tokenInput.value = '';
  loadPending();
});

if (adminToken) loadPending();
