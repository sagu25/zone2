import { useState } from 'react'

export const ZONE_DISPLAY = { Z1: 'Zone 1', Z2: 'Zone 2', Z3: 'Zone 3' }

const ALL_AGENTS = {
  // Z3 — Observability layer
  KORAL: {
    name: 'KORAL',
    role: 'Telemetry Observer',
    color: '#00d4ff',
    icon: '📡',
    desc: 'Continuously collects telemetry, logs, and signals across systems without interpretation or action. Provides a trusted baseline of "what is happening" for all higher-level analysis.',
  },
  MAREA: {
    name: 'MAREA',
    role: 'Drift Analyst',
    color: '#f59e0b',
    icon: '🌊',
    desc: 'Analyses telemetry over time to detect behavioural drift — scope creep, tempo changes, or unusual patterns. Focuses on trends and deviations, not single events.',
  },
  TASYA: {
    name: 'TASYA',
    role: 'Context Correlator',
    color: '#a855f7',
    icon: '🔗',
    desc: 'Correlates observed behaviour with operational context — incidents, maintenance windows, or known events. Determines whether observed actions make sense given the current situation.',
  },
  NEREUS: {
    name: 'NEREUS',
    role: 'Recommendation Agent',
    color: '#00e87c',
    icon: '🧠',
    desc: 'Synthesises drift and context into clear, human-readable recommendations. Never executes actions — only advises TARE on possible next steps.',
  },
  // Z2 — Planning layer
  ECHO: {
    name: 'ECHO',
    role: 'Diagnostics Agent',
    color: '#38bdf8',
    icon: '🔬',
    desc: 'Validates fault zones and target assets before any plan is built. Ensures the agent is working on the right problem in the right place.',
  },
  SIMAR: {
    name: 'SIMAR',
    role: 'Simulation Agent',
    color: '#fb923c',
    icon: '🔭',
    desc: 'Simulates proposed changes against a digital twin of the grid without touching live state. Catches unsafe actions before they become real commands.',
  },
  NAVIS: {
    name: 'NAVIS',
    role: 'Change Planner',
    color: '#4ade80',
    icon: '🗺',
    desc: 'Builds NERC CIP-compliant execution plans from simulation results. Produces step-by-step action sequences that TARE can approve and TRITON can execute.',
  },
  RISKADOR: {
    name: 'RISKADOR',
    role: 'Risk Scoring Agent',
    color: '#facc15',
    icon: '⚖',
    desc: 'Scores each plan for blast radius, reversibility, and downstream risk. High-risk plans are escalated to human review before any action is taken.',
  },
  // Z1 — Execution layer
  TRITON: {
    name: 'TRITON',
    role: 'Execution Agent',
    color: '#f43f5e',
    icon: '⚡',
    desc: 'Executes TARE-approved steps only. Never self-authorises a command. Every action is gated by TARE and subject to AEGIS veto before it reaches a physical asset.',
  },
  AEGIS: {
    name: 'AEGIS',
    role: 'Safety Validator',
    color: '#e879f9',
    icon: '🛡',
    desc: 'Enforces NERC CIP safety interlocks at execution time. Can veto any step TRITON is about to take, regardless of prior approvals, if a safety condition is violated.',
  },
  TEMPEST: {
    name: 'TEMPEST',
    role: 'Session & Tempo Monitor',
    color: '#67e8f9',
    icon: '🌪',
    desc: 'Monitors execution pace in real time. If commands arrive too fast or out of expected sequence, TEMPEST can trigger an immediate freeze mid-operation.',
  },
  LEVIER: {
    name: 'LEVIER',
    role: 'Rollback & Recovery',
    color: '#86efac',
    icon: '↩',
    desc: 'Reverts executed steps if TRITON fails or AEGIS vetoes mid-sequence. Ensures the grid is never left in a partial or unsafe state after an interrupted operation.',
  },
}

const ZONE_AGENTS = {
  Z3: ['KORAL', 'MAREA', 'TASYA', 'NEREUS'],
  Z2: ['ECHO', 'SIMAR', 'NAVIS', 'RISKADOR'],
  Z1: ['TRITON', 'AEGIS', 'TEMPEST', 'LEVIER'],
}

