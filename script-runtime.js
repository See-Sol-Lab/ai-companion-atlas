const quickFilterStyles = document.createElement('link');
quickFilterStyles.rel = 'stylesheet';
quickFilterStyles.href = './quick-filters.css?v=20260823-1';
document.head.appendChild(quickFilterStyles);

const honorMedalStyles = document.createElement('link');
honorMedalStyles.rel = 'stylesheet';
honorMedalStyles.href = './honor-medals.css?v=20260823-1';
document.head.appendChild(honorMedalStyles);

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

  const scrollTargets = new Map([
    ['#taxonomy', 'center'],
    ['#guides', 'start'],
    ['#submit', 'start'],
    ['#about', 'start']
  ]);

  mainNav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', (event) => {
      mainNav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');

      const block = scrollTargets.get(link.hash);
      const target = block ? document.querySelector(link.hash) : null;
      if (!target) return;

      event.preventDefault();
      window.history.pushState(null, '', link.hash);
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block
      });
    });
  });
}

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
const directoryTitle = document.getElementById('directory-title');
const directoryFilterNote = document.getElementById('directory-filter-note');
const catalogSearch = document.getElementById('catalogSearch');
const catalogSearchInput = document.getElementById('catalogSearchInput');
const catalogSearchClear = document.getElementById('catalogSearchClear');
const projectAuthorCount = new Set(
  projectCards
    .map((card) => card.querySelector('.project-author')?.textContent.replace(/^@/, '').trim().toLowerCase())
    .filter(Boolean)
).size;
const CATEGORY_FILTERS = {
  memory: '记忆',
  subjectivity: 'AI 主体性',
  senses: '五感与器官',
  companion: '陪伴类',
  continuity: '关系延续',
  desktop: 'PC 前端',
  mobile: '手机前端',
  coding: '开发与编程',
  game: '游戏',
  tool: '工具 / 插件',
  adult: '18+'
};
const normalizeSearch = (value) => value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();

const scoreSearchMatch = (card, query) => {
  const terms = query.split(' ').filter(Boolean);
  const fullText = normalizeSearch(card.dataset.search || '');
  if (terms.some((term) => !fullText.includes(term))) return -1;

  const title = normalizeSearch(`${card.querySelector('.project-title-zh')?.textContent || ''} ${card.querySelector('.project-title-en')?.textContent || ''}`);
  const author = normalizeSearch(card.querySelector('.project-author')?.textContent || '');
  const tags = normalizeSearch(card.querySelector('.project-tags')?.textContent || '');
  const hook = normalizeSearch(card.querySelector('.project-problem')?.textContent || '');
  const summary = normalizeSearch(card.querySelector('.project-description')?.textContent || '');

  return terms.reduce((score, term) => {
    if (title === term) score += 100;
    else if (title.startsWith(term)) score += 70;
    else if (title.includes(term)) score += 50;
    if (author.includes(term)) score += 35;
    if (tags.includes(term)) score += 25;
    if (hook.includes(term)) score += 16;
    if (summary.includes(term)) score += 8;
    if (fullText.includes(term)) score += 4;
    return score;
  }, 0);
};

/* Verified 500★+ slugs in the Atlas as of 2026-08-23. Future generated cards can
   use data-stars and will not need to be added here. */
