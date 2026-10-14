// 5 种镜头:追尾 / 电影运镜 / 鹈鹕视角 / 环绕 / 侧跟
import * as THREE from 'three'

const UP = new THREE.Vector3(0, 1, 0)

export class CameraRig {
  constructor(app) {
    this.app = app
    this.camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 2600)
    this.modes = ['chase', 'cine', 'pov', 'orbit', 'side']
    this.modeIndex = 0
    this.pos = new THREE.Vector3(-7, 3, 0)
    this.look = new THREE.Vector3(0, 1.5, 0)
    this.tPos = new THREE.Vector3()
    this.tLook = new THREE.Vector3()
    this.shake = 0
    this.cine = { t: 999, shot: 0, prevPos: new THREE.Vector3(), prevLook: new THREE.Vector3(), blend: 1, dur: 6 }
    this.orbit = { theta: -2.4, phi: 0.3, dist: 8.5, drag: false, px: 0, py: 0 }
    this.sideFlip = -1
    this.sideT = 0
    this._bind()
  }
  _bind() {
    const el = this.app.renderer.domElement
    el.addEventListener('pointerdown', (e) => {
      if (this.modes[this.modeIndex] === 'orbit') { this.orbit.drag = true; this.orbit.px = e.clientX; this.orbit.py = e.clientY }
    })
    addEventListener('pointerup', () => { this.orbit.drag = false })
    addEventListener('pointermove', (e) => {
      if (!this.orbit.drag || this.modes[this.modeIndex] !== 'orbit') return
      this.orbit.theta -= (e.clientX - this.orbit.px) * 0.006
      this.orbit.phi = Math.max(0.04, Math.min(1.25, this.orbit.phi + (e.clientY - this.orbit.py) * 0.004))
      this.orbit.px = e.clientX; this.orbit.py = e.clientY
    })
    el.addEventListener('wheel', (e) => {
      if (this.modes[this.modeIndex] === 'orbit') { e.preventDefault(); this.orbit.dist = Math.max(4, Math.min(20, this.orbit.dist + e.deltaY * 0.01)) }
    }, { passive: false })
  }
  next() { this.set((this.modeIndex + 1) % this.modes.length) }
  set(i) {
    this.modeIndex = Math.max(0, Math.min(4, i))
    const mode = this.modes[this.modeIndex]
    document.body.classList.toggle('cine', mode === 'cine')
    this.cine.t = 999; this.cine.blend = 0
    this.app.hud?.setCam?.(this.modeIndex)
  }
  addShake(a) { this.shake = Math.min(0.5, this.shake + a) }
  update(dt) {
    const app = this.app, st = app.state, b = app.bike
    const mode = this.modes[this.modeIndex]
    this.tPos.copy(this.pos); this.tLook.copy(this.look)
    let fov = 55
    let snapshot = false

    if (mode === 'chase') {
      this.tPos.set(b.x - 7.4 - st.speedKmh * 0.07, b.y * 0.6 + 2.7, b.z * 0.55 + 1.0)
      this.tLook.set(b.x + 3.0, b.y * 0.6 + 1.35, b.z)
      fov = 54 + (st.speedKmh / 52) * 9
    } else if (mode === 'cine') {
      this.cine.t += dt
      if (this.cine.t > this.cine.dur) {
        this.cine.t = 0
        this.cine.prevPos.copy(this.pos); this.cine.prevLook.copy(this.look)
        this.cine.blend = 0
        this.cine.shot = (this.cine.shot + 1 + ((Math.random() * 3) | 0)) % 6
        this.cine.dur = 5.5 + Math.random() * 3
      }
      switch (this.cine.shot) {
        case 0: // 路边低机位
          this.tPos.set(b.x + 1.0, 1.05, b.z - 7.2)
          this.tLook.set(b.x, 1.35, b.z)
          fov = 36; break
        case 1: // 前方倒退跟拍
          this.tPos.set(b.x + 8.5, 0.8, b.z + 0.6)
          this.tLook.set(b.x + 0.5, 1.3, b.z)
          fov = 42; break
        case 2: { // 无人机
          const t = st.time
          this.tPos.set(b.x - 5 + Math.sin(t * 0.4) * 3, 8.5 + Math.sin(t * 0.23) * 1.4, b.z - 8.5)
          this.tLook.set(b.x, 1.2, b.z)
          fov = 50; break
        }
        case 3: { // 围巾特写
          const h = b.headWorld
          this.tPos.set(h.x - 1.5, h.y + 0.55, h.z + 1.2)
          this.tLook.copy(h)
          fov = 30; break
        }
        case 4: // 贴地前轮
          this.tPos.set(b.x - 3.4, 0.4, b.z - 2.6)
          this.tLook.set(b.x + 1.2, 0.9, b.z)
          fov = 40; break
        default: // 前侧广角
          this.tPos.set(b.x + 5.2, 1.7, b.z - 5.6)
          this.tLook.set(b.x + 0.5, 1.2, b.z)
          fov = 46; break
      }
    } else if (mode === 'pov') {
      if (!this._q1) {
        this._q1 = new THREE.Quaternion()
        this._v1 = new THREE.Vector3()
        this._v2 = new THREE.Vector3()
        this._v3 = new THREE.Vector3()
        this._m1 = new THREE.Matrix4()
      }
      const p = b.headWorld, q = b.headQuat
      this.tPos.copy(p).addScaledVector(b.headDir, 0.1)
      this.tPos.y += 0.06
      this.pos.copy(this.tPos)
      this.camera.position.copy(this.pos)
      // 稳定性:头部朝向与车头方向混合,避免盯着高处的鱼天旋地转
      b.group.getWorldQuaternion(this._q1)
      this._v1.set(1, 0, 0).applyQuaternion(this._q1)
      this._v2.copy(b.headDir).lerp(this._v1, 0.55).normalize()
      this._v3.copy(this.pos).addScaledVector(this._v2, 10)
      this._m1.lookAt(this.pos, this._v3, UP)
      this.camera.quaternion.setFromRotationMatrix(this._m1)
      this.camera.fov += (74 - this.camera.fov) * Math.min(1, dt * 5)
      this.camera.updateProjectionMatrix()
      if (this.shake > 0.001) {
        this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.4
        this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.4
      }
      this.shake *= Math.exp(-5 * dt)
      this.look.copy(this.tLook)
      return
    } else if (mode === 'orbit') {
      if (!this.orbit.drag) this.orbit.theta += dt * 0.12
      const { theta, phi, dist } = this.orbit
      this.tPos.set(
        b.x + Math.sin(theta) * Math.cos(phi) * dist,
        b.y + 1.4 + Math.sin(phi) * dist,
        b.z + Math.cos(theta) * Math.cos(phi) * dist
      )
      this.tLook.set(b.x + 1, b.y + 1.25, b.z)
      fov = 50
    } else { // side
      this.sideT += dt
      if (this.sideT > 9) { this.sideT = 0; this.sideFlip *= -1 }
      this.tPos.set(b.x + 1.5, 0.95, b.z + this.sideFlip * 7.5)
      this.tLook.set(b.x + 0.5, 1.3, b.z)
      fov = 38
    }

    // 电影镜头切换混合
    let k = 1 - Math.exp(-6 * dt)
    if (mode === 'cine' && this.cine.blend < 1) {
      this.cine.blend = Math.min(1, this.cine.blend + dt / 0.9)
      const e = this.cine.blend * this.cine.blend * (3 - 2 * this.cine.blend)
      this.pos.lerpVectors(this.cine.prevPos, this.tPos, e)
      this.look.lerpVectors(this.cine.prevLook, this.tLook, e)
    } else {
      this.pos.lerp(this.tPos, k)
      this.look.lerp(this.tLook, k)
    }
    this.camera.position.copy(this.pos)
    if (this.shake > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake
      this.camera.position.y += (Math.random() - 0.5) * this.shake
      this.camera.position.z += (Math.random() - 0.5) * this.shake
    }
    this.camera.lookAt(this.look)
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 4)
    this.camera.updateProjectionMatrix()
    this.shake *= Math.exp(-5 * dt)
  }
}
