import React, { useEffect, useRef } from "react"

// Pastel backgrounds with a matching dark-saturated text color per tag —
// alternating shades (by message index) so consecutive same-tag messages
// stay visually distinct from one another.
const colorObj = {
  G: ["bg-emerald-100 text-emerald-800", "bg-emerald-200 text-emerald-800"],
  O: ["bg-orange-100 text-orange-800", "bg-orange-200 text-orange-800"],
  R: ["bg-red-100 text-red-800", "bg-red-200 text-red-800"],
  S: ["bg-blue-100 text-blue-800", "bg-blue-200 text-blue-800"],
  B: ["bg-slate-100 text-slate-700", "bg-slate-200 text-slate-700"],
  C: ["bg-amber-100 text-amber-800", "bg-amber-200 text-amber-800"],
}

const ChatBox = ({ msgArr }) => {
  const chatBox = useRef(null)

  useEffect(() => {
    const chatBoxCurrent = chatBox.current

    // Check if the user is near the bottom
    const isNearBottom =
      chatBoxCurrent.scrollHeight - chatBoxCurrent.scrollTop <=
      chatBoxCurrent.clientHeight + 200

    // Scroll to the bottom if the user is near the bottom
    if (isNearBottom) {
      chatBoxCurrent.scrollTop = chatBoxCurrent.scrollHeight
    }
  }, [msgArr])

  return (
    <div
      className="flex flex-1 flex-col gap-1 overflow-y-auto overscroll-contain pr-1"
      ref={chatBox}
    >
      {msgArr.length === 0 && (
        <p className="text-sm text-slate-500">No messages yet — say hi!</p>
      )}
      {msgArr.map((msg, ind) => {
        const isCorrectGuess = msg[0] === "G"
        return (
          <p
            className={`rounded-md px-2 py-1 text-sm ${colorObj[msg[0]][ind & 1]} ${isCorrectGuess ? "animate-bubble-in font-semibold" : ""}`}
            key={ind}
          >
            {msg.substring(2)}
          </p>
        )
      })}
    </div>
  )
}

export default ChatBox
