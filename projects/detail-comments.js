const panel = document.querySelector('[data-comments-project]');
const likeControl = document.querySelector('[data-project-like]');
let resolveTurnstileReady;
const turnstileReady = new Promise((resolve) => { resolveTurnstileReady = resolve; });
window.onAtlasTurnstileLoad = resolveTurnstileReady;

if (likeControl) {
  const projectSlug = likeControl.dataset.projectLike;
  const button = likeControl.querySelector('.project-like-button');
  const heart = likeControl.querySelector('.project-like-heart');
  const count = likeControl.querySelector('.project-like-count');

  function renderLike(state, animate = false) {
    count.textContent = String(state.count);
    heart.textContent = state.liked ? '♥' : '♡';
    button.classList.toggle('is-liked', state.liked);
    button.setAttribute('aria-pressed', String(state.liked));
    button.setAttribute('aria-label', state.liked ? '已为项目点赞' : '给项目点赞');
    button.disabled = state.liked;
    if (animate) {
      button.classList.add('just-liked');
      button.addEventListener('animationend', () => button.classList.remove('just-liked'), { once: true });
    }
  }

  async function loadLikes() {
    try {
      const response = await fetch(`/api/likes?project=${encodeURIComponent(projectSlug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载失败');
      renderLike(data);
    } catch {
      button.title = '点赞功能暂不可用';
    }
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      const response = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectSlug })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '点赞失败');
      renderLike(data, data.added);
    } catch {
      button.disabled = false;
      button.title = '点赞失败，请稍后重试';
    }
  });

  loadLikes();
}

if (panel) {
  const projectSlug = panel.dataset.commentsProject;
  const list = panel.querySelector('.comments-list');
  const form = panel.querySelector('.comment-form');
  const feedback = panel.querySelector('.comment-form-feedback');
  const submitButton = panel.querySelector('button[type="submit"], #atlas-comment-submit');
  const contentInput = form.elements.content;
  const counter = panel.querySelector('.comment-count');
  const successPanel = panel.querySelector('.comment-success');
  const againButton = panel.querySelector('.comment-again');
  const captchaElement = panel.querySelector('.captcha-slot, .turnstile-slot');
  let captchaConfig = null;
  let captchaProvider = '';
  let captchaInstance = null;
  let aliyunScriptPromise = null;
  let turnstileWidgetId = null;
  let turnstileToken = '';

  const resultLabels = {
    success: '已跑通',
    partial: '部分跑通',
    failed: '未跑通'
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return '';
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(date);
  }

  function renderComments(comments) {
    list.replaceChildren();
    if (!comments.length) {
      list.append(element('p', 'comments-empty', '暂时还没有已公开的留言。用过以后，欢迎回来告诉后来者。'));
      return;
    }

    for (const comment of comments) {
      const article = element('article', 'comment-item');
      const header = element('div', 'comment-item-header');
      const identity = element('div', 'comment-identity');
      identity.append(
        element('strong', '', comment.nickname || '匿名旅人'),
        element('span', `comment-result result-${comment.result}`, resultLabels[comment.result] || comment.result)
      );
      header.append(identity, element('time', '', formatDate(comment.created_at)));
      article.append(header, element('p', 'comment-content', comment.content));
      if (comment.platform) article.append(element('p', 'comment-platform', `使用平台：${comment.platform}`));
      list.append(article);
    }
  }

  async function loadComments() {
    try {
      const response = await fetch(`/api/comments?project=${encodeURIComponent(projectSlug)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '加载失败');
      renderComments(data.comments || []);
    } catch {
      list.replaceChildren(element('p', 'comments-empty', '公开留言暂时加载失败，请稍后刷新。'));
    }
  }

  function loadAliyunScript() {
    if (window.initAliyunCaptcha) return Promise.resolve();
    if (aliyunScriptPromise) return aliyunScriptPromise;

    aliyunScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('阿里云验证码加载失败'));
      document.head.appendChild(script);
    });

    return aliyunScriptPromise;
  }

  async function submitComment(captchaValue, captchaField) {
    submitButton.disabled = true;
    feedback.textContent = '正在提交…';
    const formData = new FormData(form);

    try {
      const payload = {
        projectSlug,
        nickname: formData.get('nickname'),
        content: formData.get('content'),
        platform: formData.get('platform'),
        result: formData.get('result')
      };
      payload[captchaField] = captchaValue;

      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '提交失败，请稍后再试。');

      form.reset();
      counter.textContent = '0 / 800';
      feedback.textContent = '';
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
    } catch (error) {
      feedback.textContent = error.message;
      await initializeCaptcha();
    }
  }

  async function setupAliyunCaptcha() {
    window.AliyunCaptchaConfig = {
      region: captchaConfig.aliyunRegion || 'cn',
      prefix: captchaConfig.aliyunPrefix
    };

    await loadAliyunScript();
    if (!window.initAliyunCaptcha) throw new Error('验证码脚本未加载');

    captchaInstance?.destroyCaptcha?.();
    captchaElement.replaceChildren();
    captchaElement.id ||= 'atlas-comment-captcha';
    submitButton.id ||= 'atlas-comment-submit';
    submitButton.type = 'button';

    window.initAliyunCaptcha({
      SceneId: captchaConfig.commentSceneId,
      mode: 'popup',
      element: `#${captchaElement.id}`,
      button: `#${submitButton.id}`,
      language: 'cn',
      delayBeforeSuccess: false,
      slideStyle: {
        width: 360,
        height: 40
      },
      getInstance(instance) {
        captchaInstance = instance;
        submitButton.disabled = false;
        feedback.textContent = '';
      },
      fail(error) {
        console.error('Aliyun captcha rejected:', error);
        feedback.textContent = '人机验证未通过，请重新尝试。';
      },
      success(captchaVerifyParam) {
        submitComment(captchaVerifyParam, 'captchaVerifyParam');
      }
    });
  }

  async function setupTurnstile() {
    submitButton.type = 'button';
    await Promise.race([
      turnstileReady,
      new Promise((_, reject) => setTimeout(() => reject(new Error('加载超时')), 10000))
    ]);
    if (!window.turnstile) throw new Error('Turnstile 未加载');

    if (turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileToken = '';
      submitButton.disabled = true;
      return;
    }

    turnstileWidgetId = window.turnstile.render(captchaElement, {
      sitekey: captchaConfig.turnstileSiteKey,
      action: 'submit-comment',
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
  }

  async function initializeCaptcha() {
    submitButton.disabled = true;
    feedback.textContent = '正在初始化人机验证…';

    try {
      if (!captchaConfig) {
        const response = await fetch('/api/config');
        captchaConfig = await response.json();
        if (!response.ok) throw new Error('验证码配置未完成');
        captchaProvider = captchaConfig.captchaProvider === 'aliyun'
          ? 'aliyun'
          : (captchaConfig.turnstileSiteKey ? 'turnstile' : '');
      }

      if (captchaProvider === 'aliyun') {
        if (!captchaConfig.aliyunPrefix || !captchaConfig.commentSceneId) throw new Error('阿里验证码配置未完成');
        await setupAliyunCaptcha();
      } else if (captchaProvider === 'turnstile') {
        await setupTurnstile();
      } else {
        throw new Error('验证码配置未完成');
      }
    } catch (error) {
      console.error('Captcha setup failed:', error);
      feedback.textContent = '留言提交暂时不可用，公开留言仍可正常查看。';
      submitButton.disabled = true;
    }
  }

  submitButton.addEventListener('click', () => {
    if (captchaProvider === 'turnstile' && turnstileToken && !submitButton.disabled) {
      submitComment(turnstileToken, 'turnstileToken');
    }
  });

  contentInput.addEventListener('input', () => {
    counter.textContent = `${[...contentInput.value].length} / 800`;
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!submitButton.disabled) submitButton.click();
  });

  againButton.addEventListener('click', () => {
    successPanel.hidden = true;
    form.hidden = false;
    feedback.textContent = '';
    initializeCaptcha();
    form.elements.nickname.focus();
  });

  loadComments();
  initializeCaptcha();
}
