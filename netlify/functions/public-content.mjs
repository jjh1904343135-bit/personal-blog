import MarkdownIt from 'markdown-it'
import { categories } from '../../docs/categories.js'
import { categoryByKey, escapeHtml, json, metadata, noStore, slugPattern } from '../lib/shared.mjs'
import { database } from '../lib/db.mjs'

const markdown = new MarkdownIt({ html: false, linkify: true, typographer: true })
const canonicalOrigin = 'https://okzu-blog.netlify.app'
markdown.renderer.rules.heading_open = (tokens, index, options, env, self) => {
  const level = Number(tokens[index].tag.slice(1)), title = tokens[index + 1]?.content || ''
  const base = title.toLowerCase().trim().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, '-') || 'section'
  const seen = env.seen || (env.seen = new Map())
  const number = (seen.get(base) || 0) + 1; seen.set(base, number)
  const id = number === 1 ? base : `${base}-${number}`
  tokens[index].attrSet('id', id)
  if (level === 2 || level === 3) (env.outline || (env.outline = [])).push({ id, title, level })
  return self.renderToken(tokens, index, options)
}
const clean = (value) => escapeHtml(value)
const shell = (title, description, main, { canonical = '', robots = 'index,follow' } = {}) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#151a23"><meta name="robots" content="${robots}">
<title>${clean(title)} · ok俎的个人博客</title><meta name="description" content="${clean(description)}">
${canonical ? `<link rel="canonical" href="${clean(canonical)}"><meta property="og:url" content="${clean(canonical)}">` : ''}
<meta property="og:type" content="article"><meta property="og:title" content="${clean(title)}"><meta property="og:description" content="${clean(description)}">
<link rel="icon" href="/images/okzu-avatar.png"><link rel="stylesheet" href="/remote-content.css"><style>.outline a{display:block;margin:12px 0;line-height:1.55;color:#a8bacb}.outline a:hover{color:#f48c87}.outline a.level-3{padding-left:12px;font-size:12px}</style></head>
<body><a class="skip" href="#main">跳到正文</a><header class="site-head"><a class="brand" href="/"><img src="/images/okzu-avatar.webp" alt=""><span><b>ok俎</b>的个人博客</span></a><nav aria-label="主要导航"><a href="/">首页</a>${categories.map((item) => `<a href="${item.path}">${clean(item.name)}</a>`).join('')}<a href="/about">关于我</a></nav><button id="open-search" type="button">搜索文章</button></header>
<main id="main">${main}</main><footer class="site-foot">© 2026 ok俎的个人博客 · 认真写作，持续更新</footer><script type="module" src="/remote-search.js"></script></body></html>`

const html = (body, status = 200) => new Response(body, { status, headers: { ...noStore, 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } })
const notFound = () => html(shell('文章未找到', '这篇文章不存在或尚未发布。', '<section class="not-found"><h1>这篇文章还没有发布</h1><p>也许地址有误，或者文章已经撤回。</p><a href="/">返回首页</a></section>', { robots: 'noindex' }), 404)
const failed = () => html(shell('暂时无法加载', '网站内容暂时无法加载。', '<section class="not-found"><h1>内容暂时无法加载</h1><p>请稍后刷新重试。</p><a href="/">返回首页</a></section>', { robots: 'noindex' }), 503)

function card(post) {
  const item = metadata(post)
  return `<a class="article-card" href="${item.url}"><div><span class="eyebrow">${clean(item.category)} / ${clean(item.date)}</span><h2>${clean(item.title)}</h2><p>${clean(item.description)}</p><div class="tags">${item.tags.map((tag) => `<span>${clean(tag)}</span>`).join('')}</div></div><span class="read-link">阅读全文 ↗</span></a>`
}

async function listPosts(db) {
  return db.sql`SELECT id, category, slug, title, description, article_date, tags, reading_time, updated_at FROM blog_posts ORDER BY article_date DESC, published_at DESC`
}

export default async function publicContent(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: noStore })
  const url = new URL(req.url)
  let path
  try { path = decodeURIComponent(url.pathname) } catch { return notFound() }
  try {
    const db = database()
    if (path === '/api/posts') return json((await listPosts(db)).map(metadata))
    if (path === '/api/search') {
      const q = (url.searchParams.get('q') || '').trim().slice(0, 100)
      if (!q) return json([])
      const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
      const rows = await db.sql`SELECT id, category, slug, title, description, article_date, tags, reading_time, updated_at
        FROM blog_posts WHERE title ILIKE ${pattern} OR description ILIKE ${pattern} OR body ILIKE ${pattern}
        ORDER BY CASE WHEN title ILIKE ${pattern} THEN 0 WHEN description ILIKE ${pattern} THEN 1 ELSE 2 END, article_date DESC LIMIT 30`
      return json(rows.map(metadata))
    }
    if (path === '/sitemap.xml') {
      const origin = canonicalOrigin
      const rows = await listPosts(db)
      const paths = ['/', '/about', ...categories.map((item) => item.path), ...rows.map((row) => metadata(row).url)]
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map((item) => `<url><loc>${clean(origin + item)}</loc></url>`).join('')}</urlset>`
      return new Response(sitemap, { headers: { ...noStore, 'Content-Type': 'application/xml; charset=utf-8' } })
    }
    const segments = path.split('/').filter(Boolean)
    const category = categoryByKey.get(segments[0])
    if (!category || segments.length > 2) return notFound()
    if (segments.length === 1) {
      const rows = await db.sql`SELECT id, category, slug, title, description, article_date, tags, reading_time, updated_at FROM blog_posts WHERE category = ${category.key} ORDER BY article_date DESC, published_at DESC`
      const main = `<section class="category-intro"><a class="crumb" href="/">← 首页</a><span class="eyebrow">技术专题 / ${clean(category.name)}</span><h1>${clean(category.name)}</h1><p>${clean(category.description)}</p><span class="count">${rows.length} 篇公开文章</span></section><section class="article-list" aria-label="文章列表">${rows.length ? rows.map(card).join('') : '<div class="empty"><h2>这个栏目暂未发布文章</h2><p>有新笔记发布后会出现在这里。</p></div>'}</section>`
      return html(shell(`${category.name}文章`, category.description, main, { canonical: canonicalOrigin + category.path }))
    }
    const slug = segments[1]
    if (!slugPattern.test(slug)) return notFound()
    const rows = await db.sql`SELECT * FROM blog_posts WHERE category = ${category.key} AND slug = ${slug} LIMIT 1`
    const post = rows[0]
    if (!post) return notFound()
    const item = metadata(post)
    const environment = {}
    const rendered = markdown.render(post.body, environment)
    const outline = environment.outline || []
    const main = `<div class="reading-layout"><article class="article"><nav class="breadcrumbs" aria-label="当前位置"><a href="/">首页</a><span>/</span><a href="${category.path}">${clean(category.name)}</a><span>/</span><span>正文</span></nav><header class="article-header"><span class="eyebrow">${clean(item.category)} · <time datetime="${item.date}">${item.date}</time> · ${clean(item.readingTime)}</span><h1>${clean(item.title)}</h1><p>${clean(item.description)}</p><div class="tags">${item.tags.map((tag) => `<span>${clean(tag)}</span>`).join('')}</div></header><div class="prose">${rendered}</div><footer class="article-end"><a href="${category.path}">← 返回${clean(category.name)}栏目</a></footer></article>${outline.length ? `<aside class="outline"><span>本文目录</span>${outline.map((heading) => `<a class="level-${heading.level}" href="#${encodeURIComponent(heading.id)}">${clean(heading.title)}</a>`).join('')}</aside>` : ''}</div>`
    return html(shell(item.title, item.description, main, { canonical: canonicalOrigin + item.url }))
  } catch (error) {
    console.error('Public content failed', error)
    return failed()
  }
}

export const config = {
  // Netlify reads this statically while bundling; computed paths are not supported here.
  path: [
    '/api/posts', '/api/search', '/sitemap.xml',
    '/algorithms', '/algorithms/', '/algorithms/:slug',
    '/agent', '/agent/', '/agent/:slug',
    '/interviews', '/interviews/', '/interviews/:slug',
    '/deployment', '/deployment/', '/deployment/:slug',
    '/systems', '/systems/', '/systems/:slug',
    '/backend', '/backend/', '/backend/:slug',
  ],
}
