import { build } from 'vite'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../private/remote-write/', import.meta.url))
const outDir = fileURLToPath(new URL('../docs/public/write/', import.meta.url))
await build({ configFile: false, root, base: '/write/', build: { outDir, emptyOutDir: true }, define: { 'process.env.NODE_ENV': JSON.stringify('production') } })
