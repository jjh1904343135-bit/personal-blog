import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { categories } from '../categories.js'

const docsRoot = fileURLToPath(new URL('../', import.meta.url))

function readFrontmatter(filePath) {
  const source = readFileSync(filePath, 'utf8')
  const block = source.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)
  const value = (key) => block?.[1]
    ?.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]
    ?.trim()
    ?.replace(/^['"]|['"]$/g, '')

  return {
    title: value('title'),
    date: value('date') || '1970-01-01'
  }
}

function categoryItems(category) {
  const directory = path.join(docsRoot, category.key)
  if (!existsSync(directory)) return []

  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md') && entry.name !== 'index.md')
    .map((entry) => {
      const slug = entry.name.replace(/\.md$/, '')
      const frontmatter = readFrontmatter(path.join(directory, entry.name))
      return {
        text: frontmatter.title || slug,
        link: `${category.path}${slug}`,
        date: frontmatter.date
      }
    })
    .sort((a, b) => +new Date(b.date) - +new Date(a.date))
    .map(({ text, link }) => ({ text, link }))
}

export const sidebar = Object.fromEntries(categories.map((category) => [
  category.path,
  [{
    text: category.name,
    items: [
      { text: '专题首页', link: category.path },
      ...categoryItems(category)
    ]
  }]
]))
