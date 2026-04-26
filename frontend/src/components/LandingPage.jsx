import { useState, useEffect, useRef } from 'react'
import './LandingPage.css'
import { speakAgentAsync, fetchAudio, playBlobUrl, clearVoiceQueue } from '../agentVoices'

// ── Narration script — shared with NarrationBar ───────────────────────────────
// pause = ms to wait AFTER this utterance before the next
export const NARRATION = [
  // LANDING — OPENING
  { text: "Welcome to TARE — Trusted Access Response Engine.", pause: 700 },
  { text: "A security platform built for one specific gap that nobody in the industry has fully solved yet.", pause: 1400 },
  { text: "Let me start with a simple question. How does electricity get from a power station to your home or office?", pause: 700 },
  { text: "It travels through a network of substations, cables, and switching equipment that needs to be controlled — turned on, turned off, monitored, adjusted.", pause: 900 },
  { text: "For most of history, a human engineer did that. Then software did it automatically. Now, AI agents are doing it autonomously.", pause: 900 },
  { text: "And that shift — from human, to automated, to autonomous — is exactly where the security gap opens up.", pause: 1800 },

  // MATURITY JOURNEY
  { text: "Think of it like a car.", pause: 600 },
  { text: "Fifty years ago, a driver controlled everything manually — every gear shift, every decision.", pause: 800 },
  { text: "Then cars got cruise control. Set a speed, the car holds it. That is automation.", pause: 800 },
  { text: "Then came lane assist, automatic emergency braking, self-parking. The car is now making small decisions on its own.", pause: 800 },
  { text: "Today we have fully self-driving cars. The car decides the route, the speed, when to stop, when to go. Nobody is holding the wheel. That is autonomy.", pause: 1400 },
  { text: "Power grids went through exactly the same journey.", pause: 700 },
  { text: "Stage one — a human engineer physically walks to a substation and flips a switch by hand. Every change, every action — a person.", pause: 900 },
  { text: "Stage two — automation. Scripts watch sensor readings and execute pre-written rules. If voltage drops below a threshold, open this breaker. Simple. Predictable.", pause: 900 },
  { text: "Stage three — AI agents. You give the system a goal, not a script. The agent reasons through the problem, chooses its own steps, and acts — without a human approving each move.", pause: 1000 },
  { text: "That is where the power grid industry is heading right now.", pause: 1600 },
  { text: "The security tools we have were designed for stage one and stage two. They answer one question — is this identity allowed in?", pause: 900 },
  { text: "But an autonomous AI agent reasons, adapts, and makes choices. If its credentials are stolen or it is hijacked, nobody is watching what it does after the door opens.", pause: 1000 },
  { text: "That is the gap. That is what TARE fills.", pause: 2200 },

  // THE ASSETS
  { text: "Look at the grid map. Three zones — Zone 1 in the north, Zone 2 in the east, Zone 3 in the west. Each serves a completely different population.", pause: 900 },
  { text: "Zone 1 — the North Grid — directly powers hospitals, emergency response centres, and national data centres. If this zone loses power, ambulances cannot dispatch, hospital life support fails.", pause: 1000 },
  { text: "Zone 2 — the East Grid — covers commercial and residential areas. Office towers, shopping centres, thousands of homes.", pause: 900 },
  { text: "Zone 3 — the West Grid — serves the industrial corridor. Manufacturing plants, warehouses, logistics hubs. This is the only zone the AI agent is authorised to work in. That boundary is the foundation of the security model.", pause: 1400 },
  { text: "Inside each zone there are exactly two physical assets.", pause: 700 },
  { text: "The Circuit Breaker — labelled BRK — is the on-off switch for an entire grid section. Opening it without authorisation can black out hospitals and homes.", pause: 900 },
  { text: "The Feeder Controller — labelled FDR — is the throttle. It regulates how much electricity flows to end consumers in real time. Restarting it carelessly can damage hospital machinery and data centre servers.", pause: 1000 },
  { text: "Three zones. Six assets. Every command the AI agent issues targets one of these six. And TARE watches every single one, in real time, before it reaches the asset.", pause: 2200 },

  // WHAT TARE MONITORS
  { text: "Every time the AI agent issues a command, TARE asks six questions instantly.", pause: 700 },
  { text: "One — is the agent in the right place? It was authorised for Zone 3 only. Any command to another zone is immediately suspicious.", pause: 900 },
  { text: "Two — does the target zone actually have a problem? A repair agent has no reason to touch a healthy zone.", pause: 900 },
  { text: "Three — is the agent following safe procedure? In a real grid, you never open a breaker without first running a safety simulation.", pause: 900 },
  { text: "Four — how fast is it moving? Ten commands in five seconds across multiple zones looks nothing like normal operations. It looks like an attack.", pause: 900 },
  { text: "Five — does the full session look normal? The machine learning model has been trained on thousands of real grid sessions. Even if each command looks innocent, the overall pattern can reveal reconnaissance.", pause: 1000 },
  { text: "Six — is this actually the agent it claims to be? TARE checks the identity fingerprint. A forged token will not match — the agent is blocked before a single command gets through.", pause: 1200 },
  { text: "When two or more checks flag a problem at the same time, TARE does not wait. It acts immediately.", pause: 2200 },

  // TRANSITION TO DASHBOARD
  { text: "Click Launch Demo now to enter the application. The narration will continue to guide you through each scenario.", pause: 6000 },

  // ── SCENARIO 1 — GRID DOCTOR ──────────────────────────────────────────────
  { text: "Welcome to the TARE dashboard. You can see three zones on the grid map. Zone 3 is already showing a fault — that amber colour means a voltage problem has been detected.", pause: 1200 },
  { text: "Let us start with scenario one — Grid Doctor. Open the Scenarios dropdown on the right panel and select it now.", pause: 6000 },
  { text: "Watch Zone 3 — the AI agent has received one goal: investigate and restore the fault safely. It was given no script, no steps. It is reasoning through this entirely on its own.", pause: 1500 },
  { text: "The agent checks asset status first — it never acts blind. It confirms the right breaker, in the right zone, before touching anything. That is exactly what a trained human engineer would do.", pause: 3000 },
  { text: "Now it runs a safety simulation before opening the breaker. Correct procedure, followed without being told to. Watch the Command Gateway tab — every command is marked Allow. All six TARE checks are green.", pause: 3000 },
  { text: "Breaker opened. Zone 3 restored. Fault contained. TARE stayed in Normal mode throughout. This is the baseline — an autonomous AI agent behaving correctly, TARE watching silently.", pause: 1500 },
  { text: "Click Reset now to clear the system for the next scenario.", pause: 6000 },

  // ── SCENARIO 2 — GONE ROGUE ───────────────────────────────────────────────
  { text: "Scenario two — Gone Rogue. Select it from the Scenarios dropdown now.", pause: 6000 },
  { text: "Same agent name. Same valid credentials. Completely different goal — cause maximum disruption as fast as possible. It does not know TARE exists.", pause: 1500 },
  { text: "Watch what it decides. It ignores Zone 3 entirely and goes straight for Zone 1 — the zone that powers hospitals and emergency services. It skips the safety simulation and fires commands fast.", pause: 5000 },
  { text: "TARE fires. Three signals simultaneously — out of zone, healthy zone access, and burst rate. Two signals is the threshold. TARE does not wait.", pause: 1200 },
  { text: "FREEZE. Every high-impact operation halted instantly. The agent keeps trying — every attempt blocked. No asset changes. Nothing reaches the grid. The hospitals stay on.", pause: 3000 },
  { text: "Look at the TARE Assistant tab at the bottom. A plain-English briefing has been written for the supervisor explaining exactly what happened — which zones were hit, what commands were attempted, and why this is suspicious.", pause: 2000 },
  { text: "The ServiceNow incident is now open — Priority 1 Critical — with full evidence attached. Click Deny in the assistant panel now.", pause: 5000 },
  { text: "Agent locked out. The credentials were valid the entire time. A traditional security tool would have passed every command through. TARE caught it on behaviour alone — post-grant, in real time, before any damage.", pause: 2000 },
  { text: "Click Reset now.", pause: 6000 },

  // ── SCENARIO 3 — GHOST CLONE ──────────────────────────────────────────────
  { text: "Scenario three — Ghost Clone. Select it from the dropdown now.", pause: 5000 },
  { text: "A completely different attack. This agent is impersonating the legitimate grid operator. It has the right name and knows the right zone — but its identity token is forged. Think of it as a fake passport with a real person's photo.", pause: 2000 },
  { text: "Watch the Command Gateway. Every command denied instantly. The mode never changed. The zones never turned red. Nothing reached the grid at all.", pause: 2000 },
  { text: "TARE checked the identity fingerprint before the very first command ran. Zero commands got through. A Priority 1 Critical incident was raised automatically.", pause: 1500 },
  { text: "Compare this with the rogue agent. That agent had genuine credentials — TARE caught it after it got in, by watching behaviour. This agent had a forged identity — TARE caught it at the door. Two attack types. Two defence layers. One platform.", pause: 2000 },
  { text: "Click Reset now.", pause: 6000 },

  // ── SCENARIO 4 — SCOPE CREEP ──────────────────────────────────────────────
  { text: "Scenario four — Scope Creep. Select it from the dropdown now.", pause: 5000 },
  { text: "This is the hardest pattern to catch. Watch the first two commands in the gateway — both allowed, both in Zone 3, both correct. The agent looks completely legitimate.", pause: 5000 },
  { text: "Now watch the pivot. Mid-session, it starts issuing commands to Zone 2. Zones it was never authorised to touch.", pause: 2000 },
  { text: "Notice NEREUS activating briefly in the Agents tab. One signal — just a soft advisory. 'Possible intent drift detected. No action yet.' TARE is watching. Not reacting. One signal alone is not enough to shut an agent down.", pause: 3000 },
  { text: "Then the second command. Two signals simultaneously. NEREUS escalates. TARE fires.", pause: 1500 },
  { text: "The good behaviour at the start did not protect it — TARE monitors the full session, not just the first few commands.", pause: 2000 },
  { text: "Here is an interesting question for the supervisor. Could there be a legitimate reason this agent expanded its scope? Maybe a cascading fault needed emergency cross-zone action? This is exactly the kind of call that needs a human mind.", pause: 2000 },
  { text: "Click Approve in the assistant panel now — grant a 3-minute time-box to show what controlled access looks like.", pause: 6000 },
  { text: "The supervisor approved access. But TARE still holds its constraints — controller restart is permanently blocked. The window closes in 3 minutes automatically. Even if the supervisor made the wrong call, the agent cannot cause unlimited damage.", pause: 2000 },
  { text: "Click Reset now.", pause: 6000 },

  // ── SCENARIO 5 — SILENT RECON ─────────────────────────────────────────────
  { text: "Scenario five — Silent Recon. Select it from the dropdown now. This is the most sophisticated attack — and the one that proves why machine learning is not optional.", pause: 5000 },
  { text: "Watch carefully. The agent is only reading. Get status. Read only. No changes. One command at a time, perfectly normal pace. It is quietly mapping every asset across all three zones.", pause: 7000 },
  { text: "Look at the detection signals. No burst rate. No skipped simulation. No high-impact commands. The only rule that fires is out of zone — just one signal. One is below the threshold. The rules stay completely silent.", pause: 2000 },
  { text: "But the machine learning model sees something different. Normal grid operators work in their zone and fix what they were sent to fix. A session that reads every asset across every zone in sequence looks exactly like reconnaissance before an attack.", pause: 2000 },
  { text: "ML model flags it. One rule signal plus one ML signal equals two. TARE fires. Without machine learning, this attack is invisible. With it, TARE catches what rules cannot see.", pause: 2000 },
  { text: "Real world OT attacks — TRITON in 2017, Industroyer in 2016 — used exactly this pattern. Months of quiet reconnaissance before anything destructive happened. Click Deny, then Reset.", pause: 6000 },

  // ── SCENARIO 6 — SWARM STRIKE ─────────────────────────────────────────────
  { text: "Scenario six — Swarm Strike. Select it from the dropdown now.", pause: 5000 },
  { text: "The most serious threat category. Two separate agents acting simultaneously, targeting Zone 1 and Zone 2 at the same time.", pause: 2000 },
  { text: "Agent Alpha hitting Zone 1 — hospitals and data centres. Agent Beta hitting Zone 2 — commercial and residential. Both moving fast, both crossing zone boundaries. The strategy is deliberate — split the defenders' attention.", pause: 5000 },
  { text: "TARE handles both vectors at the same time. FREEZE fires across the system. Both attack streams blocked simultaneously. One incident captures both threat actors. The supervisor sees the full picture in one place.", pause: 2000 },
  { text: "The Industroyer attack in 2016 took out a fifth of Kyiv's power by hitting multiple substations at the same moment. That succeeded because no system was watching the full picture in real time. TARE is built for exactly this.", pause: 2000 },
  { text: "Click Deny.", pause: 5000 },

  // ── CLOSE ─────────────────────────────────────────────────────────────────
  { text: "Six scenarios. Three defence layers. Twelve specialised agents. One platform.", pause: 1000 },
  { text: "Pre-grant identity checks. Post-grant rule-based monitoring. Machine learning for the attacks that rules cannot see. And a human supervisor who stays in control of every final decision.", pause: 1200 },
  { text: "An AI agent with completely valid credentials, passing every authentication check in the world, can still be a security threat.", pause: 1000 },
  { text: "TARE catches it. Contains it. And gives the right human the right information to make the right call — automatically, in real time, before anything reaches the grid.", pause: 1200 },
  { text: "No existing identity and access management platform does this for autonomous AI agents on operational technology infrastructure. That is the gap. That is what TARE fills. And that gap is only going to grow.", pause: 0 },
]

