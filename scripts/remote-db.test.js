import test from 'node:test'
import assert from 'node:assert/strict'
import { NetlifyDB } from '@netlify/database-dev'
import publicContent from '../netlify/functions/public-content.mjs'
import { createDraft, saveDraft, publish } from '../netlify/functions/write-api.mjs'
import { database, closeDatabase } from '../netlify/lib/db.mjs'

test('remote content starts with legacy URLs and publishes a draft without rebuild', async () => {
  const local = new NetlifyDB()
  const connection = await local.start()
  process.env.NETLIFY_DB_URL = connection
  try {
    await local.applyMigrations('./netlify/database/migrations')
    const request = (path) => publicContent(new Request(`https://example.test${path}`))
    let response = await request('/api/posts')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0')
    const posts = await response.json()
    assert.equal(posts.length, 4)
    assert.ok(posts.some((post) => post.url === '/systems/url-to-page'))
    response = await request('/systems/url-to-page')
    assert.equal(response.status, 200)
    assert.match(await response.text(), /<h1>在地址栏按下回车后，到底发生了什么？<\/h1>/)
    response = await request('/api/search?q=DNS')
    assert.equal((await response.json()).length, 1)
    response = await request('/interviews/')
    assert.match(await response.text(), /暂未发布文章/)

    const data = { key: 'backend', slug: 'redis-notes', title: 'Redis 笔记', description: '缓存复盘', body: '# Redis 笔记\n\n缓存击穿', date: '2026-10-21', tags: ['Redis'], readingTime: '约 3 分钟' }
    const draft = await createDraft(database(), data)
    assert.equal((await (await request('/api/posts')).json()).length, 4, 'draft must stay private')
    await assert.rejects(saveDraft(database(), draft.id, { ...data, expectedVersion: '00000000-0000-0000-0000-000000000000' }), /草稿已在其他窗口更新/)
    const saved = await saveDraft(database(), draft.id, { ...data, description: '更新的摘要', expectedVersion: draft.version })
    assert.notEqual(saved.version, draft.version)
    const published = await publish(database(), draft.id, saved.version)
    assert.equal(published.url, '/backend/redis-notes')
    assert.equal((await (await request('/api/posts')).json()).length, 5)
    assert.match(await (await request(published.url)).text(), /缓存击穿/)
    assert.match(await (await request('/sitemap.xml')).text(), /backend\/redis-notes/)

    const change = await createDraft(database(), { postId: published.postId })
    await saveDraft(database(), change.id, { ...data, body: '# Redis 笔记\n\n未发布变更', expectedVersion: change.version })
    assert.doesNotMatch(await (await request(published.url)).text(), /未发布变更/)
  } finally {
    await closeDatabase()
    await local.stop()
    delete process.env.NETLIFY_DB_URL
  }
})
