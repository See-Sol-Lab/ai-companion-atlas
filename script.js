const headerCta = document.querySelector('.header-cta');
if (headerCta) headerCta.remove();

const primaryExplore = document.querySelector('.hero-actions .button-primary');
if (primaryExplore) primaryExplore.innerHTML = '开始探索 <span aria-hidden="true">↗</span>';

const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');

if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const open = mainNav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? '关闭导航' : '打开导航');
  });

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

document.querySelectorAll('.tag').forEach((tag) => {
  tag.addEventListener('click', () => {
    document.querySelectorAll('.tag').forEach((item) => item.classList.remove('active'));
    tag.classList.add('active');
  });
});

const visual = document.querySelector('.hero-visual');
const map = document.querySelector('.atlas-map');

if (visual && map && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  visual.addEventListener('pointermove', (event) => {
    const rect = visual.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    map.style.transform = `translate(calc(-50% + ${x * 8}px), calc(-48% + ${y * 8}px))`;
  });

  visual.addEventListener('pointerleave', () => {
    map.style.transform = 'translate(-50%, -48%)';
  });
}

/* Project catalog pagination: keep the homepage light even as the atlas grows. */
const PROJECTS_PER_PAGE = 30;
const directorySection = document.getElementById('directory');
const projectGrid = directorySection?.querySelector('.project-grid');
const projectCards = projectGrid
  ? Array.from(projectGrid.querySelectorAll(':scope > .project-card'))
  : [];

if (directorySection && projectGrid && projectCards.length > PROJECTS_PER_PAGE) {
  const totalPages = Math.ceil(projectCards.length / PROJECTS_PER_PAGE);
  const pagination = document.createElement('nav');
  pagination.className = 'catalog-pagination';
  pagination.setAttribute('aria-label', '项目库分页');
  pagination.innerHTML = `
    <button class="catalog-page-button catalog-page-prev" type="button" aria-label="上一页">← <span>上一页</span></button>
    <div class="catalog-page-numbers" aria-label="页码"></div>
    <span class="catalog-page-mobile-status" aria-live="polite"></span>
    <button class="catalog-page-button catalog-page-next" type="button" aria-label="下一页"><span>下一页</span> →</button>
  `;
  projectGrid.insertAdjacentElement('afterend', pagination);

  const numbers = pagination.querySelector('.catalog-page-numbers');
  const previousButton = pagination.querySelector('.catalog-page-prev');
  const nextButton = pagination.querySelector('.catalog-page-next');
  const mobileStatus = pagination.querySelector('.catalog-page-mobile-status');

  const pageFromUrl = () => {
    const raw = Number.parseInt(new URL(window.location.href).searchParams.get('page') || '1', 10);
    return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), totalPages) : 1;
  };

  const pageTokens = (currentPage) => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);

    const keep = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    const pages = Array.from(keep)
      .filter((page) => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);
    const tokens = [];

    pages.forEach((page, index) => {
      if (index > 0 && page - pages[index - 1] > 1) tokens.push('…');
      tokens.push(page);
    });

    return tokens;
  };

  const syncUrl = (page, mode) => {
    if (mode === 'none') return;
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(page));
    window.history[mode === 'push' ? 'pushState' : 'replaceState']({ catalogPage: page }, '', url);
  };

  const scrollToDirectory = () => {
    const target = directorySection.querySelector('.section-heading') || directorySection;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  const renderPage = (requestedPage, { historyMode = 'push', scroll = false } = {}) => {
    const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
    const start = (currentPage - 1) * PROJECTS_PER_PAGE;
    const end = start + PROJECTS_PER_PAGE;

    projectCards.forEach((card, index) => {
      const isVisible = index >= start && index < end;
      card.hidden = !isVisible;
      if (isVisible) {
        card.style.removeProperty('display');
        card.removeAttribute('aria-hidden');
      } else {
        card.style.display = 'none';
        card.setAttribute('aria-hidden', 'true');
      }
    });

    numbers.replaceChildren();
    pageTokens(currentPage).forEach((token) => {
      if (token === '…') {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'catalog-page-ellipsis';
        ellipsis.textContent = token;
        ellipsis.setAttribute('aria-hidden', 'true');
        numbers.appendChild(ellipsis);
        return;
      }

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'catalog-page-number';
      button.textContent = String(token);
      button.dataset.page = String(token);
      button.setAttribute('aria-label', `第 ${token} 页`);
      if (token === currentPage) {
        button.classList.add('is-active');
        button.setAttribute('aria-current', 'page');
      }
      numbers.appendChild(button);
    });

    previousButton.disabled = currentPage === 1;
    nextButton.disabled = currentPage === totalPages;
    previousButton.dataset.page = String(currentPage - 1);
    nextButton.dataset.page = String(currentPage + 1);
    mobileStatus.textContent = `${currentPage} / ${totalPages}`;

    syncUrl(currentPage, historyMode);
    if (scroll) scrollToDirectory();
  };

  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    renderPage(Number.parseInt(button.dataset.page, 10), { historyMode: 'push', scroll: true });
  });

  window.addEventListener('popstate', () => {
    renderPage(pageFromUrl(), { historyMode: 'none', scroll: true });
  });

  renderPage(pageFromUrl(), { historyMode: 'replace', scroll: false });
}
