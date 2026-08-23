import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const projectsDirectory = path.join(root, 'projects');
const indexPath = path.join(root, 'index.html');
const cardsStart = '<!-- GENERATED:PROJECT_CARDS:START -->';
const cardsEnd = '<!-- GENERATED:PROJECT_CARDS:END -->';

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

const isText = (value) => typeof value === 'string' && value.trim() !== '';

function requireString(project, pathParts) {
  const value = pathParts.reduce((current, key) => current?.[key], project);
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${project.slug ?? 'unknown project'}: ${pathParts.join('.')} is required`);
  }
}

function validate(project) {
  [
    ['slug'], ['name', 'zh'], ['name', 'en'], ['author'], ['sourceUrl'], ['hook'],
    ['summary'], ['heroDescription'], ['language'], ['platform'], ['updated'],
    ['heroOverline'], ['showcase', 'label'], ['showcase', 'symbol'],
    ['showcase', 'question'], ['showcase', 'note']
  ].forEach((field) => requireString(project, field));

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(project.slug)) {
    throw new Error(`${project.slug}: slug must contain lowercase letters, numbers, and hyphens only`);
  }

  const sourceUrl = new URL(project.sourceUrl);
  if (!['http:', 'https:'].includes(sourceUrl.protocol)) {
    throw new Error(`${project.slug}: sourceUrl must use http or https`);
  }

  if (!Array.isArray(project.badges) || project.badges.length === 0 ||
      project.badges.some((badge) => !isText(badge.label) || !/^[a-z0-9-]+$/.test(badge.tone))) {
    throw new Error(`${project.slug}: every badge needs a label and a lowercase tone`);
  }

  if (!Array.isArray(project.tags) || project.tags.length === 0 || project.tags.some((tag) => !isText(tag))) {
    throw new Error(`${project.slug}: tags must be a non-empty array of text values`);
  }

  if (!Array.isArray(project.showcase.comparisons) || project.showcase.comparisons.length !== 3 ||
      project.showcase.comparisons.some((item) => !isText(item.value) || !isText(item.label))) {
    throw new Error(`${project.slug}: showcase.comparisons must contain exactly three items`);
  }

  if (!Array.isArray(project.intro?.paragraphs) || project.intro.paragraphs.length === 0 ||
      project.intro.paragraphs.some((paragraph) => !isText(paragraph))) {
    throw new Error(`${project.slug}: intro.paragraphs must be a non-empty array of text values`);
  }

  if (!Array.isArray(project.intro?.facts) || project.intro.facts.length === 0 ||
      project.intro.facts.some((fact) => !isText(fact.label) || !isText(fact.text))) {
    throw new Error(`${project.slug}: every intro fact needs a label and text`);
  }

  if (project.stars !== undefined && (!Number.isInteger(project.stars) || project.stars < 0)) {
    throw new Error(`${project.slug}: stars must be a non-negative integer`);
  }
}

function renderBadges(badges, classPrefix) {
  return badges.map((badge) => {
    const toneClass = classPrefix === 'project-badge' ? `badge-${badge.tone}` : `${classPrefix}-${badge.tone}`;
    return `<span class="${classPrefix} ${toneClass}">${escapeHtml(badge.label)}</span>`;
  }).join('');
}

function renderCard(project) {
  const tags = project.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('');
  const secondaryName = /[\u3400-\u9fff]/u.test(project.name.zh)
    ? `\n                <p class="project-title-en">${escapeHtml(project.name.en)}</p>`
    : '';
  const dateLabel = project.dateLabel ?? (project.sourceUrl.startsWith('https://github.com/') ? '更新' : '核验');
  const meta = [project.language, project.platform, `${dateLabel} ${project.updated}`]
    .map((item) => `<span>${escapeHtml(item)}</span>`).join('');
  const cardBadges = project.badges.length <= 5
    ? project.badges
    : [...project.badges].sort((left, right) => [...left.label].length - [...right.label].length).slice(0, 5);
  const badges = renderBadges(cardBadges, 'project-badge');
  const searchText = [
    project.name.zh,
    project.name.en,
    project.author,
    project.hook,
    project.summary,
    project.heroDescription,
    ...project.badges.map((badge) => badge.label),
    ...project.tags
  ].join(' ');

  const editorialMetadata = [
    ` data-categories="${escapeHtml(project.badges.map((badge) => badge.tone).join(' '))}"`,
    ` data-search="${escapeHtml(searchText)}"`,
    project.editorPick === true ? ' data-editor-pick="true"' : '',
    Number.isInteger(project.stars) ? ` data-stars="${project.stars}"` : ''
  ].join('');

  return `          <article class="project-card project-real project-template"${editorialMetadata}>
            <div class="project-template-top">
              <div class="project-title-block">
                <h3 class="project-title-zh">${escapeHtml(project.name.zh)}</h3>${secondaryName}
              </div>
              <div class="project-badges" aria-label="项目状态">${badges}</div>
            </div>
            <div class="project-hook-row"><p class="project-problem">${escapeHtml(project.hook)}</p><span class="project-author">@${escapeHtml(project.author)}</span></div>
            <p class="project-description">${escapeHtml(project.summary)}</p>
            <div class="project-tags">${tags}</div>
            <div class="project-card-footer"><div class="project-footer-meta">${meta}</div><a class="project-detail-button" href="./projects/${escapeHtml(project.slug)}/">查看详情 <span>→</span></a></div>
          </article>`;
}

function renderDetail(project) {
  const statuses = `${renderBadges(project.badges, 'status')}<span class="status">${escapeHtml(project.platform)}</span>`;
  const comparisons = project.showcase.comparisons.map((item, index) => {
    const separator = index === 0 ? '' : '\n            <i>≠</i>\n            ';
    return `${separator}<span><b>${escapeHtml(item.value)}</b><small>${escapeHtml(item.label)}</small></span>`;
  }).join('');
  const paragraphs = project.intro.paragraphs
    .map((paragraph) => `          <p>${escapeHtml(paragraph)}</p>`).join('\n');
  const facts = project.intro.facts
    .map((fact) => `            <li><strong>${escapeHtml(fact.label)}：</strong>${escapeHtml(fact.text)}</li>`).join('\n');
  const sourceUrl = escapeHtml(project.sourceUrl);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="theme-color" content="#f7f4ef" />
  <meta name="description" content="${escapeHtml(project.name.zh)} ${escapeHtml(project.name.en)}：${escapeHtml(project.summary)} AI Companion Atlas 中文项目档案。" />
  <title>${escapeHtml(project.name.zh)} · ${escapeHtml(project.name.en)} · AI Companion Atlas</title>
  <link rel="stylesheet" href="../detail.css?v=20260823-3" />
</head>
<body>
  <div class="detail-shell">
    <header class="detail-header">
      <a class="detail-brand" href="../../" aria-label="返回 AI Companion Atlas 首页">
        <span class="brand-star">✦</span>
        <strong>SEE-SOL-LAB</strong>
        <i></i>
        <span>AI COMPANION ATLAS</span>
      </a>
      <nav>
        <a href="../../#directory">项目库</a>
        <a href="../../#taxonomy">标签</a>
        <a href="../../#submit">投稿</a>
      </nav>
    </header>

    <main>
      <div class="breadcrumb"><a href="../../">图谱首页</a><span>›</span><a href="../../#directory">项目库</a><span>›</span><strong>${escapeHtml(project.name.zh)}</strong></div>

      <section class="detail-hero">
        <div class="detail-hero-copy">
          <div class="status-row">${statuses}</div>
          <p class="overline">${escapeHtml(project.heroOverline)}</p>
          <h1>${escapeHtml(project.name.zh)}</h1>
          <p class="cn-name">${escapeHtml(project.name.en.toUpperCase())} · @${escapeHtml(project.author.toUpperCase())}</p>
          <h2>${escapeHtml(project.hook)}</h2>
          <p class="hero-desc">${escapeHtml(project.heroDescription)}</p>
          <div class="hero-actions">
            <a class="primary-btn" href="${sourceUrl}" target="_blank" rel="noreferrer">项目链接 <span>↗</span></a>
            <a class="secondary-btn" href="../../">返回主页</a>
          </div>
        </div>

        <aside class="problem-card" aria-label="${escapeHtml(project.name.zh)}解决的问题">
          <p class="problem-label">${escapeHtml(project.showcase.label)}</p>
          <div class="clock-mark">${escapeHtml(project.showcase.symbol)}</div>
          <p class="problem-question">${escapeHtml(project.showcase.question)}</p>
          <div class="time-compare">
            ${comparisons}
          </div>
          <p class="problem-note">${escapeHtml(project.showcase.note)}</p>
        </aside>
      </section>

      <section class="project-intro" aria-labelledby="intro-title">
        <div class="intro-heading">
          <p>PROJECT INTRO</p>
          <h2 id="intro-title">项目介绍</h2>
        </div>
        <div class="intro-content">
${paragraphs}
          <ul>
${facts}
          </ul>
        </div>
      </section>

      <section class="discussion-preview" aria-labelledby="discussion-title">
        <div class="discussion-title">
          <span>◌</span>
          <div><p>COMMENTS & FEEDBACK</p><h2 id="discussion-title">评论与反馈</h2></div>
          <b>游客留言功能施工中</b>
        </div>
        <p>用过这个项目的人，可以回来告诉后来者：在哪个平台跑通、安装有没有踩坑、实际体验如何。第一版不要求注册账号，后续会接入轻量游客留言。</p>
      </section>

      <section class="source-section">
        <div>
          <p class="overline">SOURCE & CREDIT</p>
          <h2>Atlas 负责介绍与导航，使用仍回到原作者。</h2>
          <p>我们不镜像项目文件，也不截走作者流量。安装、下载、版本更新与最新说明，以原作者提供的项目页面为准。</p>
        </div>
        <div class="source-actions">
          <a class="primary-btn" href="${sourceUrl}" target="_blank" rel="noreferrer">项目链接 <span>↗</span></a>
        </div>
      </section>
    </main>

    <footer>
      <div><strong>SEE-SOL-LAB</strong><span>AI COMPANION ATLAS</span></div>
      <a href="../../">返回图谱首页 ↑</a>
    </footer>
  </div>
</body>
</html>
`;
}

