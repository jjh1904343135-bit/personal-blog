import { categories } from '../../docs/categories.js'

export const categoryByKey = new Map(categories.map((item) => [item.key, item]))
export const categoryByName = new Map(categories.map((item) => [item.name, item]))
export const slugPattern = /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,100}$/u
export const mediaPattern = /^\/media\/([a-f0-9-]{36})\.(png|jpe?g|gif|webp|avif)$/i
export const noStore = { 'Cache-Control': 'no-store, max-age=0', 'Netlify-CDN-Cache-Control': 'no-store' }

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

export function json(data, status = 200) {
  return Response.json(data, { status, headers: noStore })
}

export function error(status, message) {
  return json({ error: message }, status)
}

export function metadata(row) {
  return {
    id: row.id,
    key: row.category,
    category: categoryByKey.get(row.category)?.name || '',
    slug: row.slug,
    url: `/${row.category}/${encodeURIComponent(row.slug)}`,
    title: row.title,
    description: row.description,
    date: row.article_date instanceof Date ? row.article_date.toISOString().slice(0, 10) : String(row.article_date).slice(0, 10),
    tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
    readingTime: row.reading_time,
    updatedAt: row.updated_at,
  }
}

export function validateNote(input, publishing = false) {
  if (!input || !categoryByKey.has(input.key) || typeof input.title !== 'string' || input.title.length > 200 ||
    typeof input.description !== 'string' || input.description.length > 2000 || typeof input.body !== 'string' || input.body.length > 2_000_000 ||
    typeof input.slug !== 'string' || input.slug.length > 101 || typeof input.readingTime !== 'string' || input.readingTime.length > 80 ||
    !Array.isArray(input.tags) || input.tags.length > 30 || input.tags.some((tag) => typeof tag !== 'string' || tag.length > 80)) {
    throw Object.assign(new Error('笔记字段无效，请检查内容长度与栏目。'), { status: 400 })
  }
  if (publishing && (!input.title.trim() || !input.body.trim() || !slugPattern.test(input.slug) || input.slug === 'index' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0, 10) !== input.date)) {
    throw Object.assign(new Error('发布前请填写标题、正文、有效日期与文件名。'), { status: 400 })
  }
  if (publishing && [...input.body.matchAll(/!\[[^\]\n]*\]\(([^\s)]+)/g)].some((match) => !/^(?:https?:\/\/|\/images\/|\/media\/[a-f0-9-]{36}\.(?:png|jpe?g|gif|webp|avif)$)/i.test(match[1]))) {
    throw Object.assign(new Error('正文中还有未上传的本地图片，请先替换图片路径。'), { status: 400 })
  }
}

export function mediaIds(body) {
  return [...new Set([...body.matchAll(/!\[[^\]\n]*\]\(\/media\/([a-f0-9-]{36})\.(?:png|jpe?g|gif|webp|avif)(?:\s+"[^"]*")?\)/gi)].map((match) => match[1]))]
}
