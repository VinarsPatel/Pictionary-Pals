import React, {
  useCallback,
  useEffect,
  useRef,
  useReducer,
  useState,
} from "react"
import {
  LuEraser,
  LuPaintBucket,
  LuPencil,
  LuPlay,
  LuTrash2,
  LuVolume2,
  LuVolumeX,
} from "react-icons/lu"
import { useParams } from "react-router-dom"
import toast from "react-hot-toast"
import Scores from "./Scores"
import TurnCountdown from "./TurnCountdown"
import GameOverOverlay from "./GameOverOverlay"
import ColorPickerButton from "./ColorPickerButton"
import CelebrationPopup from "./CelebrationPopup"
import Badge from "./ui/Badge"
import Button from "./ui/Button"
import Card from "./ui/Card"
import Input from "./ui/Input"

import ChatBox from "./ChatBox"
import { isMuted, playCorrectGuess, playTurnStart, toggleMuted } from "../utils/sounds"

const CELEBRATION_DURATION_MS = 1700

// Persists {name, token, color} per room in sessionStorage so a dropped
// connection (refresh, brief WiFi loss) can silently re-authenticate as the
// same player instead of losing their identity/score — the server matches
// on `token` and restores the existing player id within its reconnect
// grace window (see docs/WEBSOCKET_PROTOCOL.md).
const sessionKey = (roomID) => `pp:${roomID}`

