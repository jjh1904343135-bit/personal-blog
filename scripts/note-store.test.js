import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises'
import { createNoteStore } from './note-store.js'
import { categories } from '../docs/categories.js'

const input = (extra={}) => ({title:'Redis 缓存笔记',key:'backend',slug:'redis-notes',description:'缓存与一致性',date:'2026-10-10',tags:['Redis'],readingTime:'约 5 分钟',body:'# 缓存\n\n```java\nreturn cache.get(key);\n```\n',...extra})
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(),'okzu-note-test-'))
  t.after(async()=>{assert.ok(path.basename(root).startsWith('okzu-note-test-'));await rm(root,{recursive:true,force:true})})
  for(const c of categories) await mkdir(path.join(root,'docs',c.key),{recursive:true})
  await mkdir(path.join(root,'docs/public/images'),{recursive:true})
  const store=createNoteStore(root);await store.init();return {root,store}
}
test('incomplete drafts survive restart and never enter public docs',async t=>{
  const {root,store}=await fixture(t)
  const saved=await store.save(input({title:'',slug:'',date:'',body:'正在写…'}))
  assert.equal(saved.status,'draft');assert.equal(saved.path,null)
  assert.equal((await readdir(path.join(root,'docs/backend'))).length,0)
  const restored=(await createNoteStore(root).list())[0];assert.equal(restored.body,'正在写…')
  await assert.rejects(store.materialize(saved.draftId,saved.id),{status:400})
  await store.discard(saved.draftId,saved.id);assert.equal((await store.list()).length,0)
})
test('published edits stay private, reject stale windows, preserve metadata',async t=>{
  const {root,store}=await fixture(t)
  const file=path.join(root,'docs/backend/redis-notes.md')
  const original='---\ntitle: Redis\ndate: 2026-10-10\ncustomFlag: preserve-me\n---\n\n公开原文\n'
  await writeFile(file,original)
  const old=(await store.list())[0]
  const edited=await store.save(input({path:old.path,expectedId:old.id}))
  assert.equal(edited.status,'changed');assert.equal(await readFile(file,'utf8'),original)
  await assert.rejects(store.save(input({path:old.path,expectedId:old.id})),{status:409})
  await assert.rejects(store.save(input({draftId:edited.draftId,expectedId:'stale'})),{status:409})
  await assert.rejects(store.save(input({draftId:edited.draftId,expectedId:edited.id,slug:'other'})),{status:409})
  const receipt=await store.materialize(edited.draftId,edited.id)
  assert.match(await readFile(file,'utf8'),/customFlag: preserve-me/)
  const complete=await store.complete(receipt);assert.equal(complete.status,'published');assert.equal((await store.list()).length,1)
})
test('publication copies only referenced private pictures and supports retries',async t=>{
  const {root,store}=await fixture(t)
  const name=`${'a'.repeat(32)}.png`,unused=`${'b'.repeat(32)}.png`, bytes=Buffer.from([137,80,78,71,13,10,26,10,1,2])
  for(const filename of [name,unused])await writeFile(path.join(root,'private/data/media',filename),bytes)
  let saved=await store.save(input({body:`![配图](/author-media/${name})`}))
  assert.deepEqual(await readdir(path.join(root,'docs/public/images')),[])
  let receipt=await store.materialize(saved.draftId,saved.id)
  assert.deepEqual(await readdir(path.join(root,'docs/public/images')),[`note-${name}`]);assert.ok(receipt.body.includes(`/images/note-${name}`))
  await assert.rejects(store.discard(receipt.note.draftId,receipt.note.id),{status:409})
  await assert.rejects(store.save(input({draftId:receipt.note.draftId,expectedId:receipt.note.id,slug:'moved'})),{status:409})
  receipt=await store.materialize(receipt.note.draftId,receipt.note.id)
  saved=await store.complete(receipt);assert.equal(saved.status,'published');assert.ok(!saved.body.includes('/author-media/'))
})
test('concurrent private changes are retained when a publication finishes',async t=>{
  const {store}=await fixture(t)
  const saved=await store.save(input()),receipt=await store.materialize(saved.draftId,saved.id)
  await store.save(input({draftId:saved.draftId,expectedId:receipt.note.id,body:'更晚的私有修改'}))
  const complete=await store.complete(receipt)
  assert.equal(complete.body,'更晚的私有修改');assert.equal(complete.status,'changed')
})
test('invalid IDs, collisions and external changes cannot overwrite public content',async t=>{
  const {root,store}=await fixture(t)
  await assert.rejects(store.discard('../../.env','id'),{status:400})
  const saved=await store.save(input()),file=path.join(root,'docs/backend/redis-notes.md')
  await writeFile(file,'其他人的同名文章')
  await assert.rejects(store.materialize(saved.draftId,saved.id),{status:409});assert.equal(await readFile(file,'utf8'),'其他人的同名文章')
  const wrong=await store.save(input({slug:'../../secret'}));await assert.rejects(store.materialize(wrong.draftId,wrong.id),{status:400})
  const badDate=await store.save(input({slug:'another',date:'2026-02-31'}));await assert.rejects(store.materialize(badDate.draftId,badDate.id),{status:400})
})
