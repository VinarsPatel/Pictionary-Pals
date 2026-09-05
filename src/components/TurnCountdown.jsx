import React, { useEffect, useRef, useState } from "react"
import { playTick } from "../utils/sounds"

const SIZE = 44
const STROKE = 5
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Countdown ring for the current turn. Deliberately NOT animation-driven:
// browsers pause requestAnimationFrame in background tabs, so any timer that
// advances by accumulating frames (like react-countdown-circle-timer, which
// this replaced) freezes while the tab is hidden and shows stale time when
// the player comes back. Instead, every update recomputes the remaining time
// from the absolute turn-end instant on the server's clock — so the value is
// correct at every render no matter how long the tab was hidden, and the
// visibilitychange/focus listeners just make the snap-back immediate rather
// than waiting for the (throttled-in-background) interval to fire.
const TurnCountdown = ({ endAtMs, durationMs, getServerNow }) => {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, endAtMs - getServerNow())
  )
  // Tracks the last integer second we fired a tick for, so a 250ms poll
  // interval doesn't replay the same tick multiple times per second.
  const lastTickSecondRef = useRef(null)

  useEffect(() => {
    const update = () => {
      const next = Math.max(0, endAtMs - getServerNow())
      setRemainingMs(next)
      const nextSeconds = Math.ceil(next / 1000)
      if (
        nextSeconds > 0 &&
        nextSeconds <= 10 &&
        nextSeconds !== lastTickSecondRef.current
      ) {
        lastTickSecondRef.current = nextSeconds
        playTick()
      }
    }
    update()
    const intervalId = setInterval(update, 250)
    document.addEventListener("visibilitychange", update)
    window.addEventListener("focus", update)
    return () => {
      clearInterval(intervalId)
      document.removeEventListener("visibilitychange", update)
      window.removeEventListener("focus", update)
    }
  }, [endAtMs, getServerNow])

  const fraction =
    durationMs > 0 ? Math.min(1, Math.max(0, remainingMs / durationMs)) : 0
  const seconds = Math.ceil(remainingMs / 1000)
  const ringColor =
    fraction > 0.5 ? "#10b981" : fraction > 0.2 ? "#f59e0b" : "#ef4444"

  return (
    <div
      className="relative"
      style={{ width: SIZE, height: SIZE }}
      role="timer"
      aria-label={`${seconds} seconds remaining`}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke="#e2e8f0"
          strokeWidth={STROKE}
          fill="none"
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          stroke={ringColor}
          strokeWidth={STROKE}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - fraction)}
          style={{
            transition: "stroke-dashoffset 0.25s linear, stroke 0.5s ease",
          }}
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center text-sm font-semibold ${
          seconds <= 10 ? "animate-pulse text-red-600" : "text-slate-800"
        }`}
      >
        {seconds}
      </span>
    </div>
  )
}

export default TurnCountdown
