<script setup>
import DefaultTheme from 'vitepress/theme'
import ArticleContext from './ArticleContext.vue'
</script>

<template>
  <DefaultTheme.Layout><template #doc-before><ArticleContext /></template></DefaultTheme.Layout>
</template>
