const test = require("node:test")
const assert = require("node:assert/strict")
const { scoreForGuesser, scoreForDrawer } = require("../src/scoring")

test("scoreForGuesser decays linearly from 100 to 0 over the turn window", () => {
  assert.equal(scoreForGuesser(0), 100)
  assert.equal(scoreForGuesser(6000), 90)
  assert.equal(scoreForGuesser(60000), 0)
})

test("scoreForGuesser never goes negative past the window", () => {
  assert.equal(scoreForGuesser(120000), 0)
})

test("scoreForDrawer decays linearly from 50 to 0 over the turn window", () => {
  assert.equal(scoreForDrawer(0), 50)
  assert.equal(scoreForDrawer(60000), 0)
})

test("scoreForDrawer never goes negative past the window", () => {
  assert.equal(scoreForDrawer(120000), 0)
})
