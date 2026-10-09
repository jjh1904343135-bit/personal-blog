import { createContentLoader } from 'vitepress'
import { categories } from './categories.js'

export default createContentLoader(categories.map(({ key }) => `${key}/*.md`), {
  excerpt: true,
  transform(raw) {
    return raw
      .filter((item) => !item.url.endsWith('/'))
      .map(({ url, frontmatter, excerpt }) => ({
        url,
        title: frontmatter.title,
        description: frontmatter.description || excerpt?.replace(/<[^>]+>/g, '').trim() || '',
        date: frontmatter.date || '2026-01-01',
        category: frontmatter.category || '技术随笔',
        tags: frontmatter.tags || [],
        readingTime: frontmatter.readingTime || '约 8 分钟'
      }))
      .filter((item) => item.title)
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }
})
