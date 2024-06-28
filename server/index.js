const WebSocket = require("ws")
const express = require("express")
const app = express()
const cors = require("cors")
const http = require("http")
const crypto = require("crypto")
require("dotenv").config()
const wordsArray = [
  "apple",
  "banana",
  "carrot",
  "elephant",
  "football",
  "guitar",
  "house",
  "internet",
  "jungle",
  "kangaroo",
  "laptop",
  "mountain",
  "notebook",
  "ocean",
  "piano",
  "quilt",
  "rocket",
  "sunflower",
  "train",
  "umbrella",
  "violin",
  "watermelon",
  "xylophone",
  "yacht",
  "zebra",
]

function getWord() {
  const randomIndex = Math.floor(Math.random() * wordsArray.length)
  return wordsArray[randomIndex]
}

app.use(express.json())
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
)
app.get("/", (req, res) => {
  res.send(`<h1>Server Started</h1>`)
})

var webSockets = {}

app.get("/getRoom", (req, res) => {
  try {
    const roomId = crypto.randomBytes(10).toString("hex")
    if (!(roomId in webSockets)) {
      return res.status(200).json({
        success: true,
        roomId,
      })
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    })
  }
})

const server = http.createServer(express)
const wsServer = new WebSocket.Server({ server }) // a websocket server

server.on("request", app)

wsServer.on("connection", function (ws, req) {
  var roomID = req.url.substring(1)

  const messageSender = (messageObj) => {
    const users = webSockets[roomID].users
    Object.keys(users).forEach(function each(userID) {
      if (users[userID] != ws) {
        if (users[userID]?.readyState === WebSocket.OPEN)
          users[userID].send(JSON.stringify(messageObj))
        else {
          var name = webSockets[roomID].names[userID]
          delete webSockets[roomID].users[userID]
          delete webSockets[roomID].names[userID]
          delete webSockets[roomID].scores[userID]
          webSockets[roomID].count -= 1
          messageSender({
            type: 7,
            name,
            id: userID,
            names: webSockets[roomID].names,
            scores: webSockets[roomID].scores,
          })
        }
      }
    })
  }

  const removeClosedConnection = () => {
    const users = webSockets[roomID]?.users
    let f = 0
    if (users != null) {
      Object.keys(users).forEach(function each(userID) {
        if (users[userID]?.readyState !== WebSocket.OPEN) {
          f++
          var name = webSockets[roomID].names[userID]
          delete webSockets[roomID].users[userID]
          delete webSockets[roomID].names[userID]
          delete webSockets[roomID].scores[userID]
          webSockets[roomID].count -= 1
          messageSender({
            type: 7,
            name,
            id: userID,
            names: webSockets[roomID].names,
            scores: webSockets[roomID].scores,
          })
        }
      })
    }
  }
  const changeTurn = () => {
    const keys = Object.keys(webSockets[roomID].users)
    const ind = keys.findIndex((x) => x == webSockets[roomID].turnID)
    if (ind == keys.length) {
      ind = 0
    }
    webSockets[roomID].turnID = parseInt(keys[ind + 1])
    webSockets[roomID].ans = getWord()
    ws.send(
      JSON.stringify({
        type: 4,
        turnID: webSockets[roomID].turnID,
        word: webSockets[roomID].ans,
      })
    )
    messageSender({
      type: 4,
      turnID: webSockets[roomID].turnID,
    })
  }
  ws.on("message", (message) => {
    // Echo the message back to the client
    const msg = JSON.parse(message)
    removeClosedConnection()
    switch (msg.type) {
      case 0:
        if (
          !webSockets[roomID] ||
          Object.keys(webSockets[roomID].users).length == 0
        ) {
          webSockets[roomID] = {
            idPointer: 2,
            count: 1,
            turnID: -1,
            users: { 1: ws },
            names: { 1: msg.name },
            scores: { 1: 0 },
          }
          ws.send(
            JSON.stringify({
              type: 0,
              id: 1,
              turnID: webSockets[roomID].turnID,
              names: webSockets[roomID].names,
              scores: webSockets[roomID].scores,
            })
          )
        } else {
          var ind = webSockets[roomID].idPointer
          webSockets[roomID].idPointer += 1
          webSockets[roomID].count += 1
          webSockets[roomID].users[ind] = ws
          webSockets[roomID].names[ind] = msg.name
          webSockets[roomID].scores[ind] = 0
          if (webSockets[roomID].count == 2) {
            webSockets[roomID].turnID = parseInt(
              Object.keys(webSockets[roomID].users)[0]
            )
            webSockets[roomID].ans = getWord()
            messageSender({
              type: 4,
              turnID: webSockets[roomID].turnID,
              word: webSockets[roomID].ans,
            })
          }

          ws.send(
            JSON.stringify({
              type: 0,
              id: ind,
              turnID: webSockets[roomID].turnID,
              names: webSockets[roomID].names,
              scores: webSockets[roomID].scores,
            })
          )
          messageSender({
            type: 6,
            name: msg.name,
            id: ind,
            names: webSockets[roomID].names,
            scores: webSockets[roomID].scores,
          })
        }
        break

      case 1:
        messageSender(msg)
        break

      case 2:
        messageSender(msg)
        break

      case 3:
        if (msg.id === webSockets[roomID].turnID) break
        if (msg.message == webSockets[roomID].ans) {
          msg.isTrue = true
          webSockets[roomID].scores[msg.id] += 50
          webSockets[roomID].scores[webSockets[roomID].turnID] += 25
          msg.scores = webSockets[roomID].scores
        } else {
          msg.isTrue = false
        }
        messageSender(msg)
        ws.send(JSON.stringify(msg))
        if (msg.isTrue) setTimeout(changeTurn, 1000)
        break

      case 5:
        messageSender(msg)
        break
    }
  })
})

server.listen(process.env.PORT, () => {
  //   console.log("http server started")
})
