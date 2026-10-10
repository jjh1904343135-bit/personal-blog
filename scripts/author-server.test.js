import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { once } from 'node:events'
import { request } from 'node:http'
import { readFile, unlink } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

test('private author server authenticates and restricts CMS writes', async () => {
  const port = 18081
  const origin = `http://127.0.0.1:${port}`
  const password = randomBytes(24).toString('hex')
  const authorization = `Basic ${Buffer.from(`test-author:${password}`).toString('base64')}`
  const child = spawn(process.execPath, ['scripts/author-server.js'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)),
    env: { ...process.env, AUTHOR_PORT: String(port), AUTHOR_USERNAME: 'test-author', AUTHOR_PASSWORD: password },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  let output = ''
  child.stdout.on('data', data => { output += data.toString() })
  child.stderr.on('data', data => { output += data.toString() })
  const api = body => fetch(`${origin}/api/v1`, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json', origin },
    body: JSON.stringify(body)
  })
  let created = false
  let privateDraft, privateImage
  const slug = `author-verification-${randomBytes(8).toString('hex')}`
  const articlePath = `docs/algorithms/${slug}.md`
  try {
    for (let retry = 0; retry < 60 && !output.includes('作者写作后台'); retry++) {
      if (child.exitCode !== null) throw new Error(`Server exited: ${output}`)
      await delay(100)
    }
    assert.ok(output.includes('作者写作后台'), output)
    for (const route of ['/admin/', '/admin/admin.js', '/admin/admin.css', '/admin/assets/editor.js', '/admin/config.yml', '/api/v1', '/management/state', '/management/articles', '/management/media', `/author-media/${'a'.repeat(32)}.png`]) {
      const res = await fetch(`${origin}${route}`)
      assert.equal(res.status, 401, `${route} requires credentials`)
    }
    assert.equal((await fetch(`${origin}/admin/`, { headers: { authorization: 'Basic d3Jvbmc6d3Jvbmc=' } })).status, 401)
    const rebindingStatus = await new Promise((resolve, reject) => {
      const req = request(`${origin}/admin/`, { headers: { authorization, host: 'attacker.example' } }, res => {
        res.resume()
        resolve(res.statusCode)
      })
      req.on('error', reject)
      req.end()
    })
    assert.equal(rebindingStatus, 403)
    assert.equal((await fetch(`${origin}/api/v1`, { method: 'POST', headers: { authorization, origin: 'https://attacker.example', 'content-type': 'application/json' }, body: '{"action":"info"}' })).status, 403)
    const page = await fetch(`${origin}/admin/`, { headers: { authorization } })
    assert.equal(page.status, 200)
    assert.match(await page.text(), /cms-config-url/)
    const managed = await fetch(`${origin}/management/state`, {headers:{authorization}})
    assert.equal(managed.status,200);assert.equal((await managed.json()).sync.automatic,false)
    const preview = await fetch(`${origin}/management/preview`,{method:'POST',headers:{authorization,'content-type':'application/json',origin},body:JSON.stringify({body:'<script>window.bad=1</script>\n\n[bad](javascript:alert(1))\n\n# 标题'})})
    const previewData = await preview.json();assert.ok(!previewData.html.includes('<script>'));assert.ok(!previewData.html.includes('href="javascript:'));assert.match(previewData.html,/<h1>标题<\/h1>/)
    const management = (route,method,body) => fetch(`${origin}/management/${route}`,{method,headers:{authorization,'content-type':'application/json',origin},body:JSON.stringify(body)})
    const saved = await management('articles','POST',{title:'',slug:`${slug}-draft`,key:'backend',date:'',description:'',tags:[],body:'未完成私有笔记'})
    assert.equal(saved.status,200);privateDraft=await saved.json();assert.equal(privateDraft.status,'draft');assert.equal(privateDraft.path,null)
    await assert.rejects(readFile(fileURLToPath(new URL(`../docs/backend/${slug}-draft.md`,import.meta.url))),{code:'ENOENT'})
    const stale=await management('articles','POST',{...privateDraft,expectedId:'stale'});assert.equal(stale.status,409)
    const uploaded=await management('media','POST',{name:'verification.png',content:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aY1EAAAAASUVORK5CYII='})
    assert.equal(uploaded.status,200);privateImage=(await uploaded.json()).name;assert.match(privateImage,/^[a-f\d]{32}\.png$/)
    assert.equal((await fetch(`${origin}/author-media/${privateImage}`,{headers:{authorization}})).status,200)
    assert.equal((await fetch(`${origin}/author-media/${privateImage}`)).status,401)
    assert.equal((await management('publish','POST',{})).status,400)
    const config = await fetch(`${origin}/admin/config.yml`, { headers: { authorization } })
    assert.equal(config.status, 200)
    const yaml = await config.text()
    assert.ok(yaml.includes(`${origin}/api/v1`))
    for (const category of ['algorithms', 'agent', 'interviews', 'deployment', 'systems', 'backend']) {
      assert.ok(yaml.includes(`name: ${category}`))
      const entries = await api({ action: 'entriesByFolder', params: { branch: 'main', folder: `docs/${category}`, extension: 'md', depth: 1 } })
      assert.equal(entries.status, 200)
      assert.ok(Array.isArray(await entries.json()))
    }
    assert.equal((await api({ action: 'info' })).status, 200)
    for (const path of ['.env', 'private/admin/config.yml', 'docs/algorithms/../../.env']) {
      assert.equal((await api({ action: 'getEntry', params: { branch: 'main', path } })).status, 403)
    }
    const raw = '---\ntitle: 作者后台验证文章\ndescription: 临时验证\ndate: 2026-10-08\ncategory: 算法\nisIndex: false\n---\n\n# 正文\n\n验证内容。\n'
    const persist = await api({ action: 'persistEntry', params: { branch: 'main', entry: { path: articlePath, slug, raw }, assets: [], options: { commitMessage: 'Verification', useWorkflow: false, collectionName: 'algorithms', status: 'published' } } })
    assert.equal(persist.status, 200, await persist.text())
    created = true
    assert.equal(await readFile(fileURLToPath(new URL(`../${articlePath}`, import.meta.url)), 'utf8'), raw)
    assert.equal((await api({ action: 'persistEntry', params: { branch: 'main', entry: { path: 'docs/algorithms/index.md', slug: 'index', raw }, assets: [], options: { commitMessage: 'Verification', useWorkflow: false } } })).status, 403)
    assert.equal((await api({ action: 'deleteFile', params: { branch: 'main', path: '.env', options: { commitMessage: 'Verification' } } })).status, 403)
  } finally {
    if(privateDraft)assert.equal((await fetch(`${origin}/management/articles`,{method:'DELETE',headers:{authorization,origin,'content-type':'application/json'},body:JSON.stringify({draftId:privateDraft.draftId,expectedId:privateDraft.id})})).status,200)
    if(privateImage){assert.match(privateImage,/^[a-f\d]{32}\.png$/);await unlink(fileURLToPath(new URL(`../private/data/media/${privateImage}`,import.meta.url)))}
    if (created) {
      const cleanup = await api({ action: 'deleteFile', params: { branch: 'main', path: articlePath, options: { commitMessage: 'Remove temporary verification article' } } })
      assert.equal(cleanup.status, 200)
    }
    if (child.exitCode === null) {
      const stopped = once(child, 'exit')
      child.kill()
      await stopped
    }
  }
})
