const submissionToggle = document.querySelector('.submit-online-toggle');
const submissionPanel = document.querySelector('#online-submit-panel');

if (submissionToggle && submissionPanel) {
  const closeButton = submissionPanel.querySelector('.submission-close');
  const form = submissionPanel.querySelector('.submission-form');
  const submitButton = form.querySelector('button[type="submit"], #atlas-submission-submit');
  const reasonInput = form.elements.reason;
  const counter = submissionPanel.querySelector('.submission-count');
  const feedback = submissionPanel.querySelector('.submission-feedback');
  const successPanel = submissionPanel.querySelector('.submission-success');
  const againButton = submissionPanel.querySelector('.submission-again');
  const captchaElement = submissionPanel.querySelector('.submission-turnstile');

  let captchaConfig = null;
  let captchaProvider = '';
  let captchaInstance = null;
  let aliyunScriptPromise = null;
  let turnstileScriptPromise = null;
  let turnstileWidgetId = null;
  let turnstileToken = '';
  let submissionComplete = false;

  function loadAliyunScript() {
    if (window.initAliyunCaptcha) return Promise.resolve();
    if (aliyunScriptPromise) return aliyunScriptPromise;

    aliyunScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://o.alicdn.com/captcha-frontend/aliyunCaptcha/AliyunCaptcha.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load verification'));
      document.head.appendChild(script);
    });

    return aliyunScriptPromise;
  }

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve();
    if (turnstileScriptPromise) return turnstileScriptPromise;

    turnstileScriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Could not load Turnstile'));
      document.head.appendChild(script);
    });

    return turnstileScriptPromise;
  }

  async function submitProject(captchaValue, captchaField) {
    submissionComplete = false;
    submitButton.disabled = true;
    feedback.textContent = 'Submitting…';
    const formData = new FormData(form);

    try {
      const payload = {
        projectName: formData.get('projectName'),
        projectUrl: formData.get('projectUrl'),
        reason: formData.get('reason')
      };
      payload[captchaField] = captchaValue;

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) throw new Error('Submission failed. Please check your input and try again later.');

      submissionComplete = true;
      captchaInstance?.destroyCaptcha?.();
      form.reset();
      counter.textContent = '0 / 800';
      feedback.textContent = '';
      form.hidden = true;
      successPanel.hidden = false;
      successPanel.focus();
    } catch (error) {
      const message = 'Submission failed. Please check your input and try again later.';
      await initializeCaptcha({ preserveFeedback: true });
      feedback.textContent = message;
    }
  }

  async function setupAliyunCaptcha() {
    window.AliyunCaptchaConfig = {
      region: captchaConfig.aliyunRegion || 'cn',
      prefix: captchaConfig.aliyunPrefix
    };

    await loadAliyunScript();
    if (!window.initAliyunCaptcha) throw new Error('Verification is not loaded');

    captchaInstance?.destroyCaptcha?.();
    captchaElement.replaceChildren();
    captchaElement.id ||= 'atlas-submission-captcha';
    submitButton.id ||= 'atlas-submission-submit';
    submitButton.type = 'button';

    window.initAliyunCaptcha({
      SceneId: captchaConfig.submissionSceneId,
      mode: 'popup',
      element: `#${captchaElement.id}`,
      button: `#${submitButton.id}`,
      language: 'en',
      delayBeforeSuccess: false,
      slideStyle: {
        width: 360,
        height: 40
      },
      getInstance(instance) {
        captchaInstance = instance;
        if (!submissionComplete) submitButton.disabled = false;
      },
      fail(error) {
        console.error('Aliyun submission captcha rejected:', error);
        feedback.textContent = 'Verification failed. Please try again.';
      },
      success(captchaVerifyParam) {
        submitProject(captchaVerifyParam, 'captchaVerifyParam');
      }
    });
  }

  async function setupTurnstile() {
    await loadTurnstileScript();
    if (!window.turnstile) throw new Error('Turnstile is not loaded');

    submitButton.type = 'button';
    if (turnstileWidgetId !== null) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileToken = '';
      submitButton.disabled = true;
      return;
    }

    turnstileWidgetId = window.turnstile.render(captchaElement, {
      sitekey: captchaConfig.turnstileSiteKey,
      action: 'submit-project',
      size: 'flexible',
      theme: 'light', language: 'en',
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
        feedback.textContent = 'Could not load verification. Please refresh and try again.';
      }
    });
  }

  async function initializeCaptcha({ preserveFeedback = false } = {}) {
    submitButton.disabled = true;
    if (!preserveFeedback) feedback.textContent = 'Loading verification…';

    try {
      if (!captchaConfig) {
        const response = await fetch('/api/config');
        captchaConfig = await response.json();
        if (!response.ok) throw new Error('Verification is not configured');
        captchaProvider = captchaConfig.captchaProvider === 'aliyun'
          ? 'aliyun'
          : (captchaConfig.turnstileSiteKey ? 'turnstile' : '');
      }

      if (captchaProvider === 'aliyun') {
        if (!captchaConfig.aliyunPrefix || !captchaConfig.submissionSceneId) {
          throw new Error('Verification is not configured');
        }
        await setupAliyunCaptcha();
      } else if (captchaProvider === 'turnstile') {
        await setupTurnstile();
      } else {
        throw new Error('Verification is not configured');
      }

      if (!preserveFeedback && !submissionComplete) feedback.textContent = '';
    } catch (error) {
      console.error('Submission captcha setup failed:', error);
      if (!preserveFeedback) {
        feedback.textContent = 'Online submissions are temporarily unavailable. Please try later or open a GitHub issue.';
      }
      submitButton.disabled = true;
    }
  }

  function openPanel() {
    submissionPanel.hidden = false;
    submissionToggle.setAttribute('aria-expanded', 'true');
    initializeCaptcha();
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

  submitButton.addEventListener('click', () => {
    if (captchaProvider === 'turnstile' && turnstileToken && !submitButton.disabled) {
      submitProject(turnstileToken, 'turnstileToken');
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!submitButton.disabled) submitButton.click();
  });

  againButton.addEventListener('click', () => {
    submissionComplete = false;
    successPanel.hidden = true;
    form.hidden = false;
    feedback.textContent = '';
    initializeCaptcha();
    form.elements.projectName.focus();
  });
}
