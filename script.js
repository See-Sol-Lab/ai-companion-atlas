const quickFilterStyles = document.createElement('link');
quickFilterStyles.rel = 'stylesheet';
quickFilterStyles.href = './quick-filters.css?v=20260823-1';
document.head.appendChild(quickFilterStyles);

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

/* Quick editorial entry cards + project catalog pagination. */
const PROJECTS_PER_PAGE = 30;
const directorySection = document.getElementById('directory');
const taxonomySection = document.getElementById('taxonomy');
const capabilityStrip = document.querySelector('.capability-strip');
const projectGrid = directorySection?.querySelector('.project-grid');
const projectCards = projectGrid
  ? Array.from(projectGrid.querySelectorAll(':scope > .project-card'))
  : [];

/* Verified 500★+ slugs already in / entering the Atlas. Future generated cards can
   use data-stars and will not need to be added here. */
const HIGH_STAR_SLUGS = new Set([
  'airi',
  'rikkahub',
  'operit',
  'astrbot',
  'chatdollkit',
  'yoji',
  'duix-mobile',
  'n-e-k-o',
  'neko'
]);

const cardSlug = (card) => {
  const href = card.querySelector('.project-detail-button')?.getAttribute('href') || '';
  const match = href.match(/\.\/projects\/([^/]+)\//);
  return match?.[1] || '';
};

const isHighStarCard = (card) => {
  const stars = Number.parseInt(card.dataset.stars || '', 10);
  if (Number.isFinite(stars)) return stars >= 500;
  return HIGH_STAR_SLUGS.has(cardSlug(card));
};

const isEditorPickCard = (card) =>
  card.dataset.editorPick === 'true' || Boolean(card.querySelector('.badge-pick'));

let catalogFilter = 'all';
let quickFilters = null;

if (taxonomySection && directorySection) {
  quickFilters = document.createElement('aside');
  quickFilters.className = 'atlas-quick-filters';
  quickFilters.setAttribute('aria-label', '项目快捷分类');
  quickFilters.innerHTML = `
    <button class="atlas-quick-filter" type="button" data-catalog-filter="high-star" aria-pressed="false">
      <span class="atlas-quick-filter-title">高星项目</span>
      <span class="atlas-quick-filter-subtitle">GitHub 500★ 以上</span>
    </button>
    <button class="atlas-quick-filter" type="button" data-catalog-filter="editor-pick" aria-pressed="false">
      <span class="atlas-quick-filter-title">人工精选</span>
      <span class="atlas-quick-filter-subtitle">高质量 / 有影响力项目</span>
    </button>
  `;
  if (capabilityStrip) {
    const exploreLayout = document.createElement('div');
    exploreLayout.className = 'atlas-explore-layout';
    capabilityStrip.insertAdjacentElement('beforebegin', exploreLayout);
    exploreLayout.append(capabilityStrip, taxonomySection, quickFilters);
  } else {
    taxonomySection.insertAdjacentElement('afterend', quickFilters);
  }
}

if (directorySection && projectGrid && projectCards.length > 0) {
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

  const emptyState = document.createElement('div');
  emptyState.className = 'catalog-empty-state';
  emptyState.hidden = true;
  emptyState.textContent = '当前分类暂时没有项目。';
  projectGrid.appendChild(emptyState);

  const numbers = pagination.querySelector('.catalog-page-numbers');
  const previousButton = pagination.querySelector('.catalog-page-prev');
  const nextButton = pagination.querySelector('.catalog-page-next');
  const mobileStatus = pagination.querySelector('.catalog-page-mobile-status');

  const filterFromUrl = () => {
    const value = new URL(window.location.href).searchParams.get('filter');
    return ['high-star', 'editor-pick'].includes(value) ? value : 'all';
  };

  const filteredCards = () => {
    if (catalogFilter === 'high-star') return projectCards.filter(isHighStarCard);
    if (catalogFilter === 'editor-pick') return projectCards.filter(isEditorPickCard);
    return projectCards;
  };

  const pageFromUrl = (totalPages) => {
    const raw = Number.parseInt(new URL(window.location.href).searchParams.get('page') || '1', 10);
    return Number.isFinite(raw) ? Math.min(Math.max(raw, 1), totalPages) : 1;
  };

  const pageTokens = (currentPage, totalPages) => {
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

    if (page > 1) url.searchParams.set('page', String(page));
    else url.searchParams.delete('page');

    if (catalogFilter === 'all') url.searchParams.delete('filter');
    else url.searchParams.set('filter', catalogFilter);

    window.history[mode === 'push' ? 'pushState' : 'replaceState'](
      { catalogPage: page, catalogFilter },
      '',
      url
    );
  };

  const scrollToDirectory = () => {
    const target = directorySection.querySelector('.section-heading') || directorySection;
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
  };

  const syncQuickFilterState = () => {
    quickFilters?.querySelectorAll('[data-catalog-filter]').forEach((button) => {
      const active = button.dataset.catalogFilter === catalogFilter;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const renderPage = (requestedPage, { historyMode = 'push', scroll = false } = {}) => {
    const matches = filteredCards();
    const totalPages = Math.max(1, Math.ceil(matches.length / PROJECTS_PER_PAGE));
    const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
    const start = (currentPage - 1) * PROJECTS_PER_PAGE;
    const visibleSet = new Set(matches.slice(start, start + PROJECTS_PER_PAGE));

    projectCards.forEach((card) => {
      const isVisible = visibleSet.has(card);
      card.hidden = !isVisible;
      if (isVisible) {
        card.style.removeProperty('display');
        card.removeAttribute('aria-hidden');
      } else {
        card.style.display = 'none';
        card.setAttribute('aria-hidden', 'true');
      }
    });

    emptyState.hidden = matches.length !== 0;
    pagination.hidden = matches.length === 0 || totalPages <= 1;
    numbers.replaceChildren();

    if (matches.length > 0) {
      pageTokens(currentPage, totalPages).forEach((token) => {
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
    }

    syncQuickFilterState();
    syncUrl(currentPage, historyMode);
    if (scroll) scrollToDirectory();
  };

  pagination.addEventListener('click', (event) => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    renderPage(Number.parseInt(button.dataset.page, 10), { historyMode: 'push', scroll: true });
  });

  quickFilters?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-catalog-filter]');
    if (!button) return;
    const requestedFilter = button.dataset.catalogFilter;
    catalogFilter = catalogFilter === requestedFilter ? 'all' : requestedFilter;
    renderPage(1, { historyMode: 'push', scroll: true });
  });

  window.addEventListener('popstate', () => {
    catalogFilter = filterFromUrl();
    const totalPages = Math.max(1, Math.ceil(filteredCards().length / PROJECTS_PER_PAGE));
    renderPage(pageFromUrl(totalPages), { historyMode: 'none', scroll: true });
  });

  catalogFilter = filterFromUrl();
  const initialTotalPages = Math.max(1, Math.ceil(filteredCards().length / PROJECTS_PER_PAGE));
  renderPage(pageFromUrl(initialTotalPages), { historyMode: 'replace', scroll: false });
}
