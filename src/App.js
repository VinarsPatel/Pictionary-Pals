import { Route, Routes } from "react-router-dom"
import "./App.css"
import GameArena from "./components/GameArena"
import HomePage from "./components/HomePage"
import Navbar from "./components/Navbar"

function App() {
  return (
    <div className="min-h-screen min-w-[1200px] bg-richblack-800 font-inter transition-all  duration-200">
      <Navbar />
      <Routes>
        <Route path="/room/:roomID" element={<GameArena />}></Route>
        <Route path="/home" element={<HomePage />}></Route>
      </Routes>
    </div>
  )
}

export default App
