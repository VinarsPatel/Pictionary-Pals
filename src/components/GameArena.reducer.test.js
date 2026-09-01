import { reducer, initialState } from "./GameArena"

test("setAll populates id/turnID/names/scores/colors/turnDurationMs/hostId/canStart from a join ack", () => {
  const next = reducer(initialState, {
    type: "setAll",
    id: 1,
    turnID: -1,
    names: { 1: "Alice" },
    scores: { 1: 0 },
    colors: { 1: "#F94144" },
    turnDurationMs: 90000,
    round: 2,
    maxRounds: 5,
    hostId: 1,
    canStart: true,
  })
  expect(next.id).toBe(1)
  expect(next.turnID).toBe(-1)
  expect(next.names).toEqual({ 1: "Alice" })
  expect(next.scores).toEqual({ 1: 0 })
  expect(next.colors).toEqual({ 1: "#F94144" })
  expect(next.turnDurationMs).toBe(90000)
  expect(next.round).toBe(2)
  expect(next.maxRounds).toBe(5)
  expect(next.hostId).toBe(1)
  expect(next.canStart).toBe(true)
})

test("setAll falls back to the previous turnDurationMs if the ack omits it", () => {
  const state = { ...initialState, turnDurationMs: 90000 }
  const next = reducer(state, {
    type: "setAll",
    id: 1,
    turnID: -1,
    names: { 1: "Alice" },
    scores: { 1: 0 },
  })
  expect(next.turnDurationMs).toBe(90000)
})

test("addMsg appends to msgArr without mutating the previous array", () => {
  const state = { ...initialState, msgArr: ["O Alice joined the room."] }
  const next = reducer(state, { type: "addMsg", msg: "B Bob : wrong" })
  expect(next.msgArr).toEqual(["O Alice joined the room.", "B Bob : wrong"])
  expect(state.msgArr).toEqual(["O Alice joined the room."]) // original untouched
})

test("correctGuess updates scores and appends the guess message", () => {
  const state = { ...initialState, scores: { 1: 0, 2: 0 }, msgArr: [] }
  const next = reducer(state, {
    type: "correctGuess",
    scores: { 1: 50, 2: 100 },
    msg: "G Bob guessed the word!",
  })
  expect(next.scores).toEqual({ 1: 50, 2: 100 })
  expect(next.msgArr).toEqual(["G Bob guessed the word!"])
})

test("changeTurn updates turnID/word/round and appends a system message", () => {
  const state = { ...initialState, turnID: 1, word: "apple", msgArr: [] }
  const next = reducer(state, {
    type: "changeTurn",
    turnID: 2,
    word: undefined,
    round: 2,
    maxRounds: 3,
    msg: "S Bob is drawing now.",
  })
  expect(next.turnID).toBe(2)
  expect(next.word).toBeUndefined()
  expect(next.round).toBe(2)
  expect(next.maxRounds).toBe(3)
  expect(next.msgArr).toEqual(["S Bob is drawing now."])
})

test("changeTurn clears any previous game-over overlay", () => {
  const state = { ...initialState, gameOver: { round: 3, maxRounds: 3 }, msgArr: [] }
  const next = reducer(state, {
    type: "changeTurn",
    turnID: 1,
    round: 1,
    msg: "S Alice is drawing now.",
  })
  expect(next.gameOver).toBeNull()
})

test("gameOver stores the final standings snapshot and top-level hostId/canStart", () => {
  const next = reducer(initialState, {
    type: "gameOver",
    names: { 1: "Alice", 2: "Bob" },
    scores: { 1: 120, 2: 80 },
    colors: { 1: "#F94144", 2: "#277DA1" },
    round: 3,
    maxRounds: 3,
    hostId: 1,
    canStart: true,
  })
  expect(next.gameOver).toEqual({
    names: { 1: "Alice", 2: "Bob" },
    scores: { 1: 120, 2: 80 },
    colors: { 1: "#F94144", 2: "#277DA1" },
    round: 3,
    maxRounds: 3,
  })
  expect(next.hostId).toBe(1)
  expect(next.canStart).toBe(true)
})

test("deltaPlayer updates the roster (incl. colors/hostId/canStart) and appends a join/leave message", () => {
  const state = {
    ...initialState,
    names: { 1: "Alice" },
    scores: { 1: 0 },
    colors: { 1: "#F94144" },
    hostId: 1,
    canStart: false,
    msgArr: [],
  }
  const next = reducer(state, {
    type: "deltaPlayer",
    names: { 1: "Alice", 2: "Bob" },
    scores: { 1: 0, 2: 0 },
    colors: { 1: "#F94144", 2: "#277DA1" },
    hostId: 1,
    canStart: true,
    msg: "O Bob joined the room.",
  })
  expect(next.names).toEqual({ 1: "Alice", 2: "Bob" })
  expect(next.colors).toEqual({ 1: "#F94144", 2: "#277DA1" })
  expect(next.hostId).toBe(1)
  expect(next.canStart).toBe(true)
  expect(next.msgArr).toEqual(["O Bob joined the room."])
})

test("changeTurn stores the guesser hint, and clears it when absent (drawer)", () => {
  const withHint = reducer(initialState, {
    type: "changeTurn",
    turnID: 2,
    hint: "___ ___",
    msg: "S Bob is drawing now.",
  })
  expect(withHint.hint).toBe("___ ___")

  const drawerTurn = reducer(withHint, {
    type: "changeTurn",
    turnID: 1,
    word: "guitar",
    msg: "S Alice is drawing now.",
  })
  expect(drawerTurn.hint).toBe("")
})

test("setHint replaces the hint (mid-turn letter reveal)", () => {
  const state = { ...initialState, hint: "______" }
  const next = reducer(state, { type: "setHint", payload: "__i___" })
  expect(next.hint).toBe("__i___")
})

test("gameOver clears any lingering hint", () => {
  const state = { ...initialState, hint: "__i___" }
  const next = reducer(state, {
    type: "gameOver",
    names: { 1: "Alice" },
    scores: { 1: 10 },
    round: 3,
    maxRounds: 3,
    hostId: 1,
    canStart: true,
  })
  expect(next.hint).toBe("")
})

test("reset returns the given payload verbatim", () => {
  const next = reducer(
    { ...initialState, id: 5 },
    { type: "reset", payload: initialState }
  )
  expect(next).toBe(initialState)
})

test("an unknown action type throws", () => {
  expect(() => reducer(initialState, { type: "not-a-real-action" })).toThrow()
})