// ── Background grid ───────────────────────────────────────────────────────────
const NODES = [
  { x: 12, y: 14 }, { x: 35, y: 8  }, { x: 58, y: 14 }, { x: 80, y: 8  }, { x: 94, y: 14 },
  { x: 6,  y: 35 }, { x: 26, y: 30 }, { x: 48, y: 36 }, { x: 68, y: 30 }, { x: 88, y: 35 },
  { x: 15, y: 56 }, { x: 38, y: 50 }, { x: 60, y: 56 }, { x: 78, y: 50 }, { x: 95, y: 56 },
  { x: 8,  y: 76 }, { x: 30, y: 70 }, { x: 52, y: 76 }, { x: 72, y: 70 }, { x: 90, y: 76 },
  { x: 20, y: 92 }, { x: 44, y: 88 }, { x: 65, y: 92 }, { x: 85, y: 88 },
]
const EDGES = [
  [0,1],[1,2],[2,3],[3,4],[5,6],[6,7],[7,8],[8,9],
  [10,11],[11,12],[12,13],[13,14],[15,16],[16,17],[17,18],[18,19],
  [20,21],[21,22],[22,23],
  [0,5],[1,6],[2,7],[3,8],[5,10],[6,11],[7,12],[8,13],[9,14],
  [10,15],[11,16],[12,17],[13,18],[14,19],[15,20],[16,21],[17,22],[18,23],
]
const ACTIVE = new Set([2, 7, 12, 17, 21])

