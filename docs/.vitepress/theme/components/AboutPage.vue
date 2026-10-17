<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vitepress'
import { profile } from '../../../profile.js'

const router = useRouter()
const page = ref(null)
const hero = ref(null)
const portrait = ref(null)
const modal = ref(null)
const closeButton = ref(null)
const isOpen = ref(false)
const expression = ref('neutral')
const expressionStates = ['neutral', 'left', 'right', 'up-left', 'up', 'up-right', 'down', 'down-left', 'down-right']
let pendingExpression = 'neutral'
let expressionChangedAt = 0
let expressionTimer
let opener
let previousOverflow = ''
const canvas = ref(null)
const activeFolder = ref('experience')

const folders = [
  { key: 'experience', no: '01', title: '实习经历', en: 'EXPERIENCE', note: '语势科技 · Agent 应用开发' },
  { key: 'projects', no: '02', title: '项目经历', en: 'PROJECTS', note: '青程 AI · 惠闪购' },
  { key: 'skills', no: '03', title: '技能清单', en: 'SKILLS', note: 'Agent · RAG · Backend' },
  { key: 'education', no: '04', title: '教育经历', en: 'EDUCATION', note: 'BJUT · IMUT' }
]

let canvasFrame = 0
let canvasContext
let ripples = []
let lastRipple = 0
let reduceMotion = false
let coarsePointer = false

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function heroIsVisible() {
  if (!hero.value) return false
  const rect = hero.value.getBoundingClientRect()
  return rect.top > -window.innerHeight * .25 && rect.bottom > window.innerHeight * .35
}

function updateEyes(event) {
  if (isOpen.value || reduceMotion || coarsePointer || !portrait.value || !heroIsVisible()) return
  const rect = portrait.value.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height * .38
  const nx = clamp((event.clientX - centerX) / (window.innerWidth * .42), -1, 1)
  const ny = clamp((event.clientY - centerY) / (window.innerHeight * .5), -1, 1)
  const horizontal = nx < -.18 ? 'left' : nx > .18 ? 'right' : ''
  const vertical = ny < -.2 ? 'up' : ny > .26 ? 'down' : ''
  const state = [vertical, horizontal].filter(Boolean).join('-') || 'neutral'
  const now = performance.now()
  if (state !== pendingExpression) {
    pendingExpression = state
    expressionChangedAt = now
    clearTimeout(expressionTimer)
    expressionTimer = setTimeout(() => { expression.value = state }, 65)
  }
  // A short dwell prevents flicker when the pointer crosses sector boundaries.
  if (state !== expression.value && now - expressionChangedAt >= 65) expression.value = state

  if (canvasContext && now - lastRipple > 95) {
    ripples.push({ x: event.clientX, y: event.clientY, born: now, life: 340, max: 28, alpha: .1 })
    lastRipple = now
  }
}

function resetEyes() {
  clearTimeout(expressionTimer)
  expression.value = 'neutral'
  pendingExpression = 'neutral'
}

function onScroll() {
  if (!heroIsVisible()) resetEyes()
}

function selectFolder(key) {
  activeFolder.value = key
  opener = document.activeElement
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  isOpen.value = true
  resetEyes()
  nextTick(() => closeButton.value?.focus())
}

function closeModal() {
  isOpen.value = false
  document.body.style.overflow = previousOverflow
  nextTick(() => opener?.focus())
}

