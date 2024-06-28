import React from "react"

const Scores = ({ scores, names, id, turnID }) => {
  if (scores == null) return
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(scores).map((key) => (
        <div
          key={key}
          className={`flex min-w-12 flex-col items-center rounded-md px-2 text-lg font-semibold  text-richblack-900  ${key == turnID ? "bg-yellow-50" : "bg-caribbeangreen-100 "}`}
        >
          <p>
            {names[key]} {key === id && "(You)"}
          </p>
          <p>{scores[key]}</p>
        </div>
      ))}
    </div>
  )
}

export default Scores
