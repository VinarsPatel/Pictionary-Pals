import { render, screen } from "@testing-library/react"
import TurnCountdown from "./TurnCountdown"

// The regression these tests guard: the displayed time must be derived from
// the absolute turn-end instant vs. the (server-synced) wall clock — never
// from how long the component has been mounted and ticking. A timer that
// only counts while the tab is foregrounded shows stale time after the
// player tabs away and back.

test("shows the full duration at the start of a turn", () => {
  const now = 1_000_000
  render(
    <TurnCountdown
      endAtMs={now + 60_000}
      durationMs={60_000}
      getServerNow={() => now}
    />
  )
  expect(screen.getByText("60")).toBeInTheDocument()
})

test("derives remaining time from the wall clock, not from mount time", () => {
  // Mounting 42 seconds into a 60s turn must immediately show 18 — the
  // component was never "running" for those 42 seconds.
  const now = 1_000_000
  render(
    <TurnCountdown
      endAtMs={now + 60_000 - 42_000}
      durationMs={60_000}
      getServerNow={() => now}
    />
  )
  expect(screen.getByText("18")).toBeInTheDocument()
})

test("clamps at zero once the turn has expired", () => {
  const now = 1_000_000
  render(
    <TurnCountdown
      endAtMs={now - 5_000}
      durationMs={60_000}
      getServerNow={() => now}
    />
  )
  expect(screen.getByText("0")).toBeInTheDocument()
})
