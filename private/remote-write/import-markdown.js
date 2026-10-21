import { unzipSync, strFromU8 } from 'fflate'
import YAML from 'yaml'
import { categories } from '../../docs/categories.js'

const allowedImage = /\.(png|jpe?g|gif|webp|avif)$/i
const fileName = (path) => path.split('/').pop()
const cleanPath = (path) => {
  const normalized = path.replace(/\\/g, '/')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').includes('..')) throw new Error('ZIP 内有不安全的文件路径。')
  return normalized.replace(/^\.\//, '')
}

export function inspectZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let p = bytes.length - 22; p >= Math.max(0, bytes.length - 65557); p--) {
    if (view.getUint32(p, true) === 0x06054b50) { end = p; break }
  }
  if (end < 0) throw new Error('ZIP 文件不完整。')
  const count = view.getUint16(end + 10, true), offset = view.getUint32(end + 16, true)
  if (count < 1 || count > 60) throw new Error('ZIP 最多包含 60 个文件。')
  let p = offset, inflated = 0
  for (let i = 0; i < count; i++) {
    if (p + 46 > end || view.getUint32(p, true) !== 0x02014b50) throw new Error('ZIP 目录无效。')
    const flags = view.getUint16(p + 8, true)
    if (flags & 1) throw new Error('不支持加密 ZIP。')
    const size = view.getUint32(p + 24, true)
    if (size === 0xffffffff) throw new Error('不支持 ZIP64 文件。')
    inflated += size
    if (inflated > 30_000_000) throw new Error('解压后内容超过 30 MB。')
    const nameLength = view.getUint16(p + 28, true), extra = view.getUint16(p + 30, true), comment = view.getUint16(p + 32, true)
    const name = strFromU8(bytes.subarray(p + 46, p + 46 + nameLength))
    cleanPath(name)
    p += 46 + nameLength + extra + comment
  }
  return { count, inflated }
}

export function parseMarkdown(text, filename = 'note.md') {
  if (text.length > 2_000_000) throw new Error('Markdown 正文不能超过 2 MB。')
  let body = text.replace(/^\uFEFF/, ''), meta = {}
  const match = body.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/)
  if (match) {
    try { meta = YAML.parse(match[1]) || {} } catch { throw new Error('Markdown 顶部 YAML 元数据格式有误。') }
    if (!meta || typeof meta !== 'object' || Array.isArray(meta)) throw new Error('YAML 元数据必须是键值对象。')
    body = body.slice(match[0].length)
  }
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const category = categories.find((item) => item.name === meta.category || item.key === meta.category)
  const slug = String(meta.slug || fileName(filename).replace(/\.markdown?$|\.md$/i, '')).replace(/[^\p{L}\p{N}_-]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 101)
  return {
    title: String(meta.title || heading || fileName(filename).replace(/\.(?:md|markdown)$/i, '')).slice(0, 200),
    key: category?.key || categories[0].key,
    slug: slug || `note-${Date.now().toString(36)}`,
    description: String(meta.description || '').slice(0, 2000),
    date: /^\d{4}-\d{2}-\d{2}$/.test(String(meta.date || '')) ? String(meta.date) : '',
    tags: Array.isArray(meta.tags) ? meta.tags.map(String).slice(0, 30) : [],
    readingTime: String(meta.readingTime || '约 8 分钟').slice(0, 80),
    body,
    warning: meta.category && !category ? '原文件的栏目不在六个栏目中，已暂选“算法”，发布前请确认。' : '',
  }
}

export function parseImport(fileNameInput, bytes) {
  const name = fileNameInput.toLowerCase()
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { note: parseMarkdown(text, fileNameInput), images: [], missing: [] }
  }
  if (!name.endsWith('.zip')) throw new Error('请选择 Markdown 或 ZIP 文件。')
  if (bytes.length > 20_000_000) throw new Error('ZIP 文件不能超过 20 MB。')
  inspectZip(bytes)
  const raw = unzipSync(bytes), entries = new Map()
  for (const [path, content] of Object.entries(raw)) {
    const safe = cleanPath(path)
    if (!safe.endsWith('/')) entries.set(safe, content)
  }
  const markdownFiles = [...entries.keys()].filter((path) => /\.(md|markdown)$/i.test(path))
  if (markdownFiles.length !== 1) throw new Error('ZIP 必须且只能包含一篇 Markdown 文件。')
  const path = markdownFiles[0], folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : ''
  const note = parseMarkdown(new TextDecoder('utf-8', { fatal: true }).decode(entries.get(path)), path)
  const images = [], missing = []
  const matcher = /!\[[^\]\n]*\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g
  for (const match of note.body.matchAll(matcher)) {
    const source = match[1]
    if (/^(?:https?:|data:|\/)/i.test(source)) continue
    let decoded
    try { decoded = decodeURIComponent(source) } catch { throw new Error(`图片路径编码无效：${source}`) }
    const resolved = cleanPath(folder + decoded)
    const content = entries.get(resolved)
    if (!content || !allowedImage.test(resolved)) { missing.push(source); continue }
    if (content.length > 4_000_000) throw new Error(`图片超过 4 MB：${resolved}`)
    images.push({ source, path: resolved, bytes: content })
  }
  return { note, images: [...new Map(images.map((image) => [image.source, image])).values()], missing }
}
