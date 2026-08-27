import { RequestError, cleanPlainText } from './comments.mjs';

export const COMMUNITY_CATEGORIES = new Set([
  'relationship',
  'continuity',
  'practice',
  'creation'
]);

const textLength = (value) => [...value].length;

function validateBaseInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RequestError(400, '提交内容格式不正确。');
  }

  const content = cleanPlainText(input.content, { multiline: true });
  return { content };
}

export function validateCommunityCategory(value, { optional = false } = {}) {
  const category = cleanPlainText(value).toLowerCase();
  if (!category && optional) return '';
  if (!COMMUNITY_CATEGORIES.has(category)) throw new RequestError(400, '分区无效。');
  return category;
}

export function validateThreadId(value) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new RequestError(400, '帖子编号无效。');
  return id;
}

export function validateThreadInput(input) {
  const base = validateBaseInput(input);
  const title = cleanPlainText(input.title);
  const category = validateCommunityCategory(input.category);

  if (textLength(title) < 4 || textLength(title) > 80) {
    throw new RequestError(400, '标题需要 4–80 字。');
  }
  if (textLength(base.content) < 20 || textLength(base.content) > 4000) {
    throw new RequestError(400, '正文需要 20–4000 字。');
  }

  return { ...base, title, category };
}

export function validateReplyInput(input) {
  const base = validateBaseInput(input);
  const threadId = validateThreadId(input.threadId);
  if (textLength(base.content) < 2 || textLength(base.content) > 1500) {
    throw new RequestError(400, '回复需要 2–1500 字。');
  }
  return { ...base, threadId };
}
