// Synthesized sound cues via the Web Audio API — no audio files/assets
// needed. A single shared AudioContext is created lazily (and resumed) on
// first use, since browsers block audio before a user gesture; the first
// call here always happens well after the player has already clicked
// something (join/start game), so this never hits that restriction.

const MUTE_KEY = "pp:soundMuted"

let audioCtx = null

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  if (!AudioContextClass) return null
  if (!audioCtx) {
    audioCtx = new AudioContextClass()
  }
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

export function isMuted() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1"
  } catch {
    return false
  }
}

export function setMuted(muted) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0")
  } catch {
    // localStorage unavailable (e.g. private browsing) — mute preference
    // just won't persist across reloads, which is a fine degradation.
  }
}

export function toggleMuted() {
  const next = !isMuted()
  setMuted(next)
  return next
}

// One oscillator tone with a quick exponential fade-out so it doesn't click.
function beep({ freq, duration = 0.12, type = "sine", gain = 0.15, delay = 0 }) {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const startAt = ctx.currentTime + delay
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(freq, startAt)
  gainNode.gain.setValueAtTime(gain, startAt)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, startAt + duration)
  oscillator.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + duration)
}

export function playCorrectGuess() {
  beep({ freq: 660, duration: 0.1, gain: 0.16 })
  beep({ freq: 880, duration: 0.15, gain: 0.16, delay: 0.1 })
}

export function playTurnStart() {
  beep({ freq: 440, duration: 0.2, type: "triangle", gain: 0.12 })
}

export function playTick() {
  beep({ freq: 320, duration: 0.08, type: "square", gain: 0.08 })
}
