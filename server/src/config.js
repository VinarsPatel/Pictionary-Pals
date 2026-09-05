const num = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const config = {
  port: num(process.env.PORT, 4000),
  clientOrigins: (process.env.CLIENT_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  maxPlayersPerRoom: num(process.env.MAX_PLAYERS_PER_ROOM, 8),
  turnDurationMs: num(process.env.TURN_DURATION_MS, 60000),
  reconnectGraceMs: num(process.env.RECONNECT_GRACE_MS, 45000),
  roomReaperIntervalMs: num(process.env.ROOM_REAPER_INTERVAL_MS, 5 * 60000),
  roomIdleTtlMs: num(process.env.ROOM_IDLE_TTL_MS, 30 * 60000),
  defaultRounds: num(process.env.DEFAULT_ROUNDS, 3),
  dbPath: process.env.DB_PATH || "./data/pictionary.db",
}

module.exports = config
