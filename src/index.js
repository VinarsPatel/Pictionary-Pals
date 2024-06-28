import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"
import { BrowserRouter } from "react-router-dom"
import { Toaster } from "react-hot-toast"

const root = ReactDOM.createRoot(document.getElementById("root"))
root.render(
  //   <React.StrictMode>
  <BrowserRouter>
    <App />
    <Toaster
      position="bottom-center"
      autoClose={500}
      hideProgressBar
      newestOnTop={false}
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="colored"
    />
  </BrowserRouter>
  //   </React.StrictMode>
)
