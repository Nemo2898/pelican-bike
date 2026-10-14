// 自行车 + 鹈鹕(含布料围巾 / 腿部 IK / 翅膀展合)
import * as THREE from 'three'

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const UP = new THREE.Vector3(0, 1, 0)
const unitCyl = new THREE.CylinderGeometry(1, 1, 1, 10)

function orient(mesh, p1, p2, r, offsetY = 0) {
  const d = new THREE.Vector3().subVectors(p2, p1)
  const len = d.length()
  mesh.position.copy(p1).addScaledVector(d, 0.5)
  if (offsetY) mesh.position.y += offsetY
  mesh.quaternion.setFromUnitVectors(UP, d.normalize())
  mesh.scale.set(r, len, r)
}

export class PelicanBike {
  constructor(app) {
    this.app = app
    this.group = new THREE.Group()
    this.chassis = new THREE.Group()
    this.group.add(this.chassis)
    this.pelicanG = new THREE.Group()
    this.chassis.add(this.pelicanG)

    // 运动状态
    this.x = 0; this.z = 2.2; this.y = 0
    this.speed = 0; this.vy = 0; this.airborne = false
    this.wheelie = 0; this.lean = 0
    this.jumpHeld = false
    this.wheelSpin = 0
    this.cadenceRps = 0
    this.spread = 0
    this.flapPhase = 0
    this.squash = 0

    // 对外坐标
    this.headWorld = new THREE.Vector3(0.42, 1.6, 2.2)
    this.headQuat = new THREE.Quaternion()
    this.headDir = new THREE.Vector3(1, 0, 0)
    this.neckWorld = new THREE.Vector3(0.3, 1.3, 2.2)
    this.beakWorld = new THREE.Vector3(0.9, 1.5, 2.2)

    this._buildMaterials()
    this._buildBike()
    this._buildPelican()
    this._buildCloth()
    this.headlook = { yaw: 0, pitch: 0 }
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true } })
    this.app.scene.add(this.group)
  }

  _buildMaterials() {
    this.mats = {
      frame: new THREE.MeshStandardMaterial({ color: 0x0f9d94, roughness: 0.35, metalness: 0.55 }),
      tire: new THREE.MeshStandardMaterial({ color: 0x191a1e, roughness: 0.92 }),
      rim: new THREE.MeshStandardMaterial({ color: 0xd6dbe2, roughness: 0.3, metalness: 0.8 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.7 }),
      white: new THREE.MeshStandardMaterial({ color: 0xf6f2e9, roughness: 0.85 }),
      beak: new THREE.MeshStandardMaterial({ color: 0xf3a044, roughness: 0.6 }),
      pouch: new THREE.MeshStandardMaterial({ color: 0xec8a3a, roughness: 0.7 }),
      helmet: new THREE.MeshStandardMaterial({ color: 0xf2f4f7, roughness: 0.25, metalness: 0.15 }),
      stripe: new THREE.MeshStandardMaterial({ color: 0xd94b3f, roughness: 0.4 }),
      glasses: new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.12, metalness: 0.5 }),
      basket: new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9, side: THREE.DoubleSide }),
      foot: new THREE.MeshStandardMaterial({ color: 0xf2a04a, roughness: 0.8 }),
      lamp: new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0.2, roughness: 0.4 }),
    }
  }

  _buildBike() {
    const M = this.mats
    const G = this.chassis
    const R = 0.34
    // 车轮
    const wheelGeo = new THREE.TorusGeometry(R, 0.042, 10, 26)
    const spokeGeo = new THREE.BoxGeometry(R * 1.85, 0.012, 0.012)
    const makeWheel = (x) => {
      const w = new THREE.Group()
      const tire = new THREE.Mesh(wheelGeo, M.tire)
      w.add(tire)
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.07, 8), M.rim)
      hub.rotation.x = Math.PI / 2
      w.add(hub)
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(spokeGeo, M.rim)
        s.rotation.z = (i / 3) * Math.PI
        w.add(s)
      }
      w.position.set(x, R, 0)
      return w
    }
    this.rearWheel = makeWheel(-0.55)
    this.frontWheel = makeWheel(0.55)
    G.add(this.rearWheel)

    // 前叉组(转向)
    this.frontAssy = new THREE.Group()
    this.frontAssy.position.set(0.42, 0.86, 0)
    G.add(this.frontAssy)
    const fParts = new THREE.Group()
    fParts.position.set(-0.42, -0.86, 0)
    this.frontAssy.add(fParts)
    fParts.add(this.frontWheel)
    const tube = (p1, p2, r, mat) => {
      const m = new THREE.Mesh(unitCyl, mat)
      orient(m, p1, p2, r)
      fParts.add(m)
      return m
    }
    // 车架(不随转向)
    const A = new THREE.Vector3(-0.55, R, 0)
    const B = new THREE.Vector3(-0.05, 0.30, 0)
    const C = new THREE.Vector3(-0.28, 0.84, 0)
    const D = new THREE.Vector3(0.42, 0.86, 0)
    const E = new THREE.Vector3(0.55, R, 0)
    const t2 = (p1, p2, r) => { const m = new THREE.Mesh(unitCyl, M.frame); orient(m, p1, p2, r); G.add(m); return m }
    t2(A, B, 0.024); t2(B, C, 0.03); t2(C, A, 0.022); t2(B, D, 0.034); t2(C, D, 0.03)
    tube(D, E, 0.026, M.frame)
    // 车把(随前叉)
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.62, 8), M.dark)
    bar.rotation.x = Math.PI / 2
    bar.position.set(0.46, 0.99, 0)
    fParts.add(bar)
    for (const zz of [-0.25, 0.25]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.13, 8), M.stripe)
      grip.rotation.x = Math.PI / 2
      grip.position.set(0.46, 0.99, zz)
      fParts.add(grip)
    }
    // 座垫
    const seat = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.dark)
    seat.scale.set(0.11, 0.035, 0.07)
    seat.position.set(-0.28, 0.9, 0)
    G.add(seat)
    // 牙盘 + 曲柄
    this.crankAngle = 0
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 6, 20), M.rim)
    ring.position.set(B.x, B.y, 0.05)
    G.add(ring)
    this.crankG = new THREE.Group()
    this.crankG.position.set(B.x, B.y, 0)
    G.add(this.crankG)
    this.pedalPos = { L: new THREE.Vector3(), R: new THREE.Vector3() }
    const crankArm = new THREE.BoxGeometry(0.16, 0.035, 0.02)
    this.pedals = {}
    for (const [side, zz] of [['L', 0.1], ['R', -0.1]]) {
      const arm = new THREE.Mesh(crankArm, M.rim)
      arm.position.set(0.08, 0, zz * 0.6)
      const grp = new THREE.Group()
      grp.add(arm)
      const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.055), M.dark)
      pedal.position.set(0.16, 0, zz)
      grp.add(pedal)
      if (side === 'R') grp.rotation.z = Math.PI
      this.crankG.add(grp)
      this.pedals[side] = grp
    }
    this.BB = B
    // 前篮
    this.basket = new THREE.Group()
    this.basket.position.set(0.72, 0.74, 0)
    const bk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.17, 10, 1, true), M.basket)
    this.basket.add(bk)
    const bk2 = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), M.basket)
    bk2.rotation.x = -Math.PI / 2
    bk2.position.y = -0.085
    this.basket.add(bk2)
    this.basketFish = []
    this.basket.add(new THREE.Group())
    G.add(this.basket)
    // 车灯
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 8), M.lamp)
    head.rotation.z = Math.PI / 2
    head.position.set(0.8, 0.88, 0)
    G.add(head)
    this.headlight = new THREE.SpotLight(0xfff0c0, 0, 32, 0.5, 0.65, 1.3)
    this.headlight.position.set(0.8, 0.9, 0)
    const tgt = new THREE.Object3D()
    tgt.position.set(20, 0.2, 0)
    G.add(tgt)
    this.headlight.target = tgt
    G.add(this.headlight)
    const hgCv = document.createElement('canvas')
    hgCv.width = hgCv.height = 64
    const hgC = hgCv.getContext('2d')
    const hgG = hgC.createRadialGradient(32, 32, 0, 32, 32, 32)
    hgG.addColorStop(0, 'rgba(255,244,200,0.95)')
    hgG.addColorStop(0.5, 'rgba(255,230,150,0.3)')
    hgG.addColorStop(1, 'rgba(255,230,150,0)')
    hgC.fillStyle = hgG; hgC.fillRect(0, 0, 64, 64)
    const hgTex = new THREE.CanvasTexture(hgCv)
    const hglow = new THREE.Sprite(new THREE.SpriteMaterial({ map: hgTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
    this.headGlow = hglow
    hglow.scale.set(1.1, 1.1, 1)
    hglow.position.set(0.82, 0.88, 0)
    G.add(hglow)
  }

  _buildPelican() {
    const M = this.mats
    const P = this.pelicanG
    // 身体
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), M.white)
    body.scale.set(1.15, 0.85, 0.92)
    body.position.set(0.1, 1.1, 0)
    body.rotation.z = -0.12
    P.add(body)
    this.body = body
    // 尾羽
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.3, 8), M.white)
    tail.rotation.z = Math.PI / 2 + 0.35
    tail.position.set(-0.32, 1.16, 0)
    tail.scale.z = 1.6
    P.add(tail)
    // 脖子
    const neck1 = new THREE.Mesh(unitCyl, M.white)
    orient(neck1, new THREE.Vector3(0.22, 1.18, 0), new THREE.Vector3(0.33, 1.42, 0), 0.075)
    P.add(neck1)
    const neck2 = new THREE.Mesh(unitCyl, M.white)
    orient(neck2, new THREE.Vector3(0.33, 1.42, 0), new THREE.Vector3(0.4, 1.52, 0), 0.062)
    P.add(neck2)
    // 头部组
    this.headG = new THREE.Group()
    this.headG.position.set(0.42, 1.55, 0)
    P.add(this.headG)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12), M.white)
    head.scale.set(1.06, 0.98, 0.98)
    this.headG.add(head)
    // 上喙
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 10), M.beak)
    beak.rotation.z = -Math.PI / 2 - 0.1
    beak.position.set(0.16, -0.02, 0)
    this.headG.add(beak)
    // 喉囊
    const pouch = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), M.pouch)
    pouch.scale.set(0.17, 0.075, 0.09)
    pouch.position.set(0.1, -0.075, 0)
    this.headG.add(pouch)
    // 墨镜
    for (const zz of [-0.07, 0.07]) {
      const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), M.glasses)
      lens.scale.set(0.02, 0.05, 0.042)
      lens.position.set(0.108, 0.012, zz)
      this.headG.add(lens)
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.012, 0.1), M.glasses)
    bridge.position.set(0.112, 0.02, 0)
    this.headG.add(bridge)
    // 头盔
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.148, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.helmet)
    helmet.position.set(-0.01, 0.055, 0)
    this.headG.add(helmet)
    const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.128, 0.013, 8, 20, Math.PI), M.stripe)
    stripe.position.set(-0.01, 0.075, 0)
    this.headG.add(stripe)
    // 喙尖(抓鱼判定点)
    this.beakTip = new THREE.Object3D()
    this.beakTip.position.set(0.42, -0.05, 0)
    this.headG.add(this.beakTip)
    // 翅膀
    const wingShape = new THREE.Shape()
    wingShape.moveTo(0, 0)
    wingShape.quadraticCurveTo(0.28, 0.0, 0.52, 0.05)
    wingShape.quadraticCurveTo(0.6, 0.16, 0.44, 0.26)
    wingShape.quadraticCurveTo(0.2, 0.32, 0.02, 0.19)
    wingShape.quadraticCurveTo(-0.03, 0.08, 0, 0)
    const wingGeo = new THREE.ExtrudeGeometry(wingShape, { depth: 0.016, bevelEnabled: false })
    this.wingL = new THREE.Group()
    this.wingR = new THREE.Group()
    const wl = new THREE.Mesh(wingGeo, M.white)
    const wr = new THREE.Mesh(wingGeo, M.white)
    this.wingL.add(wl); this.wingR.add(wr)
    this.wingL.position.set(0.02, 1.2, 0.16)
    this.wingR.position.set(0.02, 1.2, -0.16)
    this.wingL.rotation.x = -1.25
    this.wingR.rotation.x = 1.25
    P.add(this.wingL); P.add(this.wingR)
    // 腿(两段式 IK)
    this.legs = {}
    for (const [side, zz] of [['L', 0.115], ['R', -0.115]]) {
      const hip = new THREE.Vector3(0.05, 1.0, zz)
      const thigh = new THREE.Mesh(unitCyl, M.white)
      const shin = new THREE.Mesh(unitCyl, M.beak)
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.025, 0.07), M.foot)
      P.add(thigh); P.add(shin); P.add(foot)
      this.legs[side] = { hip, thigh, shin, foot }
    }
  }

  _buildCloth() {
    const cols = 10, rows = 6
    const w = 0.02
    const restDown = 0.115
    const pts = [], prev = []
    for (let i = 0; i < rows; i++) {
      pts.push([]); prev.push([])
      for (let j = 0; j < cols; j++) {
        const p = new THREE.Vector3(0.3, 1.32 - i * restDown, (j / (cols - 1) - 0.5) * 0.16)
        pts[i].push(p)
        prev[i].push(p.clone())
      }
    }
    this.cloth = { cols, rows, pts, prev, w, restDown, iters: 2, anchorY: 1.32, anchorX: 0.3 }
    const geo = new THREE.BufferGeometry()
    const pos = new Float32Array(rows * cols * 3)
    const col = new Float32Array(rows * cols * 3)
    const idx = []
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const k = (i * cols + j) * 3
      const red = (i % 2 === 0) ? [0.83, 0.23, 0.18] : [0.62, 0.11, 0.09]
      col[k] = red[0]; col[k + 1] = red[1]; col[k + 2] = red[2]
      if (i < rows - 1 && j < cols - 1) {
        const a = i * cols + j, b = a + 1, c = a + cols, d = c + 1
        idx.push(a, c, b, b, c, d)
      }
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setIndex(idx)
    this.cloth.geo = geo
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8 })
    this.cloth.mesh = new THREE.Mesh(geo, mat)
    this.cloth.mesh.castShadow = true
    this.pelicanG.add(this.cloth.mesh)
  }

  addBasketFish(fishMesh) {
    const f = fishMesh.clone()
    f.scale.setScalar(0.55)
    f.rotation.set(Math.random() * 0.4, Math.random() * Math.PI, Math.random() * 0.3)
    f.position.set((Math.random() - 0.5) * 0.1, 0.02 + this.basketFish.length * 0.045, (Math.random() - 0.5) * 0.1)
    this.basket.children[2].add(f)
    this.basketFish.push(f)
    if (this.basketFish.length > 6) { const old = this.basketFish.shift(); old.parent.remove(old) }
  }

  setQuality(tier) { this.cloth.iters = [1, 2, 3, 3][tier] }

  _clothStep(dt) {
    const c = this.cloth
    const speed = this.speed
    const t = this.app.state.time
    const windX = -(speed * 0.55 + 0.35)
    for (let i = 0; i < c.rows; i++) {
      for (let j = 0; j < c.cols; j++) {
        const p = c.pts[i][j], pr = c.prev[i][j]
        if (i === 0) { // 钉在脖子上
          p.set(c.anchorX, c.anchorY, (j / (c.cols - 1) - 0.5) * 0.16)
          pr.copy(p)
          continue
        }
        const f = i / (c.rows - 1)
        const vx = p.x - pr.x, vy = p.y - pr.y, vz = p.z - pr.z
        const flut = f * 0.35
        const ax = windX * f + Math.sin(t * 4.6 + i * 1.3 + j * 2.1) * flut * 2.2
        const ay = -7.5 + Math.sin(t * 5.2 + i * 2.2 + j) * flut * 1.4
        const az = Math.cos(t * 3.9 + i * 1.7 + j * 2.6) * flut * 2.4
        pr.copy(p)
        p.x += vx * 0.985 + ax * dt * dt
        p.y += vy * 0.985 + ay * dt * dt
        p.z += vz * 0.985 + az * dt * dt
      }
    }
    // 约束
    for (let it = 0; it < c.iters; it++) {
      for (let i = 0; i < c.rows; i++) {
        for (let j = 0; j < c.cols; j++) {
          const p = c.pts[i][j]
          if (i < c.rows - 1) this._solve(p, c.pts[i + 1][j], c.restDown, i === 0 && j === 0)
          if (j < c.cols - 1) this._solve(p, c.pts[i][j + 1], c.w, i === 0)
        }
      }
    }
    const pos = c.geo.attributes.position.array
    for (let i = 0; i < c.rows; i++) for (let j = 0; j < c.cols; j++) {
      const k = (i * c.cols + j) * 3
      pos[k] = c.pts[i][j].x; pos[k + 1] = c.pts[i][j].y; pos[k + 2] = c.pts[i][j].z
    }
    c.geo.attributes.position.needsUpdate = true
    c.geo.computeVertexNormals()
  }

  _solve(p1, p2, rest, pin) {
    const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6
    const diff = (d - rest) / d
    const cx = dx * diff * 0.5, cy = dy * diff * 0.5, cz = dz * diff * 0.5
    if (!pin) { p1.x += cx; p1.y += cy; p1.z += cz }
    if (pin !== 'b') { p2.x -= cx; p2.y -= cy; p2.z -= cz }
  }

  update(dt) {
    const app = this.app, ctl = app.ctl, st = app.state
    // ---- 速度 ----
    const drag = 0.06 + this.speed * 0.055
    let a = 0
    if (ctl.accel) a += 7.4
    if (ctl.brake) a -= 11.5
    if (!ctl.accel && !ctl.brake) a -= 0.7
    a -= drag
    this.speed = clamp(this.speed + a * dt, 0, 14.6)
    if (ctl.brake && this.speed < 0.4) this.speed *= 0.5
    // ---- 变道 ----
    const steer = (ctl.right ? 1 : 0) - (ctl.left ? 1 : 0)
    const prevZ = this.z
    this.z = clamp(this.z + steer * dt * (3.4 + this.speed * 0.14), -0.9, 5.4)
    const vz = (this.z - prevZ) / Math.max(dt, 1e-4)
    this.lean += (clamp(vz * 0.14, -0.42, 0.42) - this.lean) * Math.min(1, dt * 6)
    // ---- 跳跃 ----
    if (ctl.jump && !this.jumpHeld && !this.airborne && this.speed > 1.2) {
      this.vy = 5.0
      this.airborne = true
      st.jumps++
      app.audio.jump()
      app.fx.burst(new THREE.Vector3(this.x, 0.1, this.z), 'dust', 8)
    }
    this.jumpHeld = ctl.jump
    if (this.airborne) {
      this.vy -= 12.5 * dt
      this.y += this.vy * dt
      if (this.y <= 0) {
        const impact = -this.vy
        this.y = 0; this.vy = 0; this.airborne = false
        if (impact > 2) {
          this.squash = Math.min(0.3, impact * 0.03)
          app.audio.land(impact)
          app.fx.burst(new THREE.Vector3(this.x, 0.06, this.z), 'dust', 10)
          app.rig.addShake(Math.min(0.12, impact * 0.012))
        }
      }
    }
    this.squash *= Math.exp(-7 * dt)
    // ---- 翘头 ----
    const wantWheelie = (ctl.wheelie && this.speed > 2 && !this.airborne) ? 1 : 0
    this.wheelie += (wantWheelie - this.wheelie) * Math.min(1, dt * 3.2)
    const pitch = this.wheelie * 0.42 + (this.airborne ? clamp(this.vy * 0.055, -0.34, 0.34) : 0)
    // ---- 位置 ----
    this.x += this.speed * dt
    st.dist += this.speed * dt
    st.speedKmh = this.speed * 3.6
    st.maxSpeedKmh = Math.max(st.maxSpeedKmh, st.speedKmh)
    this.cadenceRps = this.speed / 5.87
    app.audio.setCadence(this.cadenceRps * 60)
    // ---- 姿态 ----
    const px = -0.55, py = 0.34
    const ca = Math.cos(pitch), sa = Math.sin(pitch)
    this.chassis.rotation.z = pitch
    this.chassis.position.set(px - (px * ca - py * sa), py - (px * sa + py * ca), 0)
    this.group.position.set(this.x, this.y, this.z)
    this.group.rotation.x = this.lean * 0.5
    this.group.rotation.y = vz * -0.05
    this.pelicanG.scale.y = 1 - this.squash
    // ---- 轮子 / 曲柄 ----
    this.wheelSpin -= this.speed * dt / 0.34
    this.rearWheel.children[0].rotation.z = this.wheelSpin
    this.frontWheel.children[0].rotation.z = this.wheelSpin
    this.crankAngle = -this.x / 5.87 * Math.PI * 2
    const B = this.BB
    const r = 0.16
    const angL = this.crankAngle
    const angR = this.crankAngle + Math.PI
    this.pedalPos.L.set(B.x + Math.cos(angL) * r, B.y + Math.sin(angL) * r, 0.1)
    this.pedalPos.R.set(B.x + Math.cos(angR) * r, B.y + Math.sin(angR) * r, -0.1)
    this.pedals.L.rotation.z = angL
    this.pedals.R.rotation.z = angR
    // ---- 腿 IK ----
    const L1 = 0.4, L2 = 0.42
    for (const side of ['L', 'R']) {
      const leg = this.legs[side]
      const target = this.pedalPos[side]
      const H = leg.hip
      let dx = target.x - H.x, dy = target.y - H.y
      let d = Math.hypot(dx, dy)
      d = Math.min(d, L1 + L2 - 0.02)
      const baseA = Math.atan2(dy, dx)
      const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1)
      const aa = Math.acos(cosA)
      const k1x = H.x + Math.cos(baseA + aa) * L1, k1y = H.y + Math.sin(baseA + aa) * L1
      const k2x = H.x + Math.cos(baseA - aa) * L1, k2y = H.y + Math.sin(baseA - aa) * L1
      const kneeX = k1x > k2x ? k1x : k2x
      const kneeY = k1x > k2x ? k1y : k2y
      const knee = new THREE.Vector3(kneeX, kneeY, H.z)
      const pedal = new THREE.Vector3(target.x, target.y + 0.02, H.z)
      orient(leg.thigh, H, knee, 0.045)
      orient(leg.shin, knee, pedal, 0.032)
      leg.foot.position.set(pedal.x + 0.02, pedal.y - 0.005, H.z)
      leg.foot.rotation.z = -0.1
    }
    // ---- 翅膀 ----
    const spreadTarget = (this.airborne || this.wheelie > 0.25) ? 1 : 0
    this.spread += (spreadTarget - this.spread) * Math.min(1, dt * 4)
    this.flapPhase += dt * (this.airborne ? 8 : 3.2)
    const flap = Math.sin(this.flapPhase) * 0.42 * this.spread
    const foldL = -1.25 + this.spread * 1.0 + flap
    const foldR = 1.25 - this.spread * 1.0 - flap
    this.wingL.rotation.x = foldL
    this.wingR.rotation.x = foldR
    this.wingL.rotation.y = -this.spread * 0.25
    this.wingR.rotation.y = this.spread * 0.25
    // ---- 头朝向 ----
    let yaw = 0, pitchH = 0
    const look = app.fish?.lookTarget?.()
    if (look) {
      const p = this.pelicanG.worldToLocal(look.clone())
      const hd = this.headG.position
      const dx2 = p.x - hd.x, dy2 = p.y - hd.y, dz2 = p.z - hd.z
      yaw = clamp(-Math.atan2(dz2, dx2) * 0.7, -0.6, 0.6)
      pitchH = clamp(Math.atan2(dy2, Math.hypot(dx2, dz2)) * 0.6, -0.45, 0.4)
    } else {
      pitchH = Math.sin(st.time * 1.7) * 0.04
    }
    if (st.lunge > 0) {
      st.lunge -= dt
      pitchH -= 0.85 * Math.sin(Math.PI * clamp(1 - st.lunge / 0.35, 0, 1)) * 0.6
    }
    this.headlook.yaw += (yaw - this.headlook.yaw) * Math.min(1, dt * 5)
    this.headlook.pitch += (pitchH - this.headlook.pitch) * Math.min(1, dt * 5)
    this.headG.rotation.y = this.headlook.yaw
    this.headG.rotation.z = this.headlook.pitch
    // ---- 围巾 ----
    this._clothStep(Math.min(dt, 0.033))
    // ---- 前叉转向 ----
    this.frontAssy.rotation.y = -steer * 0.32
    // ---- 世界坐标输出 ----
    this.headG.getWorldPosition(this.headWorld)
    this.headG.getWorldQuaternion(this.headQuat)
    this.headDir.set(1, 0, 0).applyQuaternion(this.headQuat)
    this.beakTip.getWorldPosition(this.beakWorld)
    this.neckWorld.set(this.x, this.y + 1.35, this.z)
  }
}
