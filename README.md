# Internet Field Notes

一个基于 VitePress 的轻量个人技术博客，聚焦算法、Agent、真实面经、部署、计算机系统与 Java 后端。

## 本地开发

要求 Node.js 22.12 或更高版本。

```bash
npm install
npm run docs:dev
```

访问 `http://localhost:5173`。生产构建：

```bash
npm run docs:build
npm run docs:preview
```

开发与预览服务只监听本机，不要将其用作公网服务。当前通过 `overrides` 固定已修补的 Vite 6.4.4 与 simple-git 4.0.2，已验证构建及后台兼容性。依赖审计仍有灰色元数据解析与旧 Decap 校验库的中低风险上游告警，尚非零告警；不要对公开网络暴露开发服务或写作后台，也不要盲目执行 `npm audit fix --force` 降级解析器。

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

## 线上写作与即时发布（Netlify）

线上版本通过 `/write` 登录写作。草稿保存在 Netlify Database，配图保存在 Netlify Blobs；点击发布成功后，访客打开或刷新页面即可看到更新，**不需要为每篇文章推送 GitHub 或等待重建**。已打开的访客页面不会自动刷新。代码和样式更新仍走 Git 部署。

首次启用前必须完成以下设置，否则 `/write` 不会开放写作：

1. 先使用部署预览验证数据库迁移和页面。迁移会复制现有四篇公开文章并保留网址；预览数据库与生产分开。预览链接可能包含生产数据副本，不要随意公开。
2. 在 [okzu-blog Identity 设置](https://app.netlify.com/projects/okzu-blog/identity) 启用 Identity，把注册改为 **Invite only**，邀请自己的邮箱。邀请链接会从首页转到 `/write`，在那里设置密码。
3. 在 Netlify 项目环境变量中设置 `AUTHOR_EMAIL`，值为获邀的同一个邮箱，作用范围包含 **Functions**。不要把密码、数据库连接串写进仓库；改变此变量后重新部署一次代码。
4. 在预览中验证登录、草稿不公开、四个旧网址、发布后刷新立即可见，再发布到生产。

后台支持直接写笔记、导入单个 `.md`，以及导入“一篇 Markdown + 相对路径图片”的 ZIP。YAML 元数据会填入标题、栏目、日期、标签等字段；导入后只生成私有草稿，不自动发布。ZIP 最多 20 MB，解压后最多 30 MB，单张图片最多 4 MB。“导出全部备份”会下载文章、草稿和配图，请定期备份。

线上文章、栏目、全文搜索和 sitemap 从数据库读取，文章页面返回可供搜索引擎读取的完整 HTML。Netlify Free 数据库会消耗月度积分，需监控 Usage。Docker 只保留静态快照，不提供 `/write` 或远端同步。

## 本机旧式写作后台（备用）

本机旧式后台仍可使用，但它与线上数据库**不双向同步**。切换到线上 `/write` 后，不要再用本机旧式“发布”更新线上文章，以免维护两份内容。本机模式的 Markdown、栏目与搜索在构建时读取。启动命令：

```bash
npm run write
```

写作后台独立运行在 `http://127.0.0.1:8081/admin/`。浏览器要求输入账号和密码：默认账号为 `okzu`，未设置密码时，启动终端会显示本次随机密码。关闭后台后该临时密码失效；重启会生成新密码。

若希望固定账号密码，可在根目录 `.env` 中添加 `AUTHOR_USERNAME`、`AUTHOR_PASSWORD`（至少 16 个字符），可通过 `AUTHOR_PORT` 更改端口。`.env` 不进入 Git、Docker 镜像或公开站点。不要把密码写进 `VITE_` 前缀变量或前端代码。

后台只监听本机 `127.0.0.1`，页面、配置与所有读写接口都校验密码；拒绝跨站请求，并限制读写范围为六个分类的文章和博客图片，不允许改分类首页或访问 `.env`。公开页面不显示写文章入口，公开构建中也不包含后台文件。原公开地址 `/admin/index.html` 不再是写作入口。

登录后点击“新建笔记”，直接输入标题和正文，像写笔记一样使用标题、粗体、列表、引用、代码块、表格和链接。代码块支持 Java、SQL、Shell 等语言与高亮；图片可粘贴、拖入正文或从配图库选择。“发布设置”中可以修改文件名、日期、阅读时长、摘要和标签。摘要选填。

输入停顿约 1.2 秒自动保存私有草稿，也可点击“保存草稿”或按 `Ctrl/Cmd + S`。不完整的标题和正文也可以保存。草稿位于 `private/data/drafts/`，新上传配图位于 `private/data/media/`，两者不进入 Git、Docker 或公开构建。刷新后从文章列表继续编辑。请自行备份 `private/data/`，它只存本机，**不是云端笔记同步**。

准备好后点击“发布文章／更新发布”，确认公开后才将 Markdown 写入 `docs/`，复制正文引用的私有配图，并自动安全检查、生产构建、提交推送。其他私有草稿不会一起发布。编辑已发布文章时，原文保持不变，修改先存私有草稿；“丢弃草稿”不会删除公开文章。发布失败仍保留草稿，可修正后再次发布。

后台包含六栏目与状态筛选、搜索、笔记编辑、Markdown 源码、阅读预览和发布记录。含 VitePress 容器、Vue/HTML、脚注或公式等特殊语法的旧文章自动使用源码模式，避免富文本转换丢失内容。普通富文本仍不承诺保留所有 Markdown 方言；复杂文档请直接使用 Markdown 模式。保存冲突不会覆盖他人版本，可导出 Markdown 备份再刷新。“导出”不包含图片文件，私有图片仍需备份。

编辑器依赖随 `npm install` 安装，`npm run write` 和 `npm run admin` 启动前都会自动构建本机编辑器，不依赖外部 CDN。想同时预览公开博客，可在另一个终端运行 `npm run docs:dev`。草稿不会出现在该预览中，后台“阅读预览”用于检查草稿。

本机后台仅监听 `127.0.0.1`，不能从公网登录；线上远端写作入口是 `/write`，其身份认证与存储由 Netlify 提供。

## Docker 部署

```bash
docker compose up -d --build
```

访问 `http://localhost:8080`，健康检查地址为 `/healthz`。生产镜像采用 Node.js 构建、Nginx Alpine 运行的多阶段结构，包含 Gzip、长期静态缓存和路由回退。

构建期还会生成 `.gz` 与 `.br` 预压缩资源；标准 Nginx Alpine 原生启用 Gzip 静态文件。若生产网关支持 Brotli，可直接消费生成的 `.br` 文件。

## Vercel

仓库已包含 `vercel.json`，可在 Vercel 构建静态预览；但 Vercel 不提供本方案的 Netlify Identity、Database、Blobs 与 Functions。不要把 Vercel 静态站点当成线上实时写作版，访问 `/write` 和新发布的远端文章仍以 Netlify 站点为准。

## Netlify

根目录的 `netlify.toml` 已配置 Node.js 22、线上编辑器与 VitePress 构建、发布目录 `docs/.vitepress/dist`。Netlify 同时部署 Functions：静态首页与素材仍由 CDN 托管，动态文章、搜索与 `/write` API 由 Functions 和 Database 提供；不运行 Docker 或本机旧式后台。

本站已连接 GitHub。首次启用远端写作应先使用拉取请求的 Netlify Deploy Preview 验证数据库迁移、Identity 与发布链路，再合并到 `main`。不要用只上传静态目录的 `netlify deploy --dir` 命令替代完整构建，否则 Functions 与数据库迁移不会随之部署。

### GitHub 自动发布

源码仓库：`https://github.com/jjh1904343135-bit/personal-blog`。现有 Netlify 项目 `okzu-blog` 已连接此仓库，生产分支使用 `main`。推送 `main` 会部署网站代码；日常文章在 `/write` 发布，不触发重建。网站地址为 `https://okzu-blog.netlify.app`。

#### 笔记式写作与一键发布

在本机 PowerShell 运行：

```powershell
cd E:\personal_blog
npm run write
```

打开 `http://127.0.0.1:8081/admin/`，使用终端显示的账号密码登录。保持终端运行即可写作。`write` 和 `admin` 均采用同一私有草稿机制，**启动不会推送，自动保存不会公开，点击发布才启动同步**。

后台“已推送”不代表 Netlify 已上线，应等 Deploys 显示 Published 后查看网站。“重试待发布”只同步已经进入 `docs/` 的公开候选内容，不读取私有草稿；失败文章若需要改正文，请在编辑器修正并重新点击发布。同步器会提交所有符合范围的已准备内容，因此不要把未准备公开的内容手动放进 `docs/`。

`Ctrl+C` 关闭后台；不随电脑开机启动。高级用法：用 VS Code 直接编辑公开候选 Markdown 时，可单独启动 `npm run sync:watch`，一次性同步运行 `npm run sync`。**此旧式监视模式会在 `docs/` 保存稳定 30 秒后公开，包括启动前已有改动，不适合私密草稿**。它不监视 `private/data/`，不要与后台发布同时运行。

自动同步只提交六个栏目中除 `index.md` 外的文章及 `docs/public/images/` 内的常见图片。导航、主题、首页、个人资料和配置仍需手动检查提交；不提交密钥、原始私人素材、缓存或构建产物。删除、重命名文章也会同步到公开仓库和网站。

后台发布失败不会持续自动重试；已保存草稿、公开候选文件及本地提交保留，修正后重试发布。只有高级 `sync:watch` 模式会每 30 秒重试。暂存区或未推送提交包含其他文件、远程 main 领先或存在冲突时，先手动处理；工具不会自动拉取、变基、强推或丢弃修改。请只启动一个发布或同步进程，避免同时手动提交 Git。

意外断电留下 `.git/okzu-content-sync.lock` 时，先确认所有同步进程均已退出，再仅删除此锁文件后重启。同步记录只保留本次运行的最近 12 条，不包含账号密码或 API 密钥。

通常直接使用后台“发布”即可；若选择手动维护公开 Markdown，检查后可在项目根目录执行：

```bash
git add -- docs/
git diff --cached --stat
git commit -m "docs: 更新博客文章"
git push origin main
```

`git add -- docs/` 只提交博客文章、图片和前端文件，构建产物与缓存仍被忽略；请在提交前确认文章和配图确实可以公开。若同时修改配置或工具，应检查后单独暂存对应文件。没有变更时无需再次提交。

只有推送到 `main` 才触发 Netlify 发布。等待 Deploys 页面显示 Published 后刷新网站；构建失败不会覆盖已上线版本，可修正后再次推送。保留的 Decap `/api/v1` 属于旧式、受认证保护的直接文件接口，不是笔记草稿接口；普通写作界面使用 `/management`。

公开仓库不存放 `.env`、`.netlify/`、`person/` 原始素材及私钥。`docs/` 中的内容会公开发布；原始简历、电话等未准备公开的信息不要放入该目录。本机后台的代码可进入仓库，但登录密码只保存在被忽略的 `.env` 中。

只发布 `docs/.vitepress/dist`，不要上传整个工作目录，也不要把本机 `.env` 导入 Netlify。`.netlify/` 已被忽略。本机旧式 `/admin`、`/private/*` 仍不可访问；线上 `/write` 是登录入口，`/api/write/*` 在服务端校验作者。公开文章由 Netlify Function 返回 HTML，不存在的文章返回真正的 404。

`docs/public/_headers` 和 `_redirects` 会随构建复制到发布目录：哈希资源长期缓存，文章每次重新验证，未使用哈希的图片采用短缓存。

## 内容目录

- `docs/algorithms/`：算法
- `docs/agent/`：Agent
- `docs/interviews/`：个人真实面经
- `docs/deployment/`：部署与环境配置
- `docs/systems/`：操作系统、网络、Linux 与并发
- `docs/backend/`：Java、Spring、数据库与中间件
- `docs/public/images/`：文章图片

本机静态模式新增 Markdown 文件后会在开发或构建时自动读取；Netlify 线上模式以远端数据库为准，请通过 `/write` 发布。两种模式不自动双向同步。
