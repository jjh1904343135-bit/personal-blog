const trigger = document.querySelector('#open-search')
let overlay = null
let timer = null
let controller = null
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])
function close() { controller?.abort(); clearTimeout(timer); overlay?.remove(); overlay = null; trigger?.focus() }
function open() {
  if (overlay) return
  overlay = document.createElement('div'); overlay.className = 'search-overlay'
  overlay.innerHTML = '<section class="search-dialog" role="dialog" aria-modal="true" aria-label="搜索文章"><div class="search-controls"><input type="search" placeholder="搜索标题、摘要或正文…" aria-label="搜索文章"><button type="button" aria-label="关闭搜索">×</button></div><div class="search-results"><p>输入关键词开始搜索。</p></div></section>'
  document.body.append(overlay)
  const input = overlay.querySelector('input'), results = overlay.querySelector('.search-results')
  input.focus(); overlay.querySelector('button').addEventListener('click', close)
  overlay.addEventListener('mousedown', (event) => { if (event.target === overlay) close() })
  input.addEventListener('input', () => {
    clearTimeout(timer); controller?.abort(); const q = input.value.trim()
    if (!q) { results.innerHTML = '<p>输入关键词开始搜索。</p>'; return }
    timer = setTimeout(async () => {
      controller = new AbortController(); results.innerHTML = '<p>正在搜索…</p>'
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal, cache: 'no-store' })
        if (!response.ok) throw new Error('搜索暂不可用')
        const items = await response.json()
        results.innerHTML = items.length ? items.map((item) => `<a href="${escape(item.url)}"><small>${escape(item.category)} · ${escape(item.date)}</small><strong>${escape(item.title)}</strong><span>${escape(item.description)}</span></a>`).join('') : '<p>没有找到相关文章。</p>'
      } catch (cause) { if (cause.name !== 'AbortError') results.textContent = cause.message }
    }, 180)
  })
}
trigger?.addEventListener('click', open)
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && overlay) { event.preventDefault(); close() }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open() }
})
