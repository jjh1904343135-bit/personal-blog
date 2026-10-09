<script setup>
import { computed, ref } from 'vue'
import { withBase } from 'vitepress'
import { data as posts } from '../../../posts.data.js'
import { categories } from '../../../categories.js'
import StickerIcon from './StickerIcon.vue'
import BlogSearch from './BlogSearch.vue'

const categoryCount = (name) => posts.filter((post) => post.category === name).length
const search = ref(null)
const readingRoutes = computed(() => ['Agent', '算法', '部署'].map((name) => posts.find((post) => post.category === name)).filter(Boolean))
const openSearch = (event) => {
  search.value?.open(event.currentTarget)
}
</script>

<template>
  <a class="home-skip-link" href="#knowledge-topics">跳到文章栏目</a>
  <header class="home-nav">
    <div class="home-nav-inner">
      <a class="home-brand" :href="withBase('/')"><span class="brand-mark"><img :src="withBase('/images/okzu-avatar.webp')" alt=""></span><span><b>ok俎</b>的个人博客</span></a>
      <nav aria-label="首页导航">
        <a :href="withBase('/')" aria-current="page">首页</a>
        <a v-for="item in categories" :key="item.key" :href="withBase(item.path)">{{ item.name }}</a>
        <a :href="withBase('/about')">关于我</a>
      </nav>
      <BlogSearch ref="search" />
    </div>
  </header>
  <main class="blog-home">
    <section class="intro-section">
      <div class="hero-stickers" aria-hidden="true">
        <span class="sticker sticker-code">&lt;/&gt;</span>
        <span class="sticker sticker-ai">AI</span>
        <span class="sticker sticker-heart">♥</span>
        <span class="sticker sticker-db">DB</span>
      </div>
      <div class="intro-copy">
        <h1>把复杂技术，<br><em>讲到真正明白。</em></h1>
        <p class="intro-text">这里是 <strong>ok俎的个人技术知识库</strong>。记录算法推演、Agent 实践、真实面经与工程部署，也拆解系统和后端世界里那些值得反复理解的问题。</p>
        <div class="intro-actions">
          <a class="primary-action" href="#knowledge-topics">浏览六个栏目 <StickerIcon name="arrow" /></a>
          <button class="secondary-action search-action" type="button" @click="openSearch"><StickerIcon name="search" /> 搜索文章 <kbd>Ctrl K</kbd></button>
        </div>
        <p class="hero-footnote">{{ posts.length }} 篇公开文章，按主题整理，随时翻阅。</p>
      </div>
      <aside v-if="readingRoutes.length" class="hero-signal" aria-labelledby="reading-routes-title">
        <h2 id="reading-routes-title">不妨从一个问题开始</h2>
        <a v-for="post in readingRoutes" :key="post.url" :href="withBase(post.url)"><span>{{ post.category }}</span><strong>{{ post.title }}</strong><StickerIcon name="arrow" /></a>
      </aside>
    </section>

    <section id="knowledge-topics" class="home-section category-section" tabindex="-1" aria-labelledby="topics-title">
      <header class="section-heading">
        <div><h2 id="topics-title">你想了解哪个方向？</h2></div>
        <p>六个持续生长的技术主题。选择你正在解决的问题，进入对应的知识专题。</p>
      </header>
      <div class="category-grid">
        <a v-for="item in categories" :key="item.name" class="category-card" :href="withBase(item.path)">
          <div class="category-card-top"><span class="category-sticker"><StickerIcon :name="item.key" /></span><span class="category-status" :class="{ 'is-empty': !categoryCount(item.name) }">{{ categoryCount(item.name) ? `${categoryCount(item.name)} 篇文章` : '暂未发布' }}</span></div>
          <h3>{{ item.name }}</h3>
          <p>{{ item.description }}</p>
          <span class="category-meta">{{ categoryCount(item.name) ? '进入栏目' : '查看栏目介绍' }}<StickerIcon name="arrow" /></span>
        </a>
      </div>
    </section>

    <section class="author-strip">
      <div class="author-copy"><span class="author-mark"><img :src="withBase('/images/okzu-avatar.webp')" alt="ok俎的卡通头像" width="76" height="76" loading="lazy"></span><div><strong>把踩过的坑，变成下一次的路标。</strong><p>我是 ok俎，一名持续学习的互联网工程师。这个博客既是我的技术复盘，也希望成为你遇到问题时可以翻阅的资料库。</p></div></div>
      <a :href="withBase('/about')">认识一下我 <StickerIcon name="arrow" /></a>
    </section>

    <footer class="blog-footer"><span>© 2026 ok俎的个人博客</span><span>认真写作 · 保持好奇 · 持续更新</span></footer>
  </main>
</template>
