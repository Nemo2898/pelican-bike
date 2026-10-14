// 粒子(水花/尘土/星光) + 漂浮文字 + 闪光
import * as THREE from 'three'

export class FX {
  constructor(app) {
    this.app = app
    this.scene = app.scene
    const cv = document.createElement('canvas')
    cv.width = cv.height = 64
    const c = cv.getContext('2d')
    const g = c.createRadialGradient(32, 32, 2, 32, 32, 30)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.35, 'rgba(255,255,255,0.85)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    c.fillStyle = g; c.fillRect(0, 0, 64, 64)
    this.blobTex = new THREE.CanvasTexture(cv)
    this.blobTex.colorSpace = THREE.SRGBColorSpace
    // 粒子池
    this.parts = []
    for (let i = 0; i < 80; i++) {
      const m = new THREE.SpriteMaterial({ map: this.blobTex, transparent: true, depthWrite: false, opacity: 0 })
      const s = new THREE.Sprite(m)
      s.visible = false
      this.scene.add(s)
      this.parts.push({ s, v: new THREE.Vector3(), life: 0, t: 0, g: -6, s0: 0.3 })
    }
    // 文字池
    this.texts = []
    for (let i = 0; i < 10; i++) {
      const canvas = document.createElement('canvas')
      canvas.width = 256; canvas.height = 128
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, opacity: 0 })
      const s = new THREE.Sprite(m)
      s.visible = false
      this.scene.add(s)
      this.texts.push({ s, canvas, tex, life: 0, t: 0 })
    }
  }
  use(kind) {
    for (const p of this.parts) if (p.life <= 0) return p
    return null
  }
  burst(pos, kind = 'splash', n = 12) {
    const colors = { splash: 0xd6ecff, dust: 0xc9b18a, sparkle: 0xffe9a8 }
    for (let i = 0; i < n; i++) {
      const p = this.use(kind)
      if (!p) return
      p.s.visible = true
      p.s.material.color.setHex(colors[kind] || 0xffffff)
      p.s.material.blending = kind === 'sparkle' ? THREE.AdditiveBlending : THREE.NormalBlending
      p.s.position.copy(pos)
      p.s.position.x += (Math.random() - 0.5) * 0.3
      const dir = new THREE.Vector3((Math.random() - 0.5), Math.random() * (kind === 'dust' ? 0.6 : 1.1), (Math.random() - 0.5)).normalize()
      p.v.copy(dir).multiplyScalar(kind === 'dust' ? 1.6 : 2.6 + Math.random() * 2)
      p.v.y += kind === 'splash' ? 1.6 : 0.4
      p.g = kind === 'splash' ? -7 : -3
      p.t = 0
      p.life = kind === 'dust' ? 0.8 : 0.75
      p.s0 = kind === 'splash' ? 0.22 + Math.random() * 0.16 : 0.16 + Math.random() * 0.12
      p.s.scale.setScalar(p.s0)
      p.s.material.opacity = 0.95
    }
  }
  text(pos, str, color = '#ffe9a8') {
    let t = this.texts.find(x => x.life <= 0)
    if (!t) t = this.texts[0]
    const c = t.canvas.getContext('2d')
    c.clearRect(0, 0, 256, 128)
    c.font = 'bold 58px system-ui, sans-serif'
    c.textAlign = 'center'; c.textBaseline = 'middle'
    c.shadowColor = 'rgba(0,0,0,0.65)'; c.shadowBlur = 14
    c.fillStyle = color
    c.fillText(str, 128, 64)
    t.tex.needsUpdate = true
    t.s.visible = true
    t.s.material.opacity = 1
    t.s.position.copy(pos)
    t.s.scale.set(1.7, 0.85, 1)
    t.t = 0; t.life = 1.25
  }
  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue
      p.t += dt
      if (p.t >= p.life) { p.life = 0; p.s.visible = false; continue }
      p.v.y += p.g * dt
      p.s.position.addScaledVector(p.v, dt)
      if (p.s.position.y < 0.02) { p.s.position.y = 0.02; p.v.y *= -0.3; p.v.x *= 0.8; p.v.z *= 0.8 }
      const k = 1 - p.t / p.life
      p.s.material.opacity = 0.95 * k
      p.s.scale.setScalar(p.s0 * (1 + (1 - k) * 0.8))
    }
    for (const t of this.texts) {
      if (t.life <= 0) continue
      t.t += dt
      if (t.t >= t.life) { t.life = 0; t.s.visible = false; continue }
      t.s.position.y += dt * 0.9
      t.s.material.opacity = 1 - Math.pow(t.t / t.life, 2)
    }
  }
}
