import { render, screen, within } from "@testing-library/react"
import Scores from "./Scores"

test("renders nothing when scores hasn't loaded yet", () => {
  const { container } = render(
    <Scores scores={null} names={null} id={null} turnID={null} />
  )
  expect(container).toBeEmptyDOMElement()
})

test("renders each player's name and score, marking the current user and drawer", () => {
  render(
    <Scores
      scores={{ 1: 40, 2: 100 }}
      names={{ 1: "Alice", 2: "Bob" }}
      colors={{ 1: "#F94144", 2: "#277DA1" }}
      id={1}
      turnID={2}
    />
  )
  expect(screen.getByText(/Alice.*\(You\)/)).toBeInTheDocument()
  expect(screen.getByText("Bob")).toBeInTheDocument()
  expect(screen.getByText("40")).toBeInTheDocument()
  expect(screen.getByText("100")).toBeInTheDocument()
})

test("uses each player's avatar color as the chip's top-border accent", () => {
  render(
    <Scores
      scores={{ 1: 40 }}
      names={{ 1: "Alice" }}
      colors={{ 1: "#F94144" }}
      id={1}
      turnID={1}
    />
  )
  expect(screen.getByTestId("score-chip-1")).toHaveStyle({
    borderTopColor: "#F94144",
  })
})

test("falls back to a transparent border accent when no color is known for a player", () => {
  render(
    <Scores
      scores={{ 1: 40 }}
      names={{ 1: "Alice" }}
      colors={{}}
      id={1}
      turnID={1}
    />
  )
  expect(screen.getByTestId("score-chip-1")).toHaveStyle({
    borderTopColor: "transparent",
  })
})

test("renders chips in leaderboard order (highest score first)", () => {
  render(
    <Scores
      scores={{ 1: 10, 2: 90, 3: 40 }}
      names={{ 1: "Alice", 2: "Bob", 3: "Cara" }}
      colors={{}}
      id={1}
      turnID={1}
    />
  )
  const chips = screen.getAllByTestId(/score-chip-/)
  expect(chips.map((chip) => chip.dataset.testid)).toEqual([
    "score-chip-2",
    "score-chip-3",
    "score-chip-1",
  ])
})

test("only the top scorer gets a trophy, and only once someone has scored", () => {
  const { rerender } = render(
    <Scores
      scores={{ 1: 0, 2: 0 }}
      names={{ 1: "Alice", 2: "Bob" }}
      colors={{}}
      id={1}
      turnID={1}
    />
  )
  expect(screen.queryByTestId("trophy-icon")).not.toBeInTheDocument()

  rerender(
    <Scores
      scores={{ 1: 10, 2: 90 }}
      names={{ 1: "Alice", 2: "Bob" }}
      colors={{}}
      id={1}
      turnID={1}
    />
  )
  expect(
    within(screen.getByTestId("score-chip-2")).getByTestId("trophy-icon")
  ).toBeInTheDocument()
  expect(
    within(screen.getByTestId("score-chip-1")).queryByTestId("trophy-icon")
  ).not.toBeInTheDocument()
})
