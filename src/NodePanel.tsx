import { useEffect, useState } from 'react'
import verses from './assets/verses.json'

// ─── Shared ───────────────────────────────────────────────────────────────────
function GridBg() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
      backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
      backgroundSize: '60px 60px',
      animation: 'grid-scroll 8s linear infinite',
      opacity: 0.5,
    }} />
  )
}

function ZoneLabel({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 8, color: 'var(--dim)', letterSpacing: 3, fontFamily: 'var(--font-mono)', marginBottom: 12 }}>
      {text}
    </div>
  )
}

// ─── THE WORD zone ────────────────────────────────────────────────────────────
function WordZone() {
  const theme = verses[new Date().getDay() % verses.length]
  const [passageIdx, setPassageIdx] = useState(0)
  const [opacity, setOpacity]       = useState(1)

  function nextPassage() {
    setOpacity(0)
    setTimeout(() => {
      setPassageIdx(i => (i + 1) % theme.passages.length)
      setOpacity(1)
    }, 150)
  }

  const passage = theme.passages[passageIdx]

  return (
    <div style={{
      borderRight: '1px solid var(--border)',
      borderBottom: '1px solid var(--border)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column',
    }}>
      <div>
        <ZoneLabel text="// THE WORD" />
        <div style={{ fontSize: 9, color: 'var(--dimmer)', letterSpacing: 2, fontFamily: 'var(--font-mono)', marginBottom: 10 }}>
          // {theme.theme.toUpperCase()}
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', opacity, transition: 'opacity 0.15s ease' }}>
        <div style={{
          fontSize: 12, color: '#c8e8ffcc',
          fontFamily: 'var(--font-mono)',
          lineHeight: 1.8, fontStyle: 'italic',
          marginBottom: 8, flex: 1,
        }}>
          {passage.verse}
        </div>
        <div style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
          — {passage.reference}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
        <button
          onClick={nextPassage}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-md)'; e.currentTarget.style.color = 'var(--dim)' }}
          style={{
            padding: '4px 10px',
            fontSize: 9, letterSpacing: 2,
            border: '1px solid var(--border-md)',
            color: 'var(--dim)',
            background: 'transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            transition: 'border-color 0.15s ease, color 0.15s ease',
          }}
        >
          [ NEXT ]
        </button>
      </div>
    </div>
  )
}

