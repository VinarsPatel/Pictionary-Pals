import React, { useState, useEffect, useRef } from "react"
import Compact from "@uiw/react-color-compact"
import { useParams } from "react-router-dom"
import toast from "react-hot-toast"
const colorObj = {
  G: ["#00FF00", "#008000"],
  O: ["#FFA500", "#FF5F1F"],
  R: ["#FF0000", "#800000"],
  S: ["#0000FF", "#000080"],
  B: ["#C0C0C0", "#808080"],
}
const GameArena = () => {
  const [name, setName] = useState("")
  const [message, setMessage] = useState("")
  const [msgArr, setMsgArr] = useState([])
  const [word, setWord] = useState("")
  const [turnID, setTurnID] = useState(null)
  const [id, setId] = useState(null)
  const [names, setNames] = useState(null)
  const [scores, setScores] = useState(null)
  const canvasRef = useRef(null)
  const p = useParams()
  const [ctx, setCtx] = useState(null)
  const [color, setColor] = useState("000000")
  const rect = useRef(null)
  const [eraseMode, setEraseMode] = useState(false)
  const [strokeWidth, setStrokeWidth] = useState(5)
  const [eraserWidth, setEraserWidth] = useState(10)
  const [lastX, setLastX] = useState(0)
  const [lastY, setLastY] = useState(0)
  const [isDrawing, setIsDrawing] = useState(false)
  const [ws, setWs] = useState(null)
  const url = "ws://localhost:9833"

  useEffect(() => {
    // Initialize WebSocket
    const connectWebSocket = () => {
      if (ws) {
        ws.onerror = ws.onopen = ws.onclose = null
        ws.close()
      }
      const newWs = new WebSocket(`${url}/${p.roomID}`)
      console.log("Attempting to connect to WebSocket:", `${url}/${p.roomID}`)

      newWs.onopen = () => {
        console.log("WebSocket connection opened")
      }

      newWs.onerror = (error) => {
        console.error("WebSocket error:", error)
      }

      newWs.onclose = () => {
        console.log("WebSocket connection closed")
        // Attempt to reconnect in case of a connection failure
        toast.error("Connection lost!")
        setWs(null)
        setId(null)
        setTimeout(() => connectWebSocket(), 1000)
      }

      newWs.onmessage = (message) => {
        console.log("WebSocket message received:", message.data)
        const msg = JSON.parse(message.data)

        switch (msg.type) {
          case 0:
            if (msg.turnID === msg.id) setWord(msg.word)
            setId(msg.id)
            setTurnID(msg.turnID)
            setScores(msg.scores)
            console.log("here")
            setNames(msg.names)
            console.log(msg.names)

            break
          case 1:
            break
          case 3:
            console.log(names);
            if (msg.isTrue) {
              setMsgArr([...msgArr, `G ${names[msg.id]} guessed the word!👏👏`])
              setScores(msg.scores)
            } else {
              setMsgArr([...msgArr, `B ${names[msg.id]}: ${msg.message}`])
            }
            break

          case 4:
            console.log(names)
            console.log(turnID)
            setMsgArr([...msgArr, `S ${names[msg.turnID]} is drawing now.`])
            setTurnID(msg.turnID)
            if (msg.turnID === id) setWord(msg.word)
            break

          case 6:
              setMsgArr([...msgArr, `O ${names[msg.id]} joined the room.`])
              setScores((sco)=>sco[msg.id] = 0)
              setNames((nam)=>nam[msg.id] = msg.name)
            break

          case 7:
              setMsgArr([...msgArr, `R ${names[msg.id]} left the room.`])
              var sco = scores
              delete sco[msg.id]
              setScores(sco => delete sco[msg.id])
              var nam = names
              delete nam[msg.id]
              setNames(nam =>delete nam[msg.id])
            break

          default:
            break
        }
      }

      setWs(newWs)
    }

    connectWebSocket()

    // Cleanup on component unmount
    return () => {
      if (ws) {
        ws.onerror = ws.onopen = ws.onclose = null
        ws.close()
      }
    }
  }, [p.roomID])

  useEffect(() => {
    if (canvasRef.current != null) {
      setCtx(canvasRef.current.getContext("2d"))
      rect.current = canvasRef.current.getBoundingClientRect()
    }
  }, [canvasRef])

  function startDrawing(e) {
    if (ws == null) {
      console.log("ws not connected")
      return
    }
    if (!(turnID === id)) {
      return
    }
    setIsDrawing(true)
    ctx.lineWidth = eraseMode ? eraserWidth : strokeWidth
    ctx.lineJoin = "round"
    ctx.strokeStyle = color
    console.log(e)
    setLastX(e.clientX - rect.left)
    setLastY(e.clientY - rect.top)
    draw(e)
    //   ws.send(JSON.stringify({x:e.clientX -  rect.left,y:e.clientY - rect.top}));
  }

  function draw(e) {
    if (!isDrawing) return

    ctx.beginPath()
    ctx.moveTo(lastX, lastY)
    ctx.lineTo(e.clientX - rect.current.left, e.clientY - rect.current.top)
    ctx.stroke()
    ws.send(
      JSON.stringify({
        x: e.clientX - rect.current.left,
        y: e.clientY - rect.current.top,
        lastX,
        lastY,
      })
    )
    setLastX(e.clientX - rect.current.left)
    setLastY(e.clientY - rect.current.top)
  }

  function stopDrawing() {
    setIsDrawing(false)
  }

  const handleStrokeWidthChange = (event) => {
    setStrokeWidth(+event.target.value)
    ctx.lineWidth = strokeWidth
  }

  const handleEraserWidthChange = (event) => {
    setEraserWidth(+event.target.value)
  }
  //   const sendGuess = () => {
  //     // Send guess to server
  //     // ...
  //   }
  const sendName = () => {
    // Send guess to server
    // ...
    ws.send(JSON.stringify({ type: 0, name }))
  }

  const sendMessage = () => {
    // Send message to server
    // ...
    ws.send(JSON.stringify({ type: 3, id, message }))
  }

  return id == null ? (
    <div>
      <input
        className="inputStyle"
        type="text"
        id="name"
        disabled={id != null}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button id="enter" onClick={sendName}>
        Enter
      </button>
    </div>
  ) : (
    <div>
      <p id="player"></p>

      <div className="flex w-full justify-between gap-9 px-10 pt-6">
        <div className="d-flex flex-column gap-2">
          <div className="flex justify-between">
            <div className="d-flex align-items-center gap-2 ">
              <h1>Tools</h1>
              <div className="flex justify-between">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={!eraseMode && !(turnID === id)}
                  onClick={() => setEraseMode(false)}
                >
                  Pen
                </button>
                <div className="flex gap-2">
                  <label htmlFor="strokeWidth" className="form-label">
                    Stroke width
                  </label>
                  <input
                    disabled={eraseMode || !(turnID === id)}
                    type="range"
                    className="form-range"
                    min="1"
                    max="4"
                    step="1"
                    id="strokeWidth"
                    value={strokeWidth}
                    onChange={handleStrokeWidthChange}
                  />
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  disabled={eraseMode || !(turnID === id)}
                  onClick={() => {
                    setEraseMode(true)
                    setColor("#ffffff")
                  }}
                >
                  Eraser
                </button>
                <div className="flex gap-2">
                  <label htmlFor="eraserWidth" className="form-label">
                    Eraser width
                  </label>
                  <input
                    disabled={!eraseMode || !(turnID === id)}
                    type="range"
                    className="form-range"
                    min="1"
                    max="20"
                    step="1"
                    id="eraserWidth"
                    value={eraserWidth}
                    onChange={handleEraserWidthChange}
                  />
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                disabled={!eraseMode || !(turnID === id)}
                onClick={() => ctx.clearRect(0, 0, 600, 550)}
              >
                Clear Canvas
              </button>
            </div>
            <Compact
              disabled={!(turnID === id)}
              color={color}
              style={{
                boxShadow:
                  "rgb(0 0 0 / 15%) 0px 0px 0px 1px, rgb(0 0 0 / 15%) 0px 8px 16px",
              }}
              onChange={(color) => {
                setColor(color.hex)
              }}
            />
          </div>
          <div className="">
            <h1>Canvas</h1>
            <canvas
              onMouseDown={startDrawing}
              onMouseUp={stopDrawing}
              onMouseMove={draw}
              onMouseOut={stopDrawing}
              //   ref={(canvas) => {
              //     if (canvas) {
              //       setCtx(canvas.getContext("2d"))
              //       rect.current = canvas.getBoundingClientRect()
              //     }
              //   }}

              disabled={!(turnID === id) || ws === null}
              ref={canvasRef}
              id="canvas"
              width="700"
              height="500"
              className="flex border-2"
            ></canvas>
          </div>
        </div>
        <div className="flex w-full flex-col">
          <div className="h-[30%]">
            <h2>Score</h2>
            <div className="flex flex-wrap gap-2">
              {scores &&
                Object.keys(scores).map((key) => (
                  <div
                    key={key}
                    className={`flex min-w-12 flex-col items-center rounded-md px-2  ${key === turnID ? "bg-yellow-50" : "bg-blue-100"}`}
                  >
                    <p>
                      {names[key]} {key === id && "(You)"}
                    </p>
                    <p>{scores[key]}</p>
                  </div>
                ))}
            </div>
          </div>
          {/* <div className="flex h-[60%] justify-around gap-4 "> */}
          <div className="mx-auto flex h-[80%] w-[360px] flex-col justify-end rounded-md border p-2">
            <div id="messages">
              {msgArr.map((msg, ind) => (
                <p className={`bg-[${colorObj[msg[0]][ind % 2]}]`} key={ind}>
                  {msg.substring(1)}
                </p>
              ))}
            </div>
            <div className="flex justify-evenly ">
              <input
                className="inputStyle h-fit w-[80%]"
                type="textarea"
                id="message"
                value={message}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    sendMessage()
                  }
                }}
                onChange={(e) => setMessage(e.target.value)}
              />
              {/* <button id="send" onClick={sendMessage}>
                  Send
                </button> */}
            </div>
          </div>
          {/* </div> */}
        </div>
      </div>
    </div>
  )
}

export default GameArena
