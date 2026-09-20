import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const origin = 'https://www.ailover-atlas.com';
const han = /[\u3400-\u9fff]/u;
const escapeTranslation = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
export const publicStaticPages = ['index.html', 'deepseekgui/index.html', 'deepseekgui/download/index.html', 'deepseekgui/docs/index.html', 'deepseekgui/privacy/index.html'];
export const publicScripts = ['script.js', 'script-runtime.js', 'submission.js', 'projects/detail-comments.js'];
export const pagePath = (file) => '/' + file.replace(/index\.html$/, '');

// Translate rendered copy and human-readable attributes; never identifiers or user content.
export function mapCopy(html, translate) {
  return html.split(/(<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script>|<[^>]+>)/gi).map((part) => {
    if (part.startsWith('<!--') || /^<script\b/i.test(part)) return part;
    if (part.startsWith('<')) return part.replace(/\b(alt|title|placeholder|aria-label|content)="([^"]*)"/g, (all, key, value) => `${key}="${translate(value)}"`);
    return part.replace(/^(\s*)([\s\S]*?)(\s*)$/, (_, before, text, after) => before + translate(text) + after);
  }).join('');
}

export function translationKey(text) {
  if (/^(更新|发布) \d{4}-\d{2}-\d{2}$/.test(text)) return text.slice(0, 2);
  return text;
}

export async function buildEnglish(root, projects) {
  const copy = JSON.parse(await readFile(path.join(root, 'locales/en.json'), 'utf8'));
  const ui = JSON.parse(await readFile(path.join(root, 'locales/en-ui.json'), 'utf8'));
  const names = Object.fromEntries(projects.filter(p => p.name.zh !== p.name.en).map(p => [p.name.zh, p.name.en]));
  const translate = text => {
    if (!han.test(text)) return text;
    const key = translationKey(text);
    const result = names[key] ?? copy[key];
    if (!result) throw new Error(`Missing English copy: ${key}`);
    return escapeTranslation(result) + (key === text ? '' : text.slice(2));
  };
  const files = [...publicStaticPages, ...projects.map(p => `projects/${p.slug}/index.html`)];
  for (const file of files) {
    const pathname = pagePath(file);
    let source = await readFile(path.join(root, file), 'utf8');
    const alternates = `<link rel="alternate" hreflang="zh-CN" href="${origin}${pathname}" />\n  <link rel="alternate" hreflang="en" href="${origin}/en${pathname}" />\n  <link rel="alternate" hreflang="x-default" href="${origin}${pathname}" />`;
    source = source.replace(/\s*<link rel="alternate"[^>]+>/g, '').replace('</head>', `  ${alternates}\n</head>`);
    if (!source.includes('class="language-switch"')) {
      const link = `<a class="language-switch" href="/en${pathname}" lang="en" hreflang="en" aria-label="Read this page in English">EN</a>`;
      if (file === 'index.html') source = source.replace(/(<div class="eyebrow">[\s\S]*?<\/div>)/, '$1\n          ' + link);
      else source = source.replace(/(<nav(?: [^>]*)?>)/, '$1' + link);
      source = source.replace('</head>', '  <link rel="stylesheet" href="/language.css?v=20260920" />\n  <script src="/language-switch.js?v=20260920" defer></script>\n</head>');
    }
    await writeFile(path.join(root, file), source);
    let english = mapCopy(source, translate).replace('lang="zh-CN"', 'lang="en"');
    english = english.replace(/<link rel="canonical"[^>]+>/, `<link rel="canonical" href="${origin}/en${pathname}" />`);
    english = english.replace(/<a class="language-switch"[^>]*>EN<\/a>/, `<a class="language-switch" href="${pathname}" lang="zh-CN" hreflang="zh-CN" aria-label="阅读中文版">中文</a>`);
    english = english.replace(/\b(href|src)="([^"]+)"/g, (all, attr, value) => {
      if (value.startsWith('#')) return all;
      if (/^(?:https?:|\/\/|mailto:|data:)/.test(value) || value.startsWith('/')) return all;
      const url = new URL(value, origin + pathname);
      const isPage = url.pathname.endsWith('/');
      const isScript = publicScripts.includes(url.pathname.slice(1));
      return `${attr}="${isPage || isScript ? '/en' : ''}${url.pathname}${url.search}${url.hash}"`;
    });
    english = english.replace(/<p class="project-title-en">[^<]*<\/p>/g, '');
    english = english.replace(/(<a\b[^>]*href=")(https:\/\/www\.ailover-atlas\.com)?(\/deepseekgui\/(?:download\/|docs\/|privacy\/)?)"/g, (all, start, host, target) => start.includes('language-switch') ? all : `${start}/en${target}"`);
    english = english.replace(/(<div class="clock-mark">)[\s\S]*?(<\/div>)/g, '$1✦$2');
    english = english.replace(/(<article\b[^>]*?) data-search="[^"]*"([^>]*>)([\s\S]*?)(<\/article>)/g, (_, start, end, body, close) => {
      const text = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').replaceAll('"', '&quot;');
      return `${start} data-search="${text}"${end}${body}${close}`;
    });
    const destination = path.join(root, 'en', file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, english.replace(/[\t ]+$/gm, ''));
  }
  for (const file of publicScripts) {
    let source = await readFile(path.join(root, file), 'utf8');
    for (const [from, to] of Object.entries(ui).sort((a,b) => b[0].length-a[0].length)) source = source.replaceAll(from, to);
    source = source.replaceAll("'./footer-signature.css", "'/footer-signature.css").replaceAll("'./back-to-top.css", "'/back-to-top.css").replaceAll("'./quick-filters.css", "'/quick-filters.css").replaceAll("'./honor-medals.css", "'/honor-medals.css");
    source = source.replaceAll("language: 'cn'", "language: 'en'").replaceAll("'zh-CN'", "'en'");
    source = source.replaceAll("theme: 'light',", "theme: 'light', language: 'en',");
    source = source.replaceAll('/\\.\\/projects\\/', '/\\/projects\\/');
    source = source.replace(/data\.error \|\| /g, '').replaceAll('error.message || ', '');
    const destination = path.join(root, 'en', file);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, source);
  }
  // Retired projects must disappear from both languages on the next deploy.
  const liveSlugs = new Set(projects.map(p => p.slug));
  for (const entry of await readdir(path.join(root, 'en/projects'), { withFileTypes: true })) {
    if (entry.isDirectory() && !liveSlugs.has(entry.name)) await rm(path.join(root, 'en/projects', entry.name, 'index.html'), { force: true });
  }
  return files.map(file => '/en' + pagePath(file));
}
