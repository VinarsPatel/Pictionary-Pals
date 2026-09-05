import { render, screen } from "@testing-library/react"
import ChatBox from "./ChatBox"

test("strips the leading tag+space and renders the rest of each message", () => {
  render(
    <ChatBox
      msgArr={[
        "O Alice joined the room.",
        "G Bob guessed the word!👏👏",
        "B Bob : pineapple",
      ]}
    />
  )
  expect(screen.getByText("Alice joined the room.")).toBeInTheDocument()
  expect(screen.getByText("Bob guessed the word!👏👏")).toBeInTheDocument()
  expect(screen.getByText("Bob : pineapple")).toBeInTheDocument()
})

test("shows an empty-state prompt when there are no messages", () => {
  render(<ChatBox msgArr={[]} />)
  expect(screen.getByText("No messages yet — say hi!")).toBeInTheDocument()
})
