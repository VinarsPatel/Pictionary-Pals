import React from "react"
import Card from "./ui/Card"

const HowToPlay = () => {
  return (
    <Card className="flex w-full flex-col gap-2 p-6 text-slate-700">
      <h2 className="text-lg font-semibold text-slate-800">
        How to Play Pictionary Pals
      </h2>

      <h3 className="font-semibold text-slate-700">Step 1: Create a Private Room</h3>
      <p className="pl-2 text-sm text-slate-600">
        Pick your turn length, max players, and word pack, then share the
        generated link.
      </p>

      <h3 className="font-semibold text-slate-700">Step 2: Start the Game</h3>
      <ol className="pl-6 text-sm text-slate-600">
        <li>
          Once at least two players are in, the host (the first player to
          join) clicks Start Game.
        </li>
        <li>
          Guessers see the word as blanks — letters get revealed as the turn
          timer runs down, so keep guessing!
        </li>
      </ol>

      <h3 className="font-semibold text-slate-700">Step 3: Drawing and Guessing</h3>
      <ol className="list-decimal pl-6 text-sm text-slate-600">
        <li>
          Drawing: the chosen player sees a word and has to draw it on the
          canvas before time runs out.
        </li>
        <li>
          Guessing: everyone else sees the drawing live and types guesses in the
          chat box.
        </li>
        <li>
          Points are awarded based on the accuracy and speed of the guesses.
        </li>
      </ol>

      <h3 className="font-semibold text-slate-700">Step 4: Chat and Interact</h3>
      <ol className="list-decimal pl-6 text-sm text-slate-600">
        <li>
          Use the chat feature to interact with other players during the game.
        </li>
        <li>Discuss guesses, encourage the drawer, and enjoy the fun!</li>
      </ol>

      <h3 className="font-semibold text-slate-700">Game Tips:</h3>
      <ul className="list-disc pl-6 text-sm text-slate-600">
        <li>Be quick and precise with your guesses to earn more points.</li>
        <li>
          Use clear and simple drawings to help others guess the word
          accurately.
        </li>
        <li>Have fun and enjoy the competitive and interactive gameplay!</li>
      </ul>
    </Card>
  )
}

export default HowToPlay
