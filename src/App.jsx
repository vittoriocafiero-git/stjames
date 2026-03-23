import { useState, useEffect, useRef } from 'react'
import { Beer, AlertTriangle, RefreshCw, Train, Users } from 'lucide-react'

// ─── Constants ────────────────────────────────────────────────────────────────
const NAPTAN_ID     = '940GZZLUPCC'
const ARRIVALS_URL  = `https://api.tfl.gov.uk/StopPoint/${NAPTAN_ID}/Arrivals`
const CROWDING_URL  = (dayType) => `https://api.tfl.gov.uk/crowding/${NAPTAN_ID}/${dayType}`
const REFRESH_MS    = 30_000
const BEER_BUFFER_S = 600   // 10 minutes

const DAY_TYPES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatClock(date) {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

function minsLabel(timeToStation) {
  if (timeToStation <= 30)  return 'DUE'
  const mins = Math.floor(timeToStation / 60)
  return mins === 0 ? 'DUE' : `${mins} min`
}

function crowdColor(pct) {
  if (pct >= 80) return '#ff4400'
  if (pct >= 55) return '#ffaa00'
  return '#008200'
}

function crowdLabel(pct) {
  if (pct >= 80) return 'PACKED'
  if (pct >= 55) return 'BUSY'
  if (pct >= 30) return 'MODERATE'
  return 'QUIET'
}

function truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeaderBar({ clock, crowding }) {
  return (
    <div className="flex items-center justify-between px-6 py-3 header-line">
      {/* Station name */}
      <div className="flex flex-col">
        <div style={{ fontSize: '3rem', letterSpacing: '0.15em', color: '#008200' }}>
          PICCADILLY CIRCUS
        </div>
        <div style={{ fontSize: '1.3rem', letterSpacing: '0.4em', color: '#005500' }}>
          UNDERGROUND DEPARTURES
        </div>
      </div>

      {/* Crowding indicator — always visible */}
      <CrowdingPanel crowding={crowding} />

      {/* Clock */}
      <div className="flex flex-col items-end">
        <div style={{ fontSize: '2.8rem', letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums', color: '#008200' }}>
          {clock}
        </div>
        <div style={{ fontSize: '1.2rem', letterSpacing: '0.2em', color: '#005500' }}>
          LONDON, UK
        </div>
      </div>
    </div>
  )
}

function CrowdingPanel({ crowding }) {
  const hasData = crowding !== null
  const color   = hasData ? crowdColor(crowding) : '#004000'
  const label   = hasData ? crowdLabel(crowding) : 'NO DATA'

  return (
    <div
      style={{
        border: `1px solid ${color}`,
        padding: '8px 16px',
        minWidth: '260px',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        background: 'rgba(0,130,0,0.04)',
      }}
    >
      <div className="flex items-center gap-2" style={{ color: '#005500', fontSize: '1.1rem', letterSpacing: '0.2em' }}>
        <Users size={14} style={{ color: '#005500' }} />
        STATION CROWDING
      </div>
      <div className="flex items-center gap-3">
        <div
          style={{
            flex: 1,
            height: '10px',
            background: '#001a00',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          {hasData && (
            <div
              style={{
                width: `${crowding}%`,
                height: '100%',
                background: color,
                borderRadius: '2px',
                transition: 'width 0.5s ease',
              }}
            />
          )}
        </div>
        <div style={{ fontSize: '1.8rem', color, minWidth: '90px', letterSpacing: '0.1em' }}>
          {label}
        </div>
      </div>
      {hasData && crowding > 0 && (
        <div style={{ fontSize: '1rem', color: '#003300', letterSpacing: '0.05em' }}>
          {crowding}% of peak capacity
        </div>
      )}
    </div>
  )
}

function ColumnHeader() {
  const cellStyle = {
    fontSize: '1.5rem',
    letterSpacing: '0.25em',
    color: '#005500',
    paddingBottom: '6px',
  }
  return (
    <div
      className="grid gap-2 px-6 py-2 header-line"
      style={{ gridTemplateColumns: '7rem 2fr 7rem 1fr 8rem' }}
    >
      <div style={cellStyle}>DEPARTS</div>
      <div style={cellStyle}>DESTINATION</div>
      <div style={cellStyle}>LINE</div>
      <div style={cellStyle}>PLATFORM</div>
      <div style={cellStyle}>EXPT</div>
    </div>
  )
}

function CrowdingBar({ pct, label }) {
  const color = crowdColor(pct)
  return (
    <div className="flex items-center gap-2">
      <Users size={12} style={{ color, flexShrink: 0 }} />
      <div className="crowd-bar-bg flex-1" style={{ minWidth: '60px' }}>
        <div
          className="crowd-bar-fill"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 4px ${color}` }}
        />
      </div>
      <span style={{ fontSize: '1rem', color, minWidth: '64px' }}>{label}</span>
    </div>
  )
}

function DepartureRow({ arrival, crowdingPct, index }) {
  const { timeToStation, expectedArrival, destinationName, platformName, lineName } = arrival
  const isBeer  = timeToStation > BEER_BUFFER_S
  const isDue   = timeToStation <= 30
  const mins    = minsLabel(timeToStation)
  const depTime = new Date(expectedArrival)
  const depStr  = `${pad2(depTime.getHours())}:${pad2(depTime.getMinutes())}`

  const rowStyle = {
    gridTemplateColumns: '7rem 2fr 7rem 1fr 8rem',
    borderBottom: '1px solid #001a00',
    padding: '10px 24px',
    background: isBeer
      ? 'rgba(0,130,0,0.05)'
      : index % 2 === 0 ? 'transparent' : 'rgba(0,130,0,0.02)',
  }

  const textSize = { fontSize: '1.9rem', lineHeight: 1.1 }
  const dimColor = { color: '#005500' }

  return (
    <div
      className={`grid gap-2 items-center ${isBeer ? 'beer-row' : ''}`}
      style={rowStyle}
    >
      {/* Departs */}
      <div className="glow" style={textSize}>{depStr}</div>

      {/* Destination */}
      <div className="glow" style={{ ...textSize, letterSpacing: '0.05em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {destinationName}
      </div>

      {/* Line */}
      <div style={{ ...textSize, ...dimColor, fontSize: '1.5rem' }}>
        {truncate(lineName || '—', 8)}
      </div>

      {/* Platform */}
      <div style={{ ...textSize, ...dimColor, whiteSpace: 'nowrap' }}>
        {platformName || '—'}
      </div>

      {/* Expected + beer */}
      <div className="flex items-center gap-2">
        <div
          className={isDue ? 'glow-bright blink' : 'glow'}
          style={{ ...textSize, color: isDue ? '#00ff00' : '#008200', minWidth: '5rem' }}
        >
          {mins}
        </div>
        {isBeer && (
          <div title="Time for another pint!" style={{ color: '#008200', opacity: 0.85 }}>
            <Beer size={22} />
          </div>
        )}
      </div>
    </div>
  )
}

function ErrorScreen({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 screen-on">
      <AlertTriangle size={60} style={{ color: '#008200' }} className="glow" />
      <div className="glow" style={{ fontSize: '3rem', letterSpacing: '0.2em' }}>
        SERVICE TEMPORARILY UNAVAILABLE
      </div>
      <div className="glow-dim" style={{ fontSize: '1.6rem', color: '#005500', maxWidth: '60ch', textAlign: 'center' }}>
        {message}
      </div>
      <div className="glow-dim" style={{ fontSize: '1.3rem', color: '#004000', letterSpacing: '0.15em' }}>
        PLEASE CONTACT YOUR NEAREST MEMBER OF STAFF
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 screen-on">
      <RefreshCw size={48} className="glow" style={{ animation: 'spin 1.2s linear infinite', color: '#008200' }} />
      <div className="glow" style={{ fontSize: '2.5rem', letterSpacing: '0.3em' }}>
        CONNECTING TO TFL NETWORK…
      </div>
    </div>
  )
}

function Footer() {
  return (
    <div
      className="px-4 py-2 header-line flex items-center gap-3"
      style={{ borderTop: '2px solid #003300', borderBottom: 'none', overflow: 'hidden' }}
    >
      <Beer size={18} style={{ color: '#008200', flexShrink: 0 }} className="glow" />
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div
          className="marquee-text glow-dim"
          style={{ fontSize: '1.4rem', letterSpacing: '0.12em', color: '#005500' }}
        >
          🍺&nbsp; TIME FOR ONE MORE?&nbsp;&nbsp;•&nbsp;&nbsp;PLEASE DRINK RESPONSIBLY&nbsp;&nbsp;•&nbsp;&nbsp;
          A 🍺 ICON MEANS YOUR NEXT TRAIN IS MORE THAN 10 MINUTES AWAY — PLENTY OF TIME FOR ANOTHER PINT AT THE LOCAL&nbsp;&nbsp;•&nbsp;&nbsp;
          PICCADILLY CIRCUS PUB BOARD — LONDON UNDERGROUND&nbsp;&nbsp;•&nbsp;&nbsp;
          ENJOY RESPONSIBLY. DRINKAWARE.CO.UK&nbsp;&nbsp;•&nbsp;&nbsp;
        </div>
      </div>
      <Beer size={18} style={{ color: '#008200', flexShrink: 0 }} className="glow" />
    </div>
  )
}

function StatusBar({ lastUpdated, nextRefreshIn, totalTrains }) {
  return (
    <div
      className="flex items-center justify-between px-6 py-1"
      style={{ borderTop: '1px solid #001a00', fontSize: '1.2rem', color: '#003300' }}
    >
      <span>
        <Train size={12} style={{ display: 'inline', marginRight: 4 }} />
        {totalTrains} service{totalTrains !== 1 ? 's' : ''} displayed
      </span>
      <span>
        UPDATED: {lastUpdated ? formatClock(lastUpdated) : '—'}
      </span>
      <span>
        NEXT REFRESH IN {nextRefreshIn}s
      </span>
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [clock, setClock]           = useState(formatClock(new Date()))
  const [arrivals, setArrivals]     = useState([])
  const [crowding, setCrowding]     = useState(null)   // { hour -> pct }
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [countdown, setCountdown]   = useState(REFRESH_MS / 1000)

  const countdownRef = useRef(REFRESH_MS / 1000)

  // ── Clock tick ──
  useEffect(() => {
    const id = setInterval(() => {
      setClock(formatClock(new Date()))
      countdownRef.current -= 1
      setCountdown(c => (c <= 1 ? REFRESH_MS / 1000 : c - 1))
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Fetch arrivals ──
  async function fetchArrivals() {
    try {
      const res = await fetch(ARRIVALS_URL)
      if (!res.ok) throw new Error(`TfL API responded with ${res.status}`)
      const data = await res.json()
      if (!Array.isArray(data)) throw new Error('Unexpected API response format')

      // Sort by timeToStation, cap at 12 rows
      const sorted = [...data]
        .sort((a, b) => a.timeToStation - b.timeToStation)
        .slice(0, 10)

      setArrivals(sorted)
      setLastUpdated(new Date())
      setError(null)
    } catch (err) {
      setError(err.message || 'Unable to reach TfL service.')
    } finally {
      setLoading(false)
    }
  }

  // ── Fetch crowding ──
  // TfL response: { timeBands: [{ timeBand: "HH:MM-HH:MM", percentageOfBaseLine: N }], isFound, isAlwaysQuiet }
  // Bands are 15-minute intervals. Field is "percentageOfBaseLine" (capital L).
  async function fetchCrowding() {
    try {
      const now     = new Date()
      const dayType = DAY_TYPES[now.getDay()]
      const res     = await fetch(CROWDING_URL(dayType))
      if (!res.ok) return
      const data    = await res.json()

      if (!data?.timeBands || !Array.isArray(data.timeBands)) return

      // Match current 15-min band e.g. "08:15-08:30"
      const h   = pad2(now.getHours())
      const m   = pad2(Math.floor(now.getMinutes() / 15) * 15)
      const key = `${h}:${m}`
      const band =
        data.timeBands.find(b => b.timeBand?.startsWith(key)) ||
        data.timeBands[0]

      const pct = band?.percentageOfBaseLine
      // Always set — even 0 is valid data (station is quiet / no congestion recorded)
      if (typeof pct === 'number') setCrowding(Math.round(pct))
    } catch {
      // crowding is informational — do not set error state
    }
  }

  // ── Initial + interval fetch ──
  useEffect(() => {
    fetchArrivals()
    fetchCrowding()

    const id = setInterval(() => {
      setCountdown(REFRESH_MS / 1000)
      fetchArrivals()
      fetchCrowding()
    }, REFRESH_MS)

    return () => clearInterval(id)
  }, [])

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className="screen-on"
      style={{
        width: '100vw',
        height: '100vh',
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'VT323', monospace",
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* CRT effects */}
      <div className="crt-overlay" />
      <div className="crt-vignette" />

      {/* Header */}
      <HeaderBar clock={clock} crowding={crowding} />

      {/* Main content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <LoadingScreen />
        ) : error ? (
          <ErrorScreen message={error} />
        ) : arrivals.length === 0 ? (
          <ErrorScreen message="No services currently scheduled at this station. Please check for service updates." />
        ) : (
          <>
            <ColumnHeader />

            {/* Departures list */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {arrivals.map((arr, i) => (
                <DepartureRow
                  key={arr.id || i}
                  arrival={arr}
                  crowdingPct={crowding}
                  index={i}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Status bar */}
      {!loading && !error && (
        <StatusBar
          lastUpdated={lastUpdated}
          nextRefreshIn={countdown}
          totalTrains={arrivals.length}
        />
      )}

      {/* Footer marquee */}
      <Footer />

      {/* Spin keyframe for loading icon */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
