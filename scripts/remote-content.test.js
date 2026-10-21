import test from 'node:test'
import assert from 'node:assert/strict'
import { zipSync, strToU8 } from 'fflate'
import { parseMarkdown, parseImport, inspectZip } from '../private/remote-write/import-markdown.js'
import { categoryByKey, metadata, validateNote, mediaIds, escapeHtml } from '../netlify/lib/shared.mjs'

test('all six categories remain available', () => {
  assert.deepEqual([...categoryByKey.keys()], ['algorithms', 'agent', 'interviews', 'deployment', 'systems', 'backend'])
})

test('plain Markdown import reads frontmatter and never marks published', () => {
  const source = strToU8('---\ntitle: 测试笔记\ncategory: 后端\ntags: [Java, Redis]\n---\n# 测试笔记\n\n正文')
  const parsed = parseImport('redis.md', source)
  assert.equal(parsed.note.key, 'backend')
  assert.deepEqual(parsed.note.tags, ['Java', 'Redis'])
  assert.match(parsed.note.body, /正文/)
  assert.equal(parsed.note.slug, 'redis')
  assert.equal('published' in parsed.note, false)
})

test('bad frontmatter fails rather than silently publishing wrong metadata', () => {
  assert.throws(() => parseMarkdown('---\ntags: [broken\n---\n# Note'), /YAML/)
})

test('ZIP import finds one Markdown and its relative image', () => {
  const archive = zipSync({
    'note/post.md': strToU8('# 标题\n\n![示意](images/figure.png)'),
    'note/images/figure.png': new Uint8Array([137, 80, 78, 71]),
  })
  const inspected = inspectZip(archive)
  assert.equal(inspected.count, 2)
  const parsed = parseImport('bundle.zip', archive)
  assert.equal(parsed.images.length, 1)
  assert.equal(parsed.images[0].source, 'images/figure.png')
  assert.deepEqual(parsed.missing, [])
})

test('ZIP traversal and ambiguous Markdown are rejected', () => {
  assert.throws(() => parseImport('bad.zip', zipSync({ '../secret.md': strToU8('# Bad') })), /不安全/)
  assert.throws(() => parseImport('two.zip', zipSync({ 'a.md': strToU8('# A'), 'b.md': strToU8('# B') })), /只能包含一篇/)
})

test('published note validation, media paths and HTML escaping', () => {
  const valid = { key: 'agent', slug: 'tools', title: '工具', description: '', body: '# 工具', date: '2026-10-21', tags: [], readingTime: '约 2 分钟' }
  assert.doesNotThrow(() => validateNote(valid, true))
  assert.throws(() => validateNote({ ...valid, slug: 'index' }, true), /发布前/)
  assert.throws(() => validateNote({ ...valid, date: '2026-02-30' }, true), /发布前/)
  assert.deepEqual(mediaIds('![a](/media/123e4567-e89b-12d3-a456-426614174000.png)'), ['123e4567-e89b-12d3-a456-426614174000'])
  assert.equal(escapeHtml('<script>'), '&lt;script&gt;')
})

test('public metadata preserves legacy route and date', () => {
  const row = { id: 'x', category: 'systems', slug: 'url-to-page', title: '标题', description: '', article_date: new Date('2026-10-01T00:00:00Z'), tags: [], reading_time: '约 8 分钟', updated_at: new Date() }
  assert.equal(metadata(row).url, '/systems/url-to-page')
  assert.equal(metadata(row).date, '2026-10-01')
})
