import React, { useState } from "react"

const HomePage = () => {
  const [roomId, setRoomId] = useState(null)
  const fetchRoomId = async () => {
    try {
      const BASE_URL = process.env.REACT_APP_SERVER_URL
      console.log(BASE_URL)
      const response = await fetch(`${BASE_URL}/getRoom`)
      console.log("RESPONSE_GET_ROOM_API", response)
      const data = await response.json()
      setRoomId(data.roomId)
    } catch (error) {
      console.log("ERROR_IN_GET_ROOM_API", error)
    }
  }
  return (
    <div>
      <h1>InkLink</h1>
      <div>
        <button onClick={fetchRoomId}>Create Room</button>
        {roomId && (
          <a
            href={`${process.env.REACT_APP_BASE_URL}/room/${roomId}`}
            target="_blank"
            rel="noreferrer"
          >
            {`${process.env.REACT_APP_BASE_URL}/room/${roomId}`}/
          </a>
        )}
      </div>
    </div>
  )
}

export default HomePage
