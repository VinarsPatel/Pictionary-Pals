const test = require("node:test")
const assert = require("node:assert/strict")
const rooms = require("../src/rooms")

function fakeWs() {
  return { readyState: 1 }
}

test("resolveJoin assigns sequential ids starting at 1", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const a = rooms.resolveJoin(room, {
    name: "Alice",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  const b = rooms.resolveJoin(room, {
    name: "Bob",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  assert.equal(a.status, "joined")
  assert.equal(a.playerId, 1)
  assert.equal(b.status, "joined")
  assert.equal(b.playerId, 2)
})

test("resolveJoin rejects once maxPlayers is reached", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  rooms.resolveJoin(room, { name: "A", ws: fakeWs(), maxPlayers: 1 })
  const second = rooms.resolveJoin(room, {
    name: "B",
    ws: fakeWs(),
    maxPlayers: 1,
  })
  assert.equal(second.status, "rejected")
  assert.equal(second.reason, "room_full")
})

test("resolveJoin rejects invalid names", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const result = rooms.resolveJoin(room, {
    name: "ab cd",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  assert.equal(result.status, "rejected")
  assert.equal(result.reason, "name_single_word")
})

test("resolveJoin reconnects a known token even if the old socket is still live, and evicts it", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const wsA = fakeWs()
  const joined = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: wsA,
    maxPlayers: 8,
  })

  const wsB = fakeWs()
  const reconnected = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: wsB,
    maxPlayers: 8,
  })

  assert.equal(reconnected.status, "reconnected")
  assert.equal(reconnected.playerId, joined.playerId)
  assert.equal(reconnected.oldWs, wsA)
  assert.equal(room.users[joined.playerId], wsB)
})

test("resolveJoin reconnect cancels a pending grace-removal timer", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const wsA = fakeWs()
  const joined = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: wsA,
    maxPlayers: 8,
  })
  rooms.removeFromActive(room, joined.playerId)
  const handle = setTimeout(() => {}, 100000)
  rooms.setPendingRemoval(room, joined.playerId, handle)
  assert.equal(rooms.hasPendingRemoval(room, joined.playerId), true)

  const wsB = fakeWs()
  const reconnected = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: wsB,
    maxPlayers: 8,
  })

  assert.equal(reconnected.status, "reconnected")
  assert.equal(rooms.hasPendingRemoval(room, joined.playerId), false)
})

test("resolveJoin treats a token pointing at a fully-purged id as a brand-new join", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const joined = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  rooms.finalizeRemoval(room, joined.playerId)

  const result = rooms.resolveJoin(room, {
    name: "Alice",
    token: "tok",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  assert.equal(result.status, "joined")
  assert.notEqual(result.playerId, joined.playerId)
})

test("getOrderedPlayerIds sorts numerically, not lexicographically", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 10: fakeWs(), 2: fakeWs(), 1: fakeWs() }
  assert.deepEqual(rooms.getOrderedPlayerIds(room), [1, 2, 10])
})

test("computeNextTurnId rotates to the next id and wraps around", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs(), 2: fakeWs(), 3: fakeWs() }
  room.turnID = 1
  assert.equal(rooms.computeNextTurnId(room), 2)
  room.turnID = 3
  assert.equal(rooms.computeNextTurnId(room), 1)
})

test("computeNextTurnId returns null with 1 or 0 active players", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs() }
  room.turnID = 1
  assert.equal(rooms.computeNextTurnId(room), null)
})

test("computeNextTurnId falls back to the first id if the current drawer is absent", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 2: fakeWs(), 3: fakeWs() }
  room.turnID = 1 // drawer disconnected and was removed from users
  assert.equal(rooms.computeNextTurnId(room), 2)
})

test("applyCorrectGuess awards decaying scores to guesser and drawer", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs(), 2: fakeWs() }
  room.names = { 1: "Alice", 2: "Bob" }
  room.scores = { 1: 0, 2: 0 }
  room.turnID = 1
  room.status = []
  rooms.applyCorrectGuess(room, 2, 0)
  assert.equal(room.scores[2], 100)
  assert.equal(room.scores[1], 50)
  assert.deepEqual(room.status, [2])
})

