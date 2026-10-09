---
name: "ok俎的个人博客"
description: "既有深色、蓝色与卡通头像身份，以及本机写作工作台的视觉扩展。"
colors:
  bg: "#151a23"
  panel: "#1c2330"
  soft: "#252e3d"
  ink: "#f6f4ef"
  muted: "#b2bbc8"
  blue: "#86a8ff"
  blue-hover-public: "#a3bcff"
  blue-hover-private: "#a0baff"
  mint: "#79c8bd"
  coral-public: "#ff7f77"
  action-ink: "#111827"
  divider-public: "rgba(223, 230, 241, .14)"
  input-private: "#121923"
  line-private: "#354151"
  selected-private: "#263753"
  selected-ink-private: "#c2d2ff"
  danger-private: "#872f36"
  danger-hover-private: "#a63b45"
typography:
  display-public:
    fontFamily: "Manrope, Noto Sans SC, sans-serif"
    fontSize: "clamp(2.8rem, 4.4vw, 5.25rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-.03em"
  headline-public:
    fontFamily: "Manrope, Noto Sans SC, sans-serif"
    fontSize: "clamp(2rem, 3vw, 3rem)"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-.03em"
  body-public:
    fontFamily: "Manrope, Noto Sans SC, sans-serif"
    fontSize: "17px"
    lineHeight: 1.9
  mono-public:
    fontFamily: "DM Mono, monospace"
  title-private:
    fontFamily: "Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "1.9rem"
    fontWeight: 650
    letterSpacing: "-.025em"
  body-private:
    fontFamily: "Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: "16px"
  label-private:
    fontFamily: "Segoe UI, Microsoft YaHei, PingFang SC, sans-serif"
    fontSize: ".85rem"
    fontWeight: 500
  markdown-private:
    fontFamily: "Consolas, Microsoft YaHei, monospace"
    fontSize: ".85rem"
    lineHeight: 1.7
rounded:
  tag-private: "5px"
  badge: "6px"
  field-private: "7px"
  control-private: "8px"
  search-public: "10px"
  action-public: "12px"
  container-private: "12px"
  sticker-public: "13px"
  dialog-private: "14px"
  container-public: "16px"
spacing:
  inline: "8px"
  compact: "12px"
  control: "16px"
  group: "20px"
  panel: "24px"
  section: "32px"
components:
  button-primary-public:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.action-public}"
    padding: "0 20px"
  button-primary-public-hover:
    backgroundColor: "{colors.blue-hover-public}"
  card-public:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container-public}"
    padding: "24px"
  button-primary-private:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.action-ink}"
    rounded: "{rounded.control-private}"
    padding: "10px 16px"
  button-primary-private-hover:
    backgroundColor: "{colors.blue-hover-private}"
  button-secondary-private:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control-private}"
    padding: "10px 16px"
  button-danger-private:
    backgroundColor: "{colors.danger-private}"
    textColor: "#fff"
    rounded: "{rounded.control-private}"
    padding: "10px 16px"
  field-private:
    backgroundColor: "{colors.input-private}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field-private}"
    padding: "10px 12px"
  nav-selected-private:
    backgroundColor: "{colors.selected-private}"
    textColor: "{colors.selected-ink-private}"
    rounded: "{rounded.control-private}"
    padding: "14px 12px"
  tag-private:
    textColor: "#c1cbd9"
    rounded: "{rounded.tag-private}"
    padding: "3px 6px"
  container-private:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.container-private}"
    padding: "24px"
  badge-private:
    textColor: "#99ddd1"
    rounded: "{rounded.badge}"
    padding: "4px 9px"
---

# Design System: ok俎的个人博客

## Overview

**Creative North Star: "既有深色、蓝色与卡通头像身份"**

这是已确认的既有身份描述，不新增视觉隐喻。深蓝画布、浅色文字、柔和操作蓝与卡通作者形象连接公开博客和本机后台。公开首页保留较强的卡通表达，阅读页通过安静的边框、清晰层级和稳定行距支持长文。

私有工作台延续同一配色，以中文系统字体、较小圆角、真实内容列表和可辨认的操作状态服务写作。头像保留在品牌位置，正文编辑区不加入卡通装饰。下文带 public/private 的规则仅适用于对应表面；后台组件尺寸不替换公开网站的既有尺寸。

**Key Characteristics:**

- 深色画布与浅色正文形成稳定阅读对比。
- 操作蓝连接链接、主按钮、选择状态与键盘焦点。
- 卡通形象集中于公开品牌表达和私有品牌位置。
- 面板依靠色阶、细线与圆角分组，操作状态同时使用文字。

