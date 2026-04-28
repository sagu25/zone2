import { ZONE_DISPLAY } from './ZoneInfoModal'

// Zone positions — Z3 top-centre, Z2 bottom-left, Z1 bottom-right
const ZONE_POS = {
  Z3: { cx: 290, cy: 100 },
  Z2: { cx:  90, cy: 235 },
  Z1: { cx: 490, cy: 235 },
}

const ZONE_TIER = { Z1: 'TRENCH', Z2: 'SHELF', Z3: 'REEF' }

// Cyclic pipeline: Observe → Diagnose → Execute → back to Observe
const LINKS = [
  { from:'Z3', to:'Z2', id:'l32' },
  { from:'Z2', to:'Z1', id:'l21' },
  { from:'Z1', to:'Z3', id:'l13' },
]

// Which agents belong to each zone
const ZONE_AGENTS = {
  Z3: ['KORAL','MAREA','TASYA','NEREUS'],
  Z2: ['ECHO','SIMAR','NAVIS','RISKADOR'],
  Z1: ['TRITON','AEGIS','TEMPEST','LEVIER'],
}

function zoneColor(zone, hasActiveAgents) {
  if (hasActiveAgents)
    return { stroke:'#00e87c', fill:'rgba(0,232,124,0.10)', text:'#00e87c', glow:'drop-shadow(0 0 10px rgba(0,232,124,0.5))' }
  if (zone.health === 'FAULT')
    return { stroke:'#ff8c00', fill:'rgba(255,140,0,0.1)', text:'#ffa040', glow:'drop-shadow(0 0 8px rgba(255,140,0,0.5))' }
  return { stroke:'#c8d8e8', fill:'rgba(200,216,232,0.04)', text:'#c8d8e8', glow:'none' }
}

export default function ZoneObservatory({ zones, assets, accessLog, mode, darkMode = true, onZoneClick, activeAgents = {} }) {
  if (!zones) return null

  const svgBg    = '#060b14'
  const dotColor = '#1a2f4e'
  const zoneFill = '#0a1525'

  // Compute which zones have active agents
  const activeAgentNames = Object.keys(activeAgents)
  const activeZones = new Set(
    Object.entries(ZONE_AGENTS)
      .filter(([, agents]) => agents.some(a => activeAgentNames.includes(a)))
      .map(([zone]) => zone)
  )

  return (
    <div className="panel zone-panel">
      <div className="panel-title">
        <span className="dot" />
        Zone Observatory
        <span style={{ marginLeft:'auto', fontSize:'0.5rem', color:'var(--text-dim)', fontFamily:'var(--font-mono)' }}>
          REAL-TIME
        </span>
      </div>

      <div className="zone-svg-wrap">
        <svg viewBox="0 0 580 320" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.7" fill={dotColor} opacity="0.6" />
            </pattern>
            <marker id="arrowWhite" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L6,3 Z" fill="#c8d8e8" />
            </marker>
            <marker id="arrowGreen" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L6,3 Z" fill="#00e87c" />
            </marker>
            <marker id="arrowRed" markerWidth="7" markerHeight="7" refX="5" refY="3" orient="auto">
              <path d="M0,0.5 L0,5.5 L6,3 Z" fill="#ff2d2d" />
            </marker>
          </defs>

          <rect width="580" height="320" fill={svgBg} />
          <rect width="580" height="320" fill="url(#dotGrid)" />

          {/* Interconnecting lines between all 3 zones */}
          {LINKS.map(link => {
            const a = ZONE_POS[link.from], b = ZONE_POS[link.to]
            const dx = b.cx - a.cx, dy = b.cy - a.cy
            const len = Math.sqrt(dx*dx + dy*dy)
            const r = 54
            const x1 = a.cx + (dx/len)*r, y1 = a.cy + (dy/len)*r
            const x2 = b.cx - (dx/len)*r, y2 = b.cy - (dy/len)*r
            const eitherActive = activeZones.has(link.from) || activeZones.has(link.to)
            const stroke = eitherActive ? '#00e87c' : '#c8d8e8'
            const marker = eitherActive ? 'url(#arrowGreen)' : 'url(#arrowWhite)'
            return (
              <line key={link.id} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={stroke} strokeWidth={eitherActive ? 2 : 1.2}
                strokeDasharray="8 5"
                markerEnd={marker}
                style={{
                  strokeOpacity: 0.75,
                  animation: eitherActive ? 'flowDash 0.6s linear infinite' : 'flowDash 1.5s linear infinite',
                  transition: 'stroke 0.4s',
                }}
              />
            )
          })}

          {/* Zone nodes */}
          {Object.values(zones).map(zone => {
            const pos = ZONE_POS[zone.id]
            if (!pos) return null
            const hasActive = activeZones.has(zone.id)
            const col = zoneColor(zone, hasActive)

            return (
              <g key={zone.id}>
                {/* Glow ring */}
                <circle cx={pos.cx} cy={pos.cy} r={63}
                  fill={col.fill}
                  style={{ filter: col.glow, animation: hasActive ? 'subPulse 1.5s ease-in-out infinite' : zone.health === 'FAULT' ? 'subPulse 2s ease-in-out infinite' : 'none' }}
                />
                {/* Zone circle */}
                <circle cx={pos.cx} cy={pos.cy} r={50}
                  fill={zoneFill}
                  stroke={col.stroke}
                  strokeWidth={hasActive ? 2.5 : 1.5}
                  style={{ transition: 'stroke 0.4s, stroke-width 0.4s' }}
                />
                {/* Zone name — clickable */}
                <text x={pos.cx} y={pos.cy - 2} className="zone-id-lbl zone-id-clickable"
                  fill={col.text}
                  onClick={() => onZoneClick?.(zone.id)}
                  style={{ cursor:'pointer', transition:'fill 0.4s' }}>
                  {ZONE_DISPLAY[zone.id] || zone.id}
                </text>
                {/* Zone tier label */}
                <text x={pos.cx} y={pos.cy + 13}
                  style={{ fontFamily:'var(--font-mono)', fontSize:'8px', fill:col.text, textAnchor:'middle', letterSpacing:'0.12em', opacity:0.6, pointerEvents:'none' }}>
                  {ZONE_TIER[zone.id]}
                </text>

                {/* Fault badge */}
                {zone.health === 'FAULT' && !hasActive && (
                  <text x={pos.cx} y={pos.cy + 22} className="zone-hlth" fill="#ffa040" opacity={0.9}>
                    ⚠ FAULT
                  </text>
                )}

                {/* Active badge */}
                {hasActive && (
                  <text x={pos.cx} y={pos.cy + 22} className="zone-hlth" fill="#00e87c" opacity={0.9}>
                    ● ACTIVE
                  </text>
                )}
              </g>
            )
          })}

        </svg>
      </div>
    </div>
  )
}
