import React from "react"
import { LuPlay } from "react-icons/lu"
import Button from "./ui/Button"

// Shown over the canvas when a `type: 9` game-over message arrives (see
// docs/WEBSOCKET_PROTOCOL.md). Renders the final standings as a sorted
// podium. The game does *not* auto-restart — the room's host must
// explicitly send `type: 12` (see `onStartNext`) once ready, so this stays
// on screen (with a "Start Next Game" control for the host, or a waiting
// message for everyone else) until the next `type: 4` turn message clears
// `state.gameOver` and this unmounts on its own.
const GameOverOverlay = ({ gameOver, selfId, isHost, canStart, onStartNext }) => {
  const standings = Object.keys(gameOver.scores)
    .map((key) => ({
      id: Number(key),
      name: gameOver.names[key],
      score: gameOver.scores[key],
      color: gameOver.colors?.[key],
    }))
    .sort((a, b) => b.score - a.score)

  return (
    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-md border border-violet-100 bg-white/95 p-6 text-center shadow-xl">
      <img src="/logo.png" alt="" className="w-full max-w-[220px]" />
      <h2 className="text-2xl font-bold text-indigo-600">Game Over!</h2>
      <p className="text-sm text-slate-500">
        Round {gameOver.round}/{gameOver.maxRounds} complete
      </p>
      <div className="flex w-full max-w-xs flex-col gap-2">
        {standings.map((player, index) => (
          <div
            key={player.id}
            className={`flex items-center justify-between rounded-md px-3 py-2 ${
              index === 0
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
            style={{ borderLeft: `4px solid ${player.color || "transparent"}` }}
          >
            <span className="font-semibold">
              #{index + 1} {player.name} {player.id === selfId && "(You)"}
            </span>
            <span>{player.score}</span>
          </div>
        ))}
      </div>
      {isHost ? (
        <Button onClick={onStartNext} disabled={!canStart}>
          <LuPlay className="h-4 w-4" />
          {canStart ? "Start Next Game" : "Waiting for another player..."}
        </Button>
      ) : (
        <p className="text-xs text-slate-500">
          Waiting for the host to start the next game...
        </p>
      )}
    </div>
  )
}

export default GameOverOverlay
