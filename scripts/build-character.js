import {spawn} from 'node:child_process'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {access} from 'node:fs/promises'

const root=fileURLToPath(new URL('../',import.meta.url))
const binary=process.env.BLENDER_BIN || path.join(root,'.tools/blender/blender-4.5.14-windows-x64/blender.exe')
try {await access(binary)}catch{console.error('未找到 Blender。请设置 BLENDER_BIN 指向 Blender 4.5 LTS，或按 README 放置官方便携版。');process.exit(1)}
const child=spawn(binary,['--background','--factory-startup','--python',path.join(root,'scripts/build-character.py')],{cwd:root,stdio:'inherit',windowsHide:true})
child.on('error',()=>{console.error('无法启动 Blender。');process.exitCode=1})
child.on('exit',code=>{
  if(code!==0){process.exitCode=code??1;return}
  const poster=spawn(process.execPath,[path.join(root,'scripts/render-character-poster.js')],{cwd:root,stdio:'inherit',windowsHide:true})
  poster.on('error',()=>{console.error('无法启动海报渲染。');process.exitCode=1})
  poster.on('exit',status=>{process.exitCode=status??1})
})
