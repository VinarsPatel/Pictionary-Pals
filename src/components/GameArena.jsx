import React, { useEffect, useRef, useReducer, useState } from "react"
import Compact from "@uiw/react-color-compact"
import { useParams } from "react-router-dom"
import toast from "react-hot-toast"
import Scores from "./Scores"

import ChatBox from "./ChatBox"

const initialState = {
  message: "",
  word: "",
  color: "#000000",
  eraseMode: false,
  strokeWidth: 2,
  eraserWidth: 10,
  isDrawing: false,
  id: null,
  turnID: null,
  names: null,
  scores: null,
  msgArr: [],
}

function reducer(state, action) {
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
        word: action?.word,
      }
    case "setMessage":
      return { ...state, message: action.payload }
    case "setColor":
      return { ...state, color: action.payload }
    case "setEraseMode":
      return { ...state, eraseMode: action.payload }
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
        msgArr: [...state.msgArr, action.msg],
      }
    case "deltaPlayer":
      return {
        ...state,
        names: action.names,
        scores: action.scores,
        msgArr: [...state.msgArr, action.msg],
      }
    default:
      throw new Error()
  }
}

// const renderTime = ({ remainingTime }) => {
//   if (remainingTime === 0) {
//     return <div className="timer">Times up...</div>
//   }

//   return (
//     <div className="timer">
//       <div className="text">Remaining</div>
//       <div className="value">{remainingTime}</div>
//       <div className="text">seconds</div>
//     </div>
//   )
// }

