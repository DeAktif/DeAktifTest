import { useState, useMemo, useEffect } from 'react'
import './App.css'

// ============ Sabit veriler ============
const FIRST_NAMES = [
  'Ahmet', 'Mehmet', 'Mustafa', 'Ali', 'Hasan', 'Hüseyin', 'İbrahim', 'İsmail',
  'Osman', 'Yusuf', 'Murat', 'Emre', 'Burak', 'Cem', 'Deniz', 'Erdem', 'Furkan',
  'Gökhan', 'Kerem', 'Mert', 'Onur', 'Serkan', 'Tolga', 'Umut', 'Yiğit', 'Barış',
  'Can', 'Doğan', 'Eren', 'Halil'
]

const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk',
  'Aydın', 'Özdemir', 'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara',
  'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat', 'Korkmaz', 'Erdoğan', 'Güneş',
  'Aksoy', 'Bulut', 'Taş', 'Aktaş', 'Bilgin', 'Soylu'
]

const POSITIONS = ['GK', 'DEF', 'MID', 'FW']
const POSITION_LABELS = { GK: 'Kaleci', DEF: 'Defans', MID: 'Orta Saha', FW: 'Forvet' }

// Sahada yukarıdan aşağıya sıralama (üstte hücum, altta kale)
const ROW_ORDER = ['FW', 'MID', 'DEF', 'GK']

// Maç düzeni: 7vs7 (1 kaleci + 6 oyuncu). Değiştirmek için sadece TEAM_SIZE'ı değiştir.
const TEAM_SIZE = 7
const FIELD_SLOTS = TEAM_SIZE - 1
const MAX_PITCH = TEAM_SIZE * 2

// Kayıt sistemi
const STAT_LABELS = { defans: 'DEF', atak: 'ATK', calim: 'ÇAL', kaleci: 'KAL' }
const FIELDS = [
  { key: 'defans', label: 'Defans' },
  { key: 'atak', label: 'Atak' },
  { key: 'calim', label: 'Çalım' },
  { key: 'kaleci', label: 'Kaleci' }
]
const POS_BY_STAT = { defans: 'DEF', atak: 'FW', calim: 'MID', kaleci: 'GK' }

// ============ Yardımcı fonksiyonlar ============
function getTier(rating) {
  if (rating >= 85) return { label: 'Elit', class: 'tier-elit' }
  if (rating >= 75) return { label: 'İyi', class: 'tier-iyi' }
  if (rating >= 65) return { label: 'Orta', class: 'tier-orta' }
  return { label: 'Gelişim', class: 'tier-gelisim' }
}

function generatePlayers() {
  const players = []
  const usedNames = new Set()

  for (let i = 0; i < 50; i++) {
    let firstName, lastName, fullName
    do {
      firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
      lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
      fullName = `${firstName} ${lastName}`
    } while (usedNames.has(fullName))

    usedNames.add(fullName)
    players.push({
      id: i + 1,
      firstName,
      lastName,
      position: POSITIONS[Math.floor(Math.random() * POSITIONS.length)],
      rating: Math.floor(Math.random() * 36) + 60
    })
  }
  return players
}

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

