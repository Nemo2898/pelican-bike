// 世界:天空 / 海面波浪 / 海岸公路 / 装饰 / 昼夜循环
import * as THREE from 'three'

const P = 600 // 周期
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }

export class World {
  constructor(app) {
    this.app = app
    this.timeSec = 0
    this.T = 200 // 昼夜周期(秒),从黄昏开始
    this.t01 = 0
    this.nightW = 0; this.dayW = 0; this.duskW = 1
    this.exposure = 1
    this.sunDir = new THREE.Vector3(0.7, 0, -0.75).normalize()
    this.moonDir = new THREE.Vector3(-0.4, 0.5, -0.8).normalize()
    this.sunColor = new THREE.Color(0xff8a3d)
    this.moonColor = new THREE.Color(0xa9c0ee)
    this.horColor = new THREE.Color(0xff9d63)
    this.sunI = 1; this.moonI = 0
    this.wrapItems = []
    this.lamps = []
    this.ray = new THREE.Vector3()

    this.scene = app.scene
    this._sky()
    this._stars()
    this._sea()
    this._ground()
    this._road()
    this._rails()
    this._decor()
    this._gulls()
    this._lights()
    this.setQuality(2)
  }

  _sky() {
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uZen: { value: new THREE.Color(0x20305e) },
        uHor: { value: new THREE.Color(0xff9d63) },
        uDeep: { value: new THREE.Color(0x05070f) },
        uSunDir: { value: this.sunDir },
        uSunCol: { value: this.sunColor },
        uSunI: { value: 1 },
        uMoonDir: { value: this.moonDir },
        uMoonCol: { value: new THREE.Color(0xdfe8ff) },
        uMoonI: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main(){
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uZen; uniform vec3 uHor; uniform vec3 uDeep;
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunI;
        uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform float uMoonI;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = max(d.y, 0.0);
          vec3 col = mix(uHor, uZen, pow(h, 0.55));
          col += uHor * 0.30 * pow(max(1.0 - abs(d.y) * 3.2, 0.0), 3.0);
          float sd = max(dot(d, uSunDir), 0.0);
          col += uSunCol * (pow(sd, 1200.0) * 8.0 + pow(sd, 14.0) * 0.22) * uSunI;
          float md = max(dot(d, uMoonDir), 0.0);
          col += uMoonCol * (pow(md, 4000.0) * 6.0 + pow(md, 80.0) * 0.16) * uMoonI;
          col = mix(col, uDeep, smoothstep(0.0, -0.22, d.y));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.skyMesh = new THREE.Mesh(new THREE.SphereGeometry(900, 32, 16), this.skyMat)
    this.skyMesh.renderOrder = -100
    this.scene.add(this.skyMesh)
  }

  _stars() {
    const N = 3200
    const pos = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection()
      if (v.y < -0.02) v.y = -v.y * 0.4
      v.multiplyScalar(870)
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.starsMat = new THREE.PointsMaterial({ color: 0xd8e2ff, size: 1.7, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false })
    this.stars = new THREE.Points(g, this.starsMat)
    this.stars.renderOrder = 90
    this.scene.add(this.stars)
  }

  _sea() {
    const geo = new THREE.PlaneGeometry(1500, 340, 200, 54)
    geo.rotateX(-Math.PI / 2)
    this.seaMat = new THREE.ShaderMaterial({
      fog: false,
      uniforms: {
        uTime: { value: 0 }, uOct: { value: 4 }, uNight: { value: 0 }, uFoamD: { value: 1 },
        uAmb: { value: new THREE.Color(0.9, 0.9, 0.9) },
        uHor: { value: this.horColor.clone() },
        uDeep: { value: new THREE.Color(0x0a1e3a) },
        uShallow: { value: new THREE.Color(0x2f8fa0) },
        uSunDir: { value: this.sunDir }, uSunCol: { value: this.sunColor }, uSunI: { value: 1 },
        uMoonDir: { value: this.moonDir }, uMoonI: { value: 0 },
      },
      vertexShader: `
        uniform float uTime; uniform int uOct;
        varying vec3 vW; varying vec3 vN; varying float vSlope;
        float waves(vec2 p, out vec2 grad){
          float h = 0.0; grad = vec2(0.0);
          for(int i=0;i<4;i++){
            if(i>=uOct) break;
            float fi = float(i);
            vec2 dir = normalize(vec2(0.16 + fi * 0.13, 1.0));
            float k = 0.07 + fi * 0.05;
            float a = 0.48 / (1.0 + fi * 0.8);
            float ph = dot(p, dir) * k - uTime * (0.9 + fi * 0.5);
            h += a * sin(ph);
            grad += a * k * cos(ph) * dir;
          }
          return h;
        }
        void main(){
          vec4 wp4 = modelMatrix * vec4(position, 1.0);
          vec2 grad;
          float h = waves(wp4.xz, grad);
          float shoreD = -wp4.z - 7.0;
          float damp = 0.12 + 0.88 * smoothstep(4.0, 36.0, shoreD);
          h *= damp; grad *= damp;
          vec4 pw = wp4;
          pw.y += h;
          vW = pw.xyz;
          vN = normalize(vec3(-grad.x * 1.7, 1.0, -grad.y * 1.7));
          vSlope = length(grad);
          gl_Position = projectionMatrix * viewMatrix * pw;
        }`,
      fragmentShader: `
        uniform float uTime; uniform float uNight; uniform float uFoamD;
        uniform vec3 uAmb; uniform vec3 uHor; uniform vec3 uDeep; uniform vec3 uShallow;
        uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uSunI;
        uniform vec3 uMoonDir; uniform float uMoonI;
        varying vec3 vW; varying vec3 vN; varying float vSlope;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          float shoreD = -vW.z - 7.0;
          float depthT = smoothstep(3.0, 60.0, shoreD);
          vec3 col = mix(uShallow, uDeep, depthT) * uAmb;
          float fres = pow(1.0 - max(dot(V, vN), 0.0), 3.0);
          col = mix(col, uHor, fres * 0.75);
          vec3 H = normalize(uSunDir + V);
          col += uSunCol * pow(max(dot(vN, H), 0.0), 260.0) * uSunI * 1.7;
          vec3 H2 = normalize(uMoonDir + V);
          col += vec3(0.75, 0.82, 1.0) * pow(max(dot(vN, H2), 0.0), 420.0) * uMoonI * 1.3;
          float noise1 = sin(vW.x * 0.35 + uTime * 0.8) * sin(vW.z * 0.43 - uTime * 0.6) * 0.5 + 0.5;
          float crest = smoothstep(0.16, 0.34, vSlope) * (0.35 + 0.65 * noise1);
          float band = 1.0 - smoothstep(3.0, 18.0, shoreD);
          float breaker = pow(max(sin(shoreD * 0.55 - uTime * 1.7 + sin(vW.x * 0.05) * 2.0), 0.0), 3.0);
          float foam = crest * 0.45 + band * breaker * (0.5 + 0.5 * noise1);
          foam += (1.0 - smoothstep(0.4, 1.6, shoreD)) * 0.6;
          foam *= uFoamD;
          vec3 foamCol = vec3(0.92, 0.96, 1.0) * (0.5 + 0.5 * (1.0 - uNight));
          col = mix(col, foamCol, clamp(foam, 0.0, 0.92));
          float d = distance(cameraPosition.xz, vW.xz);
          col = mix(col, uHor, smoothstep(360.0, 840.0, d));
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    this.sea = new THREE.Mesh(geo, this.seaMat)
    this.sea.position.set(0, -0.35, -172)
    this.scene.add(this.sea)
  }

  _ground() {
    // 沙滩
    const cv = document.createElement('canvas')
    cv.width = 128; cv.height = 64
    const c = cv.getContext('2d')
    c.fillStyle = '#c8b189'; c.fillRect(0, 0, 128, 64)
    for (let i = 0; i < 900; i++) {
      c.fillStyle = `rgba(${90 + Math.random() * 70 | 0},${80 + Math.random() * 60 | 0},${55 + Math.random() * 45 | 0},${Math.random() * 0.35})`
      c.fillRect(Math.random() * 128, Math.random() * 64, 1.5, 1.5)
    }
    const g = c.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, 'rgba(120,95,60,0.55)')
    g.addColorStop(0.4, 'rgba(120,95,60,0)')
    c.fillStyle = g; c.fillRect(0, 0, 128, 64)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.set(120, 1)
    this.sandTex = tex
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(1500, 7), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }))
    sand.geometry.rotateX(-Math.PI / 2)
    sand.position.set(0, -0.16, -4.4)
    this.scene.add(sand)
    this.sand = sand
    // 岸边泡沫带
    const fv = document.createElement('canvas')
    fv.width = 256; fv.height = 64
    const fc = fv.getContext('2d')
    fc.clearRect(0, 0, 256, 64)
    for (let i = 0; i < 220; i++) {
      const x = Math.random() * 256, y = Math.random() * 64
      const r = 2 + Math.random() * 7
      const g2 = fc.createRadialGradient(x, y, 0, x, y, r)
      g2.addColorStop(0, `rgba(255,255,255,${0.25 + Math.random() * 0.5})`)
      g2.addColorStop(1, 'rgba(255,255,255,0)')
      fc.fillStyle = g2
      fc.beginPath(); fc.arc(x, y, r, 0, 7); fc.fill()
    }
    const ftex = new THREE.CanvasTexture(fv)
    ftex.wrapS = THREE.RepeatWrapping
    ftex.repeat.set(46, 1)
    this.foamTex = ftex
    this.foam = new THREE.Mesh(new THREE.PlaneGeometry(1500, 2.6), new THREE.MeshBasicMaterial({ map: ftex, transparent: true, opacity: 0.85, depthWrite: false }))
    this.foam.geometry.rotateX(-Math.PI / 2)
    this.foam.position.set(0, -0.13, -6.4)
    this.scene.add(this.foam)
    // 山丘一侧的草地
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(1500, 40), new THREE.MeshStandardMaterial({ color: 0x37413a, roughness: 1 }))
    dirt.geometry.rotateX(-Math.PI / 2)
    dirt.position.set(0, -0.05, 25.8)
    this.scene.add(dirt)
  }

  _road() {
    const cv = document.createElement('canvas')
    cv.width = 128; cv.height = 256
    const c = cv.getContext('2d')
    c.fillStyle = '#3b3e45'; c.fillRect(0, 0, 128, 256)
    for (let i = 0; i < 2600; i++) {
      const v = 40 + Math.random() * 60 | 0
      c.fillStyle = `rgba(${v},${v},${v + 6},${Math.random() * 0.5})`
      c.fillRect(Math.random() * 128, Math.random() * 256, 1.4, 1.4)
    }
    // 车道中间的轮迹
    c.fillStyle = 'rgba(0,0,0,0.14)'
    for (const y of [40, 140, 240]) c.fillRect(0, y - 12, 128, 24)
    // 边线
    c.fillStyle = '#e8e8e6'
    c.fillRect(0, 7, 128, 4); c.fillRect(0, 245, 128, 4)
    // 虚线(每 8m 一个周期)
    for (const y of [84, 168]) c.fillRect(0, y, 78, 4)
    const tex = new THREE.CanvasTexture(cv)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.set(1500 / 8, 1)
    this.roadTex = tex
    const road = new THREE.Mesh(new THREE.PlaneGeometry(1500, 6.6), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }))
    road.geometry.rotateX(-Math.PI / 2)
    road.position.set(0, 0, 2.2)
    road.receiveShadow = true
    this.scene.add(road)
    this.road = road
  }

  _rails() {
    const railMat = new THREE.MeshStandardMaterial({ color: 0xcfd6dd, roughness: 0.45, metalness: 0.6 })
    this.rails = []
    for (const y of [0.5, 0.76]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1500, 0.06, 0.05), railMat)
      r.position.set(0, y, -1.55)
      this.scene.add(r)
      this.rails.push(r)
    }
    const postGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.85, 8)
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, roughness: 0.6, metalness: 0.4 })
    this.posts = new THREE.InstancedMesh(postGeo, postMat, 50)
    this.posts.castShadow = true
    this.postBases = []
    for (let i = 0; i < 50; i++) this.postBases.push(i * 12 + 3)
    this.scene.add(this.posts)
    this._m4 = new THREE.Matrix4()
  }

  _decor() {
    const app = this.app
    // 路灯
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x3c4149, roughness: 0.6, metalness: 0.5 })
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffe9a0, emissiveIntensity: 0 })
    this.lampMat = lampMat
    const glowCanvas = document.createElement('canvas')
    glowCanvas.width = glowCanvas.height = 64
    const gc = glowCanvas.getContext('2d')
    const gg = gc.createRadialGradient(32, 32, 0, 32, 32, 32)
    gg.addColorStop(0, 'rgba(255,238,170,0.9)')
    gg.addColorStop(0.4, 'rgba(255,220,130,0.35)')
    gg.addColorStop(1, 'rgba(255,220,130,0)')
    gc.fillStyle = gg; gc.fillRect(0, 0, 64, 64)
    const glowTex = new THREE.CanvasTexture(glowCanvas)
    for (let i = 0; i < 10; i++) {
      const g = new THREE.Group()
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 5, 8), poleMat)
      pole.position.y = 2.5
      g.add(pole)
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.07), poleMat)
      arm.position.set(0.45, 4.9, 0)
      g.add(arm)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.18), poleMat)
      head.position.set(0.9, 4.85, 0)
      g.add(head)
      const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.13), lampMat)
      bulb.position.set(0.9, 4.79, 0)
      g.add(bulb)
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
      glow.scale.set(3, 3, 1)
      glow.position.set(0.9, 4.75, 0)
      g.add(glow)
      g.position.z = -2.0
      this.scene.add(g)
      this.lamps.push(g)
      this.wrapItems.push({ obj: g, baseX: i * 60 + 12 })
    }
    // 棕榈树
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5b3a, roughness: 0.95 })
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.9, side: THREE.DoubleSide })
    const leafGeo = new THREE.PlaneGeometry(0.22, 1.7, 1, 4)
    for (let i = 0; i < 9; i++) {
      const g = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 3.4, 7), trunkMat)
      trunk.position.y = 1.7
      trunk.rotation.z = (Math.random() - 0.5) * 0.2
      g.add(trunk)
      for (let k = 0; k < 7; k++) {
        const leaf = new THREE.Mesh(leafGeo, leafMat)
        leaf.position.y = 3.4
        const a = (k / 7) * Math.PI * 2
        leaf.rotation.set(0, a, 0.9 + Math.random() * 0.25, 'YXZ')
        const lp = new THREE.Vector3(Math.cos(a) * 0.75, 3.55, Math.sin(a) * 0.75)
        leaf.position.copy(lp).setY(3.45)
        g.add(leaf)
      }
      g.position.set(0, 0, 7.5 + Math.random() * 3)
      g.rotation.y = Math.random() * Math.PI
      this.scene.add(g)
      this.wrapItems.push({ obj: g, baseX: i * 67 + 30 })
    }
    // 山丘(低多边形岩石感)
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x39493d, roughness: 1, flatShading: true })
    for (let i = 0; i < 8; i++) {
      const h = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), hillMat)
      const sx = 10 + Math.random() * 12, sy = 6 + Math.random() * 13, sz = 12 + Math.random() * 14
      h.scale.set(sx, sy, sz)
      h.position.set(Math.random() * 40, sy * 0.12 - 0.4, 34 + Math.random() * 46)
      h.rotation.set(0, Math.random() * Math.PI, Math.random() * 0.2)
      this.scene.add(h)
      this.wrapItems.push({ obj: h, baseX: i * 75 + Math.random() * 20 })
    }
    // 远山
    const farMat = new THREE.MeshStandardMaterial({ color: 0x232c3a, roughness: 1, flatShading: true })
    for (let i = 0; i < 4; i++) {
      const h = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 5), farMat)
      const sy = 36 + Math.random() * 34
      h.scale.set(40 + Math.random() * 30, sy, 30 + Math.random() * 20)
      h.position.set(Math.random() * 100, sy / 2 - 4, 150 + Math.random() * 60)
      this.scene.add(h)
      this.wrapItems.push({ obj: h, baseX: i * 150 })
    }
    // 灯塔
    const lh = new THREE.Group()
    const rock = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3c434c, roughness: 1 }))
    rock.scale.set(7, 2.6, 6)
    rock.position.y = -0.8
    lh.add(rock)
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.7, 15, 12), new THREE.MeshStandardMaterial({ color: 0xe8e6df, roughness: 0.7 }))
    tower.position.y = 6.5
    lh.add(tower)
    const redMat = new THREE.MeshStandardMaterial({ color: 0xd94b3f, roughness: 0.7 })
    for (const [y, r] of [[4.2, 1.52], [8.6, 1.36]]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.03, 1.5, 14), redMat)
      band.position.y = y
      lh.add(band)
    }
    const gallery = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.9, 0.5, 12), new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.7 }))
    gallery.position.y = 14.4
    lh.add(gallery)
    this.lhLampMat = new THREE.MeshStandardMaterial({ color: 0xfff3b0, emissive: 0xffe9a0, emissiveIntensity: 0 })
    const lampRoom = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 1.6, 10), this.lhLampMat)
    lampRoom.position.y = 15.3
    lh.add(lampRoom)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.3, 1.3, 10), new THREE.MeshStandardMaterial({ color: 0x2a2e35 }))
    roof.position.y = 16.7
    lh.add(roof)
    // 旋转光束
    this.beamG = new THREE.Group()
    this.beamG.position.y = 15.3
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    for (const a of [0, Math.PI]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(1.3, 30, 10, 1, true), beamMat)
      beam.rotation.z = Math.PI / 2
      beam.position.set(15, 0, 0)
      const bg = new THREE.Group()
      bg.rotation.y = a
      bg.add(beam)
      this.beamG.add(bg)
    }
    this.beamMat = beamMat
    lh.add(this.beamG)
    lh.position.set(0, 0, -34)
    lh.rotation.y = Math.PI / 2
    this.scene.add(lh)
    this.wrapItems.push({ obj: lh, baseX: 210 })
  }

  _gulls() {
    this.gulls = []
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 0.9 })
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat)
      body.scale.set(0.55, 0.5, 1)
      g.add(body)
      const wgeo = new THREE.PlaneGeometry(1.1, 0.28)
      const wl = new THREE.Mesh(wgeo, mat); wl.position.z = 0
      const wr = new THREE.Mesh(wgeo, mat)
      wl.rotation.y = 0; wl.position.x = -0.5
      wr.position.x = 0.5
      const wlg = new THREE.Group(); const wrg = new THREE.Group()
      wlg.add(wl); wrg.add(wr)
      g.add(wlg); g.add(wrg)
      this.scene.add(g)
      this.gulls.push({ g, wlg, wrg, phase: Math.random() * 7, r: 12 + i * 6, h: 8 + i * 2.5 })
    }
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0x8fa3c8, 0x1c1a16, 0.5)
    this.scene.add(this.hemi)
    this.sun = new THREE.DirectionalLight(0xffffff, 1.1)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(1024, 1024)
    const sc = this.sun.shadow.camera
    sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 10; sc.far = 240
    this.sun.shadow.bias = -0.0006
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.scene.fog = new THREE.Fog(0x101a33, 100, 950)
    this._sunColTmp = new THREE.Color()
  }

  setQuality(tier) {
    if (this.seaMat) this.seaMat.uniforms.uOct.value = [2, 3, 4, 4][tier]
    if (this.seaMat) this.seaMat.uniforms.uFoamD.value = [0.6, 0.8, 1, 1][tier]
    if (this.stars) this.stars.geometry.setDrawRange(0, [500, 1000, 2000, 3200][tier])
  }

  advanceTime(sec) { this.timeSec += sec }

  // 太阳高度角关键帧:黄昏(0)→夜晚→黎明→白天→回到黄昏
  _elevAt(t) {
    const K = [[0, 0.04], [0.16, -0.5], [0.5, -0.62], [0.62, -0.5], [0.72, 0.32], [0.85, 0.62], [0.94, 0.3], [1, 0.04]]
    for (let i = 0; i < K.length - 1; i++) {
      const [t0, v0] = K[i], [t1, v1] = K[i + 1]
      if (t >= t0 && t <= t1) {
        const u = (t - t0) / (t1 - t0)
        return v0 + (v1 - v0) * (u * u * (3 - 2 * u))
      }
    }
    return 0.04
  }

  wrap(baseX) { return baseX + P * Math.round((this.app.bike.x - baseX) / P) }

  update(dt) {
    const app = this.app, bike = app.bike
    this.timeSec += dt
    this.t01 = (this.timeSec / this.T) % 1
    const a = this.t01 * Math.PI * 2
    const elev = this._elevAt(this.t01)
    this.sunDir.set(-Math.cos(a) * 0.7, elev, -0.75 + 0.4 * Math.sin(a)).normalize()
    // 权重
    const wn = smooth((-elev - 0.06) / 0.42)
    const wd = smooth((elev - 0.18) / 0.4)
    const ws = Math.max(0, 1 - wn - wd)
    const sum = wn + wd + ws
    this.nightW = wn / sum; this.dayW = wd / sum; this.duskW = ws / sum
    const N = this.nightW, D = this.dayW, S = this.duskW
    // 调色
    const zen = this._mix3(0x2f6fc4, 0x20305e, 0x05081a, D, S, N)
    const hor = this._mix3(0xbcd7f0, 0xff9d63, 0x101a33, D, S, N)
    this.horColor.copy(hor)
    this.sunColor.setHex(0xff8a3d).lerp(new THREE.Color(0xfff2d2), clamp(elev * 3, 0, 1))
    this.sunI = clamp((elev + 0.1) / 0.15, 0, 1)
    this.moonI = N
    this.exposure = 1.04 - N * 0.26 + D * 0.1
    // 天空
    const u = this.skyMat.uniforms
    u.uZen.value.copy(zen); u.uHor.value.copy(hor)
    u.uSunCol.value.copy(this.sunColor); u.uSunI.value = this.sunI
    u.uMoonI.value = this.moonI
    this.skyMesh.position.copy(app.rig.camera.position)
    this.stars.position.copy(app.rig.camera.position)
    this.starsMat.opacity = N * 0.95
    // 海
    const su = this.seaMat.uniforms
    su.uTime.value = this.timeSec
    su.uNight.value = N
    su.uHor.value.copy(hor)
    su.uSunCol.value.copy(this.sunColor); su.uSunI.value = this.sunI
    su.uMoonI.value = this.moonI
    const bring = 0.24 + 0.72 * (1 - N)
    su.uAmb.value.setRGB(bring * (1 + S * 0.3), bring * (1 + S * 0.04), bring * (1 - S * 0.22))
    // 雾
    this.scene.fog.color.copy(hor).multiplyScalar(0.85)
    this.scene.fog.near = 120 - N * 40
    // 灯光
    this.hemi.intensity = 0.3 + (1 - N) * 0.5
    this.hemi.color.copy(hor)
    const w = this.sunI / (this.sunI + this.moonI + 0.001)
    this.ray.copy(this.sunDir).multiplyScalar(w).addScaledVector(this.moonDir, 1 - w).normalize()
    this._sunColTmp.copy(this.moonColor).lerp(this.sunColor, w)
    this.sun.color.copy(this._sunColTmp)
    this.sun.intensity = this.sunI * 2.0 + this.moonI * 1.3 + 0.04
    this.ray.y = Math.max(this.ray.y, 0.3)
    this.sun.position.set(bike.x + this.ray.x * 90, this.ray.y * 90, bike.z + this.ray.z * 90)
    this.sun.target.position.set(bike.x, 0, bike.z)
    // 贴地物体跟随
    for (const s of [this.sea, this.sand, this.foam, this.road]) s.position.x = bike.x
    for (const r of this.rails) r.position.x = bike.x
    this.roadTex.offset.x = (bike.x / 8) % 1
    this.sandTex.offset.x = (bike.x / 12.5) % 1
    this.foamTex.offset.x = ((bike.x / 32) + this.timeSec * 0.22) % 1
    this.foam.material.opacity = 0.3 + 0.15 * N + 0.06 * Math.sin(this.timeSec * 1.7)
    // 护栏柱(实例化)
    for (let i = 0; i < this.posts.count; i++) {
      const x = this.wrap(this.postBases[i])
      this._m4.makeTranslation(x, 0.42, -1.55)
      this.posts.setMatrixAt(i, this._m4)
    }
    this.posts.instanceMatrix.needsUpdate = true
    // 装饰环绕
    for (const it of this.wrapItems) it.obj.position.x = this.wrap(it.baseX)
    // 灯与光束
    this.lampMat.emissiveIntensity = N * 2.4
    this.lhLampMat.emissiveIntensity = N * 2.6
    this.beamMat.opacity = N * 0.05
    this.beamG.rotation.y = this.timeSec * 0.4
    this.foam.material.color.setScalar(0.4 + 0.6 * (1 - N))
    for (const l of this.lamps) l.children[4].material.opacity = N * 0.85
    // 海鸥
    for (const gu of this.gulls) {
      const t = this.timeSec + gu.phase
      gu.g.position.set(bike.x + 16 + Math.cos(t * 0.5) * gu.r, gu.h + Math.sin(t * 0.8) * 0.8, bike.z - 6 + Math.sin(t * 0.5) * gu.r * 0.7)
      const flap = Math.sin(t * 7) * 0.55
      gu.wlg.rotation.z = flap
      gu.wrg.rotation.z = -flap
      gu.g.rotation.y = -t * 0.5
    }
    // 车头灯
    if (app.bike.headlight) app.bike.headlight.intensity = N * 6.5
    if (app.bike.headGlow) app.bike.headGlow.material.opacity = N * 0.7
    // 阶段标签
    const st = app.state
    st.nightW = N
    st.phaseLabel = N > 0.72 ? '🌌 星空月夜' : N > 0.38 ? '🌙 夜晚' : D > 0.55 ? '☀️ 白天' : (this.sunDir.x < 0 ? '🌆 黄昏' : '🌅 黎明')
  }

  _mix3(hd, hs, hn, wd, ws, wn) {
    const c = new THREE.Color()
    c.setHex(hn).multiplyScalar(wn / (wd + ws + wn))
      .add(new THREE.Color(hs).multiplyScalar(ws / (wd + ws + wn)))
      .add(new THREE.Color(hd).multiplyScalar(wd / (wd + ws + wn)))
    return c
  }
}
