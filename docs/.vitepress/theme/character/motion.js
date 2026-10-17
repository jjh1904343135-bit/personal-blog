export const clamp = (value, min = -1, max = 1) => Math.min(max, Math.max(min, value))
const damp = (current, target, dt, time) => current + (target - current) * -Math.expm1(-dt / time)

// Pure, frame-rate-independent controller shared by the renderer and tests.
export function createMotion() {
  const pose = {eyeYaw:0, eyePitch:0, headYaw:0, headPitch:0, smile:0, brow:0, open:0}
  let x = 0, y = 0, engaged = false
  return {
    pose,
    target(nx, ny, active = true) {x = Number.isFinite(nx) ? clamp(nx) : 0; y = Number.isFinite(ny) ? clamp(ny) : 0; engaged = active},
    reset() {x = 0; y = 0; engaged = false},
    step(seconds) {
      const dt = clamp(seconds,0,.06)
      const desired = {headYaw:x*Math.PI/10,headPitch:y*Math.PI/18,eyeYaw:x*.25,eyePitch:y*.16,smile:engaged?.20+.22*(1-Math.abs(x)):0,brow:engaged?Math.abs(y)*.35+Math.abs(x)*.18:0,open:engaged?Math.max(0,y-.35)*.16:0}
      let unsettled = false
      for(const key of Object.keys(pose)) {
        pose[key] = damp(pose[key],desired[key],dt,key.startsWith('eye')?.08:key.startsWith('head')?.17:.23)
        if(Math.abs(pose[key]-desired[key])>.0001)unsettled=true
      }
      return unsettled
    }
  }
}