// Otomatik takım kurma: en iyi 2 kaleci ayrı takımlara, kalanlar puana göre dengeli
function autoFormTeams(players) {
  const sorted = [...players].sort((a, b) => b.rating - a.rating)
  const gks = sorted.filter(p => p.position === 'GK')

  const black = { gk: gks[0] ? gks[0].id : null, field: [] }
  const red = { gk: gks[1] ? gks[1].id : null, field: [] }
  const used = new Set([black.gk, red.gk])
  let bs = gks[0] ? gks[0].rating : 0
  let rs = gks[1] ? gks[1].rating : 0
  const count = t => t.field.length + (t.gk ? 1 : 0)

  for (const p of sorted) {
    if (used.has(p.id)) continue
    const bFull = black.field.length >= FIELD_SLOTS
    const rFull = red.field.length >= FIELD_SLOTS
    if (bFull && rFull) break

    let toBlack
    if (bFull) toBlack = false
    else if (rFull) toBlack = true
    else if (count(black) !== count(red)) toBlack = count(black) < count(red)
    else toBlack = bs <= rs

    if (toBlack) { black.field.push(p.id); bs += p.rating }
    else { red.field.push(p.id); rs += p.rating }
  }
  return { black, red }
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

const clamp = n => Math.max(1, Math.min(99, n))

// Sürükleme sırasında imlecin hangi sıraya ve hangi kartın önüne denk geldiğini bulur
function findDrop(x, y, dragId) {
  const pitchEl = document.querySelector('.pitch')
  if (!pitchEl) return { row: null, beforeId: null, markerX: 0 }

  const pr = pitchEl.getBoundingClientRect()
  if (x < pr.left || x > pr.right || y < pr.top || y > pr.bottom) {
    return { row: null, beforeId: null, markerX: 0 }
  }

  // Dikeyde imlece en yakın sırayı seç
  let rowEl = null
  let best = Infinity
  for (const r of document.querySelectorAll('.pitch-row')) {
    const b = r.getBoundingClientRect()
    const d = y < b.top ? b.top - y : y > b.bottom ? y - b.bottom : 0
    if (d < best) { best = d; rowEl = r }
  }
  if (!rowEl) return { row: null, beforeId: null, markerX: 0 }

  const rowRect = rowEl.getBoundingClientRect()
  const cards = [...rowEl.querySelectorAll('[data-pid]')]
    .filter(c => Number(c.dataset.pid) !== dragId)

  let beforeId = null
  let markerX = rowRect.width / 2
  for (const c of cards) {
    const r = c.getBoundingClientRect()
    if (x < r.left + r.width / 2) {
      beforeId = Number(c.dataset.pid)
      markerX = r.left - rowRect.left - 6
      break
    }
  }
  if (beforeId === null && cards.length > 0) {
    const last = cards[cards.length - 1].getBoundingClientRect()
    markerX = last.right - rowRect.left + 6
  }

  return { row: rowEl.dataset.row, beforeId, markerX }
}

// Türkçe karakterleri sadeleştir (Çalım = calim = CALIM)
const norm = s =>
  s.toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ğ/g, 'g')

// Tek satırı oyuncuya çevirir: "x:Ahmet Haşim Defans:60 Atak:70 Çalım:80"
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
    const key = norm(m[1])
    if (!POS_BY_STAT[key]) return { error: `Bilinmeyen stat: ${m[1]}` }
    stats[key] = clamp(Number(m[2]))
  }

  const entries = Object.entries(stats)
  if (entries.length === 0) return { error: 'Stat bulunamadı' }

  const rating = Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length)
  const best = [...entries].sort((a, b) => b[1] - a[1])[0][0]

  return { firstName, lastName, position: POS_BY_STAT[best], rating, stats }
}

// ============ Bileşenler ============

function PlayerCard({
  player, onClick, compact, onRate, onPosition, onPitch,
  team, label, dragging, onPointerDown, onRemove
}) {
  const tier = getTier(player.rating)

  // Sahadaki kart (sürüklenebilir)
  if (compact) {
    return (
      <div
        className={`pitch-card ${tier.class} ${dragging ? 'dragging' : ''}`}
        data-pid={player.id}
        onPointerDown={onPointerDown}
        title="Sürükleyerek pozisyonunu değiştir"
      >
        {team && <span className={`team-dot ${team}`}></span>}
        {onRemove && (
          <button
            className="pitch-remove"
            title="Sahadan çıkar"
            onPointerDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onRemove() }}
          >✕</button>
        )}
        <div className="pitch-card-top">
          <span className="pitch-card-rating">{player.rating}</span>
          <span className="pitch-card-pos">{label || player.position}</span>
        </div>
        <div className="pitch-card-name">{player.firstName}</div>
        <div className="pitch-card-lastname">{player.lastName}</div>
      </div>
    )
  }

  // Sol paneldeki kart
  const stop = e => e.stopPropagation()

  return (
    <div className={`player-card ${tier.class} ${onPitch ? 'on-pitch' : ''}`} onClick={onClick}>
      <div className="player-card-left">
        <span className="player-rating">{player.rating}</span>
        <span className="player-pos">{player.position}</span>
      </div>
      <div className="player-card-right">
        <span className="player-name">{player.firstName} {player.lastName}</span>
        <span className="player-tier">{tier.label}{onPitch ? ' · sahada' : ''}</span>
        {player.stats && (
          <span className="player-stats">
            {Object.entries(player.stats).map(([k, v]) => `${STAT_LABELS[k]} ${v}`).join(' · ')}
          </span>
        )}
      </div>
      <div className="player-edit" onClick={stop}>
        <div className="rate-controls">
          <button className="rate-btn" onClick={() => onRate(-1)}>−</button>
          <button className="rate-btn" onClick={() => onRate(1)}>+</button>
        </div>
        <select
          className="pos-select"
          value={player.position}
          onChange={e => onPosition(e.target.value)}
        >
          {POSITIONS.map(pos => <option key={pos} value={pos}>{pos}</option>)}
        </select>
      </div>
    </div>
  )
}

