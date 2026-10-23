import { useState, useMemo, useEffect, useRef } from 'react'
import './App.css'

/* ==========================================================================
   1) OYUNCU LİSTESİ  —  KENDİ OYUNCULARINI BURAYA YAZ
   --------------------------------------------------------------------------
   Her satıra bir oyuncu yaz: "İsim Soyisim" + statlar.
     Oyuncu : Ahmet Haşim Defans:60 Atak:70 Çalım:80
     Kaleci : Mert Karaca Kavrama:85 Refleks:80 Hava:70 Ayak:60
   - Kaleci sahada da oynuyorsa sonuna Defans:70 gibi yazabilirsin.
   - Satırın başına istersen "x:" yazabilirsin, zorunlu değil.
   - # veya // ile başlayan satırlar yoksayılır.
   - Oyuncunun puanı = en iyi pozisyonundaki stat. Başka pozisyonda oynarsa:
     yazdığın stat varsa o, yoksa en iyi puandan hesaplanır (bkz. bölüm 3).
   - Dosyayı kaydedince siteyi yeniden yayınla (GitHub Pages ise push et).
   ========================================================================== */
const PLAYER_CODES = `
# ---- ÖRNEK LİSTE: bunları silip kendi oyuncularını yaz ----

# Oyuncular
Ahmet Haşim Defans:60 Atak:70 Çalım:80
Mehmet Kaya Defans:82 Çalım:60
Mustafa Demir Defans:75 Atak:60 Çalım:65
Ali Şahin Defans:88
Hasan Çelik Atak:85 Çalım:72
Hüseyin Yıldız Atak:95
İbrahim Aydın Çalım:84 Defans:62
Osman Arslan Defans:70 Atak:72 Çalım:76
Yusuf Kılıç Atak:78 Çalım:70
Murat Aslan Defans:80 Çalım:61
Emre Çetin Çalım:88 Atak:74 Defans:66
Burak Koç Atak:83 Defans:45
Cem Kurt Defans:73 Atak:64 Çalım:77
Deniz Özkan Defans:77 Çalım:63
Erdem Yıldırım Atak:72 Çalım:68
Furkan Öztürk Defans:90 Çalım:65
Gökhan Özdemir Çalım:79
Kerem Doğan Atak:81 Çalım:75
Onur Şimşek Defans:68 Çalım:72
Umut Polat Atak:76
Yiğit Korkmaz Defans:84 Atak:55
Barış Erdoğan Çalım:82 Defans:70 Atak:65
Can Güneş Atak:69 Çalım:71
Doğan Aksoy Defans:72
Eren Bulut Atak:88 Çalım:77 Defans:50
Halil Taş Defans:79 Çalım:70
Kaan Aktaş Çalım:74 Atak:68
Taner Bilgin Atak:73 Defans:58
Selim Soylu Defans:65 Çalım:69
Volkan Yalçın Çalım:86 Atak:80
Cihan Tekin Defans:71 Atak:62

# Kaleciler (Defans:xx yazılanlar sahada defans da oynuyor)
Mert Karaca Kavrama:85 Refleks:80 Hava:70 Ayak:60 Defans:62
Serkan Kara Kavrama:78 Refleks:84 Hava:72 Ayak:55
Tolga Güneş Kavrama:70 Refleks:68 Hava:75 Ayak:66 Defans:70
Berk Uçar Kavrama:74 Refleks:77 Hava:69 Ayak:72
`

/* ==========================================================================
   2) SABİTLER
   ========================================================================== */
const POSITIONS = ['GK', 'DEF', 'MID', 'FW']
const POSITION_LABELS = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FW: 'Forvet' }
const FILTERS = ['DEF', 'MID', 'FW', 'GK']
const FILTER_LABELS = { DEF: 'Defans', MID: 'Orta', FW: 'Forvet', GK: 'Kaleci' }
const TEAM_LABELS = { black: 'Siyah', red: 'Kırmızı' }

// Sahada yukarıdan aşağıya sıralama (üstte hücum, altta kale)
// GKT = üstteki kale (sadece "Tümü" görünümünde, Kırmızı kaleci burada durur)
const ROW_ORDER = ['FW', 'MID', 'DEF', 'GK']
const ROW_ORDER_ALL = ['GKT', ...ROW_ORDER]
const FORMATION_ROWS = ['DEF', 'MID', 'FW']

// Maç formatları: 5v5 ... 8v8 (her takımda 1 kaleci + geri kalan oyuncu)
const TEAM_SIZES = [5, 6, 7, 8]
const DEFAULT_TEAM_SIZE = 7
const MAX_GK = 2

const TIER_COLORS = {
  'tier-elit': '#f5b301',
  'tier-iyi': '#22c55e',
  'tier-orta': '#3b82f6',
  'tier-gelisim': '#94a3b8'
}

// Statlar: oyuncu ve kaleci ayrı
const STAT_LABELS = {
  defans: 'DEF', atak: 'ATK', calim: 'ÇAL',
  kavrama: 'KAV', refleks: 'REF', hava: 'HAV', ayak: 'AYK'
}
const FIELD_STATS = [
  { key: 'defans', label: 'Defans', code: 'Defans' },
  { key: 'atak', label: 'Atak', code: 'Atak' },
  { key: 'calim', label: 'Çalım', code: 'Çalım' }
]
const GK_STATS = [
  { key: 'kavrama', label: 'Topu Kavrama', code: 'Kavrama' },
  { key: 'refleks', label: 'Refleks', code: 'Refleks' },
  { key: 'hava', label: 'Hava Topu', code: 'Hava' },
  { key: 'ayak', label: 'Ayakla Oyun', code: 'Ayak' }
]
const FIELD_POS = { defans: 'DEF', atak: 'FW', calim: 'MID' }
const GK_KEYS = GK_STATS.map(s => s.key)
const KEY_ALIASES = {
  havatopu: 'hava', ayakoyunu: 'ayak', ayaklaoyun: 'ayak', topukavrama: 'kavrama'
}
const ALL_STATS = [...FIELD_STATS, ...GK_STATS]
const CODE_BY_KEY = Object.fromEntries(ALL_STATS.map(s => [s.key, s.code]))
const LABEL_BY_KEY = Object.fromEntries(ALL_STATS.map(s => [s.key, s.label]))

/* ==========================================================================
   3) POZİSYONA GÖRE PUAN ALGORİTMASI
   --------------------------------------------------------------------------
   Kart puanı (rating) = oyuncunun EN İYİ pozisyonundaki puanı.
   Başka bir sırada oynayınca puan şöyle bulunur:

   1) O pozisyon için stat YAZILDIYSA o stat geçerlidir.
   2) Yazılmadıysa hesaplanır:
      - Oyuncu : en iyi puan - uzaklık cezası. Defans-Orta Saha-Forvet sırasında
                 1 kademe -10, 2 kademe -25 (95'lik forvet Defansta 70 olur).
      - Kaleci : saha becerisi = ayak %50 + hava %25 + refleks %25.
                 Saha becerisinden Defansta -5, Orta Sahada -15, Forvette -25.
                 Kaleciye Defans:70 yazarsan 1. kural geçerli olur.
   3) Oyuncu kaleye geçerse en iyi puanının yarısı kadar olur.
   Aşağıdaki sayıları değiştirerek sistemi kendine göre ayarlayabilirsin.
   ========================================================================== */
const POS_STAT = { DEF: 'defans', MID: 'calim', FW: 'atak' }
const POS_INDEX = { DEF: 0, MID: 1, FW: 2 }
const DIST_PENALTY = [0, 10, 25]                         // oyuncu: 0, 1, 2 kademe
const KEEPER_FIELD_PENALTY = { DEF: 5, MID: 15, FW: 25 } // kaleci sahada
const FIELD_GK_FACTOR = 0.5                              // oyuncu kalede
const MIN_RATING = 25
const MAX_RATING = 99

// Kalecinin saha içi oyun becerisi
function keeperFieldSkill(p) {
  const s = p.stats || {}
  const parts = [['ayak', 0.5], ['hava', 0.25], ['refleks', 0.25]].filter(([k]) => s[k] != null)
  if (parts.length === 0) return Math.round(p.rating * 0.6)
  const weight = parts.reduce((a, [, w]) => a + w, 0)
  return Math.round(parts.reduce((a, [k, w]) => a + s[k] * w, 0) / weight)
}

function ratingAt(p, pos) {
  const fit = n => Math.max(MIN_RATING, Math.min(MAX_RATING, Math.round(n)))
  const isKeeper = p.position === 'GK'

  if (pos === 'GK') return isKeeper ? p.rating : fit(p.rating * FIELD_GK_FACTOR)

  const entered = p.stats ? p.stats[POS_STAT[pos]] : undefined
  if (entered != null) return entered

  if (isKeeper) return fit(keeperFieldSkill(p) - KEEPER_FIELD_PENALTY[pos])
  return fit(p.rating - DIST_PENALTY[Math.abs(POS_INDEX[pos] - POS_INDEX[p.position])])
}

// Oyuncunun kendiliğinden duracağı sıra (kaleci slotunda değilse kaleci defansta durur)
const naturalRow = p => (p.position === 'GK' ? 'DEF' : p.position)

/* ==========================================================================
   4) YARDIMCI FONKSİYONLAR
   ========================================================================== */
function getTier(rating) {
  if (rating >= 85) return { label: 'Elit', class: 'tier-elit' }
  if (rating >= 75) return { label: 'İyi', class: 'tier-iyi' }
  if (rating >= 65) return { label: 'Orta', class: 'tier-orta' }
  return { label: 'Gelişim', class: 'tier-gelisim' }
}

const byRatingDesc = (a, b) => b.rating - a.rating

// Oyuncunun stat özeti: "DEF 60 · ATK 70"
const statLine = p =>
  p.stats
    ? Object.entries(p.stats).map(([k, v]) => `${STAT_LABELS[k] || k} ${v}`).join(' · ')
    : ''

// Üstteki kale satırı da kaleci pozisyonudur
const posCode = r => (r === 'GKT' ? 'GK' : r)

const signed = n => (n > 0 ? `+${n}` : String(n))

const clamp = n => Math.max(1, Math.min(99, n))

// Dokunmatik cihazlarda hafif titreşim
const buzz = (ms = 12) => {
  try {
    if (navigator.vibrate) navigator.vibrate(ms)
  } catch {}
}

// Türkçe karakterleri sadeleştir (Çalım = calim = CALIM)
const norm = s =>
  s.toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ğ/g, 'g')

const nameKey = p => norm(`${p.firstName} ${p.lastName}`).replace(/\s+/g, ' ').trim()
const fullName = p => `${p.firstName} ${p.lastName}`

