import { login, logout, getUser, handleAuthCallback, acceptInvite, requestPasswordRecovery, updateUser } from '@netlify/identity'
import { createNoteEditor, needsSourceMode } from '../admin/note-editor.js'
import { categories } from '../../docs/categories.js'
import { parseImport } from './import-markdown.js'
import './style.css'

const $ = (selector) => document.querySelector(selector)
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char])
const form = $('#note-form')
let posts = [], drafts = [], current = null, dirty = false, saving = null, timer = null, mode = 'rich', generation = 0, conflict = false
let signedIn = false
let accountAction = null

function notice(message, failed = false) {
  $('#notice').textContent = message
  $('#notice').classList.toggle('error', failed)
  $('#notice').hidden = false
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', ...options })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    const cause = new Error(result.error || `请求失败（${response.status}）`)
    cause.status = response.status
    throw cause
  }
  return result
}
const jsonOptions = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
const body = () => mode === 'rich' ? editor.markdown() : form.elements.body.value
const today = () => new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10)
function payload() {
  return {
    title: form.elements.title.value, key: form.elements.key.value, slug: form.elements.slug.value,
    date: form.elements.date.value, description: form.elements.description.value, readingTime: form.elements.readingTime.value,
    tags: form.elements.tags.value.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), body: body(),
  }
}
function count() { $('#word-count').textContent = `${body().replace(/\s/g, '').length.toLocaleString('zh-CN')} 字` }
function changed() {
  generation++; dirty = true; count(); $('#save-state').textContent = conflict ? '保存冲突，请导出备份' : '正在编辑…'
  clearTimeout(timer)
  if (!conflict) timer = setTimeout(() => save().catch(() => {}), 1200)
}
const editor = createNoteEditor({ element: $('#rich-editor'), onChange: changed, onSelection: () => {}, onImageFiles: async (files) => {
  for (const file of files) {
    try { editor.command('image', await uploadImage(file)) } catch (cause) { notice(cause.message, true) }
  }
} })

