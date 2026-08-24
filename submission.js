const submissionToggle = document.querySelector('.submit-online-toggle');
const submissionPanel = document.querySelector('#online-submit-panel');

if (submissionToggle && submissionPanel) {
  const closeButton = submissionPanel.querySelector('.submission-close');
  const form = submissionPanel.querySelector('.submission-form');
  const submitButton = form.querySelector('button[type="submit"]');
  const reasonInput = form.elements.reason;
  const counter = submissionPanel.querySelector('.submission-count');
  const feedback = submissionPanel.querySelector('.submission-feedback');
  const successPanel = submissionPanel.querySelector('.submission-success');
  const againButton = submissionPanel.querySelector('.submission-again');
  let resolveTurnstileReady;
  const turnstileReady = new Promise((resolve) => { resolveTurnstileReady = resolve; });
  let turnstileWidgetId = null;
  let turnstileToken = '';
  let turnstileSetupStarted = false;

  window.onAtlasSubmissionTurnstileLoad = resolveTurnstileReady;

  async function setupTurnstile() {
    if (turnstileSetupStarted) return;
    turnstileSetupStarted = true;
    try {
      const response = await fetch('/api/config');
      const config = await response.json();
      if (!response.ok || !config.turnstileSiteKey) throw new Error('未配置');
      await Promise.race([
        turnstileReady,
        new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 10000))
      ]);
      if (!window.turnstile) throw new Error('未加载');
      turnstileWidgetId = window.turnstile.render(submissionPanel.querySelector('.submission-turnstile'), {
        sitekey: config.turnstileSiteKey,
        action: 'submit-project',
        size: 'flexible',
        theme: 'light',
        callback(token) {
          turnstileToken = token;
          submitButton.disabled = false;
          feedback.textContent = '';
        },
        'expired-callback'() {
          turnstileToken = '';
          submitButton.disabled = true;
        },
        'error-callback'() {
          turnstileToken = '';
          submitButton.disabled = true;
          feedback.textContent = '人机验证加载失败，请刷新后重试。';
        }
      });
    } catch {
      feedback.textContent = '在线投稿暂时不可用，请稍后再试或使用 GitHub Issue。';
    }
  }

  function resetTurnstile() {
    turnstileToken = '';
    submitButton.disabled = true;
    if (turnstileWidgetId !== null && window.turnstile) window.turnstile.reset(turnstileWidgetId);
  }

  function openPanel() {
    submissionPanel.hidden = false;
    submissionToggle.setAttribute('aria-expanded', 'true');
    setupTurnstile();
    submissionPanel.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center'
    });
  }

  function closePanel() {
    submissionPanel.hidden = true;
    submissionToggle.setAttribute('aria-expanded', 'false');
    document.querySelector('#submit')?.scrollIntoView({ block: 'center' });
  }

  submissionToggle.addEventListener('click', openPanel);
  closeButton.addEventListener('click', closePanel);

  reasonInput.addEventListener('input', () => {
    counter.textContent = `${[...reasonInput.value].length} / 800`;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!turnstileToken) {
      feedback.textContent = '请先完成人机验证。';
      return;
    }

    submitButton.disabled = true;
    feedback.textContent = '正在提交…';
    const formData = new FormData(form);

    try {
      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: formData.get('projectName'),
          projectUrl: formData.get('projectUrl'),
          reason: formData.get('reason'),
          turnstileToken
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '投稿失败，请稍后再试。');
      form.reset();
      counter.textContent = '0 / 800';
      feedback.textContent = '';
      turnstileToken = '';
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
    } catch (error) {
      feedback.textContent = error.message;
      resetTurnstile();
    }
  });

  againButton.addEventListener('click', () => {
    successPanel.hidden = true;
    form.hidden = false;
    feedback.textContent = '';
    resetTurnstile();
    form.elements.projectName.focus();
  });
}
