import React, { useEffect, useRef, useState } from "react"
import Compact from "@uiw/react-color-compact"

// Trigger + popover wrapper around the raw Compact swatch panel — previously
// the panel was rendered permanently inline next to the toolbar, eating
// layout space even when the drawer wasn't touching color at all.
const ColorPickerButton = ({ color, onChange }) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Choose a custom stroke color"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
      >
        <span
          className="h-4 w-4 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
        More
      </button>
      {open && (
        <div className="absolute bottom-full right-0 z-30 mb-2">
          <Compact
            color={color}
            style={{
              boxShadow:
                "rgb(0 0 0 / 15%) 0px 0px 0px 1px, rgb(0 0 0 / 15%) 0px 8px 16px",
            }}
            onChange={(c) => onChange(c.hex)}
          />
        </div>
      )}
    </div>
  )
}

export default ColorPickerButton
