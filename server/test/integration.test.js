const test = require("node:test")
const assert = require("node:assert/strict")
const WebSocket = require("ws")
const { createServer } = require("../index")
const db = require("../src/db")
const rooms = require("../src/rooms")

function createClient(port, roomId) {
  const ws = new WebSocket(`ws://localhost:${port}/${roomId}`)
  const client = { ws, msgs: [], id: null }
  ws.on("message", (raw) => {
    const msg = JSON.parse(raw)
    client.msgs.push(msg)
    if (msg.type === 0 && client.id === null) client.id = msg.id
  })
  return client
}

function join(client, name, token, color) {
  return new Promise((resolve) => {
    client.ws.once("open", () => {
      client.ws.send(JSON.stringify({ type: 0, name, token, color }))
      resolve()
    })
  })
}

function startGame(client) {
  client.ws.send(JSON.stringify({ type: 12 }))
}

function waitFor(client, predicate, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const check = () => {
      const found = client.msgs.find(predicate)
      if (found) return resolve(found)
      if (Date.now() - start > timeoutMs)
        return reject(new Error("timed out waiting for message"))
      setTimeout(check, 20)
    }
    check()
  })
}

async function startTestServer() {
  const dbHandle = db.initDb(":memory:")
  const instance = createServer({ dbHandle })
  await new Promise((resolve) => instance.server.listen(0, resolve))
  return { instance, port: instance.server.address().port }
}

test("full game flow: join, draw relay, guess authorization/scoring, turn rotation", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "integration-room"
  const alice = createClient(port, roomId)
  const bob = createClient(port, roomId)
  await join(alice, "Alice", "tok-a")
  await join(bob, "Bob", "tok-b")
  await waitFor(alice, (m) => m.type === 0)
  // Bob's ack reflects room state as of his join (after Alice's) — Alice's
  // own ack predates Bob, so it'd still show canStart: false at that point.
  const bobAck = await waitFor(bob, (m) => m.type === 0)

  // Alice joined first, so she's the host — the game does not start on its
  // own once 2 players are present; she must explicitly request it.
  assert.equal(bobAck.hostId, alice.id)
  assert.equal(bobAck.canStart, true)
  startGame(alice)

  const turnMsg = await waitFor(alice, (m) => m.type === 4)
  const [drawer, guesser] =
    turnMsg.turnID === alice.id ? [alice, bob] : [bob, alice]

  // The guesser's turn message must carry the masked hint but never the
  // word; the drawer's carries the word but no hint.
  const guesserTurnMsg = await waitFor(guesser, (m) => m.type === 4)
  assert.equal(guesserTurnMsg.word, undefined)
  assert.match(guesserTurnMsg.hint, /^[_\s]+$/)
  const drawerTurnMsg = drawer.msgs.find((m) => m.type === 4)
  assert.equal(drawerTurnMsg.hint, undefined)
  assert.equal(guesserTurnMsg.hint.length, drawerTurnMsg.word.length)

  drawer.ws.send(
    JSON.stringify({ type: 1, x: 1, y: 1, color: "#000", strokeWidth: 2 })
  )
  drawer.ws.send(JSON.stringify({ type: 2, x: 5, y: 5 }))
  const relay = await waitFor(guesser, (m) => m.type === 2)
  assert.deepEqual(relay, { type: 2, x: 5, y: 5 })

  // A non-drawer's draw attempt must never be relayed to anyone.
  const type1CountBefore = drawer.msgs.filter((m) => m.type === 1).length
  guesser.ws.send(
    JSON.stringify({ type: 1, x: 9, y: 9, color: "#fff", strokeWidth: 2 })
  )
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(drawer.msgs.filter((m) => m.type === 1).length, type1CountBefore)

  const secretWord = drawer.msgs.find((m) => m.type === 4 && m.word).word

  guesser.ws.send(JSON.stringify({ type: 3, id: guesser.id, message: "nope" }))
  const wrong = await waitFor(
    guesser,
    (m) => m.type === 3 && m.isTrue === false
  )
  assert.match(wrong.message, /^B /)

  // Guessing on behalf of someone else's id must be silently ignored.
  const scoresBefore = JSON.stringify(instance.roomStore.getRoom(roomId).scores)
  guesser.ws.send(
    JSON.stringify({ type: 3, id: drawer.id, message: secretWord })
  )
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(
    JSON.stringify(instance.roomStore.getRoom(roomId).scores),
    scoresBefore
  )

  guesser.ws.send(
    JSON.stringify({
      type: 3,
      id: guesser.id,
      message: secretWord.toUpperCase(),
    })
  )
  const correct = await waitFor(
    guesser,
    (m) => m.type === 3 && m.isTrue === true
  )
  // Scores decay with real elapsed time, so allow slack for network/test overhead
  // rather than asserting the theoretical zero-elapsed-time maximum.
  assert.ok(
    correct.scores[guesser.id] > 90 && correct.scores[guesser.id] <= 100
  )
  assert.ok(correct.scores[drawer.id] > 40 && correct.scores[drawer.id] <= 50)

  const nextTurn = await waitFor(
    guesser,
    (m) => m.type === 4 && m.turnID !== turnMsg.turnID
  )
  assert.notEqual(nextTurn.turnID, turnMsg.turnID)

  alice.ws.close()
  bob.ws.close()
})

