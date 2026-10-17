<script setup>
import {onMounted,onBeforeUnmount,ref,watch,nextTick} from 'vue'

const props=defineProps({lookX:{type:Number,default:0},lookY:{type:Number,default:0},tracking:Boolean,blocked:Boolean})
const host=ref(null),canvas=ref(null),state=ref('poster')
const canvasVersion=ref(0)
let engine,observer,media,mounted=false,inView=true,modeVersion=0,coarse=false
function visibility(){engine?.pause(document.hidden||!inView)}
function updateLook(){if(props.blocked||!props.tracking)engine?.reset();else engine?.look(props.lookX,props.lookY)}
async function configure(){
  const version=++modeVersion;engine?.dispose();engine=null;state.value='poster'
  canvasVersion.value++;await nextTick()
  if(!mounted||media.matches)return
  try{
    const {createCharacter}=await import('../character/runtime.js')
    if(!mounted||version!==modeVersion||media.matches)return
    engine=createCharacter({canvas:canvas.value,host:host.value,coarse,onReady:()=>{if(mounted&&version===modeVersion)state.value='ready'},onFailure:()=>{if(mounted&&version===modeVersion)state.value='fallback'}})
    visibility();updateLook()
  }catch{if(mounted&&version===modeVersion)state.value='fallback'}
}
watch(()=>[props.lookX,props.lookY,props.tracking,props.blocked],updateLook)
onMounted(()=>{
  mounted=true;media=matchMedia('(prefers-reduced-motion: reduce)');coarse=matchMedia('(pointer: coarse)').matches
  observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;if(!inView)engine?.reset();visibility()},{threshold:.08});observer.observe(host.value)
  document.addEventListener('visibilitychange',visibility);media.addEventListener('change',configure);configure()
})
onBeforeUnmount(()=>{mounted=false;modeVersion++;engine?.dispose();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);media?.removeEventListener('change',configure)})
</script>

<template>
  <div ref="host" class="character-scene" :data-render-state="state" role="img" aria-label="黑发、眼镜、西装与贴纸的俎嘉辉三维卡通人物，随鼠标自然转头和变化表情">
    <img class="character-poster" src="/models/okzu-character-poster.png" width="900" height="900" alt="" :class="{'is-replaced':state==='ready'}" decoding="async" fetchpriority="high">
    <canvas :key="canvasVersion" ref="canvas" class="character-canvas" :class="{'is-ready':state==='ready'}" aria-hidden="true" />
  </div>
</template>

<style scoped>
.character-scene{position:absolute;inset:0;pointer-events:none;isolation:isolate}.character-poster,.character-canvas{position:absolute;inset:0;display:block;width:100%;height:100%;object-fit:contain}.character-canvas{visibility:hidden}.character-canvas.is-ready{visibility:visible}.character-poster.is-replaced{visibility:hidden}
</style>
