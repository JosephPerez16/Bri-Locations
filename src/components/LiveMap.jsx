import { MapContainer,Marker,Popup,Polyline,TileLayer,useMap } from "react-leaflet";
import { useEffect,useMemo,useRef,useState } from "react";
import L from "leaflet";

function participantIcon(isMe,name){
 const initial=(name||"?").trim().charAt(0).toUpperCase();
 return L.divIcon({
  className:"participant-marker-wrap",
  html:`<div class="participant-marker ${isMe?"participant-marker-me":"participant-marker-other"}"><span>${initial}</span></div>`,
  iconSize:[42,42],iconAnchor:[21,21],popupAnchor:[0,-23]
 });
}

function PersonMarker({person,myDevice}){
 const isMe=person.device_id===myDevice;
 const markerIcon=useMemo(()=>participantIcon(isMe,person.name),[isMe,person.name]);
 return <Marker position={[person.latitude,person.longitude]} icon={markerIcon}>
  <Popup><strong>{person.name}</strong><br/>{isMe?"Este dispositivo":"Participante"}<br/>Precisión ±{Math.round(person.accuracy||0)} m</Popup>
 </Marker>;
}

function MapControls({people}){
 const map=useMap();
 const firstFit=useRef(false);
 const fit=()=>{
  const pts=people.map(p=>[p.latitude,p.longitude]);
  if(!pts.length)return;
  if(pts.length===1)map.setView(pts[0],17,{animate:true});
  else map.fitBounds(pts,{padding:[70,70],maxZoom:17,animate:true});
 };
 useEffect(()=>{
  if(firstFit.current||!people.length)return;
  firstFit.current=true;
  fit();
 },[people]);
 return <button type="button" className="map-center-button" onClick={fit} aria-label="Centrar ubicaciones">⌖ <span>Centrar</span></button>;
}

function RouteLine({people,myDevice,travelMode,onRouteInfo}){
 const [positions,setPositions]=useState([]);
 const requestKey=useRef("");
 const me=people.find(p=>p.device_id===myDevice);
 const other=people.find(p=>p.device_id!==myDevice);

 useEffect(()=>{
  if(!me||!other){setPositions([]);onRouteInfo?.(null);return;}
  const direct=[[me.latitude,me.longitude],[other.latitude,other.longitude]];
  const key=[travelMode,me.latitude.toFixed(4),me.longitude.toFixed(4),other.latitude.toFixed(4),other.longitude.toFixed(4)].join("|");
  if(requestKey.current===key)return;
  requestKey.current=key;
  const controller=new AbortController();
  const base=travelMode==="walking"?"https://routing.openstreetmap.de/routed-foot/route/v1/driving":"https://router.project-osrm.org/route/v1/driving";
  const coords=`${me.longitude},${me.latitude};${other.longitude},${other.latitude}`;
  fetch(`${base}/${coords}?overview=full&geometries=geojson&steps=false`,{signal:controller.signal})
   .then(r=>{if(!r.ok)throw new Error("route");return r.json()})
   .then(data=>{
    const route=data?.routes?.[0];
    if(!route)throw new Error("route");
    setPositions(route.geometry.coordinates.map(([lng,lat])=>[lat,lng]));
    onRouteInfo?.({distance:route.distance,duration:route.duration,estimated:false});
   })
   .catch(e=>{
    if(e.name==="AbortError")return;
    setPositions(direct);
    const meters=directDistance(me,other)*1000;
    const speed=travelMode==="walking"?1.35:8.33;
    onRouteInfo?.({distance:meters,duration:meters/speed,estimated:true});
   });
  return()=>controller.abort();
 },[me?.latitude,me?.longitude,other?.latitude,other?.longitude,travelMode,myDevice]);

 if(positions.length<2)return null;
 return <Polyline positions={positions} pathOptions={{weight:5,opacity:.8,dashArray:travelMode==="walking"?"8 10":undefined}}/>;
}

function directDistance(a,b){
 const r=6371,toRad=x=>x*Math.PI/180;
 const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);
 const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
 return 2*r*Math.asin(Math.sqrt(x));
}

export default function LiveMap({people,myDevice,travelMode,onRouteInfo}){
 const valid=people.filter(p=>p.latitude!=null&&p.longitude!=null);
 const center=valid[0]?[valid[0].latitude,valid[0].longitude]:[18.4861,-69.9312];
 return <div className="map-shell">
  <MapContainer center={center} zoom={16} className="map" zoomControl={true} scrollWheelZoom={true} dragging={true} touchZoom={true} doubleClickZoom={true}>
   <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
   <RouteLine people={valid} myDevice={myDevice} travelMode={travelMode} onRouteInfo={onRouteInfo}/>
   {valid.map(p=><PersonMarker key={p.id} person={p} myDevice={myDevice}/>)}
   <MapControls people={valid}/>
  </MapContainer>
 </div>;
}
