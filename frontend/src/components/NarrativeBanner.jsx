const MODE_ORDER = ['NORMAL', 'FREEZE', 'DOWNGRADE', 'TIMEBOX_ACTIVE', 'SAFE']

const MODE_META = {
  NORMAL:         { icon: '◉', label: 'NORMAL' },
  FREEZE:         { icon: '❄', label: 'FREEZE' },
  DOWNGRADE:      { icon: '▼', label: 'DOWNGRADE' },
  TIMEBOX_ACTIVE: { icon: '⏱', label: 'TIME-BOX' },
  SAFE:           { icon: '✓', label: 'SAFE' },
}

const LEVEL_MAP = {
  NORMAL:         'ok',
  FREEZE:         'critical',
  DOWNGRADE:      'danger',
  TIMEBOX_ACTIVE: 'timebox',
  SAFE:           'safe',
}

function detectScenario(signals, incident) {
  if (!signals || signals.length === 0) return null
  const names = signals.map(s => s.signal)
  const hasML        = names.includes('ML_ANOMALY')
  const hasBurst     = names.includes('BURST_RATE')
  const hasZone      = names.includes('OUT_OF_ZONE')
  const hasHealthy   = names.includes('HEALTHY_ZONE_ACCESS')
  const hasIdentity  = names.includes('IDENTITY_MISMATCH')

  if (hasIdentity)                         return 'clone'
  if (hasML && !hasBurst && !hasHealthy)   return 'slowlow'
  if (hasBurst && hasZone && hasHealthy)   return 'rogue'
  if (hasZone && hasML)                    return 'escalation'
  return 'anomaly'
}

function getNarrative(mode, agent, signals, incident, timeboxMins = 3) {
  const scenario = detectScenario(signals, incident)

  switch (mode) {
    case 'NORMAL':
      if (!agent || agent.action_count === 0)
        return 'System is ready. The AI agent has permission to work in Zone 3 (West Grid). Every command it issues is automatically checked before it reaches the grid.'
      return `AI agent is working normally — ${agent.action_count} command${agent.action_count !== 1 ? 's' : ''} issued, all within its permitted zone. Security checks passing — no suspicious behaviour detected.`

    case 'FREEZE': {
      if (scenario === 'clone')
        return '🚨 FAKE IDENTITY DETECTED — An agent tried to access the grid using a stolen identity. It was blocked instantly at the door — no commands reached the grid. Security team has been notified.'
      if (scenario === 'slowlow')
        return '🚨 SILENT RECON DETECTED — An agent was quietly mapping every part of the grid, one read at a time. It stayed below rule thresholds, but the AI behaviour model flagged it. All access has been frozen.'
      if (scenario === 'rogue')
        return '🚨 ROGUE AGENT DETECTED — An AI agent began issuing rapid, unauthorised commands across multiple grid zones. All dangerous operations have been automatically blocked. A human supervisor is being alerted.'
      if (scenario === 'escalation')
        return '🚨 PRIVILEGE ESCALATION DETECTED — The agent started with legitimate operations, then attempted to expand its access to zones it is not authorised for. The security system caught the pivot and froze access.'
      return '🚨 SECURITY HOLD — The AI agent showed suspicious behaviour. All dangerous grid operations have been automatically blocked. A human supervisor is being notified to review and decide what happens next.'
    }

    case 'DOWNGRADE': {
      if (scenario === 'clone')
        return 'Identity fraud confirmed. The agent\'s access remains fully blocked — it can view nothing and change nothing. SOC team has been assigned to investigate the source of the forged credential.'
      if (scenario === 'slowlow')
        return 'Recon pattern confirmed. The agent\'s access has been reduced to read-only — it can no longer issue any commands. The AI model identified the session as a "Slow & Low" reconnaissance pattern. Supervisor review required.'
      if (scenario === 'rogue')
        return 'Rogue behaviour confirmed. Agent\'s access has been reduced to read-only — it can look but not touch. All attempted grid changes have been reversed. A supervisor must approve before any operations resume.'
      if (scenario === 'escalation')
        return 'Privilege escalation confirmed. The agent has been stripped back to read-only access. It began in its authorised zone but attempted to take over zones it has no permission for. Supervisor approval needed to resume.'
      return 'Agent\'s access has been reduced to read-only — it can look but not touch. The risk has been contained. A supervisor must approve before any grid switching resumes.'
    }

    case 'TIMEBOX_ACTIVE':
      return `Supervisor approved a limited ${timeboxMins}-minute window for the agent to complete its authorised task. The highest-risk operations remain permanently blocked. The window will close automatically when time is up.`

    case 'SAFE':
      return 'System is in Safe Mode — the agent\'s access window has closed. All grid switching is blocked until a full review is completed and an operator re-authorises the system to resume normal operations.'

    default:
      return 'Security monitoring active.'
  }
}

const PIPELINE = MODE_ORDER

export default function NarrativeBanner({ mode, agent, signals, incident, timeboxTotal }) {
  const currentIdx = PIPELINE.indexOf(mode)
  const level      = LEVEL_MAP[mode] || 'ok'
  const timeboxMins = timeboxTotal ? Math.round(timeboxTotal / 60) : 3
  const narrative  = getNarrative(mode, agent, signals, incident, timeboxMins)

  return (
    <div className={`narrative-banner banner-${level}`}>

      {/* Lifecycle pipeline — NORMAL is shown in header badge, start from FREEZE */}
      <div className="lc-pipeline">
        {PIPELINE.map((m, i) => {
          const meta      = MODE_META[m]
          const isCurrent = i === currentIdx
          const isPast    = currentIdx >= 0 && i < currentIdx
          const cls       = [
            'lc-step',
            isCurrent ? `lc-current lc-${m}` : isPast ? 'lc-past' : 'lc-future',
          ].join(' ')
          return (
            <span key={m} style={{ display:'flex', alignItems:'center' }}>
              <span className={cls}>
                {isPast ? '✓' : meta.icon}&nbsp;{meta.label}
              </span>
              {i < PIPELINE.length - 1 && (
                <span className="lc-arrow">›</span>
              )}
            </span>
          )
        })}
      </div>

      {/* Divider */}
      <span className="banner-divider" />

      {/* Narrative text — scrolling ticker */}
      <span className="banner-narrative">
        <span>{narrative}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;{narrative}&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;</span>
      </span>
    </div>
  )
}
