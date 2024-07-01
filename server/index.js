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

const messageSender = (messageObj, roomID, ws = null) => {
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
        messageSender(
          {
            type: 7,
            name,
            id: userID,
            names: webSockets[roomID].names,
            scores: webSockets[roomID].scores,
          },
          roomID
        )
      }
    }
  })
}

const removeClosedConnection = (roomID) => {
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
        messageSender(
          {
            type: 7,
            name,
            id: userID,
            names: webSockets[roomID].names,
            scores: webSockets[roomID].scores,
          },
          roomID
        )
      }
    })
  }
}

const changeTurn = (roomID, time) => {
  if (webSockets[roomID].time != time) {
    return
  }

  const keys = Object.keys(webSockets[roomID].users)
  if (keys.length <= 1) return
  let ind = keys.findIndex((x) => x == webSockets[roomID].turnID)
  if (ind == keys.length - 1) {
    ind = -1
  }
  webSockets[roomID].status = []
  webSockets[roomID].turnID = parseInt(keys[ind + 1])
  webSockets[roomID].ans = getWord()
  webSockets[roomID].time = new Date(Date.now())
  webSockets[roomID].users[keys[ind + 1]].send(
    JSON.stringify({
      type: 4,
      turnID: webSockets[roomID].turnID,
      word: webSockets[roomID].ans,
      time: webSockets[roomID].time,
      message:`S ${webSockets[roomID].names[keys[ind + 1]]} is drawing now.`
    })
  )
  messageSender(
    {
      type: 4,
      turnID: webSockets[roomID].turnID,
      time: webSockets[roomID].time,
      message:`S ${webSockets[roomID].names[keys[ind + 1]]} is drawing now.`
    },
    roomID,
    webSockets[roomID].users[keys[ind + 1]]
  )
  setTimeout(
    (function (roomID, time) {
      return function () {
        changeTurn(roomID, time)
      }
    })(roomID, webSockets[roomID].time),
    60000
  )
  //   setTimeout(() => changeTurn(roomID, webSockets[roomID].time), 60000)
}

wsServer.on("connection", function (ws, req) {
  var roomID = req.url.substring(1)

  ws.on("message", (message) => {
    // Echo the message back to the client
    const msg = JSON.parse(message)
    removeClosedConnection(roomID)
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
            status: [],
            time: null,
          }
          ws.send(
            JSON.stringify({
              type: 0,
              id: 1,
              turnID: webSockets[roomID].turnID,
              names: webSockets[roomID].names,
              scores: webSockets[roomID].scores,
              time: webSockets[roomID].time,
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
            webSockets[roomID].time = new Date(Date.now())
            messageSender(
              {
                type: 4,
                turnID: webSockets[roomID].turnID,
                word: webSockets[roomID].ans,
                time: webSockets[roomID].time,
               message:`S ${webSockets[roomID].names[webSockets[roomID].turnID]} is drawing now.`

              },
              roomID,
              ws
            )
            setTimeout(
              (function (roomID, time) {
                return function () {
                  changeTurn(roomID, time)
                }
              })(roomID, webSockets[roomID].time),
              60000
            )
          }

          ws.send(
            JSON.stringify({
              type: 0,
              id: ind,
              turnID: webSockets[roomID].turnID,
              names: webSockets[roomID].names,
              scores: webSockets[roomID].scores,
              time: webSockets[roomID].time,
            })
          )
          messageSender(
            {
              type: 6,
              name: msg.name,
              id: ind,
              names: webSockets[roomID].names,
              scores: webSockets[roomID].scores,
            },
            roomID,
            ws
          )
        }
        break

      case 1:
        messageSender(msg, roomID, ws)
        break

      case 2:
        messageSender(msg, roomID, ws)
        break

      case 3:
        if (msg.id === webSockets[roomID].turnID) break
        if (msg.message.toLowerCase() == webSockets[roomID].ans) {
          if (webSockets[roomID].status.includes(msg.id)) return
          msg.isTrue = true

          const diff = Date.now() - webSockets[roomID].time
          if (diff > 60000) return
          webSockets[roomID].scores[msg.id] += Math.floor(100 - diff / 600)
          webSockets[roomID].scores[webSockets[roomID].turnID] += Math.floor(
            50 - diff / 1200
          )

          webSockets[roomID].status.push(msg.id)
          msg.scores = webSockets[roomID].scores
          msg.message = `G ${webSockets[roomID].names[msg.id]} guessed the word!👏👏`
          messageSender(msg, roomID, ws)
          ws.send(JSON.stringify(msg))
          if (
            webSockets[roomID].status.length ===
            Object.keys(webSockets[roomID].users).length - 1
          ) {
            changeTurn(roomID, webSockets[roomID].time)
          }
        } else {
          msg.isTrue = false
          msg.message = `B ${webSockets[roomID].names[msg.id]} : ${msg.message}`
          messageSender(msg, roomID, ws)
          ws.send(JSON.stringify(msg))
        }
        break

      case 5:
        messageSender(msg, roomID, ws)
        break
    }
  })
})

server.listen(process.env.PORT || 4000, () => {
  //   console.log("http server started")
})
