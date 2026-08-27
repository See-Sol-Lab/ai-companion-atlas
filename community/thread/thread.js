const categories = {
  relationship: { label: '关系与日常', overline: 'RELATIONSHIP · DAILY LIFE', theme: 'theme-relation' },
  continuity: { label: '记忆与延续', overline: 'MEMORY · CONTINUITY · RETURN', theme: 'theme-relation' },
  practice: { label: '技术与部署', overline: 'TECH · DEPLOYMENT · PRACTICE', theme: 'theme-tech' },
  creation: { label: '共同创作', overline: 'CO-CREATION · SHARED LIFE', theme: 'theme-relation' }
};

const threadId = Number(new URLSearchParams(location.search).get('id'));
const content = document.querySelector('[data-field="post-content"]');
const repliesRoot = document.querySelector('[data-list="replies"]');
const replyCount = document.querySelector('[data-field="reply-count"]');
const replyForm = document.querySelector('#reply-form');
const submitButton = replyForm.querySelector('button[type="submit"]');
const feedback = replyForm.querySelector('.reply-feedback');

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderParagraphs(root, value) {
  root.replaceChildren();
  for (const paragraph of value.split(/\n{2,}/u)) root.append(element('p', '', paragraph));
}

function renderReplies(replies) {
  repliesRoot.replaceChildren();
  replyCount.textContent = `${replies.length} 条公开回复`;
  replies.forEach((reply, index) => {
    const article = element('article', 'reply');
    const floor = element('span', 'floor', `#${index + 1}`);
    const avatar = element('div', 'reply-avatar');
    const copy = document.createElement('div');
    const name = element('div', 'reply-name', reply.nickname);
    name.append(element('small', '', formatDate(reply.created_at)));
    copy.append(name, element('div', 'reply-text', reply.content));
    article.append(floor, avatar, copy);
    repliesRoot.append(article);
  });
}

async function loadThread() {
  if (!Number.isSafeInteger(threadId) || threadId < 1) {
    content.replaceChildren(element('p', 'thread-state error', '帖子链接无效。'));
    replyForm.hidden = true;
    return false;
  }
  try {
    const response = await fetch(`/api/community/thread?id=${threadId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '读取帖子失败。');
    const thread = data.thread;
    const category = categories[thread.category] || categories.relationship;
    document.body.className = category.theme;
    document.title = `${thread.title} · AI Companion Atlas`;
    document.querySelector('[data-field="category-name"]').textContent = category.label;
    document.querySelector('[data-field="category-overline"]').textContent = category.overline;
    document.querySelector('[data-field="post-title"]').textContent = thread.title;
    document.querySelector('[data-field="post-type"]').textContent = category.label;
    document.querySelector('[data-field="author-avatar"]').textContent = thread.nickname.slice(0, 1);
    document.querySelector('[data-field="author-name"]').textContent = thread.nickname;
    document.querySelector('[data-field="post-time"]').textContent = formatDate(thread.created_at);
    const tags = document.querySelector('[data-list="post-tags"]');
    tags.replaceChildren(element('span', 'tag accent', category.label));
    renderParagraphs(content, thread.content);
    renderReplies(data.replies || []);
    return true;
  } catch (error) {
    content.replaceChildren(element('p', 'thread-state error', error.message));
    replyForm.hidden = true;
    return false;
  }
}

replyForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(replyForm);
  submitButton.disabled = true;
  feedback.textContent = '正在提交…';
  try {
    const response = await fetch('/api/community/replies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        threadId, content: form.get('content')
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败。');
    replyForm.reset();
    feedback.textContent = data.message;
  } catch (error) {
    feedback.textContent = error.message;
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector('[data-action="copy-link"]').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    feedback.textContent = '只读链接已复制。';
  } catch {
    feedback.textContent = '浏览器未允许复制，请直接复制地址栏链接。';
  }
});

async function init() {
  await loadThread();
}

init();
