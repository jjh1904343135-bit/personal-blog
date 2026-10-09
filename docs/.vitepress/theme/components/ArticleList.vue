<script setup>
import { computed } from 'vue'
import { withBase } from 'vitepress'
import { data as posts } from '../../../posts.data.js'
import { categories } from '../../../categories.js'
import StickerIcon from './StickerIcon.vue'

const props = defineProps({ category: { type: String, required: true } })
const list = computed(() => posts.filter((post) => post.category === props.category))
const alternatives = computed(() => categories.filter((item) => item.name !== props.category && posts.some((post) => post.category === item.name)))
const formatDate = (date) => new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date(date))
</script>

<template>
  <div class="category-article-list">
    <p v-if="list.length" class="article-list-summary">共 {{ list.length }} 篇文章 · 按发布时间排序</p>
    <a v-for="post in list" :key="post.url" :href="withBase(post.url)" class="category-article">
      <div><h2>{{ post.title }}</h2><p>{{ post.description }}</p><div class="category-article-tags"><span v-for="tag in post.tags" :key="tag">{{ tag }}</span></div></div>
      <div class="category-article-detail"><time :datetime="post.date">{{ formatDate(post.date) }}</time><span>{{ post.readingTime }}</span><strong>阅读全文 <StickerIcon name="arrow" /></strong></div>
    </a>
    <div v-if="!list.length" class="category-empty">
      <h2>这个栏目暂未发布文章</h2>
      <p>{{ category === '面经' ? '这里只收录亲身经历的面试复盘，发布后会在这里展示。你可以先看看其他技术栏目。' : '文章发布后会在这里展示。先从已有内容的栏目开始阅读吧。' }}</p>
      <div class="empty-category-links"><a v-for="item in alternatives" :key="item.key" :href="withBase(item.path)">{{ item.name }}<StickerIcon name="arrow" /></a></div>
    </div>
  </div>
</template>
