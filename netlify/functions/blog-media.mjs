import { getStore, getDeployStore } from '@netlify/blobs'
import { getUser } from '@netlify/identity'
import { noStore } from '../lib/shared.mjs'
import { database } from '../lib/db.mjs'

function store(context) {
  return context.deploy?.context === 'production'
    ? getStore({ name: 'blog-media', consistency: 'strong' })
    : getDeployStore({ name: 'blog-media', consistency: 'strong' })
}

export default async function blogMedia(request, context) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: noStore })
  const filename = new URL(request.url).pathname.split('/').pop()
  const match = filename.match(/^([a-f0-9-]{36})\.(png|jpe?g|gif|webp|avif)$/i)
  if (!match) return new Response(null, { status: 404, headers: noStore })
  try {
    const db = database()
    const rows = await db.sql`SELECT id, name, mime, public FROM blog_media WHERE id = ${match[1]} LIMIT 1`
    const media = rows[0]
    if (!media || media.name.split('.').pop().toLowerCase() !== match[2].toLowerCase()) return new Response(null, { status: 404, headers: noStore })
    if (!media.public) {
      const user = await getUser()
      const allowed = (Netlify.env.get('AUTHOR_EMAIL') || '').trim().toLowerCase()
      if (!user || !allowed || user.email?.trim().toLowerCase() !== allowed) return new Response(null, { status: 404, headers: noStore })
    }
    const bytes = await store(context).get(media.id, { type: 'arrayBuffer' })
    if (!bytes) return new Response(null, { status: 404, headers: noStore })
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: {
      ...noStore, 'Content-Type': media.mime, 'Content-Length': String(bytes.byteLength),
      'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
    } })
  } catch (cause) {
    console.error('Media failed', cause)
    return new Response(null, { status: 503, headers: noStore })
  }
}

export const config = { path: '/media/:filename' }
