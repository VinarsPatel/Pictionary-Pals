const { z } = require("zod")

// Client -> server message shapes, keyed by the `type` discriminator.
// Anything that doesn't parse is dropped by the caller — see index.js.
const JoinMessage = z.object({
  type: z.literal(0),
  name: z.string().min(1).max(32),
  token: z.string().min(1).max(100).optional(),
  // Loosely bounded on purpose: an invalid/missing color falls back to an
  // auto-assigned one in rooms.js rather than rejecting the whole join over
  // a cosmetic field.
  color: z.string().min(1).max(20).optional(),
})

const StartStrokeMessage = z.object({
  type: z.literal(1),
  x: z.number(),
  y: z.number(),
  color: z.string().min(1).max(20),
  strokeWidth: z.number().min(1).max(50),
})

const DrawPointMessage = z.object({
  type: z.literal(2),
  x: z.number(),
  y: z.number(),
})

const GuessMessage = z.object({
  type: z.literal(3),
  id: z.number().int(),
  message: z.string().min(1).max(200),
})

const ClearCanvasMessage = z.object({
  type: z.literal(5),
})

const FillMessage = z.object({
  type: z.literal(11),
  x: z.number(),
  y: z.number(),
  color: z.string().min(1).max(20),
})

// Clock-sync ping: the client echoes its own Date.now() so it can pair the
// reply's serverTime against a round-trip-corrected send time (see index.js
// and GameArena.jsx) — this is what lets clients on skewed system clocks
// compute the turn countdown from a common time base instead of raw
// Date.now(), which otherwise makes the countdown differ between clients.
const TimeSyncMessage = z.object({
  type: z.literal(10),
  clientTime: z.number(),
})

// Sent by the room host to begin a game (the very first one, or the next
// one after a game-over) — see rooms.js's getHostId/canStartGame and
// index.js's handleStartGame. No fields beyond the type: the server derives
// who's allowed to send this from the connection itself (ws.playerId), not
// from anything the client claims.
const StartGameMessage = z.object({
  type: z.literal(12),
})

const ClientMessage = z.discriminatedUnion("type", [
  JoinMessage,
  StartStrokeMessage,
  DrawPointMessage,
  GuessMessage,
  ClearCanvasMessage,
  FillMessage,
  TimeSyncMessage,
  StartGameMessage,
])

function parseClientMessage(raw) {
  let json
  try {
    json = JSON.parse(raw)
  } catch {
    return { ok: false, reason: "invalid_json" }
  }
  const result = ClientMessage.safeParse(json)
  if (!result.success) return { ok: false, reason: "invalid_shape" }
  return { ok: true, data: result.data }
}

// Re-validated server-side because the client-side check isn't authoritative.
function validatePlayerName(rawName) {
  const name = (rawName || "").trim()
  if (name.length === 0) return { ok: false, reason: "name_required" }
  if (name.length > 8) return { ok: false, reason: "name_too_long" }
  if (/\s/.test(name)) return { ok: false, reason: "name_single_word" }
  return { ok: true, value: name }
}

module.exports = { parseClientMessage, validatePlayerName }