const GameArena = () => {
  const [state, dispatch] = useReducer(reducer, initialState)
  const canvasRef = useRef(null)
  const p = useParams()
  const ctx = useRef(null)
  const rect = useRef(null)
  const [time, setTime] = useState(null)
  let lastX = useRef(null)
  let lastY = useRef(null)


  const ws = useRef(null)
  const url = "ws://localhost:9833"

  const setVar = (msg) => {
    lastX.current = msg.x
    lastY.current = msg.y
    ctx.current.lineWidth = msg.strokeWidth
    ctx.current.strokeStyle = msg.color
  }
  const wsMessageHandler = (msg) => {
    switch (msg.type) {
      case 0:
        let opt = {
          type: "setAll",
          id: msg.id,
          turnID: msg.turnID,
          names: msg.names,
          scores: msg.scores,
        }
        if (msg.turnID === msg.id) {
          opt["word"] = msg.word
          ctx.current.clearRect(0, 0, 700, 500)
          ws.current.send(JSON.stringify({ type: 5 }))
        }
        dispatch(opt)
        setTime(msg.time)
        break
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
            msg: `G ${msg.id} guessed the word!👏👏`,
            scores: msg.scores,
          })
        } else {
          dispatch({
            type: "addMsg",
            msg: `B ${msg.id} : ${msg.message}`,
          })
        }
        break
      case 4:
        let options = {
          type: "changeTurn",
          msg: `S ${msg.turnID} is drawing now.`,
          turnID: msg.turnID,
          word: msg.word,
        }
        dispatch(options)
        setTime(msg.time)
        ctx.current.clearRect(0, 0, 780, 450)
        break
      case 5:
        ctx.current.clearRect(0, 0, 780, 450)
        break
      case 6:
        dispatch({
          type: "deltaPlayer",
          msg: `O ${msg.id} joined the room.`,
          scores: msg.scores,
          names: msg.names,
        })
        break
      case 7:
        dispatch({
          type: "deltaPlayer",
          msg: `R ${msg.id} left the room.`,
          scores: msg.scores,
          names: msg.names,
        })
    }
  }
  let toastid = null
  useEffect(() => {
    // Initialize WebSocket
    const connectWebSocket = () => {
      if (ws.current) {
        ws.current.onerror = ws.current.onopen = ws.current.onclose = null
        ws.current.close()
      }
      ws.current = new WebSocket(`${url}/${p.roomID}`)
      // console.log("Attempting to connect to WebSocket:", `${url}/${p.roomID}`)

      ws.current.onopen = () => {
        if (toastid) toast.remove(toastid)
        //   console.log("WebSocket connection opened")
      }

      ws.current.onerror = (error) => {
        if (toastid) toast.remove(toastid)
        console.error("WebSocket error:", error)
      }

      ws.current.onclose = () => {
        // console.log("WebSocket connection closed")
        // Attempt to reconnect in case of a connection failure
        toast.error("Connection lost!")
        ws.current = null
        if (toastid) toast.remove(toastid)
        toastid = toast.loading("Trying to reconnect please wait...")
        dispatch({ type: "reset", payload: initialState })
        setTimeout(() => connectWebSocket(), 5000)
      }
      ws.current.onmessage = (message) => {
        //   console.log(message);
        const msg = JSON.parse(message.data)
        wsMessageHandler(msg)
      }
    }

    connectWebSocket()
    // Cleanup on component unmount
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
      ctx.current = canvasRef.current.getContext("2d")
      rect.current = canvasRef.current.getBoundingClientRect()
    }
  })

  function startDrawing(e) {
    if (state.turnID !== state.id) {
      return
    }
    dispatch({ type: "setIsDrawing", payload: true })
    rect.current = canvasRef.current.getBoundingClientRect()

    lastX.current = e.pageX - rect.current.left - window.scrollX
    lastY.current = e.pageY - rect.current.top - window.scrollY
    ctx.current.lineWidth = state.eraseMode
      ? state.eraserWidth
      : state.strokeWidth
    ctx.current.strokeStyle = state.color
    ctx.current.lineJoin = "round"

    ws.current.send(
      JSON.stringify({
        type: 1,
        x: lastX.current,
        y: lastY.current,
        color: state.color,
        strokeWidth: state.eraseMode ? state.eraserWidth : state.strokeWidth,
      })
    )
  }

  function drawToo(x, y) {
    ctx.current.beginPath()
    ctx.current.moveTo(lastX.current, lastY.current)
    ctx.current.lineTo(x, y)
    ctx.current.stroke()
    lastX.current = x
    lastY.current = y
  }
  function draw(e) {
    if (state.id !== state.turnID || !state.isDrawing) return
    rect.current = canvasRef.current.getBoundingClientRect()
    const x = e.pageX - rect.current.left - window.scrollX
    const y = e.pageY - rect.current.top - window.scrollY
    ctx.current.beginPath()
    ctx.current.moveTo(lastX.current, lastY.current)
    ctx.current.lineTo(x, y)

    ctx.current.stroke()
    sendCord(x, y)
    lastX.current = x
    lastY.current = y
  }

  const sendCord = async (x, y) => {
    ws.current.send(
      JSON.stringify({
        type: 2,
        x: x,
        y: y,
      })
    )
  }
  function stopDrawing() {
    if (!state.isDrawing) return
    dispatch({ type: "setIsDrawing", payload: false })
  }

  const handleStrokeWidthChange = (event) => {
    dispatch({ type: "setStrokeWidth", payload: +event.target.value })

    ctx.current.lineWidth = state.strokeWidth
  }

  const handleEraserWidthChange = (event) => {
    dispatch({ type: "setEraserWidth", payload: +event.target.value })
    ctx.current.lineWidth = state.eraseWidth
  }

  const sendName = (name) => {
    if (ws == null) {
      toast.error("Estabilishing connection please wait...")
      return
    }
    ws.current.send(JSON.stringify({ type: 0, name: name }))
  }

  const sendMessage = (message) => {
    ws.current.send(JSON.stringify({ type: 3, id: state.id, message: message }))
  }

  const [timer, setTimer] = useState(null)
  const inc = useRef(null)
  useEffect(() => {
    if (inc?.current) clearInterval(inc.current)

    inc.current = setInterval(() => {
      setTimer(() => {
        const x = 60 + parseInt(new Date(time) - Date.now()) / 1000
        //   console.log(x)
        if (x > 0) return Math.floor(x)
        else {
          clearInterval(inc.current)
          setTime(null)
          dispatch({ type: "setTurnID", payload: null })
          return 0
        }
      })

      return () => clearInterval(inc.current)
    }, 1000)
  }, [time])

  return state.id == null ? (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] min-w-[400px] w-screen flex-col items-center justify-center">
      <div className="flex flex-col text-justify text-base text-richblack-5">
        <p>Enter your name to join the game, 😁</p>
        <p>Without your name, it's not the same. 😎</p>
      </div>
      <input
        className="rounded-md border-2 border-caribbeangreen-50 bg-richblack-700 px-4 py-2 text-lg text-white "
        type="text"
        id="name"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const name = e.target.value
            if (name.length > 8) {
              toast.error("The name can contain a maximum of 8 letters!!")
              return
            }
            if (name.split(" ").lenght > 1) {
              toast.error("The Name can contain only one word!!")
              return
            }
            sendName(e.target.value)
          }
        }}
      />
    </div>
  ) : (
    <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-[90%] min-w-[1400px]  justify-between px-10">
      <div className=" flex w-[60%] flex-col gap-2">
        <div className="h-full">
          <div className="flex items-center justify-between gap-10 text-lg font-semibold text-richblack-50 ">
            <h1 className="basis-1/3 ">Canvas</h1>
            {state.id === state.turnID && (
              <p className="basis-1/3 ">Word : {state.word}</p>
            )}
            {time && (
              <div className="basis-1/3 text-pink-200">Countdown: {timer}</div>
            )}
          </div>
          <canvas
            onMouseDown={startDrawing}
            onMouseUp={stopDrawing}
            onMouseMove={draw}
            onMouseOut={stopDrawing}
            disabled={ws === null}
            ref={canvasRef}
            id="canvas"
            width="780"
            height="450"
            className=" bg-white "
          ></canvas>
        </div>
        {state.turnID === state.id && (
          <div className="flex justify-between  rounded-md bg-richblack-700 p-4 text-lg text-richblack-25 ">
            <div className="flex flex-col justify-between gap-2 ">
              <h3 className="text-lg font-semibold text-richblack-50 ">
                Tools :
              </h3>
              <div className="flex justify-between">
                <button
                  type="button"
                  className={`w-fit rounded-md ${!state.eraseMode ? "border border-yellow-50 bg-transparent text-richblack-25" : "bg-yellow-50 text-richblack-900"} cursor-pointer px-1  text-base`}
                  disabled={!state.eraseMode}
                  onClick={() =>
                    dispatch({ type: "setEraseMode", payload: false })
                  }
                >
                  Pen
                </button>
                <div className="flex justify-between gap-2">
                  <label htmlFor="strokeWidth" className="form-label">
                    Linewidth
                  </label>
                  <input
                    disabled={state.eraseMode}
                    type="range"
                    className="form-range"
                    min="1"
                    max="4"
                    step="1"
                    id="strokeWidth"
                    value={state.strokeWidth}
                    onChange={handleStrokeWidthChange}
                  />
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  className={`w-fit rounded-md ${state.eraseMode ? "border border-yellow-50 bg-transparent text-richblack-25 " : "bg-yellow-50 text-richblack-900"} cursor-pointer px-1  text-base `}
                  disabled={state.eraseMode}
                  onClick={() => {
                    dispatch({ type: "setEraseMode", payload: true })
                    dispatch({ type: "setColor", payload: "#ffffff" })
                  }}
                >
                  Eraser
                </button>
                <div className="flex gap-2">
                  <label htmlFor="eraserWidth" className="form-label">
                    Eraserwidth
                  </label>
                  <input
                    disabled={!state.eraseMode}
                    type="range"
                    className="form-range"
                    min="1"
                    max="20"
                    step="1"
                    id="eraserWidth"
                    value={state.eraserWidth}
                    onChange={handleEraserWidthChange}
                  />
                </div>
              </div>

              <button
                type="button"
                className="w-fit cursor-pointer rounded-md bg-yellow-50 px-1  text-base text-richblack-900"
                onClick={() => {
                  ws.current.send(JSON.stringify({ type: 5 }))
                  ctx.current.clearRect(0, 0, 700, 500)
                }}
              >
                Clear Canvas
              </button>
            </div>
            <Compact
              color={state.color}
              style={{
                boxShadow:
                  "rgb(0 0 0 / 15%) 0px 0px 0px 1px, rgb(0 0 0 / 15%) 0px 8px 16px",
              }}
              onChange={(color) => {
                dispatch({ type: "setColor", payload: color.hex })
              }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-col gap-10">
        <div className="">
          <h2 className="text-lg font-semibold text-richblack-50">Scores</h2>

          <Scores
            names={state.names}
            scores={state.scores}
            id={state.id}
            turnID={state.turnID}
          ></Scores>
        </div>

        <div className="mx-auto flex h-[80%] max-h-[500px]  w-[360px] flex-col justify-end rounded-md bg-richblack-800 text-richblack-900 ">
          <ChatBox msgArr={state.msgArr} names={state.names}/>
          <div className="flex justify-evenly ">
            {state.id !== state.turnID && (
              <input
                className="inputStyle h-fit w-[80%]"
                type="textarea"
                id="message"
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
          </div>
        </div>
      </div>
    </div>
  )
}

export default GameArena
