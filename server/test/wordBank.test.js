const test = require("node:test")
const assert = require("node:assert/strict")
const { PACKS, packNames, isValidPack, pickWord } = require("../src/wordBank")

test("packNames lists every known pack, and isValidPack agrees", () => {
  const names = packNames()
  assert.ok(names.includes("default"))
  assert.ok(names.length >= 2)
  for (const name of names) {
    assert.equal(isValidPack(name), true)
  }
  assert.equal(isValidPack("not-a-real-pack"), false)
})

test("pickWord returns a word from the requested pack", () => {
  for (const name of packNames()) {
    assert.ok(PACKS[name].includes(pickWord([], name)))
  }
})

test("pickWord defaults to the default pack for an unknown pack name", () => {
  assert.ok(PACKS.default.includes(pickWord([], "not-a-real-pack")))
})

test("pickWord avoids recently-used words when an alternative exists", () => {
  const words = PACKS.default
  const recent = words.slice(0, words.length - 1)
  const untouched = words[words.length - 1]
  for (let i = 0; i < 25; i++) {
    assert.equal(pickWord(recent, "default"), untouched)
  }
})

test("pickWord falls back to the full pack once everything is recent", () => {
  assert.ok(PACKS.default.includes(pickWord(PACKS.default, "default")))
})
