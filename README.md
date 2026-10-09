# Internet Field Notes

一个基于 VitePress 的轻量个人技术博客，聚焦算法、Agent、真实面经、部署、计算机系统与 Java 后端。

## 本地开发

要求 Node.js 20 或更高版本。

```bash
npm install
npm run docs:dev
```

访问 `http://localhost:5173`。生产构建：

```bash
npm run docs:build
npm run docs:preview
```

## 使用 Gemini 生成文章配图

复制环境变量模板并填写自己的密钥（`.env` 已被 Git 忽略）：

```bash
cp .env.example .env
```

生成 16:9 PNG 插图：

```bash
npm run gen-img -- "一张解释 TCP 三次握手的简洁科技感信息图" tcp-handshake
```

图片会保存到 `docs/public/images/`，命令完成后会打印可直接粘贴的 Markdown。默认使用当前 Gemini 图片模型 `gemini-3.1-flash-image`；可通过 `GEMINI_IMAGE_MODEL` 调整。

## 中文写作后台

博客内容以 Markdown 保存在仓库中，首页、分类页和搜索索引都会自动读取文章元数据并渲染。打开两个终端，分别运行：

```bash
npm run docs:dev
npm run admin
```

写作后台独立运行在 `http://127.0.0.1:8081/admin/`。浏览器要求输入账号和密码：默认账号为 `okzu`，未设置密码时，启动终端会显示本次随机密码。关闭后台后该临时密码失效；重启会生成新密码。

若希望固定账号密码，可在根目录 `.env` 中添加 `AUTHOR_USERNAME`、`AUTHOR_PASSWORD`（至少 16 个字符），可通过 `AUTHOR_PORT` 更改端口。`.env` 不进入 Git、Docker 镜像或公开站点。不要把密码写进 `VITE_` 前缀变量或前端代码。

后台只监听本机 `127.0.0.1`，页面、配置与所有读写接口都校验密码；拒绝跨站请求，并限制读写范围为六个分类的文章和博客图片，不允许改分类首页或访问 `.env`。公开页面不显示写文章入口，公开构建中也不包含后台文件。原公开地址 `/admin/index.html` 不再是写作入口。

登录后即可在中文界面中新增、编辑文章和上传配图。保存直接写入 `docs/` 对应分类目录，开发页面自动刷新；Docker 发布执行 `docker compose up -d --build`，Vercel 发布则提交至已连接的 Git 仓库触发构建。

目前提供的是本机私有写作后台，不能从公网远程登录。远程写作需要额外部署有身份验证的服务或配置 GitHub OAuth；纯静态托管不能处理作者登录和 Markdown 保存。

## Docker 部署

```bash
docker compose up -d --build
```

访问 `http://localhost:8080`，健康检查地址为 `/healthz`。生产镜像采用 Node.js 构建、Nginx Alpine 运行的多阶段结构，包含 Gzip、长期静态缓存和路由回退。

构建期还会生成 `.gz` 与 `.br` 预压缩资源；标准 Nginx Alpine 原生启用 Gzip 静态文件。若生产网关支持 Brotli，可直接消费生成的 `.br` 文件。

## Vercel

仓库已包含 `vercel.json`。连接 Git 仓库后，Vercel 会执行 `npm run docs:build` 并发布 `docs/.vitepress/dist`。

## Netlify

根目录的 `netlify.toml` 已配置 Node.js 22、构建命令 `npm run docs:build` 和发布目录 `docs/.vitepress/dist`。Netlify 托管的是生成后的静态网站，不运行 Docker 或本机写作服务；原有 Docker 部署方式仍可使用。

第一次发布需登录并创建或关联你自己的 Netlify 项目：

```bash
npx netlify-cli login
npm run docs:build
npx netlify-cli deploy --prod --no-build --dir=docs/.vitepress/dist
```

### GitHub 自动发布

源码仓库：`https://github.com/jjh1904343135-bit/personal-blog`。现有 Netlify 项目 `okzu-blog-20261009-a7f3c2` 已连接此仓库，生产分支使用 `main`。每次推送 `main`，Netlify 都会自动安装依赖、构建文章和搜索索引并发布；无需再次手动上传产物。网站地址保持为 `https://okzu-blog-20261009-a7f3c2.netlify.app`。

日常写作先运行 `npm run admin`，保存并在本机预览。确认可以公开后，在项目根目录执行：

```bash
git add -- docs/
git diff --cached --stat
git commit -m "docs: 更新博客文章"
git push origin main
```

`git add -- docs/` 只提交博客文章、图片和前端文件，构建产物与缓存仍被忽略；请在提交前确认文章和配图确实可以公开。若同时修改配置或工具，应检查后单独暂存对应文件。没有变更时无需再次提交。

保存文章只修改本机 Markdown，不会直接上线，也不代表有独立草稿状态。只有推送到 `main` 才触发自动发布。等待 Netlify 的 Deploys 页面显示 Published 后，刷新网站即可看到新内容；不要在上传成功前删除本机文章。构建失败不会覆盖当前已上线版本，可修正后再次推送。

公开仓库不存放 `.env`、`.netlify/`、`person/` 原始素材及私钥。`docs/` 中的内容会公开发布；原始简历、电话等未准备公开的信息不要放入该目录。本机后台的代码可进入仓库，但登录密码只保存在被忽略的 `.env` 中。

只发布 `docs/.vitepress/dist`，不要上传整个工作目录，也不需要把 `.env` 导入 Netlify。`.netlify/` 保存本机项目关联信息，已加入 Git 忽略。后台不属于公开构建；`/admin`、`/private/*` 和 `/api/*` 在 Netlify 返回 404。文章页面使用预渲染 HTML 和 Pretty URLs，未配置把所有路径重写到首页的 SPA 回退，避免不存在的文章伪装成正常页面。

`docs/public/_headers` 和 `_redirects` 会随构建复制到发布目录：哈希资源长期缓存，文章每次重新验证，未使用哈希的图片采用短缓存。

## 内容目录

- `docs/algorithms/`：算法
- `docs/agent/`：Agent
- `docs/interviews/`：个人真实面经
- `docs/deployment/`：部署与环境配置
- `docs/systems/`：操作系统、网络、Linux 与并发
- `docs/backend/`：Java、Spring、数据库与中间件
- `docs/public/images/`：文章图片

新增 Markdown 文件后，首页、分类页、搜索索引和侧边栏会在开发或构建时自动读取，无需手工维护导航配置。
