import { useState, useEffect, useRef, useCallback } from 'react'
import { speakAgent, setVoiceMuted, isVoiceMuted, clearVoiceQueue } from './agentVoices'
import Header          from './components/Header'
import NarrativeBanner from './components/NarrativeBanner'
import ZoneObservatory from './components/ZoneObservatory'
import LeftPanel       from './components/LeftPanel'
import RightPanel      from './components/RightPanel'
import BottomTabs      from './components/BottomTabs'
import ZoneInfoModal   from './components/ZoneInfoModal'
import LandingPage     from './components/LandingPage'
import NarrationBar    from './components/NarrationBar'

const WS_URL = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`

const INITIAL_STATE = {
  mode:           'NORMAL',
  previous_mode:  null,
  mode_changed_at:null,
  zones:  {
    Z1: { id:'Z1', name:'Zone 1 — Trench', health:'HEALTHY', fault:null, color:'green' },
    Z2: { id:'Z2', name:'Zone 2 — Shelf',  health:'HEALTHY', fault:null, color:'green' },
    Z3: { id:'Z3', name:'Zone 3 — Reef',   health:'FAULT',   fault:'Voltage fluctuation — feeder instability detected', color:'red' },
  },
  assets: {
    'BRK-301':{ id:'BRK-301', type:'BREAKER', zone:'Z3', state:'CLOSED',  description:'Main Circuit Breaker Z3' },
    'FDR-301':{ id:'FDR-301', type:'FEEDER',  zone:'Z3', state:'RUNNING', description:'Feeder Controller Z3' },
    'BRK-205':{ id:'BRK-205', type:'BREAKER', zone:'Z2', state:'CLOSED',  description:'Main Circuit Breaker Z2' },
    'FDR-205':{ id:'FDR-205', type:'FEEDER',  zone:'Z2', state:'RUNNING', description:'Feeder Controller Z2' },
    'BRK-110':{ id:'BRK-110', type:'BREAKER', zone:'Z1', state:'CLOSED',  description:'Main Circuit Breaker Z1' },
    'FDR-110':{ id:'FDR-110', type:'FEEDER',  zone:'Z1', state:'RUNNING', description:'Feeder Controller Z1' },
  },
  agent: {
    id:'OP-GRID-7749', name:'GridOperator-Agent', role:'GRID_OPERATOR',
    clearance:'LEVEL_3', department:'Grid Operations', rbac_zones:['Z3'],
    status:'ACTIVE', action_count:0, last_command:null, last_result:null,
  },
  gateway_log:      [],
  zone_access_log:  [],
  anomaly_signals:  [],
  anomaly_score:    0,
  active_incident:  null,
  stats:            { total:0, allowed:0, denied:0, freeze_events:0 },
  timebox_remaining:null,
  timebox_total:    0,
}

let feedId = 0
function mkFeed(level, source, message) {
  return { id: ++feedId, level, source, message, ts: new Date().toISOString() }
}

export default function App() {
  const [snap,           setSnap]           = useState(INITIAL_STATE)
  const [chatMsgs,       setChatMsgs]       = useState([])
  const [feedItems,      setFeedItems]      = useState([])
  const [wsConnected,    setWsConnected]    = useState(false)
  const [showApprove,    setShowApprove]    = useState(false)
  const [approveType,    setApproveType]    = useState('default') // 'ooh' | 'default'
  const [showFlash,      setShowFlash]      = useState(false)
  const [darkMode,       setDarkMode]       = useState(() => localStorage.getItem('tare-theme') !== 'light')
  const [zoneModal,      setZoneModal]      = useState(null)
  const [scenarioActive, setScenarioActive] = useState(false)
  const [showLanding,    setShowLanding]    = useState(true)
  // ── Agent state ──────────────────────────────────────────────────
  const [agentStates,    setAgentStates]    = useState({})
  const [activeAgents,   setActiveAgents]   = useState({})
  const [agentLog,       setAgentLog]       = useState([])
  const [pipelineLog,    setPipelineLog]    = useState([])
  const [scenarioCtx,    setScenarioCtx]    = useState(null)
  const [scenarioOutcome,setScenarioOutcome]= useState(null)
  const [agentVoices,    setAgentVoices]    = useState({})
  const [voiceMuted,     setVoiceMuted_]    = useState(false)
  const wsRef         = useRef(null)
  const prevModeRef   = useRef('NORMAL')
  const firstConnRef  = useRef(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light')
    localStorage.setItem('tare-theme', darkMode ? 'dark' : 'light')
  }, [darkMode])

  const addFeed = useCallback((level, source, message) => {
    setFeedItems(prev => [mkFeed(level, source, message), ...prev].slice(0, 300))
  }, [])

  const handleMsg = useCallback((msg) => {
    switch (msg.type) {
      case 'STATE_SNAPSHOT':
        setSnap(msg)
        if (msg.agent_states) setAgentStates(msg.agent_states)
        break
      case 'SCENARIO_START':
        setScenarioCtx(msg)
        setScenarioOutcome(null)
        setAgentVoices({})
        setActiveAgents({}); setAgentLog([]); setPipelineLog([])
        break
      case 'AGENT_VOICE':
        setAgentVoices(prev => ({ ...prev, [msg.agent]: msg.message }))
        speakAgent(msg.agent, msg.message)
        break
      case 'SCENARIO_END':
        setScenarioOutcome(msg)
        setScenarioActive(false)
        break
      case 'RESET':
        setSnap(INITIAL_STATE); setChatMsgs([]); setFeedItems([])
        setShowApprove(false); setScenarioActive(false)
        setActiveAgents({}); setAgentLog([]); setPipelineLog([])
        setScenarioCtx(null)
        setScenarioOutcome(null)
        setAgentVoices({})
        clearVoiceQueue()
        addFeed('info', 'TARE', msg.message); break
      case 'GATEWAY_DECISION': {
        const lvl = msg.decision === 'ALLOW' ? 'info' : 'danger'
        const sigStr = msg.signals?.length ? ` [${msg.signals.map(s=>s.signal).join('+')}]` : ''
        addFeed(lvl, 'GATEWAY', `${msg.command} → ${msg.asset_id} [${msg.decision}] ${msg.reason}${sigStr}`); break
      }
      case 'TARE_RESPONSE':
        addFeed('danger', 'TARE', `${msg.action} — ${msg.message}`); break
      case 'IDENTITY_ALERT':
        addFeed('danger', 'AUTH', `IDENTITY_MISMATCH — forged token rejected before execution: ${msg.command}`); break
      case 'SERVICENOW_INCIDENT':
        addFeed('warning', 'ServiceNow', `Incident created: ${msg.incident?.incident_id}`)
        if (msg.incident) setSnap(prev => ({ ...prev, active_incident: msg.incident }))
        break
      case 'CHAT_MESSAGE':
        setChatMsgs(prev => [...prev, { role: msg.role, text: msg.message, ts: new Date().toISOString() }])
        if (msg.show_approve) { setShowApprove(true); setApproveType(msg.approve_type || 'default') }
        if (msg.show_approve === false) { setShowApprove(false); setApproveType('default') }; break
      case 'TIMEBOX_APPROVED':
        setShowApprove(false)
        addFeed('info', 'TARE', `Time-box approved — ${msg.duration_minutes}min window active`); break
      case 'TIMEBOX_DENIED':
        setShowApprove(false)
        addFeed('danger', 'SUPERVISOR', 'Time-box DENIED — incident escalated. Agent locked out.'); break
      case 'TIMEBOX_TICK':
        setSnap(prev => ({ ...prev, timebox_remaining: msg.remaining_seconds })); break
      case 'TIMEBOX_EXPIRED':
        addFeed('warning', 'TARE', msg.message); break
      case 'AGENT_WAKE': {
        const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })
        setActiveAgents(prev => ({ ...prev, [msg.agent]: { task: msg.task, ts } }))
        setAgentLog(prev => [{ agent: msg.agent, action: 'wake', task: msg.task, ts }, ...prev].slice(0, 40))
        addFeed('info', msg.agent, `▶ ${msg.task}`)
        break
      }
      case 'AGENT_SLEEP':
        setActiveAgents(prev => { const n = { ...prev }; delete n[msg.agent]; return n })
        setAgentLog(prev => [{ agent: msg.agent, action: 'sleep', task: '', ts: new Date().toLocaleTimeString('en-GB', { hour12: false }) }, ...prev].slice(0, 40))
        break
      case 'PIPELINE_UPDATE':
        setPipelineLog(prev => [{ agent: msg.agent, message: msg.message, ts: new Date().toLocaleTimeString('en-GB',{hour12:false}) }, ...prev].slice(0, 30))
        addFeed('info', msg.agent, msg.message)
        break
      default: break
    }
  }, [addFeed])

  useEffect(() => {
    let ws, timer
    const connect = () => {
      ws = new WebSocket(WS_URL)
      wsRef.current = ws
      ws.onopen    = () => {
        setWsConnected(true)
        addFeed('info', 'TARE', 'System online — WebSocket connected.')
        if (firstConnRef.current) {
          firstConnRef.current = false
          fetch('/reset', { method: 'POST' })
        }
      }
      ws.onclose   = () => { setWsConnected(false); timer = setTimeout(connect, 3000) }
      ws.onerror   = () => ws.close()
      ws.onmessage = (e) => { try { handleMsg(JSON.parse(e.data)) } catch {} }
    }
    connect()
    return () => { clearTimeout(timer); ws?.close() }
  }, [handleMsg])

  useEffect(() => {
    if (snap.mode === 'FREEZE' && prevModeRef.current !== 'FREEZE') {
      setShowFlash(true)
      setTimeout(() => setShowFlash(false), 700)
      playSiren()
      clearVoiceQueue()   // drop stale KORAL/MAREA commentary when FREEZE fires
    }
    prevModeRef.current = snap.mode
  }, [snap.mode])

  const post        = (path) => fetch(path, { method:'POST' })
  const runScenario = (path) => { setScenarioActive(true); post(path) }

  // Siren sound using Web Audio API
  const playSiren = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const duration = 3.5
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sawtooth'
      // Wail: frequency sweeps up and down repeatedly
      const start = ctx.currentTime
      const cycles = 4
      for (let i = 0; i < cycles; i++) {
        const t = start + (i * duration / cycles)
        osc.frequency.setValueAtTime(600, t)
        osc.frequency.linearRampToValueAtTime(1100, t + duration / cycles / 2)
        osc.frequency.linearRampToValueAtTime(600, t + duration / cycles)
      }
      gain.gain.setValueAtTime(0.35, start)
      gain.gain.linearRampToValueAtTime(0, start + duration)
      osc.start(start)
      osc.stop(start + duration)
    } catch {}
  }

  return (
    <div className="app-root">
      {showLanding && <LandingPage onEnter={() => setShowLanding(false)} />}

      {showFlash && <div className="tare-flash" />}
      {zoneModal && (
        <ZoneInfoModal zoneId={zoneModal} zones={snap.zones} assets={snap.assets} activeAgents={activeAgents} onClose={() => setZoneModal(null)} />
      )}
      <div className="app-layout">
        <Header wsConnected={wsConnected} darkMode={darkMode} onToggleTheme={() => setDarkMode(d => !d)} />

        <NarrativeBanner mode={snap.mode} agent={snap.agent} signals={snap.anomaly_signals} incident={snap.active_incident} />

        <div className="main-grid">
          {/* LEFT — full height */}
          <div className="grid-left">
            <LeftPanel agent={snap.agent} mode={snap.mode} signals={snap.anomaly_signals} score={snap.anomaly_score} incident={snap.active_incident}
              agentStates={agentStates} activeAgents={activeAgents} agentLog={agentLog} pipelineLog={pipelineLog}
              scenarioCtx={scenarioCtx} scenarioOutcome={scenarioOutcome} agentVoices={agentVoices}
              voiceMuted={voiceMuted}
              onToggleVoice={() => {
                const next = !voiceMuted
                setVoiceMuted_(next)
                setVoiceMuted(next)
              }} />
          </div>

          {/* TOP CENTER — Zone Observatory */}
          <div className="grid-zone">
            <ZoneObservatory zones={snap.zones} assets={snap.assets} accessLog={snap.zone_access_log} mode={snap.mode} darkMode={darkMode} onZoneClick={setZoneModal} activeAgents={activeAgents} />
          </div>

          {/* TOP RIGHT — Live Event Monitor */}
          <div className="grid-monitor">
            <RightPanel
              feedItems={feedItems} stats={snap.stats}
              wsConnected={wsConnected} scenarioActive={scenarioActive}
              onReset={()               => post('/reset')}
              onOutOfHours={()          => runScenario('/agent/out-of-hours')}
              onRepeatedFailures={()    => runScenario('/agent/repeated-failures')}
              onRunawayLoop={()         => runScenario('/agent/runaway-loop')}
              onReadonlyWrite={()       => runScenario('/agent/readonly-write')}
            />
          </div>

          {/* BOTTOM — spans center + right, full width */}
          <div className="grid-bottom">
            <BottomTabs
              gatewayLog={snap.gateway_log} chatMsgs={chatMsgs} feedItems={feedItems}
              showApprove={showApprove}
              approveType={approveType}
              timeboxRemaining={snap.timebox_remaining}
              onApprove={() => post('/approve/timebox')}
              onDeny={()    => post('/deny/timebox')}
              onZoneClick={setZoneModal} mode={snap.mode}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
