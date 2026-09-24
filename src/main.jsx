import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";

if("serviceWorker" in navigator){window.addEventListener("load",()=>{const base=import.meta.env.BASE_URL;navigator.serviceWorker.register(`${base}sw.js`,{scope:base}).catch(()=>{})})}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