// Oyuncu ID'si isimden üretilir, liste sırası değişse de sabit kalır
function makeId(p, used) {
  const base =
    norm(fullName(p)).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'oyuncu'
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

// Tek satırı oyuncuya çevirir
//   Oyuncu: "Ahmet Haşim Defans:60 Atak:70 Çalım:80"
//   Kaleci: "Mert Kaya Kavrama:85 Refleks:80 Hava:70 Ayak:60 Defans:62"
function parseLine(line) {
  const clean = line.trim().replace(/^x\s*:\s*/i, '')
  if (!clean) return null

  const statStart = clean.search(/\S+\s*:\s*\d/)
  if (statStart <= 0) return { error: 'İsim veya stat bulunamadı' }

  const words = clean.slice(0, statStart).trim().split(/\s+/)
  if (words.length < 2) return { error: 'İsim ve soyisim gerekli' }
  const lastName = words[words.length - 1]
  const firstName = words.slice(0, -1).join(' ')

  const stats = {}
  for (const m of clean.slice(statStart).matchAll(/(\S+?)\s*:\s*(\d{1,3})/g)) {
    let key = norm(m[1])
    key = KEY_ALIASES[key] || key
    if (key === 'kaleci') {
      return { error: 'Kaleci statı kalktı, Kavrama / Refleks / Hava / Ayak kullan' }
    }
    if (!FIELD_POS[key] && !GK_KEYS.includes(key)) {
      return { error: `Bilinmeyen stat: ${m[1]}` }
    }
    stats[key] = clamp(Number(m[2]))
  }

  const entries = Object.entries(stats)
  if (entries.length === 0) return { error: 'Stat bulunamadı' }

  // Kaleci stat varsa oyuncu kalecidir; Defans/Atak/Çalım yazarsa sahada oynarken o puanlar geçerli
  const gkEntries = entries.filter(([k]) => GK_KEYS.includes(k))
  let rating, position
  if (gkEntries.length > 0) {
    rating = Math.round(gkEntries.reduce((s, [, v]) => s + v, 0) / gkEntries.length)
    position = 'GK'
  } else {
    const best = [...entries].sort((a, b) => b[1] - a[1])[0]
    rating = best[1]
    position = FIELD_POS[best[0]]
  }

  return { firstName, lastName, position, rating, stats }
}

// PLAYER_CODES metnini oyunculara çevirir
function buildBasePlayers(text) {
  const players = []
  const errors = []
  const used = new Set()
  const seen = new Set()

  text.split('\n').forEach(raw => {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) return
    const res = parseLine(line)
    if (!res) return
    if (res.error) {
      errors.push({ text: line, error: res.error })
      return
    }
    const key = nameKey(res)
    if (seen.has(key)) {
      errors.push({ text: line, error: 'Bu isim listede zaten var' })
      return
    }
    seen.add(key)
    players.push({ id: makeId(res, used), ...res })
  })
  return { players, errors }
}

const BASE = buildBasePlayers(PLAYER_CODES)
const BASE_KEYS = new Set(BASE.players.map(nameKey))
const BASE_IDS = new Set(BASE.players.map(p => p.id))

// Oyuncuyu kod satırına çevirir (koda yapıştırmak için)
const toCode = p =>
  [
    fullName(p),
    ...Object.entries(p.stats || {}).map(([k, v]) => `${CODE_BY_KEY[k] || k}:${v}`)
  ].join(' ')

// Takım yapısı: her takımda 1 kaleci + oyuncu listesi
const emptyTeams = () => ({
  black: { gk: null, field: [] },
  red: { gk: null, field: [] }
})

// Bir takımdan verilen ID'leri çıkarır
const removeIds = (t, ids) => ({
  gk: ids.has(t.gk) ? null : t.gk,
  field: t.field.filter(x => !ids.has(x))
})

// Tohumlu rastgele sayı üreteci (aynı tohum = aynı sonuç)
function makeRng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffled(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* --------------------------------------------------------------------------
   Otomatik takım kurma
   - pool: sahadaki oyuncular (+ otomatik seçilen kaleciler)
   - Seçili kaleciler korunur. Kalan oyuncular için 400 farklı bölünme denenir:
       skor = |toplam puan farkı| + 4 x (pozisyon sayısı dengesizliği)
   - shuffle=false: en iyi skor (her seferinde aynı sonuç)
   - shuffle=true : en iyiye yakın sonuçlardan rastgele biri
   -------------------------------------------------------------------------- */
function autoFormTeams(pool, current, { rate, gkRate, posOf, fieldSlots, shuffle }) {
  const sorted = [...pool].sort((a, b) => rate(b) - rate(a))
  const has = id => pool.some(p => p.id === id)
  const find = id => pool.find(p => p.id === id)

  const gkB = has(current.black.gk) ? current.black.gk : null
  const gkR = has(current.red.gk) ? current.red.gk : null

  const players = sorted.filter(p => p.id !== gkB && p.id !== gkR).slice(0, fieldSlots * 2)

  const n = players.length
  const ideal = ((gkR ? 1 : 0) - (gkB ? 1 : 0) + n) / 2
  const lo = Math.max(0, n - fieldSlots)
  const hi = Math.min(n, fieldSlots)
  const sizes = [
    ...new Set([Math.floor(ideal), Math.ceil(ideal)].map(v => Math.min(hi, Math.max(lo, v))))
  ]

  const gkDiff = (gkB ? gkRate(find(gkB)) : 0) - (gkR ? gkRate(find(gkR)) : 0)
  const score = (b, r) => {
    const sb = b.reduce((s, p) => s + rate(p), 0)
    const sr = r.reduce((s, p) => s + rate(p), 0)
    let imbalance = 0
    for (const pos of FORMATION_ROWS) {
      imbalance += Math.abs(
        b.filter(p => posOf(p) === pos).length - r.filter(p => posOf(p) === pos).length
      )
    }
    return Math.abs(gkDiff + sb - sr) + imbalance * 4
  }

  const rng = makeRng(shuffle ? Math.floor(Math.random() * 1e9) : 12345)
  const candidates = []
  for (let k = 0; k < 400; k++) {
    const order = shuffled(players, rng)
    const nb = sizes[k % sizes.length]
    const b = order.slice(0, nb)
    const r = order.slice(nb)
    candidates.push({ b, r, s: score(b, r) })
  }
  candidates.sort((x, y) => x.s - y.s)

  let pick = candidates[0]
  if (shuffle) {
    const curSig = [...current.black.field].sort().join(',')
    const sig = list => list.map(p => p.id).sort().join(',')
    let near = candidates.filter(c => c.s <= pick.s + 3 && sig(c.b) !== curSig)
    if (near.length === 0) near = candidates.filter(c => c.s <= pick.s + 3)
    pick = near[Math.floor(Math.random() * near.length)]
  }

  const order = { DEF: 0, MID: 1, FW: 2 }
  const tidy = list =>
    [...list]
      .sort((a, b) => (order[posOf(a)] ?? 3) - (order[posOf(b)] ?? 3) || rate(b) - rate(a))
      .map(p => p.id)

  return {
    black: { gk: gkB, field: tidy(pick.b) },
    red: { gk: gkR, field: tidy(pick.r) }
  }
}

/* --------------------------------------------------------------------------
   Dizilim (2-3-1 gibi): oyuncuları en yüksek toplam puanı verecek şekilde
   Defans / Orta Saha / Forvet sıralarına dağıtır.
   -------------------------------------------------------------------------- */
const spreadOf = a => Math.max(...a) - Math.min(...a)

function formationPresets(fieldSlots) {
  const list = []
  for (let d = 1; d <= 3; d++) {
    for (let m = 1; m <= 4; m++) {
      for (let f = 1; f <= 3; f++) {
        if (d + m + f === fieldSlots) list.push([d, m, f])
      }
    }
  }
  list.sort((a, b) => spreadOf(a) - spreadOf(b))
  return list.slice(0, 6)
}

function assignFormation(players, counts) {
  let best = null
  const left = [...counts]
  const cur = []
  const dfs = (i, total) => {
    if (i === players.length) {
      if (!best || total > best.total) best = { total, rows: [...cur] }
      return
    }
    for (let r = 0; r < 3; r++) {
      if (left[r] === 0) continue
      left[r]--
      cur[i] = FORMATION_ROWS[r]
      dfs(i + 1, total + ratingAt(players[i], FORMATION_ROWS[r]))
      left[r]++
    }
  }
  dfs(0, 0)
  return best
}

function bestFormation(players, presets) {
  let best = null
  for (const counts of presets) {
    const res = assignFormation(players, counts)
    if (res && (!best || res.total > best.total)) best = { counts, ...res }
  }
  return best
}

// localStorage'a otomatik kaydeden state
function usePersistentState(key, initial) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      if (raw) return JSON.parse(raw)
    } catch {}
    return typeof initial === 'function' ? initial() : initial
  })

  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)) } catch {}
  }, [key, state])

  return [state, setState]
}

// Esc tuşuna basınca çalışır
function useEscape(handler) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') handler() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handler])
}

// Sürükleme sırasında imlecin hangi sıraya ve hangi kartın önüne denk geldiğini bulur
function findDrop(x, y, dragId) {
  const none = { row: null, beforeId: null, markerX: 0 }
  const pitchEl = document.querySelector('.pitch')
  if (!pitchEl) return none

  const pr = pitchEl.getBoundingClientRect()
  if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) return none

  // Dikeyde imlece en yakın sırayı seç
  let rowEl = null
  let best = Infinity
  for (const r of document.querySelectorAll('.pitch-row')) {
    const b = r.getBoundingClientRect()
    const d = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0
    if (d < best) { best = d; rowEl = r }
  }
  if (!rowEl) return none

  const cardsEl = rowEl.querySelector('.row-cards') || rowEl
  const cr = cardsEl.getBoundingClientRect()
  const cards = [...cardsEl.querySelectorAll('[data-pid]')].filter(
    c => c.dataset.pid !== dragId
  )

  let beforeId = null
  let markerX = cr.width / 2
  for (const c of cards) {
    const r = c.getBoundingClientRect()
    if (x < r.left + r.width / 2) {
      beforeId = c.dataset.pid
      markerX = r.left - cr.left - 6
      break
    }
  }
  if (beforeId === null && cards.length > 0) {
    const last = cards[cards.length - 1].getBoundingClientRect()
    markerX = last.right - cr.left + 6
  }

  return { row: rowEl.dataset.row, beforeId, markerX }
}

/* --------------------------------------------------------------------------
   Paylaşım: WhatsApp metni ve PNG görsel
   -------------------------------------------------------------------------- */
