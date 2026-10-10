import { createNoteEditor, needsSourceMode } from '/admin/assets/editor.js'

const $ = s => document.querySelector(s)
const escape = v => String(v ?? '').replace(/[&<>"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const form = $('#article-form')
const statusNames = {draft:'私有草稿',changed:'未发布修改',published:'已发布',pending:'待重试发布'}
let articles=[], media=[], categories=[], current=null, dirty=false, view='articles', mode='edit'
let generation=0, saveJob=null, saveTimer, composing=false, conflict=false, publishBusy=false, uploadBusy=false
let previewVersion=0, previewController, lastPhase='', website='https://okzu-blog.netlify.app'

async function api(url,options={}) {
  let response
  try {response=await fetch(url,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}})}
  catch(e){if(e.name==='AbortError')throw e;throw new Error('无法连接本机后台，请确认终端仍在运行。')}
  const result=await response.json().catch(()=>({}))
  if(!response.ok){const e=new Error(response.status===401?'登录已失效，请刷新后重新登录。':result.error||'操作失败，请重试。');e.status=response.status;throw e}
  return result
}
function notice(message,error=false){$('#notice').textContent=message;$('#notice').classList.toggle('error',error);$('#notice').hidden=false}
function body(){return mode==='source'||mode==='preview'?form.elements.body.value:note.markdown()}
function count(){$('#word-count').textContent=`${body().replace(/\s/g,'').length.toLocaleString('zh-CN')} 字`}
function changed(){
  if(publishBusy)return
  generation++;dirty=true;count();$('#save-hint').textContent=conflict?'保存冲突 · 请先导出':'正在编辑…'
  clearTimeout(saveTimer);if(!composing&&!conflict)saveTimer=setTimeout(()=>saveDraft().catch(()=>{}),1200)
}
function selection(editor){
  $('#code-tools').hidden=mode!=='edit'||!editor.isActive('codeBlock');$('#table-tools').hidden=mode!=='edit'||!editor.isActive('table')
  for(const name of ['bold','italic'])$(`[data-command="${name}"]`).setAttribute('aria-pressed',editor.isActive(name))
  $('#heading-level').value=String(editor.getAttributes('heading').level||'')
  const language=editor.getAttributes('codeBlock').language||'plaintext'
  $('#code-language').value=[...$('#code-language').options].some(o=>o.value===language)?language:'plaintext'
}
const note=createNoteEditor({element:$('#note-content'),onChange:changed,onSelection:selection,onImageFiles:files=>upload(files,true)})
function today(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());return ['year','month','day'].map(t=>parts.find(p=>p.type===t).value).join('-')}
function payload(){const data=Object.fromEntries(['title','slug','description','date','readingTime','key'].map(k=>[k,form.elements[k].value]));return {...data,body:body(),tags:form.elements.tags.value.split(/[,，]/).map(t=>t.trim()).filter(Boolean),draftId:current?.draftId,expectedId:current?.id,path:current?.path}}
function buttons(){
  $('#publish-article').textContent=publishBusy?'发布处理中…':current?.baseId?'更新发布':'发布文章'
  $('#publish-article').disabled=publishBusy||uploadBusy||conflict;$('#save-article').disabled=publishBusy||conflict
  $('#save-article').textContent=saveJob?'正在保存…':'保存草稿'
}
async function saveDraft(force=false){
  clearTimeout(saveTimer)
  if(publishBusy||composing||conflict){if(force)throw new Error('请先结束输入或解决保存冲突。');return}
  if(saveJob){await saveJob;if(dirty)return saveDraft(force);return current}
  if(!dirty&&current?.draftId)return current
  if(!dirty&&!force)return current
  const revision=generation,data=payload();$('#save-hint').textContent='正在保存草稿…'
  saveJob=(async()=>{
    try{
      const saved=await api('/management/articles',{method:'POST',body:JSON.stringify(data)})
      current=saved;dirty=generation!==revision;$('#save-hint').textContent=dirty?'正在保存新改动…':'草稿已保存 · 未发布'
      if(saved.baseId||saved.materializedId){form.elements.key.disabled=true;form.elements.slug.readOnly=true}
      await loadArticles();return saved
    }catch(e){conflict=e.status===409;$('#save-hint').textContent=conflict?'保存冲突 · 请先导出':'保存失败 · 改动仍在当前页面';notice(`${e.message} ${conflict?'可点击“导出 Markdown”备份。':'请勿关闭页面，可再次点击保存草稿。'}`,true);throw e}
    finally{saveJob=null;buttons()}
  })()
  buttons();const result=await saveJob;if(dirty)return saveDraft(force);return result
}
async function leave(){if(publishBusy||uploadBusy){notice('正在发布或上传，请稍等。');return false}try{if(dirty||saveJob)await saveDraft();return true}catch{return false}}
function showView(next){
  view=next;$('.shell').classList.toggle('editing',next==='editor');for(const v of ['articles','media','editor'])$(`#${v}-view`).hidden=v!==next
  document.querySelectorAll('[data-view]').forEach(b=>{const active=b.dataset.view===(next==='editor'?'articles':next);b.classList.toggle('selected',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})
  $('#page-title').textContent=next==='media'?'配图管理':next==='editor'?'写一篇笔记':'文章管理'
  $('#page-description').textContent=next==='editor'?'专心写下来，准备好再发布。':next==='media'?'让复杂的技术，多一点直观的表达。':'把问题想清楚，再把经验写下来。'
  $('#create-article').hidden=next!=='articles';$('#upload-label').hidden=next!=='media';$('#notice').hidden=true
}
async function loadArticles(){
  articles=await api('/management/articles');$('#article-list').setAttribute('aria-busy','false');$('#nav-count').textContent=articles.length
  const selected=$('#category-filter').value;$('#category-filter').innerHTML='<option value="">全部栏目</option>'+categories.map(c=>`<option value="${escape(c.key)}">${escape(c.name)}（${articles.filter(a=>a.key===c.key).length}）</option>`).join('');$('#category-filter').value=selected;renderArticles()
}
function renderArticles(){
  const key=$('#category-filter').value,status=$('#status-filter').value,query=$('#article-search').value.trim().toLocaleLowerCase()
  const filtered=articles.filter(a=>(!key||a.key===key)&&(!status||a.status===status)&&`${a.title} ${a.description} ${a.tags.join(' ')}`.toLocaleLowerCase().includes(query));$('#result-count').textContent=`${filtered.length} 篇笔记`
  if(!filtered.length){$('#article-list').innerHTML='<div class="empty"><h2>这里还没有匹配的笔记</h2><p>试试其他筛选条件，或点击上方“新建笔记”。</p></div>';return}
  $('#article-list').innerHTML=`<table><thead><tr><th>笔记</th><th>栏目</th><th>状态</th><th>日期</th><th>操作</th></tr></thead><tbody>${filtered.map(a=>`<tr><td><button class="article-title" data-edit="${escape(a.id)}">${escape(a.title||'无标题笔记')}</button><p class="excerpt">${escape(a.description||a.body.replace(/[#*`>]/g,'').slice(0,100))}</p></td><td class="row-category">${escape(a.category)}</td><td class="row-status"><span class="badge">${statusNames[a.status]||'私有草稿'}</span></td><td class="row-date">${escape(a.date||'未填写')}</td><td><div class="row-actions"><button data-edit="${escape(a.id)}">编辑</button>${a.baseId?`<a href="${website}/${encodeURIComponent(a.key)}/${encodeURIComponent(a.slug)}" target="_blank" rel="noopener noreferrer">查看</a>`:''}${a.draftId&&a.status!=='pending'?`<button class="delete" data-delete="${escape(a.id)}">丢弃草稿</button>`:''}</div></td></tr>`).join('')}</tbody></table>`
}
function loadCurrent(article){
  current=article;dirty=false;conflict=false;generation++;clearTimeout(saveTimer)
  form.reset();form.elements.key.innerHTML=categories.map(c=>`<option value="${escape(c.key)}">${escape(c.name)}</option>`).join('')
  for(const name of ['title','slug','description','date','readingTime','body'])form.elements[name].value=article?.[name]??(name==='date'?today():name==='readingTime'?'约 8 分钟':name==='slug'?`note-${Date.now().toString(36)}`:'')
  form.elements.key.value=article?.key||categories[0].key;form.elements.key.disabled=!!(article?.baseId||article?.materializedId);form.elements.slug.readOnly=!!(article?.baseId||article?.materializedId);form.elements.tags.value=article?.tags.join('，')||''
  const content=article?.body||'';form.elements.body.value=content;mode='source';if(!needsSourceMode(content))note.load(content)
  setMode(needsSourceMode(content)?'source':'edit')
  $('#save-hint').textContent=article?.draftId?article.status==='published'?'已发布 · 后续修改先存草稿':'已恢复本机草稿':article?'已读取公开版本 · 修改先存草稿':'开始输入后自动保存草稿'
  $('.publish-settings').open=false;count();buttons()
}
async function openEditor(article=null,key=''){if(!await leave())return;showView('editor');loadCurrent(article);if(!article&&key)form.elements.key.value=key;form.elements.title.focus();window.scrollTo({top:0,behavior:'instant'})}
function setMode(next){
  if(next==='edit'&&mode!=='edit'&&needsSourceMode(form.elements.body.value)){notice('这篇文章包含特殊语法，请继续使用 Markdown 编辑，避免丢失内容。',true);return}
  if(mode==='edit'&&next!=='edit')form.elements.body.value=note.markdown()
  if(next==='edit'&&mode!=='edit')note.load(form.elements.body.value)
  mode=next;$('#note-content').hidden=next!=='edit';$('#source-pane').hidden=next!=='source';$('#preview-pane').hidden=next!=='preview';$('#note-toolbar').hidden=next!=='edit';$('#source-warning').hidden=!needsSourceMode(form.elements.body.value)
  for(const name of ['edit','source','preview']){const b=$(`#tab-${name}`);b.classList.toggle('selected',name===next);b.setAttribute('aria-pressed',name===next)}
  selection(note.editor);if(next==='preview')updatePreview()
}
async function updatePreview(){
  const version=++previewVersion;previewController?.abort();previewController=new AbortController()
  try{const result=await api('/management/preview',{method:'POST',body:JSON.stringify({body:form.elements.body.value}),signal:previewController.signal});if(version===previewVersion)$('#preview').innerHTML=result.html||'<p class="muted">写下正文后，就能在这里预览。</p>'}
  catch(e){if(e.name!=='AbortError'&&version===previewVersion)$('#preview').textContent=e.message}
}
async function publish(){
  if(uploadBusy||publishBusy||conflict)return
  try{
    if(!form.elements.title.value.trim()||!body().trim())throw new Error('发布前请写好标题和正文。')
    if(!/^[\p{L}\p{N}][\p{L}\p{N}_-]{0,100}$/u.test(form.elements.slug.value)||form.elements.slug.value==='index'||!form.elements.date.value){$('.publish-settings').open=true;throw new Error('请检查发布设置：文件名与日期必须有效。')}
    await saveDraft(true)
    if(!confirm('将公开这篇文章及正文配图，并构建、推送到网站。其他私有草稿不会发布。确认继续？'))return
    publishBusy=true;lock(true);clearTimeout(saveTimer);buttons()
    await api('/management/publish',{method:'POST',body:JSON.stringify({draftId:current.draftId,expectedId:current.id})})
    notice('发布处理中，草稿会保留。完成后网站还需要等待 Netlify 部署。');await updateState()
  }catch(e){publishBusy=false;lock(false);buttons();notice(e.message,true)}
}
function lock(value){note.editable(!value);form.querySelectorAll('input,textarea,select').forEach(el=>{el.disabled=value});if(!value&&(current?.baseId||current?.materializedId))form.elements.key.disabled=true}
async function discard(article){
  const dialog=$('#delete-dialog');$('#delete-description').textContent=`“${article.title||'无标题笔记'}”的私有草稿将被移除。`;dialog.returnValue='cancel';dialog.showModal()
  const decision=await new Promise(resolve=>dialog.addEventListener('close',()=>resolve(dialog.returnValue),{once:true}));if(decision!=='delete')return
  try{await api('/management/articles',{method:'DELETE',body:JSON.stringify({draftId:article.draftId,expectedId:article.id})});await loadArticles();notice('已丢弃草稿，公开文章未改变。')}catch(e){notice(e.message,true)}
}
async function loadMedia(){media=await api('/management/media');renderMedia()}
function renderMedia(){
  const filtered=media.filter(m=>m.name.toLowerCase().includes($('#media-search').value.trim().toLowerCase()))
  $('#media-list').innerHTML=filtered.length?filtered.map(m=>`<figure class="media-item"><img src="${escape(m.url)}" alt="${escape(m.name)}" loading="lazy"/><figcaption><span class="muted">${m.private?'本机私有':'公开配图'}</span><p>${escape(m.name)}</p><button class="secondary" data-copy="${escape(m.reference)}">复制 Markdown 引用</button></figcaption></figure>`).join(''):'<div class="empty"><h2>暂无匹配配图</h2><p>上传图片，或换一个文件名搜索。</p></div>'
  $('#image-picker').innerHTML=media.map(m=>`<button type="button" class="image-choice" data-insert="${escape(m.reference)}"><img src="${escape(m.url)}" alt="" loading="lazy"/><span>${escape(m.name)}</span></button>`).join('')||'<p class="muted">还没有配图，先上传一张吧。</p>'
}
function insertImage(reference){if(publishBusy)return;if(mode==='source'){const el=form.elements.body;el.setRangeText(`\n![文章配图](${reference})\n`,el.selectionStart,el.selectionEnd,'end');changed();el.focus()}else{if(mode==='preview')setMode('edit');if(mode!=='edit')return;note.command('image',reference)}}
async function upload(files,insert=false){
  if(uploadBusy||publishBusy)return
  uploadBusy=true;buttons();$('#upload').disabled=true
  try{
    for(const file of [...files]){
      if(file.size>8*1024*1024)throw new Error(`图片“${file.name}”超过 8 MB，请压缩后重试。`)
      const content=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result).split(',')[1]);r.onerror=()=>reject(new Error('无法读取图片。'));r.readAsDataURL(file)})
      const result=await api('/management/media',{method:'POST',body:JSON.stringify({name:file.name,content})});if(insert)insertImage(result.reference)
    }
    await loadMedia();$('#image-dialog').close();notice(insert?'图片已插入，随草稿保存在本机。':'图片已保存在本机，发布引用它的文章时才公开。')
  }catch(e){notice(e.message,true)}finally{uploadBusy=false;$('#upload').disabled=false;$('#upload').value='';$('#insert-image').value='';buttons()}
}
async function updateState(){
  const result=await api('/management/state'),{phase,message,logs}=result.sync
  const labels={idle:'仅本机保存',waiting:'等待发布',checking:'安全检查',building:'构建验证',pushing:'推送中',pushed:'已推送，等待上线',error:'发布未完成'}
  $('.shell').classList.toggle('sync-active',phase!=='idle')
  $('#sync-badge').textContent=labels[phase]||'读取状态';$('#sync-badge').classList.toggle('error',phase==='error');$('#sync-message').textContent=message;$('#sync-now').disabled=['checking','building','pushing'].includes(phase)||publishBusy
  $('#sync-logs').innerHTML=logs.length?logs.map(l=>`<li><time>${escape(new Date(l.time).toLocaleTimeString('zh-CN',{hour12:false}))}</time> ${escape(l.message)}</li>`).join(''):'<li>暂无本次运行记录。</li>'
  if(publishBusy&&!['checking','building','pushing','waiting'].includes(phase)){
    // Read the new revision after materialization before allowing another save.
    await loadArticles();const refreshed=articles.find(a=>a.draftId===current?.draftId);publishBusy=false;lock(false);if(refreshed)loadCurrent(refreshed);buttons()
    notice(phase==='error'?'发布未完成。草稿仍保留，可修正后重新发布。':'已推送。请等 Netlify 部署完成后查看公开网站。',phase==='error')
  }else if(lastPhase&&lastPhase!==phase&&['pushed','error'].includes(phase))await loadArticles()
  lastPhase=phase;return result
}
function exportNote(){
  const data=payload(),meta=Object.fromEntries(['title','description','date','tags','readingTime'].map(k=>[k,data[k]]));meta.category=categories.find(c=>c.key===data.key)?.name
  const text=`---\n${Object.entries(meta).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${data.body}`
  const url=URL.createObjectURL(new Blob([text],{type:'text/markdown;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=`${data.slug.replace(/[^\p{L}\p{N}_-]/gu,'')||'笔记'}.md`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',async()=>{if(!await leave())return;showView(b.dataset.view);if(view==='media')loadMedia().catch(e=>notice(e.message,true))}))
$('#create-article').addEventListener('click',()=>openEditor(null,$('#category-filter').value));$('#back-to-list').addEventListener('click',async()=>{if(await leave())showView('articles')})
for(const id of ['article-search','category-filter','status-filter'])$(`#${id}`).addEventListener(id==='article-search'?'input':'change',renderArticles)
$('#article-list').addEventListener('click',e=>{const edit=e.target.closest('[data-edit]'),del=e.target.closest('[data-delete]');if(edit)openEditor(articles.find(a=>a.id===edit.dataset.edit));if(del)discard(articles.find(a=>a.id===del.dataset.delete))})
form.addEventListener('submit',e=>{e.preventDefault();saveDraft(true).catch(()=>{})});form.addEventListener('input',changed);form.addEventListener('change',e=>{if(e.target.matches('select'))changed()})
form.addEventListener('compositionstart',()=>{composing=true;clearTimeout(saveTimer)});form.addEventListener('compositionend',()=>{composing=false;changed()})
for(const name of ['edit','source','preview'])$(`#tab-${name}`).addEventListener('click',()=>setMode(name))
document.querySelectorAll('[data-command]').forEach(b=>{b.addEventListener('mousedown',e=>e.preventDefault());b.addEventListener('click',()=>{if(!publishBusy)note.command(b.dataset.command)})})
$('#heading-level').addEventListener('change',e=>note.command('heading',e.target.value));$('#code-language').addEventListener('change',e=>note.command('language',e.target.value))
$('#choose-image').addEventListener('click',async()=>{try{await loadMedia();$('#image-dialog').showModal()}catch(e){notice(e.message,true)}});$('#close-images').addEventListener('click',()=>$('#image-dialog').close())
$('#image-picker').addEventListener('click',e=>{const b=e.target.closest('[data-insert]');if(b){$('#image-dialog').close();insertImage(b.dataset.insert)}})
$('#add-link').addEventListener('click',()=>{if(publishBusy)return;$('#link-url').value=note.editor.getAttributes('link').href||'';$('#link-dialog').showModal();$('#link-url').focus()})
$('#cancel-link').addEventListener('click',()=>$('#link-dialog').close());$('#link-form').addEventListener('submit',e=>{e.preventDefault();const url=$('#link-url').value.trim();if(url&&!/^https?:\/\//i.test(url)){notice('链接仅支持 http 或 https 地址。',true);return}$('#link-dialog').close();note.command('link',url)})
$('#export-note').addEventListener('click',exportNote);$('#publish-article').addEventListener('click',publish)
$('#upload').addEventListener('change',e=>upload(e.target.files));$('#insert-image').addEventListener('change',e=>upload(e.target.files,true));$('#media-search').addEventListener('input',renderMedia)
$('#drop-zone').addEventListener('dragover',e=>{e.preventDefault();e.currentTarget.classList.add('active')});$('#drop-zone').addEventListener('dragleave',e=>e.currentTarget.classList.remove('active'));$('#drop-zone').addEventListener('drop',e=>{e.preventDefault();e.currentTarget.classList.remove('active');upload(e.dataTransfer.files)})
$('#media-list').addEventListener('click',async e=>{const b=e.target.closest('[data-copy]');if(!b)return;const text=`![文章配图](${b.dataset.copy})`;try{await navigator.clipboard.writeText(text);notice('引用已复制，可粘贴到 Markdown 正文。')}catch{notice(`请手动复制：${text}`)}})
$('#sync-now').addEventListener('click',async()=>{if(!confirm('仅重试已经进入公开目录的文章和图片，不会发布私有草稿。确认继续？'))return;try{await api('/management/sync',{method:'POST',body:'{}'});await updateState()}catch(e){notice(e.message,true)}})
window.addEventListener('beforeunload',e=>{if(dirty||saveJob||uploadBusy){e.preventDefault();e.returnValue=''}})
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'&&view==='editor'){e.preventDefault();saveDraft(true).catch(()=>{})}})
try{const result=await updateState();categories=result.categories;website=result.website;await loadArticles()}catch(e){notice(e.message,true);$('#article-list').innerHTML='<div class="empty"><h2>暂时无法读取笔记</h2><p>确认后台终端在运行，然后刷新页面。</p></div>';$('#article-list').setAttribute('aria-busy','false')}
setInterval(()=>{if(!document.hidden)updateState().catch(e=>notice(e.message,true))},3000)
