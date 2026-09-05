import React from "react"

const Input = React.forwardRef(function Input({ className = "", ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`rounded-md border-2 border-slate-300 bg-white px-3 py-2 text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-500 ${className}`}
      {...props}
    />
  )
})

export default Input
