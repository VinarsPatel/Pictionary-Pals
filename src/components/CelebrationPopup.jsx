import React from "react"
import { LuPartyPopper } from "react-icons/lu"

const CONFETTI_COLORS = ["#f59e0b", "#ec4899", "#8b5cf6", "#22c55e", "#3b82f6"]
const CONFETTI_PIECES = Array.from({ length: 14 })

// Rendered inside a `relative` ancestor (the Chat card) whenever a guess is
// correct — see the `celebration` state in GameArena.jsx, which mounts this
// for ~1.7s and unmounts it. Remounting on every new correct guess is what
// replays the CSS animations each time (see the App.css keyframes), so no
// extra JS timing logic is needed here beyond the parent's timeout.
const CelebrationPopup = ({ name }) => {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center overflow-hidden">
      <div className="relative">
        {CONFETTI_PIECES.map((_, i) => (
          <span
            key={i}
            className="absolute top-2 h-2 w-2 animate-confetti-fall rounded-sm"
            style={{
              left: `${(i / CONFETTI_PIECES.length) * 100 - 50}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 5) * 0.05}s`,
            }}
          />
        ))}
        <div className="animate-celebrate-pop mt-2 flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 via-pink-300 to-violet-300 px-4 py-2 text-sm font-bold text-slate-900 shadow-lg">
          <LuPartyPopper className="h-4 w-4" />
          Yay! {name} got it!
          <LuPartyPopper className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

export default CelebrationPopup
