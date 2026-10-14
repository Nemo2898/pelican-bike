// 鱼群系统:海面跃鱼(可抓) + 环境鱼 + 自动驾驶目标
import * as THREE from 'three'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t

// 跃鱼轨迹:z 从海里(-10)缓出扫向车道;y 抛物线
const Z_START = -10

export class FishSystem {
  constructor(app) {
    this.app = app
    this.leaps = []
    this.spawnT = 1.6
    this._tmp = new THREE.Vector3()
    this.leapTemplate = this._fishMesh(false)
    this.ambTemplate = this._fishMesh(true)
    this.seaFish = []
    for (let i = 0; i < 48; i++) {
      const m = this.ambTemplate.clone()
      m.scale.setScalar(0.75)
      m.position.set((Math.random() - 0.5) * 260, -0.4, -9 - Math.random() * 50)
      m.rotation.y = Math.PI / 2
      this.app.scene.add(m)
      this.seaFish.push({ m, vx: 0.4 + Math.random() * 1.2, phase: Math.random() * 7 })
    }
    this.maxSea = 34
  }
  _fishMesh(dark) {
    const g = new THREE.Group()
    const mat = dark
      ? new THREE.MeshStandardMaterial({ color: 0x3f5a6b, roughness: 0.6 })
      : new THREE.MeshStandardMaterial({ color: 0xc9d6de, roughness: 0.35, metalness: 0.35 })
    const body = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), mat)
    body.scale.set(0.09, 0.12, 0.3)
    g.add(body)
    const tailMat = dark ? mat : new THREE.MeshStandardMaterial({ color: 0xf2903c, roughness: 0.5 })
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 6), tailMat)
    tail.rotation.x = -Math.PI / 2
    tail.position.z = -0.34
    tail.scale.set(0.6, 1, 1)
    g.add(tail)
    const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 4), tailMat)
    dorsal.position.set(0, 0.15, -0.02)
    g.add(dorsal)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x10131a, roughness: 0.2 })
    for (const x of [-0.06, 0.06]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 6), eyeMat)
      eye.position.set(x, 0.04, 0.2)
      g.add(eye)
    }
    return g
  }
  setQuality(t) {
    this.maxSea = [14, 24, 34, 44][t]
    this.seaFish.forEach((f, i) => { f.m.visible = i < this.maxSea })
  }
  leapZ(l, u) { return lerp(Z_START, l.zEnd, Math.sin(clamp(u, 0, 1) * Math.PI / 2)) }
  leapY(l, u) { return l.y0 + (l.y1 - l.y0) * clamp(u, 0, 1) + Math.sin(clamp(u, 0, 1) * Math.PI) * l.h }
  spawnLeap() {
    const b = this.app.bike
    const T = 1.7 + Math.random() * 0.8
    const dist = Math.max(9, b.speed * T * 0.9 * (0.85 + Math.random() * 0.3))
    const l = {
      mesh: this.leapTemplate.clone(),
      sx: b.x + dist,
      zEnd: 3.3 + Math.random() * 2.3,
      T, t: 0,
      h: 1.4 + Math.random() * 2.2,
      y0: -0.45, y1: 0.15,
      caught: false, dead: false,
    }
    this.app.scene.add(l.mesh)
    this.app.fx.burst(new THREE.Vector3(l.sx, -0.3, Z_START + 0.6), 'splash', 10)
    this.leaps.push(l)
  }
  update(dt) {
    const app = this.app, b = app.bike, st = app.state
    // 环境鱼
    for (const f of this.seaFish) {
      if (!f.m.visible) continue
      f.m.position.x += f.vx * dt
      const dx = f.m.position.x - b.x
      if (dx < -130) f.m.position.x += 260
      if (dx > 130) f.m.position.x -= 260
      f.m.position.y = -0.42 + Math.sin(st.time * 1.6 + f.phase) * 0.16
      f.m.rotation.z = Math.sin(st.time * 3 + f.phase) * 0.25
    }
    // 生成
    this.spawnT -= dt
    if (this.spawnT <= 0 && this.leaps.length < 3 && st.time > 3) {
      this.spawnT = 2.0 + Math.random() * 3.0
      this.spawnLeap()
    }
    // 跃鱼
    for (const l of this.leaps) {
      if (l.dead) continue
      l.t += dt
      const u = l.t / l.T
      if (u >= 1) {
        l.dead = true
        app.scene.remove(l.mesh)
        app.fx.burst(new THREE.Vector3(l.sx, 0.06, l.zEnd), 'splash', 8)
        app.audio.splat()
        continue
      }
      const y = this.leapY(l, u)
      const z = this.leapZ(l, u)
      l.mesh.position.set(l.sx, y, z)
      const vy = (this.leapY(l, u + 0.03) - y) / (0.03 * l.T)
      const vz = (this.leapZ(l, u + 0.03) - z) / (0.03 * l.T)
      l.mesh.rotation.x = clamp(-Math.atan2(vy, Math.max(vz, 0.1)), -1.1, 1.1)
      l.mesh.rotation.z = Math.sin(u * Math.PI) * 0.3
      l.mesh.rotation.y = 0
      // 抓捕判定
      const ref = this._tmp.set(b.x + 0.35, b.y + 1.25, b.z)
      const dh = Math.hypot(l.mesh.position.x - ref.x, l.mesh.position.z - ref.z)
      const dv = Math.abs(l.mesh.position.y - ref.y)
      if (dh < 1.5 && dv < 1.25) {
        l.caught = true; l.dead = true
        app.scene.remove(l.mesh)
        const pos = new THREE.Vector3(l.sx, l.mesh.position.y, l.mesh.position.z)
        app.audio.catchFish()
        app.fx.burst(pos, 'splash', 16)
        app.fx.burst(pos, 'sparkle', 6)
        app.fx.text(pos, '+1 🐟')
        app.hud.flash()
        app.rig.addShake(0.05)
        st.fishTotal++
        if (st.nightW > 0.5) st.nightFish++
        if (b.airborne) st.airCatch++
        if (b.wheelie > 0.25) st.wheelieCatch++
        st.catchTimes.push(st.time)
        st.catchTimes = st.catchTimes.filter(t => st.time - t < 10)
        st.comboNow = st.catchTimes.length
        st.maxCombo = Math.max(st.maxCombo, st.comboNow)
        st.lunge = 0.35
        app.bike.addBasketFish(this.leapTemplate)
      }
    }
    this.leaps = this.leaps.filter(l => !l.dead)
  }
  lookTarget() {
    const b = this.app.bike
    let best = null, bd = 60
    for (const l of this.leaps) {
      const d = l.mesh.position.distanceTo(b.headWorld)
      if (d < bd) { bd = d; best = l }
    }
    return best ? best.mesh.position : null
  }
  // 自动驾驶:预测鱼过路口的时刻,给车道/速度/跳跃建议
  intercept(bike) {
    let best = null, bestScore = 1e9
    for (const l of this.leaps) {
      const dx = l.sx - bike.x
      if (dx < 1.5) continue
      const t = dx / Math.max(2.5, bike.speed)
      if (t > l.T * 1.05) continue
      const u = clamp(t / l.T, 0, 1)
      const score = Math.abs(u - 0.9)
      if (score < bestScore) { bestScore = score; best = { l, t, dx } }
    }
    if (!best) return null
    const l = best.l
    const tCross = 0.88 * l.T
    const uq = clamp(best.t / l.T, 0.6, 0.98)
    const yAt = this.leapY(l, uq)
    return {
      dx: best.dx,
      tCross,
      targetZ: clamp(this.leapZ(l, 0.92), -0.5, 5.2),
      jump: yAt > 2.3,
    }
  }
}
