// 浏览器实时合成音乐 + 音效;节奏跟随踏频
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export class AudioEngine {
  constructor() {
    this.ready = false
    this.muted = false
    this.bpm = 84
    this.targetBpm = 84
    this.step = 0
    this.nextTime = 0
    this.lastFlap = 0
    this.lastGull = 0
    this.lastCricket = 0
  }
  init() {
    if (this.ready) return
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = this.ctx = new AC()
      const comp = this.comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -14; comp.knee.value = 20; comp.ratio.value = 5
      comp.attack.value = 0.004; comp.release.value = 0.2
      comp.connect(ctx.destination)
      this.master = ctx.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(comp)
      this.music = ctx.createGain(); this.music.gain.value = 0.5; this.music.connect(this.master)
      // 延迟总线(合成器 vibe)
      const delay = ctx.createDelay(1); delay.delayTime.value = 0.31
      const fb = ctx.createGain(); fb.gain.value = 0.32
      const wet = ctx.createGain(); wet.gain.value = 0.22
      this.music.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(this.master)
      this.sfx = ctx.createGain(); this.sfx.gain.value = 0.85; this.sfx.connect(this.master)
      this.amb = ctx.createGain(); this.amb.gain.value = 0.8; this.amb.connect(this.master)
      // 噪声缓冲
      const len = ctx.sampleRate * 2
      const buf = ctx.createBuffer(1, len, ctx.sampleRate)
      const d = buf.getChannelData(0)
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
      this.noiseBuf = buf
      // 环境:海浪
      const waves = ctx.createBufferSource(); waves.buffer = buf; waves.loop = true
      const wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380; wf.Q.value = 0.4
      const wg = ctx.createGain(); wg.gain.value = 0.045
      waves.connect(wf); wf.connect(wg); wg.connect(this.amb); waves.start()
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.08
      const lg = ctx.createGain(); lg.gain.value = 0.02
      lfo.connect(lg); lg.connect(wg.gain); lfo.start()
      // 环境:风(随速度)
      const wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true
      const wf2 = ctx.createBiquadFilter(); wf2.type = 'bandpass'; wf2.frequency.value = 780; wf2.Q.value = 0.55
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0
      wind.connect(wf2); wf2.connect(this.windGain); this.windGain.connect(this.amb); wind.start()

      if (ctx.state === 'suspended') ctx.resume().catch(() => {})
      this.nextTime = ctx.currentTime + 0.08
      this.timer = setInterval(() => this.schedule(), 28)
      this.ready = true
    } catch (e) { console.warn('Audio init failed', e) }
  }
  toggleMute() {
    this.muted = !this.muted
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.9
    return this.muted
  }
  setCadence(rpm) { this.targetBpm = clamp(rpm * 0.95, 66, 148) }
  // ---------- 合成器 ----------
  schedule() {
    if (!this.ready) return
    const ctx = this.ctx
    const spb = 60 / this.bpm / 4
    while (this.nextTime < ctx.currentTime + 0.14) {
      this.playStep(this.step, this.nextTime)
      this.nextTime += spb
      this.step = (this.step + 1) % 64
      if (this.step % 16 === 0) this.bpm += (this.targetBpm - this.bpm) * 0.35
    }
  }
  playStep(step, t) {
    const bar = (step / 16) | 0
    const s = step % 16
    const roots = [55, 43.65, 65.41, 49] // Am F C G 低八度
    const chords = [
      [220, 261.63, 329.63, 440],   // Am
      [174.61, 220, 261.63, 349.23],// F
      [261.63, 329.63, 392, 523.25],// C
      [196, 246.94, 293.66, 392],   // G
    ]
    const ch = chords[bar]
    if (s === 0) this.pad(t, ch)
    if (s === 0 || s === 8 || (bar === 3 && s === 14)) this.kick(t)
    if (s % 2 === 1) this.hat(t, s % 4 === 3 ? 0.1 : 0.055)
    if ([0, 3, 6, 8, 11, 14].includes(s)) this.bass(t, s === 14 ? roots[bar] * 2 : roots[bar], 0.19)
    if (s % 2 === 0) this.pluck(t, ch[((s / 2) | 0) % ch.length] * 2, 0.1, 0.05)
    // 旋律
    const mel = [
      [0, 659.25], [3, 783.99], [6, 880], [10, 783.99], [14, 659.25],
    ]
    const mel2 = [[0, 587.33], [4, 523.25], [8, 587.33], [12, 659.25]]
    const mel3 = [[0, 523.25], [4, 659.25], [8, 783.99], [12, 1046.5], [14, 783.99]]
    const mel4 = [[0, 659.25], [4, 587.33], [8, 523.25], [12, 440]]
    const M = [mel, mel2, mel3, mel4][bar]
    for (const [st, f] of M) if (s === st) this.pluck(t, f, 0.5, 0.075)
  }
  kick(t) {
    const ctx = this.ctx
    const o = ctx.createOscillator(); o.type = 'sine'
    const g = ctx.createGain()
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.12)
    g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.16)
    o.connect(g); g.connect(this.music); o.start(t); o.stop(t + 0.18)
  }
  hat(t, v) {
    const ctx = this.ctx
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7200
    const g = ctx.createGain()
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.035)
    n.connect(f); f.connect(g); g.connect(this.music); n.start(t); n.stop(t + 0.05)
  }
  bass(t, f, dur) {
    const ctx = this.ctx
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 520; fl.Q.value = 4
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(fl); fl.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05)
  }
  pluck(t, f, vel, dur) {
    const ctx = this.ctx
    for (const det of [-3, 3]) {
      const o = ctx.createOscillator(); o.type = 'triangle'
      o.frequency.value = f; o.detune.value = det
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vel, t + 0.008)
      g.gain.exponentialRampToValueAtTime(0.001, t + dur)
      o.connect(g); g.connect(this.music); o.start(t); o.stop(t + dur + 0.05)
    }
  }
  pad(t, fs) {
    const ctx = this.ctx
    for (const f of fs) {
      for (const det of [-5, 5]) {
        const o = ctx.createOscillator(); o.type = 'sawtooth'
        o.frequency.value = f * 0.5; o.detune.value = det
        const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 820
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.028, t + 0.5)
        g.gain.setValueAtTime(0.028, t + 2.6); g.gain.linearRampToValueAtTime(0.0001, t + 3.6)
        o.connect(fl); fl.connect(g); g.connect(this.music); o.start(t); o.stop(t + 3.8)
      }
    }
  }
  // ---------- 音效 ----------
  noise(t, dur, f0, f1, type, gain, q = 1) {
    const ctx = this.ctx
    const n = ctx.createBufferSource(); n.buffer = this.noiseBuf
    n.playbackRate.value = 1
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.Q.value = q
    fl.frequency.setValueAtTime(f0, t)
    if (f1) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    n.connect(fl); fl.connect(g); g.connect(this.sfx); n.start(t); n.stop(t + dur + 0.05)
  }
  tone(t, f0, f1, dur, gain, type = 'sine') {
    const ctx = this.ctx
    const o = ctx.createOscillator(); o.type = type
    o.frequency.setValueAtTime(f0, t)
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.012)
    g.gain.exponentialRampToValueAtTime(0.001, t + dur)
    o.connect(g); g.connect(this.sfx); o.start(t); o.stop(t + dur + 0.05)
  }
  flap() {
    if (!this.ready || this.ctx.currentTime - this.lastFlap < 0.14) return
    this.lastFlap = this.ctx.currentTime
    const t = this.ctx.currentTime
    this.noise(t, 0.14, 260, 950, 'bandpass', 0.16, 1.4)
  }
  jump() { if (!this.ready) return; const t = this.ctx.currentTime; this.tone(t, 260, 860, 0.22, 0.16); this.noise(t, 0.25, 900, 2400, 'highpass', 0.08) }
  land(v) { if (!this.ready) return; const t = this.ctx.currentTime; const g = clamp(0.09 + v * 0.06, 0.08, 0.4); this.tone(t, 110, 46, 0.2, g, 'sine'); this.noise(t, 0.16, 500, 140, 'lowpass', g * 0.7) }
  splat() { if (!this.ready) return; this.noise(this.ctx.currentTime, 0.16, 700, 220, 'lowpass', 0.2) }
  catchFish() {
    if (!this.ready) return
    const t = this.ctx.currentTime
    this.noise(t, 0.32, 1500, 320, 'bandpass', 0.3, 1.2)
    const notes = [659.25, 783.99, 987.77]
    notes.forEach((f, i) => this.tone(t + 0.05 + i * 0.055, f, null, 0.22, 0.12, 'triangle'))
  }
  ach() {
    if (!this.ready) return
    const t = this.ctx.currentTime
    const notes = [523.25, 659.25, 783.99, 1046.5]
    notes.forEach((f, i) => this.tone(t + i * 0.07, f, null, 0.3, 0.14, 'triangle'))
    this.noise(t + 0.28, 0.35, 4000, 9000, 'highpass', 0.05)
  }
  gull() {
    if (!this.ready || this.ctx.currentTime - this.lastGull < 6) return
    this.lastGull = this.ctx.currentTime + Math.random() * 14
    const t = this.ctx.currentTime
    const base = 700 + Math.random() * 300
    this.tone(t, base, base * 0.42, 0.16, 0.07, 'sawtooth')
    this.tone(t + 0.22, base * 1.05, base * 0.4, 0.2, 0.06, 'sawtooth')
  }
  cricket() {
    if (!this.ready) return
    const t = this.ctx.currentTime
    for (let i = 0; i < 4; i++) this.tone(t + i * 0.07, 4300, null, 0.03, 0.014, 'sine')
  }
  update(dt, app) {
    if (!this.ready) return
    const st = app.state
    const sp = st.speedKmh / 50
    this.windGain.gain.value += ((sp * 0.055) - this.windGain.gain.value) * Math.min(1, dt * 3)
    if (app.world && app.world.nightW > 0.45) {
      this.lastCricket -= dt
      if (this.lastCricket <= 0) { this.lastCricket = 2.5 + Math.random() * 5; this.cricket() }
    }
  }
}