来源：公开主题 `docs/.vitepress/theme/style.css`；私有工作台 `private/admin/admin.css`、`index.html`、`admin.js`；方向约束 `PRODUCT.md` 与 `.impeccable/surfaces/private-admin-index-html.md`。记录的是完成后的实现，不是新的页面方案。

## Colors

蓝色与深蓝中性色构成共同基础；薄荷辅助状态，珊瑚只继承公开网站的卡通强调。

### Primary

- **操作蓝**（`colors.blue`）：公开链接和主动作，私有主按钮、编辑标签页与焦点轮廓。两个表面分别保留自己的按钮悬停色。

### Secondary

- **薄荷**（`colors.mint`）：公开栏目状态与私有空间提示。后台状态徽章使用同色系边框和文字，具体颜色保存在组件片段中。

### Tertiary

- **珊瑚**（`colors.coral-public`）：公开首页下划线与卡通贴纸，不作为后台的一般操作色。
- **危险红**（`colors.danger-private`）：私有确认删除按钮；危险状态使用明确文字和独立颜色。

### Neutral

- **深蓝画布 / 面板 / 柔和层**（`colors.bg`、`colors.panel`、`colors.soft`）：共同画布和面板，柔和层用于公开网站状态变化。
- **暖白正文 / 灰蓝辅助文字**（`colors.ink`、`colors.muted`）：正文、标题与辅助说明。
- **按钮深色字**（`colors.action-ink`）：亮蓝主按钮上的深色文字。
- **公开透明分隔线**（`colors.divider-public`）：阅读与首页分组。
- **私有输入底色 / 分隔线**（`colors.input-private`、`colors.line-private`）：表单、列表和工作区边界；选中导航另用 `selected-private` 与 `selected-ink-private`。

**The Surface Scope Rule.** 共享身份色；保留各表面已有的字体、控件尺度和分隔线，不能把后台规则推广为公开首页改版。

## Typography

**Display Font:** 公开首页使用 Manrope，中文回退 Noto Sans SC，再回退 sans-serif。

**Body Font:** 公开阅读沿用同一组合；私有操作界面使用 Segoe UI、Microsoft YaHei、PingFang SC、sans-serif。

**Label/Mono Font:** 公开代码使用 DM Mono、monospace；私有 Markdown 输入使用 Consolas、Microsoft YaHei、monospace。

公开页面的较大字阶与中文阅读行距属于现有博客；后台字阶较紧凑，系统字体用于操作界面，不构成新增公共展示字体。

### Hierarchy

- **Display / Headline：** 公开首页使用 frontmatter 的 `display-public` 和 `headline-public`；文章主标题为（2.5rem、1.35 行高），手机为（2rem）。
- **Body：** 公开长文使用 `body-public`，内容容器上限（820px），带侧栏时（760px）。
- **Private Title：** 私有页面标题使用 `title-private`，手机缩至（1.5rem）；文章列表标题为（1rem、600、1.6 行高）。
- **Private Body / Label：** 根字号使用 `body-private`，表单标签使用 `label-private`；正文段落行高（1.6），表格内容（.85rem）。
- **Private Markdown / Preview：** 输入使用 `markdown-private`；预览为（.92rem、1.85 行高、75ch 最大宽度）。

## Layout

公开主题最大布局宽度（1440px），阅读侧栏（280px），顶部导航（68px）；首页横向留白取 `max(clamp(18px, 4vw, 72px), calc((100% - 1480px) / 2))`。栏目网格依次为三列、在（1080px）以下两列、在（760px）以下单列。首页导航在中等宽度换行，小屏为四列入口；首页动作在手机纵向排列。

私有工作台桌面为（230px）侧栏加可收缩主区，主区最大宽度（1540px），留白（40px / max(24px, 4%)）。在（1100px）以下侧栏收至（190px），主区留白（28px 24px）；元数据从四列变两列，正文与预览切换显示。在（720px）以下侧栏成为顶部导航，主区留白（26px 18px），元数据变单列，文章表格变逐条列表，搜索占满一行。正文并排仅用于（1101px）及以上宽度。

私有面板常用（24px）内边距，组间距（20px / 24px），手机面板（18px）。配图网格桌面使用 `repeat(auto-fill, minmax(185px, 1fr))`，手机为两列（12px 间距）；预览图保持 contain，不裁掉文件内容。

## Elevation & Depth

主体采用深色面板、细线和背景色阶建立层次。常规卡片与后台列表没有投影；浮层才使用柔和阴影。公开首页背景的渐变用于保证卡通素材前的文字对比，不扩展为后台装饰。

