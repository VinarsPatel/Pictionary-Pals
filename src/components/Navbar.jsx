import React from "react"
import { Link } from "react-router-dom"

const Navbar = () => {
  return (
    <div className="flex  h-14 items-center justify-center bg-richblack-900 px-4 ">
      <Link to={"/home"} className="cursor-pointer">
        <p className="text-3xl font-bold leading-7 text-richblack-25">
          <span
            style={{
              background:
                "-webkit-linear-gradient(rgb(31, 162, 255),rgb(18, 216, 250),rgb(166, 255, 203))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Pictionary{" "}
          </span>

          <span
            style={{
              background: "-webkit-linear-gradient(#E65C00, #F9D423)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Pals
          </span>
        </p>
      </Link>
    </div>
  )
}

export default Navbar
