import React, { useState } from "react"
import toast from "react-hot-toast"
import { FaRegCopy } from "react-icons/fa"
import { LuPlay } from "react-icons/lu"
import { useNavigate } from "react-router-dom"
import Button from "./ui/Button"
import Card from "./ui/Card"
import IconButton from "./ui/IconButton"
import Select from "./ui/Select"
import HowToPlay from "./HowToPlay"
import RecentGames from "./RecentGames"

const TURN_LENGTH_OPTIONS_MS = [30000, 60000, 90000, 120000]
const MAX_PLAYERS_OPTIONS = [2, 3, 4, 5, 6, 7, 8, 9, 10]
const WORD_PACK_OPTIONS = [
  { value: "default", label: "Default" },
  { value: "animals", label: "Animals" },
  { value: "food", label: "Food & Drink" },
  { value: "movies", label: "Movies & TV" },
]

const HomePage = () => {
  const navigate = useNavigate()
  const [roomId, setRoomId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [quickPlayLoading, setQuickPlayLoading] = useState(false)
  const [turnDurationMs, setTurnDurationMs] = useState(60000)
  const [maxPlayers, setMaxPlayers] = useState(8)
  const [wordPack, setWordPack] = useState("default")

  const quickPlay = async () => {
    setQuickPlayLoading(true)
    const toastId = toast.loading("Finding you a game...")
    try {
      const BASE_URL = process.env.REACT_APP_SERVER_URL
      const response = await fetch(`${BASE_URL}/quickplay`)
      const data = await response.json()
      if (data.success) {
        navigate(`/room/${data.roomId}`)
      } else {
        toast.error("Could not find a game. Please try again.")
      }
    } catch (error) {
      console.log("ERROR_IN_QUICKPLAY_API", error)
      toast.error("Could not reach the server. Please try again.")
    } finally {
      setQuickPlayLoading(false)
      toast.dismiss(toastId)
    }
  }

  const fetchRoomId = async () => {
    setLoading(true)
    const toastId = toast.loading("Creating your room...")
    try {
      const BASE_URL = process.env.REACT_APP_SERVER_URL
      const params = new URLSearchParams({
        turnDurationMs: String(turnDurationMs),
        maxPlayers: String(maxPlayers),
        wordPack,
      })
      const response = await fetch(`${BASE_URL}/getRoom?${params.toString()}`)
      const data = await response.json()
      if (data.success) {
        setRoomId(data.roomId)
      } else {
        toast.error("Could not create a room. Please try again.")
      }
    } catch (error) {
      console.log("ERROR_IN_GET_ROOM_API", error)
      toast.error("Could not reach the server. Please try again.")
    } finally {
      setLoading(false)
      toast.dismiss(toastId)
    }
  }

  const roomLink = roomId
    ? `${window.location.origin}/room/${roomId}`
    : null

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(roomLink)
      .then(() => toast.success("Link copied to clipboard!"))
      .catch(() => toast.error("Failed to copy the link."))
  }

  return (
    <div className="mx-auto flex min-h-[650px] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4 py-8">
      <img
        src="/logo.png"
        alt="Pictionary Pals"
        className="w-full max-w-md"
      />
      <Button
        onClick={quickPlay}
        disabled={quickPlayLoading}
        className="w-full py-4 text-xl"
      >
        <LuPlay className="h-5 w-5" />
        {quickPlayLoading ? "Finding a game..." : "Quick Play"}
      </Button>
      <p className="text-sm text-slate-600">
        Jump straight into an open game — no room link needed.
      </p>

      <div className="flex w-full items-center gap-3 text-slate-500">
        <div className="h-px flex-1 bg-violet-100" />
        <span className="text-xs uppercase tracking-wide">or customize a private room</span>
        <div className="h-px flex-1 bg-violet-100" />
      </div>

      <Card className="flex w-full flex-col gap-4 p-6">
        <h2 className="text-center text-lg font-semibold text-slate-800">
          Room Settings
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Turn length
            <Select
              value={turnDurationMs}
              onChange={(e) => setTurnDurationMs(Number(e.target.value))}
            >
              {TURN_LENGTH_OPTIONS_MS.map((ms) => (
                <option key={ms} value={ms}>
                  {ms / 1000}s
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Max players
            <Select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              {MAX_PLAYERS_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-slate-600">
            Word pack
            <Select
              value={wordPack}
              onChange={(e) => setWordPack(e.target.value)}
            >
              {WORD_PACK_OPTIONS.map((pack) => (
                <option key={pack.value} value={pack.value}>
                  {pack.label}
                </option>
              ))}
            </Select>
          </label>
        </div>
        <Button
          variant="secondary"
          onClick={fetchRoomId}
          disabled={loading}
          className="w-full py-3 text-lg"
        >
          {loading ? "Creating room..." : "Create Private Room"}
        </Button>
      </Card>

      {roomLink && (
        <div className="flex w-full items-stretch gap-2">
          <a
            href={roomLink}
            target="_blank"
            rel="noreferrer"
            className="flex-1 truncate rounded-md border border-slate-200 bg-white px-4 py-2 text-slate-800 transition-colors hover:bg-slate-50"
          >
            {roomLink}
          </a>
          <IconButton aria-label="Copy room link" onClick={copyToClipboard}>
            <FaRegCopy />
          </IconButton>
        </div>
      )}

      <RecentGames />
      <HowToPlay />
    </div>
  )
}

export default HomePage
