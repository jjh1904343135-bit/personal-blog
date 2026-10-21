import { randomUUID } from 'node:crypto'
import { getStore, getDeployStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import { zipSync, strToU8 } from 'fflate'
import MarkdownIt from 'markdown-it'
import { categoryByKey, error, json, mediaIds, noStore, validateNote } from '../lib/shared.mjs'
import { database } from '../lib/db.mjs'

const markdown = new MarkdownIt({ html: false, linkify: false })
const mimeByExtension = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif' }
const fields = 'id, post_id, version, category, slug, title, description, body, article_date, tags, reading_time, updated_at'
const note = (row) => ({
  id: row.id, postId: row.post_id, version: row.version, key: row.category, slug: row.slug,
  title: row.title, description: row.description, body: row.body,
  date: row.article_date instanceof Date ? row.article_date.toISOString().slice(0, 10) : String(row.article_date || '').slice(0, 10),
  tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : row.tags,
  readingTime: row.reading_time, updatedAt: row.updated_at,
  category: categoryByKey.get(row.category)?.name || '', status: row.post_id ? 'changed' : 'draft',
})

function authorEmail() {
  return (Netlify.env.get('AUTHOR_EMAIL') || '').trim().toLowerCase()
}

async function authorize() {
  const email = authorEmail()
  if (!email) return error(503, '写作后台尚未配置作者邮箱。')
  const user = await getUser()
  if (!user) return error(401, '请先登录。')
  if (user.email?.trim().toLowerCase() !== email) return error(403, '此账号没有写作权限。')
  return null
}

function sameOrigin(request) {
  if (['GET', 'HEAD'].includes(request.method)) return true
  const origin = request.headers.get('origin')
  return origin === new URL(request.url).origin
}

function store(context) {
  return context.deploy?.context === 'production'
    ? getStore({ name: 'blog-media', consistency: 'strong' })
    : getDeployStore({ name: 'blog-media', consistency: 'strong' })
}

function bad(message, status = 400) { throw Object.assign(new Error(message), { status }) }
async function inputJson(request) {
  if (!request.headers.get('content-type')?.startsWith('application/json')) bad('请求格式必须为 JSON。', 415)
  const size = Number(request.headers.get('content-length') || '0')
  if (size > 3_000_000) bad('请求体过大。', 413)
  return request.json().catch(() => bad('JSON 格式无效。'))
}
function validImage(buffer, extension) {
  if (extension === 'png') return buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  if (extension === 'jpg' || extension === 'jpeg') return buffer[0] === 255 && buffer[1] === 216
  if (extension === 'gif') return /^GIF8[79]a/.test(buffer.subarray(0, 6).toString())
  if (extension === 'webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP'
  if (extension === 'avif') return buffer.subarray(4, 8).toString() === 'ftyp' && buffer.subarray(8, 32).toString().includes('avif')
  return false
}

export async function createDraft(db, data) {
  if (data.postId) {
    const posts = await db.sql`SELECT * FROM blog_posts WHERE id = ${data.postId} LIMIT 1`
    const post = posts[0]
    if (!post) bad('公开文章不存在。', 404)
    const existing = await db.sql`SELECT * FROM blog_drafts WHERE post_id = ${post.id} LIMIT 1`
    if (existing[0]) return note(existing[0])
    const id = randomUUID(), version = randomUUID()
    const rows = await db.sql`INSERT INTO blog_drafts (id, post_id, version, category, slug, title, description, body, article_date, tags, reading_time)
      VALUES (${id}, ${post.id}, ${version}, ${post.category}, ${post.slug}, ${post.title}, ${post.description}, ${post.body}, ${post.article_date}, ${JSON.stringify(post.tags)}::jsonb, ${post.reading_time}) RETURNING *`
    return note(rows[0])
  }
  validateNote(data)
  const id = randomUUID(), version = randomUUID()
  const rows = await db.sql`INSERT INTO blog_drafts (id, version, category, slug, title, description, body, article_date, tags, reading_time)
    VALUES (${id}, ${version}, ${data.key}, ${data.slug}, ${data.title}, ${data.description}, ${data.body}, ${data.date || null}, ${JSON.stringify(data.tags)}::jsonb, ${data.readingTime}) RETURNING *`
  return note(rows[0])
}

export async function saveDraft(db, id, data) {
  validateNote(data)
  if (!data.expectedVersion) bad('缺少草稿版本，请刷新后重试。', 409)
  const current = await db.sql`SELECT post_id, category, slug FROM blog_drafts WHERE id = ${id} LIMIT 1`
  if (!current[0]) bad('草稿不存在。', 404)
  if (current[0].post_id && (current[0].category !== data.key || current[0].slug !== data.slug)) bad('已发布文章的栏目和网址暂不可修改。', 409)
  const version = randomUUID()
  const rows = await db.sql`UPDATE blog_drafts SET version = ${version}, category = ${data.key}, slug = ${data.slug}, title = ${data.title},
    description = ${data.description}, body = ${data.body}, article_date = ${data.date || null}, tags = ${JSON.stringify(data.tags)}::jsonb,
    reading_time = ${data.readingTime}, updated_at = now() WHERE id = ${id} AND version = ${data.expectedVersion} RETURNING *`
  if (!rows[0]) bad('草稿已在其他窗口更新，请先导出当前内容再刷新。', 409)
  return note(rows[0])
}

export async function publish(db, id, expectedVersion) {
  const client = await db.pool.connect()
  try {
    await client.query('BEGIN')
    const { rows: drafts } = await client.query('SELECT * FROM blog_drafts WHERE id = $1 FOR UPDATE', [id])
    const draft = drafts[0]
    if (!draft) bad('草稿不存在。', 404)
    if (draft.version !== expectedVersion) bad('草稿已变化，请保存并刷新后重试。', 409)
    const data = note(draft)
    validateNote(data, true)
    const description = data.description.trim() || data.body.replace(/[#*`>\[\]()]/g, '').trim().slice(0, 150)
    const ids = mediaIds(data.body)
    if (ids.length) {
      const media = await client.query('SELECT id FROM blog_media WHERE id = ANY($1::uuid[])', [ids])
      if (media.rows.length !== ids.length) bad('正文中有未上传或无效的配图。')
    }
    let postId = draft.post_id
    if (postId) {
      await client.query(`UPDATE blog_posts SET title=$2, description=$3, body=$4, article_date=$5, tags=$6::jsonb, reading_time=$7,
        updated_at=now() WHERE id=$1`, [postId, data.title.trim(), description, data.body, data.date, JSON.stringify(data.tags), data.readingTime])
    } else {
      postId = randomUUID()
      await client.query(`INSERT INTO blog_posts (id, category, slug, title, description, body, article_date, tags, reading_time)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9)`, [postId, data.key, data.slug, data.title.trim(), description, data.body, data.date, JSON.stringify(data.tags), data.readingTime])
    }
    if (ids.length) await client.query('UPDATE blog_media SET public=true WHERE id = ANY($1::uuid[])', [ids])
    await client.query('DELETE FROM blog_drafts WHERE id=$1', [id])
    await client.query('COMMIT')
    return { url: `/${data.key}/${encodeURIComponent(data.slug)}`, postId }
  } catch (cause) {
    await client.query('ROLLBACK')
    if (cause.code === '23505') bad('此栏目已有同名文章，请修改文件名。', 409)
    throw cause
  } finally { client.release() }
}

async function backup(db, context) {
  const [posts, drafts, media] = await Promise.all([
    db.sql`SELECT * FROM blog_posts ORDER BY category, slug`,
    db.sql`SELECT * FROM blog_drafts ORDER BY updated_at DESC`,
    db.sql`SELECT id, name, mime FROM blog_media ORDER BY created_at`,
  ])
  const files = {}
  const makeMarkdown = (row) => {
    const data = note(row)
    const front = ['---', `title: ${JSON.stringify(data.title)}`, `description: ${JSON.stringify(data.description)}`, `date: ${data.date || ''}`,
      `category: ${JSON.stringify(data.category)}`, `tags: ${JSON.stringify(data.tags)}`, `readingTime: ${JSON.stringify(data.readingTime)}`, '---', '', data.body]
    return strToU8(front.join('\n'))
  }
  for (const post of posts) files[`published/${post.category}/${post.slug}.md`] = makeMarkdown({ ...post, post_id: post.id, version: '' })
  for (const draft of drafts) files[`drafts/${draft.id}.md`] = makeMarkdown(draft)
  const mediaStore = store(context)
  for (const item of media) {
    const bytes = await mediaStore.get(item.id, { type: 'arrayBuffer' })
    if (bytes) files[`media/${item.id}-${item.name.replace(/[^\w.-]/g, '_')}`] = new Uint8Array(bytes)
  }
  const zip = zipSync(files, { level: 6 })
  if (zip.length > 18_000_000) bad('备份文件过大，请联系管理员分批导出。', 413)
  return new Response(zip, { headers: { ...noStore, 'Content-Type': 'application/zip', 'Content-Disposition': 'attachment; filename="okzu-blog-backup.zip"' } })
}

export default async function writeApi(request, context) {
  if (!sameOrigin(request)) return error(403, '跨站请求被拒绝。')
  try {
    const blocked = await authorize()
    if (blocked) return blocked
    const db = database()
    const parts = new URL(request.url).pathname.slice('/api/write/'.length).split('/').filter(Boolean)
    if (request.method === 'GET' && parts[0] === 'session') return json({ email: authorEmail() })
    if (request.method === 'GET' && parts[0] === 'articles') {
      const [posts, drafts] = await Promise.all([
        db.sql`SELECT id, category, slug, title, description, body, article_date, tags, reading_time, updated_at FROM blog_posts ORDER BY updated_at DESC`,
        db.sql`SELECT * FROM blog_drafts ORDER BY updated_at DESC`,
      ])
      return json({ posts: posts.map((post) => ({ ...note({ ...post, post_id: post.id, version: '' }), status: 'published' })), drafts: drafts.map(note) })
    }
    if (request.method === 'GET' && parts[0] === 'media') {
      const rows = await db.sql`SELECT id, name, mime, public, created_at FROM blog_media ORDER BY created_at DESC`
      return json(rows.map((row) => ({ ...row, url: `/media/${row.id}.${row.name.split('.').pop().toLowerCase()}` })))
    }
    if (request.method === 'GET' && parts[0] === 'backup') return backup(db, context)
    if (request.method === 'POST' && parts[0] === 'preview') {
      const data = await inputJson(request)
      if (typeof data.body !== 'string' || data.body.length > 2_000_000) bad('正文过长。')
      return json({ html: markdown.render(data.body) })
    }
    if (request.method === 'POST' && parts[0] === 'drafts' && parts.length === 1) return json(await createDraft(db, await inputJson(request)), 201)
    if (parts[0] === 'drafts' && /^[a-f0-9-]{36}$/i.test(parts[1] || '')) {
      if (request.method === 'PUT' && parts.length === 2) return json(await saveDraft(db, parts[1], await inputJson(request)))
      if (request.method === 'DELETE' && parts.length === 2) {
        const data = await inputJson(request)
        const rows = await db.sql`DELETE FROM blog_drafts WHERE id = ${parts[1]} AND version = ${data.expectedVersion} RETURNING id`
        if (!rows.length) bad('草稿已变化，请刷新后再丢弃。', 409)
        return json({ ok: true })
      }
      if (request.method === 'POST' && parts[2] === 'publish' && parts.length === 3) {
        const data = await inputJson(request)
        return json(await publish(db, parts[1], data.expectedVersion))
      }
    }
    if (request.method === 'POST' && parts[0] === 'media' && parts.length === 1) {
      const form = await request.formData()
      const file = form.get('file')
      if (!(file instanceof File)) bad('请选择图片文件。')
      const extension = file.name.split('.').pop().toLowerCase()
      if (!mimeByExtension[extension] || file.size < 1 || file.size > 4_000_000) bad('仅支持 4 MB 以内的 PNG、JPG、GIF、WebP 或 AVIF 图片。')
      const bytes = Buffer.from(await file.arrayBuffer())
      if (!validImage(bytes, extension)) bad('图片内容与扩展名不匹配。')
      const id = randomUUID(), name = `${file.name.slice(0, 100 - extension.length - 1).replace(/\.[^.]*$/, '')}.${extension}`
      await store(context).set(id, file, { metadata: { mime: mimeByExtension[extension] } })
      await db.sql`INSERT INTO blog_media (id, name, mime) VALUES (${id}, ${name}, ${mimeByExtension[extension]})`
      return json({ id, name, url: `/media/${id}.${extension}` }, 201)
    }
    return error(404, '接口不存在。')
  } catch (cause) {
    console.error('Write API failed', cause)
    return error(cause.status || 500, cause.status ? cause.message : '操作失败，请稍后重试。')
  }
}

export const config = { path: '/api/write/*' }
