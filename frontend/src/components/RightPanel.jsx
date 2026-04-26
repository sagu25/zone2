import { useMemo, useState, useRef, useEffect } from 'react'
import { narrationEngine, narStart, narStop, narTogglePause, narToggleMute } from './LandingPage'

const SRC_META = {
  GATEWAY:    { icon: '⟳', label: 'GATEWAY',    cls: 'ls-gateway' },
  TARE:       { icon: '⚡', label: 'TARE',       cls: 'ls-tare'    },
  ServiceNow: { icon: '■',  label: 'S-NOW',      cls: 'ls-snow'    },
  SUPERVISOR: { icon: '◆',  label: 'SUPERVISOR', cls: 'ls-super'   },
}

const SCENARIOS = [
  {
    label: '🕒 OUT-OF-HOURS', key: 'out_of_hours', threat: 'HIGH',
    title: 'Out-of-Hours High-Impact Attempt',
    what: 'An operator attempts a Zone 1 control action at 02:30 AM with no maintenance window and no emergency flag. Read operations are permitted. The moment a high-impact command is attempted, TASYA validates time context, TARE downgrades and requests supervisor approval.',
    watch: [
      'GET_STATUS and PULL_METRICS allowed — reads are always permitted',
      'OPEN_BREAKER at 02:30 — TASYA flags: no window, no emergency',
      'TARE downgrades. ServiceNow P2 raised. Approve for 15-min emergency window or leave blocked',
    ],
  },
  {
    label: '🔁 REPEATED FAILURES', key: 'repeated_failures', threat: 'HIGH',
    title: 'Repeated Failed Attempts — Unsafe Persistence',
    what: 'An automation agent attempts OPEN_BREAKER on a Zone 1 asset. The action is blocked by a safety interlock. Instead of investigating the failure, the agent retries the same command identically — 3 times. TEMPEST detects unsafe persistence and TARE fires a full FREEZE.',
    watch: [
      'BARRIER blocks OPEN_BREAKER — safety interlock active',
      'Agent retries without adjusting — TEMPEST flags retry pattern on attempt 3',
      'TARE freezes everything. P1 Critical incident raised — automation bug or misuse',
    ],
  },
  {
    label: '🔄 RUNAWAY LOOP', key: 'runaway_loop', threat: 'HIGH',
    title: 'Runaway Loop — Automation Bug',
    what: 'An automation agent enters a runaway loop — firing the same valid command against the same asset at machine speed. Credentials are fine. The individual commands are permitted. But the rate is a denial-of-service risk. TEMPEST detects the loop pattern and TARE applies a SAFETY HOLD — no supervisor input needed.',
    watch: [
      'Each command individually valid — credentials fine, action permitted',
      'TEMPEST detects 5 identical requests on FDR-301 in 5 seconds — loop pattern confirmed',
      'TARE applies SAFETY HOLD automatically. P1 Critical incident auto-created',
    ],
  },
  {
    label: '🚫 READ-ONLY BREACH', key: 'readonly_write', threat: 'HIGH',
    title: 'Read-Only Breach — Identity Policy Violation',
    what: 'A read-only monitoring identity starts normally — fetching status and pulling metrics — then suddenly attempts OPEN_BREAKER, a write operation outside its role. KORAL logs it, TARE checks the identity registry, BARRIER enforces downgrade.',
    watch: [
      'KORAL logs the identity action attempt with action type classification',
      'TARE checks the registry — role is READ_ONLY_MONITOR, write not permitted',
      'BARRIER applies READ_ONLY_DOWNGRADE. ServiceNow P2 incident raised automatically',
    ],
  },
]

const THREAT_COLORS = {
  NONE: '#00e87c', MEDIUM: '#f59e0b', HIGH: '#f43f5e', CRITICAL: '#ff2d2d',
}

