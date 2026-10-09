<script setup>
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'
import { categories } from '../../../categories.js'

const { frontmatter } = useData()
const category = computed(() => categories.find((item) => item.name === frontmatter.value.category))
const published = computed(() => {
  const date = new Date(frontmatter.value.date)
  return Number.isNaN(+date) ? '' : new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }).format(date)
})
</script>

<template>
  <div class="article-context">
    <nav class="article-breadcrumb" aria-label="当前位置"><a :href="withBase('/')">首页</a><template v-if="category"><span aria-hidden="true">/</span><a :href="withBase(category.path)">{{ category.name }}</a><span aria-hidden="true">/</span><span>正文</span></template></nav>
    <div v-if="category" class="article-context-meta"><time v-if="published" :datetime="String(frontmatter.date)">{{ published }}</time><span v-if="frontmatter.readingTime">{{ frontmatter.readingTime }}</span><span v-for="tag in frontmatter.tags || []" :key="tag" class="article-context-tag">{{ tag }}</span></div>
  </div>
</template>