export const ZONE_INFO = {
  Z1: {
    display:     'Zone 1 — Trench',
    region:      'Execute with Safety',
    type:        'EXECUTION LAYER',
    typeColor:   '#ff4d6d',
    description: 'TRITON, AEGIS, TEMPEST and LEVIER operate in the execution layer. TRITON is the only agent that touches physical assets — and only on TARE-issued permits. AEGIS holds full veto authority over every step. TEMPEST halts on unsafe pace or retry patterns. LEVIER reverts partial execution cleanly if anything is aborted.',
    assets: [
      { id: 'BRK-110', type: 'Circuit Breaker',   role: 'Physical isolation point for this grid section. TRITON can only open or close it with an AEGIS-cleared permit. No step executes without prior TARE authorisation.' },
      { id: 'FDR-110', type: 'Feeder Controller', role: 'Regulates real-time power flow for connected assets. Every controller action is logged by KORAL, validated by AEGIS, and reversible by LEVIER.' },
    ],
  },
  Z2: {
    display:     'Zone 2 — Shelf',
    region:      'Diagnose & Prepare',
    type:        'PLANNING LAYER',
    typeColor:   '#ff9a3c',
    description: 'ECHO, SIMAR, NAVIS and RISKADOR operate in the planning layer. ECHO confirms the fault is real and identifies the affected assets. SIMAR runs the proposed repair in a digital twin — nothing touches live state. NAVIS builds a NERC CIP-compliant execution plan. RISKADOR scores the plan for blast radius and reversibility before any action is approved.',
    assets: [
      { id: 'BRK-205', type: 'Circuit Breaker',   role: 'Validated and simulated by ECHO and SIMAR before any plan reaches Zone 1. NAVIS includes this asset in the execution sequence only if the simulation confirms safety.' },
      { id: 'FDR-205', type: 'Feeder Controller', role: 'RISKADOR scores any action on this controller for downstream risk. High-risk steps are escalated for human review before the plan is handed to Zone 1.' },
    ],
  },
  Z3: {
    display:     'Zone 3 — Reef',
    region:      'Observe & Recommend',
    type:        'OBSERVABILITY LAYER',
    typeColor:   '#00d4ff',
    description: 'KORAL, MAREA, TASYA and NEREUS operate in the observation layer. KORAL records every command and timestamp — the raw evidence all other agents rely on. MAREA detects drift in behaviour patterns. TASYA correlates signals with operational context. NEREUS synthesises findings into a clear recommendation for TARE — and never issues a command itself.',
    assets: [
      { id: 'BRK-301', type: 'Circuit Breaker',   role: 'KORAL tracks every command issued against this breaker. MAREA flags anomalies in the command pattern. All telemetry from this asset feeds the full 12-agent analysis chain.' },
      { id: 'FDR-301', type: 'Feeder Controller', role: 'Real-time metrics from this controller are ingested by KORAL, analysed by MAREA and TASYA, and used by NEREUS to build its situational recommendation.' },
    ],
  },
}

export function ZoneIllustration({ zoneId, color }) {
  if (zoneId === 'Z1') return (
    <svg viewBox="0 0 160 100" width="140" height="88">
      <rect x="28" y="32" width="104" height="64" fill="none" stroke={color} strokeWidth="2.5" rx="2"/>
      <rect x="68" y="10" width="24" height="52" fill="none" stroke={color} strokeWidth="2.5" rx="2"/>
      <rect x="52" y="24" width="56" height="24" fill="none" stroke={color} strokeWidth="2.5" rx="2"/>
      <line x1="80" y1="18" x2="80" y2="40" stroke={color} strokeWidth="3" opacity="0.8"/>
      <line x1="68" y1="30" x2="92" y2="30" stroke={color} strokeWidth="3" opacity="0.8"/>
      <rect x="68" y="72" width="24" height="24" fill="none" stroke={color} strokeWidth="2"/>
      <rect x="36" y="44" width="14" height="12" fill="none" stroke={color} strokeWidth="1.5" rx="1"/>
      <rect x="110" y="44" width="14" height="12" fill="none" stroke={color} strokeWidth="1.5" rx="1"/>
      <line x1="5" y1="96" x2="155" y2="96" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    </svg>
  )
  if (zoneId === 'Z2') return (
    <svg viewBox="0 0 160 100" width="140" height="88">
      <rect x="58" y="14" width="28" height="82" fill="none" stroke={color} strokeWidth="2.5" rx="1"/>
      <line x1="72" y1="14" x2="72" y2="6" stroke={color} strokeWidth="1.5"/>
      <circle cx="72" cy="5" r="2" fill={color}/>
      <rect x="18" y="38" width="36" height="58" fill="none" stroke={color} strokeWidth="2" rx="1"/>
      <rect x="90" y="28" width="38" height="68" fill="none" stroke={color} strokeWidth="2" rx="1"/>
      <line x1="5" y1="96" x2="155" y2="96" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    </svg>
  )
  return (
    <svg viewBox="0 0 160 100" width="140" height="88">
      <rect x="20" y="52" width="120" height="44" fill="none" stroke={color} strokeWidth="2.5" rx="2"/>
      <rect x="32" y="24" width="14" height="30" fill="none" stroke={color} strokeWidth="2"/>
      <rect x="57" y="12" width="14" height="42" fill="none" stroke={color} strokeWidth="2"/>
      <rect x="82" y="18" width="14" height="36" fill="none" stroke={color} strokeWidth="2"/>
      <circle cx="39" cy="20" r="5" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <circle cx="64" cy="8"  r="5" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <circle cx="89" cy="14" r="5" fill="none" stroke={color} strokeWidth="1.5" opacity="0.5"/>
      <rect x="67" y="72" width="16" height="24" fill="none" stroke={color} strokeWidth="2"/>
      <line x1="5" y1="96" x2="155" y2="96" stroke={color} strokeWidth="1.5" opacity="0.4"/>
    </svg>
  )
}

