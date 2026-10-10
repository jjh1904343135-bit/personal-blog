---
version: 1
slug: "private-admin-index-html"
primary_target: "private/admin/index.html"
related_targets: ["private/admin/admin.css","private/admin/admin.js"]
---

# 本机中文管理后台

Scope: private/admin；访客模式 Operate。作者每天管理真实 Markdown 与图片，访客网站不变。仅本机密码登录，不引入公网后台。

## Direction contract

THESIS: 作者一进入就能找到自己的文章、开始写作、看清保存和推送的区别；不做虚构流量指标仪表盘。

OWN-WORLD: 继承现有深蓝 #151a23、面板 #1c2330、正文 #f6f4ef、辅助 #b2bbc8、操作蓝 #86a8ff、状态薄荷 #79c8bd；系统中文无衬线用于操作界面，卡通头像仅用于品牌，不装饰编辑区。

STORY: 按六栏目查看已发布文章和私有草稿；直接写连续文档、插入代码与图片，自动保存。检查后点击发布／更新发布，看到安全检查、构建和推送状态；草稿绝不自动公开。

FIRST VIEWPORT: 保留头像窄侧栏与文章列表。进入笔记后顶行是返回、草稿保存状态、保存和发布动作；标题直接位于中央文档顶部，栏目在标题下，发布设置可折叠。连续正文为主要空间，常用工具栏贴近正文，原始 Markdown 与阅读预览为辅助模式；手机工具栏换行，正文不横向撑破。标志交互是内容自动保存与显式发布的分离。

FORM: 用户已确认语雀式连续文档体验，精确范围内扩展现有 Operate 表面；code-led，无概念抽签，seed 不适用。保存只写私有草稿，发布后的“已推送”不冒充 Netlify 已上线。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Implementation evidence — 2026-10-10

本次是既有后台的普通扩展。核对 `DESIGN.md`、`.impeccable/design.json`、`PRODUCT.md` 与 `private/admin/index.html`、`admin.css`、`admin.js`、`note-editor.js` 后，保留全局设计文档与 sidecar 原文；没有改写身份、全局 token 或公共组件。

画布、面板、正文、辅助文字、操作蓝与薄荷仍来自原有 root 变量；主次按钮沿用 42px 高度、8px 圆角、原有悬停色与 3px 蓝色焦点轮廓。中文操作字体仍为 Segoe UI / Microsoft YaHei / PingFang SC，代码仍用 Consolas。侧栏与手机顶部导航保留头像、SVG 图标及带文字的当前状态。常规文档与列表面板无投影，阴影只用于原生对话框；符合 Surface Scope 与 Resting Panel 两条既有规则。

扩展仅记录在此表面：连续文档上限 920px，桌面内边距 32px 44px 20px，手机 22px 16px；笔记标题为 clamp(1.65rem, 3vw, 2.1rem)，正文桌面 1rem / 1.9、手机 .95rem / 1.9，文档辅助标签 .8rem。工具栏贴近正文并换行；代码、表格与图片属于正文内容。新语法着色值表达代码语义，不提升为全站配色规则。

`admin.js` 的 1200ms 自动保存调用私有草稿接口；显式发布按钮才调用发布接口。`note-editor.js` 支持标题、列表、引用、代码语言、表格、私有图片与撤销重做；特殊 VitePress 语法保留源码模式。返回列表及侧栏切换先等待保存；编辑期间文章导航保持 aria-current。`scripts/author-server.js` 的回环监听与密码认证继续限定本机私有入口。

已核对完整页面截图 `notes-desktop.png`、`notes-mobile.png`、`notes-source-mobile.png`、`notes-list-desktop.png`、`notes-list-mobile.png`，以及 `.impeccable/review/notes-findings.md` 的行为与断点检查记录。桌面与手机截图均显示自动保存/未发布文字、独立发布动作、折叠发布设置、连续正文和可辨认导航；代码与表格留在文档边界内。最终检查结论由完成评审给出；本次文档检查不重跑实现测试。

未修补或固化的存量记录：`DESIGN.md` 原先的桌面双栏编辑/预览、Markdown .85rem / 1.7 与旧预览面板描述，以及 sidecar 的“新建与保存”主按钮文案，现已不能完整描述此笔记表面；本次没有授权重写全局系统，所以以上新布局和行为以此表面记录为准。旧文档对“＋”文本图标的存量备注也未改写；当前新建按钮已使用 SVG，不将旧备注推广为规则。
