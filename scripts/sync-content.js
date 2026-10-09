import { fileURLToPath } from 'node:url'
import { createContentPublisher, startContentWatch, SyncError } from './content-sync.js'
const publisher = createContentPublisher({ root: fileURLToPath(new URL('../', import.meta.url)) })
if (process.argv.includes('--watch')) {
  const watcher = startContentWatch(publisher)
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await watcher.stop(); process.exit(0) })
} else {
  try { const result = await publisher.sync(); if (result.status === 'idle') console.log('没有待同步的文章或配图。') }
  catch (error) { console.error(error instanceof SyncError ? error.message : '同步失败，请检查本机文件权限。'); process.exitCode = 1 }
}
