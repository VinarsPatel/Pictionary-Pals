import React from "react"

const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"

// Square icon-only action (e.g. copy-link) — distinct from the segmented
// pen/eraser toggle in GameArena, which needs label text alongside the icon.
const IconButton = React.forwardRef(function IconButton(
  { className = "", type = "button", ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white p-2.5 text-lg text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING} ${className}`}
      {...props}
    />
  )
})

export default IconButton
