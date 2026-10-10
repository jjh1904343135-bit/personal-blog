import { build } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.join(root,'private','admin','assets')
if (path.relative(root,output) !== path.join('private','admin','assets')) throw new Error('Invalid editor build directory')
await build({
  configFile:false,root,
  build:{outDir:output,emptyOutDir:true,lib:{entry:path.join(root,'private/admin/note-editor.js'),formats:['es'],fileName:()=> 'editor.js'},rollupOptions:{output:{inlineDynamicImports:true}}},
  define:{'process.env.NODE_ENV':JSON.stringify('production')}
})