test("the game never starts on its own — a non-host cannot start it, and the host can once ready", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "host-gated-room"
  const alice = createClient(port, roomId)
  await join(alice, "Alice", "tok-a")
  const aliceAck = await waitFor(alice, (m) => m.type === 0)
  assert.equal(aliceAck.canStart, false) // only 1 player so far

  // Alice alone can't start either — not enough players.
  startGame(alice)
  const cannotStart = await waitFor(alice, (m) => m.type === 8)
  assert.equal(cannotStart.code, "cannot_start")

  const bob = createClient(port, roomId)
  await join(bob, "Bob", "tok-b")
  const bobAck = await waitFor(bob, (m) => m.type === 0)
  assert.equal(bobAck.hostId, alice.id) // Alice joined first
  assert.equal(bobAck.canStart, true)

  // Bob (not the host) tries to start — rejected, and no turn begins.
  startGame(bob)
  const notHost = await waitFor(bob, (m) => m.type === 8)
  assert.equal(notHost.code, "not_host")
  await new Promise((r) => setTimeout(r, 50))
  assert.equal(alice.msgs.some((m) => m.type === 4), false)

  // The host starts it — now it actually begins.
  startGame(alice)
  await waitFor(alice, (m) => m.type === 4)

  alice.ws.close()
  bob.ws.close()
})

test("host status transfers to the next-lowest active id the instant the host disconnects", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "host-transfer-room"
  const alice = createClient(port, roomId)
  const bob = createClient(port, roomId)
  await join(alice, "Alice", "tok-a")
  await join(bob, "Bob", "tok-b")
  await waitFor(alice, (m) => m.type === 0)
  await waitFor(bob, (m) => m.type === 0)

  alice.ws.close()
  await new Promise((resolve) => alice.ws.once("close", resolve))
  await new Promise((r) => setTimeout(r, 50)) // let the server's close handler run

  // Host is derived from the lowest *active* id, so it transfers the moment
  // Alice drops out of room.users — no need to wait out her reconnect grace
  // window (RECONNECT_GRACE_MS, ~45s in production) to see it happen.
  const room = instance.roomStore.getRoom(roomId)
  assert.equal(rooms.getHostId(room), bob.id)
  assert.equal(rooms.canStartGame(room), false) // only 1 active player left now

  bob.ws.close()
})

test("room settings created via /getRoom (word pack, turn duration) flow through to gameplay", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "custom-settings-room"
  instance.roomStore.createRoom(roomId, {
    turnDurationMs: 20000,
    maxPlayers: 8,
    wordPack: "animals",
  })

  const alice = createClient(port, roomId)
  const bob = createClient(port, roomId)
  await join(alice, "Alice", "tok-a", "#123ABC")
  await join(bob, "Bob", "tok-b")

  const aliceAck = await waitFor(alice, (m) => m.type === 0)
  assert.equal(aliceAck.turnDurationMs, 20000)
  assert.equal(aliceAck.colors[alice.id], "#123ABC")

  // Bob's own ack reflects the room state as of his join, by which point
  // Alice's color is already set — Alice's own ack predates Bob joining.
  const bobAck = await waitFor(bob, (m) => m.type === 0)
  assert.equal(bobAck.colors[alice.id], "#123ABC")
  assert.match(bobAck.colors[bob.id], /^#[0-9a-fA-F]{6}$/) // bob gets a fallback color

  startGame(alice)
  const turnMsg = await waitFor(alice, (m) => m.type === 4)
  assert.equal(turnMsg.turnDurationMs, 20000)
  const drawer = turnMsg.turnID === alice.id ? alice : bob
  const word = drawer.msgs.find((m) => m.type === 4 && m.word).word
  const { PACKS } = require("../src/wordBank")
  assert.ok(
    PACKS.animals.includes(word),
    `expected "${word}" to come from the animals pack`
  )

  alice.ws.close()
  bob.ws.close()
})