function teamsToText(d, showRatings) {
  const block = (icon, t) => {
    const lines = t.rows.map(r => {
      const bits = [r.name, POSITION_LABELS[r.pos] || r.pos]
      if (showRatings) bits.push(r.rating)
      return `${r.gk ? '🧤' : '▫️'} ${bits.join(' · ')}`
    })
    return [
      `${icon} ${t.name} TAKIM${showRatings ? ` (${t.sum})` : ''}`,
      ...(lines.length ? lines : ['(oyuncu yok)'])
    ].join('\n')
  }
  const out = [`⚽ Halı Saha Maçı · ${d.size}v${d.size}`, '', block('⚫', d.black), '', block('🔴', d.red)]
  if (showRatings && d.black.rows.length && d.red.rows.length) {
    out.push('', `Puan farkı: ${Math.abs(d.black.sum - d.red.sum)}`)
  }
  return out.join('\n')
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

function fitText(g, text, maxW) {
  if (g.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && g.measureText(`${t}…`).width > maxW) t = t.slice(0, -1)
  return `${t}…`
}

function renderTeamsImage(d, showRatings) {
  const W = 1080
  const pad = 48
  const gap = 24
  const colW = (W - pad * 2 - gap) / 2
  const rowH = 76
  const headH = 170
  const boxHead = 88
  const rows = Math.max(d.black.rows.length, d.red.rows.length, 1)
  const boxH = boxHead + rows * rowH + 28
  const H = headH + boxH + 110

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d')
  const font = (weight, size) => `${weight} ${size}px "Segoe UI", system-ui, Roboto, sans-serif`

  const bg = g.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#14391f')
  bg.addColorStop(1, '#0c1117')
  g.fillStyle = bg
  g.fillRect(0, 0, W, H)

  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  g.fillStyle = '#ffffff'
  g.font = font('800', 56)
  g.fillText('Halı Saha Maçı', pad, 96)
  g.fillStyle = '#9db7d6'
  g.font = font('600', 30)
  g.fillText(`${d.size} vs ${d.size} · ${new Date().toLocaleDateString('tr-TR')}`, pad, 140)

  const cols = [
    { t: d.black, x: pad, head: '#2a323d' },
    { t: d.red, x: pad + colW + gap, head: '#a32020' }
  ]

  cols.forEach(({ t, x, head }) => {
    const y0 = headH

    g.save()
    roundRect(g, x, y0, colW, boxH, 26)
    g.fillStyle = '#151b23'
    g.fill()
    g.clip()
    g.fillStyle = head
    g.fillRect(x, y0, colW, boxHead)
    g.restore()

    g.fillStyle = '#ffffff'
    g.font = font('800', 34)
    g.textAlign = 'left'
    g.fillText(`${t.name} TAKIM`, x + 28, y0 + 56)
    if (showRatings) {
      g.textAlign = 'right'
      g.font = font('700', 30)
      g.fillText(String(t.sum), x + colW - 28, y0 + 56)
    }

    if (t.rows.length === 0) {
      g.textAlign = 'left'
      g.fillStyle = '#8b98a8'
      g.font = font('600', 28)
      g.fillText('Oyuncu yok', x + 28, y0 + boxHead + 60)
    }

    t.rows.forEach((r, i) => {
      const y = y0 + boxHead + 14 + i * rowH
      const color = TIER_COLORS[r.tier] || '#94a3b8'

      roundRect(g, x + 16, y, colW - 32, rowH - 12, 14)
      g.fillStyle = r.gk ? 'rgba(245,179,1,0.14)' : '#1d2530'
      g.fill()
      g.fillStyle = r.gk ? '#f5b301' : color
      g.fillRect(x + 16, y + 8, 6, rowH - 28)

      g.textAlign = 'left'
      let nameX = x + 42
      if (showRatings) {
        g.fillStyle = color
        g.font = font('800', 34)
        g.fillText(String(r.rating), x + 40, y + 43)
        nameX = x + 112
      }
      g.fillStyle = '#e8edf3'
      g.font = font('600', 30)
      g.fillText(fitText(g, r.name, colW - (nameX - x) - 130 - 32), nameX, y + 43)

      g.textAlign = 'right'
      g.fillStyle = '#8b98a8'
      g.font = font('700', 24)
      g.fillText(POSITION_LABELS[r.pos] || r.pos, x + colW - 32, y + 42)
    })
  })

  if (showRatings && d.black.rows.length && d.red.rows.length) {
    g.textAlign = 'center'
    g.fillStyle = '#9db7d6'
    g.font = font('600', 28)
    g.fillText(`Puan farkı: ${Math.abs(d.black.sum - d.red.sum)}`, W / 2, headH + boxH + 62)
  }
  return canvas
}

// Telefonda paylaşım menüsünü açar, olmazsa dosyayı indirir
async function saveImage(d, showRatings) {
  const canvas = renderTeamsImage(d, showRatings)
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  if (!blob) return false
  const file = new File([blob], 'takimlar.png', { type: 'image/png' })
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Takımlar' })
      return true
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return false
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'takimlar.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/* ==========================================================================
   5) KÜÇÜK BİLEŞENLER
   ========================================================================== */
const svgProps = {
  viewBox: '0 0 24 24',
  width: 22,
  height: 22,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true
}

const TAB_ICONS = {
  players: (
    <svg {...svgProps}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17.5" cy="9" r="2.4" />
      <path d="M16 14.3c2.9.3 5 2.5 5 5.7" />
    </svg>
  ),
  pitch: (
    <svg {...svgProps}>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M12 4v16" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  teams: (
    <svg {...svgProps}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  )
}

function TopBar({ fieldOnPitch, maxField, gkCount, canUndo, onUndo }) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true"></span>
        <h1 className="page-title">FIFA Takım Kurma</h1>
      </div>
      <div className="topbar-right">
        <button
          className="icon-btn"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Geri al"
          title="Son değişikliği geri al (Ctrl+Z)"
        >
          <span aria-hidden="true">↶</span>
          <span className="icon-btn-text">Geri Al</span>
        </button>
        <div className="topbar-stats">
          <span className="stat-pill">Oyuncu <b>{fieldOnPitch}/{maxField}</b></span>
          <span className="stat-pill gk">Kaleci <b>{gkCount}/{MAX_GK}</b></span>
        </div>
      </div>
    </header>
  )
}

// Sıradaki adımı gösteren rehber çubuğu
function GuideBar({ step, onHide }) {
  return (
    <div className="guide" role="status">
      <span className="guide-dots" aria-label={`Adım ${step.n}/4`}>
        {[1, 2, 3, 4].map(i => <i key={i} className={i <= step.n ? 'on' : ''}></i>)}
      </span>
      <span className="guide-text">{step.text}</span>
      <button className="btn-primary small" onClick={step.run}>{step.action}</button>
      <button className="guide-x" aria-label="Rehberi gizle" title="Gizle" onClick={onHide}>✕</button>
    </div>
  )
}

function TabBar({ tab, setTab, playerCount, teamCount }) {
  const items = [
    { id: 'players', label: 'Oyuncular', badge: 0 },
    { id: 'pitch', label: 'Saha', badge: playerCount },
    { id: 'teams', label: 'Takımlar', badge: teamCount }
  ]
  return (
    <nav className="tabbar" aria-label="Bölümler">
      {items.map(it => (
        <button
          key={it.id}
          className={`tab-btn ${tab === it.id ? 'active' : ''}`}
          aria-current={tab === it.id ? 'page' : undefined}
          onClick={() => setTab(it.id)}
        >
          <span className="tab-icon">{TAB_ICONS[it.id]}</span>
          <span className="tab-label">{it.label}</span>
          {it.badge > 0 && <span className="tab-badge">{it.badge}</span>}
        </button>
      ))}
    </nav>
  )
}

function ListWarnings({ errors }) {
  if (!errors.length) return null
  return (
    <div className="list-warn" role="alert">
      <strong>Oyuncu listesinde {errors.length} hatalı satır var:</strong>
      <ul>
        {errors.slice(0, 5).map((e, i) => (
          <li key={i}><code>{e.text}</code> → {e.error}</li>
        ))}
      </ul>
      {errors.length > 5 && <span>... ve {errors.length - 5} satır daha</span>}
    </div>
  )
}

// Hem listede hem sahada kullanılan oyuncu kartı
function PlayerCard({
  player, rating, compact, onClick, onPitch, onInfo, absent,
  team, label, dragging, selected, onPointerDown, onRemove
}) {
  const shown = rating != null ? rating : player.rating
  const tier = getTier(shown)
  const delta = shown - player.rating

  const onKey = e => {
    if (e.target !== e.currentTarget) return
    if ((e.key === 'Enter' || e.key === ' ') && onClick) {
      e.preventDefault()
      onClick()
    }
  }

  // Sahadaki kart
  if (compact) {
    const row = label || player.position
    const offPos = row !== player.position
    return (
      <div
        className={`pitch-card ${tier.class} ${dragging ? 'dragging' : ''} ${selected ? 'selected' : ''} ${offPos ? 'off-pos' : ''}`}
        data-pid={player.id}
        role="button"
        tabIndex={0}
        aria-pressed={!!selected}
        aria-label={`${fullName(player)}, ${shown}, ${POSITION_LABELS[row] || row}`}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onKeyDown={onKey}
        title="Dokun: seç · Bilgisayarda sürükleyebilirsin"
      >
        {team && <span className={`team-dot ${team}`}></span>}
        {onRemove && (
          <button
            className="pitch-remove"
            aria-label="Sahadan çıkar"
            title="Sahadan çıkar"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove() }}
          >✕</button>
        )}
        {player.position === 'GK' && row !== 'GK' && (
          <span className="gk-badge" title="Kaleci sahada oynuyor">K</span>
        )}
        <div className="pitch-card-top">
          <div className="pitch-card-score">
            <span className="pitch-card-rating">{shown}</span>
            {delta !== 0 && (
              <span
                className={`card-delta ${delta < 0 ? 'down' : 'up'}`}
                title="Kendi pozisyonunun dışında oynuyor"
              >{signed(delta)}</span>
            )}
          </div>
          <span className="pitch-card-pos">{row}</span>
        </div>
        <div className="pitch-card-name">{player.firstName}</div>
        <div className="pitch-card-lastname">{player.lastName}</div>
      </div>
    )
  }

  // Liste kartı
  const keeperNote = player.position === 'GK' ? `Defansta ${ratingAt(player, 'DEF')}` : ''
  return (
    <div
      className={`player-card ${tier.class} ${onPitch ? 'on-pitch' : ''} ${absent ? 'absent' : ''}`}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={onKey}
    >
      <div className="player-card-left">
        <span className="player-rating">{shown}</span>
      </div>
      <div className="player-card-right">
        <span className="player-name">{fullName(player)}</span>
        <span className="player-tier">
          {absent ? 'Gelmiyor' : tier.label}
          {onPitch ? ' · sahada' : ''}
          {keeperNote && !absent ? ` · ${keeperNote}` : ''}
        </span>
        {player.stats && <span className="player-stats">{statLine(player)}</span>}
      </div>
      <span className={`pos-chip pos-${player.position}`} title="En iyi olduğu pozisyon">
        {POSITION_LABELS[player.position]}
      </span>
      {onInfo && (
        <button
          className="info-btn"
          aria-label="Oyuncu detayı"
          title="Oyuncu detayı"
          onClick={e => { e.stopPropagation(); onInfo(player) }}
        >i</button>
      )}
    </div>
  )
}

