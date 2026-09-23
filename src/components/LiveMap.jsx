import { MapContainer,Marker,Popup,TileLayer,useMap } from "react-leaflet";
import { useEffect,useMemo } from "react";
import L from "leaflet";

function participantIcon(isMe,name){
 const initial=(name||"?").trim().charAt(0).toUpperCase();
 return L.divIcon({
  className:"participant-marker-wrap",
  html:`<div class="participant-marker ${isMe?"participant-marker-me":"participant-marker-other"}"><span>${initial}</span></div>`,
  iconSize:[42,42],iconAnchor:[21,21],popupAnchor:[0,-23]
 });
}

function Fit({people}){
 const map=useMap();
 useEffect(()=>{
  const pts=people.filter(p=>p.latitude!=null&&p.longitude!=null).map(p=>[p.latitude,p.longitude]);
  if(pts.length===1) map.setView(pts[0],17);
  if(pts.length>1) map.fitBounds(pts,{padding:[70,70],maxZoom:17});
 },[people,map]);
 return null;
}

function PersonMarker({person,myDevice}){
 const isMe=person.device_id===myDevice;
 const markerIcon=useMemo(()=>participantIcon(isMe,person.name),[isMe,person.name]);
 return <Marker position={[person.latitude,person.longitude]} icon={markerIcon}>
  <Popup><strong>{person.name}</strong><br/>{isMe?"Este dispositivo":"Participante"}<br/>Precisión ±{Math.round(person.accuracy||0)} m</Popup>
 </Marker>;
}

export default function LiveMap({people,myDevice}){
 const valid=people.filter(p=>p.latitude!=null&&p.longitude!=null);
 const center=valid[0]?[valid[0].latitude,valid[0].longitude]:[18.4861,-69.9312];
 return <MapContainer center={center} zoom={16} className="map">
  <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
  {valid.map(p=><PersonMarker key={p.id} person={p} myDevice={myDevice}/>)}
  <Fit people={valid}/>
 </MapContainer>;
}
