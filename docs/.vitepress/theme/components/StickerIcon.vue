<script setup>
defineProps({ name: { type: String, required: true } })
</script>

<template>
  <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'algorithms'">
      <rect x="3" y="3" width="8" height="8" rx="2"/><rect x="21" y="21" width="8" height="8" rx="2"/>
      <path d="M11 7h10a4 4 0 0 1 4 4v10M7 11v10a4 4 0 0 0 4 4h10M17 3l4 4-4 4M3 17l4 4 4-4"/>
    </template>
    <template v-else-if="name === 'agent'">
      <rect x="5" y="9" width="22" height="19" rx="6"/><path d="M16 9V4M13 4h6M2 16v7M30 16v7M12 22q4 3 8 0"/>
      <circle cx="11" cy="16" r="1" fill="currentColor"/><circle cx="21" cy="16" r="1" fill="currentColor"/>
    </template>
    <template v-else-if="name === 'interviews'">
      <path d="M7 5h18a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H13l-7 5v-5a4 4 0 0 1-3-4V9a4 4 0 0 1 4-4Z"/>
      <path d="M9 12h14M9 18h9"/>
    </template>
    <template v-else-if="name === 'deployment'">
      <path d="M16 22V4m-6 6 6-6 6 6M5 19v9h22v-9"/><path d="M10 24h12"/>
    </template>
    <template v-else-if="name === 'systems'">
      <rect x="8" y="8" width="16" height="16" rx="3"/><rect x="13" y="13" width="6" height="6" rx="1"/>
      <path d="M12 3v5m8-5v5M12 24v5m8-5v5M3 12h5m-5 8h5M24 12h5m-5 8h5"/>
    </template>
    <template v-else-if="name === 'backend'">
      <ellipse cx="16" cy="7" rx="11" ry="4"/><path d="M5 7v18c0 5 22 5 22 0V7M5 16c0 5 22 5 22 0"/>
    </template>
    <template v-else-if="name === 'search'">
      <circle cx="14" cy="14" r="9"/><path d="m21 21 7 7"/>
    </template>
    <template v-else>
      <path d="M6 16h20m-7-7 7 7-7 7"/>
    </template>
  </svg>
</template>