// Oyuncu seçme penceresi (mobilde alttan açılır)
// rateOf(p): oyuncunun o yerde alacağı puan (seçerken görünsün diye)
function Picker({ title, groups, onPick, onClose, full, fullText, emptyText, rateOf }) {
  const [query, setQuery] = useState('')
  const q = norm(query.trim())
  useEscape(onClose)

  const shown = groups
    .map(g => ({ ...g, players: g.players.filter(p => norm(fullName(p)).includes(q)) }))
    .filter(g => g.players.length > 0)

  const total = groups.reduce((s, g) => s + g.players.length, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="panel-toggle" aria-label="Kapat" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {total > 6 && (
            <input
              className="search-input"
              placeholder="İsim ara..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          )}
          {full && <p className="modal-hint warn">{fullText || 'Yer dolu.'}</p>}
          {total === 0 && <p className="modal-hint">{emptyText || 'Seçilecek oyuncu yok.'}</p>}
          {total > 0 && shown.length === 0 && <p className="modal-hint">Oyuncu bulunamadı.</p>}

          {shown.map(g => (
            <div key={g.label}>
              <div className="slot-title">{g.label} <span>{g.players.length}</span></div>
              <div className="pick-list">
                {g.players.map(p => {
                  const r = rateOf ? rateOf(p) : p.rating
                  const tier = getTier(r)
                  const sub = [r !== p.rating ? `en iyi ${p.rating}` : '', statLine(p)]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <button
                      key={p.id}
                      className={`pick-item ${tier.class}`}
                      disabled={full}
                      onClick={() => onPick(p.id)}
                    >
                      <span className="pick-rating">{r}</span>
                      <span className="pick-main">
                        <span className="pick-name">{fullName(p)}</span>
                        {sub && <span className="pick-stats">{sub}</span>}
                      </span>
                      <span className={`pos-chip pos-${p.position}`}>{POSITION_LABELS[p.position]}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <button className="btn-secondary" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  )
}

// Oyuncu detay penceresi: stat çubukları, pozisyona göre puanlar, hızlı işlemler
function PlayerDetail({ player, onPitch, absent, teams, onClose, onPlace, onToggle, onKeeper, onAbsent }) {
  useEscape(onClose)
  const tier = getTier(player.rating)
  const isGk = player.position === 'GK'
  const stats = Object.entries(player.stats || {})

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={`modal ${tier.class}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${fullName(player)} detayı`}
        onClick={e => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>Oyuncu Detayı</h3>
          <button className="panel-toggle" aria-label="Kapat" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="detail-hero">
            <div className="detail-rating">{player.rating}</div>
            <div className="detail-meta">
              <strong>{fullName(player)}</strong>
              <span className="detail-tier">{tier.label}</span>
              <span className={`pos-chip pos-${player.position}`}>
                En iyi: {POSITION_LABELS[player.position]}
              </span>
            </div>
          </div>

          <div>
            <div className="slot-title">Pozisyona göre puan <span>dokun: o sıraya ekle</span></div>
            <div className="rating-preview">
              {isGk ? (
                <span className="pos-chip pos-GK best">Kaleci {player.rating}</span>
              ) : (
                <span className="pos-chip pos-GK muted">Kalede {ratingAt(player, 'GK')}</span>
              )}
              {FORMATION_ROWS.map(pos => (
                <button
                  key={pos}
                  className={`pos-chip pos-${pos} btn ${pos === player.position ? 'best' : ''}`}
                  disabled={absent}
                  onClick={() => onPlace(player, pos)}
                >
                  {POSITION_LABELS[pos]} {ratingAt(player, pos)}
                </button>
              ))}
            </div>
          </div>

          {stats.length > 0 && (
            <div>
              <div className="slot-title">Statlar</div>
              <div className="stat-bars">
                {stats.map(([k, v]) => (
                  <div key={k} className="stat-bar">
                    <span className="stat-bar-label">{LABEL_BY_KEY[k] || k}</span>
                    <span className="stat-bar-track"><i style={{ width: `${v}%` }}></i></span>
                    <b>{v}</b>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isGk && (
            <div className="detail-actions">
              {['black', 'red'].map(t => {
                const isThis = teams[t].gk === player.id
                const taken = !!teams[t].gk && !isThis
                return (
                  <button
                    key={t}
                    className={isThis ? 'btn-secondary danger' : 'btn-primary'}
                    disabled={taken || (absent && !isThis)}
                    onClick={() => onKeeper(t, player)}
                  >
                    {isThis ? `${TEAM_LABELS[t]} kaleciden çıkar` : `${TEAM_LABELS[t]} kaleci yap`}
                  </button>
                )
              })}
            </div>
          )}

          <div className="detail-actions">
            <button
              className={onPitch ? 'btn-secondary danger' : 'btn-secondary'}
              disabled={absent && !onPitch}
              onClick={() => onToggle(player)}
            >
              {onPitch ? 'Sahadan Çıkar' : isGk ? 'Defansta Oynat' : 'Sahaya Ekle'}
            </button>
            <button className={absent ? 'btn-primary' : 'btn-secondary'} onClick={() => onAbsent(player)}>
              {absent ? 'Geliyor' : 'Gelmiyor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Takımları paylaşma penceresi
function ShareModal({ data, onClose, onFlash }) {
  useEscape(onClose)
  const [showRatings, setShowRatings] = useState(true)
  const text = teamsToText(data, showRatings)
  const empty = data.black.rows.length + data.red.rows.length === 0

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      onFlash('Metin kopyalandı')
    } catch {
      onFlash('Kopyalanamadı')
    }
  }

  function whatsapp() {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  async function image() {
    try {
      const ok = await saveImage(data, showRatings)
      if (ok) onFlash('Görsel hazır')
    } catch {
      onFlash('Görsel oluşturulamadı')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Takımları paylaş" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Takımları Paylaş</h3>
          <button className="panel-toggle" aria-label="Kapat" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          {empty ? (
            <p className="modal-hint">Paylaşılacak takım yok. Önce takımları kur.</p>
          ) : (
            <pre className="share-preview">{text}</pre>
          )}

          <label className="check-row">
            <input type="checkbox" checked={showRatings} onChange={e => setShowRatings(e.target.checked)} />
            Puanları göster
          </label>

          <div className="share-actions">
            <button className="btn-primary btn-wa" onClick={whatsapp} disabled={empty}>WhatsApp</button>
            <button className="btn-secondary" onClick={copy} disabled={empty}>Kopyala</button>
            <button className="btn-secondary" onClick={image} disabled={empty}>Görsel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamBox({
  teamName, color, gk, players, posOf, ratingOf, keeperRate,
  fieldSlots, teamSize,
  unassignedField, keeperGroups, otherName,
  onAddGk, onAddField, onMove, onRemove, onRemoveGk
}) {
  const [picker, setPicker] = useState(null) // null | 'gk' | 'field'

  const all = gk ? [gk, ...players] : players
  const sum = all.reduce((s, p) => s + ratingOf(p), 0)
  const fieldFull = players.length >= fieldSlots

  // Pozisyon ve puan: oyuncunun SAHADAKİ yerine göre yazılır
  const row = (p, isGk) => {
    const r = ratingOf(p)
    const delta = r - p.rating
    const tier = getTier(r)
    return (
      <div key={p.id} className={`team-player ${tier.class} ${isGk ? 'gk-row' : ''}`}>
        <span className="team-player-rating">{r}</span>
        <span className="team-player-name">{fullName(p)}</span>
        {delta !== 0 && (
          <span
            className={`delta-badge ${delta < 0 ? 'down' : 'up'}`}
            title="Kendi pozisyonunun dışında oynuyor"
          >{signed(delta)}</span>
        )}
        <span className="team-player-pos">{posOf(p)}</span>
        <button className="team-act" aria-label={`${otherName} takıma geçir`} title={`${otherName} takıma geçir`} onClick={() => onMove(p.id)}>⇄</button>
        <button
          className="team-act remove"
          aria-label={isGk ? 'Kaleciyi çıkar' : 'Takımdan çıkar'}
          title={isGk ? 'Kaleciyi çıkar' : 'Takımdan çıkar'}
          onClick={() => (isGk ? onRemoveGk() : onRemove(p.id))}
        >✕</button>
      </div>
    )
  }

  return (
    <div className={`team-box ${color === 'black' ? 'team-black' : 'team-red'}`}>
      <div className="team-header">
        <span className="team-color-dot"></span>
        <h3 className="team-title">{teamName} Takım</h3>
        <span className="team-count">{all.length}/{teamSize} kişi</span>
      </div>
      <div className="team-body">
        {/* Kaleci yeri */}
        <div className="slot-title gk-title">Kaleci <span>{gk ? 1 : 0}/1</span></div>
        {gk ? (
          <div className="team-players">{row(gk, true)}</div>
        ) : (
          <button className="slot-empty gk" onClick={() => setPicker('gk')}>
            <span className="slot-no">K</span>+ Kaleci Seç
          </button>
        )}

        {/* Oyuncu yerleri */}
        <div className="slot-title">Oyuncular <span>{players.length}/{fieldSlots}</span></div>
        <div className="team-players">
          {players.map(p => row(p, false))}
          {Array.from({ length: Math.max(0, fieldSlots - players.length) }, (_, i) => (
            <button key={`empty-${i}`} className="slot-empty" onClick={() => setPicker('field')}>
              <span className="slot-no">{players.length + i + 1}</span>+ Oyuncu Ekle
            </button>
          ))}
        </div>

        {all.length > 0 && (
          <div className="team-summary">
            <span className="team-sum-label">Toplam Puan</span>
            <span className="team-sum-value">{sum}</span>
          </div>
        )}
      </div>

      {picker === 'gk' && (
        <Picker
          title={`${teamName} takım kalecisi`}
          groups={keeperGroups}
          rateOf={keeperRate}
          emptyText="Listede seçilecek oyuncu yok."
          onPick={id => { onAddGk(id); setPicker(null) }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'field' && (
        <Picker
          title={`${teamName} takım oyuncusu`}
          groups={[{ label: 'Sahadaki oyuncular', players: unassignedField }]}
          rateOf={ratingOf}
          full={fieldFull}
          fullText="Takım dolu."
          emptyText="Sahada seçilecek oyuncu yok. Önce Oyuncular sekmesinden sahaya ekle."
          onPick={id => {
            onAddField(id)
            if (players.length + 1 >= fieldSlots) setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// Oyuncu kayıt penceresi
function Kayit({ onClose, onAdd, baseKeys, allCodes, extrasCount, onClearExtras }) {
  const [tab, setTab] = useState('player')
  useEscape(onClose)

  // Oyuncu sekmesi
  const [kind, setKind] = useState('field') // field | gk
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [vals, setVals] = useState({})
  const [copied, setCopied] = useState(false)
  const [copiedAll, setCopiedAll] = useState(false)

  const fields = kind === 'gk' ? GK_STATS : FIELD_STATS
  const extraFields = kind === 'gk' ? FIELD_STATS : [] // kaleci sahada da oynuyorsa
  const statText = [...fields, ...extraFields]
    .filter(f => vals[f.key])
    .map(f => `${f.code}:${vals[f.key]}`)
    .join(' ')
  const code = first.trim() && last.trim() && statText
    ? `${first.trim()} ${last.trim()} ${statText}`
    : ''

  // Kodun önizlemesi: hangi pozisyonda kaç puan
  const parsed = code ? parseLine(code) : null
  const preview = parsed && !parsed.error ? parsed : null

  const statInput = f => (
    <label key={f.key} className="stat-field">
      <span>{f.label}</span>
      <input
        type="number"
        min="1"
        max="99"
        inputMode="numeric"
        className="search-input"
        value={vals[f.key] || ''}
        onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
      />
    </label>
  )

  async function copyText(text, setFlag) {
    try { await navigator.clipboard.writeText(text) } catch {}
    setFlag(true)
    setTimeout(() => setFlag(false), 1500)
  }

  // Yönetici sekmesi
  const [text, setText] = useState('')

  const results = text
    .split('\n')
    .map((l, i) => ({ line: i + 1, res: parseLine(l) }))
    .filter(r => r.res)
  const okLines = results.filter(r => !r.res.error).map(r => r.res)
  const dupBase = okLines.filter(p => baseKeys.has(nameKey(p)))
  const valid = okLines.filter(p => !baseKeys.has(nameKey(p)))
  const errors = results.filter(r => r.res.error)

  function submit() {
    if (valid.length === 0) return
    onAdd(valid)
    setText('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Oyuncu kaydı" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Oyuncu Kaydı</h3>
          <button className="panel-toggle" aria-label="Kapat" onClick={onClose}>✕</button>
        </div>

        <div className="modal-tabs">
          <button className={`filter-btn ${tab === 'player' ? 'active' : ''}`} onClick={() => setTab('player')}>
            Kendimi Kaydet
          </button>
          <button className={`filter-btn ${tab === 'admin' ? 'active' : ''}`} onClick={() => setTab('admin')}>
            Kodları Ekle (Yönetici)
          </button>
        </div>

        {tab === 'player' ? (
          <div className="modal-body">
            <div className="kind-switch">
              <button
                className={`filter-btn ${kind === 'field' ? 'active' : ''}`}
                onClick={() => setKind('field')}
              >Oyuncu</button>
              <button
                className={`filter-btn ${kind === 'gk' ? 'active gk' : ''}`}
                onClick={() => setKind('gk')}
              >Kaleci</button>
            </div>

            <p className="modal-hint">
              {kind === 'gk'
                ? 'Kaleci olarak kendini 1-99 arası puanla. Sahada da oynuyorsan alttaki alanları doldur.'
                : 'En az bir stat gir. Boş bıraktığın pozisyonun puanı, en iyi pozisyonundan otomatik hesaplanır.'}
            </p>
            <div className="form-row">
              <input className="search-input" placeholder="İsim" value={first} onChange={e => setFirst(e.target.value)} />
              <input className="search-input" placeholder="Soyisim" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            <div className="form-grid">{fields.map(statInput)}</div>

            {extraFields.length > 0 && (
              <>
                <div className="extra-title">Sahada oynarsa (isteğe bağlı)</div>
                <div className="form-grid">{extraFields.map(statInput)}</div>
              </>
            )}

            {preview && (
              <div className="rating-preview">
                {preview.position === 'GK' && (
                  <span className="pos-chip pos-GK best">Kaleci {preview.rating}</span>
                )}
                {FORMATION_ROWS.map(pos => (
                  <span
                    key={pos}
                    className={`pos-chip pos-${pos} ${pos === preview.position ? 'best' : ''}`}
                  >
                    {POSITION_LABELS[pos]} {ratingAt(preview, pos)}
                  </span>
                ))}
              </div>
            )}

            <div className="code-box">{code || 'Kod burada görünecek...'}</div>
            <button className="btn-primary" onClick={() => copyText(code, setCopied)} disabled={!code}>
              {copied ? 'Kopyalandı ✓' : 'Kodu Kopyala'}
            </button>
          </div>
        ) : (
          <div className="modal-body">
            <p className="modal-hint">
              Gelen kodları her satıra bir tane gelecek şekilde yapıştır. Eklenenler sadece bu cihazda kalır.
              Herkesin görmesi için satırları dosyadaki PLAYER_CODES listesine de yapıştır.
            </p>
            <textarea
              className="code-input"
              placeholder={'Ahmet Haşim Defans:60 Atak:70 Çalım:80\nMert Kaya Kavrama:85 Refleks:80 Hava:70 Ayak:60 Defans:62'}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {results.length > 0 && (
              <div className="parse-result">
                <span className="ok">{valid.length} geçerli</span>
                {dupBase.length > 0 && (
                  <span className="warn"> · {dupBase.length} dosyada zaten var, atlanır</span>
                )}
                {errors.length > 0 && <span className="bad"> · {errors.length} hatalı</span>}
                {errors.map(e => (
                  <div key={e.line} className="bad small">Satır {e.line}: {e.res.error}</div>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={submit} disabled={valid.length === 0}>
              {valid.length} Oyuncuyu Ekle
            </button>

            <div className="sample-box">
              <span>Tüm listeyi kod olarak kopyala (PLAYER_CODES'a yapıştırmak için)</span>
              <button className="btn-secondary small" onClick={() => copyText(allCodes, setCopiedAll)}>
                {copiedAll ? 'Kopyalandı ✓' : 'Listeyi Kopyala'}
              </button>
            </div>

            {extrasCount > 0 && (
              <div className="sample-box">
                <span>Bu cihazda {extrasCount} eklenen oyuncu var.</span>
                <button className="btn-secondary small danger" onClick={onClearExtras}>Eklemeleri Sil</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Oyuncular bölümü: kaleciler, arama, filtre, sıralama, liste
function PlayerPanel({
  open, setOpen, total, absentSet, teams, byId, gkCount, errors, maxField,
  search, setSearch, filterPos, setFilterPos, sortBy, setSortBy,
  list, pitchIds, fieldOnPitch,
  onTogglePlayer, onInfo, onPickKeeper, onRemoveKeeper, onOpenRegister, onClearAbsent,
  onExport, onImport, onReset
}) {
  return (
    <aside className={`player-panel ${open ? 'open' : 'closed'}`} aria-label="Oyuncu listesi">
      <div className="panel-header">
        <h2 className="panel-title">Oyuncular <span className="panel-count">{total - absentSet.size}</span></h2>
        <button
          className="panel-toggle"
          aria-label={open ? 'Paneli daralt' : 'Paneli genişlet'}
          onClick={() => setOpen(!open)}
        >
          {open ? '◀' : '▶'}
        </button>
      </div>

      <div className="panel-body">
        <ListWarnings errors={errors} />

        {/* Kaleciler: ayrı bölüm, takıma doğrudan eklenir */}
        <div className="keeper-box">
          <div className="slot-title gk-title">Kaleciler <span>{gkCount}/{MAX_GK}</span></div>
          <div className="keeper-slots">
            {['black', 'red'].map(t => {
              const kp = byId[teams[t].gk]
              return (
                <div key={t} className="keeper-slot">
                  <span className="keeper-team">
                    <i className={`dot ${t}`}></i>{TEAM_LABELS[t]} Kaleci
                  </span>
                  {kp ? (
                    <div className="keeper-filled">
                      <div className="keeper-info">
                        <span className="keeper-name">{fullName(kp)}</span>
                        {kp.stats && <span className="keeper-stats">{statLine(kp)}</span>}
                      </div>
                      <span className="keeper-rating">{ratingAt(kp, 'GK')}</span>
                      <button
                        className="team-act remove"
                        aria-label="Kaleciyi çıkar"
                        title="Kaleciyi çıkar"
                        onClick={() => onRemoveKeeper(kp.id)}
                      >✕</button>
                    </div>
                  ) : (
                    <button className="keeper-add" onClick={() => onPickKeeper(t)}>
                      + Kaleci Seç
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel-tools">
          <input
            type="text"
            placeholder="Oyuncu ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="search-input"
          />
          <button className="btn-secondary add-btn" onClick={onOpenRegister} title="Oyuncu kaydı">
            + Kayıt
          </button>
        </div>

        <div className="panel-filters">
          <button
            className={`filter-btn ${filterPos === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterPos('ALL')}
          >Tümü</button>
          {FILTERS.map(pos => (
            <button
              key={pos}
              className={`filter-btn ${filterPos === pos ? 'active' : ''}`}
              onClick={() => setFilterPos(pos)}
            >{FILTER_LABELS[pos]}</button>
          ))}
        </div>

        <div className="list-head">
          <span>Sahada {fieldOnPitch}/{maxField}</span>
          <div className="sort-chips" role="group" aria-label="Sıralama">
            <button className={`chip ${sortBy === 'rating' ? 'active' : ''}`} onClick={() => setSortBy('rating')}>Puan</button>
            <button className={`chip ${sortBy === 'name' ? 'active' : ''}`} onClick={() => setSortBy('name')}>İsim</button>
          </div>
        </div>

        {absentSet.size > 0 && (
          <div className="absent-note">
            <span>{absentSet.size} oyuncu gelmiyor</span>
            <button className="chip" onClick={onClearAbsent}>Hepsi geliyor</button>
          </div>
        )}

        <div className="player-list">
          {list.map(player => (
            <PlayerCard
              key={player.id}
              player={player}
              absent={absentSet.has(player.id)}
              onPitch={pitchIds.includes(player.id)}
              onClick={() => onTogglePlayer(player)}
              onInfo={onInfo}
            />
          ))}
          {list.length === 0 && <p className="empty-text">Oyuncu bulunamadı</p>}
        </div>

        <div className="panel-footer">
          <button className="mini-btn" onClick={onExport}>Yedek İndir</button>
          <label className="mini-btn">
            Yedek Yükle
            <input type="file" accept="application/json" onChange={onImport} hidden />
          </label>
          <button className="mini-btn danger" onClick={onReset}>Sıfırla</button>
        </div>
      </div>
    </aside>
  )
}

// Seçili oyuncuyu taşıma çubuğu (dokunmatik ve masaüstü)
function SelectionBar({ player, pos, onMoveRow, onShift, onRemove, onInfo, onClose }) {
  return (
    <div className="selection-bar" role="toolbar" aria-label="Seçili oyuncu">
      <div className="sel-info">
        <strong>{fullName(player)}</strong>
        <span>En iyi: {POSITION_LABELS[player.position]} {player.rating}</span>
        <button className="info-btn" aria-label="Oyuncu detayı" title="Oyuncu detayı" onClick={onInfo}>i</button>
      </div>
      <div className="sel-rows">
        {ROW_ORDER.map(r => {
          const rr = ratingAt(player, r)
          const d = rr - player.rating
          return (
            <button
              key={r}
              className={`sel-btn row ${pos === r ? 'active' : ''}`}
              onClick={() => onMoveRow(r)}
            >
              <span>{POSITION_LABELS[r]}</span>
              <b>{rr}</b>
              <small className={d < 0 ? 'down' : d > 0 ? 'up' : ''}>{d === 0 ? 'en iyi' : signed(d)}</small>
            </button>
          )
        })}
      </div>
      <div className="sel-actions">
        <button className="sel-btn" aria-label="Sola kaydır" onClick={() => onShift(-1)}>◀</button>
        <button className="sel-btn" aria-label="Sağa kaydır" onClick={() => onShift(1)}>▶</button>
        <button className="sel-btn danger grow" onClick={onRemove}>Sahadan Çıkar</button>
        <button className="sel-btn grow" onClick={onClose}>Bitti</button>
      </div>
    </div>
  )
}

// Seçili takımın dizilimi (2-3-1 gibi)
function FormationBar({ presets, current, onPick, onBest }) {
  return (
    <div className="formation-bar" role="group" aria-label="Dizilim">
      <span className="formation-label">Dizilim</span>
      <div className="formation-chips">
        <button className="chip best" onClick={onBest} title="Toplam puanı en yüksek yapan dizilim">
          En iyi
        </button>
        {presets.map(c => {
          const key = c.join('-')
          return (
            <button
              key={key}
              className={`chip ${current === key ? 'active' : ''}`}
              onClick={() => onPick(c)}
            >{key}</button>
          )
        })}
      </div>
    </div>
  )
}

// İki takımın toplam puanını karşılaştıran çubuk
function BalanceCard({ blackSum, redSum, blackCount, redCount }) {
  const total = blackSum + redSum
  const blackPct = total ? (blackSum / total) * 100 : 50
  const diff = Math.abs(blackSum - redSum)
  const per = diff / Math.max(1, blackCount, redCount)

  let state = { cls: 'great', label: 'Çok dengeli' }
  if (per > 3) state = { cls: 'bad', label: 'Dengesiz' }
  else if (per > 1.5) state = { cls: 'meh', label: 'Biraz farklı' }
  else if (per > 0.5) state = { cls: 'ok', label: 'Dengeli' }

  return (
    <div className="balance-card">
      <div className="balance-top">
        <span>Siyah <b>{blackSum}</b></span>
        <span className={`balance-state ${state.cls}`}>{state.label} · fark {diff}</span>
        <span><b>{redSum}</b> Kırmızı</span>
      </div>
      <div className="balance-bar" aria-hidden="true">
        <i className="b" style={{ width: `${blackPct}%` }}></i>
        <i className="r" style={{ width: `${100 - blackPct}%` }}></i>
      </div>
    </div>
  )
}

function SavedTeams({ saved, name, setName, canSave, onSave, onLoad, onDelete }) {
  return (
    <div className="saved-section">
      <h3 className="saved-title">Kayıtlı Takımlar</h3>
      <div className="saved-form">
        <input
          type="text"
          className="search-input"
          placeholder="Takım adı (opsiyonel)"
          value={name}
          onChange={e => setName(e.target.value)}
        />
        <button className="btn-primary" onClick={onSave} disabled={!canSave}>
          Takımı Kaydet
        </button>
      </div>

      {saved.length === 0 ? (
        <p className="empty-text">Henüz kayıtlı takım yok</p>
      ) : (
        <div className="saved-list">
          {saved.map(t => (
            <div key={t.id} className="saved-item">
              <div className="saved-info">
                <span className="saved-name">{t.name}</span>
                <span className="saved-meta">
                  {t.pitchIds.length} oyuncu{t.size ? ` · ${t.size}v${t.size}` : ''}
                </span>
              </div>
              <button className="btn-secondary small" onClick={() => onLoad(t)}>Yükle</button>
              <button className="btn-secondary small danger" onClick={() => onDelete(t.id)}>Sil</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ==========================================================================
   6) ANA UYGULAMA
   ========================================================================== */
export default function App() {
  // Bu cihazda "Kayıt" penceresinden eklenen oyuncular (dosyadaki listeye ek)
  const [extras, setExtras] = usePersistentState('fifa.extra.v3', [])
  const [absent, setAbsent] = usePersistentState('fifa.absent.v3', [])
  const [pitchIds, setPitchIds] = usePersistentState('fifa.pitch.v3', [])
  const [teams, setTeams] = usePersistentState('fifa.teams.v3', emptyTeams)
  const [savedTeams, setSavedTeams] = usePersistentState('fifa.saved.v3', [])
  // Elle değiştirilen sıralar: { oyuncuId: 'MID' }
  const [rowOverride, setRowOverride] = usePersistentState('fifa.rows.v3', {})
  const [rawSize, setRawSize] = usePersistentState('fifa.size.v3', DEFAULT_TEAM_SIZE)

  const teamSize = TEAM_SIZES.includes(rawSize) ? rawSize : DEFAULT_TEAM_SIZE
  const fieldSlots = teamSize - 1
  const maxField = fieldSlots * 2

  const [tab, setTab] = useState(() => (pitchIds.length > 0 ? 'pitch' : 'players')) // mobil sekme
  const [panelOpen, setPanelOpen] = useState(true) // masaüstünde panel daraltma
  const [search, setSearch] = useState('')
  const [filterPos, setFilterPos] = useState('ALL')
  const [sortBy, setSortBy] = useState('rating') // rating | name
  const [teamName, setTeamName] = useState('')
  const [showReg, setShowReg] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [guideHidden, setGuideHidden] = useState(false)
  const [view, setView] = useState('all') // all | black | red
  const [drag, setDrag] = useState(null)  // { id, x, y, row, beforeId, markerX }
  const [selectedId, setSelectedId] = useState(null)
  const [keeperPicker, setKeeperPicker] = useState(null) // null | 'black' | 'red'
  const [rowPicker, setRowPicker] = useState(null)       // null | 'FW' | 'MID' | 'DEF'
  const [notice, setNotice] = useState('')

  const suppressClick = useRef(false)
  const noticeTimer = useRef(null)

  function flash(msg) {
    setNotice(msg)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 2200)
  }

  /* ---------- Geri al (saha, takımlar, sıralar ve format değişiklikleri) ---------- */
  const lastSnap = useRef(null)
  const history = useRef([])
  const undoing = useRef(false)
  const [historyLen, setHistoryLen] = useState(0)

  useEffect(() => {
    const cur = { pitchIds, teams, rowOverride, size: rawSize }
    const key = JSON.stringify(cur)
    if (!lastSnap.current) {
      lastSnap.current = { key, cur }
      return
    }
    if (key === lastSnap.current.key) return
    if (undoing.current) {
      undoing.current = false
    } else {
      history.current.push(lastSnap.current.cur)
      if (history.current.length > 40) history.current.shift()
      setHistoryLen(history.current.length)
    }
    lastSnap.current = { key, cur }
  }, [pitchIds, teams, rowOverride, rawSize])

  function undo() {
    const prev = history.current.pop()
    if (!prev) return
    undoing.current = true
    setPitchIds(prev.pitchIds)
    setTeams(prev.teams)
    setRowOverride(prev.rowOverride)
    setRawSize(prev.size)
    setHistoryLen(history.current.length)
    setSelectedId(null)
    flash('Geri alındı')
  }

  // Klavye kısayolları: Esc seçimi kaldırır, Ctrl+Z geri alır
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') setSelectedId(null)
      const typing = /input|textarea|select/i.test((e.target && e.target.tagName) || '')
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* ---------- Oyuncular ---------- */
  // Tüm oyuncular = dosyadaki liste + bu cihazda eklenenler
  const players = useMemo(() => {
    const clean = extras.filter(
      e => e && typeof e.id === 'string' && !BASE_KEYS.has(nameKey(e)) && !BASE_IDS.has(e.id)
    )
    return [...BASE.players, ...clean]
  }, [extras])

  const byId = useMemo(() => {
    const map = {}
    players.forEach(p => { map[p.id] = p })
    return map
  }, [players])

  const absentSet = useMemo(() => new Set(absent), [absent])

  const toPlayers = ids => ids.map(id => byId[id]).filter(Boolean)
  const pitchPlayers = toPlayers(pitchIds)

  const blackGk = byId[teams.black.gk] || null
  const redGk = byId[teams.red.gk] || null
  const blackField = toPlayers(teams.black.field)
  const redField = toPlayers(teams.red.field)

  const blackAll = blackGk ? [blackGk, ...blackField] : blackField
  const redAll = redGk ? [redGk, ...redField] : redField

  const assigned = new Set(
    [teams.black.gk, teams.red.gk, ...teams.black.field, ...teams.red.field].filter(Boolean)
  )
  const gkIds = new Set([teams.black.gk, teams.red.gk].filter(Boolean))

  const fieldOnPitch = pitchPlayers.filter(p => !gkIds.has(p.id)).length

  /* ---------- Sahadaki yer ve puan ---------- */
  function teamOf(id) {
    if (teams.black.gk === id || teams.black.field.includes(id)) return 'black'
    if (teams.red.gk === id || teams.red.field.includes(id)) return 'red'
    return null
  }

  // Üstteki kale satırı sadece "Tümü" görünümünde var
  function normRow(r) {
    return r === 'GKT' && view !== 'all' ? 'GK' : r
  }

  // Sahada hangi sırada gösterilecek (elle seçilen > takım kalecisi > kendi sırası)
  function rowOf(p) {
    if (rowOverride[p.id]) return normRow(rowOverride[p.id])
    if (gkIds.has(p.id)) {
      return teams.red.gk === p.id && view === 'all' ? 'GKT' : 'GK'
    }
    return naturalRow(p)
  }

  // Oyuncunun sahadaki yerine göre pozisyonu ve puanı
  const posOf = p => posCode(rowOf(p))
  const effRating = p => ratingAt(p, posOf(p))
  const keeperRate = p => ratingAt(p, 'GK')

  const blackSum = blackAll.reduce((s, p) => s + effRating(p), 0)
  const redSum = redAll.reduce((s, p) => s + effRating(p), 0)

  // Kendi pozisyonu dışında oynayanlar ve toplam puan etkisi
  const offPos = pitchPlayers.filter(p => posOf(p) !== p.position)
  const offNet = offPos.reduce((s, p) => s + effRating(p) - p.rating, 0)

  // Sahada olup henüz takımı olmayanlar
  const unassignedField = pitchPlayers
    .filter(p => !assigned.has(p.id))
    .sort((a, b) => effRating(b) - effRating(a))

  // Kaleci seçme listesi: kaleci olarak iyi olanlar önde, istersen herkes seçilebilir
  const keeperCandidates = players.filter(p => !gkIds.has(p.id) && !absentSet.has(p.id))
  const keeperGroups = [
    {
      label: 'Kaleci olarak iyi olanlar',
      players: keeperCandidates.filter(p => p.position === 'GK').sort(byRatingDesc)
    },
    {
      label: 'Diğer oyuncular',
      players: keeperCandidates
        .filter(p => p.position !== 'GK')
        .sort((a, b) => keeperRate(b) - keeperRate(a))
    }
  ]

  // Sahadaki bir sıraya oyuncu ekleme listesi (kaleciler de sahada oynayabilir)
  const rowCandidates = players.filter(p => !pitchIds.includes(p.id) && !absentSet.has(p.id))
  const rowGroups = rowPicker
    ? [
        {
          label: `${POSITION_LABELS[rowPicker]} olarak iyi olanlar`,
          players: rowCandidates.filter(p => p.position === rowPicker)
        },
        {
          label: 'Diğer oyuncular',
          players: rowCandidates.filter(p => p.position !== rowPicker && p.position !== 'GK')
        },
        {
          label: 'Kaleciler (sahada oynarsa)',
          players: rowCandidates.filter(p => p.position === 'GK')
        }
      ].map(g => ({
        ...g,
        players: [...g.players].sort((a, b) => ratingAt(b, rowPicker) - ratingAt(a, rowPicker))
      }))
    : []

  const rowsToShow = view === 'all' ? ROW_ORDER_ALL : ROW_ORDER

  function rowLabel(row) {
    if (row === 'GKT') return 'Kırmızı Kaleci'
    if (row === 'GK') return view === 'all' ? 'Siyah Kaleci' : 'Kaleci'
    return POSITION_LABELS[row]
  }

  const viewPlayers =
    view === 'all' ? pitchPlayers : pitchPlayers.filter(p => teamOf(p.id) === view)

  // Seçili takımın kaleci dışındaki oyuncuları (dizilim için)
  const viewField = view === 'all' ? [] : toPlayers(teams[view].field)
  const presets = formationPresets(fieldSlots)
  const currentFormation = FORMATION_ROWS
    .map(r => viewField.filter(p => posOf(p) === r).length)
    .join('-')

  // Oyuncu listesi (kaleciler "Kaleci" filtresinde ve "Tümü"nde görünür)
  const listPlayers = useMemo(() => {
    const q = norm(search.trim())
    return players
      .filter(p => {
        const matchesSearch = norm(fullName(p)).includes(q)
        const matchesPos = filterPos === 'ALL' || p.position === filterPos
        return matchesSearch && matchesPos
      })
      .sort(
        (a, b) =>
          Number(absentSet.has(a.id)) - Number(absentSet.has(b.id)) ||
          (sortBy === 'name'
            ? fullName(a).localeCompare(fullName(b), 'tr')
            : b.rating - a.rating)
      )
  }, [players, search, filterPos, sortBy, absentSet])

  const selectedPlayer =
    selectedId != null && pitchIds.includes(selectedId) ? byId[selectedId] || null : null
  const detailPlayer = detailId ? byId[detailId] || null : null

  /* ---------- Saha işlemleri ---------- */
  function clearRow(id) {
    setRowOverride(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  // Oyuncuyu sahaya ekler. row verilirse o sıraya, verilmezse kendi sırasına koyar.
  function addToPitch(id, row, announce) {
    const p = byId[id]
    if (!p || pitchIds.includes(id)) return
    if (absentSet.has(id)) return flash(`${fullName(p)} gelmiyor olarak işaretli`)
    if (fieldOnPitch >= maxField) return flash(`Sahada en fazla ${maxField} oyuncu olabilir`)

    const target = row || naturalRow(p)
    setPitchIds(prev => [...prev, id])
    if (target !== naturalRow(p)) setRowOverride(prev => ({ ...prev, [id]: target }))
    buzz()
    if (announce) {
      flash(`${fullName(p)} sahaya eklendi · ${POSITION_LABELS[target]} ${ratingAt(p, target)}`)
    }
  }

  function removeFromPitch(id) {
    setPitchIds(prev => prev.filter(x => x !== id))
    unassign(id)
    clearRow(id)
    if (selectedId === id) setSelectedId(null)
  }

  function togglePlayer(player) {
    if (pitchIds.includes(player.id)) {
      removeFromPitch(player.id)
      flash(`${fullName(player)} sahadan çıkarıldı`)
    } else {
      addToPitch(player.id, null, true)
    }
  }

  // Oyuncuyu belirli bir sıraya koyar (sahadaysa taşır, değilse ekler)
  function placePlayer(player, pos) {
    if (absentSet.has(player.id)) return flash(`${fullName(player)} gelmiyor olarak işaretli`)
    if (pitchIds.includes(player.id)) {
      moveToRow(player.id, pos)
      flash(`${fullName(player)} → ${POSITION_LABELS[pos]} ${ratingAt(player, pos)}`)
    } else {
      addToPitch(player.id, pos, true)
    }
    setDetailId(null)
  }

  // Maça gelmeyenleri işaretler: sahadan çıkar, listelerde soluk görünür
  function toggleAbsent(player) {
    if (absentSet.has(player.id)) {
      setAbsent(prev => prev.filter(x => x !== player.id))
      flash(`${fullName(player)} geliyor olarak işaretlendi`)
    } else {
      removeFromPitch(player.id)
      setAbsent(prev => [...prev, player.id])
      flash(`${fullName(player)} gelmiyor olarak işaretlendi`)
    }
    setDetailId(null)
  }

  function clearPitch() {
    setPitchIds([])
    setTeams(emptyTeams())
    setRowOverride({})
    setSelectedId(null)
  }

  // Elle yapılan pozisyon değişikliklerini siler, herkes kendi sırasına döner
  function resetPositions() {
    setRowOverride({})
    flash('Pozisyonlar sıfırlandı')
  }

  function goPlayers() {
    setTab('players')
    setPanelOpen(true)
  }

  /* ---------- Sürükle-bırak (sadece fare/kalem; dokunmatikte seçim çubuğu) ---------- */
  function startDrag(e, player) {
    if (e.pointerType === 'touch') return
    if (e.pointerType === 'mouse' && e.button !== 0) return

    const startX = e.clientX
    const startY = e.clientY
    const rect = e.currentTarget.getBoundingClientRect()
    const offX = startX - rect.left
    const offY = startY - rect.top
    let started = false

    const move = ev => {
      if (!started) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) return
        started = true
      }
      const target = findDrop(ev.clientX, ev.clientY, player.id)
      setDrag({ id: player.id, x: ev.clientX - offX, y: ev.clientY - offY, ...target })
    }

    const up = ev => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      if (started) {
        if (ev.type === 'pointerup') {
          commitDrop(player.id, findDrop(ev.clientX, ev.clientY, player.id))
        }
        // Bırakma sonrası gelen "click" olayı seçim yapmasın
        suppressClick.current = true
        setTimeout(() => { suppressClick.current = false }, 80)
      }
      setDrag(null)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  function commitDrop(id, { row, beforeId }) {
    if (!row) return
    setRowOverride(prev => ({ ...prev, [id]: row }))
    setPitchIds(prev => {
      const rest = prev.filter(x => x !== id)
      const idx = beforeId == null ? -1 : rest.indexOf(beforeId)
      rest.splice(idx < 0 ? rest.length : idx, 0, id)
      return rest
    })
  }

  /* ---------- Seçili oyuncuyu taşıma (dokunmatik için) ---------- */
  function moveToRow(id, row) {
    commitDrop(id, { row, beforeId: null })
    buzz()
  }

  function shiftInRow(id, dir) {
    const p = byId[id]
    if (!p) return
    const row = rowOf(p)
    const ids = viewPlayers.filter(x => rowOf(x) === row).map(x => x.id)
    const i = ids.indexOf(id)
    const other = ids[i + dir]
    if (i < 0 || other === undefined) return
    setPitchIds(prev => {
      const a = [...prev]
      const ia = a.indexOf(id)
      const ib = a.indexOf(other)
      if (ia < 0 || ib < 0) return prev
      ;[a[ia], a[ib]] = [a[ib], a[ia]]
      return a
    })
  }

  function handleRowClick(e, pos) {
    if (suppressClick.current || !selectedPlayer) return
    if (e.target.closest('.pitch-card, .row-add')) return
    moveToRow(selectedPlayer.id, pos)
  }

  // Sıra başlığındaki "+" butonu
  function rowAdd(pos) {
    if (pos === 'GKT') {
      return !teams.red.gk ? (
        <button className="row-add" onClick={() => setKeeperPicker('red')}>+ Kırmızı kaleci</button>
      ) : null
    }
    if (pos === 'GK') {
      const t = view === 'red' ? 'red' : 'black'
      return !teams[t].gk ? (
        <button className="row-add" onClick={() => setKeeperPicker(t)}>+ {TEAM_LABELS[t]} kaleci</button>
      ) : null
    }
    // Oyuncular takım görünümünde takım kutusundan eklenir
    return view === 'all' ? (
      <button className="row-add" onClick={() => setRowPicker(pos)}>+ Oyuncu</button>
    ) : null
  }

  /* ---------- Dizilim ---------- */
  function applyFormation(counts) {
    if (view === 'all' || viewField.length === 0) return
    const res = counts ? assignFormation(viewField, counts) : bestFormation(viewField, presets)
    if (!res) return flash('Bu dizilim için oyuncu sayısı uygun değil')
    const used = counts || res.counts
    setRowOverride(prev => {
      const next = { ...prev }
      viewField.forEach((p, i) => { next[p.id] = res.rows[i] })
      return next
    })
    buzz()
    flash(`${TEAM_LABELS[view]} takım ${used.join('-')} dizildi`)
  }

  /* ---------- Takımlar ---------- */
  function formTeams(shuffle) {
    if (pitchPlayers.length < 2) return

    // Boş kaleci yerlerini en iyi kalecilerle doldur (sahada defans oynayanlara dokunma)
    const spare = players
      .filter(
        p => p.position === 'GK' && !absentSet.has(p.id) && !gkIds.has(p.id) && !pitchIds.includes(p.id)
      )
      .sort(byRatingDesc)
    const current = { black: { ...teams.black }, red: { ...teams.red } }
    const added = []
    for (const t of ['black', 'red']) {
      if (!current[t].gk && spare.length) {
        const k = spare.shift()
        current[t].gk = k.id
        added.push(k)
      }
    }

    const next = autoFormTeams([...pitchPlayers, ...added], current, {
      rate: effRating,
      gkRate: keeperRate,
      posOf,
      fieldSlots,
      shuffle
    })

    if (added.length > 0) {
      setPitchIds(prev => [...prev, ...added.map(k => k.id)])
      added.forEach(k => clearRow(k.id))
    }
    setTeams(next)
    buzz()
    flash(
      added.length > 0
        ? `Takımlar kuruldu · ${added.length} kaleci otomatik seçildi`
        : shuffle ? 'Takımlar karıştırıldı' : 'Takımlar kuruldu'
    )
    setTab('teams')
  }

  function clearTeams() {
    setTeams(emptyTeams())
  }

  function unassign(id) {
    const ids = new Set([id])
    setTeams(prev => ({ black: removeIds(prev.black, ids), red: removeIds(prev.red, ids) }))
  }

  // Oyuncuyu bir takıma yerleştirir (asGk: kaleci yerine mi, oyuncu yerine mi)
  function placeInTeam(team, id, asGk) {
    if (asGk) clearRow(id)
    setTeams(prev => {
      const ids = new Set([id])
      const next = { black: removeIds(prev.black, ids), red: removeIds(prev.red, ids) }
      const t = next[team]
      if (asGk) {
        if (t.gk) return prev
        t.gk = id
      } else {
        if (t.field.length >= fieldSlots) return prev
        t.field = [...t.field, id]
      }
      return next
    })
  }

  function moveToOther(from, id) {
    const to = from === 'black' ? 'red' : 'black'
    const asGk = teams[from].gk === id
    if (asGk && teams[to].gk) return flash('Diğer takımın kaleci yeri dolu')
    if (!asGk && teams[to].field.length >= fieldSlots) return flash('Diğer takımın oyuncu yerleri dolu')
    placeInTeam(to, id, asGk)
  }

  // Kaleci seçer: oyuncu otomatik sahaya ve o takımın kaleci yerine geçer
  function setKeeper(team, id) {
    const p = byId[id]
    if (!p) return
    if (absentSet.has(id)) return flash(`${fullName(p)} gelmiyor olarak işaretli`)
    if (teams[team].gk) return flash(`${TEAM_LABELS[team]} takımın kalecisi zaten seçili`)
    setPitchIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    placeInTeam(team, id, true)
    buzz()
  }

  // Maç formatını değiştirir (5v5 ... 8v8). Sığmayan oyuncular sahadan çıkarılır.
  function changeTeamSize(n) {
    if (n === teamSize) return
    const slots = n - 1
    const max = slots * 2

    const keep = []
    let count = 0
    for (const id of pitchIds) {
      if (gkIds.has(id)) keep.push(id)
      else if (count < max) { keep.push(id); count++ }
    }
    const removed = new Set(pitchIds.filter(id => !keep.includes(id)))

    setRawSize(n)
    if (removed.size > 0) {
      setPitchIds(keep)
      setRowOverride(prev => {
        const next = {}
        Object.keys(prev).forEach(k => { if (!removed.has(k)) next[k] = prev[k] })
        return next
      })
    }
    setTeams(prev => {
      const trim = t => {
        const r = removeIds(t, removed)
        return { gk: r.gk, field: r.field.slice(0, slots) }
      }
      return { black: trim(prev.black), red: trim(prev.red) }
    })
    flash(
      removed.size > 0
        ? `${n}v${n} seçildi · ${removed.size} oyuncu sahadan çıkarıldı`
        : `${n}v${n} seçildi`
    )
  }

  /* ---------- Kayıt penceresinden ekleme (bu cihazda kalır) ---------- */
  function addPlayers(parsed) {
    setExtras(prev => {
      const list = [...prev]
      const used = new Set([...BASE.players.map(p => p.id), ...list.map(p => p.id)])
      for (const n of parsed) {
        const idx = list.findIndex(p => nameKey(p) === nameKey(n))
        if (idx >= 0) list[idx] = { ...list[idx], ...n } // aynı isim: güncelle
        else list.push({ id: makeId(n, used), ...n })
      }
      return list
    })
    flash(`${parsed.length} oyuncu eklendi`)
  }

  function clearExtras() {
    if (!confirm(`Bu cihazdaki ${extras.length} eklenen oyuncu silinecek. Emin misin?`)) return
    const ids = new Set(extras.map(p => p.id))
    setExtras([])
    setPitchIds(prev => prev.filter(id => !ids.has(id)))
    setTeams(prev => ({ black: removeIds(prev.black, ids), red: removeIds(prev.red, ids) }))
    setRowOverride(prev => {
      const next = {}
      Object.keys(prev).forEach(k => { if (!ids.has(k)) next[k] = prev[k] })
      return next
    })
    setSelectedId(null)
  }

  /* ---------- Takım kaydetme ---------- */
  function saveTeam() {
    if (pitchIds.length === 0) return
    const rows = {}
    pitchIds.forEach(id => { if (rowOverride[id]) rows[id] = rowOverride[id] })
    const entry = {
      id: Date.now(),
      name: teamName.trim() || `Takım ${savedTeams.length + 1}`,
      pitchIds,
      teams,
      rows,
      size: teamSize
    }
    setSavedTeams(prev => [...prev, entry])
    setTeamName('')
    flash('Takım kaydedildi')
  }

  function loadTeam(entry) {
    const ok = id => byId[id] && !absentSet.has(id)
    const fix = t => ({
      gk: t && ok(t.gk) ? t.gk : null,
      field: ((t && t.field) || []).filter(ok)
    })
    if (entry.size && TEAM_SIZES.includes(entry.size)) setRawSize(entry.size)
    setPitchIds(entry.pitchIds.filter(ok))
    setTeams({ black: fix(entry.teams.black), red: fix(entry.teams.red) })
    setRowOverride(entry.rows || {})
    setSelectedId(null)
    flash(`"${entry.name}" yüklendi`)
  }

  function deleteTeam(id) {
    setSavedTeams(prev => prev.filter(t => t.id !== id))
  }

  /* ---------- Yedekleme (JSON): bu cihazdaki eklemeler, kayıtlı takımlar, gelmeyenler ---------- */
  function exportData() {
    const data = JSON.stringify({ extras, savedTeams, absent }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'fifa-takim-yedek.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  function importData(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result)
        if (Array.isArray(data.extras)) {
          setExtras(
            data.extras.filter(
              p => p && typeof p.id === 'string' && p.firstName && p.lastName && p.stats
            )
          )
        }
        if (Array.isArray(data.savedTeams)) {
          setSavedTeams(data.savedTeams.filter(t => t && t.teams && Array.isArray(t.pitchIds)))
        }
        if (Array.isArray(data.absent)) setAbsent(data.absent.filter(x => typeof x === 'string'))
        clearPitch()
        flash('Yedek yüklendi')
      } catch {
        flash('Dosya okunamadı')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function resetAll() {
    if (!confirm('Bu cihazdaki eklenen oyuncular, kayıtlı takımlar, gelmeyenler ve saha sıfırlanacak. Emin misin?')) return
    setExtras([])
    setSavedTeams([])
    setAbsent([])
    clearPitch()
  }

  /* ---------- Paylaşım verisi ---------- */
  function buildShareData() {
    const make = (name, gk, field) => {
      const rows = [
        ...(gk ? [{ p: gk, isGk: true }] : []),
        ...field.map(p => ({ p, isGk: false }))
      ].map(({ p, isGk }) => {
        const rating = effRating(p)
        return {
          name: fullName(p),
          pos: posOf(p),
          rating,
          gk: isGk,
          tier: getTier(rating).class
        }
      })
      return { name, rows, sum: rows.reduce((s, r) => s + r.rating, 0) }
    }
    return {
      size: teamSize,
      black: make('SİYAH', blackGk, blackField),
      red: make('KIRMIZI', redGk, redField)
    }
  }

  /* ---------- Rehber: sıradaki adım ---------- */
  const teamsFormed = blackField.length + redField.length > 0
  const nextStep =
    fieldOnPitch < 2
      ? { n: 1, text: 'Sahaya en az 2 oyuncu ekle', action: 'Oyuncu Ekle', run: goPlayers }
      : gkIds.size < MAX_GK
        ? {
            n: 2,
            text: `${MAX_GK - gkIds.size} kaleci seç (ya da takım kurunca otomatik seçilir)`,
            action: 'Kaleci Seç',
            run: () => setKeeperPicker(teams.black.gk ? 'red' : 'black')
          }
        : !teamsFormed
          ? { n: 3, text: 'Takımları kur', action: 'Takım Kur', run: () => formTeams(false) }
          : {
              n: 4,
              text: 'Takımlar hazır, arkadaşlarınla paylaş',
              action: 'Paylaş',
              run: () => setShowShare(true)
            }

  const dragPlayer = drag ? byId[drag.id] : null
  const allCodes = players.map(toCode).join('\n')

  return (
    <div className={`app ${drag ? 'is-dragging' : ''}`} data-tab={tab}>
      <TopBar
        fieldOnPitch={fieldOnPitch}
        maxField={maxField}
        gkCount={gkIds.size}
        canUndo={historyLen > 0}
        onUndo={undo}
      />

      {!guideHidden && <GuideBar step={nextStep} onHide={() => setGuideHidden(true)} />}

      {/* OYUNCULAR bölümü */}
      <PlayerPanel
        open={panelOpen}
        setOpen={setPanelOpen}
        total={players.length}
        absentSet={absentSet}
        teams={teams}
        byId={byId}
        gkCount={gkIds.size}
        errors={BASE.errors}
        maxField={maxField}
        search={search}
        setSearch={setSearch}
        filterPos={filterPos}
        setFilterPos={setFilterPos}
        sortBy={sortBy}
        setSortBy={setSortBy}
        list={listPlayers}
        pitchIds={pitchIds}
        fieldOnPitch={fieldOnPitch}
        onTogglePlayer={togglePlayer}
        onInfo={p => setDetailId(p.id)}
        onPickKeeper={setKeeperPicker}
        onRemoveKeeper={removeFromPitch}
        onOpenRegister={() => setShowReg(true)}
        onClearAbsent={() => setAbsent([])}
        onExport={exportData}
        onImport={importData}
        onReset={resetAll}
      />

      <main className="main-content">
        {/* SAHA bölümü */}
        <section className="pitch-section" aria-label="Saha">
          <div className="section-toolbar">
            <div className="view-tabs" role="group" aria-label="Saha görünümü">
              <button className={`filter-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>Tümü</button>
              <button className={`filter-btn ${view === 'black' ? 'active' : ''}`} onClick={() => setView('black')}>Siyah</button>
              <button className={`filter-btn ${view === 'red' ? 'active' : ''}`} onClick={() => setView('red')}>Kırmızı</button>
            </div>
            <button className="btn-secondary small" onClick={clearPitch} disabled={pitchIds.length === 0}>
              Sahayı Temizle
            </button>
          </div>

          {view !== 'all' && viewField.length >= 2 && (
            <FormationBar
              presets={presets}
              current={currentFormation}
              onPick={applyFormation}
              onBest={() => applyFormation(null)}
            />
          )}

          {offPos.length > 0 && (
            <div className="offpos-bar">
              <span>
                {offPos.length} oyuncu kendi pozisyonu dışında ·{' '}
                <b className={offNet < 0 ? 'down' : 'up'}>{signed(offNet)} puan</b>
              </span>
              <button className="btn-secondary small" onClick={resetPositions}>Sıfırla</button>
            </div>
          )}

          {viewPlayers.length === 0 && (
            <div className="pitch-hint">
              {view === 'all' ? (
                <>
                  <span>Sahada henüz oyuncu yok.</span>
                  <button className="btn-primary small" onClick={goPlayers}>Oyuncu Ekle</button>
                </>
              ) : (
                <span>{TEAM_LABELS[view]} takımda henüz oyuncu yok. Takımlar bölümünden ekleyebilirsin.</span>
              )}
            </div>
          )}

          <div className="pitch-container">
            <div className={`pitch ${selectedPlayer ? 'selecting' : ''}`}>
              <div className="pitch-line outer"></div>
              <div className="pitch-line center-circle"></div>
              <div className="pitch-line center-line"></div>
              <div className="pitch-line penalty-top"></div>
              <div className="pitch-line penalty-bottom"></div>
              <div className="pitch-line goal-top"></div>
              <div className="pitch-line goal-bottom"></div>

              {/* Üstte kale/forvet, altta kaleci */}
              <div className="pitch-rows">
                {rowsToShow.map(pos => {
                  const rowPlayers = viewPlayers.filter(p => rowOf(p) === pos)
                  const isTarget = drag && drag.row === pos
                  return (
                    <div
                      key={pos}
                      data-row={pos}
                      className={`pitch-row ${pos.startsWith('GK') ? 'goal-row' : ''} ${isTarget ? 'drop-target' : ''}`}
                      onClick={e => handleRowClick(e, pos)}
                    >
                      <div className="row-head">
                        <span className="row-label">{rowLabel(pos)}</span>
                        {rowAdd(pos)}
                      </div>
                      <div className="row-cards">
                        {rowPlayers.map(player => (
                          <PlayerCard
                            key={player.id}
                            player={player}
                            rating={ratingAt(player, posCode(pos))}
                            label={posCode(pos)}
                            team={teamOf(player.id)}
                            dragging={!!drag && drag.id === player.id}
                            selected={selectedId === player.id}
                            onPointerDown={e => startDrag(e, player)}
                            onClick={() => {
                              if (suppressClick.current) return
                              buzz(8)
                              setSelectedId(prev => (prev === player.id ? null : player.id))
                            }}
                            onRemove={() => removeFromPitch(player.id)}
                            compact={true}
                          />
                        ))}
                        {isTarget && (
                          <div className="drop-marker" style={{ left: drag.markerX - 2 }}></div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {selectedPlayer && (
              <SelectionBar
                player={selectedPlayer}
                pos={posOf(selectedPlayer)}
                onMoveRow={r => moveToRow(selectedPlayer.id, r)}
                onShift={d => shiftInRow(selectedPlayer.id, d)}
                onRemove={() => removeFromPitch(selectedPlayer.id)}
                onInfo={() => setDetailId(selectedPlayer.id)}
                onClose={() => setSelectedId(null)}
              />
            )}

            <p className="pitch-tip">
              Karta dokun, alttaki çubukla istediğin sıraya taşı. Bilgisayarda kartı sürükleyip de bırakabilirsin.
            </p>
          </div>
        </section>

        {/* TAKIMLAR bölümü */}
        <section className="teams-wrap" aria-label="Takımlar">
          <div className="format-row">
            <span className="format-label">Maç formatı</span>
            <div className="size-switch" role="group" aria-label="Maç formatı">
              {TEAM_SIZES.map(s => (
                <button
                  key={s}
                  className={`filter-btn ${teamSize === s ? 'active' : ''}`}
                  onClick={() => changeTeamSize(s)}
                >{s}v{s}</button>
              ))}
            </div>
          </div>

          <div className="section-toolbar team-actions">
            <button className="btn-primary" onClick={() => formTeams(false)} disabled={pitchPlayers.length < 2}>
              Otomatik Takım Kur
            </button>
            <button className="btn-secondary" onClick={() => formTeams(true)} disabled={pitchPlayers.length < 2}>
              Karıştır
            </button>
            <button className="btn-secondary" onClick={clearTeams} disabled={assigned.size === 0}>
              Temizle
            </button>
            <button className="btn-secondary" onClick={() => setShowShare(true)} disabled={assigned.size === 0}>
              Paylaş
            </button>
          </div>

          {pitchPlayers.length < 2 && (
            <p className="inline-hint">
              Takım kurmak için önce Oyuncular bölümünden sahaya en az 2 oyuncu ekle.
            </p>
          )}

          <div className="teams-section">
            <TeamBox
              teamName="Siyah"
              color="black"
              gk={blackGk}
              players={blackField}
              posOf={posOf}
              ratingOf={effRating}
              keeperRate={keeperRate}
              fieldSlots={fieldSlots}
              teamSize={teamSize}
              unassignedField={unassignedField}
              keeperGroups={keeperGroups}
              otherName="Kırmızı"
              onAddGk={id => setKeeper('black', id)}
              onAddField={id => placeInTeam('black', id, false)}
              onMove={id => moveToOther('black', id)}
              onRemove={unassign}
              onRemoveGk={() => teams.black.gk && removeFromPitch(teams.black.gk)}
            />
            <TeamBox
              teamName="Kırmızı"
              color="red"
              gk={redGk}
              players={redField}
              posOf={posOf}
              ratingOf={effRating}
              keeperRate={keeperRate}
              fieldSlots={fieldSlots}
              teamSize={teamSize}
              unassignedField={unassignedField}
              keeperGroups={keeperGroups}
              otherName="Siyah"
              onAddGk={id => setKeeper('red', id)}
              onAddField={id => placeInTeam('red', id, false)}
              onMove={id => moveToOther('red', id)}
              onRemove={unassign}
              onRemoveGk={() => teams.red.gk && removeFromPitch(teams.red.gk)}
            />
          </div>

          {blackAll.length > 0 && redAll.length > 0 && (
            <BalanceCard
              blackSum={blackSum}
              redSum={redSum}
              blackCount={blackAll.length}
              redCount={redAll.length}
            />
          )}

          <SavedTeams
            saved={savedTeams}
            name={teamName}
            setName={setTeamName}
            canSave={pitchIds.length > 0}
            onSave={saveTeam}
            onLoad={loadTeam}
            onDelete={deleteTeam}
          />
        </section>
      </main>

      <TabBar
        tab={tab}
        setTab={setTab}
        playerCount={pitchPlayers.length}
        teamCount={assigned.size}
      />

      {/* Sürüklenen kartın imleci takip eden kopyası */}
      {dragPlayer && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <PlayerCard
            player={dragPlayer}
            rating={effRating(dragPlayer)}
            label={posOf(dragPlayer)}
            team={teamOf(dragPlayer.id)}
            compact={true}
          />
        </div>
      )}

      {/* Kaleci seçme (oyuncular bölümünden veya sahadan) */}
      {keeperPicker && (
        <Picker
          title={`${TEAM_LABELS[keeperPicker]} takım kalecisi`}
          groups={keeperGroups}
          rateOf={keeperRate}
          emptyText="Listede seçilecek oyuncu yok."
          onPick={id => { setKeeper(keeperPicker, id); setKeeperPicker(null) }}
          onClose={() => setKeeperPicker(null)}
        />
      )}

      {/* Sahadaki bir sıraya istediğin oyuncuyu ekleme (puanı o sıraya göre görünür) */}
      {rowPicker && (
        <Picker
          title={`${POSITION_LABELS[rowPicker]} sırasına oyuncu ekle`}
          groups={rowGroups}
          rateOf={p => ratingAt(p, rowPicker)}
          full={fieldOnPitch >= maxField}
          fullText={`Sahada en fazla ${maxField} oyuncu olabilir.`}
          emptyText="Eklenecek başka oyuncu kalmadı."
          onPick={id => addToPitch(id, rowPicker, true)}
          onClose={() => setRowPicker(null)}
        />
      )}

      {/* Oyuncu detayı */}
      {detailPlayer && (
        <PlayerDetail
          player={detailPlayer}
          onPitch={pitchIds.includes(detailPlayer.id)}
          absent={absentSet.has(detailPlayer.id)}
          teams={teams}
          onClose={() => setDetailId(null)}
          onPlace={placePlayer}
          onToggle={p => { togglePlayer(p); setDetailId(null) }}
          onAbsent={toggleAbsent}
          onKeeper={(t, p) => {
            if (teams[t].gk === p.id) removeFromPitch(p.id)
            else setKeeper(t, p.id)
            setDetailId(null)
          }}
        />
      )}

      {/* Paylaş */}
      {showShare && (
        <ShareModal
          data={buildShareData()}
          onClose={() => setShowShare(false)}
          onFlash={flash}
        />
      )}

      {showReg && (
        <Kayit
          onClose={() => setShowReg(false)}
          onAdd={addPlayers}
          baseKeys={BASE_KEYS}
          allCodes={allCodes}
          extrasCount={extras.length}
          onClearExtras={clearExtras}
        />
      )}

      {notice && <div className="toast" role="status">{notice}</div>}
    </div>
  )
}