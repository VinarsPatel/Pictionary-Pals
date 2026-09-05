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

// One oscillator tone with a short linear attack (avoids the instant-gain
// "pop" a synthesized tone gets if it jumps straight to full volume) and a
// gentle exponential fade-out so it doesn't click. A low-pass filter rounds
// off the harsher upper harmonics of square/triangle waves so tones read as
// soft/rounded rather than buzzy.
function beep({
  freq,
  duration = 0.12,
  type = "sine",
  gain = 0.15,
  delay = 0,
  attack = 0.015,
  filterFreq = 2200,
}) {
  if (isMuted()) return
  const ctx = getAudioContext()
  if (!ctx) return
  const startAt = ctx.currentTime + delay
  const endAt = startAt + duration
  const oscillator = ctx.createOscillator()
  const gainNode = ctx.createGain()
  const filter = ctx.createBiquadFilter()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(freq, startAt)
  filter.type = "lowpass"
  filter.frequency.setValueAtTime(filterFreq, startAt)
  gainNode.gain.setValueAtTime(0.0001, startAt)
  gainNode.gain.exponentialRampToValueAtTime(gain, startAt + attack)
  gainNode.gain.exponentialRampToValueAtTime(0.0001, endAt)
  oscillator.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)
  oscillator.start(startAt)
  oscillator.stop(endAt + 0.02)
}

export function playCorrectGuess() {
  beep({ freq: 660, duration: 0.12, type: "triangle", gain: 0.14 })
  beep({ freq: 880, duration: 0.18, type: "triangle", gain: 0.14, delay: 0.11 })
}

export function playTurnStart() {
  beep({ freq: 440, duration: 0.22, type: "triangle", gain: 0.11, filterFreq: 1800 })
}

export function playTick() {
  beep({ freq: 480, duration: 0.06, type: "sine", gain: 0.07, attack: 0.005 })
}

// Distinct from playCorrectGuess (which rises in pitch) — two identical soft
// notes, so it reads as "close, try again" rather than "you got it".
export function playCloseGuess() {
  beep({ freq: 520, duration: 0.08, type: "triangle", gain: 0.1, filterFreq: 1600 })
  beep({
    freq: 520,
    duration: 0.08,
    type: "triangle",
    gain: 0.1,
    delay: 0.1,
    filterFreq: 1600,
  })
}
