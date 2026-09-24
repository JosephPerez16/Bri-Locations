import { useEffect,useMemo,useRef,useState } from "react";
import LiveMap from "./components/LiveMap";
import useGeolocation from "./hooks/useGeolocation";
import { supabase } from "./services/supabase";
import {createSession,deviceId,endSession,findSession,getParticipants,upsertParticipant} from "./services/sessionService";
import "./styles/app.css";

const distanceKm=(a,b)=>{
 if(!a||!b)return null;
 const r=6371,toRad=x=>x*Math.PI/180;
 const dLat=toRad(b.latitude-a.latitude),dLon=toRad(b.longitude-a.longitude);
 const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.latitude))*Math.cos(toRad(b.latitude))*Math.sin(dLon/2)**2;
 return 2*r*Math.asin(Math.sqrt(x));
};

function formatDuration(seconds){
 if(!Number.isFinite(seconds))return "Calculando...";
 const mins=Math.max(1,Math.round(seconds/60));
 if(mins<60)return `${mins} min`;
 const h=Math.floor(mins/60),m=mins%60;
 return m?`${h} h ${m} min`:`${h} h`;
}

export default function App(){
 const params=new URLSearchParams(location.search);
 const initialCode=params.get("session")||"";
 const [screen,setScreen]=useState(initialCode?"join":"home");
 const [code,setCode]=useState(initialCode.toUpperCase());
 const [name,setName]=useState("");
 const [session,setSession]=useState(null);
 const [people,setPeople]=useState([]);
 const [host,setHost]=useState(false);
 const [message,setMessage]=useState("");
 const [copied,setCopied]=useState(false);
 const [splash,setSplash]=useState(true);
 const [movement,setMovement]=useState({status:"waiting",delta:0});
 const [travelMode,setTravelMode]=useState(()=>localStorage.getItem("bri_travel_mode")||"driving");
 const [routeInfo,setRouteInfo]=useState(null);
 const [panelCollapsed,setPanelCollapsed]=useState(false);
 const autoCollapsed=useRef(false);
 const lastSync=useRef(0);
 const lastDistance=useRef(null);
 const {location:geo,error:geoError}=useGeolocation(!!session);
 const myId=deviceId();

 useEffect(()=>{const t=setTimeout(()=>setSplash(false),1800);return()=>clearTimeout(t)},[]);

 async function start(){
  if(!name.trim())return setMessage("Escribe tu nombre.");
  try{
   setMessage("Creando sesión...");
   const s=await createSession();
   setSession(s);setCode(s.code);setHost(true);setMessage("");
   history.replaceState({}, "", `?session=${s.code}`);
  }catch(e){setMessage(e.message)}
 }
 async function join(){
  if(!name.trim())return setMessage("Escribe tu nombre.");
  if(code.trim().length!==6)return setMessage("Escribe el código de 6 caracteres.");
  try{
   setMessage("Buscando sesión...");
   const s=await findSession(code.trim());
   if(!s)return setMessage("La sesión no existe o ya expiró.");
   setSession(s);setHost(false);setMessage("");
   history.replaceState({}, "", `?session=${s.code}`);
  }catch(e){setMessage(e.message)}
 }
 useEffect(()=>{
  if(!session)return;
  const load=()=>getParticipants(session.id).then(setPeople).catch(()=>{});
  load();
  const participantsChannel=supabase.channel(`participants-${session.id}`)
   .on("postgres_changes",{event:"*",schema:"public",table:"live_participants",filter:`session_id=eq.${session.id}`},load)
   .subscribe();
  const sessionChannel=supabase.channel(`session-${session.id}`)
   .on("postgres_changes",{event:"UPDATE",schema:"public",table:"live_sessions",filter:`id=eq.${session.id}`},payload=>{
    if(payload.new?.status==="ended"){
     setSession(null);setPeople([]);setHost(false);setCode("");setScreen("home");
     history.replaceState({},"",location.pathname);
     setMessage("La sesión fue finalizada.");
    }
   }).subscribe();
  return()=>{supabase.removeChannel(participantsChannel);supabase.removeChannel(sessionChannel)};
 },[session]);
 useEffect(()=>{
  if(!session||!geo||!name.trim())return;
  const now=Date.now();
  if(now-lastSync.current<2000)return;
  lastSync.current=now;
  let cancelled=false;
  const syncLocation=async()=>{
   try{
    await upsertParticipant(session.id,name.trim(),geo);
    const current=await getParticipants(session.id);
    if(!cancelled){setPeople(current);setMessage("")}
   }catch(e){if(!cancelled)setMessage(e.message||"No se pudo sincronizar tu ubicación.")}
  };
  syncLocation();
  return()=>{cancelled=true};
 },[session,geo,name]);
 const other=useMemo(()=>people.find(p=>p.device_id!==myId),[people,myId]);
 const me=useMemo(()=>people.find(p=>p.device_id===myId),[people,myId]);
 const km=distanceKm(me,other);

 useEffect(()=>{
  if(other&&!autoCollapsed.current){
   autoCollapsed.current=true;
   setPanelCollapsed(true);
  }
  if(!other)autoCollapsed.current=false;
 },[other]);

 useEffect(()=>{
  if(km==null){
   lastDistance.current=null;
   setMovement({status:"waiting",delta:0});
   return;
  }
  const meters=km*1000;
  if(lastDistance.current==null){
   lastDistance.current=meters;
   setMovement({status:"stable",delta:0});
   return;
  }
  const change=meters-lastDistance.current;
  const gpsNoise=Math.max(Number(me?.accuracy)||0,Number(other?.accuracy)||0);
  const threshold=Math.max(5,Math.min(20,gpsNoise*.15));
  if(Math.abs(change)<threshold){
   setMovement({status:"stable",delta:Math.abs(change)});
   return;
  }
  setMovement({status:change<0?"closer":"farther",delta:Math.abs(change)});
  lastDistance.current=meters;
 },[km,me?.accuracy,other?.accuracy]);

 const movementText=movement.status==="closer"?`Acercándote · ${Math.round(movement.delta)} m`:movement.status==="farther"?`Alejándote · ${Math.round(movement.delta)} m`:movement.status==="stable"?"Distancia estable":"Esperando movimiento";
 const movementIcon=movement.status==="closer"?"↘":movement.status==="farther"?"↗":"≈";
 useEffect(()=>{localStorage.setItem("bri_travel_mode",travelMode)},[travelMode]);
 const etaText=routeInfo?formatDuration(routeInfo.duration):"Calculando...";
 const routeDistance=routeInfo?routeInfo.distance/1000:null;
 const share=session?`${location.origin}${location.pathname}?session=${session.code}`:"";

 async function copyShare(){
  try{await navigator.clipboard.writeText(share);setCopied(true);setTimeout(()=>setCopied(false),1800)}
  catch{setMessage("No se pudo copiar el enlace.")}
 }
 async function stop(){
  try{if(host&&session)await endSession(session.id)}catch{}
  history.replaceState({},"",location.pathname);
  setSession(null);setPeople([]);setHost(false);setCode("");setScreen("home");
 }

 if(splash)return <main className="splash-screen"><div className="splash-rings"><div className="splash-pin">B</div></div><h1>Bri-Locations</h1><p>Juntos, estés donde estés.</p></main>;

 if(!session)return <main className="landing">
  <div className="brand"><span className="brand-pin">B</span><b>Bri-Locations</b></div>
  <section className="panel">
   <span className="eyebrow">UBICACIÓN COMPARTIDA</span>
   <h1>Encuéntrense en tiempo real</h1>
   <p>Crea una sesión privada temporal o entra con un código para ver ambas ubicaciones.</p>
   <input value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre" maxLength="30" autoComplete="name"/>
   {screen==="join"&&<input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Código de 6 caracteres" maxLength="6" autoCapitalize="characters"/>}
   {screen==="home"?<>
    <button onClick={start}>Crear sesión</button>
    <button className="secondary" onClick={()=>setScreen("join")}>Unirme con código</button>
   </>:<>
    <button onClick={join}>Entrar a la sesión</button>
    <button className="secondary" onClick={()=>{setScreen("home");setMessage("")}}>Volver</button>
   </>}
   {message&&<div className="message">{message}</div>}
  </section>
  <small className="privacy-note">La ubicación solo se comparte mientras la sesión está activa.</small>
 </main>;

 return <main className="app">
  <header className="topbar">
   <div><span className="pulse"></span><b>Bri-Locations · {session.code}</b></div>
   <span>{Math.min(people.length,2)}/2</span>
  </header>
  <LiveMap people={people} myDevice={myId} travelMode={travelMode} onRouteInfo={setRouteInfo}/>
  {panelCollapsed?<section className="bottom bottom-collapsed">
   <div className="compact-trip">
    <div className="compact-main"><small>{travelMode==="walking"?"🚶 A pie":"🚗 Vehículo"}</small><b>{other?etaText:"Esperando..."}</b></div>
    <div className="compact-distance"><small>Distancia</small><b>{routeDistance==null?(km==null?"--":km<1?`${Math.round(km*1000)} m`:`${km.toFixed(2)} km`):routeDistance<1?`${Math.round(routeDistance*1000)} m`:`${routeDistance.toFixed(2)} km`}</b></div>
    <button type="button" className="panel-toggle panel-toggle-show" onClick={()=>setPanelCollapsed(false)} aria-label="Mostrar panel">⌃ <span>Mostrar</span></button>
   </div>
  </section>:<section className="bottom">
   <button type="button" className="panel-toggle panel-toggle-hide" onClick={()=>setPanelCollapsed(true)} aria-label="Ocultar panel">⌄ <span>Ocultar panel</span></button>
   <div className="trip-row">
    <div className="mode-switch" role="group" aria-label="Modo de desplazamiento">
     <button className={travelMode==="walking"?"active":""} onClick={()=>setTravelMode("walking")}>🚶 A pie</button>
     <button className={travelMode==="driving"?"active":""} onClick={()=>setTravelMode("driving")}>🚗 Vehículo</button>
    </div>
    <div className="eta"><small>Tiempo estimado</small><b>{other?etaText:"Esperando..."}</b></div>
   </div>
   <div className="stats">
    <div><small>Distancia por ruta</small><b>{routeDistance==null?(km==null?"Esperando...":km<1?`${Math.round(km*1000)} m`:`${km.toFixed(2)} km`):routeDistance<1?`${Math.round(routeDistance*1000)} m`:`${routeDistance.toFixed(2)} km`}</b></div>
    <div><small>GPS</small><b>{geo?`±${Math.round(geo.accuracy)} m`:"Buscando..."}</b></div>
   </div>
   {other&&<>
    <div className={`movement movement-${movement.status}`}><span className="movement-icon">{movementIcon}</span><div><small>Movimiento</small><b>{movementText}</b></div></div>
    <div className="connected-with"><span></span>Conectado con <b>{other.name}</b></div>
   </>}
   {geoError&&<p className="error">{geoError}</p>}
   {message&&<p className="error">{message}</p>}
   <div className="actions">
    <button onClick={copyShare}>{copied?"¡Enlace copiado!":"Copiar enlace"}</button>
    <button className="danger" onClick={stop}>{host?"Finalizar":"Salir"}</button>
   </div>
  </section>}
 </main>;
}