test("finalizeRemoval snapshots the player into history before deleting their score", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.names = { 1: "Alice" }
  room.scores = { 1: 42 }
  room.colors = { 1: "#F94144" }
  room.tokens = { tok: 1 }
  const result = rooms.finalizeRemoval(room, 1)
  assert.equal(result.name, "Alice")
  assert.equal(result.score, 42)
  assert.deepEqual(room.history, [
    { name: "Alice", score: 42, color: "#F94144" },
  ])
  assert.equal(room.names[1], undefined)
  assert.equal(room.colors[1], undefined)
  assert.equal(room.tokens.tok, undefined)
})

test("isIdle is false while a player is inside their reconnect grace window", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const handle = setTimeout(() => {}, 100000)
  rooms.setPendingRemoval(room, 1, handle)
  assert.equal(rooms.isIdle(room), false)
  rooms.cancelPendingRemoval(room, 1)
  assert.equal(rooms.isIdle(room), true)
})

test("createRoom stores per-room settings, defaulting wordPack to 'default'", () => {
  const store = rooms.createRoomStore()
  const configured = store.createRoom("r1", {
    turnDurationMs: 90000,
    maxPlayers: 6,
    wordPack: "animals",
  })
  assert.equal(configured.turnDurationMs, 90000)
  assert.equal(configured.maxPlayers, 6)
  assert.equal(configured.wordPack, "animals")

  const bare = store.createRoom("r2")
  assert.equal(bare.wordPack, "default")
})

test("resolveJoin stores a valid hex color as given", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const result = rooms.resolveJoin(room, {
    name: "Alice",
    ws: fakeWs(),
    maxPlayers: 8,
    color: "#123ABC",
  })
  assert.equal(room.colors[result.playerId], "#123ABC")
})

test("resolveJoin falls back to a palette color when none is given or it's invalid", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  const noColor = rooms.resolveJoin(room, {
    name: "Alice",
    ws: fakeWs(),
    maxPlayers: 8,
  })
  assert.match(room.colors[noColor.playerId], /^#[0-9a-fA-F]{6}$/)

  const badColor = rooms.resolveJoin(room, {
    name: "Bob",
    ws: fakeWs(),
    maxPlayers: 8,
    color: "not-a-color",
  })
  assert.match(room.colors[badColor.playerId], /^#[0-9a-fA-F]{6}$/)
})

test("findJoinablePublicRoom ignores private rooms and full public rooms", () => {
  const store = rooms.createRoomStore()
  const priv = store.createRoom("private", { isPublic: false, maxPlayers: 8 })
  priv.users = { 1: fakeWs() }
  const full = store.createRoom("full", { isPublic: true, maxPlayers: 1 })
  full.users = { 1: fakeWs() }
  const open = store.createRoom("open", { isPublic: true, maxPlayers: 8 })
  open.users = { 1: fakeWs() }

  assert.equal(rooms.findJoinablePublicRoom(store), open)
})

test("findJoinablePublicRoom returns null when no public room has room", () => {
  const store = rooms.createRoomStore()
  const full = store.createRoom("full", { isPublic: true, maxPlayers: 1 })
  full.users = { 1: fakeWs() }
  assert.equal(rooms.findJoinablePublicRoom(store), null)
})

test("isRoundComplete is true only when the next drawer wraps back to the lowest id", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs(), 2: fakeWs(), 3: fakeWs() }
  assert.equal(rooms.isRoundComplete(room, 2), false)
  assert.equal(rooms.isRoundComplete(room, 3), false)
  assert.equal(rooms.isRoundComplete(room, 1), true)
})

test("advanceRound increments room.round", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1", { maxRounds: 3 })
  assert.equal(room.round, 1)
  rooms.advanceRound(room)
  assert.equal(room.round, 2)
})

