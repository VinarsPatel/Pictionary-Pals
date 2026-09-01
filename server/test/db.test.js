const test = require("node:test")
const assert = require("node:assert/strict")
const db = require("../src/db")

test("recordGameEnd + getRecentGames round-trip", () => {
  const handle = db.initDb(":memory:")
  db.recordGameEnd(handle, {
    roomId: "room1",
    startedAt: "2026-01-01T00:00:00.000Z",
    endedAt: "2026-01-01T00:05:00.000Z",
    rounds: 3,
    players: [
      { name: "Alice", score: 120 },
      { name: "Bob", score: 80 },
    ],
  })
  const games = db.getRecentGames(handle, 10)
  assert.equal(games.length, 1)
  assert.equal(games[0].roomId, "room1")
  assert.equal(games[0].rounds, 3)
  assert.deepEqual(games[0].players, [
    { name: "Alice", score: 120 },
    { name: "Bob", score: 80 },
  ])
  handle.close()
})

test("getRecentGames respects the limit and orders newest first", () => {
  const handle = db.initDb(":memory:")
  for (let i = 0; i < 5; i++) {
    db.recordGameEnd(handle, {
      roomId: `room-${i}`,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      rounds: 1,
      players: [{ name: "P", score: i }],
    })
  }
  const games = db.getRecentGames(handle, 2)
  assert.equal(games.length, 2)
  assert.equal(games[0].roomId, "room-4")
  assert.equal(games[1].roomId, "room-3")
  handle.close()
})
