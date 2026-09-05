const test = require("node:test")
const assert = require("node:assert/strict")
const { levenshtein, isCloseGuess } = require("../src/guessMatch")

test("levenshtein computes edit distance", () => {
  assert.equal(levenshtein("kitten", "sitting"), 3)
  assert.equal(levenshtein("piano", "piano"), 0)
  assert.equal(levenshtein("", "abc"), 3)
})

test("isCloseGuess is false for an exact match", () => {
  assert.equal(isCloseGuess("piano", "piano"), false)
})

test("isCloseGuess is true for an off-by-one-letter guess on a longer word", () => {
  assert.equal(isCloseGuess("pizzx", "pizza"), true)
  assert.equal(isCloseGuess("elephnt", "elephant"), true)
})

test("isCloseGuess requires an exact-adjacent guess on short (<=4 char) words", () => {
  assert.equal(isCloseGuess("bat", "cat"), true)
  assert.equal(isCloseGuess("box", "fox"), true)
  assert.equal(isCloseGuess("dog", "fox"), false)
})

test("isCloseGuess is false for a wildly different guess", () => {
  assert.equal(isCloseGuess("zebra", "elephant"), false)
  assert.equal(isCloseGuess("banana", "rocket"), false)
})

test("isCloseGuess scales its threshold for a multi-word answer", () => {
  assert.equal(isCloseGuess("time machin", "time machine"), true)
  assert.equal(isCloseGuess("space ship", "time machine"), false)
})

test("isCloseGuess is false for an empty guess", () => {
  assert.equal(isCloseGuess("", "piano"), false)
})
