// HUD / 提示 / 成就面板
export class HUD {
  constructor(app) {
    this.app = app
    const $ = this.$ = (id) => document.getElementById(id)
    this.speedVal = $('speedVal'); this.fishVal = $('fishVal'); this.distVal = $('distVal')
    this.autoChip = $('autoChip'); this.comboChip = $('comboChip'); this.comboVal = $('comboVal')
    this.timeChip = $('timeChip'); this.camChip = $('camChip'); this.qChip = $('qChip')
    this.toasts = $('toasts'); this.panel = $('achPanel'); this.achList = $('achList'); this.achCount = $('achCount')
    this.camNames = ['追尾', '电影运镜', '鹈鹕视角', '环绕', '侧跟']
    $('btnAch').onclick = () => this.toggleAch()
    $('achClose').onclick = () => this.closeAch()
    setTimeout(() => this.$('hint').classList.add('fade'), 15000)
    this._qTimer = null
    this._lastCombo = 0
  }
  show() { this.$('hud').classList.remove('hidden') }
  update(st) {
    this.speedVal.textContent = Math.round(st.speedKmh)
    this.fishVal.textContent = st.fishTotal
    this.distVal.textContent = (st.dist / 1000).toFixed(2)
    if (st.comboNow >= 2) {
      this.comboChip.classList.remove('hidden')
      this.comboVal.textContent = st.comboNow
      if (st.comboNow !== this._lastCombo) {
        this.comboChip.style.transform = 'scale(1.15)'
        setTimeout(() => (this.comboChip.style.transform = ''), 130)
      }
    } else this.comboChip.classList.add('hidden')
    this._lastCombo = st.comboNow
    this.autoChip.classList.toggle('hidden', !st.auto)
    this.timeChip.textContent = st.phaseLabel
  }
  setCam(i) { this.camChip.textContent = '🎥 ' + this.camNames[i] }
  qualityChip(label, up) {
    const c = this.qChip
    c.textContent = `⚙️ 画质 ${up ? '↑' : '↓'} ${label}`
    c.classList.remove('hidden')
    clearTimeout(this._qTimer)
    this._qTimer = setTimeout(() => c.classList.add('hidden'), 2800)
  }
  toast(icon, title, desc) {
    const d = document.createElement('div')
    d.className = 'toast'
    d.innerHTML = `<div class="ic">${icon}</div><div><div class="t1">${title}</div><div class="t2">${desc || ''}</div></div>`
    this.toasts.appendChild(d)
    while (this.toasts.children.length > 4) this.toasts.firstChild.remove()
    setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 550) }, 3800)
  }
  flash() {
    document.body.classList.add('flash')
    setTimeout(() => document.body.classList.remove('flash'), 80)
  }
  toggleAch() { this.panel.classList.toggle('closed') }
  closeAch() { this.panel.classList.add('closed') }
  buildAch(list) {
    this.achList.innerHTML = ''
    this.rows = {}
    for (const a of list) {
      const r = document.createElement('div')
      r.className = 'achrow' + (a.unlocked ? ' on' : '')
      r.innerHTML = `<div class="em">${a.icon}</div><div><div class="nm">${a.name}</div><div class="ds">${a.desc}</div></div>`
      this.achList.appendChild(r)
      this.rows[a.id] = r
    }
    this.refreshCounts(list)
  }
  refreshCounts(list) { this.achCount.textContent = `${list.filter(a => a.unlocked).length} / ${list.length}` }
  unlockAch(a, list) { this.rows[a.id]?.classList.add('on'); this.refreshCounts(list) }
}