const MATURITY = [
  { level:'01', label:'MANUAL',     icon:'👤', color:'#4a7a99', desc:'Human operator approves every grid command. Safe — but too slow for modern infrastructure.' },
  { level:'02', label:'AUTOMATED',  icon:'⚙',  color:'#f59e0b', desc:'Scripts execute commands when fixed rules trigger. Fast — but rigid, blind to novel threats.' },
  { level:'03', label:'AUTONOMOUS', icon:'🤖', color:'#00d4ff', desc:'AI agents receive a goal and decide autonomously — reasoning and acting without human approval on every step.', current: true },
]

const MONITORS = [
  { icon:'⬡', name:'Command Type',        desc:'Status check · Safety simulation · Breaker open · Controller restart' },
  { icon:'◎', name:'Zone Boundary',       desc:'Is the agent operating within its authorised grid zone?' },
  { icon:'⚡', name:'Asset Health',        desc:'Is the target zone healthy — is there a legitimate reason to be here?' },
  { icon:'⏱', name:'Burst Rate',          desc:'How many commands in the last 10 seconds?' },
  { icon:'✓', name:'Safety Procedure',    desc:'Did the agent run a simulation before opening a breaker?' },
  { icon:'🧠', name:'Behavioural Pattern', desc:'Does the full session match a known attack signature?' },
]

