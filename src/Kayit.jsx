import { useState } from 'react'

export const STAT_LABELS = { defans: 'DEF', atak: 'ATK', calim: 'ÇAL', kaleci: 'KAL' }

const FIELDS = [
  { key: 'defans', label: 'Defans' },
  { key: 'atak', label: 'Atak' },
  { key: 'calim', label: 'Çalım' },
  { key: 'kaleci', label: 'Kaleci' }
]
const POS_BY_STAT = { defans: 'DEF', atak: 'FW', calim: 'MID', kaleci: 'GK' }

const norm = s =>
  s.toLocaleLowerCase('tr')
    .replace(/ç/g, 'c').replace(/ı/g, 'i').replace(/ö/g, 'o')
    .replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ğ/g, 'g')

// Tek satırı oyuncuya çevirir: "x:Ahmet Haşim Defans:60 Atak:70 Çalım:80"
export function parseLine(line) {
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
    stats[key] = Math.max(1, Math.min(99, Number(m[2])))
  }

  const entries = Object.entries(stats)
  if (entries.length === 0) return { error: 'Stat bulunamadı' }

  const rating = Math.round(entries.reduce((s, [, v]) => s + v, 0) / entries.length)
  const best = entries.sort((a, b) => b[1] - a[1])[0][0]

  return { firstName, lastName, position: POS_BY_STAT[best], rating, stats }
}

export default function Kayit({ onClose, onAdd }) {
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
  const [replaceAll, setReplaceAll] = useState(false)

  const results = text.split('\n').map((l, i) => ({ line: i + 1, res: parseLine(l) })).filter(r => r.res)
  const valid = results.filter(r => !r.res.error).map(r => r.res)
  const errors = results.filter(r => r.res.error)

  function submit() {
    if (valid.length === 0) return
    onAdd(valid, replaceAll)
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
            <p className="modal-hint">Bilgilerini gir, oluşan kodu kopyalayıp yöneticiye gönder. Boş bıraktığın stat hesaba katılmaz.</p>
            <div className="form-row">
              <input className="search-input" placeholder="İsim" value={first} onChange={e => setFirst(e.target.value)} />
              <input className="search-input" placeholder="Soyisim" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            <div className="form-grid">
              {FIELDS.map(f => (
                <label key={f.key} className="stat-field">
                  <span>{f.label}</span>
                  <input
                    type="number" min="1" max="99"
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
            <p className="modal-hint">Gelen kodları her satıra bir tane gelecek şekilde yapıştır.</p>
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
            <label className="check-row">
              <input type="checkbox" checked={replaceAll} onChange={e => setReplaceAll(e.target.checked)} />
              Mevcut listeyi (rastgele örnekler dahil) silip baştan başla
            </label>
            <button className="btn-primary" onClick={submit} disabled={valid.length === 0}>
              {valid.length} Oyuncuyu Ekle
            </button>
          </div>
        )}
      </div>
    </div>
  )
}