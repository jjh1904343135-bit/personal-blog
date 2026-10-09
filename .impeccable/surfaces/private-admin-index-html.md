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

STORY: 查看真实文章，按六栏目筛选，编辑 Markdown 并预览，保存到本机；明确看到自动同步是否开启及 GitHub 推送状态。

FIRST VIEWPORT: 左侧窄栏放头像、文章和配图导航以及隐私说明；主区左对齐标题“文章管理”，右侧唯一主动作“新建文章”；下方同步提示、搜索与分类过滤，真实文章列表占据主要空间。编辑使用全幅工作区而非弹窗，元数据与正文分组，预览在桌面并排、手机切换。

FORM: 用户已确认的标准内容管理工作台，精确范围内扩展既有视觉系统；无概念抽签，seed 不适用。标志性交互为保存反馈接续同步状态，不假装推送已等于上线。

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
