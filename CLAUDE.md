# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pictionary Pals — a real-time multiplayer drawing-and-guessing game (Scribble/skribbl.io clone). One player draws a secret word on a shared canvas; everyone else guesses in a chat box; points are awarded for speed and accuracy. Two independent Node projects live in this repo: a React SPA (root) and an Express/WebSocket server (`server/`), backed by SQLite for completed-game history.

Started as a college project; has since been hardened toward a "solid MVP" bar — reconnection support, input validation, rate limiting, persistence, tests, CI, Docker, and a responsive/touch-friendly canvas with per-room settings. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for system design, [docs/WEBSOCKET_PROTOCOL.md](docs/WEBSOCKET_PROTOCOL.md) for the wire protocol (types 0–12), [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for running this beyond a dev machine, [docs/QA.md](docs/QA.md) for what to verify before/after a change, and [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md) for what's left. Read the protocol doc before touching either the client's `wsMessageHandler` or `server/index.js`'s message dispatch — they must stay in sync by message `type` number, and only `zod` schemas enforce shape, not the pairing itself.

## Commands

Run from the repo root unless noted.

```bash
npm install                 # root (client) deps
cd server && npm install    # server deps (separate package.json/lockfile)

npm run dev                 # client (CRA dev server, :3000) + server (nodemon, :4000) concurrently
npm start                   # client only
npm run server              # server only (cd server && npm run dev, i.e. nodemon index.js)

npm test                    # client tests (Jest + React Testing Library, via react-scripts test)
npm run lint                 # client lint (CRA's react-app eslint config)
npm run build                 # production client build

cd server && npm test         # server tests (node:test — zero extra test-runner deps)
cd server && npm run lint      # server lint (ESLint 10 flat config, server/eslint.config.js)
```

Single-test invocations: `node --test server/test/rooms.test.js` (server); `npx react-scripts test Scores --watchAll=false` (client, matches by filename substring).

Requires **Node 22+** for the server — it uses the built-in `node:sqlite` module (stable enough as of 22.x, still logs an `ExperimentalWarning`; harmless). The client has no such constraint.

## Environment variables

See `.env.example` (root) and `server/.env.example` for the full list with defaults. Notable ones beyond the basics:

- `CLIENT_ORIGINS` (server) — comma-separated CORS allowlist. Unset means wide-open `origin: "*"` with a startup warning; always set this in any real deployment.
- `MAX_PLAYERS_PER_ROOM`, `TURN_DURATION_MS`, `RECONNECT_GRACE_MS`, `ROOM_REAPER_INTERVAL_MS`, `ROOM_IDLE_TTL_MS`, `DEFAULT_ROUNDS` (server) — see `server/src/config.js` for defaults. `MAX_PLAYERS_PER_ROOM`/`TURN_DURATION_MS`/`DEFAULT_ROUNDS` are just the _global_ fallback — a room created via `GET /getRoom?turnDurationMs=...&maxPlayers=...&wordPack=...&maxRounds=...` gets its own per-room values instead (clamped server-side; see `index.js`'s `/getRoom` handler).
- `DB_PATH` (server) — SQLite file path, resolved relative to `server/`. Defaults to `./data/pictionary.db` (gitignored).

## Architecture

- **Client** (`src/`): CRA + React 18 + react-router-dom + Tailwind. Responsive (mobile/tablet/desktop). Routes: `/` (`HomePage.jsx`, now with a room-settings form — turn length/max players/word pack — passed to `/getRoom` as query params) and `/room/:roomID` (`GameArena.jsx`). All game state lives in one `useReducer` in `GameArena.jsx` (exported as `reducer`/`initialState` for unit testing — see `GameArena.reducer.test.js`). A raw `WebSocket` (not socket.io) reconnects with a fixed 5s backoff. Reconnection identity (name + a `crypto.randomUUID()` token + a chosen avatar color) is cached in `sessionStorage` per room so a dropped connection re-authenticates silently instead of prompting for a name again — see "Reconnection" below. The canvas supports mouse and touch, scales responsively while keeping its internal 780×450 resolution fixed (coordinates are converted via `getCanvasPoint`'s scale factor), and both `lineCap`/`lineJoin` are set to `"round"` everywhere a stroke is drawn — a missing `lineCap` was the cause of "broken"/notched thick lines.
- **Server** (`server/index.js` + `server/src/*`): Express (REST routes incl. health + recent-games) and a `ws` WebSocket server sharing one HTTP server. `index.js` is wiring only; game logic lives in `server/src/`:
  - `rooms.js` — the `RoomStore` (a `Map` of rooms) plus all room-state mutation logic: joining/reconnecting, turn rotation, scoring application, grace-period removal, avatar-color assignment (`normalizeColor` — a client-supplied hex color is used as-is if valid, else a deterministic palette fallback by id). This is the one file to read before changing any multiplayer behavior.
  - `scoring.js` — pure functions, no state.
  - `wordBank.js` — multiple named word packs (`default`/`animals`/`food`/`movies`), selected per-room at creation time via `GET /getRoom?wordPack=...`.
  - `validation.js` — `zod` schemas for every inbound WS message type, plus server-side name validation (the client's own checks aren't trusted).
  - `rateLimiter.js` — a per-connection token bucket checked on every inbound WS message.
  - `db.js` — `node:sqlite` wrapper (schema + `recordGameEnd`/`getRecentGames`).
  - `config.js`, `logger.js` (`pino`).
  - `index.js` exports `createServer(overrides)` (returns `{app, server, wsServer, roomStore, dbHandle, close}` without calling `.listen()`) so tests can spin up isolated instances on ephemeral ports with an in-memory db. The `require.main === module` guard at the bottom is what actually calls `.listen()` when run directly.
- **Protocol**: JSON messages with a numeric `type` field (0–12), documented in full in `docs/WEBSOCKET_PROTOCOL.md`. Types 8 (error), 9 (game over), 10 (clock sync), 11 (fill), and 12 (start game) were added beyond the original 0–7.
- **Public matchmaking**: `GET /quickplay` (homepage's "Quick Play" button) vs. `GET /getRoom` (the settings form) — both call `roomStore.createRoom`, differing only in `isPublic` and where settings come from. `rooms.findJoinablePublicRoom` is the entire matchmaking algorithm: first public room with an open slot, no ranking. See ARCHITECTURE.md's "Public matchmaking."
- **Rounds and game-over**: a room ends its game (broadcasts `type: 9`, persists, resets) once `room.round` exceeds `room.maxRounds`. Round-completion is detected by turn-order wrap-around in `rotateTurn` — the single function both the timer-based and early (all-correct-guess) rotation paths call. **There is no auto-start or auto-restart anywhere** — a room sits at `turnID: -1` (brand new or just game-over'd) until its host sends `type: 12`. The host is never a stored field, only derived: `rooms.getHostId(room)` is always the lowest active player id, which is what makes host assignment/transfer/reclaiming on reconnect all fall out "for free" instead of needing explicit bookkeeping. See ARCHITECTURE.md's "Rounds and game-over" for the full reasoning.

### Reconnection (read this before touching `rooms.js` or the close/disconnect path)

A dropped connection doesn't immediately delete the player. `server/src/rooms.js` + `index.js`'s `handleClose`/`finalizeDisconnect`:

1. On socket close, the player is removed from `room.users` (which is what turn rotation iterates — so they're immediately skipped for drawing turns) but **not** from `room.names`/`room.scores`.
2. A grace timer (`RECONNECT_GRACE_MS`, default 45s) starts. If it expires with no reconnect, `rooms.finalizeRemoval` snapshots the player into `room.history` (for eventual DB persistence — see below) and deletes their name/score/token for real, then broadcasts the type:7 "left" message.
3. If the client reconnects (new socket, same `token`) before the timer fires, `rooms.resolveJoin`'s single "adopt and evict" path reclaims the same numeric id, restoring their score with no visible "left/rejoined" flicker to other players. This same path also handles the race where the _old_ socket is still technically open (duplicate tab, or a fast client-side reconnect loop beating the server's `close` event) — it always wins by adopting the id and closing whichever old socket held it, rather than branching on whether that old socket looks alive.
4. `handleClose` guards with `room.users[playerId] === ws` before starting a grace timer — this is what stops a socket that's already been evicted by a newer reconnect from re-triggering removal logic for the player who just reconnected.
5. The room reaper (`ROOM_REAPER_INTERVAL_MS` sweep) only deletes a room when `rooms.isIdle(room)` — nobody active **and** nobody mid-grace-window. Don't loosen that condition; a room deleted out from under a pending reconnect orphans that player's token permanently.

Known accepted limitation: if the _drawer_ disconnects, the turn is not force-rotated — it waits out the normal timer (or the drawer reconnects in time). Also, a drawer's canvas is not resynced/replayed on reconnect (their local canvas clears; other players' canvases are deliberately left alone rather than broadcasting a clear that would wipe their view).

### Persistence

`server/data/pictionary.db` (SQLite via `node:sqlite`, gitignored) stores completed games (`games` + `game_players` tables). A game is only persisted if `room.roundsCompleted > 0` when the room finally empties (`rooms.isIdle`). The roster persisted is `room.history` (players finalized earlier in the game) `+` whoever's still active — this is why `finalizeRemoval` snapshots into `history` instead of just deleting: without it, a game where players trickle out one by one would only ever persist whoever happened to leave last. `GET /api/games/recent` exposes this read-only; the homepage's `RecentGames.jsx` renders it. There is no auth/accounts system, so this is intentionally just names/scores/timestamps — nothing tied to a durable identity beyond a per-game display name.

### Testing

- Server: `node:test` (built-in, no extra deps). `server/test/rooms.test.js` covers the reconnection/turn-rotation logic directly against `rooms.js` (no sockets needed). `server/test/integration.test.js` drives real `ws` clients against a `createServer({dbHandle: db.initDb(':memory:')})` instance on an ephemeral port. **Any `setTimeout` you add to `index.js` must call `.unref()`** — grace and turn timers already do; without it, a lingering 45s timer keeps a test process (or a graceful shutdown) alive far longer than it should. `close()` also proactively cancels every room's pending grace timers so a shutdown never races a `dbHandle.close()` against a persist attempt.
- Client: `@testing-library/react` + `jest-dom`, wired via `src/setupTests.js`. The reducer is tested directly (pure function, no DOM); `Scores`/`ChatBox` get shallow render tests.

### Docker

`server/Dockerfile` needs no native build toolchain (thanks to `node:sqlite` being built-in — unlike `better-sqlite3`, which was tried and removed for exactly this reason). Root `Dockerfile` is a two-stage CRA build → nginx, with `REACT_APP_*` passed as build `ARG`s (CRA bakes them in at build time, not container start) and an SPA fallback (`try_files ... /index.html`) in `nginx.conf` for client-side routes like `/room/:id`. `docker-compose.yml` wires both plus a named volume for the sqlite file.
