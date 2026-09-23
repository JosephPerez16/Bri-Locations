import { useEffect,useState } from "react";
export default function useGeolocation(active=true){
 const [location,setLocation]=useState(null);
 const [error,setError]=useState("");
 useEffect(()=>{
  if(!active||!navigator.geolocation)return;
  const id=navigator.geolocation.watchPosition(p=>{
   setLocation({
    latitude:p.coords.latitude,longitude:p.coords.longitude,
    accuracy:p.coords.accuracy,speed:p.coords.speed,heading:p.coords.heading
   }); setError("");
  },e=>setError(e.code===1?"Debes permitir el acceso a tu ubicación.":"No pudimos obtener tu ubicación."),
  {enableHighAccuracy:true,timeout:15000,maximumAge:3000});
  return()=>navigator.geolocation.clearWatch(id);
 },[active]);
 return {location,error};
}
