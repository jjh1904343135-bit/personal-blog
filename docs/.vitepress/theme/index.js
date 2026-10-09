import DefaultTheme from 'vitepress/theme'
import './style.css'
import HomePage from './components/HomePage.vue'
import ArticleList from './components/ArticleList.vue'
import AboutPage from './components/AboutPage.vue'
import BlogLayout from './components/BlogLayout.vue'

export default {
  extends: DefaultTheme,
  Layout: BlogLayout,
  enhanceApp({ app }) {
    app.component('HomePage', HomePage)
    app.component('ArticleList', ArticleList)
    app.component('AboutPage', AboutPage)
  }
}
