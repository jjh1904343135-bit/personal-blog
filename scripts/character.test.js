import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createMotion} from '../docs/.vitepress/theme/character/motion.js'

test('continuous gaze leads the head, is bounded and resets without snapping',()=>{
  const m=createMotion();m.target(10,-10);m.step(1/60)
  assert.ok(m.pose.eyeYaw/.25>m.pose.headYaw/(Math.PI/10));assert.ok(m.pose.headYaw>0&&m.pose.headYaw<.10)
  for(let i=0;i<120;i++)m.step(1/60)
  assert.ok(m.pose.headYaw<=Math.PI/10);assert.ok(Math.abs(m.pose.headPitch)<=Math.PI/18)
  const old=m.pose.headYaw;m.reset();assert.equal(m.pose.headYaw,old);m.step(1/60);assert.ok(m.pose.headYaw<old&&m.pose.headYaw>0)
  for(let i=0;i<200;i++)m.step(1/60)
  for(const value of Object.values(m.pose))assert.ok(Math.abs(value)<.0001)
})
test('motion is invariant across 30/60 Hz and neutralizes invalid inputs',()=>{
  const a=createMotion(),b=createMotion();a.target(.8,.6);b.target(.8,.6)
  for(let i=0;i<30;i++)a.step(1/30)
  for(let i=0;i<60;i++)b.step(1/60)
  for(const key in a.pose)assert.ok(Math.abs(a.pose[key]-b.pose[key])<1e-9,key)
  a.target(NaN,Infinity);for(let i=0;i<300;i++)a.step(1/60);assert.ok(Math.abs(a.pose.headYaw)<.0001)
})
test('Blender GLB contains real geometry, all pivots and facial morphs within budget',async()=>{
  const bytes=await readFile(new URL('../docs/public/models/okzu-character.glb',import.meta.url))
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.ok(bytes.length<8*1024*1024)
  const json=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)))
  for(const name of ['NeckPivot','HeadPivot','Eye_L','Eye_R'])assert.ok(json.nodes.some(n=>n.name===name),name)
  const targets=json.meshes.flatMap(m=>m.extras?.targetNames||[])
  for(const name of ['Smile','BrowRaise','MouthOpen'])assert.ok(targets.includes(name),name)
  let triangles=0;for(const mesh of json.meshes)for(const primitive of mesh.primitives)triangles+=json.accessors[primitive.indices].count/3
  assert.ok(triangles>10000&&triangles<=80000);assert.ok(!json.images?.length,'No image-card character or photo textures')
})
