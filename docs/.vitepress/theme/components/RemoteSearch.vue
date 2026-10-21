<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from 'vue'

const emit = defineEmits(['close'])
const query = ref(''), results = ref([]), loading = ref(false), failed = ref(false), input = ref(null)
let controller, timer
function close() { emit('close') }
function key(event) { if (event.key === 'Escape') { event.stopPropagation(); close() } }
watch(query, (value) => {
  clearTimeout(timer); controller?.abort(); failed.value = false
  if (!value.trim()) { results.value = []; loading.value = false; return }
  timer = setTimeout(async () => {
    controller = new AbortController(); loading.value = true
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { cache: 'no-store', signal: controller.signal })
      if (!response.ok) throw new Error('搜索暂不可用')
      results.value = await response.json()
    } catch (cause) { if (cause.name !== 'AbortError') failed.value = true }
    finally { loading.value = false }
  }, 180)
})
onMounted(() => { input.value?.focus(); window.addEventListener('keydown', key) })
onBeforeUnmount(() => { controller?.abort(); clearTimeout(timer); window.removeEventListener('keydown', key) })
</script>

<template>
  <div class="remote-search-overlay" @mousedown.self="close"><section class="remote-search-dialog" role="dialog" aria-modal="true" aria-label="搜索文章"><div class="remote-search-input"><span aria-hidden="true">⌕</span><input ref="input" v-model="query" type="search" placeholder="搜索标题、摘要或正文…" aria-label="搜索文章"><button type="button" @click="close" aria-label="关闭搜索">×</button></div><div class="remote-search-results" aria-live="polite"><p v-if="loading">正在搜索…</p><p v-else-if="failed">搜索暂不可用，请稍后重试。</p><p v-else-if="query && !results.length">没有找到相关文章。</p><a v-for="item in results" :key="item.url" :href="item.url"><small>{{ item.category }} · {{ item.date }}</small><strong>{{ item.title }}</strong><span>{{ item.description }}</span></a></div></section></div>
</template>

<style scoped>
.remote-search-overlay{position:fixed;inset:0;z-index:200;background:#080b12cf;display:flex;align-items:flex-start;justify-content:center;padding:clamp(50px,10vh,120px) 16px 20px;backdrop-filter:blur(8px)}.remote-search-dialog{width:min(680px,100%);max-height:80vh;overflow:hidden;background:#1c2634;border:1px solid #5b7087;border-radius:18px;box-shadow:0 30px 100px #0009}.remote-search-input{display:flex;align-items:center;gap:10px;padding:16px;border-bottom:1px solid #3b4b60}.remote-search-input>span{font-size:30px;color:#8bd4cf}.remote-search-input input{flex:1;min-width:0;border:0;outline:0;background:transparent;color:#fff;font:inherit;font-size:18px}.remote-search-input button{background:transparent;border:0;color:#ced8e4;font-size:28px;cursor:pointer}.remote-search-results{max-height:65vh;overflow:auto;padding:10px}.remote-search-results p{color:#b6c2d2;padding:14px}.remote-search-results a{display:grid;gap:5px;padding:15px;border-radius:10px;text-decoration:none;color:#f7f7f8}.remote-search-results a:hover{background:#314052}.remote-search-results small{color:#8bd4cf}.remote-search-results strong{font-size:17px}.remote-search-results span{color:#adbbca;font-size:13px}
</style>
