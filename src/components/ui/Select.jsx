import React from "react"

const Select = React.forwardRef(function Select({ className = "", ...props }, ref) {
  return (
    <select
      ref={ref}
      className={`rounded-md border border-slate-300 bg-white px-2 py-2 text-slate-800 outline-none transition-colors focus:border-indigo-500 ${className}`}
      {...props}
    />
  )
})

export default Select