export default function RightPanel({
  feedItems, stats, wsConnected, scenarioActive,
  onReset, onOutOfHours, onRepeatedFailures, onRunawayLoop, onReadonlyWrite,
}) {
  const [ddOpen,          setDdOpen]          = useState(false)
  const [pendingScenario, setPendingScenario] = useState(null)
  const ddRef = useRef(null)
  const [narState, setNarState] = useState({
    playing: narrationEngine.playing,
    paused:  narrationEngine.paused,
    muted:   narrationEngine.muted,
  })

  useEffect(() => {
    const sync = () => setNarState({
      playing: narrationEngine.playing,
      paused:  narrationEngine.paused,
      muted:   narrationEngine.muted,
    })
    narrationEngine.listeners.push(sync)
    return () => { narrationEngine.listeners = narrationEngine.listeners.filter(f => f !== sync) }
  }, [])

  const counts = useMemo(() => {
    const c = {}
    feedItems.forEach(f => { c[f.source] = (c[f.source] || 0) + 1 })
    return c
  }, [feedItems])

  const latest = feedItems[0]

  const HANDLERS = {
    out_of_hours:       onOutOfHours,
    repeated_failures:  onRepeatedFailures,
    runaway_loop:       onRunawayLoop,
    readonly_write:     onReadonlyWrite,
  }

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e) { if (ddRef.current && !ddRef.current.contains(e.target)) setDdOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const openBriefing = (scenario) => { setPendingScenario(scenario); setDdOpen(false) }
  const runScenario  = () => {
    if (!pendingScenario) return
    HANDLERS[pendingScenario.key]?.()
    setPendingScenario(null)
  }

  return (
    <div className="panel right-monitor-panel">
      {/* Scenario Briefing Modal */}
      {pendingScenario && (
        <div className="briefing-overlay" onClick={() => setPendingScenario(null)}>
          <div className="briefing-card" onClick={e => e.stopPropagation()}>
            <div className="briefing-top">
              <span className="briefing-label">SCENARIO BRIEFING</span>
              <span
                className="briefing-threat"
                style={{ color: THREAT_COLORS[pendingScenario.threat], borderColor: THREAT_COLORS[pendingScenario.threat] + '55', background: THREAT_COLORS[pendingScenario.threat] + '14' }}
              >
                {pendingScenario.threat}
              </span>
            </div>
            <div className="briefing-title">{pendingScenario.title}</div>
            <p className="briefing-what">{pendingScenario.what}</p>
            <div className="briefing-watch-label">What to watch for</div>
            <ul className="briefing-watch-list">
              {pendingScenario.watch.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
            <div className="briefing-actions">
              <button className="briefing-cancel" onClick={() => setPendingScenario(null)}>Cancel</button>
              <button className="briefing-run" onClick={runScenario}>
                ▶ Run Scenario
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="panel-title">
        <span style={{ color:'var(--text-secondary)' }}>■</span>&nbsp;Live Event Monitor
      </div>

      {/* Source chips — 2 rows × 3 cols */}
      <div className="ls-source-grid">
        {Object.entries(SRC_META).map(([src, meta]) => (
          <span key={src} className={`ls-chip ${meta.cls}`}>
            <span className="ls-icon">{meta.icon}</span>
            <span className="ls-label">{meta.label}</span>
            <span className="ls-num">{counts[src] || 0}</span>
          </span>
        ))}
      </div>

      {/* Session stats */}
      {stats && (
        <div className="ls-session-stats">
          <span className="ls-stat-chip ls-sc-total"><b>{stats.total ?? 0}</b><span>CMDS</span></span>
          <span className="ls-stat-chip ls-sc-allow"><b>{stats.allowed ?? 0}</b><span>ALLOW</span></span>
          <span className="ls-stat-chip ls-sc-deny" ><b>{stats.denied ?? 0}</b><span>DENY</span></span>
          <span className="ls-stat-chip ls-sc-frz"  ><b>{stats.freeze_events ?? 0}</b><span>FRZ</span></span>
        </div>
      )}

      {/* Latest event */}
      <div className="ls-latest-wrap">
        <span className="ls-latest-label">LATEST</span>
        {latest ? (
          <div className="ls-latest">
            <span className="ls-latest-src">{latest.source}</span>
            <span className="ls-latest-msg">{latest.message}</span>
          </div>
        ) : (
          <div className="ls-latest"><span className="ls-latest-msg ls-dim">Awaiting events…</span></div>
        )}
      </div>

      <div style={{ flex:1 }} />

      {/* Narration controls */}
      <div className="rp-narration">
        <span className="rp-nar-label">🔈 NARRATION</span>
        <div className="rp-nar-btns">
          {!narState.playing && (
            <button className="rp-nar-btn" onClick={() => narStart(narrationEngine.index)} title="Start / Resume narration">▶ Start</button>
          )}
          {narState.playing && (
            <button className="rp-nar-btn" onClick={narTogglePause} title={narState.paused ? 'Resume' : 'Pause'}>
              {narState.paused ? '▶' : '⏸'}
            </button>
          )}
          {narState.playing && (
            <button className="rp-nar-btn rp-nar-stop" onClick={narStop} title="Stop">■</button>
          )}
          <button className={`rp-nar-btn ${narState.muted ? 'rp-nar-muted' : ''}`} onClick={narToggleMute} title={narState.muted ? 'Unmute' : 'Mute'}>
            {narState.muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Scenario dropdown + Reset */}
      <div className="rp-actions">

        {/* Scenarios dropdown */}
        <div className="rp-dd-wrap" ref={ddRef}>
          <button
            className={`rp-btn rp-btn-scenario ${ddOpen ? 'rp-btn-scenario-open' : ''}`}
            disabled={!wsConnected || scenarioActive}
            onClick={() => setDdOpen(o => !o)}
            title={scenarioActive ? 'Scenario running — Reset to stop' : 'Select a scenario'}
          >
            {scenarioActive ? '⏳ Running…' : `▶ Scenarios ${ddOpen ? '▲' : '▼'}`}
          </button>

          {ddOpen && (
            <div className="rp-dd-menu">
              {SCENARIOS.map(s => (
                <button
                  key={s.key}
                  className="rp-dd-item"
                  onClick={() => openBriefing(s)}
                >
                  {s.label}
                  <span className="rp-dd-desc">{s.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reset */}
        <button className="rp-btn rp-btn-reset" onClick={onReset} disabled={!wsConnected}>
          ↺ Reset
        </button>
      </div>
    </div>
  )
}

export function LiveStatsBar() { return <div /> }
