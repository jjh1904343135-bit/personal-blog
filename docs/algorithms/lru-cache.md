---
title: LRU：从题解到工程实现
description: 用哈希表与双向链表理解 LRU，并看清算法题和生产缓存之间的差距。
date: 2026-09-28
category: 算法
tags: [缓存, 数据结构, 面试]
readingTime: 约 9 分钟
isIndex: false
---

# LRU：从题解到工程实现

LRU（Least Recently Used）淘汰最长时间没有被访问的数据。面试题要求 `get` 与 `put` 都达到 O(1)，这迫使我们组合两种结构。

## 为什么需要两种数据结构

哈希表提供 O(1) 定位，但无法维护访问顺序；双向链表提供 O(1) 移动和删除，但无法 O(1) 查找。把 key 映射到链表节点，就能同时获得两种能力。

```js
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return -1
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  put(key, value) {
    if (this.cache.has(key)) this.cache.delete(key)
    this.cache.set(key, value)
    if (this.cache.size > this.capacity) {
      this.cache.delete(this.cache.keys().next().value)
    }
  }
}
```

## 工程里的边界

真实缓存还要处理并发、容量计算、过期时间和缓存击穿。算法题解决的是淘汰顺序，而不是完整的缓存系统。