// ─── TIME zone ────────────────────────────────────────────────────────────────
function TimeZone() {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hh       = String(now.getHours()).padStart(2, '0')
  const mm       = String(now.getMinutes()).padStart(2, '0')
  const ss       = String(now.getSeconds()).padStart(2, '0')
  const dayName  = now.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const dateFull = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase()

  return (
    <div style={{
      borderBottom: '1px solid var(--border)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <ZoneLabel text="// TIME" />
      <div>
        <div style={{
          fontFamily: 'var(--font-head)', fontWeight: 700,
          fontSize: 52, lineHeight: 1,
          color: 'var(--accent)', letterSpacing: 2,
        }}>
          {hh}:{mm}:{ss}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
          <span style={{ fontFamily: 'var(--font-head)', fontWeight: 600, fontSize: 14, color: 'var(--accent2)', letterSpacing: 2 }}>
            {dayName}
          </span>
          <span style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: 1 }}>
            {dateFull}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── WEATHER zone ─────────────────────────────────────────────────────────────
const WEATHER_URL =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=35.0456&longitude=-85.3097' +
  '&current=temperature_2m,weathercode,windspeed_10m,relativehumidity_2m' +
  '&hourly=temperature_2m,weathercode' +
  '&daily=weathercode,temperature_2m_max,temperature_2m_min' +
  '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
  '&forecast_days=2&timezone=America%2FChicago'

const WMO_MAP: Record<number, { label: string; icon: string }> = {
  0:  { label: 'CLEAR',         icon: '○'   },
  1:  { label: 'MOSTLY CLEAR',  icon: '○'   },
  2:  { label: 'PARTLY CLOUDY', icon: '◑'   },
  3:  { label: 'OVERCAST',      icon: '●'   },
  45: { label: 'FOGGY',         icon: '≋'   },
  48: { label: 'FOGGY',         icon: '≋'   },
  51: { label: 'DRIZZLE',       icon: '·▼'  },
  53: { label: 'DRIZZLE',       icon: '·▼'  },
  55: { label: 'RAIN',          icon: '▼'   },
  61: { label: 'RAIN',          icon: '▼'   },
  63: { label: 'HEAVY RAIN',    icon: '▼▼'  },
  65: { label: 'HEAVY RAIN',    icon: '▼▼'  },
  80: { label: 'RAIN SHOWERS',  icon: '▼◦'  },
  81: { label: 'RAIN SHOWERS',  icon: '▼◦'  },
  95: { label: 'THUNDERSTORM',  icon: '↯▼'  },
  96: { label: 'HEAVY TSTORM',  icon: '↯▼▼' },
  99: { label: 'HEAVY TSTORM',  icon: '↯▼▼' },
  71: { label: 'SNOW',          icon: '❄'   },
  73: { label: 'SNOW',          icon: '❄'   },
  75: { label: 'SNOW',          icon: '❄'   },
  77: { label: 'SNOW SHOWERS',  icon: '❄▼'  },
  85: { label: 'SNOW SHOWERS',  icon: '❄▼'  },
  86: { label: 'SNOW SHOWERS',  icon: '❄▼'  },
  66: { label: 'SLEET',         icon: '❄▼▼' },
  67: { label: 'SLEET',         icon: '❄▼▼' },
}

function wmo(code: number) {
  return WMO_MAP[code] ?? { label: '---', icon: '·' }
}

function mostCommon(codes: number[]): number {
  const freq: Record<number, number> = {}
  for (const c of codes) freq[c] = (freq[c] ?? 0) + 1
  return Number(Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0)
}

function avg(nums: number[]): number {
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length)
}

type WeatherData = {
  current: { temperature_2m: number; weathercode: number; windspeed_10m: number; relativehumidity_2m: number }
  hourly:  { temperature_2m: number[]; weathercode: number[] }
  daily:   { weathercode: number[]; temperature_2m_max: number[]; temperature_2m_min: number[] }
}

function WeatherZone() {
  const [data, setData]       = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(false)

  async function fetchWeather() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(WEATHER_URL)
      if (!res.ok) throw new Error()
      setData(await res.json() as WeatherData)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchWeather()
    const id = setInterval(() => void fetchWeather(), 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [])

  // derive period rows from today's hourly slice (indices 0–23)
  const periods = data ? [
    { period: 'MORNING',   ...wmo(mostCommon(data.hourly.weathercode.slice(6,  12))), temp: avg(data.hourly.temperature_2m.slice(6,  12)) },
    { period: 'AFTERNOON', ...wmo(mostCommon(data.hourly.weathercode.slice(12, 18))), temp: avg(data.hourly.temperature_2m.slice(12, 18)) },
    { period: 'EVENING',   ...wmo(mostCommon(data.hourly.weathercode.slice(18, 23))), temp: avg(data.hourly.temperature_2m.slice(18, 23)) },
  ] : []

  const tomorrow = data ? {
    ...wmo(data.daily.weathercode[1] ?? 0),
    high: Math.round(data.daily.temperature_2m_max[1] ?? 0),
    low:  Math.round(data.daily.temperature_2m_min[1] ?? 0),
  } : null

  const divider = { borderTop: '1px solid #00d4ff12', margin: '10px 0' }

  return (
    <div style={{
      borderRight: '1px solid var(--border)',
      padding: '18px 20px',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <ZoneLabel text="// WEATHER — CHATTANOOGA, TN" />

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
          <span>// FETCHING WEATHER...</span>
          <span style={{ animation: 'blink 1s infinite' }}>█</span>
        </div>
      )}

      {error && !loading && (
        <div style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', letterSpacing: 1 }}>
          // WEATHER UNAVAILABLE
        </div>
      )}

      {data && !loading && !error && (
        <>
          {/* Current conditions */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 36, lineHeight: 1, color: 'var(--accent)' }}>
              {Math.round(data.current.temperature_2m)}°F
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 2 }}>
              <div style={{ fontSize: 10, color: '#c8e8ff', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
                {wmo(data.current.weathercode).icon}&nbsp; {wmo(data.current.weathercode).label}
              </div>
              <div style={{ fontSize: 9, color: 'var(--dim)', fontFamily: 'var(--font-mono)' }}>
                Humidity {Math.round(data.current.relativehumidity_2m)}% · Wind {Math.round(data.current.windspeed_10m)}mph
              </div>
            </div>
          </div>

          <div style={divider} />

          {/* Period rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {periods.map(p => (
              <div key={p.period} style={{ display: 'grid', gridTemplateColumns: '80px 20px 1fr', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>{p.period}</span>
                <span style={{ fontSize: 10, color: 'var(--accent)' }}>{p.icon}</span>
                <span style={{ fontSize: 10, color: '#c8e8ffaa', fontFamily: 'var(--font-mono)' }}>
                  {p.temp}°F&nbsp; {p.label}
                </span>
              </div>
            ))}
          </div>

          {/* Tomorrow row */}
          {tomorrow && (
            <div style={{ borderTop: '1px solid #00d4ff0f', paddingTop: 6, marginTop: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 20px 1fr', alignItems: 'center' }}>
                <span style={{ fontSize: 9, color: 'var(--dim)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>TOMORROW</span>
                <span style={{ fontSize: 10, color: 'var(--accent)' }}>{tomorrow.icon}</span>
                <span style={{ fontSize: 10, color: '#c8e8ffaa', fontFamily: 'var(--font-mono)' }}>
                  High {tomorrow.high}°F&nbsp; Low {tomorrow.low}°F
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── MARKETS zone ─────────────────────────────────────────────────────────────
const TICKERS = [
  { symbol: 'BTC-USD', label: 'BTC',    group: 'crypto' as const },
  { symbol: 'XRP-USD', label: 'XRP',    group: 'crypto' as const },
  { symbol: 'GC=F',    label: 'GOLD',   group: 'metal'  as const },
  { symbol: 'SI=F',    label: 'SILVER', group: 'metal'  as const },
]

type MarketRow = {
  label: string
  group: 'crypto' | 'metal'
  price: number | null
  prevClose: number | null
  error: boolean
}

function MarketsZone() {
  const [rows, setRows]           = useState<MarketRow[]>(
    TICKERS.map(t => ({ label: t.label, group: t.group, price: null, prevClose: null, error: false }))
  )
  const [loading, setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    async function fetchAll() {
      setLoading(true)
      const results = await Promise.all(TICKERS.map(async t => {
        try {
          const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t.symbol}`)
          if (!res.ok) return null
          const json = await res.json() as { chart?: { result?: Array<{ meta?: { regularMarketPrice?: number; previousClose?: number } }> } }
          const meta = json?.chart?.result?.[0]?.meta
          if (!meta?.regularMarketPrice) return null
          return { price: meta.regularMarketPrice, prevClose: meta.previousClose ?? meta.regularMarketPrice }
        } catch { return null }
      }))
      setRows(TICKERS.map((t, i) => ({
        label: t.label, group: t.group,
        price:     results[i]?.price     ?? null,
        prevClose: results[i]?.prevClose ?? null,
        error:     results[i] === null,
      })))
      setLoading(false)
      setLastUpdated(new Date())
    }

    void fetchAll()
    const id = setInterval(() => void fetchAll(), 60_000)
    return () => clearInterval(id)
  }, [])

  function renderDelta(price: number, prevClose: number) {
    const d = ((price - prevClose) / prevClose) * 100
    if (d > 0.005)  return <span style={{ fontSize: 9, letterSpacing: 0.5, color: 'var(--accent2)' }}>▲ +{d.toFixed(2)}%</span>
    if (d < -0.005) return <span style={{ fontSize: 9, letterSpacing: 0.5, color: '#ff4444' }}>▼ {d.toFixed(2)}%</span>
    return               <span style={{ fontSize: 9, letterSpacing: 0.5, color: 'var(--dim)' }}>— {Math.abs(d).toFixed(2)}%</span>
  }

  function renderRow(row: MarketRow) {
    return (
      <div key={row.label} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 8, alignItems: 'center' }}>
        <span style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: 10, color: 'var(--accent2)', letterSpacing: 1 }}>
          {row.label}
        </span>
        {loading ? (
          <>
            <span style={{ fontSize: 10, color: '#c8e8ffcc', fontFamily: 'var(--font-mono)' }}>------</span>
            <span style={{ fontSize: 9,  color: 'var(--dim)', fontFamily: 'var(--font-mono)' }}>......</span>
          </>
        ) : row.error || row.price === null ? (
          <span style={{ fontSize: 9, color: 'var(--dimmer)', fontFamily: 'var(--font-mono)', gridColumn: '2 / -1' }}>// UNAVAILABLE</span>
        ) : (
          <>
            <span style={{ fontSize: 10, color: '#c8e8ffcc', fontFamily: 'var(--font-mono)' }}>{row.price.toFixed(2)}</span>
            {renderDelta(row.price, row.prevClose ?? row.price)}
          </>
        )}
      </div>
    )
  }

  const cryptoRows = rows.filter(r => r.group === 'crypto')
  const metalRows  = rows.filter(r => r.group === 'metal')
  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString('en-US', { hour12: false })
    : '--:--:--'

  return (
    <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ZoneLabel text="// MARKETS" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {cryptoRows.map(renderRow)}
      </div>

      <div style={{ height: 1, background: '#00d4ff12', margin: '4px 0' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {metalRows.map(renderRow)}
      </div>

      <div style={{ marginTop: 8, fontSize: 8, color: 'var(--dimmer)', letterSpacing: 1, fontFamily: 'var(--font-mono)' }}>
        // LAST UPDATED {updatedStr} · REFRESHES EVERY 60s
      </div>
    </div>
  )
}

// ─── QUICK LAUNCH zone ────────────────────────────────────────────────────────
const LAUNCH_APPS = [
  { label: 'VS CODE', path: '/Applications/Visual Studio Code.app' },
  { label: 'BRAVE',   path: '/Applications/Brave Browser.app'      },
]

function LaunchBtn({ label, appPath }: { label: string; appPath: string }) {
  function launch() {
    void window.electronAPI?.openApp(appPath)
  }
  return (
    <button
      onClick={launch}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.color       = 'var(--accent)'
        e.currentTarget.style.background  = 'var(--bg-hover)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'var(--border-md)'
        e.currentTarget.style.color       = 'var(--dim)'
        e.currentTarget.style.background  = 'transparent'
      }}
      style={{
        padding: '6px 14px',
        fontSize: 9, letterSpacing: 2,
        border: '1px solid var(--border-md)',
        color: 'var(--dim)',
        background: 'transparent',
        cursor: 'pointer',
        fontFamily: 'var(--font-mono)',
        transition: 'all 0.15s ease',
      }}
    >
      [ {label} ]
    </button>
  )
}

function QuickLaunchZone() {
  return (
    <div style={{
      gridColumn: '1 / -1',
      borderTop: '1px solid var(--border)',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <ZoneLabel text="// QUICK LAUNCH" />
      {LAUNCH_APPS.map(app => (
        <LaunchBtn key={app.label} label={app.label} appPath={app.path} />
      ))}
    </div>
  )
}

// ─── NodePanel ────────────────────────────────────────────────────────────────
export default function NodePanel() {
  return (
    <div style={{ flex: 1, position: 'relative', background: 'var(--bg)', overflow: 'hidden' }}>
      <GridBg />

      {/* Grid sits above GridBg via z-index */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto 1fr auto',
      }}>
        <WordZone />
        <TimeZone />
        <WeatherZone />
        <MarketsZone />
        <QuickLaunchZone />
      </div>
    </div>
  )
}