function handleModalKey(event) {
  if (!isOpen.value) return
  if (event.key === 'Escape') closeModal()
  if (event.key !== 'Tab') return
  const nodes = modal.value?.querySelectorAll('button, a[href], [tabindex="0"]')
  if (!nodes?.length) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function resizeCanvas() {
  if (!canvas.value) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.value.width = Math.round(window.innerWidth * dpr)
  canvas.value.height = Math.round(window.innerHeight * dpr)
  canvas.value.style.width = `${window.innerWidth}px`
  canvas.value.style.height = `${window.innerHeight}px`
  canvasContext = canvas.value.getContext('2d')
  canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function addClickRipple(event) {
  if (!canvasContext || reduceMotion || coarsePointer) return
  ripples.push({ x: event.clientX, y: event.clientY, born: performance.now(), life: 430, max: 70, alpha: .3, click: true })
}

function drawRipples(now) {
  if (!canvasContext) return
  canvasContext.clearRect(0, 0, window.innerWidth, window.innerHeight)
  ripples = ripples.filter(item => now - item.born < item.life)
  for (const ripple of ripples) {
    const t = clamp((now - ripple.born) / ripple.life, 0, 1)
    const eased = 1 - Math.pow(1 - t, 3)
    const rings = ripple.click ? 3 : 2
    for (let ring = 0; ring < rings; ring += 1) {
      const delayed = clamp(t - ring * .08, 0, 1)
      canvasContext.beginPath()
      canvasContext.arc(ripple.x, ripple.y, 6 + ripple.max * eased + ring * 6, 0, Math.PI * 2)
      canvasContext.strokeStyle = `rgba(113, 137, 204, ${ripple.alpha * (1 - delayed)})`
      canvasContext.lineWidth = ripple.click ? .9 : .6
      canvasContext.stroke()
    }
  }
  canvasFrame = requestAnimationFrame(drawRipples)
}

function goHome(event) {
  event.preventDefault()
  router.go('/')
}

onMounted(async () => {
  await nextTick()
  reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches
  coarsePointer = matchMedia('(pointer: coarse)').matches
  addEventListener('scroll', onScroll, { passive: true })
  addEventListener('resize', resizeCanvas, { passive: true })
  addEventListener('keydown', handleModalKey)
  if (!reduceMotion && !coarsePointer) {
    resizeCanvas()
    canvasFrame = requestAnimationFrame(drawRipples)
  }
})

onBeforeUnmount(() => {
  removeEventListener('scroll', onScroll)
  removeEventListener('resize', resizeCanvas)
  removeEventListener('keydown', handleModalKey)
  if (isOpen.value) document.body.style.overflow = previousOverflow
  cancelAnimationFrame(canvasFrame)
  clearTimeout(expressionTimer)
})
</script>

<template>
  <main ref="page" class="about-page" @pointermove="updateEyes" @pointerleave="resetEyes" @click="addClickRipple">
    <canvas ref="canvas" class="ripple-canvas" aria-hidden="true" />

    <header class="about-nav" :inert="isOpen">
      <a class="about-brand" href="/" @click="goHome">
        <img src="/images/okzu-avatar.webp" alt="">
        <span><b>ok俎</b> / PORTFOLIO</span>
      </a>
      <div class="nav-line"></div>
      <span class="nav-meta">AGENT · BACKEND · CODE <i></i></span>
      <a class="back-link" href="/" @click="goHome">返回博客 ↗</a>
    </header>

    <section ref="hero" class="portfolio-hero" :inert="isOpen">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="hero-title">
        <p>ABOUT ME</p>
        <h1><em>{{ profile.name }}</em><br>个人介绍</h1>
        <span>{{ profile.role }}</span>
      </div>

      <div ref="portrait" class="portrait-stage" :data-expression="expression" aria-label="根据鼠标方向展示原视频中的人物眼神和表情">
        <div class="portrait-halo"></div>
        <img v-for="state in expressionStates" :key="state" class="video-expression" :class="{ 'is-current': expression === state }" :src="`/images/about-expressions/${state}.webp`" :alt="state === 'neutral' ? '从原视频提取的俎嘉辉卡通人物' : ''" :aria-hidden="expression !== state" draggable="false">
        <span class="gaze-tip">移动鼠标<br>看看我的表情 ↗</span>
      </div>

      <button
        v-for="folder in folders"
        :key="folder.key"
        type="button"
        class="folder-ticket"
        :class="`ticket-${folder.key}`"
        @click.stop="selectFolder(folder.key)"
      >
        <span class="ticket-no">{{ folder.no }}</span>
        <span class="ticket-copy"><b>{{ folder.title }}</b><small>{{ folder.en }}</small><i>{{ folder.note }}</i></span>
        <span class="ticket-dots">⠿</span>
        <span class="ticket-action">点击查看 ↘</span>
      </button>

      <div class="hero-note">
        <b>Stay curious.</b>
        <span>把不确定的想法，做成可靠的作品。</span>
      </div>
      <div class="scroll-hint">点击票券，打开我的档案</div>
    </section>

    <Teleport to="body">
    <Transition name="archive">
    <div v-if="isOpen" class="archive-overlay" @click.self="closeModal">
    <section ref="modal" class="archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
      <header class="archive-header">
        <span>{{ folders.find(folder => folder.key === activeFolder)?.no }} / 个人档案</span>
        <h2 id="archive-title">{{ folders.find(folder => folder.key === activeFolder)?.title }}</h2>
        <p>{{ folders.find(folder => folder.key === activeFolder)?.note }}</p>
        <button ref="closeButton" type="button" class="archive-close" aria-label="关闭卡片" @click="closeModal">×</button>
      </header>
      <div class="folder-shell">
        <div class="folder-paper">

          <div v-if="activeFolder === 'experience'" class="folder-view experience-view">
            <div class="view-copy">
              <p class="file-kicker">{{ profile.experience.period }}</p>
              <h2>{{ profile.experience.company }}</h2>
              <h3>{{ profile.experience.role }}</h3>
              <p>{{ profile.experience.summary }}</p>
              <div class="metrics">
                <article v-for="metric in profile.experience.metrics" :key="metric.label">
                  <strong>{{ metric.value }}</strong><span>{{ metric.label }}</span><small>{{ metric.note }}</small>
                </article>
              </div>
            </div>
          </div>

          <div v-else-if="activeFolder === 'projects'" class="folder-view projects-view">
            <article v-for="(project, index) in profile.projects" :key="project.name" class="project-file">
              <span>0{{ index + 1 }} / {{ project.type }}</span>
              <h2>{{ project.name }}</h2>
              <p>{{ project.description }}</p>
              <div><i v-for="item in project.stack" :key="item">{{ item }}</i></div>
              <a v-if="project.link" :href="project.link" target="_blank" rel="noreferrer">查看 GitHub ↗</a>
            </article>
          </div>

          <div v-else-if="activeFolder === 'skills'" class="folder-view skills-view">
            <div class="skill-intro"><p class="file-kicker">WHAT I CAN DO</p><h2>从模型能力，<br>一路做到生产环境。</h2><p>关注可解释、可评估、可观测和真正能够部署的工程方案。</p></div>
            <article v-for="skill in profile.skills" :key="skill.title">
              <span>{{ skill.icon }}</span><h3>{{ skill.title }}</h3><ul><li v-for="item in skill.items" :key="item">{{ item }}</li></ul>
            </article>
          </div>

          <div v-else class="folder-view education-view">
            <article v-for="(item, index) in profile.education" :key="item.school">
              <span>0{{ index + 1 }}</span>
              <div><p>{{ item.period }}</p><h2>{{ item.school }}</h2><h3>{{ item.degree }}</h3><p>{{ item.detail }}</p></div>
            </article>
            <aside><b>NOW</b><span>北京工业大学 · DMS 实验室</span><small>分布式系统 / 区块链 / 信息安全</small></aside>
          </div>
        </div>
      </div>
      <footer class="archive-footer"><span>ok俎 / 俎嘉辉</span><span>保持好奇。</span></footer>
    </section>
    </div>
    </Transition>
    </Teleport>
  </main>
</template>

<style scoped>
.about-page{--ink:#151b25;--paper:#f1f0eb;--red:#ef766e;--blue:#7189cc;--mint:#72bdb3;position:relative;min-height:100vh;overflow:clip;color:#f7f5ef;background:#121923;font-family:var(--vp-font-family-base);--eye-x:0px;--eye-y:0px}.ripple-canvas{position:fixed;z-index:80;inset:0;pointer-events:none}.about-nav{position:absolute;z-index:70;top:0;left:50%;width:min(1240px,calc(100% - 52px));height:72px;display:flex;align-items:center;gap:20px;border-bottom:1px solid rgba(240,244,248,.28);transform:translateX(-50%)}.about-brand{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font:11px var(--vp-font-family-mono);letter-spacing:.05em;white-space:nowrap}.about-brand img{width:40px;height:40px;object-fit:cover;border:3px solid #f3f3ed;border-radius:13px;box-shadow:0 4px 0 rgba(0,0,0,.3);transform:rotate(-5deg)}.about-brand b{font:800 15px var(--vp-font-family-base)}.nav-line{height:1px;flex:1;background:rgba(255,255,255,.28)}.nav-meta{display:flex;align-items:center;gap:10px;color:#c0c7d1;font:10px var(--vp-font-family-mono);white-space:nowrap}.nav-meta i{width:10px;height:10px;border-radius:50%;background:var(--red);box-shadow:0 0 14px var(--red)}.back-link{padding:10px 13px;border:1px solid rgba(255,255,255,.22);border-radius:10px;color:#fff;text-decoration:none;font-size:12px;font-weight:800;background:rgba(255,255,255,.06)}
.portfolio-hero{position:relative;min-height:100svh;overflow:hidden;background:radial-gradient(circle at 52% 40%,rgba(113,137,204,.19),transparent 29%),linear-gradient(145deg,#172130,#101720 72%)}.hero-grid{position:absolute;inset:0;opacity:.12;background-image:linear-gradient(rgba(220,230,240,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(220,230,240,.18) 1px,transparent 1px);background-size:58px 58px;mask-image:linear-gradient(#000,transparent 88%)}.hero-title{position:absolute;z-index:8;left:max(4.5vw,calc((100vw - 1240px)/2));bottom:8vh}.hero-title>p{margin:0 0 10px;color:var(--red);font:800 clamp(2rem,4.5vw,4.7rem) var(--vp-font-family-base);letter-spacing:-.06em}.hero-title h1{margin:0;font-size:clamp(3.2rem,6vw,6.4rem);line-height:.84;letter-spacing:-.08em}.hero-title h1 em{color:#fff;font-style:normal}.hero-title>span{display:inline-block;margin-top:23px;padding:8px 12px;border:1px solid rgba(255,255,255,.16);border-radius:8px;color:#aeb8c7;font:10px var(--vp-font-family-mono);letter-spacing:.08em}.portrait-stage{position:absolute;z-index:5;bottom:-4%;left:52%;width:min(43vw,610px);aspect-ratio:1122/1402;filter:drop-shadow(0 28px 45px rgba(0,0,0,.36));transform:translateX(-50%)}.portrait-halo{position:absolute;z-index:-1;inset:13% -9% 2%;border:1px solid rgba(113,137,204,.42);border-radius:48% 48% 38% 40%;background:rgba(113,137,204,.06);box-shadow:0 0 0 48px rgba(113,137,204,.025)}.portrait-stage img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain}.pupil{position:absolute;z-index:2;width:7.8%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 32% 27%,#fff 0 7%,#424955 8% 17%,#0e1117 19% 67%,#312b2a 69%);box-shadow:0 2px 4px rgba(0,0,0,.32),inset 0 -3px 8px rgba(255,255,255,.08);transform:translate3d(var(--eye-x),var(--eye-y),0);will-change:transform}.pupil-left{left:34.1%;top:35.2%}.pupil-right{left:58.1%;top:35.5%}.gaze-tip{position:absolute;z-index:4;right:-17%;top:37%;color:#9ba7b8;font:10px/1.55 var(--vp-font-family-mono);transform:rotate(3deg)}
.folder-ticket{position:absolute;z-index:12;width:255px;min-height:132px;padding:20px 25px 18px;border:4px solid var(--ink);border-radius:10px;color:var(--ink);background:var(--paper);box-shadow:8px 9px 0 rgba(0,0,0,.34);text-align:left;cursor:pointer;transition:transform .23s,box-shadow .23s}.folder-ticket:before,.folder-ticket:after{content:"";position:absolute;top:50%;width:18px;height:38px;border:4px solid var(--ink);background:#151e2a;transform:translateY(-50%)}.folder-ticket:before{left:-8px;border-left:0;border-radius:0 18px 18px 0}.folder-ticket:after{right:-8px;border-right:0;border-radius:18px 0 0 18px}.folder-ticket:hover,.folder-ticket:focus-visible{z-index:20;outline:none;box-shadow:12px 14px 0 rgba(0,0,0,.28);transform:translateY(-7px) rotate(0)}.ticket-no{display:block;color:#df322b;font-size:40px;font-weight:900;line-height:.8;letter-spacing:-.06em}.ticket-copy{display:flex;flex-direction:column;margin-top:9px}.ticket-copy b{font-size:24px;line-height:1;letter-spacing:-.05em}.ticket-copy small{margin-top:3px;color:#606873;font:10px var(--vp-font-family-mono)}.ticket-copy i{margin-top:8px;font-size:12px;font-style:normal;font-weight:700}.ticket-dots{position:absolute;right:13px;top:12px;font-size:21px}.ticket-action{position:absolute;right:14px;bottom:10px;color:#737a83;font:9px var(--vp-font-family-mono)}.ticket-experience{left:7%;top:17%;transform:rotate(-8deg)}.ticket-projects{left:29%;top:10%;transform:rotate(-3deg)}.ticket-skills{right:7%;top:15%;transform:rotate(7deg)}.ticket-education{right:5%;bottom:13%;transform:rotate(9deg)}.hero-note{position:absolute;z-index:7;right:7%;top:48%;display:flex;flex-direction:column;align-items:flex-end}.hero-note b{font:italic 800 38px cursive;transform:rotate(-5deg)}.hero-note span{max-width:220px;margin-top:9px;color:#aeb8c7;font-size:12px;line-height:1.7;text-align:right}.scroll-hint{position:absolute;z-index:8;left:50%;bottom:24px;display:flex;align-items:center;gap:9px;color:#8895a6;font:10px var(--vp-font-family-mono);transform:translateX(-50%)}.scroll-hint span{display:grid;place-items:center;width:26px;height:26px;border:1px solid rgba(255,255,255,.16);border-radius:50%;animation:bob 1.8s ease-in-out infinite}
.dossier-section{position:relative;min-height:100vh;padding:120px max(5vw,calc((100vw - 1180px)/2));color:var(--ink);background:#d9ddd9}.dossier-heading{display:flex;align-items:end;justify-content:space-between;gap:50px;margin-bottom:58px}.dossier-heading span{color:#df322b;font:800 11px var(--vp-font-family-mono);letter-spacing:.12em}.dossier-heading h2{margin:8px 0 0;font-size:clamp(3rem,5.2vw,5.6rem);letter-spacing:-.07em}.dossier-heading>p{max-width:400px;margin:0;color:#596471;line-height:1.8}.folder-shell{position:relative;padding-top:56px}.folder-tabs{position:absolute;z-index:2;top:0;left:24px;display:flex;gap:7px}.folder-tabs button{height:64px;padding:0 24px 14px;border:2px solid var(--ink);border-bottom:0;border-radius:16px 16px 0 0;color:var(--ink);background:#b8c0c8;font:800 13px var(--vp-font-family-base);cursor:pointer;transform:translateY(10px);transition:.2s}.folder-tabs button:nth-child(2){background:#e38a81}.folder-tabs button:nth-child(3){background:#8fa5da}.folder-tabs button:nth-child(4){background:#85c8bd}.folder-tabs button.active{z-index:3;background:var(--paper);transform:translateY(0)}.folder-paper{position:relative;z-index:4;min-height:580px;padding:30px 34px 42px;border:3px solid var(--ink);border-radius:18px 18px 8px 8px;background:var(--paper);box-shadow:14px 16px 0 rgba(21,27,37,.18)}.paper-head{display:flex;justify-content:space-between;padding-bottom:18px;border-bottom:2px solid var(--ink);font:10px var(--vp-font-family-mono);letter-spacing:.08em}.folder-view{padding-top:42px}.experience-view{display:grid;grid-template-columns:1.28fr .72fr;gap:40px}.file-kicker{margin:0;color:#df322b;font:800 11px var(--vp-font-family-mono);letter-spacing:.1em}.view-copy h2{margin:11px 0 3px;font-size:clamp(3rem,5vw,5.3rem);letter-spacing:-.07em}.view-copy h3{margin:0;color:var(--blue);font-size:20px}.view-copy>p:last-of-type{max-width:690px;color:#5a6572;line-height:1.8}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:32px}.metrics article{padding:17px 14px;border:1px solid rgba(21,27,37,.22);border-radius:12px;background:#fff}.metrics strong,.metrics span,.metrics small{display:block}.metrics strong{color:#df322b;font-size:25px;letter-spacing:-.05em}.metrics span{margin-top:10px;font-size:12px;font-weight:800}.metrics small{margin-top:4px;color:#78818b;font-size:10px}.video-card{align-self:stretch;position:relative;overflow:hidden;border:3px solid var(--ink);border-radius:16px;background:#1a2230;box-shadow:7px 8px 0 rgba(21,27,37,.2);transform:rotate(2deg)}.video-card video{width:100%;height:100%;object-fit:cover}.video-card span{position:absolute;right:10px;bottom:10px;padding:7px 9px;border-radius:7px;color:#fff;background:rgba(17,24,35,.82);font:9px var(--vp-font-family-mono)}.projects-view{display:grid;grid-template-columns:1fr 1fr;gap:14px}.project-file{position:relative;min-height:380px;padding:30px;border:2px solid var(--ink);border-radius:14px;background:#fff}.project-file>span{color:#df322b;font:800 10px var(--vp-font-family-mono)}.project-file h2{margin:36px 0 16px;font-size:clamp(2.6rem,4vw,4.2rem);letter-spacing:-.07em}.project-file p{color:#5d6773;line-height:1.8}.project-file>div{display:flex;flex-wrap:wrap;gap:7px;margin-top:24px}.project-file i{padding:6px 9px;border:1px solid rgba(21,27,37,.2);border-radius:99px;font:normal 10px var(--vp-font-family-mono)}.project-file a{position:absolute;right:24px;bottom:24px;color:var(--ink);font-size:12px;font-weight:800}.skills-view{display:grid;grid-template-columns:1.3fr repeat(3,1fr);gap:12px}.skill-intro{padding-right:28px}.skill-intro h2{margin:18px 0;font-size:clamp(2.4rem,3.5vw,4rem);line-height:.98;letter-spacing:-.06em}.skill-intro>p:last-child{color:#626d79;line-height:1.8}.skills-view article{padding:24px;border:2px solid var(--ink);border-radius:14px;background:#fff}.skills-view article>span{display:grid;place-items:center;width:45px;height:45px;border:3px solid var(--ink);border-radius:13px;color:#fff;background:var(--red);box-shadow:4px 4px 0 rgba(21,27,37,.16);font-size:21px;transform:rotate(-5deg)}.skills-view article:nth-of-type(3)>span{background:var(--mint);transform:rotate(5deg)}.skills-view article:nth-of-type(4)>span{background:var(--blue)}.skills-view h3{margin:28px 0 16px}.skills-view ul{display:flex;flex-direction:column;gap:9px;margin:0;padding:0;list-style:none}.skills-view li{padding-bottom:8px;border-bottom:1px solid rgba(21,27,37,.13);color:#5c6672;font-size:12px}.education-view{display:grid;grid-template-columns:1fr 1fr .7fr;gap:14px}.education-view>article{display:grid;grid-template-columns:42px 1fr;gap:20px;padding:26px;border:2px solid var(--ink);border-radius:14px;background:#fff}.education-view>article>span{color:#df322b;font-size:28px;font-weight:900}.education-view article p:first-child{margin:0;color:#75808c;font:10px var(--vp-font-family-mono)}.education-view h2{margin:24px 0 4px;font-size:27px;letter-spacing:-.05em}.education-view h3{margin:0;color:var(--blue);font-size:14px}.education-view article p:last-child{margin-top:20px;color:#606b77;font-size:13px;line-height:1.75}.education-view aside{display:flex;flex-direction:column;justify-content:center;padding:26px;border:2px solid var(--ink);border-radius:14px;color:#fff;background:var(--blue);transform:rotate(2deg)}.education-view aside b{font-size:46px}.education-view aside span{margin-top:20px;font-weight:800}.education-view aside small{margin-top:8px;line-height:1.6}
.contact-section{position:relative;min-height:72vh;display:flex;align-items:center;justify-content:center;flex-direction:column;overflow:hidden;padding:110px 20px 42px;text-align:center;color:var(--ink);background:var(--mint)}.contact-sticker{position:absolute;left:8%;top:17%;padding:11px 15px;border:5px solid #fff;border-radius:14px;color:#fff;background:var(--red);box-shadow:0 7px 0 rgba(21,27,37,.18);font-weight:900;transform:rotate(-8deg)}.contact-section>p{margin:0;font-weight:800}.contact-section h2{margin:24px 0 40px;font-size:clamp(4rem,9vw,9rem);line-height:.86;letter-spacing:-.09em}.contact-section h2 em{color:#fff;font-style:normal;text-shadow:0 5px 0 rgba(21,27,37,.15)}.contact-section>div{display:flex;gap:12px}.contact-section a{padding:14px 17px;border:2px solid var(--ink);border-radius:12px;color:var(--ink);background:rgba(255,255,255,.25);box-shadow:0 5px 0 rgba(21,27,37,.16);text-decoration:none;font-size:13px;font-weight:800}.contact-section small{position:absolute;bottom:25px;font:10px var(--vp-font-family-mono)}@keyframes bob{50%{transform:translateY(5px)}}
@media(max-width:1050px){.folder-ticket{width:220px;min-height:116px;padding:16px 20px}.ticket-copy b{font-size:20px}.ticket-no{font-size:34px}.portrait-stage{width:min(48vw,570px)}.ticket-experience{left:3%}.ticket-projects{left:25%}.ticket-skills{right:3%}.hero-note{display:none}.experience-view{grid-template-columns:1fr}.video-card{height:330px}.skills-view{grid-template-columns:1fr 1fr}.skill-intro{grid-column:1/-1}.education-view{grid-template-columns:1fr 1fr}.education-view aside{grid-column:1/-1}}
@media(max-width:720px){.ripple-canvas,.pupil,.gaze-tip,.hero-grid{display:none}.about-nav{width:calc(100% - 28px);height:64px}.nav-line,.nav-meta,.back-link{display:none}.portfolio-hero{min-height:auto;padding:92px 16px 42px}.portrait-stage{position:relative;left:50%;bottom:auto;width:min(94vw,470px);margin-top:-8px;transform:translateX(-50%)}.portrait-halo{inset:14% 1% 3%}.hero-title{position:relative;left:auto;bottom:auto;z-index:9;margin-top:-112px}.hero-title>p{font-size:2rem}.hero-title h1{font-size:clamp(3.5rem,15vw,5rem)}.hero-title>span{margin-top:15px}.folder-ticket{position:relative;left:auto!important;right:auto!important;top:auto!important;bottom:auto!important;width:100%;min-height:108px;margin-top:14px;transform:none!important}.folder-ticket:first-of-type{margin-top:38px}.ticket-no{position:absolute;left:20px;top:22px}.ticket-copy{margin:0 0 0 62px}.scroll-hint{display:none}.dossier-section{min-height:auto;padding:82px 16px}.dossier-heading{display:block;margin-bottom:45px}.dossier-heading h2{font-size:3.2rem}.dossier-heading>p{margin-top:16px}.folder-shell{padding-top:45px}.folder-tabs{left:8px;right:8px;gap:3px;overflow-x:auto}.folder-tabs button{height:54px;flex:0 0 auto;padding:0 13px 11px;font-size:11px}.folder-paper{min-height:0;padding:22px 17px 28px}.paper-head span:last-child{display:none}.folder-view{padding-top:30px}.experience-view,.projects-view,.skills-view,.education-view{grid-template-columns:1fr}.metrics{grid-template-columns:1fr 1fr}.video-card{height:260px}.project-file{min-height:350px}.skill-intro{grid-column:auto}.education-view aside{grid-column:auto}.contact-section{min-height:70vh}.contact-section>div{flex-direction:column}.contact-section a{overflow-wrap:anywhere}.contact-sticker{left:5%;top:10%;transform:scale(.82) rotate(-8deg)}}
@media(prefers-reduced-motion:reduce){.scroll-hint span{animation:none}.pupil{display:none}}
@media(max-width:720px){.portfolio-hero{display:flex;flex-direction:column}.portrait-stage{order:1}.hero-title{order:2;margin-top:-104px}.folder-ticket{order:3}.pupil{display:block;transform:none!important}}
@media(prefers-reduced-motion:reduce){.pupil{display:block;transform:none!important}}
.portfolio-hero{height:100svh;min-height:640px}.portrait-stage{transform:translateX(-50%) rotate(var(--head-turn,0deg));transform-origin:50% 85%}.eyelid{position:absolute;z-index:3;width:11%;height:1.3%;border-radius:50%;background:linear-gradient(#b87455,#df9b79);box-shadow:0 1px 0 rgba(78,46,30,.18);opacity:0;transition:height .22s,opacity .22s}.eyelid-left{left:31.8%;top:34.6%}.eyelid-right{left:55.8%;top:34.9%}.mood-happy .eyelid,.mood-playful .eyelid{opacity:.9;height:2%}.mood-playful .eyelid-left{height:4.2%}.mood-curious .pupil{scale:.92}.mood-happy .pupil{scale:1.05}.cheek{position:absolute;z-index:3;top:45%;width:9%;height:5%;border-radius:50%;background:radial-gradient(ellipse,rgba(240,108,113,.44),transparent 70%);opacity:0;transition:opacity .3s}.cheek-left{left:26%}.cheek-right{right:23%}.mood-happy .cheek,.mood-playful .cheek{opacity:1}.archive-overlay{position:fixed;z-index:200;inset:0;display:grid;place-items:center;padding:28px;background:rgba(12,17,24,.48);backdrop-filter:blur(10px);font-family:var(--vp-font-family-base)}.archive-dialog{--ink:#181918;--paper:#faf9f5;--blue:#7189cc;position:relative;display:flex;flex-direction:column;width:min(900px,100%);max-height:calc(100svh - 56px);overflow:hidden;border:2px solid #252623;border-radius:4px;color:#181918;background:var(--paper);box-shadow:12px 14px 0 rgba(0,0,0,.22),0 30px 100px rgba(0,0,0,.35)}.archive-header{position:relative;flex-shrink:0;padding:30px 40px 24px;border-bottom:1px solid #deded8}.archive-header>span{color:#a92d34;font-size:11px;font-weight:800;letter-spacing:.14em}.archive-header h2{margin:12px 0 8px;font-size:32px;font-weight:800;line-height:1.2;letter-spacing:-.03em}.archive-header p{margin:0;color:#777971;font-size:14px}.archive-close{position:absolute;right:20px;top:20px;display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:50%;color:#fff;background:#181918;font:26px/1 sans-serif;cursor:pointer}.archive-close:hover{background:#b82e34}.archive-close:focus-visible{outline:3px solid #7189cc;outline-offset:3px}.archive-dialog .folder-shell{padding:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#858780 transparent}.archive-dialog .folder-paper{min-height:0;padding:0 40px 36px;border:0;border-radius:0;box-shadow:none;background:transparent}.archive-dialog .folder-view{padding-top:30px}.archive-dialog .experience-view,.archive-dialog .projects-view,.archive-dialog .skills-view,.archive-dialog .education-view{display:block}.archive-dialog .view-copy h2{font-size:36px}.archive-dialog .metrics{grid-template-columns:repeat(2,1fr);margin-bottom:10px}.archive-dialog .metrics article{border-radius:0;background:transparent}.archive-dialog .project-file{min-height:0;padding:24px 0 30px;border:0;border-bottom:1px solid #deded8;border-radius:0;background:transparent}.archive-dialog .project-file:first-child{padding-top:0}.archive-dialog .project-file:last-child{border-bottom:0}.archive-dialog .project-file h2{margin:12px 0;font-size:29px}.archive-dialog .project-file>div{margin:18px 0}.archive-dialog .project-file i{border-radius:0}.archive-dialog .project-file a{position:static;display:inline-flex;align-items:center;margin-top:8px;padding:12px 20px;min-width:220px;color:white;background:#b72028;text-decoration:none}.archive-dialog .project-file a:hover{background:#961921}.archive-dialog .skill-intro{padding:0 0 18px}.archive-dialog .skill-intro h2{font-size:32px}.archive-dialog .skills-view article{padding:24px 0;border:0;border-top:1px solid #deded8;border-radius:0;background:transparent}.archive-dialog .skills-view ul{flex-direction:row;flex-wrap:wrap}.archive-dialog .skills-view li{padding:7px 10px;border:1px solid #deded8}.archive-dialog .skills-view h3{margin:16px 0}.archive-dialog .education-view>article{margin:0;padding:24px 0;border:0;border-bottom:1px solid #deded8;border-radius:0;background:transparent}.archive-dialog .education-view>article:first-child{padding-top:0}.archive-dialog .education-view aside{margin-top:24px;transform:none}.archive-footer{display:flex;flex-shrink:0;justify-content:space-between;padding:14px 30px;color:#e5e4df;background:#181918;font-size:11px;letter-spacing:.05em}.archive-enter-active,.archive-leave-active{transition:opacity .2s}.archive-enter-active .archive-dialog,.archive-leave-active .archive-dialog{transition:transform .25s}.archive-enter-from,.archive-leave-to{opacity:0}.archive-enter-from .archive-dialog,.archive-leave-to .archive-dialog{transform:translateY(22px) scale(.97)}
@media(max-width:720px){.portfolio-hero{height:100svh;min-height:700px;padding:74px 12px 20px;display:block}.portrait-stage{position:absolute;width:min(82vw,400px);left:50%;bottom:13%;margin:0}.hero-title{position:absolute;left:18px;bottom:4%;margin:0;pointer-events:none}.hero-title>p{font-size:22px}.hero-title h1{font-size:36px;line-height:.95}.hero-title>span{font-size:8px;margin-top:12px}.folder-ticket{position:absolute;width:43%;min-height:92px;margin:0;padding:12px 14px;transform:none!important}.ticket-experience{left:5%!important;top:12%!important}.ticket-projects{left:auto!important;right:5%!important;top:12%!important}.ticket-skills{left:4%!important;bottom:28%!important;top:auto!important}.ticket-education{left:auto!important;right:4%!important;bottom:19%!important;top:auto!important}.ticket-no{position:static;font-size:23px}.ticket-copy{margin:6px 0 0}.ticket-copy b{font-size:16px}.ticket-copy small{font-size:8px}.ticket-copy i{display:none}.ticket-action{font-size:7px;bottom:6px;right:8px}.ticket-dots{font-size:15px;right:8px}.scroll-hint{display:none}.archive-overlay{padding:12px}.archive-dialog{max-height:calc(100svh - 24px)}.archive-header{padding:24px 22px 20px}.archive-header h2{font-size:26px}.archive-header p{max-width:85%;font-size:12px}.archive-close{right:14px;top:14px;width:30px;height:30px}.archive-dialog .folder-paper{padding:0 22px 26px}.archive-dialog .metrics strong{font-size:22px}.archive-footer{padding:13px 20px}}
@media(prefers-reduced-motion:reduce){.portrait-stage{transform:translateX(-50%)}.archive-enter-active,.archive-leave-active,.archive-enter-active .archive-dialog{transition:none}}
.blinking .eyelid{height:7.4%;opacity:1}.blinking .pupil{opacity:0}.pupil{transition:scale .22s,opacity .08s}
.portrait-stage{aspect-ratio:1;transform:translateX(-50%);width:min(49vw,720px)}.portrait-stage .video-expression{opacity:0;pointer-events:none;object-fit:contain}.portrait-stage .video-expression.is-current{opacity:1}.portrait-halo{inset:0 -3% 2%}
@media(max-width:720px){.portrait-stage{width:min(94vw,470px);bottom:21%}}
</style>
