import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "leaflet/dist/leaflet.css";
import App from "./App.jsx";

if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("/Bri-Locations/sw.js",{scope:"/Bri-Locations/"}).catch(()=>{}))}
createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>);
