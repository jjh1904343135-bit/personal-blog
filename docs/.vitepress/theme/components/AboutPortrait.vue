<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

const canvas = ref(null)
const ready = ref(false)
const images = [
  ['up-left', 'up', 'up-right'],
  ['left', 'neutral', 'right'],
  ['down-left', 'down', 'down-right']
]

let gl
let program
let textures = []
let frame = 0
let lastTime = 0
let visible = true
let observer
let disposed = false
let targetX = 0
let targetY = 0
let gazeX = 0
let gazeY = 0
let headX = 0
let headY = 0
let lastTextureIds = []

const vertexSource = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * .5 + .5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const fragmentSource = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uFrames[4];
uniform vec4 uWeights;
uniform vec2 uGaze;

void main() {
  // The small, feathered deformation lets the eyes lead the slower head turn.
  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);
  vec2 eyeL = vec2(.405, .425);
  vec2 eyeR = vec2(.595, .425);
  vec2 scale = vec2(.085, .05);
  float eyeWeight = exp(-dot((uv - eyeL) / scale, (uv - eyeL) / scale) * 2.0)
                  + exp(-dot((uv - eyeR) / scale, (uv - eyeR) / scale) * 2.0);
  uv -= uGaze * vec2(.012, .006) * min(eyeWeight, 1.0);
  uv.y = 1.0 - uv.y;

  // One source at a time prevents duplicated eyes and stickers during motion.
  float strongest = max(max(uWeights.x, uWeights.y), max(uWeights.z, uWeights.w));
  if (uWeights.x >= strongest) fragColor = texture(uFrames[0], uv);
  else if (uWeights.y >= strongest) fragColor = texture(uFrames[1], uv);
  else if (uWeights.z >= strongest) fragColor = texture(uFrames[2], uv);
  else fragColor = texture(uFrames[3], uv);
}`

function compile(type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(message || '肖像着色器编译失败')
  }
  return shader
}

function textureFor(image) {
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  return texture
}

function pose() {
  const px = Math.min(1.9999, Math.max(0, gazeX + 1))
  const py = Math.min(1.9999, Math.max(0, gazeY + 1))
  const ix = Math.floor(px)
  const iy = Math.floor(py)
  const fx = px - ix
  const fy = py - iy
  return {
    ids: [iy * 3 + ix, iy * 3 + ix + 1, (iy + 1) * 3 + ix, (iy + 1) * 3 + ix + 1],
    weights: [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy]
  }
}

function draw(now) {
  frame = 0
  if (!gl || !visible || document.hidden || disposed) return
  const elapsed = Math.min(64, Math.max(0, now - (lastTime || now)))
  lastTime = now
  const eyeEase = 1 - Math.exp(-elapsed / 72)
  const headEase = 1 - Math.exp(-elapsed / 210)
  gazeX += (targetX - gazeX) * eyeEase
  gazeY += (targetY - gazeY) * eyeEase
  headX += (targetX - headX) * headEase
  headY += (targetY - headY) * headEase

  const { ids, weights } = pose()
  for (let i = 0; i < 4; i += 1) {
    if (lastTextureIds[i] !== ids[i]) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, textures[ids[i]])
      lastTextureIds[i] = ids[i]
    }
  }
  gl.uniform4fv(gl.getUniformLocation(program, 'uWeights'), weights)
  gl.uniform2f(gl.getUniformLocation(program, 'uGaze'), gazeX, gazeY)
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

  const stage = canvas.value?.parentElement
  if (stage) {
    stage.style.setProperty('--portrait-turn-y', `${(headX * 4).toFixed(2)}deg`)
    stage.style.setProperty('--portrait-turn-x', `${(-headY * 2.5).toFixed(2)}deg`)
    stage.style.setProperty('--portrait-shift-x', `${(headX * 4).toFixed(2)}px`)
  }
  if (Math.abs(targetX - gazeX) > .001 || Math.abs(targetY - gazeY) > .001 ||
      Math.abs(targetX - headX) > .001 || Math.abs(targetY - headY) > .001) {
    frame = requestAnimationFrame(draw)
  }
}

function requestDraw() {
  if (gl && visible && !document.hidden && !frame) {
    lastTime = 0
    frame = requestAnimationFrame(draw)
  }
}

function setTarget(x, y) {
  targetX = Math.max(-1, Math.min(1, x))
  targetY = Math.max(-1, Math.min(1, y))
  requestDraw()
}

function reset() {
  setTarget(0, 0)
}

function loadImage(state) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = `/images/about-expressions/${state}.webp`
  })
}

function onVisibilityChange() {
  if (document.hidden) {
    cancelAnimationFrame(frame)
    frame = 0
    reset()
  } else requestDraw()
}

onMounted(async () => {
  await nextTick()
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || matchMedia('(pointer: coarse)').matches) return
  try {
    gl = canvas.value?.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' })
    if (!gl) return
    const vertex = compile(gl.VERTEX_SHADER, vertexSource)
    const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource)
    program = gl.createProgram()
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    gl.deleteShader(vertex)
    gl.deleteShader(fragment)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    gl.useProgram(program)
    const positions = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positions)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(gl.getAttribLocation(program, 'aPosition'))
    gl.vertexAttribPointer(gl.getAttribLocation(program, 'aPosition'), 2, gl.FLOAT, false, 0, 0)
    const sources = await Promise.all(images.flat().map(loadImage))
    if (disposed) return
    textures = sources.map(textureFor)
    gl.uniform1iv(gl.getUniformLocation(program, 'uFrames'), new Int32Array([0, 1, 2, 3]))
    canvas.value.width = 720
    canvas.value.height = 720
    gl.viewport(0, 0, 720, 720)
    // Bind all four samplers before the first frame, including on browsers with lazy uniforms.
    for (let i = 0; i < 4; i += 1) {
      gl.activeTexture(gl.TEXTURE0 + i)
      gl.bindTexture(gl.TEXTURE_2D, textures[4])
    }
    lastTextureIds = [4, 4, 4, 4]
    gl.uniform4fv(gl.getUniformLocation(program, 'uWeights'), [1, 0, 0, 0])
    gl.uniform2f(gl.getUniformLocation(program, 'uGaze'), 0, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    ready.value = true
    observer = new IntersectionObserver(entries => {
      visible = entries[0]?.isIntersecting ?? false
      if (visible) requestDraw()
      else { cancelAnimationFrame(frame); frame = 0; reset() }
    }, { threshold: .05 })
    observer.observe(canvas.value)
    document.addEventListener('visibilitychange', onVisibilityChange)
  } catch (error) {
    console.warn('动态肖像不可用，已保留原视频静态画面。', error)
  }
})

onBeforeUnmount(() => {
  disposed = true
  observer?.disconnect()
  document.removeEventListener('visibilitychange', onVisibilityChange)
  cancelAnimationFrame(frame)
  if (gl) {
    textures.forEach(texture => gl.deleteTexture(texture))
    if (program) gl.deleteProgram(program)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
})

defineExpose({ setTarget, reset })
</script>

<template>
  <img class="portrait-poster" :class="{ 'is-replaced': ready }" src="/images/about-expressions/neutral.webp" alt="从原视频提取的俎嘉辉卡通人物" draggable="false">
  <canvas ref="canvas" class="portrait-motion" :class="{ 'is-ready': ready }" aria-hidden="true" />
</template>

<style scoped>
.portrait-poster,.portrait-motion{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none}
.portrait-poster.is-replaced{opacity:0}
.portrait-motion{opacity:0;transition:opacity .18s ease-out}
.portrait-motion.is-ready{opacity:1}
@media (prefers-reduced-motion:reduce){.portrait-motion{display:none}}
</style>
