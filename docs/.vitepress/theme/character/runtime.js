import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createMotion } from './motion.js'

export function createCharacter({canvas, host, coarse, onReady, onFailure}) {
  let renderer, model, resizeObserver, disposed=false, ready=false, suspended=false, looping=false, lastTime=0, lowQuality=coarse
  let slowFrames=0, firstFrame=true, renderedFrames=0
  const motion=createMotion(), scene=new THREE.Scene(), pivots={}, morphs=[]
  const camera=new THREE.OrthographicCamera(-2.25,2.25,2.25,-2.25,.1,30)
  camera.position.set(0,2.65,10);camera.lookAt(0,2.65,0)
  const addLight=(color,intensity,position)=>{const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);light.target.position.set(0,2.6,0);scene.add(light,light.target);return light}
  scene.add(new THREE.HemisphereLight(0xcbdcff,0x54463b,1.3))
  // Broad, shadow-free studio lights keep the glasses and eyeballs clean.
  // Geometry normals provide depth without brittle miniature shadow maps.
  addLight(0xffe6d1,3.0,[-3,7,4]);addLight(0xbbd2ff,1.4,[3,4,2]);addLight(0xd4e5ff,2.0,[2,6,-2])

  function release(object) {
    if(!object)return
    const geometries=new Set(),materials=new Set(),textures=new Set()
    object.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const material of [node.material].flat().filter(Boolean)){materials.add(material);for(const value of Object.values(material))if(value?.isTexture)textures.add(value)}})
    for(const geometry of geometries)geometry.dispose()
    for(const material of materials)material.dispose()
    for(const texture of textures){texture.dispose();texture.source?.data?.close?.()}
  }
  function stop() {if(renderer)renderer.setAnimationLoop(null);looping=false;lastTime=0}
  function dispose() {
    if(disposed)return
    disposed=true;stop();resizeObserver?.disconnect();canvas.removeEventListener('webglcontextlost',lost)
    release(model);scene.clear();renderer?.dispose();renderer?.forceContextLoss()
  }
  function fail() {if(disposed)return;onFailure();dispose()}
  function lost(event) {event.preventDefault();fail()}
  function resize() {
    if(disposed||!renderer)return
    const {width,height}=host.getBoundingClientRect()
    if(!width||!height)return
    const ratio=width/height
    camera.left=-2.25*ratio;camera.right=2.25*ratio;camera.updateProjectionMatrix()
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowQuality?1.15:1.6))
    renderer.setSize(width,height,false);wake()
  }
  function apply(pose) {
    pivots.HeadPivot.rotation.set(-pose.headPitch,pose.headYaw,0)
    pivots.NeckPivot.rotation.set(-pose.headPitch*.13,pose.headYaw*.13,0)
    for(const side of ['Eye_L','Eye_R'])pivots[side].rotation.set(-pose.eyePitch,pose.eyeYaw-pose.headYaw*.25,0)
    for(const mesh of morphs)for(const [name,value] of [['Smile',pose.smile],['BrowRaise',pose.brow],['MouthOpen',pose.open]]) {
      const index=mesh.morphTargetDictionary[name]
      if(index!==undefined)mesh.morphTargetInfluences[index]=value
    }
  }
  function frame(now) {
    if(disposed||!ready||suspended){stop();return}
    if(coarse&&lastTime&&now-lastTime<1000/30-1)return
    const dt=lastTime?(now-lastTime)/1000:1/60;lastTime=now
    const active=motion.step(dt);apply(motion.pose)
    const before=performance.now()
    try{renderer.render(scene,camera)}catch{fail();return}
    // Adapt only rendering quality; never change animation response or identity.
    if(!lowQuality&&performance.now()-before>22&&++slowFrames>12){lowQuality=true;resize()}
    canvas.dataset.headYaw=motion.pose.headYaw.toFixed(5);canvas.dataset.headPitch=motion.pose.headPitch.toFixed(5)
    canvas.dataset.eyeYaw=motion.pose.eyeYaw.toFixed(5)
    canvas.dataset.renderedFrames=String(++renderedFrames)
    if(firstFrame){firstFrame=false;onReady()}
    if(!active)stop()
  }
  function wake(){if(disposed||!ready||suspended||looping)return;looping=true;lastTime=0;renderer.setAnimationLoop(frame)}
  async function load() {
    try {
      // Nothing WebGL-related is constructed during SSR or reduced-motion mode.
      renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:!coarse,powerPreference:'low-power'})
      renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05
      canvas.addEventListener('webglcontextlost',lost)
      const result=await new GLTFLoader().loadAsync('/models/okzu-character.glb')
      if(disposed){release(result.scene);return}
      model=result.scene
      for(const name of ['HeadPivot','NeckPivot','Eye_L','Eye_R']){
        const node=model.getObjectByName(name)
        if(!node)throw new Error('Incomplete character rig')
        pivots[name]=node
      }
      model.traverse(node=>{if(node.morphTargetDictionary)morphs.push(node)})
      for(const name of ['Smile','BrowRaise','MouthOpen'])if(!morphs.some(m=>m.morphTargetDictionary[name]!==undefined))throw new Error('Incomplete face controls')
      scene.add(model);await renderer.compileAsync(scene,camera)
      if(disposed)return
      ready=true;resizeObserver=new ResizeObserver(resize);resizeObserver.observe(host);resize()
    }catch{fail()}
  }
  load()
  return {
    look(x,y){if(coarse||disposed)return;motion.target(x,y);wake()},
    reset(){motion.reset();wake()},
    pause(value){suspended=value;if(value)stop();else wake()},
    // Offline poster authoring reads immediately after render, not a preserved
    // drawing buffer on every interactive frame. Same scene, lens and colors.
    capture(){if(!ready||disposed)throw new Error('Character is not ready');renderer.render(scene,camera);return canvas.toDataURL('image/png')},
    dispose
  }
}
