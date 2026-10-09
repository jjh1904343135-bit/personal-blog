const $ = selector => document.querySelector(selector)
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
let articles = [], media = [], categories = [], current = null, dirty = false, saving = false, automatic = false, view = 'articles', previewTimer, previewVersion = 0, previewRequest
const form = $('#article-form')
async function api(url, options = {}) {
  let response
  try { response = await fetch(url, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } }) }
  catch (e) { if (e.name === 'AbortError') throw e; throw new Error('无法连接本机后台，请确认终端仍在运行。') }
  if (response.status === 401) throw new Error('登录已失效，请刷新页面并重新输入账号密码。')
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.error || '操作失败，请刷新后重试。')
  return result
}
function notice(message, error = false) { $('#notice').textContent = message; $('#notice').classList.toggle('error', error); $('#notice').hidden = false }
function guard() { if(saving) {notice('正在保存，请稍等。');return false} return !dirty || confirm('正文还有未保存的改动。确定离开并放弃这些改动吗？') }
function setView(next) {
  if (!guard()) return false
  dirty = false; view = next
  for (const v of ['articles', 'media', 'editor']) $(`#${v}-view`).hidden = v !== next
  document.querySelectorAll('[data-view]').forEach(button => { const selected = button.dataset.view === next; button.classList.toggle('selected', selected); if(selected) button.setAttribute('aria-current','page'); else button.removeAttribute('aria-current') })
  $('#page-title').textContent = next === 'media' ? '配图管理' : next === 'editor' ? current ? '编辑文章' : '新建文章' : '文章管理'
  $('#page-description').textContent = next === 'media' ? '让复杂的技术，多一点直观的表达。' : next === 'editor' ? '记录真实思路，让读者读得明白。' : '把问题想清楚，再把经验写下来。'
  $('#create-article').hidden = next !== 'articles'; $('#upload-label').hidden = next !== 'media'; $('#notice').hidden = true
  return true
}
async function loadArticles() {
  articles = await api('/management/articles'); $('#article-list').setAttribute('aria-busy','false'); $('#nav-count').textContent = articles.length
  const selected = $('#category-filter').value
  $('#category-filter').innerHTML = '<option value="">全部栏目</option>' + categories.map(c => `<option value="${escape(c.key)}">${escape(c.name)}（${articles.filter(a => a.key === c.key).length}）</option>`).join('')
  $('#category-filter').value = selected; renderArticles()
}
function renderArticles() {
  const key = $('#category-filter').value, query = $('#article-search').value.trim().toLocaleLowerCase()
  const filtered = articles.filter(a => (!key || a.key === key) && `${a.title} ${a.description} ${a.tags.join(' ')}`.toLocaleLowerCase().includes(query))
  $('#result-count').textContent = `${filtered.length} 篇文章`
  if (!filtered.length) {
    $('#article-list').innerHTML = `<div class="empty"><h2>${query ? '没有找到匹配的文章' : '这个栏目还没有文章'}</h2><p>${query ? '试试其他关键词，或清空搜索。' : '从一个真实问题开始，写下第一篇笔记。'}</p>${query ? '<button class="secondary" id="clear-search">清空搜索</button>' : '<button class="primary" id="empty-create">新建文章</button>'}</div>`
    $('#clear-search')?.addEventListener('click', () => { $('#article-search').value = ''; renderArticles() })
    $('#empty-create')?.addEventListener('click', () => openEditor(null, key)); return
  }
  $('#article-list').innerHTML = `<table><thead><tr><th scope="col">文章</th><th scope="col">栏目</th><th scope="col">发布日期</th><th scope="col" class="tags-cell">标签</th><th scope="col">操作</th></tr></thead><tbody>${filtered.map(a => `<tr><td><button class="article-title" data-edit="${escape(a.path)}">${escape(a.title)}</button><p class="excerpt">${escape(a.description)}</p></td><td class="row-category">${escape(a.category)}</td><td class="row-date">${escape(a.date || '未填写')}</td><td class="tags-cell">${a.tags.slice(0,3).map(t => `<span class="tag">${escape(t)}</span>`).join('') || '—'}</td><td><div class="row-actions"><button data-edit="${escape(a.path)}" aria-label="编辑 ${escape(a.title)}">编辑</button><button class="delete" data-delete="${escape(a.path)}" aria-label="删除 ${escape(a.title)}">删除</button></div></td></tr>`).join('')}</tbody></table>`
}
function today() { const parts = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()); return ['year','month','day'].map(type=>parts.find(p=>p.type===type).value).join('-') }
function openEditor(article = null, key = '') {
  if (!guard()) return
  dirty = false; current = article; setView('editor'); form.reset()
  form.elements.key.innerHTML = categories.map(c=>`<option value="${escape(c.key)}">${escape(c.name)}</option>`).join('')
  for (const name of ['title','slug','description','date','readingTime','body']) form.elements[name].value = article?.[name] ?? (name === 'date' ? today() : name === 'readingTime' ? '约 8 分钟' : '')
  form.elements.key.value = article?.key || key || categories[0].key; form.elements.key.disabled = !!article; form.elements.slug.readOnly = !!article
  form.elements.tags.value = article?.tags.join('，') || ''
  $('#save-hint').textContent = article ? '已读取本机内容' : '尚未保存'; $('.writing-area').classList.remove('show-preview'); setTab(false)
  updatePreview(); form.elements.title.focus(); window.scrollTo({top:0,behavior:'instant'})
}
async function updatePreview() {
  const version = ++previewVersion; previewRequest?.abort(); previewRequest = new AbortController()
  try { const result = await api('/management/preview', {method:'POST',body:JSON.stringify({body:form.elements.body.value}),signal:previewRequest.signal}); if(version === previewVersion) $('#preview').innerHTML = result.html || '<p class="muted">正文会在这里显示为阅读效果。</p>' }
  catch (e) { if(e.name !== 'AbortError' && version === previewVersion) $('#preview').textContent = e.message }
}
function setTab(preview) { $('.writing-area').classList.toggle('show-preview', preview); for(const [id,selected] of [['tab-edit',!preview],['tab-preview',preview]]) { $(`#${id}`).classList.toggle('selected',selected); $(`#${id}`).setAttribute('aria-pressed',selected) } }
async function saveArticle(event) {
  event?.preventDefault(); if(saving || !form.reportValidity()) return
  const data = Object.fromEntries(new FormData(form)); data.key = form.elements.key.value; data.tags = data.tags.split(/[,，]/).map(t=>t.trim()).filter(Boolean); data.expectedId = current?.id
  if (!/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,100}$/u.test(data.slug) || data.slug === 'index') { notice('文件名只能使用中文、字母、数字、连字符或下划线，不能使用 index。',true); form.elements.slug.focus(); return }
  saving = true; $('#save-article').disabled = true; $('#save-article').textContent = '正在保存…'
  try { current = await api('/management/articles', {method:'POST',body:JSON.stringify(data)}); dirty = false; form.elements.key.disabled = true; form.elements.slug.readOnly = true; $('#page-title').textContent = '编辑文章'; $('#save-hint').textContent = '已保存到本机'; notice(automatic ? '保存成功。稳定 30 秒后自动检查并推送，请留意上方同步状态。' : '已保存到本机，尚未公开推送。可点击“立即同步”。'); await loadArticles() }
  catch(e) { notice(e.message,true) }
  finally { saving = false; $('#save-article').disabled = false; $('#save-article').textContent = '保存到本机' }
}
async function deleteArticle(article) {
  const dialog = $('#delete-dialog'); $('#delete-description').textContent = `“${article.title}”将从本机移除。`; dialog.returnValue = 'cancel'; dialog.showModal()
  const decision = await new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue), {once:true}))
  if(decision !== 'delete') return
  try { await api('/management/articles', {method:'DELETE',body:JSON.stringify({key:article.key,slug:article.slug,expectedId:article.id})}); await loadArticles(); notice(automatic ? '已从本机删除，自动同步会更新公开网站。' : '已从本机删除，尚未同步到公开网站。') }
  catch(e) { notice(e.message,true) }
}
async function loadMedia() { media = await api('/management/media'); renderMedia() }
function renderMedia() {
  const query = $('#media-search').value.trim().toLowerCase(), filtered = media.filter(m=>m.name.toLowerCase().includes(query))
  $('#media-list').innerHTML = filtered.length ? filtered.map(m=>`<figure class="media-item"><img src="${escape(m.url)}" alt="${escape(m.name)}" loading="lazy" /><figcaption><p>${escape(m.name)}</p><button class="secondary" data-copy="${escape(m.reference)}">复制 Markdown 引用</button></figcaption></figure>`).join('') : '<div class="empty"><h2>暂无匹配配图</h2><p>上传一张图片，或试试其他文件名。</p></div>'
}
async function upload(files) {
  const accepted = [...files]; if(!accepted.length) return
  $('#upload').disabled = true
  try {
    for(const file of accepted) {
      if(file.size > 8*1024*1024) throw new Error(`图片“${file.name}”超过 8 MB，请压缩后重试。`)
      notice(`正在上传“${file.name}”…`)
      const data = await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('无法读取图片，请重新选择。'));reader.readAsDataURL(file)})
      await api('/management/media', {method:'POST',body:JSON.stringify({name:file.name,content:data})})
    }
    await loadMedia(); notice(automatic ? '配图已保存，稍后自动同步。点击复制引用即可插入正文。' : '配图已保存到本机。点击复制引用即可插入正文。')
  } catch(e) { notice(e.message,true); await loadMedia().catch(()=>{}) }
  finally { $('#upload').disabled = false; $('#upload').value = '' }
}
async function updateState() {
  const result = await api('/management/state'); automatic = result.sync.automatic
  const {phase,message,logs} = result.sync
  const names = {idle:automatic?'自动同步已开启':'仅本机保存',waiting:'等待同步',checking:'安全检查',building:'构建验证',pushing:'推送中',pushed:'已推送，等待上线',error:'同步暂停'}
  $('#sync-badge').textContent = names[phase] || '读取状态'; $('#sync-badge').classList.toggle('error',phase === 'error'); $('#sync-message').textContent = message
  $('#sync-now').disabled = ['checking','building','pushing'].includes(phase)
  $('#sync-logs').innerHTML = logs.length ? logs.map(l=>`<li><time>${escape(new Date(l.time).toLocaleTimeString('zh-CN',{hour12:false}))}</time> ${escape(l.message)}</li>`).join('') : '<li>暂无本次运行记录。</li>'
  return result
}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',async()=>{if(setView(button.dataset.view) && view === 'media') {$('#media-list').innerHTML='<p class="loading">正在读取配图…</p>';try{await loadMedia()}catch(e){notice(e.message,true)}}}))
$('#create-article').addEventListener('click',()=>openEditor(null,$('#category-filter').value)); $('#back-to-list').addEventListener('click',()=>setView('articles'))
$('#article-search').addEventListener('input',renderArticles); $('#category-filter').addEventListener('change',renderArticles); $('#media-search').addEventListener('input',renderMedia)
$('#article-list').addEventListener('click',event=>{const edit=event.target.closest('[data-edit]'),del=event.target.closest('[data-delete]');if(edit)openEditor(articles.find(a=>a.path===edit.dataset.edit));if(del)deleteArticle(articles.find(a=>a.path===del.dataset.delete))})
form.addEventListener('submit',saveArticle); form.addEventListener('input',()=>{dirty=true;$('#save-hint').textContent='有未保存的改动';clearTimeout(previewTimer);previewTimer=setTimeout(updatePreview,400)})
$('#tab-edit').addEventListener('click',()=>setTab(false)); $('#tab-preview').addEventListener('click',()=>setTab(true))
$('#upload').addEventListener('change',event=>upload(event.target.files)); $('#drop-zone').addEventListener('dragover',event=>{event.preventDefault();$('#drop-zone').classList.add('active')}); $('#drop-zone').addEventListener('dragleave',()=>$('#drop-zone').classList.remove('active')); $('#drop-zone').addEventListener('drop',event=>{event.preventDefault();$('#drop-zone').classList.remove('active');upload(event.dataTransfer.files)})
$('#media-list').addEventListener('click',async event=>{const button=event.target.closest('[data-copy]');if(!button)return;try{await navigator.clipboard.writeText(`![配图](${button.dataset.copy})`);notice('Markdown 引用已复制，可粘贴到正文。')}catch{notice(`浏览器未允许复制，请手动复制：![配图](${button.dataset.copy})`,true)}})
$('#sync-now').addEventListener('click',async()=>{if(!confirm('将检查并公开推送本机所有待同步的文章与配图。确认继续？'))return;$('#sync-now').disabled=true;try{await api('/management/sync',{method:'POST',body:'{}'});await updateState();notice('同步检查已开始，请查看上方状态。')}catch(e){notice(e.message,true);$('#sync-now').disabled=false}})
window.addEventListener('beforeunload',event=>{if(dirty){event.preventDefault();event.returnValue=''}})
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'&&view==='editor'){event.preventDefault();saveArticle()}})
try {const result=await updateState();categories=result.categories;await loadArticles()}catch(e){notice(e.message,true);$('#article-list').innerHTML='<div class="empty"><h2>文章暂时无法读取</h2><p>确认本机后台在运行，修正问题后刷新页面。</p></div>';$('#article-list').setAttribute('aria-busy','false')}
setInterval(()=>{if(!document.hidden)updateState().catch(e=>{notice(e.message,true)})},3000)
