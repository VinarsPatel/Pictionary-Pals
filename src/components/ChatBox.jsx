import React, { useEffect, useRef } from 'react';

const colorObj = {
   G: ["#00f000", "#008000"],
   O: ["#ffa500", "#ff5f1f"],
   R: ["#ff0000", "#800000"],
   S: ["#00c8ff", "#0082ff"],
   B: ["#b0b0b0", "#a0a0a0"],
 }
 
const ChatBox = ({ msgArr, names }) => {
  const chatBox = useRef(null);

  useEffect(() => {
    const chatBoxCurrent = chatBox.current;

    // Check if the user is near the bottom
    const isNearBottom = chatBoxCurrent.scrollHeight - chatBoxCurrent.scrollTop <= chatBoxCurrent.clientHeight +200;

    // Scroll to the bottom if the user is near the bottom
    if (isNearBottom) {
      chatBoxCurrent.scrollTop = chatBoxCurrent.scrollHeight;
    }
  }, [msgArr]);

  return (
    <div className="overflow-y-scroll h-fit" ref={chatBox}>
      {msgArr.map((msg, ind) => {
        return (
          <p
            style={{ backgroundColor: colorObj[msg[0]][ind & 1] }}
            className="rounded-md px-2 py-[2px] text-lg"
            key={ind}
          >
            {msg.substring(2)}
          </p>
        );
      })}
    </div>
  );
};

export default ChatBox;
