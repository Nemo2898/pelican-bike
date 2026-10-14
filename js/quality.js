// 画质自适应:按帧率升降档
export class Quality {
  constructor(app) {
    this.app = app
    this.ratios = [0.7, 0.9, 1.0, Math.min(1.5, window.devicePixelRatio || 1)]
    this.labels = ['低', '中', '高', '极高']
    const touch = matchMedia('(pointer: coarse)').matches
    this.tier = touch ? 1 : 2
    const q = new URLSearchParams(location.search).get('q')
    if (q != null) { this.tier = Math.max(0, Math.min(3, +q)); this.locked = true }
    this.samples = []
    this.acc = 0
    this.cooldown = 4
  }
  frame(rawDt) {
    if (this.locked) return
    this.samples.push(rawDt)
    this.acc += rawDt
    if (this.acc < 2) return
    const n = this.samples.length
    const avg = this.samples.reduce((a, b) => a + b, 0) / n
    const fps = n / avg
    this.samples.length = 0
    this.acc = 0
    this.cooldown -= 2
    if (this.cooldown > 0) return
    if (fps < 40 && this.tier > 0) this.setTier(this.tier - 1)
    else if (fps > 57 && this.tier < 3) this.setTier(this.tier + 1)
  }
  setTier(t) {
    if (t === this.tier) return
    const up = t > this.tier
    this.tier = t
    this.cooldown = 10
    this.apply()
    this.app.hud?.qualityChip(this.labels[t], up)
  }
  apply() {
    const app = this.app
    app.renderer.setPixelRatio(this.ratios[this.tier])
    // 低画质直接关阴影(需要材质重编译,只在中低档切换时发生)
    const wantShadows = this.tier >= 1
    if (app.renderer.shadowMap.enabled !== wantShadows) {
      app.renderer.shadowMap.enabled = wantShadows
      app.scene.traverse(o => {
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material]
          for (const m of mats) m.needsUpdate = true
        }
      })
    }
    app.world?.setQuality(this.tier)
    app.bikeP?.setQuality(this.tier)
    app.fish?.setQuality(this.tier)
  }
}
