---
title: 一个静态站点的轻量容器化路径
description: 使用多阶段构建和 Nginx，把 VitePress 站点做成小而可靠的生产镜像。
date: 2026-09-25
category: 部署
tags: [Docker, Nginx, VitePress]
readingTime: 约 7 分钟
isIndex: false
---

# 一个静态站点的轻量容器化路径

VitePress 在构建期输出纯静态资源。生产环境不需要 Node.js，只需要一个能高效发送文件的 Web Server。

## 多阶段构建

第一阶段安装依赖并构建；第二阶段只复制产物到 Nginx。这样 Node.js、源码和构建缓存都不会进入最终镜像。

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run docs:build

FROM nginx:alpine
COPY --from=build /app/docs/.vitepress/dist /usr/share/nginx/html
```

## 缓存策略

带内容哈希的静态资源可以缓存一年；HTML 应短缓存或不缓存，以保证发布后入口文件及时更新。
