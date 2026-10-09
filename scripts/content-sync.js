import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { lstat, open, readFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { parse } from 'dotenv'
import { categories } from '../docs/categories.js'

const execute = promisify(execFile)
const folders = categories.map(c => `docs/${c.key}`)
const roots = [...folders, 'docs/public/images']
const split = text => text.split('\0').filter(Boolean)
export class SyncError extends Error {
  constructor(message, retry = false) { super(message); this.retry = retry }
}
export function isContentPath(file) {
  if (file.includes('\\') || file.split('/').some(p => !p || p === '.' || p === '..')) return false
  const parent = file.slice(0, file.lastIndexOf('/')), name = file.slice(file.lastIndexOf('/') + 1)
  return (folders.includes(parent) && name !== 'index.md' && /^[^.][^/]*\.md$/.test(name))
    || /^docs\/public\/images\/(?:[^./][^/]*\/)*[^./][^/]*\.(png|jpe?g|gif|webp|svg|avif)$/i.test(file)
}
export function createContentPublisher({ root, remote = 'https://github.com/jjh1904343135-bit/personal-blog.git', validate, log = console.log, onStatus = () => {} }) {
  root = path.resolve(root)
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' }
  for (const k of ['GIT_INDEX_FILE', 'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR']) delete env[k]
  const emit = (phase, message) => { log(`[自动同步] ${message}`); onStatus({ phase, message, updatedAt: new Date().toISOString() }) }
  async function git(args, signal) {
    try { return (await execute('git', args, { cwd: root, env, signal, timeout: 60000, maxBuffer: 64 * 1024 * 1024, encoding: 'utf8', windowsHide: true })).stdout }
    catch { throw new SyncError('Git 操作失败，请检查网络、GitHub 登录和文件权限；不会强制推送或覆盖文件。', true) }
  }
  async function safeFile(file) {
    let current = root
    for (const part of file.split('/')) {
      current = path.join(current, part)
      try {
        const stat = await lstat(current)
        if (stat.isSymbolicLink()) throw new SyncError('文章或图片存在符号链接，自动发布已暂停。')
        if (current === path.join(root, file) && (!stat.isFile() || stat.size > 50 * 1024 * 1024)) throw new SyncError('自动发布仅接受普通文件，单文件不能超过 50 MB。')
      } catch (e) { if (e.code === 'ENOENT') return null; throw e }
    }
    return readFile(current)
  }
  async function snapshot() {
    const files = [...new Set([...split(await git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...roots])), ...split(await git(['ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', ...roots]))].filter(isContentPath))].sort()
    const hash = createHash('sha256'), data = new Map()
    for (const file of files) {
      const bytes = await safeFile(file); data.set(file, bytes)
      hash.update(file).update('\0').update(bytes ? createHash('sha256').update(bytes).digest('hex') : 'deleted').update('\0')
    }
    return { digest: hash.digest('hex'), data }
  }
  async function scanner() {
    let values = {}
    try { values = parse(await readFile(path.join(root, '.env'))) } catch (e) { if (e.code !== 'ENOENT') throw e }
    const secrets = Object.entries(values).filter(([k, v]) => /KEY|TOKEN|SECRET|PASSWORD/i.test(k) && v.length >= 8 && !/^(your_|placeholder|example)/i.test(v))
      .flatMap(([, v]) => [v, Buffer.from(v).toString('base64'), encodeURIComponent(v)])
    return bytes => {
      if (!bytes) return
      const text = bytes.toString('utf8')
      if (secrets.some(v => text.includes(v)) || /AIza[\w-]{30,}|github_pat_\w{20,}|gh[pousr]_\w{25,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)) throw new SyncError('发现疑似密钥或私钥，已暂停；请移除敏感内容后重试。')
    }
  }
  async function checkIndex(signal) {
    if (split(await git(['diff', '--cached', '--no-renames', '--name-only', '-z'], signal)).some(f => !isContentPath(f))) throw new SyncError('暂存区有文章、配图以外的改动，请先手动处理。')
    if ((await git(['diff', '--name-only', '--diff-filter=U'], signal)).trim()) throw new SyncError('存在合并冲突，请先手动解决。')
  }
  async function history(scan, signal) {
    const commits = (await git(['rev-list', 'origin/main..HEAD'], signal)).trim().split('\n').filter(Boolean)
    for (const commit of commits) {
      const files = split(await git(['diff-tree', '--root', '--no-commit-id', '--no-renames', '--name-only', '-r', '-z', commit], signal))
      if (files.some(f => !isContentPath(f))) throw new SyncError('本地有未推送的代码或配置提交，请先手动处理。')
      const existing = new Set(split(await git(['ls-tree', '-r', '--name-only', '-z', commit, '--', ...roots], signal)))
      for (const file of files.filter(f => existing.has(f))) scan(Buffer.from(await git(['show', `${commit}:${file}`], signal)))
    }
    return commits.length
  }
  async function sync({ signal } = {}) {
    let lock, lockPath
    try {
      if ((await git(['branch', '--show-current'], signal)).trim() !== 'main') throw new SyncError('请切换到 main 分支后同步。')
      const urls = (await git(['remote', 'get-url', '--push', '--all', 'origin'], signal)).trim().split('\n')
      if (urls.length !== 1 || urls[0] !== remote || (await git(['remote', 'get-url', 'origin'], signal)).trim() !== remote) throw new SyncError('origin 与博客仓库不一致，已暂停。')
      lockPath = path.resolve(root, (await git(['rev-parse', '--git-path', 'okzu-content-sync.lock'], signal)).trim())
      try { lock = await open(lockPath, 'wx') } catch (e) { if (e.code === 'EEXIST') throw new SyncError('另一个同步任务正在运行，或异常退出留下同步锁。', true); throw e }
      emit('checking', '检查 Git 状态与敏感信息…')
      await checkIndex(signal)
      await git(['fetch', '--quiet', 'origin', 'main'], signal)
      const [behind] = (await git(['rev-list', '--left-right', '--count', 'origin/main...HEAD'], signal)).trim().split(/\s+/).map(Number)
      if (behind) throw new SyncError('远程 main 有新提交，请先手动同步；不会自动拉取、变基或强推。')
      const scan = await scanner(), ahead = await history(scan, signal)
      const files = [...new Set([...split(await git(['diff', '--no-renames', '--name-only', '-z', 'HEAD', '--', ...roots], signal)), ...split(await git(['ls-files', '--others', '--exclude-standard', '-z', '--', ...roots], signal))])].filter(isContentPath).sort()
      if (!files.length && !ahead) { emit('idle', '文章和配图没有待同步的改动。'); return { status: 'idle' } }
      const before = await snapshot()
      for (const bytes of before.data.values()) scan(bytes)
      emit('building', '正在验证生产构建，成功后才会推送…')
      if (validate) await validate({ signal })
      else {
        try { await execute(process.execPath, [path.join(root, 'node_modules/vitepress/bin/vitepress.js'), 'build', 'docs'], { cwd: root, env, signal, timeout: 180000, maxBuffer: 16 * 1024 * 1024, windowsHide: true }) }
        catch { throw new SyncError('构建失败，未推送；请运行 npm run docs:build 查看问题并修正。') }
      }
      if ((await snapshot()).digest !== before.digest) throw new SyncError('构建期间内容再次变化，等待保存稳定后重新验证。', true)
      await checkIndex(signal)
      if (files.length) {
        const paths = files.map(f => `:(literal)${f}`)
        await git(['add', '--', ...paths], signal); await checkIndex(signal)
        if ((await snapshot()).digest !== before.digest) throw new SyncError('内容再次变化，等待保存稳定后重新验证。', true)
        await git(['commit', '--only', '-m', 'docs: 自动同步博客内容', '--', ...paths], signal)
      }
      await history(scan, signal)
      emit('pushing', '正在推送到 GitHub…')
      await git(['push', 'origin', 'HEAD:refs/heads/main'], signal)
      emit('pushed', '已推送。Netlify 正在自动构建，发布完成后刷新网站。')
      return { status: 'pushed', files: files.length }
    } catch (error) {
      emit('error', error instanceof SyncError ? error.message : '同步失败，请检查本机文件权限。')
      throw error
    } finally { if (lock) { await lock.close(); await unlink(lockPath) } }
  }
  return { snapshot, sync }
}
export function startContentWatch(publisher, { settleMs = 30000, pollMs = 2000, retryMs = 30000, log = console.log, onStatus = () => {} } = {}) {
  let timer, digest, due = 0, pending = true, stopped = false, task
  const controller = new AbortController()
  log(`[自动同步] 已启用：文章和配图停止变化 ${settleMs / 1000} 秒后自动公开发布。`)
  async function tick() {
    try {
      const current = await publisher.snapshot()
      if (current.digest !== digest) { digest = current.digest; due = Date.now() + settleMs; pending = true; onStatus({ phase: 'waiting', message: '等待文章与配图保存稳定后自动同步。', dueAt: due }) }
      if (pending && Date.now() >= due && !stopped) {
        pending = false
        try { await publisher.sync({ signal: controller.signal }) } catch (error) {
          if (!stopped) { pending = error instanceof SyncError && error.retry; due = Date.now() + retryMs; log(`[自动同步] ${pending ? '稍后重试。' : '已暂停本轮，修正后重新保存文章或重启。'}`) }
        }
      }
    } catch (error) { if (!stopped) { const message = error instanceof SyncError ? error.message : '无法读取文章目录，请检查权限。'; log(`[自动同步] ${message}`); onStatus({ phase: 'error', message }) } }
    finally { if (!stopped) timer = setTimeout(() => { task = tick() }, pollMs) }
  }
  task = tick()
  return { async stop() { stopped = true; clearTimeout(timer); controller.abort(); await task } }
}