async function writeIfChanged(filePath, content) {
  let current = '';
  try {
    current = await readFile(filePath, 'utf8');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current !== content) await writeFile(filePath, content, 'utf8');
}

const dataFiles = (await readdir(projectsDirectory))
  .filter((name) => name.endsWith('.json') && !name.startsWith('_'));
const projects = [];

for (const fileName of dataFiles) {
  const project = JSON.parse(await readFile(path.join(projectsDirectory, fileName), 'utf8'));
  validate(project);
  if (fileName !== `${project.slug}.json`) {
    throw new Error(`${fileName}: file name must match slug ${project.slug}`);
  }
  projects.push(project);
}

projects.sort((a, b) =>
  b.updated.localeCompare(a.updated) ||
  (a.order ?? 999) - (b.order ?? 999) ||
  a.slug.localeCompare(b.slug)
);

const index = await readFile(indexPath, 'utf8');
const startIndex = index.indexOf(cardsStart);
const endIndex = index.indexOf(cardsEnd);
if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
  throw new Error('index.html is missing the generated project card markers');
}

const cards = projects.map(renderCard).join('\n');
const generatedIndex = `${index.slice(0, startIndex)}${cardsStart}\n${cards}\n          ${cardsEnd}${index.slice(endIndex + cardsEnd.length)}`;
await writeIfChanged(indexPath, generatedIndex);

for (const project of projects) {
  const outputDirectory = path.join(projectsDirectory, project.slug);
  await mkdir(outputDirectory, { recursive: true });
  await writeIfChanged(path.join(outputDirectory, 'index.html'), renderDetail(project));
}

console.log(`Generated ${projects.length} project card(s) and detail page(s).`);
