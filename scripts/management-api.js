import path from 'node:path'
import { createHash, randomBytes } from 'node:crypto'
import { readdir, readFile, writeFile, rename, unlink, realpath, lstat } from 'node:fs/promises'
import matter from 'gray-matter'
import MarkdownIt from 'markdown-it'
import { categories } from '../docs/categories.js'

const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const imagePattern = /^docs\/public\/images\/(?:[^./][^/]*\/)*[^./][^/]*\.(png|jpe?g|gif|webp|avif|svg)$/i
const markdown = new MarkdownIt({ html: false, linkify: false })
const defaultImage = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx], src = token.attrGet('src') || ''
  if (src.startsWith('/images/') && imagePattern.test(`docs/public${src}`)) token.attrSet('src', `/admin/image?path=${encodeURIComponent(`docs/public${src}`)}`)
  else return `<em>${markdown.utils.escapeHtml(token.content || '外部图片')}（外部图片不在本机预览中加载）</em>`
  return defaultImage(tokens, idx, options, env, self)
}
class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }

export function registerManagement(app, { root, express, username, getSyncState, syncNow }) {
  async function existing(file) {
    let cursor = root
    for (const part of file.split('/')) {
      cursor = path.join(cursor, part)
      if ((await lstat(cursor)).isSymbolicLink()) throw new ApiError(403, '后台不读取符号链接文件。')
    }
    const resolved = await realpath(path.join(root, file))
    const relative = path.relative(root, resolved)
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new ApiError(403, '文件不在博客目录内。')
    return resolved
  }
  const categoryFor = key => categories.find(c => c.key === key)
  function articlePath(key, slug) {
    if (!categoryFor(key) || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,100}$/u.test(slug || '') || slug === 'index') throw new ApiError(400, '请选择栏目，文件名使用中文、字母、数字或连字符，不能使用 index。')
    return `docs/${key}/${slug}.md`
  }
  function parseArticle(file, raw) {
    const parsed = matter(raw), key = file.split('/')[1], meta = parsed.data
    return { path: file, id: hash(raw), key, slug: path.basename(file, '.md'), title: String(meta.title || path.basename(file, '.md')), description: String(meta.description || ''), date: meta.date instanceof Date ? meta.date.toISOString().slice(0, 10) : String(meta.date || '').slice(0, 10), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [], readingTime: String(meta.readingTime || '约 8 分钟'), body: parsed.content, category: categoryFor(key)?.name }
  }
  const route = fn => async (req, res) => {
    try { await fn(req, res) } catch (e) { res.status(e.status || (e.code === 'ENOENT' ? 404 : 500)).json({ error: e instanceof ApiError ? e.message : e.code === 'ENOENT' ? '文件不存在，请刷新列表。' : '操作失败，请检查 Markdown 格式和本机文件权限。' }) }
  }
  app.use('/management', express.json({ limit: '15mb' }))
  app.get('/management/state', (_req, res) => res.json({ username, categories, sync: getSyncState(), website: 'https://okzu-blog-20261009-a7f3c2.netlify.app' }))
  app.get('/management/articles', route(async (_req, res) => {
    const articles = []
    for (const c of categories) {
      const folder = await existing(`docs/${c.key}`)
      for (const entry of await readdir(folder, { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
        const file = `docs/${c.key}/${entry.name}`
        articles.push(parseArticle(file, await readFile(await existing(file), 'utf8')))
      }
    }
    res.json(articles.sort((a, b) => b.date.localeCompare(a.date) || a.title.localeCompare(b.title, 'zh-CN')))
  }))
  app.post('/management/articles', route(async (req, res) => {
    const { key, slug, title, description, date, tags = [], readingTime, body, expectedId } = req.body || {}
    const file = articlePath(key, slug)
    if (typeof title !== 'string' || !title.trim() || title.length > 200 || typeof description !== 'string' || description.length > 2000 || typeof body !== 'string' || body.length > 2000000 || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date || !Array.isArray(tags) || tags.length > 30 || tags.some(t => typeof t !== 'string' || t.length > 80)) throw new ApiError(400, '请填写标题、摘要、有效日期和正文；标签最多 30 个。')
    const folder = await existing(`docs/${key}`), target = path.join(folder, `${slug}.md`)
    let previous = null
    try { previous = await readFile(await existing(file), 'utf8') } catch (e) { if (e.code !== 'ENOENT') throw e }
    if (previous !== null && (!expectedId || hash(previous) !== expectedId)) throw new ApiError(409, '文件已存在或被另一个编辑器修改，请刷新后重新编辑，避免覆盖内容。')
    if (previous === null && expectedId) throw new ApiError(409, '原文章已被删除，请刷新列表。')
    const metadata = { ...(previous ? matter(previous).data : {}), title: title.trim(), description: description.trim(), date, category: categoryFor(key).name, tags, readingTime: String(readingTime || '约 8 分钟').slice(0, 80), isIndex: false }
    const raw = matter.stringify(body, metadata)
    // New articles use exclusive creation; existing writes swap a complete file.
    if (previous === null) await writeFile(target, raw, { flag: 'wx' })
    else {
      const temp = `${target}.${randomBytes(8).toString('hex')}.tmp`
      try { await writeFile(temp, raw, { flag: 'wx' }); await rename(temp, target) }
      finally { await unlink(temp).catch(() => {}) }
    }
    res.json(parseArticle(file, raw))
  }))
  app.delete('/management/articles', route(async (req, res) => {
    const file = articlePath(req.body?.key, req.body?.slug), target = await existing(file)
    if (hash(await readFile(target)) !== req.body?.expectedId) throw new ApiError(409, '文章已发生变化，请刷新后再删除。')
    await unlink(target); res.json({ message: '已从本机删除。' })
  }))
  app.post('/management/preview', route(async (req, res) => {
    if (typeof req.body?.body !== 'string' || req.body.body.length > 2000000) throw new ApiError(400, '正文过长或格式不正确。')
    res.json({ html: markdown.render(req.body.body) })
  }))
  app.get('/management/media', route(async (_req, res) => {
    const files = []
    async function walk(folder, depth = 0) {
      if (depth > 8) return
      for (const entry of await readdir(await existing(folder), { withFileTypes: true })) {
        const file = `${folder}/${entry.name}`
        if (entry.isDirectory()) await walk(file, depth + 1)
        else if (entry.isFile() && imagePattern.test(file)) files.push({ path: file, name: entry.name, reference: `/images/${file.slice('docs/public/images/'.length)}`, url: `/admin/image?path=${encodeURIComponent(file)}` })
      }
    }
    await walk('docs/public/images'); res.json(files)
  }))
  app.get('/admin/image', route(async (req, res) => {
    if (typeof req.query.path !== 'string' || !imagePattern.test(req.query.path)) throw new ApiError(403, '只允许预览博客图片。')
    res.set('Content-Security-Policy', "default-src 'none'; sandbox")
    res.sendFile(await existing(req.query.path))
  }))
  app.post('/management/media', route(async (req, res) => {
    const { name, content } = req.body || {}, extension = path.extname(String(name)).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif'].includes(extension) || typeof content !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(content)) throw new ApiError(400, '请选择 PNG、JPG、GIF、WebP 或 AVIF 图片。')
    const bytes = Buffer.from(content, 'base64')
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) throw new ApiError(400, '图片大小应为 1 字节至 8 MB。')
    const magic = extension === '.png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : ['.jpg', '.jpeg'].includes(extension) ? bytes[0] === 255 && bytes[1] === 216 : extension === '.gif' ? /^GIF8[79]a/.test(bytes.subarray(0, 6).toString()) : extension === '.webp' ? bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' : bytes.subarray(4, 8).toString() === 'ftyp' && bytes.subarray(8, 32).toString().includes('avif')
    if (!magic) throw new ApiError(400, '文件内容与图片格式不匹配。')
    const stem = path.basename(name, extension).replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 60) || 'image'
    const filename = `${stem}-${randomBytes(4).toString('hex')}${extension}`
    await writeFile(path.join(await existing('docs/public/images'), filename), bytes, { flag: 'wx' })
    res.json({ reference: `/images/${filename}`, name: filename })
  }))
  app.post('/management/sync', route(async (_req, res) => { if (!syncNow()) throw new ApiError(409, '同步任务正在运行，请等待完成。'); res.status(202).json({ message: '同步检查已开始。' }) }))
}