test("a 1-round game ends with type:9 and waits for the host to start the next one", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "one-round-room"
  instance.roomStore.createRoom(roomId, {
    turnDurationMs: 60000,
    maxPlayers: 8,
    wordPack: "default",
    maxRounds: 1,
  })

  const alice = createClient(port, roomId)
  const bob = createClient(port, roomId)
  await join(alice, "Alice", "tok-a")
  await join(bob, "Bob", "tok-b")
  await waitFor(alice, (m) => m.type === 0)
  await waitFor(bob, (m) => m.type === 0)

  startGame(alice)
  const turn1 = await waitFor(alice, (m) => m.type === 4)
  assert.equal(turn1.round, 1)
  let [drawer, guesser] = turn1.turnID === alice.id ? [alice, bob] : [bob, alice]
  let word = drawer.msgs.find((m) => m.type === 4 && m.word).word
  guesser.ws.send(JSON.stringify({ type: 3, id: guesser.id, message: word }))

  // Everyone but the drawer guessed correctly, so turn 2 (still round 1,
  // 2 players) starts immediately without waiting out the 60s timer.
  const turn2 = await waitFor(
    guesser,
    (m) => m.type === 4 && m.turnID !== turn1.turnID
  )
  assert.equal(turn2.round, 1)
  ;[drawer, guesser] = turn2.turnID === alice.id ? [alice, bob] : [bob, alice]
  word = drawer.msgs.find(
    (m) => m.type === 4 && m.turnID === turn2.turnID && m.word
  ).word
  guesser.ws.send(JSON.stringify({ type: 3, id: guesser.id, message: word }))

  // Both players have now drawn once — round 1 (the only round) is complete.
  const gameOver = await waitFor(alice, (m) => m.type === 9)
  assert.equal(gameOver.scores[guesser.id] > 0, true)
  assert.equal(gameOver.hostId, alice.id)
  assert.equal(gameOver.canStart, true) // both players still here, ready to go again

  // No new turn should start on its own.
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(
    alice.msgs.some((m) => m.type === 4 && m.turnID !== turn1.turnID && m.turnID !== turn2.turnID),
    false
  )

  const room = instance.roomStore.getRoom(roomId)
  assert.deepEqual(room.scores, { [alice.id]: 0, [bob.id]: 0 }) // reset immediately, not delayed
  assert.equal(room.round, 1)

  // The host explicitly starts the next game.
  startGame(alice)
  const newGameTurn = await waitFor(
    alice,
    (m) =>
      m.type === 4 &&
      new Date(m.time).getTime() > new Date(turn2.time).getTime()
  )
  assert.equal(newGameTurn.round, 1)

  alice.ws.close()
  bob.ws.close()
})

test("a rejected join (room full) gets a type:8 error and no player slot", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "full-room"
  const a = createClient(port, roomId)
  await join(a, "A", "tok-a")
  await waitFor(a, (m) => m.type === 0)

  for (let i = 0; i < 7; i++) {
    // fill remaining slots up to the default maxPlayersPerRoom (8)
    const filler = createClient(port, roomId)
    await join(filler, `P${i}`, `tok-filler-${i}`)
    await waitFor(filler, (m) => m.type === 0)
  }

  const rejected = createClient(port, roomId)
  await join(rejected, "TooMany", "tok-toomany")
  const errorMsg = await waitFor(rejected, (m) => m.type === 8)
  assert.equal(errorMsg.code, "room_full")
})

test("disconnecting starts a reconnect grace period instead of instantly deleting the player", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const roomId = "integration-room-2"
  const alice = createClient(port, roomId)
  await join(alice, "Alice", "tok-a")
  await waitFor(alice, (m) => m.type === 0)

  alice.ws.close()
  await new Promise((resolve) => alice.ws.once("close", resolve))
  await new Promise((r) => setTimeout(r, 50)) // let the server's close handler run

  const room = instance.roomStore.getRoom(roomId)
  assert.ok(room, "room should still exist during the grace window")
  assert.equal(room.users[alice.id], undefined)
  assert.equal(room.names[alice.id], "Alice") // not purged yet
  assert.equal(rooms.hasPendingRemoval(room, alice.id), true)
})
