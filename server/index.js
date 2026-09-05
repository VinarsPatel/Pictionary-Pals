const crypto = require("crypto")
const path = require("path")
const express = require("express")
const cors = require("cors")
const http = require("http")
const rateLimit = require("express-rate-limit")
const WebSocket = require("ws")
require("dotenv").config()

const config = require("./src/config")
const logger = require("./src/logger")
const wordBank = require("./src/wordBank")
const validation = require("./src/validation")
const rooms = require("./src/rooms")
const guessMatch = require("./src/guessMatch")
const db = require("./src/db")
const { TokenBucket } = require("./src/rateLimiter")

const HEARTBEAT_INTERVAL_MS = 30000
const MIN_TURN_DURATION_MS = 15_000
const MAX_TURN_DURATION_MS = 180_000
const MIN_PLAYERS_PER_ROOM = 2
const MAX_PLAYERS_PER_ROOM_CAP = 10
const MIN_ROUNDS = 1
const MAX_ROUNDS = 10

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

function createServer(overrides = {}) {
  const dbHandle =
    overrides.dbHandle || db.initDb(path.resolve(__dirname, config.dbPath))
  const roomStore = overrides.roomStore || rooms.createRoomStore()

  const app = express()
  app.use(express.json())

  if (config.clientOrigins.length === 0) {
    logger.warn(
      "CLIENT_ORIGINS is not set — CORS is wide open (origin: *). Set it in production."
    )
  }
  app.use(
    cors({
      origin: config.clientOrigins.length > 0 ? config.clientOrigins : "*",
      credentials: true,
    })
  )

  const getRoomLimiter = rateLimit({
    windowMs: 60_000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.get("/", (req, res) => {
    res.send("<h1>Pictionary Pals server</h1>")
  })

  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      uptimeSeconds: process.uptime(),
      rooms: [...roomStore.allRooms()].length,
    })
  })

  app.get("/getRoom", getRoomLimiter, (req, res) => {
    let roomId
    do {
      roomId = crypto.randomBytes(10).toString("hex")
    } while (roomStore.getRoom(roomId))

    const requestedTurnMs = parseInt(req.query.turnDurationMs, 10)
    const requestedMaxPlayers = parseInt(req.query.maxPlayers, 10)
    const requestedPack = req.query.wordPack
    const requestedMaxRounds = parseInt(req.query.maxRounds, 10)

    const roomOptions = {
      turnDurationMs: clamp(
        Number.isFinite(requestedTurnMs)
          ? requestedTurnMs
          : config.turnDurationMs,
        MIN_TURN_DURATION_MS,
        MAX_TURN_DURATION_MS
      ),
      maxPlayers: clamp(
        Number.isFinite(requestedMaxPlayers)
          ? requestedMaxPlayers
          : config.maxPlayersPerRoom,
        MIN_PLAYERS_PER_ROOM,
        Math.min(config.maxPlayersPerRoom, MAX_PLAYERS_PER_ROOM_CAP)
      ),
      wordPack: wordBank.isValidPack(requestedPack) ? requestedPack : "default",
      maxRounds: clamp(
        Number.isFinite(requestedMaxRounds) ? requestedMaxRounds : config.defaultRounds,
        MIN_ROUNDS,
        MAX_ROUNDS
      ),
    }

    // Pre-create the room with these settings now — the first WebSocket
    // join just finds it via roomStore.getRoom rather than lazily creating
    // one with global defaults (see handleJoin's fallback for the case
    // someone connects a socket without ever calling this endpoint).
    roomStore.createRoom(roomId, roomOptions)
    res.status(200).json({ success: true, roomId, ...roomOptions })
  })

  app.get("/quickplay", getRoomLimiter, (req, res) => {
    let room = rooms.findJoinablePublicRoom(roomStore)
    if (!room) {
      let roomId
      do {
        roomId = crypto.randomBytes(10).toString("hex")
      } while (roomStore.getRoom(roomId))
      room = roomStore.createRoom(roomId, {
        turnDurationMs: config.turnDurationMs,
        maxPlayers: config.maxPlayersPerRoom,
        wordPack: "default",
        maxRounds: config.defaultRounds,
        isPublic: true,
      })
    }
    res.status(200).json({ success: true, roomId: room.id })
  })

  app.get("/api/games/recent", (req, res) => {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 10))
    try {
      res.json({ success: true, games: db.getRecentGames(dbHandle, limit) })
    } catch (err) {
      logger.error({ err: err.message }, "failed to read recent games")
      res
        .status(500)
        .json({ success: false, message: "Could not load recent games" })
    }
  })

  const server = http.createServer(app)
  const wsServer = new WebSocket.Server({ server })

  const ERROR_MESSAGES = {
    room_full: "This room is full. Try creating a new one.",
    name_required: "Please enter a name.",
    name_too_long: "Names can be at most 8 characters.",
    name_single_word: "Names must be a single word.",
    not_host: "Only the host can start the game.",
    cannot_start: "Need at least 2 players to start.",
  }

  function sendTo(ws, obj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj))
    }
  }

  function broadcastExcept(room, exceptWs, obj) {
    const payload = JSON.stringify(obj)
    for (const id of Object.keys(room.users)) {
      const clientWs = room.users[id]
      if (clientWs !== exceptWs && clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(payload)
      }
    }
  }

  function sendJoinAck(ws, room, playerId) {
    const payload = {
      type: 0,
      id: playerId,
      turnID: room.turnID,
      names: room.names,
      scores: room.scores,
      colors: room.colors,
      time: room.time,
      turnDurationMs: room.turnDurationMs || config.turnDurationMs,
      round: room.round,
      maxRounds: room.maxRounds,
      hostId: rooms.getHostId(room),
      canStart: rooms.canStartGame(room),
    }
    if (playerId === room.turnID) {
      payload.word = room.ans
    } else if (room.turnID !== -1 && room.currentHint) {
      // A guesser joining/reconnecting mid-turn gets the hint in its
      // current reveal state, same as everyone who was here for the type 4.
      payload.hint = room.currentHint
    }
    sendTo(ws, payload)
  }

  // The only path that ever begins a turn from a standing start (the very
  // first game, or the next one after a game-over reset) — no longer
  // automatic on join/reconnect or after the game-over intermission; the
  // room's host must explicitly request it (type 12).
  function handleStartGame(ws, room) {
    if (ws.playerId !== rooms.getHostId(room)) {
      sendTo(ws, {
        type: 8,
        code: "not_host",
        message: ERROR_MESSAGES.not_host,
      })
      return
    }
    if (!rooms.canStartGame(room)) {
      sendTo(ws, {
        type: 8,
        code: "cannot_start",
        message: ERROR_MESSAGES.cannot_start,
      })
      return
    }
    const drawerId = rooms.getOrderedPlayerIds(room)[0]
    beginNextTurn(room, drawerId)
  }

  function beginNextTurn(room, drawerId) {
    const word = wordBank.pickWord(room.recentWords, room.wordPack)
    const { time } = rooms.beginTurn(room, drawerId, word)
    const drawerWs = room.users[drawerId]
    const message = `S ${room.names[drawerId]} is drawing now.`
    const turnDurationMs = room.turnDurationMs || config.turnDurationMs
    sendTo(drawerWs, {
      type: 4,
      turnID: drawerId,
      word,
      time,
      message,
      turnDurationMs,
      round: room.round,
      maxRounds: room.maxRounds,
    })
    broadcastExcept(room, drawerWs, {
      type: 4,
      turnID: drawerId,
      time,
      message,
      turnDurationMs,
      round: room.round,
      maxRounds: room.maxRounds,
      hint: room.currentHint,
    })
    scheduleRotation(room, time)
    scheduleHintReveals(room, time)
  }

  // Skribbl-style mid-turn help: reveal one random letter of the word to
  // guessers at the halfway and three-quarter marks of the turn. Guarded by
  // the same time-staleness check as scheduleRotation so a reveal armed for
  // an already-superseded turn silently does nothing.
  function scheduleHintReveals(room, time) {
    const turnDurationMs = room.turnDurationMs || config.turnDurationMs
    for (const fraction of [0.5, 0.75]) {
      const handle = setTimeout(
        () => {
          const current = roomStore.getRoom(room.id)
          if (
            !current ||
            !current.time ||
            current.time.getTime() !== time.getTime()
          )
            return
          const hint = rooms.revealHintLetter(current)
          if (!hint) return
          broadcastExcept(current, current.users[current.turnID], {
            type: 13,
            hint,
          })
        },
        Math.floor(turnDurationMs * fraction)
      )
      handle.unref?.() // reveals must never keep a shutting-down process alive
    }
  }

  function rotateTurn(room) {
    const nextId = rooms.computeNextTurnId(room)
    if (nextId === null) {
      rooms.stopTurnTimer(room)
      return
    }
    if (rooms.isRoundComplete(room, nextId)) {
      rooms.advanceRound(room)
      if (rooms.isGameOver(room)) {
        rooms.stopTurnTimer(room)
        endGame(room)
        return
      }
    }
    beginNextTurn(room, nextId)
  }

  // Broadcasts final standings, persists the finished game, and resets the
  // room's score/turn state — the room then just waits at `turnID: -1` for
  // the host to explicitly start the next game (type 12); it does not
  // auto-restart. Broadcast happens *before* the reset: resetForNewGame
  // mutates room.scores/round in place rather than replacing them, so
  // reading them after reset would show the just-zeroed next-game state
  // instead of the game that actually just ended. `canStart` is unaffected
  // by that ordering — the caller (rotateTurn) already called
  // stopTurnTimer before invoking endGame, so turnTimerActive is already
  // false either side of the reset.
  function endGame(room) {
    broadcastExcept(room, null, {
      type: 9,
      names: room.names,
      scores: room.scores,
      colors: room.colors,
      round: room.round,
      maxRounds: room.maxRounds,
      hostId: rooms.getHostId(room),
      canStart: rooms.canStartGame(room),
    })
    logger.info({ roomId: room.id }, "game over")
    persistCompletedGame(room)
    rooms.resetForNewGame(room)
  }

  function scheduleRotation(room, time) {
    const handle = setTimeout(() => {
      const current = roomStore.getRoom(room.id)
      // Stale-timer guard: bail if a newer turn already superseded this one
      // (e.g. an early all-correct-guess rotation). Compared by value, not
      // reference, since the closure and room state may hold distinct Date
      // instances for the same instant.
      if (
        !current ||
        !current.time ||
        current.time.getTime() !== time.getTime()
      )
        return
      rotateTurn(current)
    }, room.turnDurationMs || config.turnDurationMs)
    handle.unref?.() // don't let an in-flight turn keep the process alive during shutdown
  }

  function handleJoin(ws, roomId, msg) {
    let room = roomStore.getRoom(roomId)
    // A socket connecting without ever having called GET /getRoom (bypassing
    // room-settings selection) still gets a working room, just with global
    // defaults instead of chosen settings.
    if (!room) {
      room = roomStore.createRoom(roomId, {
        turnDurationMs: config.turnDurationMs,
        maxPlayers: config.maxPlayersPerRoom,
        wordPack: "default",
      })
    }

    const result = rooms.resolveJoin(room, {
      name: msg.name,
      token: msg.token,
      ws,
      color: msg.color,
      maxPlayers: room.maxPlayers || config.maxPlayersPerRoom,
    })

    if (result.status === "rejected") {
      sendTo(ws, {
        type: 8,
        code: result.reason,
        message: ERROR_MESSAGES[result.reason] || "Could not join the room.",
      })
      return
    }

    ws.roomId = roomId
    ws.playerId = result.playerId

    if (result.status === "reconnected") {
      if (result.oldWs && result.oldWs !== ws) {
        try {
          result.oldWs.close()
        } catch {
          // already closing/closed
        }
      }
      sendJoinAck(ws, room, result.playerId)
      logger.info({ roomId, playerId: result.playerId }, "player reconnected")
      return
    }

    sendJoinAck(ws, room, result.playerId)
    broadcastExcept(room, ws, {
      type: 6,
      name: room.names[result.playerId],
      id: result.playerId,
      names: room.names,
      scores: room.scores,
      colors: room.colors,
      hostId: rooms.getHostId(room),
      canStart: rooms.canStartGame(room),
    })
    logger.info({ roomId, playerId: result.playerId }, "player joined")
  }

  function handleDrawStart(ws, room, msg) {
    if (ws.playerId !== room.turnID) return
    broadcastExcept(room, ws, {
      type: 1,
      x: msg.x,
      y: msg.y,
      color: msg.color,
      strokeWidth: msg.strokeWidth,
    })
  }

  function handleDrawPoint(ws, room, msg) {
    if (ws.playerId !== room.turnID) return
    broadcastExcept(room, ws, { type: 2, x: msg.x, y: msg.y })
  }

  function handleClearCanvas(ws, room) {
    if (ws.playerId !== room.turnID) return
    broadcastExcept(room, ws, { type: 5 })
  }

  function handleFill(ws, room, msg) {
    if (ws.playerId !== room.turnID) return
    broadcastExcept(room, ws, {
      type: 11,
      x: msg.x,
      y: msg.y,
      color: msg.color,
    })
  }

  function handleGuess(ws, room, msg) {
    if (msg.id !== ws.playerId) return // can't guess on someone else's behalf
    if (msg.id === room.turnID) return // drawer can't guess
    if (room.status.includes(msg.id)) return // already guessed correctly this turn
    if (!room.time) return
    const elapsedMs = Date.now() - room.time.getTime()
    if (elapsedMs > (room.turnDurationMs || config.turnDurationMs)) return

    const isCorrect = msg.message.trim().toLowerCase() === room.ans

    if (isCorrect) {
      rooms.applyCorrectGuess(room, msg.id, elapsedMs)
      const payload = {
        type: 3,
        id: msg.id,
        message: `G ${room.names[msg.id]} guessed the word!👏👏`,
        isTrue: true,
        scores: room.scores,
      }
      broadcastExcept(room, ws, payload)
      sendTo(ws, payload)
      if (rooms.allNonDrawerGuessed(room)) {
        rotateTurn(room)
      }
    } else {
      const payload = {
        type: 3,
        id: msg.id,
        message: `B ${room.names[msg.id]} : ${msg.message}`,
        isTrue: false,
      }
      broadcastExcept(room, ws, payload)
      sendTo(ws, payload)
      const guess = msg.message.trim().toLowerCase()
      if (guessMatch.isCloseGuess(guess, room.ans)) {
        sendTo(ws, {
          type: 3,
          id: msg.id,
          message: "C So close! 🔥",
          isTrue: false,
        })
      }
    }
  }

  function persistCompletedGame(room) {
    if (room.roundsCompleted === 0) return
    const activePlayers = rooms.getOrderedPlayerIds(room).map((id) => ({
      name: room.names[id],
      score: room.scores[id] || 0,
    }))
    try {
      db.recordGameEnd(dbHandle, {
        roomId: room.id,
        startedAt: (room.startedAt || new Date()).toISOString(),
        endedAt: new Date().toISOString(),
        rounds: room.roundsCompleted,
        players: [...room.history, ...activePlayers],
      })
    } catch (err) {
      logger.error({ err: err.message }, "failed to persist completed game")
    }
  }

  function maybePersistAndDeleteRoom(room) {
    persistCompletedGame(room)
    roomStore.deleteRoom(room.id)
    logger.info({ roomId: room.id }, "room removed")
  }

  function finalizeDisconnect(roomId, playerId) {
    const room = roomStore.getRoom(roomId)
    if (!room) return
    if (!rooms.hasPendingRemoval(room, playerId)) return // already reconnected
    const { name } = rooms.finalizeRemoval(room, playerId)
    broadcastExcept(room, null, {
      type: 7,
      name,
      id: playerId,
      names: room.names,
      scores: room.scores,
      colors: room.colors,
      hostId: rooms.getHostId(room),
      canStart: rooms.canStartGame(room),
    })
    logger.info({ roomId, playerId }, "player fully removed after grace period")

    if (rooms.isIdle(room)) {
      maybePersistAndDeleteRoom(room)
    }
  }

  function handleClose(ws) {
    const { roomId, playerId } = ws
    if (roomId == null || playerId == null) return
    const room = roomStore.getRoom(roomId)
    if (!room) return
    // This socket may already have been evicted by a newer connection for
    // the same identity (adopt-and-evict on reconnect) — if so, the newer
    // socket owns this player now and we must not touch their state.
    if (room.users[playerId] !== ws) return
    rooms.removeFromActive(room, playerId)
    const timeoutHandle = setTimeout(
      () => finalizeDisconnect(roomId, playerId),
      config.reconnectGraceMs
    )
    timeoutHandle.unref?.() // a pending reconnect shouldn't keep the process alive during shutdown
    rooms.setPendingRemoval(room, playerId, timeoutHandle)
    logger.info(
      { roomId, playerId },
      "player disconnected, reconnect grace period started"
    )
  }

  wsServer.on("connection", (ws, req) => {
    ws.isAlive = true
    ws.on("pong", () => {
      ws.isAlive = true
    })

    const roomId = decodeURIComponent((req.url || "").slice(1))
    const bucket = new TokenBucket({ capacity: 40, refillPerSecond: 20 })

    ws.on("message", (raw) => {
      try {
        const parsed = validation.parseClientMessage(raw)
        if (!parsed.ok) return
        if (!bucket.tryConsume()) return

        if (parsed.data.type === 0) {
          handleJoin(ws, roomId, parsed.data)
          return
        }

        if (parsed.data.type === 10) {
          sendTo(ws, {
            type: 10,
            clientTime: parsed.data.clientTime,
            serverTime: Date.now(),
          })
          return
        }

        if (ws.roomId == null || ws.playerId == null) return // must join first
        const room = roomStore.getRoom(ws.roomId)
        if (!room) return

        switch (parsed.data.type) {
          case 1:
            handleDrawStart(ws, room, parsed.data)
            break
          case 2:
            handleDrawPoint(ws, room, parsed.data)
            break
          case 3:
            handleGuess(ws, room, parsed.data)
            break
          case 5:
            handleClearCanvas(ws, room)
            break
          case 11:
            handleFill(ws, room, parsed.data)
            break
          case 12:
            handleStartGame(ws, room)
            break
        }
      } catch (err) {
        logger.error(
          { err: err.message },
          "unhandled error processing ws message"
        )
      }
    })

    ws.on("close", () => handleClose(ws))
    ws.on("error", (err) =>
      logger.warn({ err: err.message }, "ws connection error")
    )
  })

  const heartbeat = setInterval(() => {
    wsServer.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate()
        return
      }
      ws.isAlive = false
      ws.ping()
    })
  }, HEARTBEAT_INTERVAL_MS)

  const reaper = setInterval(() => {
    const now = Date.now()
    for (const room of roomStore.allRooms()) {
      if (
        rooms.isIdle(room) &&
        now - room.lastActivity > config.roomIdleTtlMs
      ) {
        roomStore.deleteRoom(room.id)
        logger.info({ roomId: room.id }, "reaped idle room")
      }
    }
  }, config.roomReaperIntervalMs)

  function close(cb) {
    clearInterval(heartbeat)
    clearInterval(reaper)
    // Cancel every in-flight reconnect grace timer up front — otherwise a
    // socket closing during shutdown starts a new one (see handleClose),
    // and it would fire after dbHandle.close() below, right as its
    // completed-game persist attempt needs that same handle.
    for (const room of roomStore.allRooms()) {
      for (const id of Object.keys(room.pendingRemoval)) {
        rooms.cancelPendingRemoval(room, Number(id))
      }
    }
    wsServer.clients.forEach((ws) => ws.close(1001, "Server shutting down"))
    server.close(() => {
      try {
        dbHandle.close()
      } catch {
        // already closed
      }
      if (cb) cb()
    })
  }

  return { app, server, wsServer, roomStore, dbHandle, close }
}

if (require.main === module) {
  const { server, close } = createServer()
  server.listen(config.port, () => {
    logger.info({ port: config.port }, "server listening")
  })

  const shutdown = (signal) => {
    logger.info({ signal }, "shutting down")
    close(() => process.exit(0))
    setTimeout(() => process.exit(1), 5000).unref()
  }
  process.on("SIGTERM", () => shutdown("SIGTERM"))
  process.on("SIGINT", () => shutdown("SIGINT"))
}

module.exports = { createServer }
