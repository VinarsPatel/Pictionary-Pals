# Pictionary Pals

A real-time multiplayer drawing-and-guessing game. One player draws a secret word on a shared canvas while everyone else races to guess it in the chat; points are awarded for speed and accuracy, tracked on a live scoreboard. Hit "Quick Play" to drop into an open public game instantly, or create a customized private room (turn length, max players, word pack, rounds) and share the link. Games run for a configurable number of rounds and end with a podium screen — the room's host starts each game (the first one and any that follow) explicitly, no auto-start. Reconnects (dropped WiFi, a refresh) silently resume the same identity, avatar color, and score within a grace window, and completed games are recorded to a small SQLite history. The canvas supports both mouse and touch on any screen size.

See [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for how this compares to skribbl.io-style games and what's next toward a public launch.

## Tech stack

- **Client** (`/`): React 18 (Create React App), React Router, Tailwind CSS, raw browser `WebSocket` API.
- **Server** (`server/`): Express (REST) + `ws` (WebSocket) sharing one HTTP server, in-memory active-game state, SQLite (`node:sqlite`) for completed-game history.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit together, [docs/WEBSOCKET_PROTOCOL.md](docs/WEBSOCKET_PROTOCOL.md) for the full client↔server message contract, [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for running this beyond `localhost` (incl. Docker), [docs/QA.md](docs/QA.md) for how to verify a change, [docs/LAUNCH_PLAN.md](docs/LAUNCH_PLAN.md) for the competitive comparison and MVP sequence, and [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for what's tracked as remaining work.

## Getting started

Requires **Node 22+** for the server (uses the built-in `node:sqlite` module).

```bash
npm install
cd server && npm install && cd ..
```

Create the two env files below (see [Environment variables](#environment-variables)), then:

```bash
npm run dev   # runs the CRA dev server (:3000) and the API/WS server (:4000) together
```

Or run them separately:

```bash
npm start      # client only
npm run server # server only
```

Production client build: `npm run build`.

## Testing & linting

```bash
npm test && npm run lint             # client
cd server && npm test && npm run lint  # server
```

Wired into CI (`.github/workflows/ci.yml`) on every push/PR to `main`. See [docs/QA.md](docs/QA.md) for what the automated suites cover and the manual checklist to run for anything the tests structurally can't catch (touch drawing, responsive layout, real reconnection timing).

## Running with Docker

```bash
docker compose up --build
```

Serves the client at `http://localhost:8080` and the API/WS server at `http://localhost:4000`, with the SQLite file persisted in a named volume. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for adjusting this for a real deployment (the defaults here assume everything runs on `localhost`), plus hosting constraints to know about (the server needs a long-lived process with WebSocket support, not a serverless function).

## Environment variables

Copy `.env.example` → `.env` at the root, and `server/.env.example` → `server/.env`, then fill in values for your setup. See `server/src/config.js` for the full list with defaults (turn duration, reconnect grace period, max players per room, etc.) — the table below covers the essentials.

| File          | Variable               | Used by | Purpose                                                                                                                         |
| ------------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `.env`        | `REACT_APP_SERVER_URL` | client  | Base URL for the REST API, e.g. `http://localhost:4000`                                                                         |
| `.env`        | `REACT_APP_WS_URL`     | client  | WebSocket URL the game connects to, e.g. `ws://localhost:4000`                                                                  |
| `.env`        | `REACT_APP_BASE_URL`   | client  | Base URL used to build the shareable room link shown on the home page                                                           |
| `server/.env` | `PORT`                 | server  | Port the Express/WebSocket server listens on (default `4000`)                                                                   |
| `server/.env` | `CLIENT_ORIGINS`       | server  | Comma-separated CORS allowlist. **Unset = wide-open `origin: "*"`** with a startup warning — always set this outside local dev. |
| `server/.env` | `DB_PATH`              | server  | SQLite file path, relative to `server/` (default `./data/pictionary.db`, gitignored)                                            |

`REACT_APP_*` variables are inlined at build time by CRA — changing them requires restarting `npm start` (dev) or rebuilding (`npm run build`, or the Docker image with new `--build-arg`s).

## Project structure

```
src/                    React SPA
  components/
    HomePage.jsx          Landing page — Quick Play, room-settings form, shareable link, recent games
    GameArena.jsx           The game screen — canvas, WebSocket client, turn/round/timer UI, reconnection
    GameOverOverlay.jsx      Podium overlay shown on type:9 game-over
    RecentGames.jsx           Read-only panel over GET /api/games/recent
    ChatBox.jsx                Guess/system message log
    Scores.jsx                  Scoreboard
    Navbar.jsx, HowToPlay.jsx      Static UI
server/
  index.js               Wiring only: Express routes, ws handlers, turn/round scheduling, shutdown
  src/
    rooms.js                Room state + join/reconnect/turn/round/scoring logic (read this first)
    scoring.js, wordBank.js    Pure functions
    validation.js               zod schemas + server-side name validation
    rateLimiter.js                Per-connection token bucket
    db.js                          SQLite (node:sqlite) — completed-game history
    config.js, logger.js
  test/                    node:test unit + integration tests
docs/
  ARCHITECTURE.md          System design, state model, reconnection/rounds design, data flow
  WEBSOCKET_PROTOCOL.md      Full message-type reference (types 0–12)
  DEPLOYMENT.md                Running beyond localhost, Docker, hosting constraints
  QA.md                          Test coverage reference + manual QA checklist
  LAUNCH_PLAN.md                  Competitive comparison + MVP sequence
  IMPROVEMENTS.md                   Tiered roadmap of remaining work
```

## Status

Started as a college project; hardened toward a "solid MVP" bar — reconnection, input validation, rate limiting, SQLite persistence for game history, tests, CI, Docker, a responsive/touch-friendly canvas, per-room settings (turn length, max players, word pack, rounds, avatar colors), public quick-play matchmaking, and a host-gated rounds/game-over flow (no auto-start or auto-restart — the room's host explicitly starts each game). Active game state is still single-process in-memory (no horizontal scaling of active rooms without adding shared state) — see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)'s "Known remaining constraints" and [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) before extending this further.
