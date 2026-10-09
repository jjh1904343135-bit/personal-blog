import { defineConfig } from 'vitepress'
import { compression } from 'vite-plugin-compression2'
import { categories } from '../categories.js'
import { sidebar } from './sidebar.js'

export default defineConfig({
  lang: 'zh-CN',
  title: 'ok俎的个人博客',
  titleTemplate: ':title · ok俎的个人博客',
  description: '分享算法、Agent、真实面经、部署、系统基础与 Java 后端的个人技术博客',
  appearance: 'force-dark',
  cleanUrls: true,
  lastUpdated: true,
  head: [
    ['meta', { name: 'theme-color', content: '#151a23' }],
    ['meta', { name: 'author', content: 'ok俎' }],
    ['link', { rel: 'icon', type: 'image/png', href: '/images/okzu-avatar.png' }]
  ],
  vite: {
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/private/**', '**/scripts/author-server*']
      }
    },
    plugins: [
      compression({ algorithm: 'gzip', threshold: 1024 }),
      compression({ algorithm: 'brotliCompress', filename: '[path][base].br', threshold: 1024 })
    ]
  },
  themeConfig: {
    logo: '/images/okzu-avatar.webp',
    siteTitle: 'ok俎的个人博客',
    nav: [
      { text: '首页', link: '/' },
      ...categories.map(({ name, path }) => ({ text: name, link: path })),
      { text: '关于我', link: '/about' }
    ],
    sidebar,
    outline: { level: [2, 3], label: '本页目录' },
    search: {
      provider: 'local',
      options: {
        detailedView: true,
        miniSearch: {
          options: {
            // Must be self-contained: VitePress serializes this function into
            // the browser config. Identical word segmentation on both sides.
            tokenize: (text) => {
              if (typeof Intl.Segmenter === 'function') {
                return Array.from(new Intl.Segmenter('zh-CN', { granularity: 'word' }).segment(text))
                  .filter((part) => part.isWordLike).map((part) => part.segment)
              }
              return text.match(/[A-Za-z0-9_]+|[\u3400-\u9fff]/gu) || []
            }
          },
          searchOptions: { combineWith: 'AND' }
        },
        translations: {
          button: { buttonText: '搜索文章', buttonAriaLabel: '搜索文章全文' },
          modal: {
            noResultsText: '没有找到相关文章，请换一个关键词',
            resetButtonTitle: '清除查询',
            backButtonTitle: '关闭搜索',
            displayDetails: '显示正文摘要',
            footer: { selectText: '打开文章', selectKeyAriaLabel: '回车键', navigateText: '切换结果', navigateUpKeyAriaLabel: '方向上键', navigateDownKeyAriaLabel: '方向下键', closeText: '关闭', closeKeyAriaLabel: '退出键' }
          }
        }
      }
    },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdated: { text: '最后更新' },
    darkModeSwitchLabel: '切换主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '文章导航',
    returnToTopLabel: '返回顶部',
    socialLinks: []
  }
})