const HIGH_STAR_SLUGS = new Set([
  'claude-code',
  'whisper',
  'gpt-sovits',
  'whisper-cpp',
  'airi',
  'astrbot',
  'fish-speech',
  'opencli',
  'faster-whisper',
  'index-tts',
  'cosyvoice',
  'funasr',
  'memos',
  'sensevoice',
  'duix-mobile',
  'mineflayer',
  'operit',
  'rikkahub',
  'clawd-on-desk',
  'chatgpt-exporter',
  'n-e-k-o',
  'bitterbot-desktop',
  'roboto-origin',
  'lingchat',
  'openmmo',
  'cyberboss',
  'ombre-brain',
  'chatdollkit',
  'whale-phone',
  'ai-virtual-phone',
  'aionshome',
  'fount',
  'memex-journal',
  'yoji',
  'shinsekai',
  'ai-fishing-game'
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

projectCards.forEach((card) => {
  card.classList.toggle('has-high-star-honor', isHighStarCard(card));
  card.classList.toggle('has-editor-pick-honor', isEditorPickCard(card));
});

let catalogFilter = 'all';
let quickFilters = null;
let searchQuery = '';

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
    return ['high-star', 'editor-pick', ...Object.keys(CATEGORY_FILTERS)].includes(value) ? value : 'all';
  };

  const filteredCards = () => {
    let matches = projectCards;
    if (catalogFilter === 'high-star') matches = projectCards.filter(isHighStarCard);
    else if (catalogFilter === 'editor-pick') matches = projectCards.filter(isEditorPickCard);
    if (CATEGORY_FILTERS[catalogFilter]) {
      matches = projectCards.filter((card) => (card.dataset.categories || '').split(' ').includes(catalogFilter));
    }
    if (!searchQuery) return matches;

    return matches
      .map((card, index) => ({ card, index, score: scoreSearchMatch(card, searchQuery) }))
      .filter((item) => item.score >= 0)
      .sort((left, right) => right.score - left.score || left.index - right.index)
      .map((item) => item.card);
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

  const syncCategoryFilterState = () => {
    taxonomySection.querySelectorAll('.tag[data-catalog-filter]').forEach((button) => {
      const active = button.dataset.catalogFilter === catalogFilter;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
  };

  const syncDirectoryHeading = (matchCount) => {
    if (searchQuery) {
      directoryTitle.classList.remove('directory-stats');
      directoryTitle.textContent = '搜索结果';
      directoryFilterNote.textContent = `找到 ${matchCount} 个相关项目`;
      directoryFilterNote.hidden = false;
      return;
    }

    const filteredHeading = {
      'high-star': ['高星项目', 'GitHub Star ≥ 500'],
      'editor-pick': ['人工精选', '小红书高赞项目']
    }[catalogFilter] || (CATEGORY_FILTERS[catalogFilter] ? [`${CATEGORY_FILTERS[catalogFilter]}项目`, '分类标签'] : null);

    if (filteredHeading) {
      directoryTitle.classList.remove('directory-stats');
      directoryTitle.textContent = filteredHeading[0];
      directoryFilterNote.textContent = filteredHeading[1];
      directoryFilterNote.hidden = false;
      return;
    }

    directoryTitle.classList.add('directory-stats');
    directoryTitle.innerHTML = `<strong>${projectCards.length}</strong><span>个项目 ·</span><strong>${projectAuthorCount}</strong><span>位作者</span>`;
    directoryFilterNote.textContent = '';
    directoryFilterNote.hidden = true;
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
    emptyState.textContent = searchQuery ? '没有找到相关项目。' : '当前分类暂时没有项目。';
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
    syncCategoryFilterState();
    syncDirectoryHeading(matches.length);
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

  taxonomySection.addEventListener('click', (event) => {
    const button = event.target.closest('.tag[data-catalog-filter]');
    if (!button) return;
    const requestedFilter = button.dataset.catalogFilter;
    catalogFilter = catalogFilter === requestedFilter ? 'all' : requestedFilter;
    renderPage(1, { historyMode: 'push', scroll: true });
  });

  catalogSearch?.addEventListener('submit', (event) => event.preventDefault());

  catalogSearchInput?.addEventListener('input', (event) => {
    searchQuery = normalizeSearch(event.target.value);
    catalogSearchClear.hidden = !searchQuery;
    renderPage(1, { historyMode: 'replace', scroll: false });
  });

  catalogSearchClear?.addEventListener('click', () => {
    catalogSearchInput.value = '';
    searchQuery = '';
    catalogSearchClear.hidden = true;
    renderPage(1, { historyMode: 'replace', scroll: false });
    catalogSearchInput.focus();
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