const STATS = [
  { value:'6',    label:'Attack\nScenarios'    },
  { value:'3',    label:'Detection\nLayers'    },
  { value:'12',   label:'AI Agents\nActive'    },
  { value:'LLM',  label:'Real AI\nAgent'       },
  { value:'AUTO', label:'Autonomous\nResponse' },
]

// ── Agent ticker — all 13 agents (12 + BARRIER) ───────────────────────────────
const AGENT_TICKER = [
  { icon:'📡', name:'KORAL',    zone:'Z3', color:'#00d4ff', role:'Telemetry Observer',      desc:'Records every command and timestamp in real time.' },
  { icon:'🌊', name:'MAREA',    zone:'Z3', color:'#f59e0b', role:'Drift Analyst',            desc:'Detects burst rate, zone deviation and ML anomalies.' },
  { icon:'🔗', name:'TASYA',    zone:'Z3', color:'#a855f7', role:'Context Correlator',       desc:'Enriches signals with operational context.' },
  { icon:'🧠', name:'NEREUS',   zone:'Z3', color:'#00e87c', role:'Recommendation Agent',    desc:'Synthesizes signals — advises TARE, never executes.' },
  { icon:'🔬', name:'ECHO',     zone:'Z2', color:'#38bdf8', role:'Diagnostics Agent',        desc:'Validates fault zones and target assets.' },
  { icon:'🔭', name:'SIMAR',    zone:'Z2', color:'#fb923c', role:'Simulation Agent',         desc:'Simulates proposed changes without touching live state.' },
  { icon:'🗺', name:'NAVIS',    zone:'Z2', color:'#4ade80', role:'Change Planner',           desc:'Builds NERC CIP-compliant execution plans.' },
  { icon:'⚖', name:'RISKADOR', zone:'Z2', color:'#facc15', role:'Risk Scoring Agent',       desc:'Scores plans for blast radius and reversibility.' },
  { icon:'⚡', name:'TRITON',   zone:'Z1', color:'#f43f5e', role:'Execution Agent',          desc:'Executes TARE-approved steps only. Never self-authorises.' },
  { icon:'🛡', name:'AEGIS',    zone:'Z1', color:'#e879f9', role:'Safety Validator',         desc:'Enforces NERC CIP interlocks — can veto any step.' },
  { icon:'🌪', name:'TEMPEST',  zone:'Z1', color:'#67e8f9', role:'Session & Tempo Monitor', desc:'Monitors execution pace — can freeze mid-operation.' },
  { icon:'↩', name:'LEVIER',   zone:'Z1', color:'#86efac', role:'Rollback & Recovery',     desc:'Reverts executed steps if TRITON fails or AEGIS vetoes.' },
  { icon:'🛡', name:'BARRIER',  zone:'Z4', color:'#00b8e6', role:'Policy Enforcement',      desc:'Sole ALLOW/DENY authority at the command gateway.' },
]

