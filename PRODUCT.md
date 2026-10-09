# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

公开博客面向阅读技术文章的访客。中文管理后台仅供作者本人在本机使用。

## Product Purpose

ok俎的个人博客，记录互联网、Agent 求职相关的技术知识与真实面试经历。作者管理 Markdown 与配图，访客通过分类、导航和本地搜索阅读。

## Operating Context

VitePress 静态博客；本机 Node.js 写作服务只监听 127.0.0.1，以密码保护。GitHub main 已连接 Netlify 自动构建；Docker 部署继续保留。

## Capabilities and Constraints

六个栏目固定为算法、Agent、面经、部署、系统、后端。本轮确认管理后台范围为文章管理、六栏目筛选、Markdown 编辑预览、配图管理与同步状态。公开首页保持不变。自动同步为显式开启，保存后准备公开；未开启时只在本机保存。密钥与原始私人素材禁止上传；面经不得虚构。

## Brand Commitments

中文界面，保留现有深色、蓝色与卡通头像身份。后台以可理解、可操作为主，访客侧不增加管理入口。

## Evidence on Hand

真实栏目配置在 docs/categories.js，现有四篇文章；已有卡通头像 docs/public/images/okzu-avatar.webp。当前没有新增面经素材。

## Product Principles

公开与私有边界清晰；状态必须真实；用户内容不得丢失；不为作者生成虚构经历。
