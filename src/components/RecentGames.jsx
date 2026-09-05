import React, { useEffect, useState } from "react"
import Card from "./ui/Card"

// Read-only view into the server's sqlite-backed game history (see
// docs/ARCHITECTURE.md's "SQLite persistence" section) — no accounts exist
// yet, so this is intentionally just names/scores/timestamps, not tied to
// any identity beyond a display name.
const RecentGames = () => {
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const BASE_URL = process.env.REACT_APP_SERVER_URL
        const response = await fetch(`${BASE_URL}/api/games/recent?limit=5`)
        const data = await response.json()
        if (isMounted && data.success) setGames(data.games)
      } catch (error) {
        console.log("ERROR_IN_RECENT_GAMES", error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [])

  if (loading || games.length === 0) return null

  return (
    <Card className="flex w-full flex-col gap-2 p-6 text-slate-700">
      <h2 className="text-lg font-semibold text-slate-800">Recent Games</h2>
      <div className="flex flex-col gap-2">
        {games.map((game) => (
          <div
            key={game.id}
            className="rounded-md bg-slate-50 p-3 text-sm transition-colors hover:bg-slate-100"
          >
            <p className="text-slate-500">
              {new Date(game.endedAt).toLocaleString()} · {game.rounds} round
              {game.rounds === 1 ? "" : "s"}
            </p>
            <p>
              {game.players
                .map((player) => `${player.name} (${player.score})`)
                .join(", ")}
            </p>
          </div>
        ))}
      </div>
    </Card>
  )
}

export default RecentGames
