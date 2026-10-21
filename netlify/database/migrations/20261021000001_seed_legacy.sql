-- One-time copy of the four previously public Markdown articles. Their URLs remain unchanged.
INSERT INTO blog_posts (id, category, slug, title, description, body, article_date, tags, reading_time) VALUES
('ce84d0a6-7497-44bb-97ec-274d08117211','algorithms','lru-cache','LRU：从题解到工程实现','用哈希表与双向链表理解 LRU，并看清算法题和生产缓存之间的差距。',$article$
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
$article$,'2026-09-28','["缓存","数据结构","面试"]'::jsonb,'约 9 分钟'),
('b4342837-71f1-4d6a-ae4a-2998b55c9722','agent','tool-calling','Agent 的工具调用应该如何设计？','从工具描述、参数约束、执行边界和错误恢复四个角度，设计可靠的 Agent 工具层。',$article$
# Agent 的工具调用应该如何设计？

工具调用把模型的文本推理连接到真实世界。可靠的工具层不仅要“能调通”，还要让模型清楚何时调用、调用什么，以及失败后如何恢复。

## 工具描述就是接口契约

名称应表达动作，描述应说明适用范围，参数应尽可能使用枚举、边界和必填字段消除歧义。不要指望模型从模糊描述中稳定猜中业务规则。

## 区分读取与写入

查询类工具可以更积极地调用；会发送、删除、支付或修改权限的工具必须建立确认边界。风险应该由执行层约束，而不是只靠提示词提醒。

## 让错误可以恢复

错误返回需要包含可行动的信息：哪个字段无效、允许哪些值、当前状态是什么。对暂时性失败使用有限重试，对业务错误则把决定交还给模型或用户。
$article$,'2026-09-30','["Agent","工具调用","LLM"]'::jsonb,'约 10 分钟'),
('dc4f14a5-9767-4a70-9e03-f92a3c597d33','deployment','docker-static-site','一个静态站点的轻量容器化路径','使用多阶段构建和 Nginx，把 VitePress 站点做成小而可靠的生产镜像。',$article$
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
$article$,'2026-09-25','["Docker","Nginx","VitePress"]'::jsonb,'约 7 分钟'),
('b5922a9b-c807-45d3-a9e3-7319e405e744','systems','url-to-page','在地址栏按下回车后，到底发生了什么？','从 DNS、TCP 和 TLS，一路追踪到服务端请求链与浏览器渲染。',$article$
# 在地址栏按下回车后，到底发生了什么？

一次页面访问是网络协议、操作系统和浏览器流水线共同完成的协作。

## 1. 地址解析

浏览器解析 URL，检查 HSTS、缓存与 Service Worker，然后通过本地缓存、系统解析器和递归 DNS 查询获得 IP 地址。

## 2. 建立安全连接

HTTP/1.1 与 HTTP/2 通常先进行 TCP 三次握手，再完成 TLS 握手；HTTP/3 基于 QUIC，把可靠传输与加密握手结合起来，减少往返。

## 3. 服务端请求链

请求依次经过 CDN、负载均衡、网关和应用服务。每一层都可能进行缓存、鉴权、限流或路由。

## 4. 浏览器渲染

HTML 构建 DOM，CSS 构建 CSSOM，二者形成渲染树。随后浏览器完成布局、绘制和合成；JavaScript 可能在其中改变整个过程。
$article$,'2026-10-01','["网络","浏览器","面试"]'::jsonb,'约 12 分钟');
