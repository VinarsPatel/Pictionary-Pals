import React from "react"
import { Link } from "react-router-dom"

const Navbar = () => {
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center border-b border-violet-100 bg-white/90 px-4 backdrop-blur sm:px-6">
      <Link to={"/"} className="flex items-center gap-2">
        <img src="/favicon.png" alt="" className="h-8 w-8 rounded-full" />
        <span className="text-lg font-semibold tracking-tight text-slate-800">
          Pictionary <span className="text-indigo-600">Pals</span>
        </span>
      </Link>
    </div>
  )
}

export default Navbar
