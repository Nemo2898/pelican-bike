// 14 个成就
const DEFS = [
  { id: 'first', icon: '🐟', name: '初次出航', desc: '抓到你的第一条鱼', cond: s => s.fishTotal >= 1 },
  { id: 'fish10', icon: '🥅', name: '小有余粮', desc: '累计抓到 10 条鱼', cond: s => s.fishTotal >= 10 },
  { id: 'fish50', icon: '🐋', name: '渔获丰盛', desc: '累计抓到 50 条鱼', cond: s => s.fishTotal >= 50 },
  { id: 'jump1', icon: '🦘', name: '跳一跳', desc: '完成第一次跳跃', cond: s => s.jumps >= 1 },
  { id: 'aircatch', icon: '🕊️', name: '空中飞鹈', desc: '跳跃中在空中抓到鱼', cond: s => s.airCatch >= 1 },
  { id: 'wheelie5', icon: '🪽', name: '展翅高飞', desc: '前轮离地累计 5 秒', cond: s => s.wheelieTime >= 5 },
  { id: 'wheeliecatch', icon: '🎪', name: '独轮神技', desc: '翘头状态下抓到鱼', cond: s => s.wheelieCatch >= 1 },
  { id: 'night1', icon: '🌙', name: '夜行者', desc: '在夜间抓到 1 条鱼', cond: s => s.nightFish >= 1 },
  { id: 'night5', icon: '🌌', name: '月色美', desc: '夜间累计抓到 5 条鱼', cond: s => s.nightFish >= 5 },
  { id: 'speed', icon: '💨', name: '追风', desc: '时速达到 45 km/h', cond: s => s.maxSpeedKmh >= 45 },
  { id: 'combo', icon: '🔥', name: '三连击', desc: '10 秒内连抓 3 条鱼', cond: s => s.maxCombo >= 3 },
  { id: 'cine', icon: '🎬', name: '电影时刻', desc: '电影运镜累计观看 30 秒', cond: s => s.cinTime >= 30 },
  { id: 'pov', icon: '👀', name: '鹈鹕视角', desc: '第一视角累计 20 秒', cond: s => s.povTime >= 20 },
  { id: 'auto', icon: '🤖', name: '咸鱼驾驶员', desc: '自动驾驶累计 45 秒', cond: s => s.autoTime >= 45 },
]

export class Achievements {
  constructor(app) {
    this.app = app
    this.list = DEFS.map(d => ({ ...d, unlocked: false }))
    try {
      const saved = JSON.parse(localStorage.getItem('pelican.ach') || '[]')
      for (const id of saved) { const a = this.list.find(x => x.id === id); if (a) a.unlocked = true }
    } catch (_) {}
    app.hud.buildAch(this.list)
  }
  tick() {
    const s = this.app.state
    for (const a of this.list) if (!a.unlocked && a.cond(s)) this.unlock(a)
  }
  unlock(a) {
    a.unlocked = true
    this.app.hud.unlockAch(a, this.list)
    this.app.hud.toast(a.icon, '成就解锁 · ' + a.name, a.desc)
    this.app.audio.ach()
    try { localStorage.setItem('pelican.ach', JSON.stringify(this.list.filter(x => x.unlocked).map(x => x.id))) } catch (_) {}
  }
}
