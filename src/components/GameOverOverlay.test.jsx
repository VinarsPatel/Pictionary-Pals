import { render, screen } from "@testing-library/react"
import GameOverOverlay from "./GameOverOverlay"

test("renders standings sorted by score, highest first, marking the current user", () => {
  render(
    <GameOverOverlay
      gameOver={{
        names: { 1: "Alice", 2: "Bob" },
        scores: { 1: 80, 2: 120 },
        colors: { 1: "#F94144", 2: "#277DA1" },
        round: 3,
        maxRounds: 3,
      }}
      selfId={1}
    />
  )
  const entries = screen.getAllByText(/#[12]/)
  expect(entries[0]).toHaveTextContent("#1 Bob")
  expect(entries[1]).toHaveTextContent("#2 Alice")
  expect(entries[1]).toHaveTextContent("(You)")
  expect(screen.getByText("Round 3/3 complete")).toBeInTheDocument()
})

test("shows a non-host waiting message and no button", () => {
  render(
    <GameOverOverlay
      gameOver={{ names: { 1: "Alice" }, scores: { 1: 0 }, round: 1, maxRounds: 1 }}
      selfId={2}
      isHost={false}
    />
  )
  expect(
    screen.getByText("Waiting for the host to start the next game...")
  ).toBeInTheDocument()
  expect(screen.queryByRole("button")).not.toBeInTheDocument()
})

test("shows an enabled Start Next Game button for the host when canStart", () => {
  const onStartNext = jest.fn()
  render(
    <GameOverOverlay
      gameOver={{ names: { 1: "Alice" }, scores: { 1: 0 }, round: 1, maxRounds: 1 }}
      selfId={1}
      isHost
      canStart
      onStartNext={onStartNext}
    />
  )
  const button = screen.getByRole("button", { name: /Start Next Game/ })
  expect(button).toBeEnabled()
})

test("disables the host's button when canStart is false", () => {
  render(
    <GameOverOverlay
      gameOver={{ names: { 1: "Alice" }, scores: { 1: 0 }, round: 1, maxRounds: 1 }}
      selfId={1}
      isHost
      canStart={false}
    />
  )
  expect(
    screen.getByRole("button", { name: /Waiting for another player/ })
  ).toBeDisabled()
})
