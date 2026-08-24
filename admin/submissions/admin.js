const authForm = document.querySelector('#admin-auth');
const tokenInput = document.querySelector('#admin-token');
const feedback = document.querySelector('#admin-feedback');
const list = document.querySelector('#review-list');
let adminToken = sessionStorage.getItem('atlas-admin-token') || '';

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

async function api(options = {}) {
  const response = await fetch('/api/admin/submissions', {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`,
      ...options.headers
    }
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

function render(submissions) {
  list.replaceChildren();
  if (!submissions.length) {
    list.append(element('p', 'review-empty', '目前没有待处理投稿。'));
    return;
  }

  for (const submission of submissions) {
    const article = element('article', 'review-card');
    const heading = element('div', 'review-heading');
    const title = element('div');
    title.append(
      element('strong', '', submission.project_name),
      element('span', '', `投稿编号 ${submission.id}`)
    );
    heading.append(title, element('time', '', new Date(submission.created_at).toLocaleString('zh-CN')));

    const link = element('a', 'review-link', submission.project_url);
    link.href = submission.project_url;
    link.target = '_blank';
    link.rel = 'noreferrer';
    article.append(heading, link, element('p', 'review-content', submission.reason));

    const actions = element('div', 'review-actions');
    const reviewed = element('button', 'review', '标记已处理');
    const remove = element('button', 'delete', '删除');
    reviewed.type = 'button';
    remove.type = 'button';
    reviewed.addEventListener('click', () => processSubmission(submission.id, 'review', article));
    remove.addEventListener('click', () => {
      if (window.confirm('确定永久删除这条投稿吗？')) processSubmission(submission.id, 'delete', article);
    });
    actions.append(reviewed, remove);
    article.append(actions);
    list.append(article);
  }
}

async function loadPending() {
  feedback.textContent = '正在读取…';
  try {
    const data = await api();
    render(data.submissions || []);
    feedback.textContent = `待处理 ${data.submissions?.length || 0} 条`;
  } catch (error) {
    list.replaceChildren();
    feedback.textContent = error.message;
  }
}

async function processSubmission(id, action, article) {
  const buttons = article.querySelectorAll('button');
  buttons.forEach((button) => { button.disabled = true; });
  try {
    await api({ method: 'POST', body: JSON.stringify({ id, action }) });
    article.remove();
    if (!list.children.length) render([]);
    feedback.textContent = action === 'review' ? '投稿已标记为处理完成。' : '投稿已删除。';
  } catch (error) {
    feedback.textContent = error.message;
    buttons.forEach((button) => { button.disabled = false; });
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
