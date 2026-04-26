/**
 * Agent TTS Engine
 * Primary: Azure Neural TTS via backend /api/tts (natural, distinct voices per agent)
 * Fallback: browser Web Speech API (if Azure not configured or request fails)
 *
 * Public API is unchanged — speakAgent / setVoiceMuted / clearVoiceQueue
 */

// ── Azure status — checked once on load ───────────────────────────────────────
let _azureReady = false

async function _checkAzure() {
  try {
    const res = await fetch('/api/tts/status')
    const data = await res.json()
    _azureReady = data.configured === true
  } catch {
    _azureReady = false
  }
}
_checkAzure()

// ── Browser Web Speech fallback profiles ──────────────────────────────────────
const FALLBACK_PROFILES = {
  KORAL:    { voices: ['Google UK English Female', 'Microsoft Hazel', 'Karen', 'Samantha'],  pitch: 1.15, rate: 1.15, volume: 0.9  },
  MAREA:    { voices: ['Google UK English Male',   'Microsoft George', 'Daniel', 'Alex'],    pitch: 0.95, rate: 1.0,  volume: 0.95 },
  TASYA:    { voices: ['Microsoft Zira',           'Google US English', 'Victoria'],          pitch: 1.05, rate: 0.95, volume: 0.9  },
  NEREUS:   { voices: ['Microsoft David',          'Google UK English Male', 'Alex'],         pitch: 0.8,  rate: 0.88, volume: 1.0  },
  ECHO:     { voices: ['Google UK English Female', 'Microsoft Hazel', 'Karen'],               pitch: 1.1,  rate: 1.1,  volume: 0.85 },
  SIMAR:    { voices: ['Microsoft Mark',           'Google US English', 'Tom'],               pitch: 1.0,  rate: 1.05, volume: 0.85 },
  NAVIS:    { voices: ['Microsoft Zira',           'Google US English', 'Samantha'],          pitch: 0.92, rate: 1.0,  volume: 0.9  },
  RISKADOR: { voices: ['Microsoft David',          'Google UK English Male', 'Daniel'],       pitch: 0.88, rate: 0.95, volume: 0.95 },
  TRITON:   { voices: ['Microsoft Mark',           'Google UK English Male', 'Fred'],         pitch: 0.82, rate: 1.1,  volume: 1.0  },
  AEGIS:    { voices: ['Microsoft David',          'Google UK English Male', 'Alex'],         pitch: 0.78, rate: 0.85, volume: 1.0  },
  TEMPEST:  { voices: ['Google UK English Female', 'Microsoft Hazel', 'Karen'],               pitch: 1.05, rate: 1.2,  volume: 0.85 },
  LEVIER:   { voices: ['Microsoft Zira',           'Google US English', 'Victoria'],          pitch: 1.0,  rate: 0.9,  volume: 0.9  },
  BARRIER:  { voices: ['Microsoft Mark',           'Google UK English Male', 'Fred'],         pitch: 0.65, rate: 0.85, volume: 1.0  },
  NARRATOR: { voices: ['Google US English',         'Microsoft David', 'Alex'],               pitch: 1.0,  rate: 1.02, volume: 0.9  },
}

let _voiceMap = {}
let _anyVoice = null

function _loadVoices() {
  const all = window.speechSynthesis?.getVoices() || []
  _voiceMap = {}
  all.forEach(v => { _voiceMap[v.name] = v })
  _anyVoice = all.find(v => v.lang?.startsWith('en')) || all[0] || null
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = _loadVoices
  _loadVoices()
}

function _pickVoice(preferenceList) {
  for (const name of preferenceList) {
    if (_voiceMap[name]) return _voiceMap[name]
  }
  return _anyVoice
}

// ── TTS Queue ──────────────────────────────────────────────────────────────────
let _queue        = []
let _speaking     = false
let _muted        = false
let _currentAudio = null   // tracks the active HTMLAudioElement so we can stop it

// How each agent name should be pronounced
const PRONUNCIATIONS = {
  KORAL:    'Koral',
  MAREA:    'Marea',
  TASYA:    'Tasya',
  NEREUS:   'Neereus',
  ECHO:     'Echo',
  SIMAR:    'Simar',
  NAVIS:    'Navis',
  RISKADOR: 'Riskador',
  TRITON:   'Triton',
  AEGIS:    'Aegis',
  TEMPEST:  'Tempest',
  LEVIER:   'Levier',
  BARRIER:  'Barrier',
}

