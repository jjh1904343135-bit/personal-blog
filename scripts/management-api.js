import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { readdir, writeFile, realpath, lstat } from 'node:fs/promises'
import MarkdownIt from 'markdown-it'
import { categories } from '../docs/categories.js'
import { createNoteStore, NoteError } from './note-store.js'

const imagePattern = /^docs\/public\/images\/(?:[^./][^/]*\/)*[^./][^/]*\.(png|jpe?g|gif|webp|avif|svg)$/i
const markdown = new MarkdownIt({ html: false, linkify: false })
const defaultImage = markdown.renderer.rules.image
markdown.renderer.rules.image = (tokens, idx, options, env, self) => {
  const token = tokens[idx], src = token.attrGet('src') || ''
  if (src.startsWith('/images/') && imagePattern.test(`docs/public${src}`)) token.attrSet('src', `/admin/image?path=${encodeURIComponent(`docs/public${src}`)}`)
  else if (/^\/author-media\/[a-f\d]{32}\.(png|jpe?g|gif|webp|avif)$/.test(src)) token.attrSet('src', src)
  else return `<em>${markdown.utils.escapeHtml(token.content || '外部图片')}（外部图片不在本机预览中加载）</em>`
  return defaultImage(tokens, idx, options, env, self)
}
class ApiError extends Error { constructor(status, message) { super(message); this.status = status } }

export async function registerManagement(app, { root, express, username, getSyncState, syncNow }) {
  const notes = createNoteStore(root)
  await notes.init()
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
  const route = fn => async (req, res) => {
    try { await fn(req, res) } catch (e) { res.status(e.status || (e.code === 'ENOENT' ? 404 : 500)).json({ error: e instanceof ApiError || e instanceof NoteError ? e.message : e.code === 'ENOENT' ? '文件不存在，请刷新列表。' : '操作失败，请检查 Markdown 格式和本机文件权限。' }) }
  }
  app.use('/management', express.json({ limit: '15mb' }))
  app.get('/management/state', (_req, res) => res.json({ username, categories, sync: getSyncState(), website: 'https://okzu-blog.netlify.app' }))
  app.get('/management/articles', route(async (_req, res) => res.json(await notes.list())))
  app.post('/management/articles', route(async (req, res) => {
    res.json(await notes.save(req.body || {}))
  }))
  app.delete('/management/articles', route(async (req, res) => {
    await notes.discard(req.body?.draftId, req.body?.expectedId)
    res.json({ message: '已丢弃私有草稿，公开文章不受影响。' })
  }))
  app.post('/management/publish', route(async (req, res) => {
    const { draftId, expectedId } = req.body || {}
    if (!draftId || !expectedId) throw new ApiError(400, '请先保存草稿再发布。')
    const accepted = syncNow(async () => {
      const receipt = await notes.materialize(draftId, expectedId)
      return () => notes.complete(receipt)
    })
    if (!accepted) throw new ApiError(409, '已有发布任务正在运行，请等待完成。')
    res.status(202).json({ message: '发布任务已开始。草稿不会被删除，构建失败可修正后重试。' })
  }))
  app.get('/author-media/:name', route(async (req, res) => {
    if (!notes.mediaName.test(req.params.name)) throw new ApiError(403, '无效的私有图片。')
    res.set('Content-Security-Policy', "default-src 'none'; sandbox")
    res.sendFile(await notes.safe(`private/data/media/${req.params.name}`))
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
    await walk('docs/public/images')
    for (const entry of await readdir(await notes.safe('private/data/media'), {withFileTypes:true})) if (entry.isFile() && notes.mediaName.test(entry.name)) files.unshift({path:`private/data/media/${entry.name}`, name:entry.name, reference:`/author-media/${entry.name}`,url:`/author-media/${entry.name}`,private:true})
    res.json(files)
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
    const filename = `${randomBytes(16).toString('hex')}${extension}`
    await writeFile(path.join(await notes.safe('private/data/media'), filename), bytes, { flag: 'wx', mode:0o600 })
    res.json({ reference: `/author-media/${filename}`, name: filename })
  }))
  app.post('/management/sync', route(async (_req, res) => { if (!syncNow()) throw new ApiError(409, '同步任务正在运行，请等待完成。'); res.status(202).json({ message: '同步检查已开始。' }) }))
}
