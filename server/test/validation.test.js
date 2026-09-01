const test = require("node:test")
const assert = require("node:assert/strict")
const { parseClientMessage, validatePlayerName } = require("../src/validation")

test("parseClientMessage accepts a valid join message", () => {
  const result = parseClientMessage(
    JSON.stringify({ type: 0, name: "Alice", token: "abc" })
  )
  assert.equal(result.ok, true)
  assert.equal(result.data.name, "Alice")
})

test("parseClientMessage accepts a join message without a token", () => {
  const result = parseClientMessage(JSON.stringify({ type: 0, name: "Alice" }))
  assert.equal(result.ok, true)
})

test("parseClientMessage rejects malformed JSON", () => {
  assert.equal(parseClientMessage("not json").ok, false)
})

test("parseClientMessage rejects an unknown type", () => {
  assert.equal(parseClientMessage(JSON.stringify({ type: 99 })).ok, false)
})

test("parseClientMessage rejects a guess with a non-numeric id", () => {
  const result = parseClientMessage(
    JSON.stringify({ type: 3, id: "1", message: "x" })
  )
  assert.equal(result.ok, false)
})

test("parseClientMessage rejects a draw-start missing required fields", () => {
  const result = parseClientMessage(JSON.stringify({ type: 1, x: 1, y: 1 }))
  assert.equal(result.ok, false)
})

test("parseClientMessage accepts a valid fill message", () => {
  const result = parseClientMessage(
    JSON.stringify({ type: 11, x: 40, y: 60, color: "#F59E0B" })
  )
  assert.equal(result.ok, true)
  assert.equal(result.data.color, "#F59E0B")
})

test("parseClientMessage rejects a fill missing required fields", () => {
  const result = parseClientMessage(JSON.stringify({ type: 11, x: 1, y: 1 }))
  assert.equal(result.ok, false)
})

test("parseClientMessage accepts a start-game message", () => {
  const result = parseClientMessage(JSON.stringify({ type: 12 }))
  assert.equal(result.ok, true)
})

test("validatePlayerName trims surrounding whitespace", () => {
  const result = validatePlayerName("  Bob  ")
  assert.equal(result.ok, true)
  assert.equal(result.value, "Bob")
})

test("validatePlayerName rejects empty names", () => {
  assert.equal(validatePlayerName("").ok, false)
  assert.equal(validatePlayerName("   ").ok, false)
})

test("validatePlayerName rejects names over 8 characters", () => {
  assert.equal(validatePlayerName("WayTooLongName").ok, false)
})

test("validatePlayerName rejects multi-word names", () => {
  assert.equal(validatePlayerName("two words").ok, false)
})
