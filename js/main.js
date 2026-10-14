// 主入口:装配所有模块 + 主循环 + 自动驾驶
import * as THREE from 'three'
import { World } from './world.js'
import { PelicanBike } from './bike.js'
import { FishSystem } from './fish.js'
import { FX } from './fx.js'
import { AudioEngine } from './audio.js'
import { Achievements } from './achievements.js'
import { CameraRig } from './cameras.js'
import { Input } from './input.js'
import { Quality } from './quality.js'
import { HUD } from './hud.js'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

const app = window.__pelican = {}
app.debug = new URLSearchParams(location.search).has('debug')
app.started = false

app.state = {
  time: 0, t01: 0, nightW: 0, phaseLabel: '🌆 黄昏',
  speedKmh: 0, dist: 0, maxSpeedKmh: 0,
  fishTotal: 0, nightFish: 0, airCatch: 0, wheelieCatch: 0, jumps: 0,
  catchTimes: [], comboNow: 0, maxCombo: 0,
  wheelieTime: 0, cinTime: 0, povTime: 0, autoTime: 0,
  lastInput: 0, auto: false, lunge: 0,
}
window.__errors = []
window.addEventListener('error', (e) => { window.__errors.push(String(e.message)) })

// 渲染器
const renderer = app.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
renderer.setSize(innerWidth, innerHeight)
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1
document.getElementById('app').appendChild(renderer.domElement)

app.scene = new THREE.Scene()

// 模块装配
app.hud = new HUD(app)
app.rig = new CameraRig(app)
app.world = new World(app)
app.bike = new PelicanBike(app)
app.bikeP = app.bike
app.fish = new FishSystem(app)
app.fx = new FX(app)
app.audio = new AudioEngine()
app.quality = new Quality(app)
app.input = new Input(app)
app.ach = new Achievements(app)
app.quality.apply()

// 启动
document.getElementById('startBtn').addEventListener('click', () => {
  document.getElementById('boot').classList.add('gone')
  app.hud.show()
  app.audio.init()
  app.started = true
  app.state.lastInput = app.state.time
})

// 自动驾驶
function autopilot(dt) {
  const st = app.state, ctl = app.ctl, b = app.bike
  const idle = st.time - st.lastInput
  const auto = app.started && idle > 4
  st.auto = auto
  if (!auto) return
  ctl.accel = ctl.brake = ctl.left = ctl.right = ctl.jump = ctl.wheelie = false
  const info = app.fish.intercept(b)
  if (info) {
    if (b.z < info.targetZ - 0.15) ctl.right = true
    else if (b.z > info.targetZ + 0.15) ctl.left = true
    const vDes = clamp(info.dx / info.tCross, 3.2, 13)
    if (b.speed < vDes - 0.6) ctl.accel = true
    else if (b.speed > vDes + 1.6) ctl.brake = true
    if (info.jump) ctl.jump = true
  } else {
    if (b.z < 2.0) ctl.right = true
    else if (b.z > 2.4) ctl.left = true
    if (st.speedKmh < 24) ctl.accel = true
    else if (st.speedKmh > 30) ctl.brake = true
  }
}

// 主循环
let last = performance.now()
function step(dt) {
  const st = app.state
  st.time += dt
  autopilot(dt)
  app.bike.update(dt)
  app.fish.update(dt)
  app.world.update(dt)
  app.fx.update(dt)
  app.ach.tick()
  if (app.rig.modeIndex === 1) st.cinTime += dt
  if (app.rig.modeIndex === 2) st.povTime += dt
  if (st.auto) st.autoTime += dt
  if (app.bike.wheelie > 0.25 && !app.bike.airborne) st.wheelieTime += dt
  app.audio.update(dt, app)
  if (Math.random() < dt * 0.04) app.audio.gull()
}
function frame(now) {
  const raw = (now - last) / 1000
  const dt = Math.min(0.05, raw)
  last = now
  const st = app.state
  if (app.started) step(dt)
  else app.world.update(dt * 0.5)
  app.rig.update(dt)
  app.hud.update(st)
  app.quality.frame(raw)
  renderer.toneMappingExposure = app.world.exposure
  renderer.render(app.scene, app.rig.camera)
  requestAnimationFrame(frame)
}
requestAnimationFrame(frame)

addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight)
  app.rig.camera.aspect = innerWidth / innerHeight
  app.rig.camera.updateProjectionMatrix()
})

// 调试/测试钩子
window.__setTime = (t01) => { app.world.timeSec = t01 * app.world.T }
window.__ff = (n = 600, dt = 1 / 60) => { for (let i = 0; i < n; i++) step(dt); return +app.state.time.toFixed(1) }
window.__key = (code, down = true) => {
  const ev = new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true })
  window.dispatchEvent(ev)
}