function _stopCurrentAudio() {
  if (_currentAudio) {
    _currentAudio.pause()
    _currentAudio.src = ''
    _currentAudio = null
  }
}

// ── Azure path ─────────────────────────────────────────────────────────────────
async function _speakAzure(agent, text) {
  _stopCurrentAudio()
  try {
    const res = await fetch('/api/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ agent, text }),
    })
    if (!res.ok) return false

    const blob  = await res.blob()
    const url   = URL.createObjectURL(blob)
    const audio = new Audio(url)
    _currentAudio = audio

    return new Promise(resolve => {
      audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve(true) }
      audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve(false) }
      audio.volume  = _muted ? 0 : 1.0
      audio.play().catch(() => { _currentAudio = null; resolve(false) })
    })
  } catch {
    return false
  }
}

// ── Browser fallback path ──────────────────────────────────────────────────────
function _speakBrowser(agent, text) {
  return new Promise(resolve => {
    if (!window.speechSynthesis) return resolve()
    const profile = FALLBACK_PROFILES[agent] || { voices: [], pitch: 1.0, rate: 1.0, volume: 0.9 }
    const voice   = _pickVoice(profile.voices)
    const utt     = new SpeechSynthesisUtterance(text)
    utt.pitch  = profile.pitch
    utt.rate   = profile.rate
    utt.volume = _muted ? 0 : profile.volume
    if (voice) utt.voice = voice
    utt.onend   = () => resolve()
    utt.onerror = () => resolve()
    window.speechSynthesis.speak(utt)
  })
}

// ── Queue processor ───────────────────────────────────────────────────────────
async function _processQueue() {
  if (_speaking || _queue.length === 0) return
  _speaking = true

  const { agent, text } = _queue.shift()

  let done = false
  if (_azureReady && !_muted) {
    done = await _speakAzure(agent, text)
  }
  if (!done) {
    // fallback: browser voice (or silent if muted)
    await _speakBrowser(agent, text)
  }

  _speaking = false
  _processQueue()
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function speakAgent(agent, message) {
  if (_muted) return
  const name = PRONUNCIATIONS[agent] || agent.charAt(0) + agent.slice(1).toLowerCase()
  const text = `${name}: ${message}`
  _queue.push({ agent, text })
  _processQueue()
}

// Speaks a single line and resolves when audio finishes.
// Used by AgentBriefing for sequential, awaitable playback.
// No name prefix — briefing lines are self-introducing ("Hi, I am Koral...")
export async function speakAgentAsync(agent, message) {
  if (_muted) return
  if (_azureReady) {
    const ok = await _speakAzure(agent, message)
    if (ok) return
  }
  await _speakBrowser(agent, message)
}

// Fetches audio from Azure and returns a blob URL — does NOT play it.
// Use this to prefetch next agent's audio while current is speaking.
export async function fetchAudio(agent, message) {
  if (!_azureReady) return null
  try {
    const res = await fetch('/api/tts', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ agent, text: message }),
    })
    if (!res.ok) return null
    const blob = await res.blob()
    return URL.createObjectURL(blob)
  } catch {
    return null
  }
}

// Plays a pre-fetched blob URL and resolves when done.
export function playBlobUrl(url) {
  _stopCurrentAudio()
  return new Promise(resolve => {
    const audio  = new Audio(url)
    _currentAudio = audio
    audio.volume = _muted ? 0 : 1.0
    audio.onended = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve() }
    audio.onerror = () => { URL.revokeObjectURL(url); _currentAudio = null; resolve() }
    audio.play().catch(() => { _currentAudio = null; resolve() })
  })
}

export function setVoiceMuted(muted) {
  _muted = muted
  if (muted) {
    _stopCurrentAudio()
    window.speechSynthesis?.cancel()
    _queue    = []
    _speaking = false
  }
}

export function isVoiceMuted() { return _muted }

export function clearVoiceQueue() {
  _stopCurrentAudio()
  window.speechSynthesis?.cancel()
  _queue    = []
  _speaking = false
}