test("isGameOver is true once round exceeds maxRounds", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1", { maxRounds: 2 })
  assert.equal(rooms.isGameOver(room), false)
  room.round = 2
  assert.equal(rooms.isGameOver(room), false)
  room.round = 3
  assert.equal(rooms.isGameOver(room), true)
})

test("resetForNewGame zeroes scores and turn state but keeps players", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1", { maxRounds: 3 })
  room.names = { 1: "Alice", 2: "Bob" }
  room.scores = { 1: 120, 2: 80 }
  room.round = 4
  room.roundsCompleted = 9
  room.turnID = 2
  room.history = [{ name: "Carl", score: 10, color: "#fff" }]

  rooms.resetForNewGame(room)

  assert.equal(room.round, 1)
  assert.equal(room.roundsCompleted, 0)
  assert.equal(room.turnID, -1)
  assert.deepEqual(room.scores, { 1: 0, 2: 0 })
  assert.deepEqual(room.names, { 1: "Alice", 2: "Bob" }) // players are not removed
  assert.deepEqual(room.history, [])
})

test("getHostId is the lowest active id, and null with nobody active", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  assert.equal(rooms.getHostId(room), null)

  room.users = { 3: fakeWs(), 1: fakeWs(), 2: fakeWs() }
  assert.equal(rooms.getHostId(room), 1)
})

test("getHostId transfers to the next-lowest id the instant the host drops out of users", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs(), 2: fakeWs() }
  assert.equal(rooms.getHostId(room), 1)

  delete room.users[1] // host disconnected — removed from users, not names/scores
  assert.equal(rooms.getHostId(room), 2)
})

test("getHostId is reclaimed by the original host on reconnect, since ids are never reused", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  room.users = { 1: fakeWs(), 2: fakeWs() }
  delete room.users[1]
  assert.equal(rooms.getHostId(room), 2)

  room.users[1] = fakeWs() // id 1 reconnects
  assert.equal(rooms.getHostId(room), 1)
})

test("canStartGame requires at least 2 active players and no turn already in progress", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  assert.equal(rooms.canStartGame(room), false) // 0 players

  room.users = { 1: fakeWs() }
  assert.equal(rooms.canStartGame(room), false) // 1 player

  room.users = { 1: fakeWs(), 2: fakeWs() }
  assert.equal(rooms.canStartGame(room), true)

  room.turnTimerActive = true
  assert.equal(rooms.canStartGame(room), false) // a game is already running
})

test("maskWord masks every character but keeps spaces visible", () => {
  assert.equal(rooms.maskWord("guitar"), "______")
  assert.equal(rooms.maskWord("ice cream"), "___ _____")
})

test("beginTurn initializes currentHint as the fully-masked word", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  rooms.beginTurn(room, 1, "guitar")
  assert.equal(room.currentHint, "______")
})

test("revealHintLetter uncovers one real letter at its true position", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  rooms.beginTurn(room, 1, "guitar")
  const hint = rooms.revealHintLetter(room)
  assert.equal(hint.length, 6)
  const revealed = [...hint].filter((ch) => ch !== "_")
  assert.equal(revealed.length, 1)
  const idx = [...hint].findIndex((ch) => ch !== "_")
  assert.equal(hint[idx], "guitar"[idx])
})

test("revealHintLetter never reveals the last hidden letter or short words", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")

  rooms.beginTurn(room, 1, "cat") // <= 3 chars: no reveals at all
  assert.equal(rooms.revealHintLetter(room), null)
  assert.equal(room.currentHint, "___")

  rooms.beginTurn(room, 1, "lion")
  // Force the hint to one-hidden-letter-left, then ask for another reveal.
  room.currentHint = "lio_"
  assert.equal(rooms.revealHintLetter(room), null)
  assert.equal(room.currentHint, "lio_")
})

test("resetForNewGame clears the hint along with turn state", () => {
  const store = rooms.createRoomStore()
  const room = store.createRoom("r1")
  rooms.beginTurn(room, 1, "guitar")
  rooms.resetForNewGame(room)
  assert.equal(room.currentHint, null)
})
