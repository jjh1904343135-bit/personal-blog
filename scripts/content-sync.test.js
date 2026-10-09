import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, mkdir, writeFile, readFile, rm, unlink } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { setTimeout as delay } from 'node:timers/promises'
import { createContentPublisher, startContentWatch, isContentPath, SyncError } from './content-sync.js'
const execute = promisify(execFile)
const quiet = () => {}
async function fixture(t) {
  const base = await mkdtemp(path.join(os.tmpdir(), 'okzu-sync-test-')), root = path.join(base,'work'), remote = path.join(base,'remote.git')
  t.after(async()=>{assert.ok(path.basename(base).startsWith('okzu-sync-test-'));await rm(base,{recursive:true,force:true})})
  await mkdir(root)
  const git = async (...args) => (await execute('git',args,{cwd:root,windowsHide:true,encoding:'utf8'})).stdout.trim()
  await git('init','--bare',remote);await git('init','-b','main');await git('config','user.name','Sync Test');await git('config','user.email','test@example.invalid')
  await mkdir(path.join(root,'docs/algorithms'),{recursive:true});await mkdir(path.join(root,'docs/public/images'),{recursive:true})
  await writeFile(path.join(root,'.gitignore'),'.env\n');await writeFile(path.join(root,'README.md'),'fixture');await writeFile(path.join(root,'docs/algorithms/initial.md'),'initial')
  await git('add','.');await git('commit','-m','initial');await git('remote','add','origin',remote);await git('push','-u','origin','main')
  const make = options => createContentPublisher({root,remote,validate:async()=>{},log:quiet,...options})
  return {root,remote,git,make,write:async(file,text)=>{await mkdir(path.dirname(path.join(root,file)),{recursive:true});await writeFile(path.join(root,file),text)}}
}
test('only six article folders and image assets are eligible',()=>{
  for(const p of ['docs/agent/工具调用.md','docs/algorithms/lru cache [1].md','docs/public/images/a.webp']) assert.ok(isContentPath(p),p)
  for(const p of ['.env','private/admin/index.html','docs/profile.js','docs/.vitepress/config.js','docs/agent/index.md','docs/agent/.env.md','docs/agent/sub/a.md','docs/public/images/../../.env','docs/public/images/.key.png']) assert.ok(!isContentPath(p),p)
})
test('add/edit/delete and literal Unicode paths push to a local remote without extra commits',async t=>{
  const f=await fixture(t), file='docs/algorithms/算法 [1].md';await f.write(file,'article');await f.write('docs/profile.js','must remain local');await f.write('.env','GEMINI_API_KEY=local-only-secret')
  let builds=0;const p=f.make({validate:async()=>{builds++}})
  assert.equal((await p.sync()).status,'pushed');assert.equal(await f.git('rev-parse','HEAD'),await f.git('rev-parse','origin/main'))
  assert.match(await f.git('status','--short'),/docs\/profile.js/);assert.equal(await f.git('ls-files','docs/profile.js'),'');assert.equal(await f.git('ls-files','.env'),'')
  const head=await f.git('rev-parse','HEAD');assert.equal((await p.sync()).status,'idle');assert.equal(await f.git('rev-parse','HEAD'),head)
  await f.write(file,'updated');await p.sync();await unlink(path.join(f.root,file));await p.sync();assert.equal(builds,3)
})
test('staged unrelated files remain staged and are never committed',async t=>{
  const f=await fixture(t);await f.write('README.md','user change');await f.git('add','README.md');await f.write('docs/algorithms/new.md','new')
  const head=await f.git('rev-parse','HEAD');await assert.rejects(f.make().sync(),/暂存区/);assert.equal(await f.git('rev-parse','HEAD'),head);assert.equal(await f.git('diff','--cached','--name-only'),'README.md')
})
test('environment secret, failed build, and concurrent edits block publication',async t=>{
  const f=await fixture(t);await f.write('.env','GEMINI_API_KEY=real-testing-secret-abcdef');await f.write('docs/algorithms/new.md','real-testing-secret-abcdef')
  await assert.rejects(f.make().sync(),/疑似密钥/);await f.write('docs/algorithms/new.md','safe')
  await assert.rejects(f.make({validate:async()=>{throw new SyncError('build failed')}}).sync(),/build failed/)
  await assert.rejects(f.make({validate:async()=>{await f.write('docs/algorithms/new.md','changed during build')}}).sync(),/内容再次变化/)
  assert.equal(await f.git('rev-parse','HEAD'),await f.git('rev-parse','origin/main'))
})
test('all outgoing history is scanned and unrelated commits are blocked',async t=>{
  const f=await fixture(t);await f.write('.env','GEMINI_API_KEY=outgoing-testing-secret');await f.write('docs/algorithms/new.md','outgoing-testing-secret');await f.git('add','docs');await f.git('commit','-m','add')
  await f.write('docs/algorithms/new.md','removed secret');await f.git('add','docs');await f.git('commit','-m','remove')
  await assert.rejects(f.make().sync(),/疑似密钥/)
  const g=await fixture(t);await g.write('README.md','code change');await g.git('add','README.md');await g.git('commit','-m','unrelated');await assert.rejects(g.make().sync(),/代码或配置提交/)
})
test('ahead content commits can resume, wrong branch/remote and remote changes are safe failures',async t=>{
  const f=await fixture(t);await f.write('docs/algorithms/new.md','safe');await f.git('add','docs');await f.git('commit','-m','content');const head=await f.git('rev-parse','HEAD');assert.equal((await f.make().sync()).status,'pushed');assert.equal(await f.git('rev-parse','HEAD'),head)
  await f.git('checkout','-b','draft');await assert.rejects(f.make().sync(),/main 分支/);await f.git('checkout','main');await assert.rejects(f.make({remote:'different'}).sync(),/仓库不一致/)
  const other=path.join(path.dirname(f.root),'other');await f.git('clone',f.remote,other);await execute('git',['-C',other,'checkout','main']);await execute('git',['-C',other,'config','user.name','Other']);await execute('git',['-C',other,'config','user.email','other@example.invalid']);await writeFile(path.join(other,'README.md'),'remote');await execute('git',['-C',other,'add','README.md']);await execute('git',['-C',other,'commit','-m','remote']);await execute('git',['-C',other,'push','origin','main']);await assert.rejects(f.make().sync(),/远程 main/)
})
test('watcher debounces bursts and stop prevents future syncing',async()=>{
  let digest='start',calls=0
  const watcher=startContentWatch({snapshot:async()=>({digest}),sync:async()=>{calls++;return{status:'pushed'}}},{settleMs:70,pollMs:10,retryMs:30,log:quiet})
  try{await delay(20);digest='a';await delay(30);digest='b';await delay(40);assert.equal(calls,0);await delay(60);assert.equal(calls,1)}finally{await watcher.stop()}
  digest='c';await delay(100);assert.equal(calls,1)
})
