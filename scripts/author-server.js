import 'dotenv/config'
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile, lstat } from 'node:fs/promises'
import { categories } from '../docs/categories.js'
import { createContentPublisher, SyncError } from './content-sync.js'
import { registerManagement } from './management-api.js'

// Use the Express version bundled with the installed Decap proxy.
const require = createRequire(import.meta.url)
const decapRequire = createRequire(require.resolve('decap-server/package.json'))
const express = decapRequire('express')
const { registerLocalFs } = require('decap-server/dist/middlewares.js')
const root = fileURLToPath(new URL('../', import.meta.url))
const privateRoot = path.join(root, 'private', 'admin')
const port = Number(process.env.AUTHOR_PORT || 8081)
const username = process.env.AUTHOR_USERNAME || 'okzu'
const configuredPassword = process.env.AUTHOR_PASSWORD
const password = configuredPassword || randomBytes(24).toString('base64url')

if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('AUTHOR_PORT 必须为 1024–65535 的端口。')
if (username.includes(':')) throw new Error('AUTHOR_USERNAME 不允许包含冒号。')
if (configuredPassword && configuredPassword.length < 16) throw new Error('AUTHOR_PASSWORD 至少需要 16 个字符。')

const origin = `http://127.0.0.1:${port}`
const hosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`])
const origins = new Set([...hosts].map(host => `http://${host}`))
const expected = createHash('sha256').update(`${username}:${password}`).digest()
const app = express()
app.disable('x-powered-by')

app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  res.set('X-Robots-Tag', 'noindex, nofollow')
  res.set('X-Content-Type-Options', 'nosniff')
  res.set('X-Frame-Options', 'DENY')
  res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
  if (!hosts.has(req.headers.host)) return res.sendStatus(403)
  if (req.headers.origin && !origins.has(req.headers.origin)) return res.sendStatus(403)
  if (req.headers['sec-fetch-site'] === 'cross-site') return res.sendStatus(403)
  const auth = req.headers.authorization || ''
  const supplied = auth.startsWith('Basic ') ? Buffer.from(auth.slice(6), 'base64').toString('utf8') : ''
  const digest = createHash('sha256').update(supplied).digest()
  if (!timingSafeEqual(digest, expected)) {
    res.set('WWW-Authenticate', 'Basic realm="okzu-author", charset="UTF-8"')
    return res.status(401).send('仅作者可访问，请输入写作后台账号和密码。')
  }
  next()
})

app.get(['/', '/admin', '/admin/', '/admin/index.html'], (_req, res) => {
  res.type('html').sendFile(path.join(privateRoot, 'index.html'))
})
for (const file of ['admin.css', 'admin.js', 'note-editor.js']) app.get(`/admin/${file}`, (_req, res) => res.sendFile(path.join(privateRoot, file)))
app.use('/admin/assets', express.static(path.join(privateRoot, 'assets'), {index:false, dotfiles:'deny'}))
// Existing public illustrations stay authenticated when shown in the editor.
app.use('/images', express.static(path.join(root, 'docs/public/images'), {index:false, dotfiles:'deny'}))
app.get('/admin/avatar.webp', (_req, res) => res.sendFile(path.join(root, 'docs/public/images/okzu-avatar.webp')))
let manualJob, manualController, terminalStatus
let syncState = { automatic: false, phase: 'idle', message: '草稿只保存在本机。点击发布后自动构建、推送。', logs: [] }
function updateSync(update) {
  syncState = { ...syncState, ...update }
  if (update.phase !== 'waiting') syncState.logs = [...syncState.logs, { time: new Date().toISOString(), message: update.message }].slice(-12)
}
const publisher = createContentPublisher({ root, onStatus: update => {
  if (manualJob && ['pushed', 'idle'].includes(update.phase)) {
    terminalStatus = update
    updateSync({phase:'pushing',message:'同步已完成，正在确认笔记版本…'})
  } else updateSync(update)
} })
await registerManagement(app, { root, express, username, getSyncState: () => syncState, syncNow: prepare => {
  if (manualJob || ['checking', 'building', 'pushing'].includes(syncState.phase)) return false
  manualController = new AbortController()
  terminalStatus = null
  updateSync({phase:'checking',message:'正在准备发布，草稿不会自动公开…'})
  manualJob = (async () => {
    const afterPush = prepare ? await prepare() : null
    await publisher.sync({signal:manualController.signal})
    if (afterPush) await afterPush()
    updateSync(terminalStatus || {phase:'idle',message:'同步完成，私有草稿未公开。'})
  })().catch(error => updateSync({phase:'error',message:error.status || error instanceof SyncError ? error.message : '发布未完成。草稿已保留，请检查同步记录并重试。'})).finally(() => { manualJob = null; manualController = null })
  return true
} })
app.get(['/config.yml', '/admin/config.yml'], async (_req, res, next) => {
  try {
    const config = await readFile(path.join(privateRoot, 'config.yml'), 'utf8')
    res.type('text/yaml').send(config.replace('__AUTHOR_ORIGIN__', origin))
  } catch (error) { next(error) }
})

