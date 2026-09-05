import React from "react"
import { LuTrophy } from "react-icons/lu"

const Scores = ({ scores, names, colors, id, turnID }) => {
  if (scores == null) return

  // Ranked leaderboard order — highest score first — rather than raw
  // insertion order, so it actually reads as a leaderboard.
  const entries = Object.keys(scores).sort((a, b) => scores[b] - scores[a])
  const maxScore = Math.max(1, ...Object.values(scores))

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((key, rank) => {
        const isLeader = rank === 0 && scores[key] > 0
        const accentColor = colors?.[key] || "transparent"
        const isCurrentTurn = Number(key) === turnID
        return (
          <div
            key={key}
            data-testid={`score-chip-${key}`}
            className={`flex min-w-16 flex-col items-center gap-1 rounded-md border-t-4 px-2 pb-1.5 pt-1 ${
              isCurrentTurn
                ? "bg-indigo-600 text-white"
                : isLeader
                  ? "bg-amber-50 text-slate-700"
                  : "bg-slate-100 text-slate-700"
            }`}
            style={{ borderTopColor: accentColor }}
          >
            <p className="flex items-center gap-1 text-sm font-semibold">
              {isLeader && (
                <LuTrophy
                  data-testid="trophy-icon"
                  className="h-3.5 w-3.5 text-amber-500"
                />
              )}
              {names[key]} {Number(key) === id && "(You)"}
            </p>
            {/* Keying by the score value forces a remount when it changes,
                which is what replays the score-pop CSS animation. */}
            <p key={scores[key]} className="animate-score-pop text-lg font-bold">
              {scores[key]}
            </p>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(scores[key] / maxScore) * 100}%`,
                  backgroundColor:
                    accentColor === "transparent" ? "#6366f1" : accentColor,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default Scores
