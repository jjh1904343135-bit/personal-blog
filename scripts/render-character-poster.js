import {chromium} from 'playwright'
import {createServer} from 'vite'
import {writeFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

// Authoring only: no browser automation or Blender is shipped to visitors.
const root=fileURLToPath(new URL('../',import.meta.url))
const server=await createServer({root:root+'docs',configFile:false,server:{host:'127.0.0.1',port:0},plugins:[{
  name:'local-character-poster',configureServer(vite){vite.middlewares.use((request,response,next)=>{
    if(request.url!=='/__character-poster'){next();return}
    response.setHeader('Content-Type','text/html; charset=utf-8')
    response.end('<!doctype html><html><head><title>Local character authoring</title></head><body></body></html>')
  })}
}]})
let browser
try {
  await server.listen()
  const port=server.httpServer.address().port
  browser=await chromium.launch(process.env.CHROME_BIN
    ?{executablePath:process.env.CHROME_BIN}
    :{channel:'chrome'})
  const page=await browser.newPage({viewport:{width:900,height:900},deviceScaleFactor:1})
  await page.goto(`http://127.0.0.1:${port}/__character-poster`)
  const url=await page.evaluate(async()=>{
    document.body.innerHTML='<div id="portrait" style="width:900px;height:900px"><canvas style="width:100%;height:100%"></canvas></div>'
    document.body.style.margin='0'
    const {createCharacter}=await import('/.vitepress/theme/character/runtime.js')
    return new Promise((resolve,reject)=>{
      const host=document.querySelector('#portrait'),canvas=host.querySelector('canvas')
      const engine=createCharacter({host,canvas,coarse:false,onFailure:()=>reject(new Error('Poster renderer failed')),onReady:()=>{
        try{resolve(engine.capture())}catch(error){reject(error)}finally{engine.dispose()}
      }})
    })
  })
  const png=Buffer.from(url.split(',')[1],'base64')
  const provenance=Buffer.from('impeccable:prompt\0Original procedural Blender cartoon mesh; neutral transparent poster captured with the exact website Three.js runtime, camera and lighting. Source: scripts/build-character.py and scripts/render-character-poster.js. User-authorized likeness; no photo planes or third-party modeling service.','utf8')
  function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return(crc^0xffffffff)>>>0}
  const type=Buffer.from('tEXt'),chunk=Buffer.alloc(provenance.length+12)
  chunk.writeUInt32BE(provenance.length);type.copy(chunk,4);provenance.copy(chunk,8)
  chunk.writeUInt32BE(crc32(Buffer.concat([type,provenance])),chunk.length-4)
  await writeFile(root+'docs/public/models/okzu-character-poster.png',Buffer.concat([png.subarray(0,-12),chunk,png.subarray(-12)]))
  console.log('Poster exported: 900 × 900, identical runtime scene and neutral pose.')
}finally{await browser?.close();await server.close()}