app.use('/api/v1', express.json({ limit: '50mb' }))
const allowedActions = new Set(['info', 'entriesByFolder', 'entriesByFiles', 'getEntry', 'persistEntry', 'getMedia', 'getMediaFile', 'persistMedia', 'deleteFile', 'deleteFiles', 'getDeployPreview'])
const contentFolders = new Set(categories.map(category => `docs/${category.key}`))
const allowedPath = value => {
  if (typeof value !== 'string' || value.includes('\\') || value.split('/').some(segment => segment === '..' || segment === '.')) return false
  if (contentFolders.has(value) || value === 'docs/public/images') return true
  if (value.startsWith('docs/public/images/')) return /^docs\/public\/images\/(?:[^/]+\/)*[^/]+\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(value)
  const parent = value.slice(0, value.lastIndexOf('/'))
  return contentFolders.has(parent) && /^[^/]+\.md$/.test(value.slice(value.lastIndexOf('/') + 1))
}
function validPaths(value, mutating) {
  if (!value || typeof value !== 'object') return true
  for (const [key, child] of Object.entries(value)) {
    if (['path', 'newPath', 'folder', 'mediaFolder'].includes(key)) {
      if (!allowedPath(child) || (mutating && child.endsWith('/index.md'))) return false
    } else if (key === 'paths') {
      if (!Array.isArray(child) || child.some(item => !allowedPath(item) || item.endsWith('/index.md'))) return false
    } else if (!validPaths(child, mutating)) return false
  }
  return true
}
app.post('/api/v1', async (req, res, next) => {
  const action = req.body?.action
  const mutating = ['persistEntry', 'persistMedia', 'deleteFile', 'deleteFiles'].includes(action)
  if (!allowedActions.has(action) || !validPaths(req.body?.params, mutating)) return res.status(403).json({ error: '只允许访问博客文章和图片目录。' })
  try {
    const paths = []
    function collect(value) { if (!value || typeof value !== 'object') return; for (const [key, child] of Object.entries(value)) { if (['path','newPath','folder','mediaFolder'].includes(key)) paths.push(child); else if (key === 'paths') paths.push(...child); else collect(child) } }
    collect(req.body?.params)
    for (const file of paths) {
      let cursor = root
      for (const part of file.split('/')) {
        cursor = path.join(cursor, part)
        try { if ((await lstat(cursor)).isSymbolicLink()) return res.status(403).json({ error: '不允许访问符号链接。' }) }
        catch (e) { if (e.code === 'ENOENT') break; throw e }
      }
    }
    next()
  } catch (e) { next(e) }
})

// Force Decap to use this repository and this authenticated, same-origin API.
process.env.GIT_REPO_DIRECTORY = root
process.env.ORIGIN = origin
await registerLocalFs(app, { logLevel: 'error' })
app.use((_req, res) => res.sendStatus(404))
app.use((_error, _req, res, _next) => res.status(500).json({ error: '写作后台发生错误，请检查本机文件权限。' }))

const server = app.listen(port, '127.0.0.1', () => {
  console.log(`\n作者写作后台：${origin}/admin/`)
  console.log(`账号：${username}`)
  if (!configuredPassword) console.log(`本次临时密码：${password}`)
  console.log('仅本机可访问。密码验证同时保护页面、配置和保存接口。')
  console.log('笔记式写作：草稿自动保存到私有目录，点击发布才会推送上线。\n')
})
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 被占用，请停止旧写作后台或修改 AUTHOR_PORT。` : error.message)
  process.exitCode = 1
})
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  manualController?.abort()
  await manualJob
  server.close(() => process.exit(0))
})
