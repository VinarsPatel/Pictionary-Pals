const { DatabaseSync } = require("node:sqlite")
const fs = require("fs")
const path = require("path")

function initDb(dbPath) {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true })
  }
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL,
      rounds INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS game_players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      name TEXT NOT NULL,
      final_score INTEGER NOT NULL
    );
  `)
  return db
}

// `players` should be the room's full roster at the moment it emptied:
// history[] (players purged earlier in the game) plus anyone still active.
// See rooms.finalizeRemoval — it snapshots into history precisely so this
// still gets a complete roster even when players trickled out one by one.
function recordGameEnd(db, { roomId, startedAt, endedAt, rounds, players }) {
  const insertGame = db.prepare(
    "INSERT INTO games (room_id, started_at, ended_at, rounds) VALUES (?, ?, ?, ?)"
  )
  const insertPlayer = db.prepare(
    "INSERT INTO game_players (game_id, name, final_score) VALUES (?, ?, ?)"
  )
  const { lastInsertRowid: gameId } = insertGame.run(
    roomId,
    startedAt,
    endedAt,
    rounds
  )
  for (const p of players) {
    insertPlayer.run(gameId, p.name, p.score)
  }
  return gameId
}

function getRecentGames(db, limit = 10) {
  const games = db
    .prepare(
      `SELECT id, room_id as roomId, started_at as startedAt, ended_at as endedAt, rounds
       FROM games ORDER BY id DESC LIMIT ?`
    )
    .all(limit)
  const playersStmt = db.prepare(
    "SELECT name, final_score as score FROM game_players WHERE game_id = ? ORDER BY final_score DESC"
  )
  // node:sqlite returns null-prototype row objects — spread into plain
  // objects so callers can safely deep-equal/serialize them.
  return games.map((g) => ({
    ...g,
    players: playersStmt.all(g.id).map((p) => ({ ...p })),
  }))
}

module.exports = { initDb, recordGameEnd, getRecentGames }
