const scoring = require("./scoring")
const { validatePlayerName } = require("./validation")

// Used only as a fallback when a client doesn't supply (or supplies an
// invalid) avatar color — picked so consecutive ids don't repeat for at
// least this many players.
const FALLBACK_AVATAR_COLORS = [
  "#F94144",
  "#F3722C",
  "#F9C74F",
  "#90BE6D",
  "#43AA8B",
  "#577590",
  "#277DA1",
  "#B5179E",
]

function normalizeColor(color, id) {
  if (typeof color === "string" && /^#[0-9a-fA-F]{6}$/.test(color)) return color
  return FALLBACK_AVATAR_COLORS[id % FALLBACK_AVATAR_COLORS.length]
}

function createRoomStore() {
  const rooms = new Map()
  return {
    // `options` (turnDurationMs, maxPlayers, wordPack) are resolved by the
    // caller (index.js parses/clamps/defaults query params) — rooms.js
    // deliberately doesn't import config.js, so a bare createRoom(id) in a
    // test just leaves these undefined, which is fine for tests that don't
    // exercise them.
    createRoom(id, options = {}) {
      const room = {
        id,
        idPointer: 1,
        turnID: -1,
        users: {}, // id -> ws
        names: {}, // id -> name
        scores: {}, // id -> score
        colors: {}, // id -> avatar color (hex)
        tokens: {}, // reconnection token -> id
        pendingRemoval: {}, // id -> Timeout, set while a disconnected player is in their grace window
        status: [], // ids who guessed correctly this turn
        time: null, // Date the current turn started
        ans: null, // current secret word
        currentHint: null, // masked view of `ans` shown to guessers; letters get revealed over the turn
        recentWords: [], // last few words, to avoid immediate repeats
        roundsCompleted: 0,
        turnTimerActive: false, // guards against starting a second concurrent turn/timer chain
        startedAt: null,
        lastActivity: Date.now(),
        history: [], // {name, score, color} snapshots of players fully removed before the room emptied
        turnDurationMs: options.turnDurationMs,
        maxPlayers: options.maxPlayers,
        wordPack: options.wordPack || "default",
        isPublic: options.isPublic || false, // eligible for quick-play matchmaking
        round: 1, // current game-round (a full cycle of every active player drawing once)
        maxRounds: options.maxRounds || 3, // after this many rounds, the game ends and auto-restarts
      }
      rooms.set(id, room)
      return room
    },
    getRoom(id) {
      return rooms.get(id)
    },
    deleteRoom(id) {
      rooms.delete(id)
    },
    allRooms() {
      return rooms.values()
    },
  }
}

// Used by GET /quickplay — the first public room with room for another
// player, or null if every public room is full/nonexistent (the caller
// creates a fresh public room in that case).
function findJoinablePublicRoom(roomStore) {
  for (const room of roomStore.allRooms()) {
    if (!room.isPublic) continue
    const cap = room.maxPlayers || Infinity
    if (activePlayerCount(room) < cap) return room
  }
  return null
}

// JS guarantees ascending-numeric-string key iteration for integer-like
// keys, but we sort explicitly so turn order doesn't rely on that being
// remembered by whoever edits this later.
function getOrderedPlayerIds(room) {
  return Object.keys(room.users)
    .map(Number)
    .sort((a, b) => a - b)
}

function activePlayerCount(room) {
  return getOrderedPlayerIds(room).length
}

// The host is never a stored/mutable field — it's always the lowest active
// id. That means it's automatically transferred the instant the original
// host disconnects (the next-lowest active id becomes host with no extra
// bookkeeping), and automatically reclaimed if they reconnect (ids are
// never reused, so a returning host is still the lowest id once they're
// active again).
function getHostId(room) {
  const ids = getOrderedPlayerIds(room)
  return ids.length > 0 ? ids[0] : null
}

function canStartGame(room) {
  return !room.turnTimerActive && activePlayerCount(room) >= 2
}

function markActivity(room) {
  room.lastActivity = Date.now()
}

// Single path for "someone with this name/token wants a socket in this
// room" — covers brand-new joins, verified reconnects, AND the races where
// a token's old socket is still technically open (duplicate tab, or a fast
// client reconnect-loop beating the server's close event for the dead
// socket). Adopting always wins over the old socket rather than branching
// on whether the old socket looks alive, so an identity can never end up
// split across two live sockets.
function resolveJoin(room, { name, token, ws, maxPlayers, color }) {
  if (token && room.tokens[token] !== undefined) {
    const existingId = room.tokens[token]
    if (room.names[existingId] !== undefined) {
      const oldWs = room.users[existingId] || null
      cancelPendingRemoval(room, existingId)
      room.users[existingId] = ws
      markActivity(room)
      return {
        status: "reconnected",
        playerId: existingId,
        oldWs: oldWs !== ws ? oldWs : null,
      }
    }
    // Token pointed at an id that was already fully purged — treat as new.
  }

  if (maxPlayers && activePlayerCount(room) >= maxPlayers) {
    return { status: "rejected", reason: "room_full" }
  }

  const nameResult = validatePlayerName(name)
  if (!nameResult.ok) {
    return { status: "rejected", reason: nameResult.reason }
  }

  const id = room.idPointer
  room.idPointer += 1
  room.users[id] = ws
  room.names[id] = nameResult.value
  room.scores[id] = 0
  // An invalid/missing color falls back to a palette pick rather than
  // rejecting the join — a cosmetic field shouldn't be able to block play.
  room.colors[id] = normalizeColor(color, id)
  if (token) room.tokens[token] = id
  markActivity(room)
  return { status: "joined", playerId: id }
}

// Removes a socket from the active roster without touching name/score —
// callers must have already confirmed `room.users[id] === ws` (see the
// close-handler identity guard in index.js) before calling this.
function removeFromActive(room, id) {
  delete room.users[id]
  markActivity(room)
}

function setPendingRemoval(room, id, timeoutHandle) {
  room.pendingRemoval[id] = timeoutHandle
}

function hasPendingRemoval(room, id) {
  return room.pendingRemoval[id] !== undefined
}

function cancelPendingRemoval(room, id) {
  if (room.pendingRemoval[id]) {
    clearTimeout(room.pendingRemoval[id])
    delete room.pendingRemoval[id]
  }
}

// Called once a disconnected player's grace window has actually expired.
// Snapshots them into room.history *before* deleting their score, so a
// completed-game record still has their final score even though most
// players will already be individually purged by the time a room empties.
function finalizeRemoval(room, id) {
  const name = room.names[id]
  const score = room.scores[id] || 0
  const color = room.colors[id]
  if (name !== undefined) room.history.push({ name, score, color })
  delete room.names[id]
  delete room.scores[id]
  delete room.colors[id]
  delete room.pendingRemoval[id]
  for (const [token, mappedId] of Object.entries(room.tokens)) {
    if (mappedId === id) delete room.tokens[token]
  }
  markActivity(room)
  return { name, score, remainingActive: activePlayerCount(room) }
}

// A room is safe for the reaper to delete only once nobody is active AND
// nobody is still inside their reconnect grace window (otherwise a
// returning player's token would match a room that no longer exists).
function isIdle(room) {
  return (
    activePlayerCount(room) === 0 &&
    Object.keys(room.pendingRemoval).length === 0
  )
}

// Masked view of the word for guessers — one "_" per character, but spaces
// stay visible so a two-word answer reads as two groups of blanks.
function maskWord(word) {
  return word.replace(/[^\s]/g, "_")
}

// Reveals one random still-hidden letter in room.currentHint (skribbl-style
// mid-turn help). Never reveals the final hidden letter — the full word
// should only ever come from actually guessing it — and no-ops entirely for
// short words (<= 3 chars), where even one revealed letter gives the whole
// game away. Returns the new hint, or null if nothing was revealed.
function revealHintLetter(room) {
  if (!room.ans || !room.currentHint) return null
  if (room.ans.length <= 3) return null
  const hiddenIndexes = []
  for (let i = 0; i < room.currentHint.length; i++) {
    if (room.currentHint[i] === "_") hiddenIndexes.push(i)
  }
  if (hiddenIndexes.length <= 1) return null
  const idx = hiddenIndexes[Math.floor(Math.random() * hiddenIndexes.length)]
  room.currentHint =
    room.currentHint.slice(0, idx) +
    room.ans[idx] +
    room.currentHint.slice(idx + 1)
  markActivity(room)
  return room.currentHint
}

function beginTurn(room, drawerId, word) {
  room.turnID = drawerId
  room.ans = word
  room.currentHint = maskWord(word)
  room.time = new Date()
  room.status = []
  room.recentWords.push(word)
  if (room.recentWords.length > 5) room.recentWords.shift()
  room.roundsCompleted += 1
  room.turnTimerActive = true
  if (!room.startedAt) room.startedAt = room.time
  markActivity(room)
  return { turnID: room.turnID, word: room.ans, time: room.time }
}

function stopTurnTimer(room) {
  room.turnTimerActive = false
}

function computeNextTurnId(room) {
  const ids = getOrderedPlayerIds(room)
  if (ids.length <= 1) return null
  const idx = ids.indexOf(room.turnID)
  const nextIdx = idx === ids.length - 1 ? 0 : idx + 1
  return ids[nextIdx]
}

function applyCorrectGuess(room, guesserId, elapsedMs) {
  room.status.push(guesserId)
  const guesserDelta = scoring.scoreForGuesser(elapsedMs)
  const drawerDelta = scoring.scoreForDrawer(elapsedMs)
  room.scores[guesserId] = (room.scores[guesserId] || 0) + guesserDelta
  room.scores[room.turnID] = (room.scores[room.turnID] || 0) + drawerDelta
  markActivity(room)
  return { guesserDelta, drawerDelta }
}

function allNonDrawerGuessed(room) {
  return room.status.length === activePlayerCount(room) - 1
}

// A "round" is one full cycle of every active player drawing once. Detected
// by wrap-around (the next drawer is back to the lowest active id) rather
// than counting turns, so it stays correct even if players join/leave
// mid-round — the cycle length just adjusts.
function isRoundComplete(room, nextTurnId) {
  const ids = getOrderedPlayerIds(room)
  return ids.length > 0 && nextTurnId === ids[0]
}

function advanceRound(room) {
  room.round += 1
  markActivity(room)
  return room.round
}

function isGameOver(room) {
  return room.round > room.maxRounds
}

// Called once a game (a fixed number of rounds) has finished and its final
// standings have already been broadcast/persisted by the caller. Resets
// score/turn state so the same room can immediately start a fresh game with
// the same players, mirroring skribbl.io's auto-restart behavior.
function resetForNewGame(room) {
  room.round = 1
  room.roundsCompleted = 0
  room.status = []
  room.turnID = -1
  room.time = null
  room.ans = null
  room.currentHint = null
  room.turnTimerActive = false
  room.startedAt = null
  room.history = []
  for (const id of Object.keys(room.scores)) {
    room.scores[id] = 0
  }
  markActivity(room)
}

module.exports = {
  createRoomStore,
  findJoinablePublicRoom,
  getOrderedPlayerIds,
  activePlayerCount,
  getHostId,
  canStartGame,
  markActivity,
  resolveJoin,
  removeFromActive,
  setPendingRemoval,
  hasPendingRemoval,
  cancelPendingRemoval,
  finalizeRemoval,
  isIdle,
  maskWord,
  revealHintLetter,
  beginTurn,
  stopTurnTimer,
  computeNextTurnId,
  applyCorrectGuess,
  allNonDrawerGuessed,
  isRoundComplete,
  advanceRound,
  isGameOver,
  resetForNewGame,
}
