const categoryLabels = {
  relationship: '关系与日常',
  continuity: '记忆与延续',
  practice: '技术与部署',
  creation: '共同创作'
};

const postList = document.querySelector('#postList');
const postDialog = document.querySelector('#post-dialog');
const rulesDialog = document.querySelector('#rules-dialog');
const postForm = document.querySelector('#post-form');
const submitButton = postForm.querySelector('button[type="submit"]');
const feedback = postForm.querySelector('.form-feedback');
const captchaSlot = postForm.querySelector('.turnstile-slot');
const toast = document.querySelector('#community-toast');
let currentFilter = 'latest';
let currentCategory = '';
let turnstileSiteKey = '';
let turnstileWidgetId = null;
let turnstileToken = '';
let scriptPromise = null;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 4500);
}

function formatDate(value) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function renderThreads(threads) {
  postList.replaceChildren();
  if (!threads.length) {
    postList.append(element('p', 'community-state', '这里还没有公开帖子。写下第一篇，审核后就会出现在这里。'));
    return;
  }

  for (const thread of threads) {
    const link = element('a', 'post-link');
    link.href = `./thread/?id=${encodeURIComponent(thread.id)}`;
    const article = element('article', 'post');
    const time = element('div', 'post-time');
    time.append(document.createTextNode(formatDate(thread.created_at)), document.createElement('br'), document.createTextNode(thread.nickname));
    const copy = document.createElement('div');
    copy.append(element('h2', 'post-title', thread.title), element('p', 'post-summary', thread.summary));
    const tags = element('div', 'post-tags');
    tags.append(element('span', `tag ${thread.category === 'relationship' ? 'relation' : thread.category === 'practice' ? 'tech' : ''}`, categoryLabels[thread.category] || thread.category));
    copy.append(tags);
    const stats = element('div', 'post-stats');
    stats.append(element('span', '', `${Number(thread.reply_count || 0)} 回复`));
    article.append(time, copy, stats);
    link.append(article);
    postList.append(link);
  }
}

async function loadThreads() {
  postList.replaceChildren(element('p', 'community-state', '正在读取公开讨论…'));
  const params = new URLSearchParams({ filter: currentFilter });
  if (currentCategory) params.set('category', currentCategory);
  try {
    const response = await fetch(`/api/community/threads?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '读取失败。');
    renderThreads(data.threads || []);
  } catch (error) {
    postList.replaceChildren(element('p', 'community-state post-error', error.message));
  }
}

async function loadTurnstile() {
  if (!turnstileSiteKey) {
    const response = await fetch('/api/config');
    const data = await response.json();
    if (!response.ok || !data.turnstileSiteKey) throw new Error('人机验证尚未配置。');
    turnstileSiteKey = data.turnstileSiteKey;
  }
  if (!window.turnstile) {
    scriptPromise ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = resolve;
      script.onerror = () => reject(new Error('人机验证加载失败。'));
      document.head.append(script);
    });
    await scriptPromise;
  }
}

async function prepareCaptcha() {
  feedback.textContent = '正在准备人机验证…';
  submitButton.disabled = true;
  try {
    await loadTurnstile();
    if (turnstileWidgetId !== null) window.turnstile.remove(turnstileWidgetId);
    turnstileToken = '';
    turnstileWidgetId = window.turnstile.render(captchaSlot, {
      sitekey: turnstileSiteKey,
      action: 'submit-community',
      callback(token) { turnstileToken = token; submitButton.disabled = false; feedback.textContent = ''; },
      'expired-callback'() { turnstileToken = ''; submitButton.disabled = true; },
      'error-callback'() { turnstileToken = ''; submitButton.disabled = true; feedback.textContent = '人机验证失败，请刷新重试。'; }
    });
  } catch (error) {
    feedback.textContent = error.message;
  }
}

function openPostDialog(category = '') {
  if (category) postForm.elements.category.value = category;
  postDialog.showModal();
  prepareCaptcha();
}

document.querySelectorAll('[data-action="open-post"]').forEach((button) => button.addEventListener('click', () => openPostDialog()));
document.querySelectorAll('[data-action="open-rules"]').forEach((button) => button.addEventListener('click', () => rulesDialog.showModal()));
document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
}));

document.querySelectorAll('.filter-btn').forEach((button) => button.addEventListener('click', () => {
  document.querySelectorAll('.filter-btn').forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
  currentFilter = button.dataset.filter || 'latest';
  currentCategory = button.dataset.category || '';
  loadThreads();
}));

document.querySelectorAll('.category[data-category]').forEach((button) => button.addEventListener('click', () => {
  currentCategory = button.dataset.category;
  currentFilter = 'latest';
  document.querySelectorAll('.filter-btn').forEach((item) => item.classList.toggle('active', item.dataset.category === currentCategory));
  loadThreads();
}));

postForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!turnstileToken) return;
  submitButton.disabled = true;
  feedback.textContent = '正在提交…';
  const form = new FormData(postForm);
  try {
    const response = await fetch('/api/community/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: form.get('category'), nickname: form.get('nickname'), title: form.get('title'),
        content: form.get('content'), inviteCode: form.get('inviteCode'), turnstileToken
      })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '提交失败。');
    postForm.reset();
    postDialog.close();
    showToast(data.message);
  } catch (error) {
    feedback.textContent = error.message;
    window.turnstile?.reset(turnstileWidgetId);
    turnstileToken = '';
  }
});

loadThreads();
