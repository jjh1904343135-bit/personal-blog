<script setup>
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import StickerIcon from './StickerIcon.vue'

// Reuse VitePress's indexed search, result navigation and focus trap, not a
// second title-only search. This adapter owns trigger-focus restoration.
const LocalSearchBox = defineAsyncComponent(() => import('vitepress/dist/client/theme-default/components/VPLocalSearchBox.vue'))
const isOpen = ref(false)
const button = ref(null)
let opener
let originUrl
let restoreTimer

function open(trigger) {
  if (isOpen.value) return
  clearTimeout(restoreTimer)
  opener = trigger instanceof HTMLElement ? trigger : document.activeElement
  if (opener === document.body) opener = button.value
  originUrl = window.location.href
  isOpen.value = true
}

async function close() {
  isOpen.value = false
  await nextTick()
  // The core trap deactivates asynchronously; restore after its cleanup.
  restoreTimer = setTimeout(() => {
    if (!isOpen.value && window.location.href === originUrl && opener?.isConnected) opener.focus({ preventScroll: true })
  }, 20)
}

function shortcut(event) {
  const editing = event.target instanceof HTMLElement && (event.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName))
  if (((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') || (!editing && event.key === '/')) {
    event.preventDefault()
    open()
  }
}

onMounted(() => window.addEventListener('keydown', shortcut))
onBeforeUnmount(() => { window.removeEventListener('keydown', shortcut); clearTimeout(restoreTimer) })
defineExpose({ open })
</script>

<template>
  <div class="home-fulltext-search">
    <button ref="button" class="nav-search" type="button" aria-label="搜索文章全文" @click="open($event.currentTarget)"><StickerIcon name="search" /><span>搜索文章</span></button>
    <LocalSearchBox v-if="isOpen" @close="close" />
  </div>
</template>
