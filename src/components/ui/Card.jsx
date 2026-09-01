import React from "react"

const Card = ({ className = "", ...props }) => (
  <div
    className={`rounded-xl border border-violet-100 bg-white p-4 shadow-sm ${className}`}
    {...props}
  />
)

export default Card
