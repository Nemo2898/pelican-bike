// 键盘 + 触屏输入 → app.ctl
export class Input {
  constructor(app) {
    this.app = app
    this.ctl = app.ctl = { accel: false, brake: false, left: false, right: false, jump: false, wheelie: false }
    const mark = this.mark = () => { app.state.lastInput = app.state.time }
    window.addEventListener('keydown', (e) => this.key(e, true))
    window.addEventListener('keyup', (e) => this.key(e, false))
    window.addEventListener('blur', () => { for (const k in this.ctl) this.ctl[k] = false })
    if ((navigator.maxTouchPoints || 0) > 0 || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch')
    document.getElementById('btnCam').addEventListener('click', () => this.app.rig.next())
    document.getElementById('btnSound').addEventListener('click', () => {
      const m = this.app.audio.toggleMute()
      document.getElementById('btnSound').textContent = m ? '🔇' : '🔊'
    })
    this.bindHold('tL', 'left'); this.bindHold('tR', 'right')
    this.bindHold('tAcc', 'accel'); this.bindHold('tBrk', 'brake')
    this.bindHold('tJ', 'jump'); this.bindHold('tW', 'wheelie')
  }
  bindHold(id, prop) {
    const el = document.getElementById(id)
    if (!el) return
    const down = (e) => { e.preventDefault(); this.ctl[prop] = true; this.mark(); try { el.setPointerCapture(e.pointerId) } catch (_) {} }
    const up = () => { this.ctl[prop] = false }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
  }
  key(e, isDown) {
    const c = e.code
    let used = true
    switch (c) {
      case 'KeyW': case 'ArrowUp': this.ctl.accel = isDown; break
      case 'KeyS': case 'ArrowDown': this.ctl.brake = isDown; break
      case 'KeyA': case 'ArrowLeft': this.ctl.left = isDown; break
      case 'KeyD': case 'ArrowRight': this.ctl.right = isDown; break
      case 'Space': this.ctl.jump = isDown; break
      case 'KeyT': this.ctl.wheelie = isDown; break
      default: used = false
    }
    if (used) { e.preventDefault(); if (isDown) this.mark() }
    if (!isDown || e.repeat) return
    if (c === 'KeyC') this.app.rig.next()
    else if (c >= 'Digit1' && c <= 'Digit5') this.app.rig.set(+c.slice(5) - 1)
    else if (c === 'KeyM') {
      const m = this.app.audio.toggleMute()
      document.getElementById('btnSound').textContent = m ? '🔇' : '🔊'
    }
    else if (c === 'KeyH') this.app.hud.toggleAch()
    else if (c === 'Escape') this.app.hud.closeAch()
    else if (c === 'KeyN' && this.app.debug) this.app.world.advanceTime(10)
  }
}
