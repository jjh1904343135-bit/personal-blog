import 'dotenv/config'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const [prompt, rawName] = process.argv.slice(2)

if (!prompt || !rawName) {
  console.error('用法: npm run gen-img -- "图片描述" 文件名')
  process.exit(1)
}

if (!process.env.GEMINI_API_KEY) {
  console.error('缺少 GEMINI_API_KEY，请先在项目根目录的 .env 中配置。')
  process.exit(1)
}

const safeName = rawName
  .toLowerCase()
  .replace(/\.(png|jpe?g|webp)$/i, '')
  .replace(/[^a-z0-9-_]+/g, '-')
  .replace(/^-+|-+$/g, '')

if (!safeName) {
  console.error('文件名需包含英文字母、数字、连字符或下划线。')
  process.exit(1)
}

const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image'
const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions'

console.log(`正在调用 ${model} 生成图片…`)

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-goog-api-key': process.env.GEMINI_API_KEY
  },
  body: JSON.stringify({
    model,
    input: prompt,
    response_format: {
      type: 'image',
      mime_type: 'image/png',
      aspect_ratio: '16:9'
    }
  })
})

if (!response.ok) {
  const details = await response.text()
  throw new Error(`Gemini API 请求失败 (${response.status}): ${details}`)
}

const result = await response.json()
const image = result.output_image
  || result.outputImage
  || result.steps?.flatMap((step) => step.content || []).find((item) => item.type === 'image')

if (!image?.data) {
  throw new Error('API 返回成功，但响应中没有图片数据。请确认模型支持图片输出。')
}

const mime = image.mime_type || image.mimeType || 'image/png'
const extension = mime.includes('jpeg') ? 'jpg' : 'png'
const outputDir = path.resolve('docs/public/images')
const outputPath = path.join(outputDir, `${safeName}.${extension}`)

await mkdir(outputDir, { recursive: true })
await writeFile(outputPath, Buffer.from(image.data, 'base64'))

console.log(`\n图片已保存：${outputPath}`)
console.log(`Markdown：![${prompt}](/images/${safeName}.${extension})`)