async function session() {
  if (accountAction) { signedIn = false; $('#login-view').hidden = true; $('#account-view').hidden = false; $('#workspace').hidden = true; $('#logout').hidden = true; return }
  const user = await getUser()
  if (!user) { signedIn = false; $('#login-view').hidden = false; $('#account-view').hidden = true; $('#workspace').hidden = true; $('#logout').hidden = true; return }
  await api('/api/write/session')
  signedIn = true; $('#login-view').hidden = true; $('#account-view').hidden = true; $('#workspace').hidden = false; $('#logout').hidden = false
  await refresh()
}
async function refresh() {
  const data = await api('/api/write/articles')
  posts = data.posts; drafts = data.drafts
  renderList()
}
function renderList() {
  const category = $('#category-filter').value, status = $('#status-filter').value
  const draftPostIds = new Set(drafts.map((item) => item.postId).filter(Boolean))
  const all = [...drafts, ...posts.filter((item) => !draftPostIds.has(item.id))]
    .filter((item) => (!category || item.key === category) && (!status || item.status === status))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
  $('#notes-list').innerHTML = all.length ? all.map((item) => `<button type="button" class="note-row" data-kind="${item.status === 'published' ? 'post' : 'draft'}" data-id="${escape(item.id)}"><span class="row-main"><small>${escape(item.category)} · ${escape(item.date || '未定日期')}</small><strong>${escape(item.title || '无标题笔记')}</strong><span>${escape(item.description || item.body.replace(/[#*`>]/g, '').slice(0, 90))}</span></span><span class="status">${item.status === 'published' ? '已发布' : item.postId ? '未发布修改' : '私有草稿'}</span></button>`).join('')
    : '<div class="empty"><h2>这里还没有笔记</h2><p>从一篇新笔记或 Markdown 文件开始。</p></div>'
}
function modeTo(next) {
  if (next === 'rich' && needsSourceMode(form.elements.body.value)) { notice('正文包含特殊语法，为避免丢失内容，请使用 Markdown 模式。', true); return }
  if (mode === 'rich' && next !== 'rich') form.elements.body.value = editor.markdown()
  if (mode !== 'rich' && next === 'rich') editor.load(form.elements.body.value)
  mode = next
  $('#rich-editor').hidden = next !== 'rich'; $('#source-editor').hidden = next !== 'source'; $('#preview').hidden = next !== 'preview'; $('#rich-toolbar').hidden = next !== 'rich'
  for (const tab of ['rich', 'source', 'preview']) $(`#${tab}-tab`).classList.toggle('active', next === tab)
  if (next === 'preview') preview()
  count()
}
function load(item = null) {
  current = item?.id ? item : null; generation++; dirty = false; conflict = false; clearTimeout(timer); form.reset()
  form.elements.title.value = item?.title || ''; form.elements.key.value = item?.key || categories[0].key
  form.elements.slug.value = item?.slug || `note-${Date.now().toString(36)}`
  form.elements.date.value = item?.date || today(); form.elements.description.value = item?.description || ''
  form.elements.tags.value = item?.tags.join('，') || ''; form.elements.readingTime.value = item?.readingTime || '约 8 分钟'
  form.elements.body.value = item?.body || ''
  $('#slug').readOnly = Boolean(item?.postId); $('#category').disabled = Boolean(item?.postId)
  mode = 'source'; if (!needsSourceMode(form.elements.body.value)) modeTo('rich'); else modeTo('source')
  $('#save-state').textContent = item ? '已载入私有草稿' : '新笔记未保存'
  $('#list-view').hidden = true; $('#editor-view').hidden = false; $('#note-title').focus(); window.scrollTo(0, 0)
}
async function save(force = false) {
  clearTimeout(timer)
  if (conflict) throw new Error('保存冲突：请先备份当前内容，再重新打开笔记。')
  if (saving) { await saving; if (dirty) return save(force); return current }
  if (!dirty && current) return current
  if (!dirty && !force) return current
  const revision = generation, data = payload()
  $('#save-state').textContent = '正在保存草稿…'
  saving = (async () => {
    try {
      const next = current ? await api(`/api/write/drafts/${current.id}`, jsonOptions('PUT', { ...data, expectedVersion: current.version }))
        : await api('/api/write/drafts', jsonOptions('POST', data))
      current = next; dirty = revision !== generation; $('#save-state').textContent = dirty ? '正在保存新改动…' : '草稿已保存 · 未发布'
      await refresh(); return next
    } catch (cause) {
      conflict = cause.status === 409
      $('#save-state').textContent = conflict ? '保存冲突 · 不会覆盖' : '保存失败 · 内容仍在页面'
      notice(`${cause.message} 请勿关闭页面，可复制或导出正文备份。`, true)
      throw cause
    } finally { saving = null }
  })()
  const result = await saving
  if (dirty) return save(force)
  return result
}
async function preview() {
  try {
    const result = await api('/api/write/preview', jsonOptions('POST', { body: form.elements.body.value }))
    $('#preview').innerHTML = result.html || '<p>正文还是空的。</p>'
  } catch (cause) { $('#preview').textContent = cause.message }
}
async function uploadImage(file) {
  const formData = new FormData(); formData.append('file', file)
  const result = await api('/api/write/media', { method: 'POST', body: formData })
  return result.url
}
async function publish() {
  try {
    await save(true)
    if (!current?.id) throw new Error('请先填写内容。')
    if (!window.confirm('确认公开发布这篇文章？发布后访客刷新页面即可看到。')) return
    $('#publish-note').disabled = true; $('#publish-note').textContent = '正在发布…'
    const result = await api(`/api/write/drafts/${current.id}/publish`, jsonOptions('POST', { expectedVersion: current.version }))
    notice(`已发布！文章地址：${result.url}`)
    current = null; $('#editor-view').hidden = true; $('#list-view').hidden = false; await refresh()
    window.open(result.url, '_blank', 'noopener')
  } catch (cause) { notice(cause.message, true) }
  finally { $('#publish-note').disabled = false; $('#publish-note').textContent = '发布文章' }
}
async function importFile(file) {
  if (dirty && !window.confirm('当前笔记有未保存改动。先保存，再导入新笔记？')) return
  if (dirty) await save(true)
  const parsed = parseImport(file.name, new Uint8Array(await file.arrayBuffer()))
  let imported = parsed.note.body
  for (const image of parsed.images) {
    const ext = image.path.split('.').pop().toLowerCase()
    const imageFile = new File([image.bytes], image.path.split('/').pop(), { type: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` })
    const url = await uploadImage(imageFile)
    imported = imported.replaceAll(`](${image.source})`, `](${url})`)
  }
  parsed.note.body = imported
  load(parsed.note)
  changed(); await save(true)
  const warning = [parsed.note.warning, parsed.missing.length ? `有 ${parsed.missing.length} 张图片未在 ZIP 中找到，请手动补充。` : '', !parsed.images.length && /!\[[^\]]*\]\((?!https?:|\/|data:)/i.test(imported) ? '文中有本地图片路径，请上传图片并替换引用。' : ''].filter(Boolean).join(' ')
  notice(`已导入私有草稿，尚未公开。${warning}`, Boolean(warning))
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault(); $('#login-message').textContent = '正在登录…'
  try { await login($('#email').value, $('#password').value); $('#password').value = ''; await session(); $('#login-message').textContent = '' }
  catch (cause) { $('#login-message').textContent = cause.status === 403 ? '此账号没有写作权限。' : `登录失败：${cause.message}` }
})
$('#forgot-password').addEventListener('click', async () => {
  const email = $('#email').value.trim()
  if (!email) { $('#login-message').textContent = '请先填写邮箱。'; $('#email').focus(); return }
  try { await requestPasswordRecovery(email); $('#login-message').textContent = '如果邮箱属于写作账号，重置邮件将发送到该邮箱。' }
  catch (cause) { $('#login-message').textContent = `发送失败：${cause.message}` }
})
$('#account-form').addEventListener('submit', async (event) => {
  event.preventDefault()
  const password = $('#new-password').value
  if (password !== $('#confirm-password').value) { $('#account-message').textContent = '两次输入的密码不一致。'; return }
  $('#account-message').textContent = '正在设置密码…'
  try {
    if (accountAction?.type === 'invite') await acceptInvite(accountAction.token, password)
    else if (accountAction?.type === 'recovery') await updateUser({ password })
    else throw new Error('链接已失效，请重新打开邮件。')
    accountAction = null; $('#new-password').value = ''; $('#confirm-password').value = ''
    await session()
  } catch (cause) { $('#account-message').textContent = `设置失败：${cause.message}` }
})
$('#logout').addEventListener('click', async () => { await logout(); current = null; await session() })
$('#new-note').addEventListener('click', () => load())
$('#back-list').addEventListener('click', async () => { try { if (dirty) await save(true); $('#editor-view').hidden = true; $('#list-view').hidden = false } catch {} })
$('#save-note').addEventListener('click', () => save(true).catch(() => {}))
$('#publish-note').addEventListener('click', publish)
$('#notes-list').addEventListener('click', async (event) => {
  const row = event.target.closest('[data-id]'); if (!row) return
  try {
    const item = row.dataset.kind === 'post' ? posts.find((post) => post.id === row.dataset.id) : drafts.find((draft) => draft.id === row.dataset.id)
    const draft = row.dataset.kind === 'post' ? await api('/api/write/drafts', jsonOptions('POST', { postId: item.id })) : item
    await refresh(); load(draft)
  } catch (cause) { notice(cause.message, true) }
})
$('#category-filter').addEventListener('change', renderList)
$('#status-filter').addEventListener('change', renderList)
form.addEventListener('input', changed)
$('#rich-tab').addEventListener('click', () => modeTo('rich'))
$('#source-tab').addEventListener('click', () => modeTo('source'))
$('#preview-tab').addEventListener('click', () => modeTo('preview'))
$('#rich-toolbar').addEventListener('click', (event) => { const button = event.target.closest('[data-command]'); if (button) editor.command(button.dataset.command, button.dataset.value) })
$('#insert-image').addEventListener('click', () => $('#image-file').click())
$('#image-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return
  try { const url = await uploadImage(file); if (mode === 'rich') editor.command('image', url); else { form.elements.body.value += `\n![文章配图](${url})\n`; changed() } notice('配图已加入私有笔记，发布后才会公开。') }
  catch (cause) { notice(cause.message, true) }
  event.target.value = ''
})
$('#import-file').addEventListener('change', async (event) => {
  const file = event.target.files[0]; if (!file) return
  try { await importFile(file) } catch (cause) { notice(`导入失败：${cause.message}`, true) }
  event.target.value = ''
})
$('#backup').addEventListener('click', async () => {
  try {
    const response = await fetch('/api/write/backup', { credentials: 'same-origin', cache: 'no-store' })
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).error || '导出失败。')
    const href = URL.createObjectURL(await response.blob()), a = document.createElement('a')
    a.href = href; a.download = 'okzu-blog-backup.zip'; a.click(); setTimeout(() => URL.revokeObjectURL(href), 60_000)
  } catch (cause) { notice(cause.message, true) }
})
document.addEventListener('keydown', (event) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && signedIn) { event.preventDefault(); save(true).catch(() => {}) } })
window.addEventListener('beforeunload', (event) => { if (dirty) { event.preventDefault(); event.returnValue = '' } })
$('#category-filter').insertAdjacentHTML('beforeend', categories.map((item) => `<option value="${item.key}">${item.name}</option>`).join(''))
$('#category').innerHTML = categories.map((item) => `<option value="${item.key}">${item.name}</option>`).join('')
;(async () => {
  try {
    const callback = await handleAuthCallback()
    if (callback?.type === 'invite' && callback.token) accountAction = callback
    if (callback?.type === 'recovery') accountAction = callback
    if (accountAction) {
      $('#account-title').textContent = accountAction.type === 'invite' ? '激活写作账号' : '重设登录密码'
      $('#account-description').textContent = accountAction.type === 'invite' ? '欢迎来到写作空间。先设置密码，之后就可以登录。' : '请为写作账号设置新的登录密码。'
    }
    await session()
  } catch (cause) { $('#login-message').textContent = `写作后台暂不可用：${cause.message}` }
})()
