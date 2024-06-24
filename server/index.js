const WebSocket = require("ws")
const express = require("express")
const app = express()
const path = require("path")
const cors = require("cors")
const http = require("http")
const crypto = require("crypto")
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

function getWord(){
   const randomIndex = Math.floor(Math.random() * wordsArray.length);
  return wordsArray[randomIndex];
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
// app.use("/", express.static(path.resolve(__dirname, "../src")))
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

const port = 9833
const server = http.createServer(express)
const wsServer = new WebSocket.Server({ server }) // a websocket server

server.on("request", app)

// const wss = new WebSocket.Server({ server })

wsServer.on("connection", function (ws, req) {
  // what should a websocket do on connection
  //extract roomID, and store client to that roomID

  /*
   websockets = {
      roomID1:{
         idPointer: ,
         turnID: ,
         date:,
         ans: ,
         users:[
            ws1,
            ws2,
         ],
      
      },
      roomID2:{...}
   }
*/

  var roomID = req.url.substring(1)
  console.log(roomID)

  const messageSender = (messageObj) => {
    const users = webSockets[roomID].users
    Object.keys(users).forEach(function each(userID) {
      if (users[userID] != ws) {
        if (users[userID].readyState === WebSocket.OPEN)
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
          })
        }
      }
    })
  }

  const removeClosedConnection = () => {
    const users = webSockets[roomID]?.users
    if (users!=null) {
      Object.keys(users).forEach(function each(userID) {
        if (users[userID]?.readyState !== WebSocket.OPEN) {
          var name = webSockets[roomID].names[userID]
          delete webSockets[roomID].users[userID]
          delete webSockets[roomID].names[userID]
          delete webSockets[roomID].scores[userID]
          webSockets[roomID].count -= 1
          messageSender({
            type: 7,
            name,
            id: userID,
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
    webSockets[roomID].turnID = ind
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
    //  ws.send(`Server received: ${message}`)
    console.log(roomID)
    const msg = JSON.parse(message)
    console.log("received: ", msg)
    removeClosedConnection()
    switch (msg.type) {
      case 0:
        if (!webSockets[roomID]) {
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
          console.log("here")
          if (webSockets[roomID].count == 2) {
            webSockets[roomID].turnID = Object.keys(
              webSockets[roomID].users
            )[0]
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
          })
        }
        console.log(webSockets[roomID].count)
        console.log(webSockets[roomID].names)
        break

      case 1:
        messageSender(message)
        break

      case 2:
        messageSender(message)
        break

      case 3:
        if (msg.message == webSockets[roomID].ans) {
          msg.isTrue = true
          webSockets[roomID].scores[msg.id] += 50;
          webSockets[roomID].scores[turnID] += 25;
          msg.scores = webSockets[roomID].scores;
        } else {
          msg.isTrue = false
        }
        messageSender(msg)
        ws.send(JSON.stringify(msg))
        setTimeout(changeTurn, 1000)
        break
    }
  })

  //   ws.on("message", (message)=> {
  //    // what to do on message event
  //    //  console.log('received from ' + userID + ': ' + message)

  //    const messageObj = JSON.parse(message)
  //    console.log("message", messageObj)
  //    const id = messageObj.name
  //    console.log(messageObj)
  //    //ID assigning
  //    if (messageObj.type === 0) {
  //      console.log(webSockets[messageObj.ser])
  //      if (webSockets[messageObj.ser].turnID === null) {
  //        webSockets[messageObj.ser].turnID = id
  //      }
  //      webSockets[messageObj.ser].users[id] = ws
  //      console.log(
  //        "Added" +
  //          id +
  //          "to" +
  //          messageObj.ser +
  //          "lr" +
  //          Object.getOwnPropertyNames(webSockets[messageObj.ser].users).length
  //      )
  //      if (ws.readyState === WebSocket.OPEN) {
  //        const msg = {
  //          type: 0,
  //          id,
  //          canvas: id === webSockets[messageObj.ser].turnID,
  //          turnID: webSockets[messageObj.ser].turnID,
  //        }
  //        if (msg.canvas) {
  //          msg.word = chooseRandomWord()
  //          webSockets[messageObj.ser].ans = msg.word
  //        }
  //        ws.send(JSON.stringify(msg))
  //      }
  //    }

  //    // draw
  //    else if (messageObj.type === 1) {
  //      if (messageObj.id === webSockets[messageObj.ser].turnID) {
  //        messageSender(messageObj, ws)
  //      }
  //    }
  //    //check answer
  //    else if (messageObj.type === 2) {
  //      const { text } = messageObj
  //      messageObj.isTrue = text === webSockets[messageObj.ser].ans
  //      messageSender(messageObj)
  //      console.log(typeof text, typeof webSockets[messageObj.ser].ans)
  //      //change player
  //      if (messageObj.isTrue) {
  //        const keys = Object.keys(webSockets[messageObj.ser].users)
  //        let currInd = keys.indexOf(webSockets[messageObj.ser].turnID)
  //        nextInd = currInd + 1 >= keys.length ? 0 : currInd + 1
  //        let x = nextInd
  //        do {
  //          if (
  //            webSockets[messageObj.ser].users[keys.at(x)].readyState !==
  //            WebSocket.OPEN
  //          ) {
  //            delete webSockets[messageObj.ser].users[keys.at(x)]
  //            x++
  //          }
  //        } while (x != nextInd)

  //        webSockets[messageObj.ser].turnID = keys.at(x)

  //        const users = webSockets[messageObj.ser].users
  //        const turnID = webSockets[messageObj.ser].turnID
  //        console.log(turnID)
  //        Object.keys(users).forEach(function each(userID) {
  //          if (users[userID]?.readyState === WebSocket.OPEN) {
  //            const msg = JSON.stringify({
  //              type: 4,
  //              turnID,
  //              canvas: userID === turnID,
  //            })
  //            if (msg.canvas) {
  //              msg.word = chooseRandomWord()
  //              webSockets[messageObj.ser].ans = msg.word
  //            }
  //            users[userID].send(msg)
  //          }
  //        })
  //      }
  //    }

  //    //chat
  //    else {
  //      messageSender(messageObj)
  //    }
  //  })
})

server.listen(port, () => {
  console.log("http server started")
})
