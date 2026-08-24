/* Retired catalog entries are removed before the main catalog runtime counts, filters, or paginates cards. */
const RETIRED_PROJECT_SLUGS = new Set([
  'lain-waifu',
  'character-card-v3',
  'character-card-v2'
]);

const retiredProjectGrid = document.querySelector('#directory .project-grid');
if (retiredProjectGrid) {
  retiredProjectGrid.querySelectorAll(':scope > .project-card').forEach((card) => {
    const href = card.querySelector('.project-detail-button')?.getAttribute('href') || '';
    const match = href.match(/\.\/projects\/([^/]+)\//);
    if (match && RETIRED_PROJECT_SLUGS.has(match[1])) card.remove();
  });

  /* Keep manually corrected editorial metadata in sync until the next generator run. */
  retiredProjectGrid.querySelectorAll(':scope > .project-card').forEach((card) => {
    const href = card.querySelector('.project-detail-button')?.getAttribute('href') || '';
    const match = href.match(/\.\/projects\/([^/]+)\//);
    if (match?.[1] !== 'xinchao-nian') return;

    const categories = new Set((card.dataset.categories || '').split(' ').filter(Boolean));
    categories.add('adult');
    card.dataset.categories = Array.from(categories).join(' ');
    card.dataset.search = `${card.dataset.search || ''} 18+ 成人内容 欲望系统`.trim();

    const badgeRow = card.querySelector('.project-badges');
    if (badgeRow && !badgeRow.querySelector('.badge-adult')) {
      const badge = document.createElement('span');
      badge.className = 'project-badge badge-adult';
      badge.textContent = '18+';
      badgeRow.appendChild(badge);
    }

    const tags = card.querySelector('.project-tags');
    if (tags && !Array.from(tags.children).some((tag) => tag.textContent.trim() === '18+')) {
      const tag = document.createElement('span');
      tag.textContent = '18+';
      tags.prepend(tag);
    }
  });
}

/* A quiet, always-available return-to-top control for long catalog browsing. */
const backToTopStyles = document.createElement('link');
backToTopStyles.rel = 'stylesheet';
backToTopStyles.href = './back-to-top.css?v=20260823-1';
document.head.appendChild(backToTopStyles);

const backToTopButton = document.createElement('button');
backToTopButton.className = 'atlas-back-to-top';
backToTopButton.type = 'button';
backToTopButton.setAttribute('aria-label', '返回页面顶部');
backToTopButton.title = '返回顶部';
backToTopButton.innerHTML = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 11.5 12 5.5l6 6"></path>
    <path d="M12 6v12.5"></path>
  </svg>
`;
document.body.appendChild(backToTopButton);

let backToTopAnimationFrame = null;

backToTopButton.addEventListener('click', () => {
  if (backToTopAnimationFrame !== null) cancelAnimationFrame(backToTopAnimationFrame);

  const startY = window.scrollY || document.documentElement.scrollTop || 0;
  if (startY <= 0) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    window.scrollTo(0, 0);
    return;
  }

  const duration = 380;
  const startedAt = performance.now();
  const easeOutCubic = (progress) => 1 - Math.pow(1 - progress, 3);

  const step = (now) => {
    const progress = Math.min((now - startedAt) / duration, 1);
    const nextY = Math.round(startY * (1 - easeOutCubic(progress)));
    window.scrollTo(0, nextY);

    if (progress < 1) {
      backToTopAnimationFrame = requestAnimationFrame(step);
    } else {
      backToTopAnimationFrame = null;
      window.scrollTo(0, 0);
    }
  };

  backToTopAnimationFrame = requestAnimationFrame(step);
});

import('./script-runtime.js?v=20260824-coding-1').catch((error) => {
  console.error('Atlas catalog runtime failed to load:', error);
});
