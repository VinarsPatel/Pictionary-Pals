import React from "react"

const HowToPlay = () => {
  return (
    <div className="text-richblack-25 text-lg ">
      <h2 className="text-caribbeangreen-100 ">How to Play Pictionary Pals</h2>

      <h3 className="text-pink-100">Step 1: Create a Private Room</h3>
      {/* <ol>
        <li>Visit the Pictionary Pals website.</li>
        <li>Click on the <strong>"Create Room"</strong> button.</li>
        <li>A unique link will be generated for your private room.</li>
      </ol> */}

      <h3 className="text-pink-100">Step 2: Share the Room Link</h3>
      {/* <ol>
        <li>Copy the generated link.</li>
        <li>Share the link with your friends or family members you want to play with.</li>
        <li>Participants can join the game by clicking on the shared link.</li>
      </ol>
       */}
      <h3 className="text-pink-100">Step 3: Start the Game</h3>
       <ol className="pl-6">
        {/* <li>Once all players have joined, the game host can start the game by clicking the <strong>"Start Game"</strong> button.</li> */}
        <li>Game will start as soon as two players joins the room.</li>
      </ol>

      <h3 className="text-pink-100">Step 4: Drawing and Guessing</h3>
      <ol className="pl-6">
        <li>
         Drawing: The chosen player will see a word and has 60 seconds to draw
          it on the canvas.
        </li>
        <li>
          Guessing: Other players will see the drawing in real-time and have 60
          seconds to type their guesses in the chat box.
        </li>
        <li>
          Points are awarded based on the accuracy and speed of the guesses.
        </li>
      </ol>

      <h3 className="text-pink-100">Step 5: Chat and Interact</h3>
      <ol className="pl-6">
        <li>
          Use the chat feature to interact with other players during the game.
        </li>
        <li>Discuss guesses, encourage the drawer, and enjoy the fun!</li>
      </ol>
      <h3 className="text-pink-100">Game Tips:</h3>
      <ul className="pl-6">
        <li>Be quick and precise with your guesses to earn more points.</li>
        <li>
          Use clear and simple drawings to help others guess the word
          accurately.
        </li>
        <li>Have fun and enjoy the competitive and interactive gameplay!</li>
      </ul>
    </div>
  )
}

export default HowToPlay