export default function ZoneInfoModal({ zoneId, zones, assets, activeAgents = {}, onClose }) {
  const [hoveredAgent, setHoveredAgent] = useState(null)
  if (!zoneId) return null
  const info    = ZONE_INFO[zoneId]
  if (!info) return null
  const zState  = zones?.[zoneId] || {}
  const isFault = zState.health === 'FAULT'
  const faultMsg = zState.fault || null
  const zoneAgentKeys = ZONE_AGENTS[zoneId] || []
  const activeAgentNames = Object.keys(activeAgents)

  return (
    <div className="zone-modal-overlay" onClick={onClose}>
      <div className="zone-modal-1col" onClick={e => e.stopPropagation()}>

        {/* ── ZONE OVERVIEW ───────────────────────────────── */}
        <div className="zm3-col zm3-overview">
          <div className="zm3-col-header">
            Zone Overview
            <button className="zm3-close" onClick={onClose}>✕</button>
          </div>
          <div className="zm3-overview-body">

            {/* Illustration + name */}
            <div className="zm3-hero">
              <div className="zm3-illus" style={{ borderColor: info.typeColor + '44', background: info.typeColor + '0d' }}>
                <ZoneIllustration zoneId={zoneId} color={info.typeColor} />
              </div>
              <div className="zm3-hero-text">
                <div className="zm3-zone-name">{info.display}</div>
                <span className="zm3-type-badge" style={{ color: info.typeColor, borderColor: info.typeColor + '80', background: info.typeColor + '18' }}>
                  {info.type}
                </span>
              </div>
            </div>

            {/* Fault alert */}
            {isFault && faultMsg && (
              <div className="zm3-fault-alert">
                <div className="zm3-fault-title">⚡ Active Fault Detected</div>
                <div className="zm3-fault-msg">{faultMsg}</div>
                <div className="zm3-fault-detail">
                  The AI agent has been tasked to investigate and restore this zone.
                  TARE is monitoring all commands issued against this zone in real time.
                </div>
              </div>
            )}

            {/* Description */}
            <div className="zm3-section-label">What is this zone?</div>
            <p className="zm3-desc">{info.description}</p>

            {/* Agent chips — 2 per row */}
            {zoneAgentKeys.length > 0 && (
              <div className="zm3-agents-section">
                <div className="zm3-section-label zm3-agents-label">Active Agents</div>
                <div className="zm3-agent-chips">
                  {zoneAgentKeys.map(key => {
                    const ag = ALL_AGENTS[key]
                    if (!ag) return null
                    const isActive = activeAgentNames.includes(key)
                    return (
                      <div
                        key={key}
                        className={`zm3-agent-chip${isActive ? ' zm3-agent-chip-active' : ''}`}
                        style={{
                          borderColor: isActive ? ag.color : ag.color + '60',
                          background: isActive ? ag.color + '22' : ag.color + '12',
                          boxShadow: isActive ? `0 0 10px ${ag.color}44` : 'none',
                        }}
                        onMouseEnter={() => setHoveredAgent(key)}
                        onMouseLeave={() => setHoveredAgent(null)}
                      >
                        <span className="zm3-agent-icon">{ag.icon}</span>
                        <div className="zm3-agent-info">
                          <span className="zm3-agent-name" style={{ color: ag.color }}>{ag.name}</span>
                          <span className="zm3-agent-role">{ag.role}</span>
                        </div>
                        {isActive && (
                          <span className="zm3-agent-active-badge">ACTIVE</span>
                        )}
                        {hoveredAgent === key && (
                          <div className="zm3-agent-tooltip">
                            <div className="zm3-tooltip-name" style={{ color: ag.color }}>{ag.icon} {ag.name}</div>
                            <div className="zm3-tooltip-desc">{ag.desc}</div>
                            {isActive && activeAgents[key]?.task && (
                              <div className="zm3-tooltip-task">▶ {activeAgents[key].task}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
