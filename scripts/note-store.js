import path from 'node:path'
import { createHash, randomUUID, randomBytes } from 'node:crypto'
import { readFile, writeFile, readdir, mkdir, lstat, rename, unlink } from 'node:fs/promises'
import matter from 'gray-matter'
import { categories } from '../docs/categories.js'

const hash = data => createHash('sha256').update(data).digest('hex')
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/
const mediaName = /^[a-f\d]{32}\.(png|jpe?g|gif|webp|avif)$/
export class NoteError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export function createNoteStore(root) {
  let queue = Promise.resolve()
  const serial = action => { const job = queue.then(action); queue = job.catch(() => {}); return job }
  async function safe(file, make = false) {
    let cursor = root
    for (const [index, part] of file.split('/').entries()) {
      cursor = path.join(cursor, part)
      try {
        const stat = await lstat(cursor)
        if (stat.isSymbolicLink()) throw new NoteError(403, '私有存储不能使用符号链接。')
        if (index < file.split('/').length - 1 && !stat.isDirectory()) throw new NoteError(403, '存储目录无效。')
      } catch (e) {
        if (e.code !== 'ENOENT') throw e
        if (make) await mkdir(cursor, { mode: 0o700 })
        else throw e
      }
    }
    return cursor
  }
  async function init() {
    await safe('private/data/drafts', true)
    await safe('private/data/media', true)
  }
  const category = key => categories.find(c => c.key === key)
  const articleFile = note => {
    if (!category(note.key) || !/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,100}$/u.test(note.slug || '') || note.slug === 'index') throw new NoteError(400, '请填写有效栏目和文件名，不能使用 index。')
    return `docs/${note.key}/${note.slug}.md`
  }
  const draftFile = id => {
    if (!uuid.test(id || '')) throw new NoteError(400, '笔记编号无效。')
    return `private/data/drafts/${id}.json`
  }
  async function draft(id) { return JSON.parse(await readFile(await safe(draftFile(id)), 'utf8')) }
  async function publicRaw(file) { try { return await readFile(await safe(file), 'utf8') } catch (e) { if (e.code === 'ENOENT') return null; throw e } }
  function publicNote(file, raw) {
    const parsed = matter(raw), meta = parsed.data, key = file.split('/')[1]
    return { path: file, id: hash(raw), baseId: hash(raw), draftId: null, status: 'published', key, slug: path.basename(file, '.md'), title: String(meta.title || path.basename(file, '.md')), description: String(meta.description || ''), date: meta.date instanceof Date ? meta.date.toISOString().slice(0, 10) : String(meta.date || '').slice(0, 10), tags: Array.isArray(meta.tags) ? meta.tags.map(String) : [], readingTime: String(meta.readingTime || '约 8 分钟'), body: parsed.content, category: category(key).name }
  }
  function view(note) { return { ...note, category: category(note.key)?.name, path: note.baseId || note.materializedId ? articleFile(note) : null } }
  async function atomic(file, text, isNew = false) {
    const parent = await safe(file.slice(0, file.lastIndexOf('/'))), target = path.join(parent, path.basename(file))
    if (isNew) return writeFile(target, text, { flag: 'wx', mode: 0o600 })
    await safe(file)
    const temp = `${target}.${randomBytes(8).toString('hex')}.tmp`
    try { await writeFile(temp, text, { flag: 'wx', mode: 0o600 }); await rename(temp, target) }
    finally { await unlink(temp).catch(() => {}) }
  }
  async function persist(note, isNew = false) {
    note.id = randomUUID(); note.updatedAt = new Date().toISOString()
    await atomic(draftFile(note.draftId), JSON.stringify(note, null, 2), isNew)
    return view(note)
  }
  async function list() {
    await init()
    const published = []
    for (const c of categories) {
      for (const entry of await readdir(await safe(`docs/${c.key}`), { withFileTypes: true })) if (entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md') {
        const file = `docs/${c.key}/${entry.name}`
        published.push(publicNote(file, await publicRaw(file)))
      }
    }
    const drafts = []
    for (const entry of await readdir(await safe('private/data/drafts'), { withFileTypes: true })) if (entry.isFile() && uuid.test(entry.name.replace(/\.json$/, '')) && entry.name.endsWith('.json')) drafts.push(view(await draft(entry.name.slice(0, -5))))
    const paths = new Set(drafts.filter(n => n.path).map(n => n.path))
    return [...drafts, ...published.filter(n => !paths.has(n.path))].sort((a,b) => (b.updatedAt || b.date).localeCompare(a.updatedAt || a.date))
  }
  function validate(input, publishing = false) {
    if (!category(input.key) || typeof input.title !== 'string' || input.title.length > 200 || typeof input.description !== 'string' || input.description.length > 2000 || typeof input.body !== 'string' || input.body.length > 2000000 || !Array.isArray(input.tags) || input.tags.length > 30 || input.tags.some(t => typeof t !== 'string' || t.length > 80)) throw new NoteError(400, '笔记字段无效，请缩短正文或检查标签。')
    if (publishing) {
      articleFile(input)
      if (!input.title.trim() || !input.body.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(input.date || '') || !Number.isFinite(Date.parse(input.date)) || new Date(input.date).toISOString().slice(0,10) !== input.date) throw new NoteError(400, '发布前请填写标题、正文、文件名和有效日期。')
    }
  }
  const save = input => serial(async () => {
    await init(); validate(input)
    const previous = input.draftId ? await draft(input.draftId) : null
    if (previous && previous.id !== input.expectedId) throw new NoteError(409, '草稿在其他窗口中发生变化。请先导出当前正文，再刷新重新编辑。')
    if ((previous?.baseId || previous?.materializedId) && (input.key !== previous.key || input.slug !== previous.slug)) throw new NoteError(409, '已进入发布流程的文章，栏目和文件名不能在编辑中更改。')
    let baseId = previous?.baseId || null
    if (!previous && input.path) {
      const file = articleFile(input)
      if (file !== input.path) throw new NoteError(400, '文章路径与栏目不一致。')
      const raw = await publicRaw(file)
      if (!raw || hash(raw) !== input.expectedId) throw new NoteError(409, '公开文章已被修改，请刷新后重新编辑。')
      for (const entry of await readdir(await safe('private/data/drafts'))) {
        if (!entry.endsWith('.json') || !uuid.test(entry.slice(0,-5))) continue
        const existing = await draft(entry.slice(0,-5))
        if ((existing.baseId || existing.materializedId) && existing.key === input.key && existing.slug === input.slug) throw new NoteError(409, '这篇文章已有本机草稿，请刷新列表后编辑草稿。')
      }
      baseId = hash(raw)
    }
    const note = { ...(previous || {}), draftId: previous?.draftId || randomUUID(), baseId, title: input.title, key: input.key, slug: input.slug || '', description: input.description, date: String(input.date || ''), tags: input.tags, readingTime: String(input.readingTime || '约 8 分钟').slice(0,80), body: input.body, status: baseId ? 'changed' : 'draft' }
    return persist(note, !previous)
  })
  const materialize = (id, expectedId) => serial(async () => {
    const note = await draft(id)
    if (note.id !== expectedId) throw new NoteError(409, '草稿已经更新，请等待保存完成后再发布。')
    validate(note, true)
    const file = articleFile(note), old = await publicRaw(file)
    if (old !== null && hash(old) !== note.baseId && hash(old) !== note.materializedId) throw new NoteError(409, '同名文章已存在或被修改，不会覆盖。请修改文件名或刷新。')
    if (old === null && note.baseId && !note.materializedId) throw new NoteError(409, '原文章已被删除，请刷新后检查。')
    let body = note.body
    const images = [...new Set([...body.matchAll(/!\[[^\]\n]*\]\((\/author-media\/([a-f\d]{32}\.(?:png|jpe?g|gif|webp|avif)))(?:\s+"[^"]*")?\)/g)].map(m => m[2]))]
    for (const name of images) {
      const bytes = await readFile(await safe(`private/data/media/${name}`))
      const target = `docs/public/images/note-${name}`
      let actual = null
      try { actual = await readFile(await safe(target)) } catch (e) { if (e.code !== 'ENOENT') throw e }
      if (actual === null) await atomic(target, bytes, true)
      else if (!actual.equals(bytes)) throw new NoteError(409, '目标配图有同名冲突。')
      body = body.replaceAll(`/author-media/${name}`, `/images/note-${name}`)
    }
    if (body.includes('/author-media/')) throw new NoteError(400, '存在无效的私有配图引用，请重新插入图片。')
    const metadata = { ...(old ? matter(old).data : {}), title: note.title.trim(), description: note.description.trim() || note.body.replace(/[#*`>]/g,'').trim().slice(0,120), date: note.date, category: category(note.key).name, tags: note.tags, readingTime: note.readingTime, isIndex: false }
    const raw = matter.stringify(body, metadata)
    await atomic(file, raw, old === null)
    note.materializedId = hash(raw); note.status = 'pending'
    const result = await persist(note)
    return { note: result, body, path: file, materializedId: hash(raw) }
  })
  const complete = receipt => serial(async () => {
    const note = await draft(receipt.note.draftId)
    // A concurrent edit is retained as a private change, never discarded.
    const changed = note.id !== receipt.note.id
    note.baseId = receipt.materializedId; delete note.materializedId
    note.status = changed ? 'changed' : 'published'
    if (!changed) note.body = receipt.body
    return persist(note)
  })
  const discard = (id, expectedId) => serial(async () => {
    const note = await draft(id)
    if (note.id !== expectedId) throw new NoteError(409, '草稿已变化，请刷新后再操作。')
    if (note.status === 'pending') throw new NoteError(409, '这篇笔记已有发布待同步，请先重试发布，不能直接丢弃。')
    await unlink(await safe(draftFile(id)))
  })
  return { init, list, save, materialize, complete, discard, safe, mediaName }
}