const readSession = (roomID) => {
  try {
    const raw = sessionStorage.getItem(sessionKey(roomID))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

const writeSession = (roomID, session) => {
  try {
    sessionStorage.setItem(sessionKey(roomID), JSON.stringify(session))
  } catch {
    // sessionStorage unavailable (e.g. private browsing) — reconnection
    // just won't preserve identity, which is a fine degradation.
  }
}

const clearSession = (roomID) => {
  try {
    sessionStorage.removeItem(sessionKey(roomID))
  } catch {
    // no-op
  }
}

// Mirrors the server's fallback palette (server/src/rooms.js) purely for
// visual consistency — the server accepts any valid hex color regardless.
export const AVATAR_COLORS = [
  "#F94144",
  "#F3722C",
  "#F9C74F",
  "#90BE6D",
  "#43AA8B",
  "#577590",
  "#277DA1",
  "#B5179E",
]

const CANVAS_WIDTH = 780
const CANVAS_HEIGHT = 450
// The canvas backing store renders at 2x the logical resolution so strokes
// stay crisp on high-DPI screens and at large CSS sizes. Everything outside
// rendering — the wire protocol, pointer math, fill seed points — stays in
// the logical 780x450 space; only the ctx transform and floodFill's pixel
// work know about the scale. A constant (not devicePixelRatio) so every
// client rasterizes identical bitmaps, which flood-fill sync relies on.
const RENDER_SCALE = 2
const DEFAULT_TURN_DURATION_MS = 60000

// type:8 codes that mean "your join was rejected" (state.id never got set) —
// as opposed to "your start-game request was rejected" (not_host/
// cannot_start), which happens to an already-joined player and must not
// bounce them back to the name-entry screen.
const JOIN_REJECTION_CODES = new Set([
  "room_full",
  "name_required",
  "name_too_long",
  "name_single_word",
])

// Always-visible quick palette — a real color-mixing wheel is one popover tap
// away via ColorPickerButton, but the common case (pick a vivid color, keep
// drawing) shouldn't require opening anything.
export const QUICK_COLORS = [
  "#000000",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899",
]

export const STROKE_SIZES = [2, 4, 8, 14]
export const ERASER_SIZES = [8, 16, 24, 36]

// Exported alongside the component (rather than kept private) so the
// reducer's action-handling logic can be unit-tested without mounting the
// whole component/WebSocket stack — see GameArena.reducer.test.js.
export const initialState = {
  message: "",
  word: "",
  color: "#000000",
  tool: "pen", // "pen" | "eraser" | "fill"
  strokeWidth: 3,
  eraserWidth: 16,
  isDrawing: false,
  id: null,
  turnID: null,
  names: null,
  scores: null,
  colors: null,
  hint: "", // masked word ("_ _ a _") shown to guessers while someone draws
  turnDurationMs: DEFAULT_TURN_DURATION_MS,
  round: 1,
  maxRounds: 3,
  gameOver: null, // {names, scores, colors, round, maxRounds} snapshot while the podium overlay is showing
  hostId: null, // the lowest active player id — only they may send type:12 (start game)
  canStart: false, // server-computed: >=2 active players and no turn already running
  msgArr: [],
}

export function reducer(state, action) {
  switch (action.type) {
    case "reset":
      return action.payload
    case "setAll":
      return {
        ...state,
        id: action.id,
        turnID: action.turnID,
        names: action.names,
        scores: action.scores,
        colors: action.colors,
        turnDurationMs: action.turnDurationMs || state.turnDurationMs,
        round: action.round || state.round,
        maxRounds: action.maxRounds || state.maxRounds,
        hostId: action.hostId,
        canStart: action.canStart,
        hint: action.hint || "",
        word: action?.word,
      }
    case "setMessage":
      return { ...state, message: action.payload }
    case "setColor":
      return { ...state, color: action.payload }
    case "setTool":
      return { ...state, tool: action.payload }
    case "setStrokeWidth":
      return { ...state, strokeWidth: action.payload }
    case "setEraserWidth":
      return { ...state, eraserWidth: action.payload }
    case "setIsDrawing":
      return { ...state, isDrawing: action.payload }
    case "setCanvasVar":
      return { ...state, strokeWidth: action.strokeWidth, color: action.color }
    case "setId":
      return { ...state, id: action.payload }
    case "setTurnID":
      return { ...state, turnID: action.payload }
    case "setHint":
      return { ...state, hint: action.payload }
    case "addMsg":
      return { ...state, msgArr: [...state.msgArr, action.msg] }
    case "correctGuess":
      return {
        ...state,
        scores: action.scores,
        msgArr: [...state.msgArr, action.msg],
      }
    case "changeTurn":
      return {
        ...state,
        turnID: action.turnID,
        word: action?.word,
        hint: action.hint || "",
        turnDurationMs: action.turnDurationMs || state.turnDurationMs,
        round: action.round || state.round,
        maxRounds: action.maxRounds || state.maxRounds,
        gameOver: null, // a new turn starting means any previous game-over overlay should dismiss
        msgArr: [...state.msgArr, action.msg],
      }
    case "deltaPlayer":
      return {
        ...state,
        names: action.names,
        scores: action.scores,
        colors: action.colors,
        hostId: action.hostId,
        canStart: action.canStart,
        msgArr: [...state.msgArr, action.msg],
      }
    case "gameOver":
      return {
        ...state,
        hostId: action.hostId,
        canStart: action.canStart,
        hint: "",
        gameOver: {
          names: action.names,
          scores: action.scores,
          colors: action.colors,
          round: action.round,
          maxRounds: action.maxRounds,
        },
      }
    default:
      throw new Error()
  }
}

const GameArena = () => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const canvasRef = useRef(null)
  const p = useParams()
  const ctx = useRef(null)
  const [time, setTime] = useState(null)
  const lastX = useRef(null)
  const lastY = useRef(null)
  // Midpoint of the previous pair of samples — the anchor the next
  // quadratic curve starts from (see drawSmoothTo). Null at stroke start.
  const lastMidX = useRef(null)
  const lastMidY = useRef(null)
  // The brush-size preview ring that follows the drawer's mouse over the
  // canvas. Positioned by direct style writes (not state) so tracking the
  // pointer doesn't re-render the whole component at 60Hz.
  const brushCursorRef = useRef(null)
  // Added to Date.now() to approximate the server's clock — corrects for
  // system clock skew between players, which otherwise makes the turn
  // countdown differ (and be wrong) across browsers even though both derive
  // it from the same server-sent turn-start timestamp.
  const clockOffsetRef = useRef(0)
  // "Now" on the server's timeline. Stable identity (reads the ref) so the
  // countdown's effect doesn't tear down and re-arm on every render.
  const getServerNow = useCallback(() => Date.now() + clockOffsetRef.current, [])

  const ws = useRef(null)
  const [hasSession, setHasSession] = useState(
    () => readSession(p.roomID) != null
  )
  const [avatarColor, setAvatarColor] = useState(
    () => readSession(p.roomID)?.color || AVATAR_COLORS[0]
  )
  // { key, name } for the celebration banner over the Chat card — key is
  // bumped on every correct guess so a guess landing mid-animation restarts
  // it (a plain boolean wouldn't retrigger the CSS animation on a repeat).
  const [celebration, setCelebration] = useState(null)
  const [soundMuted, setSoundMuted] = useState(() => isMuted())

  useEffect(() => {
    if (!celebration) return undefined
    const timeoutId = setTimeout(
      () => setCelebration(null),
      CELEBRATION_DURATION_MS
    )
    return () => clearTimeout(timeoutId)
  }, [celebration])

  // Converts a viewport-relative point (mouse clientX/Y, or a touch's) into
  // the canvas's own coordinate space. Needed because the canvas is now
  // CSS-responsive (its rendered size can be smaller than its 780x450
  // internal resolution on narrow screens) — without this scaling, drawing
  // would land in the wrong place on any screen narrower than the canvas.
  const getCanvasPoint = (clientX, clientY) => {
    const canvas = canvasRef.current
    const r = canvas.getBoundingClientRect()
    // Map into the LOGICAL 780x450 space (the wire-protocol coordinate
    // space), not the physical backing store — that's RENDER_SCALE× larger
    // and only the ctx transform / floodFill ever deal in it.
    const scaleX = CANVAS_WIDTH / r.width
    const scaleY = CANVAS_HEIGHT / r.height
    return { x: (clientX - r.left) * scaleX, y: (clientY - r.top) * scaleY }
  }

  const clearCanvas = () => {
    // The canvas only exists in the DOM once turnID !== -1 (see the
    // "Waiting to start" gating below) — a type:4 turn-change message can
    // arrive and dispatch before that re-render has mounted the element and
    // the ctx-assigning effect has run, so both refs can still be null here.
    const canvas = canvasRef.current
    if (!canvas || !ctx.current) return
    // Physical-pixel rect + identity transform: clearRect under the scaled
    // transform would also work, but this stays correct even if the
    // transform is ever changed.
    ctx.current.save()
    ctx.current.setTransform(1, 0, 0, 1, 0, 0)
    ctx.current.clearRect(0, 0, canvas.width, canvas.height)
    ctx.current.restore()
  }

  // Iterative (stack-based, not recursive — a recursive walk would blow the
  // call stack on a canvas this size) tolerance-based flood fill. Canvas
  // pixels start fully transparent (alpha 0) rather than white — the white
  // backdrop is only a CSS background — so "the blank area" and "a region
  // enclosed by opaque strokes" are both just contiguous low-alpha pixels;
  // a stroke's near-full alpha is what stops the fill at its boundary. Only
  // the seed point + color cross the wire (see Type 11 in
  // docs/WEBSOCKET_PROTOCOL.md) — every client reproduces the same fill
  // locally because their canvas bitmaps are themselves a deterministic
  // byproduct of the same synced stroke/fill messages.
  const floodFill = (seedX, seedY, fillHex) => {
    const canvas = canvasRef.current
    if (!canvas || !ctx.current) return
    const { width, height } = canvas
    // Seed arrives in logical wire coordinates; the pixel buffer is
    // RENDER_SCALE× larger.
    const x0 = Math.round(seedX * RENDER_SCALE)
    const y0 = Math.round(seedY * RENDER_SCALE)
    if (x0 < 0 || y0 < 0 || x0 >= width || y0 >= height) return

    const imageData = ctx.current.getImageData(0, 0, width, height)
    const data = imageData.data
    const startIdx = (y0 * width + x0) * 4
    const startR = data[startIdx]
    const startG = data[startIdx + 1]
    const startB = data[startIdx + 2]
    const startA = data[startIdx + 3]

    const clean = fillHex.replace("#", "")
    const packed = parseInt(clean, 16)
    const fillR = (packed >> 16) & 255
    const fillG = (packed >> 8) & 255
    const fillB = packed & 255

    if (startA === 255 && startR === fillR && startG === fillG && startB === fillB) {
      return // already this exact color — nothing to do
    }

    const TOLERANCE_SQ = 60 * 60
    const matches = (idx) => {
      const dr = data[idx] - startR
      const dg = data[idx + 1] - startG
      const db = data[idx + 2] - startB
      const da = data[idx + 3] - startA
      return dr * dr + dg * dg + db * db + da * da <= TOLERANCE_SQ
    }

    const visited = new Uint8Array(width * height)
    const stack = [[x0, y0]]
    while (stack.length) {
      const [x, y] = stack.pop()
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      const pixel = y * width + x
      if (visited[pixel]) continue
      const idx = pixel * 4
      if (!matches(idx)) continue
      visited[pixel] = 1
      data[idx] = fillR
      data[idx + 1] = fillG
      data[idx + 2] = fillB
      data[idx + 3] = 255
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1])
    }
    ctx.current.putImageData(imageData, 0, 0)
  }

  // Shared stroke-start bookkeeping for both the local drawer (pointerDown)
  // and remote replay (type 1 via setVar): resets the smoothing anchor and
  // stamps a dot so a click/tap with no movement still leaves a mark. Both
  // sides MUST run identical logic — the canvases have to stay bit-for-bit
  // in sync for flood fill to give everyone the same result.
  const beginStroke = (x, y, color, strokeWidth) => {
    lastX.current = x
    lastY.current = y
    lastMidX.current = null
    lastMidY.current = null
    ctx.current.lineWidth = strokeWidth
    ctx.current.strokeStyle = color
    ctx.current.lineJoin = "round"
    ctx.current.lineCap = "round" // without this, fast/thick strokes render as broken, notched segments
    drawSegment(x, y, x, y) // zero-length segment + round cap = a dot
  }

  const setVar = (msg) => {
    beginStroke(msg.x, msg.y, msg.color, msg.strokeWidth)
  }
  const wsMessageHandler = (msg) => {
    switch (msg.type) {
      case 0: {
        const opt = {
          type: "setAll",
          id: msg.id,
          turnID: msg.turnID,
          names: msg.names,
          scores: msg.scores,
          colors: msg.colors,
          turnDurationMs: msg.turnDurationMs,
          round: msg.round,
          maxRounds: msg.maxRounds,
          hostId: msg.hostId,
          canStart: msg.canStart,
          hint: msg.hint,
        }
        if (msg.turnID === msg.id) {
          opt.word = msg.word
          // Only reached when reconnecting mid-turn as the current drawer —
          // a fresh join is never assigned the existing turnID. Clear our
          // own blank-after-reconnect canvas, but don't broadcast a clear:
          // other players' in-progress drawing shouldn't vanish just
          // because the drawer had a brief network blip.
          clearCanvas()
        }
        dispatch(opt)
        setTime(msg.time)
        break
      }
      case 1:
        dispatch({
          type: "setCanvasVar",
          strokeWidth: msg.strokeWidth,
          color: msg.color,
        })
        setVar(msg)
        break
      case 2:
        drawToo(msg.x, msg.y)
        break
      case 3:
        if (msg.isTrue) {
          dispatch({
            type: "correctGuess",
            msg: msg.message,
            scores: msg.scores,
          })
          setCelebration({
            key: Date.now(),
            name: state.names?.[msg.id] || "Someone",
          })
          playCorrectGuess()
        } else {
          dispatch({
            type: "addMsg",
            msg: msg.message,
          })
        }
        break
      case 4:
        dispatch({
          type: "changeTurn",
          msg: msg.message,
          turnID: msg.turnID,
          word: msg.word,
          turnDurationMs: msg.turnDurationMs,
          round: msg.round,
          maxRounds: msg.maxRounds,
          hint: msg.hint,
        })
        // Only the drawer's copy of a turn message carries the word — so
        // this doubles as the "it's your turn now" signal.
        if (msg.word) {
          toast(`Your turn — draw "${msg.word}"!`, { icon: "🎨" })
        }
        playTurnStart()
        setTime(msg.time)
        clearCanvas()
        break
      case 13:
        dispatch({ type: "setHint", payload: msg.hint })
        break
      case 5:
        clearCanvas()
        break
      case 11:
        floodFill(msg.x, msg.y, msg.color)
        break
      case 6:
        dispatch({
          type: "deltaPlayer",
          msg: `O ${msg.name} joined the room.`,
          scores: msg.scores,
          names: msg.names,
          colors: msg.colors,
          hostId: msg.hostId,
          canStart: msg.canStart,
        })
        break
      case 7:
        dispatch({
          type: "deltaPlayer",
          msg: `R ${msg.name} left the room.`,
          scores: msg.scores,
          names: msg.names,
          colors: msg.colors,
          hostId: msg.hostId,
          canStart: msg.canStart,
        })
        break
      case 9:
        dispatch({
          type: "gameOver",
          names: msg.names,
          scores: msg.scores,
          colors: msg.colors,
          round: msg.round,
          maxRounds: msg.maxRounds,
          hostId: msg.hostId,
          canStart: msg.canStart,
        })
        setTime(null)
        break
      case 10: {
        // Round-trip-corrected offset: assumes the request and reply legs
        // took roughly equal time, so the server's instant was reached
        // halfway through the observed round trip.
        const rtt = Date.now() - msg.clientTime
        clockOffsetRef.current = msg.serverTime + rtt / 2 - Date.now()
        break
      }
      case 8:
        toast.error(msg.message)
        // Only join-time rejections mean we never got a join ack (state.id
        // stays null) — clearing the stored session there just makes the
        // next attempt fall back to manual name entry instead of retrying
        // forever with the same rejected name/token. "not_host"/
        // "cannot_start" are rejections of a *start-game* request from an
        // already-joined player and must not log them out.
        if (JOIN_REJECTION_CODES.has(msg.code)) {
          clearSession(p.roomID)
          setHasSession(false)
        }
        break
      default:
        break
    }
  }
  const toastid = useRef(null)

  // The WS-connection effect below intentionally only re-runs on roomID
  // change (reconnecting on every state update would be wrong) — so it
  // reads the latest wsMessageHandler through a ref instead of listing it
  // as a dependency, since that closure is recreated every render.
  const messageHandlerRef = useRef(wsMessageHandler)
  useEffect(() => {
    messageHandlerRef.current = wsMessageHandler
  })

  useEffect(() => {
    // Initialize WebSocket
    const connectWebSocket = () => {
      if (ws.current) {
        ws.current.onerror = ws.current.onopen = ws.current.onclose = null
        ws.current.close()
      }
      ws.current = new WebSocket(`${process.env.REACT_APP_WS_URL}/${p.roomID}`)

      ws.current.onopen = () => {
        if (toastid.current) toast.remove(toastid.current)
        ws.current.send(JSON.stringify({ type: 10, clientTime: Date.now() }))
        const session = readSession(p.roomID)
        if (session) {
          // Silently re-authenticate as the same player instead of making
          // the user retype their name after every reconnect.
          ws.current.send(
            JSON.stringify({
              type: 0,
              name: session.name,
              token: session.token,
              color: session.color,
            })
          )
        }
      }

      ws.current.onerror = (error) => {
        if (toastid.current) toast.remove(toastid.current)
        console.error("WebSocket error:", error)
      }

      ws.current.onclose = () => {
        toast.error("Connection lost!")
        ws.current = null
        if (toastid.current) toast.remove(toastid.current)
        toastid.current = toast.loading("Trying to reconnect please wait...")
        dispatch({ type: "reset", payload: initialState })
        setTimeout(() => connectWebSocket(), 5000)
      }
      ws.current.onmessage = (message) => {
        const msg = JSON.parse(message.data)
        messageHandlerRef.current(msg)
      }
    }

    connectWebSocket()
    return () => {
      if (ws.current) {
        ws.current.onerror = ws.current.onopen = ws.current.onclose = null
        ws.current.close()
        dispatch({ type: "reset", payload: initialState })
      }
    }
  }, [p.roomID])

  useEffect(() => {
    if (canvasRef?.current !== null) {
      // `desynchronized` hints the browser to skip compositor syncing for
      // lower input-to-paint latency while drawing (no-op where unsupported).
      ctx.current = canvasRef.current.getContext("2d", {
        desynchronized: true,
      })
      // setTransform (absolute), not scale (cumulative) — this effect runs
      // on every render and must be idempotent. Maps the logical 780x450
      // drawing space onto the 2x backing store.
      ctx.current.setTransform(RENDER_SCALE, 0, 0, RENDER_SCALE, 0, 0)
    }
  })

  function pointerDown(clientX, clientY) {
    if (state.turnID !== state.id) return
    const { x, y } = getCanvasPoint(clientX, clientY)

    if (state.tool === "fill") {
      floodFill(x, y, state.color)
      ws.current.send(JSON.stringify({ type: 11, x, y, color: state.color }))
      return
    }

    dispatch({ type: "setIsDrawing", payload: true })
    const activeColor = state.tool === "eraser" ? "#ffffff" : state.color
    const activeWidth =
      state.tool === "eraser" ? state.eraserWidth : state.strokeWidth
    beginStroke(x, y, activeColor, activeWidth)

    ws.current.send(
      JSON.stringify({
        type: 1,
        x,
        y,
        color: activeColor,
        strokeWidth: activeWidth,
      })
    )
  }

  function drawSegment(x0, y0, x1, y1) {
    ctx.current.beginPath()
    ctx.current.moveTo(x0, y0)
    ctx.current.lineTo(x1, y1)
    ctx.current.stroke()
  }

  // Midpoint quadratic smoothing: instead of connecting raw samples with
  // straight segments (visible corners at every sample), each curve runs
  // between consecutive sample midpoints with the sample itself as the
  // control point — the standard freehand-smoothing technique. Used
  // identically for local drawing and remote replay so both canvases stay
  // in pixel lockstep (which flood fill depends on).
  const drawSmoothTo = (x, y) => {
    const midX = (lastX.current + x) / 2
    const midY = (lastY.current + y) / 2
    ctx.current.beginPath()
    ctx.current.moveTo(
      lastMidX.current ?? lastX.current,
      lastMidY.current ?? lastY.current
    )
    ctx.current.quadraticCurveTo(lastX.current, lastY.current, midX, midY)
    ctx.current.stroke()
    lastMidX.current = midX
    lastMidY.current = midY
    lastX.current = x
    lastY.current = y
  }

  function drawToo(x, y) {
    drawSmoothTo(x, y)
  }

  function pointerMove(clientX, clientY) {
    if (state.id !== state.turnID || !state.isDrawing) return
    const { x, y } = getCanvasPoint(clientX, clientY)
    drawSmoothTo(x, y)
    sendCord(x, y)
  }

  const sendCord = (x, y) => {
    ws.current.send(JSON.stringify({ type: 2, x, y }))
  }

  function stopDrawing() {
    if (!state.isDrawing) return
    dispatch({ type: "setIsDrawing", payload: false })
  }

  // Brush preview ring: shows exactly where and how big the next stroke
  // will land — hidden for guessers and for the fill tool (which gets a
  // crosshair cursor instead). Direct style writes, no re-renders.
  const updateBrushCursor = (clientX, clientY) => {
    const el = brushCursorRef.current
    if (!el) return
    if (state.turnID !== state.id || state.tool === "fill") {
      el.style.display = "none"
      return
    }
    const r = canvasRef.current.getBoundingClientRect()
    const cssScale = r.width / CANVAS_WIDTH
    const logicalWidth =
      state.tool === "eraser" ? state.eraserWidth : state.strokeWidth
    const size = Math.max(logicalWidth * cssScale, 6)
    el.style.display = "block"
    el.style.width = `${size}px`
    el.style.height = `${size}px`
    el.style.left = `${clientX - r.left}px`
    el.style.top = `${clientY - r.top}px`
    el.style.borderColor = state.tool === "eraser" ? "#94a3b8" : state.color
  }

  const hideBrushCursor = () => {
    if (brushCursorRef.current) brushCursorRef.current.style.display = "none"
  }

  const handleMouseDown = (e) => pointerDown(e.clientX, e.clientY)
  const handleMouseMove = (e) => {
    pointerMove(e.clientX, e.clientY)
    updateBrushCursor(e.clientX, e.clientY)
  }

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault() // stop the page from scrolling while drawing
    pointerDown(touch.clientX, touch.clientY)
  }
  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    if (!touch) return
    e.preventDefault()
    pointerMove(touch.clientX, touch.clientY)
  }

  const sendName = (name, color) => {
    if (ws.current.readyState !== WebSocket.OPEN) {
      toast.error("Establishing connection please wait...")
      return
    }
    const token = crypto.randomUUID()
    writeSession(p.roomID, { name, token, color })
    setHasSession(true)
    ws.current.send(JSON.stringify({ type: 0, name, token, color }))
  }

  const sendMessage = (message) => {
    if (!message.trim()) return
    ws.current.send(JSON.stringify({ type: 3, id: state.id, message }))
  }

  const sendStartGame = () => {
    ws.current.send(JSON.stringify({ type: 12 }))
  }

  const turnDurationMs = state.turnDurationMs || DEFAULT_TURN_DURATION_MS

  return state.id == null ? (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full flex-col items-center justify-center gap-4 px-4">
      {hasSession ? (
        <div className="flex flex-col items-center text-center text-base text-slate-800">
          <p>Reconnecting you to the game...</p>
        </div>
      ) : (
        <Card className="flex w-full max-w-xs flex-col items-center gap-4 p-6">
          <div className="flex flex-col items-center text-center text-base text-slate-800">
            <p>Enter your name to join the game.</p>
            <p className="text-slate-600">Pick a color to represent you.</p>
          </div>
          <Input
            className="w-full text-center text-lg"
            type="text"
            id="name"
            placeholder="Your name"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                const name = e.target.value.trim()
                if (name.length === 0) return
                if (name.length > 8) {
                  toast.error("The name can contain a maximum of 8 letters!!")
                  return
                }
                if (name.split(" ").length > 1) {
                  toast.error("The Name can contain only one word!!")
                  return
                }
                sendName(name, avatarColor)
              }
            }}
          />
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-slate-600">Pick your color</p>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Choose avatar color ${c}`}
                  onClick={() => setAvatarColor(c)}
                  className={`h-8 w-8 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                    avatarColor === c
                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white"
                      : "ring-1 ring-inset ring-black/10"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  ) : (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-4 lg:flex-row lg:justify-between lg:px-10">
      <div className="relative flex w-full flex-col gap-2 lg:w-[60%]">
        {state.gameOver && (
          <GameOverOverlay
            gameOver={state.gameOver}
            selfId={state.id}
            isHost={state.id === state.hostId}
            canStart={state.canStart}
            onStartNext={sendStartGame}
          />
        )}
        {state.turnID === -1 && !state.gameOver && (
          <Card className="flex flex-col items-center gap-3 p-6 text-center">
            <h2 className="text-lg font-semibold text-slate-800">
              Waiting to start
            </h2>
            <p className="text-sm text-slate-600">
              {Object.keys(state.names || {}).length} player
              {Object.keys(state.names || {}).length === 1 ? "" : "s"} in the
              room
            </p>
            {state.id === state.hostId ? (
              <Button onClick={sendStartGame} disabled={!state.canStart}>
                <LuPlay className="h-4 w-4" />
                {state.canStart ? "Start Game" : "Waiting for another player..."}
              </Button>
            ) : (
              <p className="text-sm text-slate-500">
                Waiting for {state.names?.[state.hostId] || "the host"} to
                start the game...
              </p>
            )}
          </Card>
        )}
        {state.turnID !== -1 && (
        <>
        <Card className="flex flex-col gap-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold text-slate-800">Canvas</h1>
              <Badge>
                Round {state.round}/{state.maxRounds}
              </Badge>
              {state.id === state.turnID && (
                <Badge variant="accent">Word: {state.word}</Badge>
              )}
              {state.id !== state.turnID && state.hint && (
                <Badge
                  variant="accent"
                  className="font-mono text-sm tracking-widest"
                  aria-label="Word hint"
                >
                  {state.hint.split("").join(" ")}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={soundMuted ? "Unmute sound" : "Mute sound"}
                onClick={() => setSoundMuted(toggleMuted())}
                className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
              >
                {soundMuted ? (
                  <LuVolumeX className="h-4 w-4" />
                ) : (
                  <LuVolume2 className="h-4 w-4" />
                )}
              </button>
              {time && (
                <TurnCountdown
                  key={String(time)}
                  endAtMs={new Date(time).getTime() + turnDurationMs}
                  durationMs={turnDurationMs}
                  getServerNow={getServerNow}
                />
              )}
            </div>
          </div>
          <div className="relative">
            <canvas
              onMouseDown={handleMouseDown}
              onMouseUp={stopDrawing}
              onMouseMove={handleMouseMove}
              onMouseOut={() => {
                stopDrawing()
                hideBrushCursor()
              }}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={stopDrawing}
              onTouchCancel={stopDrawing}
              ref={canvasRef}
              id="canvas"
              width={CANVAS_WIDTH * RENDER_SCALE}
              height={CANVAS_HEIGHT * RENDER_SCALE}
              style={{
                touchAction: "none",
                aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}`,
                backgroundImage:
                  "radial-gradient(circle, rgb(0 0 0 / 6%) 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
              className={`w-full max-w-full rounded-md border border-black/10 bg-white shadow-inner ${
                state.turnID === state.id
                  ? state.tool === "fill"
                    ? "cursor-crosshair"
                    : "cursor-none"
                  : ""
              }`}
            ></canvas>
            <div
              ref={brushCursorRef}
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
              style={{ display: "none" }}
            />
          </div>
        </Card>
        {state.turnID === state.id ? (
          <Card className="flex flex-col gap-4 p-4 text-slate-700">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex overflow-hidden rounded-md border border-slate-300">
                {[
                  { tool: "pen", label: "Pen", Icon: LuPencil },
                  { tool: "eraser", label: "Eraser", Icon: LuEraser },
                  { tool: "fill", label: "Fill", Icon: LuPaintBucket },
                ].map(({ tool, label, Icon }) => (
                  <button
                    key={tool}
                    type="button"
                    className={`flex cursor-pointer items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${state.tool === tool ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                    disabled={state.tool === tool}
                    onClick={() => dispatch({ type: "setTool", payload: tool })}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
              <Button
                variant="danger"
                onClick={() => {
                  ws.current.send(JSON.stringify({ type: 5 }))
                  clearCanvas()
                }}
              >
                <LuTrash2 className="h-4 w-4" /> Clear
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold text-slate-600">Color</span>
              {QUICK_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Use color ${c}`}
                  onClick={() => dispatch({ type: "setColor", payload: c })}
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                    state.color.toLowerCase() === c
                      ? "ring-2 ring-indigo-500 ring-offset-2 ring-offset-white"
                      : "ring-1 ring-inset ring-black/10"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <ColorPickerButton
                color={state.color}
                onChange={(hex) => dispatch({ type: "setColor", payload: hex })}
              />
            </div>

            {state.tool !== "fill" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-slate-600">
                  {state.tool === "eraser" ? "Eraser size" : "Brush size"}
                </span>
                {(state.tool === "eraser" ? ERASER_SIZES : STROKE_SIZES).map(
                  (size) => {
                    const selected =
                      state.tool === "eraser"
                        ? state.eraserWidth === size
                        : state.strokeWidth === size
                    return (
                      <button
                        key={size}
                        type="button"
                        aria-label={`Size ${size}px`}
                        onClick={() =>
                          dispatch({
                            type:
                              state.tool === "eraser"
                                ? "setEraserWidth"
                                : "setStrokeWidth",
                            payload: size,
                          })
                        }
                        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                          selected
                            ? "border-indigo-400 bg-indigo-50"
                            : "border-slate-300 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <span
                          className="rounded-full bg-slate-500"
                          style={{
                            width: Math.min(size, 20),
                            height: Math.min(size, 20),
                          }}
                        />
                      </button>
                    )
                  }
                )}
              </div>
            )}
          </Card>
        ) : (
          state.turnID != null && (
            <Card className="flex items-center gap-2 py-3 text-sm text-slate-600">
              <LuPencil className="h-4 w-4" />
              {state.names?.[state.turnID] || "Someone"} is drawing now...
            </Card>
          )
        )}
        </>
        )}
      </div>
      <div className="flex w-full flex-col gap-4 lg:w-[340px]">
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-800">
            Scores
          </h2>
          <Scores
            names={state.names}
            scores={state.scores}
            colors={state.colors}
            id={state.id}
            turnID={state.turnID}
          ></Scores>
        </Card>

        <Card className="relative flex h-[420px] w-full flex-col p-3 lg:h-[480px]">
          {celebration && (
            <CelebrationPopup key={celebration.key} name={celebration.name} />
          )}
          <h2 className="mb-2 text-lg font-semibold text-slate-800">Chat</h2>
          <ChatBox msgArr={state.msgArr} />
          {state.id !== state.turnID && (
            <Input
              className="mt-2 h-10 w-full"
              type="text"
              id="message"
              placeholder="Type your guess..."
              value={state.message}
              onChange={(e) =>
                dispatch({ type: "setMessage", payload: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  dispatch({ type: "setMessage", payload: "" })
                  sendMessage(e.target.value)
                }
              }}
            />
          )}
        </Card>
      </div>
    </div>
  )
}

export default GameArena
