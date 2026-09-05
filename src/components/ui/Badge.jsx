import React from "react"

const VARIANTS = {
  neutral: "bg-slate-100 text-slate-600",
  accent: "bg-indigo-600 text-white",
}

const Badge = ({ variant = "neutral", className = "", ...props }) => (
  <span
    className={`rounded-full px-3 py-1 text-xs font-semibold ${VARIANTS[variant]} ${className}`}
    {...props}
  />
)

export default Badge
