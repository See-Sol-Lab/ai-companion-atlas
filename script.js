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
}

import('./script-runtime.js?v=20260823-retired-1').catch((error) => {
  console.error('Atlas catalog runtime failed to load:', error);
});
