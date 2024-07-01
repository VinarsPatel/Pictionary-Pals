import React, { useState } from "react"
import toast from "react-hot-toast"
import { FaRegCopy } from "react-icons/fa"
const HomePage = () => {
  const [roomId, setRoomId] = useState(null)
  const [loading, setLoading] = useState(false)
  const fetchRoomId = async () => {
    const toastid = toast.loading
    setLoading(true)
    try {
      const BASE_URL = process.env.REACT_APP_SERVER_URL
      const response = await fetch(`${BASE_URL}/getRoom`)
      const data = await response.json()
      setRoomId(data.roomId)
    } catch (error) {
      console.log("ERROR_IN_GET_ROOM_API", error)
    }
    setLoading(false)
    toast.remove(toastid)
  }

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(`${process.env.REACT_APP_BASE_URL}/room/${roomId}`)
      .then(() => {
        toast.success("Link copied to clipboard!")
      })
      .catch((err) => {
        toast.error("Failed to copy: ", err)
      })
  }

  return (
    <div className="Justify-center flex min-h-[500px] flex-col items-center justify-center gap-4">
      <button
        onClick={fetchRoomId}
        disabled={loading}
        className=" w-fit cursor-pointer rounded-md bg-yellow-50 px-6 py-3 text-lg text-richblack-900 transition-all  duration-200 hover:scale-95"
      >
        Create Private Room
      </button>
      {roomId && (
        <div className="flex gap-2">
          <a
            href={`${process.env.REACT_APP_BASE_URL}room/${roomId}`}
            target="_blank"
            rel="noreferrer"
            className="hover:bg-purple-700 rounded-md bg-richblack-700 px-4 py-2 text-white"
          >
            {`${process.env.REACT_APP_BASE_URL}room/${roomId}`}/
          </a>
          <p
            onClick={copyToClipboard}
            className="flex cursor-pointer items-center  justify-end rounded-md bg-richblack-700 px-2 text-2xl text-white"
          >
            <FaRegCopy />
          </p>
        </div>
      )}
    </div>
  )
}

export default HomePage
