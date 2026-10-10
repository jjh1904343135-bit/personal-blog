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

六个栏目固定为算法、Agent、面经、部署、系统、后端。管理后台提供笔记式连续文档编辑、六栏目筛选、Markdown 高级模式、代码块、表格、私有配图和发布状态。正文自动保存为本机私有草稿，点击发布／更新发布才将文章与所用配图写入公开目录并触发 GitHub 和 Netlify；保存不等于发布。公开首页保持不变。密钥与原始私人素材禁止上传；面经不得虚构。

## Brand Commitments

中文界面，保留现有深色、蓝色与卡通头像身份。后台以可理解、可操作为主，访客侧不增加管理入口。

## Evidence on Hand

真实栏目配置在 docs/categories.js，现有四篇文章；已有卡通头像 docs/public/images/okzu-avatar.webp。当前没有新增面经素材。

## Product Principles

公开与私有边界清晰；状态必须真实；用户内容不得丢失；不为作者生成虚构经历。