### Shadow Vocabulary

- **公开搜索浮层：** `0 24px 70px rgba(0, 0, 0, .3)`，继承现有搜索弹层。
- **私有确认对话框：** `0 16px 50px #0005`，遮罩为 `#050d19bb`。

**The Resting Panel Rule.** 常规面板保持无阴影，通过色阶和边界分组；已有柔和投影只用于浮层。

公开动作和卡片状态过渡使用（.2s）与 `cubic-bezier(.16, 1, .3, 1)`；按钮按下下移（1px）。私有操作状态直接变化。两套表面都尊重 reduced-motion。

## Shapes

公开容器沿用较柔和圆角（16px），首页主动作（12px），卡通贴纸（13px）并带白色边框与轻微旋转。私有面板与头像（12px），控件（8px），输入（7px），标签（5px），状态徽章（6px），确认对话框（14px）。这些是已存在的用途映射，不应把所有元素统一成一个圆角。

私有头像继承轻微（-5deg）旋转；表单和正文保持正向排列。图标为描边 SVG，私有图标（20px、1.7 描边），尺寸与文字对齐。

## Components

### Buttons

公开主动作较宽松（52px 最小高度、700 字重），使用操作蓝与深色字；次动作使用面板和透明分隔线。私有主、次、危险动作更紧凑（42px 最小高度、.88rem、600 字重），padding 和颜色由 frontmatter 规定；手机主次按钮使用（10px 12px、.8rem）。私有次按钮悬停背景为 `#263245`。禁用私有按钮 opacity（.55）并使用 wait 光标。

公开焦点轮廓为（3px solid #a8bfff、5px 偏移）；私有按钮、链接、输入、选择器与 summary 为（3px solid 操作蓝、4px 偏移）。私有执行动作后的说明通过状态文本反馈。

### Chips

公开文章标签使用面板背景，圆角（6px），字号（12px）。私有标签为细描边、中性色文字、较小圆角，属于内容元数据，不模拟按钮选中态。私有状态徽章为薄荷色系描边；错误变红色系并保留文字，不能只靠颜色表达。

### Cards / Containers

公开栏目卡保留（16px）圆角、（24px）内边距和透明边框；悬停改变边框与背景，贴纸旋转归零。私有文章列表、元数据与配图卡使用（12px）圆角和面板色；表格标题略亮、行间分隔，列表标题可点击、辅助摘要限制两行。元数据面板（24px）内边距，预览面板（20px）。它们不继承公开贴纸、旋转或交互卡片悬停。

### Inputs / Fields

私有输入使用深色输入底、细线、（7px）圆角与（42px）最小高度。占位字为 `#98a8bc`，caret 使用操作蓝；字段保持可见标签和辅助说明。只读值降为辅助文字色。Markdown 编辑器可纵向调整，桌面最小高度（520px），手机（420px）。错误说明用独立通知块（#482b34 背景、#ffc9c6 文字）。

### Navigation

公开导航是正常文档流中的文字入口，悬停和当前项使用操作蓝与下划线。私有导航为图标加中文文字，默认辅助色，选中为蓝色面板和较亮文字，保留 aria-current；手机变顶部横向按钮。正文视图切换标签以蓝色文字和（2px）下边线显示当前视图。

### Status and media

私有同步条以独立蓝灰底（#1b2b39）汇集徽章、文字和次操作；通知与历史记录保持文字可读。同步阶段文字取真实状态；保存、推送、等待上线使用不同文案。配图卡采用完整图像预览，文件名可以换行，复制动作保持中文文字说明。

## Do's and Don'ts

### Do:

- **Do** 延续深色、操作蓝与现有卡通头像，分别使用公开阅读与私有操作的字体组合。
- **Do** 为键盘操作保留清晰焦点轮廓，并用文字配合状态色。
- **Do** 按各表面的断点重排内容，保留文章、编辑与配图的实际信息。
- **Do** 保留常规面板无阴影和浮层柔和阴影的区别。

### Don't:

- **Don't** 把私有控件尺寸、系统操作字体或管理入口套到公开首页。
- **Don't** 把公开卡通贴纸和旋转装饰复制进后台编辑区。
- **Don't** 用单一颜色替代状态文字，或把已保存、已推送和已上线合并表达。

未固化项：页面标题旁的“＋”仍是文本 glyph，而其他主要图标为 SVG；该存量实现没有上升为未来图标规则，本次文档交接不改实现。sidecar 中合成的 tonalRamp 仅供色板展示，不是新增 CSS 配色尺度。
