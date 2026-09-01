import { Route, Routes } from "react-router-dom"
import "./App.css"
import GameArena from "./components/GameArena"
import HomePage from "./components/HomePage"
import Navbar from "./components/Navbar"

function App() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden bg-violet-50 font-inter text-slate-800">
      <Navbar />
      <Routes>
        <Route path="/room/:roomID" element={<GameArena />}></Route>
        <Route path="/" element={<HomePage />}></Route>
      </Routes>
    </div>
  )
}

export default App
