import { render, screen } from "@testing-library/react"
import CelebrationPopup from "./CelebrationPopup"

test("announces who got the correct guess", () => {
  render(<CelebrationPopup name="Bob" />)
  expect(screen.getByText(/Bob got it/)).toBeInTheDocument()
})