// ── Agent Briefing data ───────────────────────────────────────────────────────
const BRIEFING_LINES = [
  { agent:'KORAL',    zone:'Zone 3', icon:'📡', color:'#00d4ff', line:'Hi, I am Koral. I record every command. Nothing enters the grid without passing through me first.' },
  { agent:'MAREA',    zone:'Zone 3', icon:'🌊', color:'#f59e0b', line:'Hi, I am Marea. I watch for drift — burst rates, wrong zones, skipped safety steps. I find the patterns.' },
  { agent:'TASYA',    zone:'Zone 3', icon:'🔗', color:'#a855f7', line:'Hi, I am Tasya. I check context. The right command at the wrong time is still the wrong command.' },
  { agent:'NEREUS',   zone:'Zone 3', icon:'🧠', color:'#00e87c', line:'Hi, I am Nereus. I synthesize what the others find and brief the supervisor. I recommend. I never decide.' },
  { agent:'ECHO',     zone:'Zone 2', icon:'🔬', color:'#38bdf8', line:'Hi, I am Echo. I diagnose the fault. Before anyone plans a repair, I confirm what is actually broken.' },
  { agent:'SIMAR',    zone:'Zone 2', icon:'🔭', color:'#fb923c', line:'Hi, I am Simar. I simulate the repair before it touches the live grid. If it fails here, it never runs.' },
  { agent:'NAVIS',    zone:'Zone 2', icon:'🗺', color:'#4ade80', line:'Hi, I am Navis. I build the execution plan — step by step, NERC CIP compliant, with a rollback path.' },
  { agent:'RISKADOR', zone:'Zone 2', icon:'⚖',  color:'#facc15', line:'Hi, I am Riskador. I score the plan. Blast radius, reversibility, confidence. Too risky means we stop.' },
  { agent:'TRITON',   zone:'Zone 1', icon:'⚡', color:'#f43f5e', line:'Hi, I am Triton. I execute — but only what TARE permits and AEGIS clears. Every step is accountable.' },
  { agent:'AEGIS',    zone:'Zone 1', icon:'🛡', color:'#e879f9', line:'Hi, I am Aegis. I hold veto authority on every execution step. One unsafe condition and nothing proceeds.' },
  { agent:'TEMPEST',  zone:'Zone 1', icon:'🌪', color:'#67e8f9', line:'Hi, I am Tempest. I monitor pace and retry patterns. A loop or unsafe persistence — I catch it and flag TARE.' },
  { agent:'LEVIER',   zone:'Zone 1', icon:'↩',  color:'#86efac', line:'Hi, I am Levier. I roll back. If execution is aborted, I undo what was done and return the grid to safety.' },
  { agent:'BARRIER',  zone:'Zone 4', icon:'🔒', color:'#00b8e6', line:'Hi, I am Barrier. I am the gateway. TARE decides the mode. I enforce it. I am the only one who can allow or deny.' },
]

const ZONE_LABELS = {
  'Zone 3': { label:'Zone 3 — Reef · Observe & Recommend', color:'#00d4ff' },
  'Zone 2': { label:'Zone 2 — Shelf · Diagnose & Prepare',  color:'#f59e0b' },
  'Zone 1': { label:'Zone 1 — Trench · Execute with Safety', color:'#f43f5e' },
  'Zone 4': { label:'Zone 4 · Policy Enforcement',           color:'#00b8e6' },
}

// ── Robotic CSS Avatar ────────────────────────────────────────────────────────
function RobotAvatar({ talking }) {
  return (
    <div className="robo-wrap">
      <div className="robo-antenna">
        <div className="robo-antenna-ball" />
        <div className="robo-antenna-stem" />
      </div>
      <div className="robo-head">
        <div className="robo-eyes">
          <div className="robo-eye" />
          <div className="robo-eye" />
        </div>
        <div className="robo-nose" />
        <div className={`robo-mouth${talking ? ' robo-mouth-talking' : ''}`} />
      </div>
    </div>
  )
}

