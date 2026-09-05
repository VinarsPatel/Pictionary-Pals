const test = require("node:test")
const assert = require("node:assert/strict")
const http = require("node:http")
const { createServer } = require("../index")
const db = require("../src/db")

function get(port, pathName) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://localhost:${port}${pathName}`, (res) => {
        let body = ""
        res.on("data", (chunk) => (body += chunk))
        res.on("end", () =>
          resolve({ status: res.statusCode, body: JSON.parse(body) })
        )
      })
      .on("error", reject)
  })
}

async function startTestServer(dbHandle = db.initDb(":memory:")) {
  const instance = createServer({ dbHandle })
  await new Promise((resolve) => instance.server.listen(0, resolve))
  return { instance, port: instance.server.address().port }
}

test("GET /getRoom returns a fresh room id", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { status, body } = await get(port, "/getRoom")
  assert.equal(status, 200)
  assert.equal(body.success, true)
  assert.equal(typeof body.roomId, "string")
  assert.ok(body.roomId.length > 0)
})

test("GET /getRoom honors valid turnDurationMs/maxPlayers/wordPack query params", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { status, body } = await get(
    port,
    "/getRoom?turnDurationMs=90000&maxPlayers=5&wordPack=animals"
  )
  assert.equal(status, 200)
  assert.equal(body.turnDurationMs, 90000)
  assert.equal(body.maxPlayers, 5)
  assert.equal(body.wordPack, "animals")

  const room = instance.roomStore.getRoom(body.roomId)
  assert.equal(room.turnDurationMs, 90000)
  assert.equal(room.maxPlayers, 5)
  assert.equal(room.wordPack, "animals")
})

test("GET /getRoom clamps out-of-range settings and rejects unknown word packs", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { body } = await get(
    port,
    "/getRoom?turnDurationMs=1&maxPlayers=999&wordPack=not-a-real-pack"
  )
  assert.ok(
    body.turnDurationMs >= 15000,
    "turnDurationMs should be clamped to the minimum"
  )
  assert.ok(
    body.maxPlayers <= 10,
    "maxPlayers should be clamped to the hard cap"
  )
  assert.equal(body.wordPack, "default")
})

test("GET /getRoom defaults to global config when no query params are given", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { body } = await get(port, "/getRoom")
  assert.equal(body.wordPack, "default")
  assert.ok(Number.isFinite(body.turnDurationMs))
  assert.ok(Number.isFinite(body.maxPlayers))
})

test("GET /quickplay creates a public room when none is joinable", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { status, body } = await get(port, "/quickplay")
  assert.equal(status, 200)
  assert.equal(body.success, true)
  const room = instance.roomStore.getRoom(body.roomId)
  assert.equal(room.isPublic, true)
})

test("GET /quickplay reuses an existing open public room instead of making a new one", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const first = await get(port, "/quickplay")
  const second = await get(port, "/quickplay")
  assert.equal(first.body.roomId, second.body.roomId)
})

test("GET /quickplay skips a full public room and makes a new one", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const first = await get(port, "/quickplay")
  const fullRoom = instance.roomStore.getRoom(first.body.roomId)
  for (let i = 0; i < fullRoom.maxPlayers; i++) {
    fullRoom.users[i + 100] = { readyState: 1 }
  }

  const second = await get(port, "/quickplay")
  assert.notEqual(second.body.roomId, first.body.roomId)
})

test("GET /health reports ok status and room count", async (t) => {
  const { instance, port } = await startTestServer()
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { status, body } = await get(port, "/health")
  assert.equal(status, 200)
  assert.equal(body.status, "ok")
  assert.equal(body.rooms, 0)
})

test("GET /api/games/recent returns previously persisted games", async (t) => {
  const dbHandle = db.initDb(":memory:")
  db.recordGameEnd(dbHandle, {
    roomId: "r1",
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    rounds: 2,
    players: [{ name: "Alice", score: 10 }],
  })
  const { instance, port } = await startTestServer(dbHandle)
  t.after(() => new Promise((resolve) => instance.close(resolve)))

  const { status, body } = await get(port, "/api/games/recent")
  assert.equal(status, 200)
  assert.equal(body.games.length, 1)
  assert.equal(body.games[0].roomId, "r1")
})
