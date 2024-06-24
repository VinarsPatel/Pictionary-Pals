import { Route, Routes } from "react-router-dom"
import "./App.css"
import GameArena from "./components/GameArena"
import HomePage from "./components/HomePage"

function App() {
  return (
    <div className="font-inter flex min-h-screen w-screen flex-col">
    <div className="h-12 bg-black"/>
      <Routes>
         <Route path="/room/:roomID" element={<GameArena/>}></Route>
         <Route path="/home" element={<HomePage/>}></Route>
      </Routes>
    </div>
  )
}

export default App
