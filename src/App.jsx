import { useState, useMemo, useEffect, useRef } from 'react'
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
const FILTERS = ['DEF', 'MID', 'FW']
const TEAM_LABELS = { black: 'Siyah', red: 'Kırmızı' }

// Sahada yukarıdan aşağıya sıralama (üstte hücum, altta kale)
// GKT = üstteki kale (sadece "Tümü" görünümünde, Kırmızı kaleci burada durur)
const ROW_ORDER = ['FW', 'MID', 'DEF', 'GK']
const ROW_ORDER_ALL = ['GKT', ...ROW_ORDER]

// Maç düzeni: 7vs7 (1 kaleci + 6 oyuncu). Değiştirmek için sadece TEAM_SIZE'ı değiştir.
const TEAM_SIZE = 7
const FIELD_SLOTS = TEAM_SIZE - 1
const MAX_FIELD = FIELD_SLOTS * 2 // sahadaki oyuncu sayısı (kaleciler hariç)
const MAX_GK = 2

// Kayıt sistemi: oyuncu ve kaleci statları ayrı
const STAT_LABELS = {
  defans: 'DEF', atak: 'ATK', calim: 'ÇAL',
  kavrama: 'KAV', refleks: 'REF', hava: 'HAV', ayak: 'AYK',
  kaleci: 'KAL' // eski kayıtlar için
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

// ============ Yardımcı fonksiyonlar ============
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

// Otomatik takım kurma: seçili kaleciler korunur, kalan oyuncular puana göre dengeli dağıtılır
function autoFormTeams(players, current) {
  const sorted = [...players].sort(byRatingDesc)
  const ratingOf = id => {
    const p = players.find(x => x.id === id)
    return p ? p.rating : 0
  }
  const has = id => players.some(p => p.id === id)

  const black = { gk: has(current.black.gk) ? current.black.gk : null, field: [] }
  const red = { gk: has(current.red.gk) ? current.red.gk : null, field: [] }

  // Eksik kaleci yerlerini kaleci pozisyonundaki oyunculardan doldur
  const spareGks = sorted.filter(
    p => p.position === 'GK' && p.id !== black.gk && p.id !== red.gk
  )
  if (!black.gk && spareGks.length) black.gk = spareGks.shift().id
  if (!red.gk && spareGks.length) red.gk = spareGks.shift().id

  const used = new Set([black.gk, red.gk])
  let bs = black.gk ? ratingOf(black.gk) : 0
  let rs = red.gk ? ratingOf(red.gk) : 0
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

// Türkçe karakterleri sadeleştir (Çalım = calim = CALIM)
const norm = s =>
  s.toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ğ/g, 'g')

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
  const cards = [...cardsEl.querySelectorAll('[data-pid]')]
    .filter(c => Number(c.dataset.pid) !== dragId)

  let beforeId = null
  let markerX = cr.width / 2
  for (const c of cards) {
    const r = c.getBoundingClientRect()
    if (x < r.left + r.width / 2) {
      beforeId = Number(c.dataset.pid)
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

// Tek satırı oyuncuya çevirir
//   Oyuncu: "x:Ahmet Haşim Defans:60 Atak:70 Çalım:80"
//   Kaleci: "x:Mert Kaya Kavrama:85 Refleks:80 Hava:70 Ayak:60"
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

  const isGk = entries.some(([k]) => GK_KEYS.includes(k))
  const hasField = entries.some(([k]) => FIELD_POS[k])
  if (isGk && hasField) return { error: 'Kaleci ve oyuncu statları karıştırılamaz' }

  const rating = Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length)
  const best = [...entries].sort((a, b) => b[1] - a[1])[0][0]
  const position = isGk ? 'GK' : FIELD_POS[best]

  return { firstName, lastName, position, rating, stats }
}

// ============ Bileşenler ============

function PlayerCard({
  player, onClick, compact, onPitch,
  team, label, dragging, selected, onPointerDown, onRemove
}) {
  const tier = getTier(player.rating)

  // Sahadaki kart
  if (compact) {
    return (
      <div
        className={`pitch-card ${tier.class} ${dragging ? 'dragging' : ''} ${selected ? 'selected' : ''}`}
        data-pid={player.id}
        onPointerDown={onPointerDown}
        onClick={onClick}
        title="Dokun: seç · Bilgisayarda sürükleyebilirsin"
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
  return (
    <div className={`player-card ${tier.class} ${onPitch ? 'on-pitch' : ''}`} onClick={onClick}>
      <div className="player-card-left">
        <span className="player-rating">{player.rating}</span>
      </div>
      <div className="player-card-right">
        <span className="player-name">{player.firstName} {player.lastName}</span>
        <span className="player-tier">{tier.label}{onPitch ? ' · sahada' : ''}</span>
        {player.stats && <span className="player-stats">{statLine(player)}</span>}
      </div>
      <span className={`pos-chip pos-${player.position}`} title="En iyi olduğu pozisyon">
        {POSITION_LABELS[player.position]}
      </span>
    </div>
  )
}

// Oyuncu seçme penceresi (mobilde alttan açılır)
function Picker({ title, groups, onPick, onClose, full, fullText, emptyText }) {
  const [query, setQuery] = useState('')
  const q = norm(query.trim())

  const shown = groups
    .map(g => ({
      ...g,
      players: g.players.filter(p => norm(`${p.firstName} ${p.lastName}`).includes(q))
    }))
    .filter(g => g.players.length > 0)

  const total = groups.reduce((s, g) => s + g.players.length, 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="panel-toggle" onClick={onClose}>✕</button>
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
          {total === 0 && (
            <p className="modal-hint">{emptyText || 'Seçilecek oyuncu yok.'}</p>
          )}
          {total > 0 && shown.length === 0 && <p className="modal-hint">Oyuncu bulunamadı.</p>}

          {shown.map(g => (
            <div key={g.label}>
              <div className="slot-title">{g.label} <span>{g.players.length}</span></div>
              <div className="pick-list">
                {g.players.map(p => {
                  const tier = getTier(p.rating)
                  return (
                    <button
                      key={p.id}
                      className={`pick-item ${tier.class}`}
                      disabled={full}
                      onClick={() => onPick(p.id)}
                    >
                      <span className="pick-rating">{p.rating}</span>
                      <span className="pick-main">
                        <span className="pick-name">{p.firstName} {p.lastName}</span>
                        {p.stats && <span className="pick-stats">{statLine(p)}</span>}
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

function TeamBox({
  teamName, color, gk, players, posOf,
  unassignedField, keeperGroups, otherName,
  onAddGk, onAddField, onMove, onRemove, onRemoveGk
}) {
  const [picker, setPicker] = useState(null) // null | 'gk' | 'field'

  const all = gk ? [gk, ...players] : players
  const sum = all.reduce((s, p) => s + p.rating, 0)
  const fieldFull = players.length >= FIELD_SLOTS

  // Pozisyon etiketi: oyuncunun SAHADAKİ yerine göre yazılır
  const row = (p, isGk) => {
    const tier = getTier(p.rating)
    return (
      <div key={p.id} className={`team-player ${tier.class} ${isGk ? 'gk-row' : ''}`}>
        <span className="team-player-rating">{p.rating}</span>
        <span className="team-player-name">{p.firstName} {p.lastName}</span>
        <span className="team-player-pos">{posOf(p)}</span>
        <button className="team-act" title={`${otherName} takıma geçir`} onClick={() => onMove(p.id)}>⇄</button>
        <button
          className="team-act remove"
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
        <span className="team-count">{all.length}/{TEAM_SIZE} kişi</span>
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
        <div className="slot-title">Oyuncular <span>{players.length}/{FIELD_SLOTS}</span></div>
        <div className="team-players">
          {players.map(p => row(p, false))}
          {Array.from({ length: FIELD_SLOTS - players.length }, (_, i) => (
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
          emptyText="Listede seçilecek oyuncu yok."
          onPick={id => { onAddGk(id); setPicker(null) }}
          onClose={() => setPicker(null)}
        />
      )}
      {picker === 'field' && (
        <Picker
          title={`${teamName} takım oyuncusu`}
          groups={[{ label: 'Sahadaki oyuncular', players: unassignedField }]}
          full={fieldFull}
          fullText="Takım dolu."
          emptyText="Sahada seçilecek oyuncu yok. Önce oyuncuyu sahaya ekle."
          onPick={id => {
            onAddField(id)
            if (players.length + 1 >= FIELD_SLOTS) setPicker(null)
          }}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
  )
}

// Oyuncu kayıt penceresi
function Kayit({ onClose, onAdd, sampleCount, onClearSamples }) {
  const [tab, setTab] = useState('player')

  // Oyuncu sekmesi
  const [kind, setKind] = useState('field') // field | gk
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [vals, setVals] = useState({})
  const [copied, setCopied] = useState(false)

  const fields = kind === 'gk' ? GK_STATS : FIELD_STATS
  const statText = fields
    .filter(f => vals[f.key])
    .map(f => `${f.code}:${vals[f.key]}`)
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
                ? 'Kaleci olarak kendini 1-99 arası puanla. Oluşan kodu kopyalayıp yöneticiye gönder.'
                : 'Bilgilerini gir, oluşan kodu kopyalayıp yöneticiye gönder. Boş bıraktığın stat hesaba katılmaz.'}
            </p>
            <div className="form-row">
              <input className="search-input" placeholder="İsim" value={first} onChange={e => setFirst(e.target.value)} />
              <input className="search-input" placeholder="Soyisim" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            <div className="form-grid">
              {fields.map(f => (
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
              placeholder={'x:Ahmet Haşim Defans:60 Atak:70 Çalım:80\nx:Mert Kaya Kavrama:85 Refleks:80 Hava:70 Ayak:60'}
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
  // Elle değiştirilen sıralar: { oyuncuId: 'MID' }
  const [rowOverride, setRowOverride] = usePersistentState('fifa.rows', {})

  // Mobilde panel kapalı başlar (çekmece), bilgisayarda açık
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth > 800)
  const [search, setSearch] = useState('')
  const [filterPos, setFilterPos] = useState('ALL')
  const [teamName, setTeamName] = useState('')
  const [showReg, setShowReg] = useState(false)
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

  // ID -> oyuncu
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

  const fieldOnPitch = pitchPlayers.filter(p => !gkIds.has(p.id)).length

  // Sahada olup henüz takımı olmayanlar
  const unassignedField = pitchPlayers.filter(p => !assigned.has(p.id)).sort(byRatingDesc)

  // Kaleci seçme listesi: kaleci olarak iyi olanlar önde, istersen herkes seçilebilir
  const keeperCandidates = players.filter(p => !gkIds.has(p.id)).sort(byRatingDesc)
  const keeperGroups = [
    { label: 'Kaleci olarak iyi olanlar', players: keeperCandidates.filter(p => p.position === 'GK') },
    { label: 'Diğer oyuncular', players: keeperCandidates.filter(p => p.position !== 'GK') }
  ]

  // Sahadaki bir sıraya oyuncu ekleme listesi
  const rowCandidates = players
    .filter(p => p.position !== 'GK' && !pitchIds.includes(p.id))
    .sort(byRatingDesc)
  const rowGroups = rowPicker
    ? [
        {
          label: `${POSITION_LABELS[rowPicker]} olarak iyi olanlar`,
          players: rowCandidates.filter(p => p.position === rowPicker)
        },
        {
          label: 'Diğer oyuncular',
          players: rowCandidates.filter(p => p.position !== rowPicker)
        }
      ]
    : []

  function teamOf(id) {
    if (teams.black.gk === id || teams.black.field.includes(id)) return 'black'
    if (teams.red.gk === id || teams.red.field.includes(id)) return 'red'
    return null
  }

  // Üstteki kale satırı sadece "Tümü" görünümünde var
  function normRow(r) {
    return r === 'GKT' && view !== 'all' ? 'GK' : r
  }

  // Sahada hangi sırada gösterilecek (elle seçilen > takım kalecisi > pozisyon)
  function rowOf(p) {
    if (rowOverride[p.id]) return normRow(rowOverride[p.id])
    if (gkIds.has(p.id)) {
      return teams.red.gk === p.id && view === 'all' ? 'GKT' : 'GK'
    }
    if (p.position === 'GK' && teamOf(p.id)) return 'DEF'
    return p.position
  }

  // Takım kutularında gösterilecek pozisyon = oyuncunun sahadaki yeri
  const posOf = p => posCode(rowOf(p))

  const rowsToShow = view === 'all' ? ROW_ORDER_ALL : ROW_ORDER

  function rowLabel(row) {
    if (row === 'GKT') return 'Kırmızı Kaleci'
    if (row === 'GK') return view === 'all' ? 'Siyah Kaleci' : 'Kaleci'
    return POSITION_LABELS[row]
  }

  const viewPlayers = view === 'all'
    ? pitchPlayers
    : pitchPlayers.filter(p => teamOf(p.id) === view)

  // Sol liste: kaleci pozisyonundakiler sadece "Kaleciler" bölümünden eklenir
  const listPlayers = useMemo(() => {
    return players
      .filter(p => {
        if (p.position === 'GK') return false
        const matchesSearch = `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase())
        const matchesPos = filterPos === 'ALL' || p.position === filterPos
        return matchesSearch && matchesPos
      })
      .sort(byRatingDesc)
  }, [players, search, filterPos])

  const selectedPlayer =
    selectedId != null && pitchIds.includes(selectedId) ? byId[selectedId] || null : null

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

  // Oyuncuyu sahaya ekler. row verilirse o sıraya, verilmezse kendi pozisyonunun sırasına koyar.
  function addToPitch(id, row, announce) {
    const p = byId[id]
    if (!p || pitchIds.includes(id)) return
    if (fieldOnPitch >= MAX_FIELD) {
      return flash(`Sahada en fazla ${MAX_FIELD} oyuncu olabilir`)
    }
    setPitchIds(prev => [...prev, id])
    if (row && row !== p.position) setRowOverride(prev => ({ ...prev, [id]: row }))
    if (announce) flash(`${p.firstName} ${p.lastName} → ${POSITION_LABELS[row || p.position]}`)
  }

  function removeFromPitch(id) {
    setPitchIds(prev => prev.filter(x => x !== id))
    unassign(id)
    clearRow(id)
    if (selectedId === id) setSelectedId(null)
  }

  function clearPitch() {
    setPitchIds([])
    setTeams(emptyTeams())
    setRowOverride({})
    setSelectedId(null)
  }

  // --- Sürükle-bırak (sadece fare/kalem; dokunmatikte seçim çubuğu kullanılır) ---
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

  // --- Seçili oyuncuyu taşıma (dokunmatik için) ---
  function moveToRow(id, row) {
    commitDrop(id, { row, beforeId: null })
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

  // --- Takımlar ---
  function handleAutoForm() {
    if (pitchPlayers.length < 2) return
    setTeams(autoFormTeams(pitchPlayers, teams))
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

  // Kaleci seçer: oyuncu otomatik sahaya ve o takımın kaleci yerine geçer
  function setKeeper(team, id) {
    if (!byId[id]) return
    if (teams[team].gk) return flash(`${TEAM_LABELS[team]} takımın kalecisi zaten seçili`)
    setPitchIds(prev => (prev.includes(id) ? prev : [...prev, id]))
    placeInTeam(team, id, true)
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
    setSelectedId(null)
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
    setSelectedId(null)
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
      {/* Sol Panel — masaüstünde kenar çubuğu, mobilde tam ekran çekmece */}
      <aside className={`player-panel ${panelOpen ? 'open' : 'closed'}`}>
        <div className="panel-header">
          <h2 className="panel-title">Oyuncular ({players.length})</h2>
          <button className="panel-toggle" onClick={() => setPanelOpen(!panelOpen)}>
            {panelOpen ? '◀' : '▶'}
          </button>
          <button className="panel-close" onClick={() => setPanelOpen(false)}>Kapat ✕</button>
        </div>

        {panelOpen && (
          <div className="panel-body">
            {/* Kaleciler: ayrı bölüm, takıma doğrudan eklenir */}
            <div className="keeper-box">
              <div className="slot-title gk-title">Kaleciler <span>{gkIds.size}/{MAX_GK}</span></div>
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
                            <span className="keeper-name">{kp.firstName} {kp.lastName}</span>
                            {kp.stats && <span className="keeper-stats">{statLine(kp)}</span>}
                          </div>
                          <span className="keeper-rating">{kp.rating}</span>
                          <button
                            className="team-act remove"
                            title="Kaleciyi çıkar"
                            onClick={() => removeFromPitch(kp.id)}
                          >✕</button>
                        </div>
                      ) : (
                        <button className="keeper-add" onClick={() => setKeeperPicker(t)}>
                          + Kaleci Seç
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="panel-search">
              <input
                type="text"
                placeholder="Oyuncu ara..."
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
              {FILTERS.map(pos => (
                <button
                  key={pos}
                  className={`filter-btn ${filterPos === pos ? 'active' : ''}`}
                  onClick={() => setFilterPos(pos)}
                >{POSITION_LABELS[pos]}</button>
              ))}
            </div>

            <div className="list-info">
              Oyuncular · sahada {fieldOnPitch}/{MAX_FIELD}
            </div>

            <div className="player-list">
              {listPlayers.map(player => {
                const onPitch = pitchIds.includes(player.id)
                return (
                  <PlayerCard
                    key={player.id}
                    player={player}
                    onPitch={onPitch}
                    onClick={() => {
                      if (onPitch) {
                        removeFromPitch(player.id)
                        flash(`${player.firstName} ${player.lastName} sahadan çıkarıldı`)
                      } else {
                        addToPitch(player.id, null, true)
                      }
                    }}
                  />
                )
              })}
              {listPlayers.length === 0 && (
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

      {/* Mobilde paneli açan buton */}
      {!panelOpen && !selectedPlayer && (
        <button className="panel-fab" onClick={() => setPanelOpen(true)}>+ Oyuncu / Kaleci</button>
      )}

      {/* Sağ Taraf */}
      <main className="main-content">
        <div className="content-header">
          <h1 className="page-title">FIFA Takım Kurma</h1>
          <span className="pitch-count">
            Oyuncu {fieldOnPitch}/{MAX_FIELD} · Kaleci {gkIds.size}/{MAX_GK}
          </span>
        </div>

        <div className="action-bar">
          <button className="btn-primary" onClick={handleAutoForm} disabled={pitchPlayers.length < 2}>
            Otomatik Takım Kur
          </button>
          <button className="btn-secondary" onClick={() => setShowReg(true)}>
            Oyuncu Kaydı
          </button>
          <button className="btn-secondary" onClick={clearTeams} disabled={assigned.size === 0}>
            Takımları Temizle
          </button>
          <button className="btn-secondary" onClick={clearPitch} disabled={pitchIds.length === 0}>
            Sahayı Temizle
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
                          label={posCode(pos)}
                          team={teamOf(player.id)}
                          dragging={!!drag && drag.id === player.id}
                          selected={selectedId === player.id}
                          onPointerDown={e => startDrag(e, player)}
                          onClick={() => {
                            if (suppressClick.current) return
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

            {viewPlayers.length === 0 && (
              <div className="pitch-empty-hint">
                <p>
                  {view === 'all'
                    ? 'Oyuncu eklemek için sıralardaki "+ Oyuncu" butonunu veya oyuncu listesini kullan'
                    : 'Bu takımda henüz oyuncu yok'}
                </p>
              </div>
            )}
          </div>

          {/* Seçili oyuncuyu taşıma çubuğu (dokunmatik ve masaüstü) */}
          {selectedPlayer && (
            <div className="selection-bar">
              <div className="sel-info">
                <strong>{selectedPlayer.firstName} {selectedPlayer.lastName}</strong>
                <span>{POSITION_LABELS[posOf(selectedPlayer)]} sırasında</span>
              </div>
              <div className="sel-rows">
                {ROW_ORDER.map(r => (
                  <button
                    key={r}
                    className={`sel-btn ${posOf(selectedPlayer) === r ? 'active' : ''}`}
                    onClick={() => moveToRow(selectedPlayer.id, r)}
                  >{POSITION_LABELS[r]}</button>
                ))}
              </div>
              <div className="sel-actions">
                <button className="sel-btn" onClick={() => shiftInRow(selectedPlayer.id, -1)}>◀</button>
                <button className="sel-btn" onClick={() => shiftInRow(selectedPlayer.id, 1)}>▶</button>
                <button className="sel-btn danger grow" onClick={() => removeFromPitch(selectedPlayer.id)}>
                  Sahadan Çıkar
                </button>
                <button className="sel-btn grow" onClick={() => setSelectedId(null)}>Bitti</button>
              </div>
            </div>
          )}

          <p className="pitch-tip">
            Karta dokun, alttaki çubukla istediğin sıraya taşı. Bilgisayarda kartı sürükleyip de bırakabilirsin.
          </p>
        </div>

        {/* Siyah ve Kırmızı Takım */}
        <div className="teams-section">
          <TeamBox
            teamName="Siyah"
            color="black"
            gk={blackGk}
            players={blackField}
            posOf={posOf}
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
            label={posOf(dragPlayer)}
            team={teamOf(dragPlayer.id)}
            compact={true}
          />
        </div>
      )}

      {/* Kaleci seçme (panelden veya sahadan) */}
      {keeperPicker && (
        <Picker
          title={`${TEAM_LABELS[keeperPicker]} takım kalecisi`}
          groups={keeperGroups}
          emptyText="Listede seçilecek oyuncu yok."
          onPick={id => { setKeeper(keeperPicker, id); setKeeperPicker(null) }}
          onClose={() => setKeeperPicker(null)}
        />
      )}

      {/* Sahadaki bir sıraya istediğin oyuncuyu ekleme */}
      {rowPicker && (
        <Picker
          title={`${POSITION_LABELS[rowPicker]} sırasına oyuncu ekle`}
          groups={rowGroups}
          full={fieldOnPitch >= MAX_FIELD}
          fullText={`Sahada en fazla ${MAX_FIELD} oyuncu olabilir.`}
          emptyText="Eklenecek başka oyuncu kalmadı."
          onPick={id => addToPitch(id, rowPicker)}
          onClose={() => setRowPicker(null)}
        />
      )}

      {showReg && (
        <Kayit
          onClose={() => setShowReg(false)}
          onAdd={addPlayers}
          sampleCount={sampleCount}
          onClearSamples={clearSamples}
        />
      )}

      {notice && <div className="toast">{notice}</div>}
    </div>
  )
}