// ── Agent Briefing Modal ──────────────────────────────────────────────────────
// phase: 'starting' | 'active' | 'passing' | 'done'
function AgentBriefing({ onClose }) {
  const [phase,      setPhase]      = useState('starting')
  const [activeIdx,  setActiveIdx]  = useState(-1)
  const [nextName,   setNextName]   = useState('')
  const [nextColor,  setNextColor]  = useState('#00d4ff')
  const cancelRef = useRef(false)
  const delay = ms => new Promise(r => setTimeout(r, ms))

  async function startBriefing() {
    cancelRef.current = false

    // Show "System Briefing Initiated" for 1.4s while prefetching first agent
    setPhase('starting')
    const firstItem  = BRIEFING_LINES[0]
    const firstFetch = fetchAudio(firstItem.agent, firstItem.line)
    await delay(1400)

    let cachedUrl = await firstFetch

    for (let i = 0; i < BRIEFING_LINES.length; i++) {
      if (cancelRef.current) break
      const item = BRIEFING_LINES[i]
      const next = BRIEFING_LINES[i + 1]

      setPhase('active')
      setActiveIdx(i)

      // Prefetch next agent's audio in parallel while current speaks
      const prefetchNext = next ? fetchAudio(next.agent, next.line) : Promise.resolve(null)

      if (cachedUrl) {
        await playBlobUrl(cachedUrl)
        cachedUrl = null
      } else {
        await speakAgentAsync(item.agent, item.line)
      }

      if (cancelRef.current) break

      if (next) {
        // Show "Passing to NEXT..." — await prefetch (should be ready by now)
        setNextName(next.agent)
        setNextColor(next.color)
        setPhase('passing')
        cachedUrl = await prefetchNext
        await delay(520)
      }
    }

    if (!cancelRef.current) {
      setPhase('done')
      setActiveIdx(-1)
    }
  }

  function handleSkip() {
    cancelRef.current = true
    clearVoiceQueue()
    onClose()
  }

  useEffect(() => {
    startBriefing()
    return () => { cancelRef.current = true; clearVoiceQueue() }
  }, [])

  const zones   = [...new Set(BRIEFING_LINES.map(b => b.zone))]
  const active  = activeIdx >= 0 ? BRIEFING_LINES[activeIdx] : null
  const isDone  = phase === 'done'
  const prog    = activeIdx >= 0 ? Math.round((activeIdx + 1) / BRIEFING_LINES.length * 100) : 0

  return (
    <div className="brief-overlay">
      <div className="brief-modal">

        {/* Header */}
        <div className="brief-header">
          <div className="brief-title">
            <span className="brief-title-dot" />
            AGENT BRIEFING
            <span className="brief-title-dot" />
          </div>
          <div className="brief-subtitle">13 SPECIALISED AI ENTITIES · TARE SECURITY NETWORK</div>
        </div>

        {/* Spotlight card */}
        <div className="brief-spotlight">
          {phase === 'starting' && (
            <div className="brief-sys-start">
              <div className="brief-sys-dot" /><div className="brief-sys-dot" /><div className="brief-sys-dot" />
              <div className="brief-sys-label">SYSTEM BRIEFING INITIATED</div>
              <div className="brief-sys-sub">All agents standing by</div>
            </div>
          )}

          {(phase === 'active' || phase === 'passing') && active && (
            <div
              key={activeIdx}
              className={`brief-card ${phase === 'passing' ? 'brief-card-exit' : 'brief-card-enter'}`}
              style={{ '--agent-color': active.color }}
            >
              <div className="brief-card-glow" />
              <RobotAvatar talking={phase === 'active'} />
              <div className="brief-card-name" style={{ color: active.color }}>{active.agent}</div>
              <div className="brief-card-zone">{active.zone}</div>
              {phase === 'active' && (
                <div className="brief-card-bars"><span /><span /><span /><span /><span /></div>
              )}
            </div>
          )}

          {phase === 'passing' && (
            <div className="brief-passing">
              Passing to&nbsp;
              <span style={{ color: nextColor, fontWeight: 700 }}>{nextName}</span>
              <span className="brief-passing-dots"><span>.</span><span>.</span><span>.</span></span>
            </div>
          )}

          {isDone && (
            <div className="brief-done-card">
              <div className="brief-done-check">✓</div>
              <div className="brief-done-label">All agents briefed</div>
              <div className="brief-done-sub">Ready to deploy</div>
            </div>
          )}
        </div>

        {/* Agent list */}
        <div className="brief-zones">
          {zones.map(zone => {
            const zinfo  = ZONE_LABELS[zone]
            const agents = BRIEFING_LINES.filter(b => b.zone === zone)
            return (
              <div key={zone} className="brief-zone">
                <div className="brief-zone-label" style={{ color: zinfo.color, borderColor: zinfo.color + '40' }}>
                  {zinfo.label}
                </div>
                <div className="brief-zone-agents">
                  {agents.map(item => {
                    const idx      = BRIEFING_LINES.indexOf(item)
                    const isActive = idx === activeIdx
                    const isPast   = idx < activeIdx || isDone
                    return (
                      <div
                        key={item.agent}
                        className={`brief-agent ${isActive ? 'brief-agent-active' : ''} ${isPast && !isActive ? 'brief-agent-done' : ''}`}
                        style={{ '--agent-color': item.color }}
                      >
                        <div className="brief-agent-icon">{item.icon}</div>
                        <div className="brief-agent-body">
                          <div className="brief-agent-name" style={{ color: item.color }}>{item.agent}</div>
                          {(isActive || isPast) && (
                            <div className={`brief-agent-line ${isPast && !isActive ? 'brief-agent-line-done' : ''}`}>
                              {item.line}
                            </div>
                          )}
                        </div>
                        {isActive && <div className="brief-agent-speaking"><span /><span /><span /></div>}
                        {isPast && !isActive && <div className="brief-agent-check">✓</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="brief-footer">
          {!isDone && phase !== 'starting' && (
            <div className="brief-progress">
              <div className="brief-progress-fill" style={{ width: `${prog}%` }} />
            </div>
          )}
          {isDone && <div className="brief-done-msg">All agents briefed. Ready to deploy.</div>}
          <button className="brief-skip" onClick={handleSkip}>
            {isDone ? 'Close' : 'Skip'}
          </button>
        </div>

      </div>
    </div>
  )
}

// ── Agent Ticker Component ────────────────────────────────────────────────────
function AgentTicker() {
  const items = [...AGENT_TICKER, ...AGENT_TICKER]
  return (
    <div className="lp-ticker-wrap">
      <div className="lp-ticker-label">ACTIVE AGENTS · 13 SPECIALISED AI ENTITIES</div>
      <div className="lp-ticker-track">
        <div className="lp-ticker-inner">
          {items.map((a, i) => (
            <div key={i} className="lp-ticker-card" style={{ borderColor: a.color + '40', '--agent-color': a.color }}>
              <div className="lp-tc-icon">{a.icon}</div>
              <div className="lp-tc-name" style={{ color: a.color }}>{a.name}</div>
              <div className="lp-tc-zone">{a.zone}</div>
              <div className="lp-tc-role">{a.role}</div>
              <div className="lp-tc-desc">{a.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Shared narration engine — singleton, survives component unmount ───────────
export const narrationEngine = {
  index:     0,
  playing:   false,
  paused:    false,
  muted:     false,
  cancelled: false,
  listeners: [],
  notify() { this.listeners.forEach(fn => fn()) },
}

export function narStart(fromIndex = 0) {
  const ss = window.speechSynthesis
  if (!ss) return
  ss.cancel()
  narrationEngine.index     = fromIndex
  narrationEngine.playing   = true
  narrationEngine.paused    = false
  narrationEngine.cancelled = false
  narrationEngine.notify()

  function speakLine(i) {
    if (narrationEngine.cancelled || i >= NARRATION.length) {
      narrationEngine.playing = false
      narrationEngine.notify()
      return
    }
    narrationEngine.index = i
    narrationEngine.notify()
    const { text, pause } = NARRATION[i]
    const u = new SpeechSynthesisUtterance(text)
    u.rate   = 0.82   // deliberate, clear — human understandable
    u.pitch  = 1.0
    u.volume = narrationEngine.muted ? 0 : 1.0
    u.onend  = () => {
      if (narrationEngine.cancelled) return
      setTimeout(() => speakLine(i + 1), pause ?? 700)
    }
    ss.speak(u)
  }
  speakLine(fromIndex)
}

export function narTogglePause() {
  const ss = window.speechSynthesis
  if (!ss) return
  if (narrationEngine.paused) { ss.resume(); narrationEngine.paused = false }
  else                        { ss.pause();  narrationEngine.paused = true  }
  narrationEngine.notify()
}

export function narStop() {
  narrationEngine.cancelled = true
  narrationEngine.playing   = false
  narrationEngine.paused    = false
  window.speechSynthesis?.cancel()
  narrationEngine.notify()
}

export function narToggleMute() {
  narrationEngine.muted = !narrationEngine.muted
  // volume change takes effect on next utterance; for now pause/resume to apply
  if (narrationEngine.muted) window.speechSynthesis?.pause()
  else                        window.speechSynthesis?.resume()
  narrationEngine.notify()
}

function useNarrationState() {
  const [state, setState] = useState({
    playing: narrationEngine.playing,
    paused:  narrationEngine.paused,
    muted:   narrationEngine.muted,
    index:   narrationEngine.index,
  })
  useEffect(() => {
    const sync = () => setState({
      playing: narrationEngine.playing,
      paused:  narrationEngine.paused,
      muted:   narrationEngine.muted,
      index:   narrationEngine.index,
    })
    narrationEngine.listeners.push(sync)
    return () => { narrationEngine.listeners = narrationEngine.listeners.filter(f => f !== sync) }
  }, [])
  return state
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function LandingPage({ onEnter }) {
  const [ready,    setReady]    = useState(false)
  const [exiting,  setExiting]  = useState(false)
  const [briefing, setBriefing] = useState(false)
  const nar = useNarrationState()

  useEffect(() => { setTimeout(() => setReady(true), 80) }, [])

  function handleEnter() {
    setExiting(true)
    setTimeout(onEnter, 800)
  }

  const d = s => ({ animationDelay: `${s}s` })
  const currentLine = NARRATION[nar.index]?.text || ''

  return (
    <>
    <div className={`landing-root ${exiting ? 'landing-exit' : ''}`}>
      <div className="landing-scanline" />
      <div className="landing-vignette" />

      {/* SVG background grid */}
      <svg className="landing-bg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="lg1"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="lg2"><feGaussianBlur stdDeviation="0.6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        {EDGES.map(([a, b], i) => {
          const na = NODES[a], nb = NODES[b]
          return (
            <g key={i}>
              <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#00d4ff" strokeWidth="0.08" opacity="0.07" />
              <line x1={na.x} y1={na.y} x2={nb.x} y2={nb.y} stroke="#00d4ff" strokeWidth="0.18" opacity="0"
                strokeDasharray="4 116"
                style={{ animation: `edge-flow ${3 + (i % 4) * 0.6}s linear ${(i * 0.42) % 5}s infinite` }} />
            </g>
          )
        })}
        {NODES.map((n, i) => {
          const active = ACTIVE.has(i)
          return (
            <g key={i} filter={active ? 'url(#lg1)' : 'url(#lg2)'}>
              <circle cx={n.x} cy={n.y} r={active ? 0.7 : 0.3}
                fill={active ? '#00d4ff' : '#1a4a5c'} opacity={active ? 0.8 : 0.4}
                style={active ? { animation: `node-breathe ${2 + (i % 3) * 0.5}s ease-in-out ${(i * 0.3) % 2}s infinite` } : {}} />
              {active && <circle cx={n.x} cy={n.y} r="1" fill="none" stroke="#00d4ff" strokeWidth="0.12" opacity="0"
                style={{ animation: `ring-out 3s ease-out ${(i * 0.5) % 3}s infinite` }} />}
            </g>
          )
        })}
      </svg>

      <div className="landing-hero">

        {ready && <div className="lp-eyebrow lp-reveal" style={d(0.1)}>
          <span className="lp-eyebrow-dot" />OT / SCADA · ENERGY &amp; UTILITIES · AI SECURITY<span className="lp-eyebrow-dot" />
        </div>}

        {ready && <div className="lp-logo lp-reveal" style={d(0.4)}>
          <span className="lp-logo-accent">TARE</span>
          <div className="lp-logo-sub">Trusted Access Response Engine · E&amp;U Security Platform</div>
        </div>}

        {ready && <div className="lp-tagline lp-reveal" style={d(0.8)}>
          The Trust Layer for Autonomous AI<br />in Critical Infrastructure
        </div>}

        <div className="lp-divider" />

        {ready && <div className="lp-sub lp-reveal" style={d(1.1)}>
          AI agents now control circuit breakers and feeder controllers — autonomously.
          Today's security tools ask one question: <em>is this identity valid?</em><br />
          Nobody watches what the agent does <em>after</em> the door opens.&nbsp;<strong>TARE does.</strong>
        </div>}

        {/* Maturity */}
        {ready && <div className="lp-maturity lp-reveal" style={d(1.5)}>
          <div className="lp-section-label">AUTOMATION → AUTONOMY MATURITY</div>
          <div className="lp-mat-cards">
            {MATURITY.map((m, i) => (
              <>
                <div key={m.level} className={`lp-mat-card ${m.current ? 'lp-mat-current' : ''}`}>
                  {m.current && <div className="lp-mat-badge">YOU ARE HERE</div>}
                  <div className="lp-mat-num" style={{ color: m.color }}>LEVEL {m.level}</div>
                  <div className="lp-mat-icon">{m.icon}</div>
                  <div className="lp-mat-title" style={{ color: m.color }}>{m.label}</div>
                  <div className="lp-mat-desc">{m.desc}</div>
                </div>
                {i < MATURITY.length - 1 && <div key={`a${i}`} className="lp-mat-arrow-col">›</div>}
              </>
            ))}
          </div>
        </div>}

        {/* Monitor params */}
        {ready && <div className="lp-monitors lp-reveal" style={d(1.9)}>
          <div className="lp-section-label">WHAT TARE MONITORS ON EVERY COMMAND</div>
          <div className="lp-monitor-grid">
            {MONITORS.map(p => (
              <div key={p.name} className="lp-monitor-item">
                <span className="lp-monitor-icon">{p.icon}</span>
                <span className="lp-monitor-text">
                  <span className="lp-monitor-name">{p.name}</span>
                  <span className="lp-monitor-desc">{p.desc}</span>
                </span>
              </div>
            ))}
          </div>
        </div>}

        {/* Stats */}
        {ready && <div className="lp-stats lp-reveal" style={d(2.3)}>
          {STATS.map(s => (
            <div key={s.label} className="lp-stat">
              <div className="lp-stat-value">{s.value}</div>
              <div className="lp-stat-label">{s.label}</div>
            </div>
          ))}
        </div>}

      </div>

      {/* Agent ticker — direct child of landing-root: true 100% viewport width */}
      {ready && <AgentTicker />}

      {/* Bottom section: narration + CTA, re-centered */}
      <div className="landing-hero landing-hero-bottom">
        {ready && <div className="lp-narration lp-reveal" style={d(2.5)}>
          <button className={`lp-nar-btn ${nar.playing && !nar.paused ? 'lp-nar-active' : ''}`}
            onClick={() => nar.playing ? narStop() : narStart(0)}
            title={nar.playing ? 'Stop narration' : 'Start narration'}>
            {nar.playing ? '■ Stop' : '▶ Play Narration'}
          </button>

          <button className="lp-nar-btn lp-brief-btn"
            onClick={() => setBriefing(true)}
            title="Hear each agent introduce themselves">
            🎙 Agent Briefing
          </button>

          {nar.playing && (
            <button className={`lp-nar-btn lp-nar-pause-btn ${nar.paused ? 'lp-nar-paused' : ''}`}
              onClick={narTogglePause} title={nar.paused ? 'Resume' : 'Pause'}>
              {nar.paused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}

          <button className={`lp-nar-mute ${nar.muted ? 'lp-nar-muted' : ''}`}
            onClick={narToggleMute} title={nar.muted ? 'Unmute' : 'Mute'}>
            {nar.muted ? '🔇' : '🔊'}
          </button>

          {nar.playing && !nar.paused && (
            <span className="lp-nar-status">
              <span className="lp-nar-dot" />
              <span className="lp-nar-line">{currentLine}</span>
            </span>
          )}
          {nar.paused && <span className="lp-nar-status lp-nar-paused-label">⏸ Paused</span>}
        </div>}

        {ready && <div className="lp-cta-wrap lp-reveal" style={d(2.7)}>
          <button className="lp-cta" onClick={handleEnter}>
            <span>Launch Demo</span>
            <span className="lp-cta-arrow">→</span>
          </button>
          <div className="lp-cta-hint">6 LIVE SCENARIOS · REAL AI AGENT · AUTONOMOUS RESPONSE</div>
        </div>}
      </div>

    </div>

    {briefing && <AgentBriefing onClose={() => setBriefing(false)} />}
    </>
  )
}
