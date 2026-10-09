import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

test('local preview serves pages but rejects private raw imports', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url))
  const child = spawn(process.execPath, ['node_modules/vitepress/bin/vitepress.js', 'dev', 'docs', '--host', '127.0.0.1', '--port', '18083'], {
    cwd: root, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
  })
  let ready = false
  child.stdout.on('data', chunk => { if (chunk.toString().includes('18083')) ready = true })
  child.stderr.resume()
  try {
    for (let retry = 0; retry < 100 && !ready; retry++) {
      assert.equal(child.exitCode, null, 'Preview must start successfully')
      await delay(100)
    }
    assert.ok(ready, 'Preview startup timed out')
    for (const page of ['/', '/agent/', '/interviews/', '/about']) {
      const response = await fetch(`http://127.0.0.1:18083${page}`)
      assert.equal(response.status, 200)
      assert.match(await response.text(), /id="app"/)
    }
    const fsRoot = root.replace(/\\/g, '/')
    for (const file of ['.env', '.env::$DATA', 'private/admin/admin.js', 'scripts/author-server.js']) {
      const response = await fetch(`http://127.0.0.1:18083/@fs/${fsRoot}${file}?raw`)
      // Do not print private response bodies, including on failure.
      assert.equal(response.status, 403, `Private path must be rejected: ${file}`)
      await response.arrayBuffer()
    }
  } finally {
    if (child.exitCode === null) {
      const stopped = once(child, 'exit')
      child.kill()
      await stopped
    }
  }
})