function TeamBox({
  teamName, color, gk, players,
  unassignedGk, unassignedOther, otherName,
  onAddGk, onAddField, onMove, onRemove
}) {
  const all = gk ? [gk, ...players] : players
  const sum = all.reduce((s, p) => s + p.rating, 0)
  const fieldFull = players.length >= FIELD_SLOTS
  const totalFree = unassignedGk.length + unassignedOther.length

  const opt = p => (
    <option key={p.id} value={p.id}>
      {p.rating} · {p.position} · {p.firstName} {p.lastName}
    </option>
  )

  const row = (p, isGk) => {
    const tier = getTier(p.rating)
    return (
      <div key={p.id} className={`team-player ${tier.class}`}>
        <span className="team-player-rating">{p.rating}</span>
        <span className="team-player-name">{p.firstName} {p.lastName}</span>
        <span className="team-player-pos">{isGk ? 'GK' : p.position}</span>
        <button className="team-act" title={`${otherName} takıma geçir`} onClick={() => onMove(p.id)}>⇄</button>
        <button className="team-act remove" title="Takımdan çıkar" onClick={() => onRemove(p.id)}>✕</button>
      </div>
    )
  }

  return (
    <div className={`team-box ${color === 'black' ? 'team-black' : 'team-red'}`}>
      <div className="team-header">
        <span className="team-color-dot"></span>
        <h3 className="team-title">{teamName} Takım</h3>
        <span className="team-count">{all.length}/{TEAM_SIZE} kişi</span>
      </div>
      <div className="team-body">
        {/* Kaleci */}
        <div className="slot-title">Kaleci <span>{gk ? 1 : 0}/1</span></div>
        {gk ? (
          <div className="team-players">{row(gk, true)}</div>
        ) : (
          <select
            className="team-add"
            value=""
            disabled={totalFree === 0}
            onChange={e => e.target.value && onAddGk(Number(e.target.value))}
          >
            <option value="">{totalFree > 0 ? '+ Kaleci seç...' : 'Sahada seçilecek oyuncu yok'}</option>
            {unassignedGk.length > 0 && <optgroup label="Kaleciler">{unassignedGk.map(opt)}</optgroup>}
            {unassignedOther.length > 0 && <optgroup label="Diğer oyuncular">{unassignedOther.map(opt)}</optgroup>}
          </select>
        )}

        {/* Oyuncular */}
        <div className="slot-title">Oyuncular <span>{players.length}/{FIELD_SLOTS}</span></div>
        <select
          className="team-add"
          value=""
          disabled={fieldFull || totalFree === 0}
          onChange={e => e.target.value && onAddField(Number(e.target.value))}
        >
          <option value="">
            {fieldFull ? 'Takım dolu' : totalFree > 0 ? '+ Oyuncu ekle...' : 'Sahada seçilecek oyuncu yok'}
          </option>
          {unassignedOther.length > 0 && <optgroup label="Oyuncular">{unassignedOther.map(opt)}</optgroup>}
          {unassignedGk.length > 0 && <optgroup label="Kaleciler">{unassignedGk.map(opt)}</optgroup>}
        </select>

        {players.length === 0 ? (
          <p className="team-empty">Oyuncu yok</p>
        ) : (
          <div className="team-players">{players.map(p => row(p, false))}</div>
        )}

        {all.length > 0 && (
          <div className="team-summary">
            <span className="team-sum-label">Toplam Puan</span>
            <span className="team-sum-value">{sum}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Oyuncu kayıt penceresi
function Kayit({ onClose, onAdd, sampleCount, onClearSamples }) {
  const [tab, setTab] = useState('player')

  // Oyuncu sekmesi
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [vals, setVals] = useState({})
  const [copied, setCopied] = useState(false)

  const statText = FIELDS
    .filter(f => vals[f.key])
    .map(f => `${f.label}:${vals[f.key]}`)
    .join(' ')
  const code = first.trim() && last.trim() && statText
    ? `x:${first.trim()} ${last.trim()} ${statText}`
    : ''

  async function copyCode() {
    try { await navigator.clipboard.writeText(code) } catch {}
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  // Yönetici sekmesi
  const [text, setText] = useState('')

  const results = text
    .split('\n')
    .map((l, i) => ({ line: i + 1, res: parseLine(l) }))
    .filter(r => r.res)
  const valid = results.filter(r => !r.res.error).map(r => r.res)
  const errors = results.filter(r => r.res.error)

  function submit() {
    if (valid.length === 0) return
    onAdd(valid)
    setText('')
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Oyuncu Kaydı</h3>
          <button className="panel-toggle" onClick={onClose}>✕</button>
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
            <p className="modal-hint">
              Bilgilerini gir, oluşan kodu kopyalayıp yöneticiye gönder. Boş bıraktığın stat hesaba katılmaz.
            </p>
            <div className="form-row">
              <input className="search-input" placeholder="İsim" value={first} onChange={e => setFirst(e.target.value)} />
              <input className="search-input" placeholder="Soyisim" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            <div className="form-grid">
              {FIELDS.map(f => (
                <label key={f.key} className="stat-field">
                  <span>{f.label}</span>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    className="search-input"
                    value={vals[f.key] || ''}
                    onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div className="code-box">{code || 'Kod burada görünecek...'}</div>
            <button className="btn-primary" onClick={copyCode} disabled={!code}>
              {copied ? 'Kopyalandı ✓' : 'Kodu Kopyala'}
            </button>
          </div>
        ) : (
          <div className="modal-body">
            <p className="modal-hint">
              Gelen kodları her satıra bir tane gelecek şekilde yapıştır. Oyuncular mevcut listeye eklenir,
              aynı isim varsa statları güncellenir.
            </p>
            <textarea
              className="code-input"
              placeholder={'x:Ahmet Haşim Defans:60 Atak:70 Çalım:80\nx:Mert Kaya Kaleci:85 Defans:55'}
              value={text}
              onChange={e => setText(e.target.value)}
            />
            {results.length > 0 && (
              <div className="parse-result">
                <span className="ok">{valid.length} geçerli</span>
                {errors.length > 0 && <span className="bad"> · {errors.length} hatalı</span>}
                {errors.map(e => (
                  <div key={e.line} className="bad small">Satır {e.line}: {e.res.error}</div>
                ))}
              </div>
            )}
            <button className="btn-primary" onClick={submit} disabled={valid.length === 0}>
              {valid.length} Oyuncuyu Ekle
            </button>

            {sampleCount > 0 && (
              <div className="sample-box">
                <span>Listede stat girilmemiş {sampleCount} rastgele örnek oyuncu var.</span>
                <button className="btn-secondary small danger" onClick={onClearSamples}>Örnekleri Sil</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ============ Ana uygulama ============
export default function App() {
  const [players, setPlayers] = usePersistentState('fifa.players', generatePlayers)
  const [pitchIds, setPitchIds] = usePersistentState('fifa.pitchIds', [])
  const [teams, setTeams] = usePersistentState('fifa.teams.v2', emptyTeams)
  const [savedTeams, setSavedTeams] = usePersistentState('fifa.savedTeams.v2', [])
  // Sürükleyerek değiştirilen sıralar: { oyuncuId: 'MID' }
  const [rowOverride, setRowOverride] = usePersistentState('fifa.rows', {})

  const [panelOpen, setPanelOpen] = useState(true)
  const [search, setSearch] = useState('')
  const [filterPos, setFilterPos] = useState('ALL')
  const [teamName, setTeamName] = useState('')
  const [showReg, setShowReg] = useState(false)
  const [view, setView] = useState('all') // all | black | red
  const [drag, setDrag] = useState(null)  // { id, x, y, row, beforeId, markerX }

  // ID -> oyuncu (puanlar değişince her yer otomatik güncellenir)
  const byId = useMemo(() => {
    const map = {}
    players.forEach(p => { map[p.id] = p })
    return map
  }, [players])

  const toPlayers = ids => ids.map(id => byId[id]).filter(Boolean)
  const pitchPlayers = toPlayers(pitchIds)

  const blackGk = byId[teams.black.gk] || null
  const redGk = byId[teams.red.gk] || null
  const blackField = toPlayers(teams.black.field)
  const redField = toPlayers(teams.red.field)

  const blackAll = blackGk ? [blackGk, ...blackField] : blackField
  const redAll = redGk ? [redGk, ...redField] : redField
  const blackSum = blackAll.reduce((s, p) => s + p.rating, 0)
  const redSum = redAll.reduce((s, p) => s + p.rating, 0)

  const assigned = new Set([
    teams.black.gk, teams.red.gk, ...teams.black.field, ...teams.red.field
  ].filter(Boolean))
  const gkIds = new Set([teams.black.gk, teams.red.gk].filter(Boolean))

  // Sahada olup henüz takımı olmayanlar
  const unassigned = pitchPlayers
    .filter(p => !assigned.has(p.id))
    .sort((a, b) => b.rating - a.rating)
  const unassignedGk = unassigned.filter(p => p.position === 'GK')
  const unassignedOther = unassigned.filter(p => p.position !== 'GK')

  function teamOf(id) {
    if (teams.black.gk === id || teams.black.field.includes(id)) return 'black'
    if (teams.red.gk === id || teams.red.field.includes(id)) return 'red'
    return null
  }

  // Sahada hangi sırada gösterilecek (sürükleme > takım kalecisi > pozisyon)
  function rowOf(p) {
    if (rowOverride[p.id]) return rowOverride[p.id]
    if (gkIds.has(p.id)) return 'GK'
    if (p.position === 'GK' && teamOf(p.id)) return 'DEF'
    return p.position
  }

  const viewPlayers = view === 'all'
    ? pitchPlayers
    : pitchPlayers.filter(p => teamOf(p.id) === view)

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => {
        const matchesSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
        const matchesPos = filterPos === 'ALL' || p.position === filterPos
        return matchesSearch && matchesPos
      })
      .sort((a, b) => b.rating - a.rating)
  }, [players, search, filterPos])

  const pitchFull = pitchIds.length >= MAX_PITCH
  const sampleCount = players.filter(p => !p.stats).length

  // --- Saha ---
  function clearRow(id) {
    setRowOverride(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  function addToPitch(id) {
    if (pitchIds.includes(id) || pitchFull) return
    setPitchIds(prev => [...prev, id])
  }

  function removeFromPitch(id) {
    setPitchIds(prev => prev.filter(x => x !== id))
    unassign(id)
    clearRow(id)
  }

  function clearPitch() {
    setPitchIds([])
    setTeams(emptyTeams())
    setRowOverride({})
  }

  // --- Sürükle-bırak (fare ve dokunmatik) ---
  function startDrag(e, player) {
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
      if (started && ev.type === 'pointerup') {
        commitDrop(player.id, findDrop(ev.clientX, ev.clientY, player.id))
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

  // --- Oyuncu düzenleme ---
  function updatePlayer(id, patch) {
    setPlayers(prev => prev.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }

  // --- Takımlar ---
  function handleAutoForm() {
    if (pitchPlayers.length < 2) return
    setTeams(autoFormTeams(pitchPlayers))
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
        if (t.field.length >= FIELD_SLOTS) return prev
        t.field = [...t.field, id]
      }
      return next
    })
  }

  function moveToOther(from, id) {
    const to = from === 'black' ? 'red' : 'black'
    const asGk = teams[from].gk === id
    if (asGk && teams[to].gk) return alert('Diğer takımın kaleci yeri dolu.')
    if (!asGk && teams[to].field.length >= FIELD_SLOTS) return alert('Diğer takımın oyuncu yerleri dolu.')
    placeInTeam(to, id, asGk)
  }

  // --- Oyuncu kaydı (kodlardan ekleme) ---
  function addPlayers(parsed) {
    setPlayers(prev => {
      const list = [...prev]
      let nextId = list.reduce((m, p) => Math.max(m, p.id), 0) + 1
      const same = (a, b) =>
        a.firstName.toLocaleLowerCase('tr') === b.firstName.toLocaleLowerCase('tr') &&
        a.lastName.toLocaleLowerCase('tr') === b.lastName.toLocaleLowerCase('tr')

      for (const n of parsed) {
        const idx = list.findIndex(p => same(p, n))
        if (idx >= 0) list[idx] = { ...list[idx], ...n } // aynı isim: güncelle
        else list.push({ id: nextId++, ...n })
      }
      return list
    })
  }

  // Stat girilmemiş rastgele örnek oyuncuları siler
  function clearSamples() {
    if (!confirm(`${sampleCount} rastgele örnek oyuncu silinecek. Emin misin?`)) return
    const ids = new Set(players.filter(p => !p.stats).map(p => p.id))
    setPlayers(prev => prev.filter(p => p.stats))
    setPitchIds(prev => prev.filter(id => !ids.has(id)))
    setTeams(prev => ({ black: removeIds(prev.black, ids), red: removeIds(prev.red, ids) }))
    setRowOverride(prev => {
      const next = {}
      Object.keys(prev).forEach(k => { if (!ids.has(Number(k))) next[k] = prev[k] })
      return next
    })
  }

  // --- Takım kaydetme ---
  function saveTeam() {
    if (pitchIds.length === 0) return
    const rows = {}
    pitchIds.forEach(id => { if (rowOverride[id]) rows[id] = rowOverride[id] })
    const entry = {
      id: Date.now(),
      name: teamName.trim() || `Takım ${savedTeams.length + 1}`,
      pitchIds,
      teams,
      rows
    }
    setSavedTeams(prev => [...prev, entry])
    setTeamName('')
  }

  function loadTeam(entry) {
    const ok = id => byId[id]
    const fix = t => ({ gk: ok(t.gk) ? t.gk : null, field: t.field.filter(ok) })
    setPitchIds(entry.pitchIds.filter(ok))
    setTeams({ black: fix(entry.teams.black), red: fix(entry.teams.red) })
    setRowOverride(entry.rows || {})
  }

  function deleteTeam(id) {
    setSavedTeams(prev => prev.filter(t => t.id !== id))
  }

  // --- Yedekleme (JSON) ---
  function exportData() {
    const data = JSON.stringify({ players, savedTeams }, null, 2)
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
        if (Array.isArray(data.players)) setPlayers(data.players)
        if (Array.isArray(data.savedTeams)) setSavedTeams(data.savedTeams)
        clearPitch()
      } catch {
        alert('Dosya okunamadı.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  function resetPlayers() {
    if (!confirm('Tüm oyuncular ve kayıtlı takımlar sıfırlanacak. Emin misin?')) return
    setPlayers(generatePlayers())
    setSavedTeams([])
    clearPitch()
  }

  const dragPlayer = drag ? byId[drag.id] : null

  return (
    <div className={`app ${drag ? 'is-dragging' : ''}`}>
      {/* Sol Panel — Oyuncu Listesi */}
      <aside className={`player-panel ${panelOpen ? 'open' : 'closed'}`}>
        <div className="panel-header">
          <h2 className="panel-title">Oyuncular ({players.length})</h2>
          <button className="panel-toggle" onClick={() => setPanelOpen(!panelOpen)}>
            {panelOpen ? '◀' : '▶'}
          </button>
        </div>

        {panelOpen && (
          <div className="panel-body">
            <div className="panel-search">
              <input
                type="text"
                placeholder="İsim ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="search-input"
              />
            </div>

            <div className="panel-filters">
              <button
                className={`filter-btn ${filterPos === 'ALL' ? 'active' : ''}`}
                onClick={() => setFilterPos('ALL')}
              >Tümü</button>
              {POSITIONS.map(pos => (
                <button
                  key={pos}
                  className={`filter-btn ${filterPos === pos ? 'active' : ''}`}
                  onClick={() => setFilterPos(pos)}
                >{pos}</button>
              ))}
            </div>

            <div className="player-list">
              {filteredPlayers.map(player => {
                const onPitch = pitchIds.includes(player.id)
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onPitch={onPitch}
                    onClick={() => (onPitch ? removeFromPitch(player.id) : addToPitch(player.id))}
                    onRate={d => updatePlayer(player.id, { rating: clamp(player.rating + d) })}
                    onPosition={pos => { updatePlayer(player.id, { position: pos }); clearRow(player.id) }}
                  />
                )
              })}
              {filteredPlayers.length === 0 && (
                <p className="empty-text">Oyuncu bulunamadı</p>
              )}
            </div>

            <div className="panel-footer">
              <button className="mini-btn" onClick={exportData}>Yedek İndir</button>
              <label className="mini-btn">
                Yedek Yükle
                <input type="file" accept="application/json" onChange={importData} hidden />
              </label>
              <button className="mini-btn danger" onClick={resetPlayers}>Sıfırla</button>
            </div>
          </div>
        )}
      </aside>

      {/* Sağ Taraf */}
      <main className="main-content">
        <div className="content-header">
          <h1 className="page-title">FIFA Takım Kurma Sistemi</h1>
          <div className="pitch-info">
            <span className="pitch-count">{pitchIds.length}/{MAX_PITCH} oyuncu</span>
          </div>
        </div>

        <div className="action-bar">
          <button className="btn-primary" onClick={handleAutoForm} disabled={pitchPlayers.length < 2}>
            Otomatik Takım Kur
          </button>
          <button className="btn-secondary" onClick={clearTeams} disabled={assigned.size === 0}>
            Takımları Temizle
          </button>
          <button className="btn-secondary" onClick={clearPitch} disabled={pitchIds.length === 0}>
            Sahayı Temizle
          </button>
          <button className="btn-secondary" onClick={() => setShowReg(true)}>
            Oyuncu Kaydı
          </button>
        </div>

        {/* Saha görünümü seçimi */}
        <div className="view-tabs">
          <button className={`filter-btn ${view === 'all' ? 'active' : ''}`} onClick={() => setView('all')}>Tümü</button>
          <button className={`filter-btn ${view === 'black' ? 'active' : ''}`} onClick={() => setView('black')}>Siyah</button>
          <button className={`filter-btn ${view === 'red' ? 'active' : ''}`} onClick={() => setView('red')}>Kırmızı</button>
        </div>

        {/* Halı Saha (dikey) */}
        <div className="pitch-container">
          <div className="pitch">
            <div className="pitch-line outer"></div>
            <div className="pitch-line center-circle"></div>
            <div className="pitch-line center-line"></div>
            <div className="pitch-line penalty-top"></div>
            <div className="pitch-line penalty-bottom"></div>
            <div className="pitch-line goal-top"></div>
            <div className="pitch-line goal-bottom"></div>

            {/* Üstte forvet, altta kaleci */}
            <div className="pitch-rows">
              {ROW_ORDER.map(pos => {
                const rowPlayers = viewPlayers.filter(p => rowOf(p) === pos)
                const isTarget = drag && drag.row === pos
                return (
                  <div
                    key={pos}
                    data-row={pos}
                    className={`pitch-row ${isTarget ? 'drop-target' : ''}`}
                  >
                    <span className="row-label">{POSITION_LABELS[pos]}</span>
                    {rowPlayers.map(player => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                        label={pos}
                        team={teamOf(player.id)}
                        dragging={!!drag && drag.id === player.id}
                        onPointerDown={e => startDrag(e, player)}
                        onRemove={() => removeFromPitch(player.id)}
                        compact={true}
                      />
                    ))}
                    {isTarget && (
                      <div className="drop-marker" style={{ left: drag.markerX - 2 }}></div>
                    )}
                  </div>
                )
              })}
            </div>

            {viewPlayers.length === 0 && (
              <div className="pitch-empty-hint">
                <p>
                  {view === 'all'
                    ? 'Sol panelden oyuncu seçerek sahaya ekleyin'
                    : 'Bu takımda henüz oyuncu yok'}
                </p>
              </div>
            )}
          </div>
          <p className="pitch-tip">
            İpucu: kartı tutup başka bir sıraya bırakarak pozisyonunu değiştir, aynı sırada sürükleyerek yerini ayarla.
          </p>
        </div>

        {/* Siyah ve Kırmızı Takım */}
        <div className="teams-section">
          <TeamBox
            teamName="Siyah"
            color="black"
            gk={blackGk}
            players={blackField}
            unassignedGk={unassignedGk}
            unassignedOther={unassignedOther}
            otherName="Kırmızı"
            onAddGk={id => placeInTeam('black', id, true)}
            onAddField={id => placeInTeam('black', id, false)}
            onMove={id => moveToOther('black', id)}
            onRemove={unassign}
          />
          <TeamBox
            teamName="Kırmızı"
            color="red"
            gk={redGk}
            players={redField}
            unassignedGk={unassignedGk}
            unassignedOther={unassignedOther}
            otherName="Siyah"
            onAddGk={id => placeInTeam('red', id, true)}
            onAddField={id => placeInTeam('red', id, false)}
            onMove={id => moveToOther('red', id)}
            onRemove={unassign}
          />
        </div>

        {blackAll.length > 0 && redAll.length > 0 && (
          <p className="balance">Takımlar arası puan farkı: <strong>{Math.abs(blackSum - redSum)}</strong></p>
        )}

        {/* Kayıtlı Takımlar */}
        <div className="saved-section">
          <h3 className="saved-title">Kayıtlı Takımlar</h3>
          <div className="saved-form">
            <input
              type="text"
              className="search-input"
              placeholder="Takım adı (opsiyonel)"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
            />
            <button className="btn-primary" onClick={saveTeam} disabled={pitchIds.length === 0}>
              Takımı Kaydet
            </button>
          </div>

          {savedTeams.length === 0 ? (
            <p className="empty-text">Henüz kayıtlı takım yok</p>
          ) : (
            <div className="saved-list">
              {savedTeams.map(t => (
                <div key={t.id} className="saved-item">
                  <div className="saved-info">
                    <span className="saved-name">{t.name}</span>
                    <span className="saved-meta">{t.pitchIds.length} oyuncu</span>
                  </div>
                  <button className="btn-secondary small" onClick={() => loadTeam(t)}>Yükle</button>
                  <button className="btn-secondary small danger" onClick={() => deleteTeam(t.id)}>Sil</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Sürüklenen kartın imleci takip eden kopyası */}
      {dragPlayer && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          <PlayerCard
            player={dragPlayer}
            label={rowOf(dragPlayer)}
            team={teamOf(dragPlayer.id)}
            compact={true}
          />
        </div>
      )}

      {showReg && (
        <Kayit
          onClose={() => setShowReg(false)}
          onAdd={addPlayers}
          sampleCount={sampleCount}
          onClearSamples={clearSamples}
        />
      )}
    </div>
  )
}