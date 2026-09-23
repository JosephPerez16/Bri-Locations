import { supabase } from "./supabase";

export function deviceId(){
 let id=localStorage.getItem("live_device_id");
 if(!id){ id=crypto.randomUUID(); localStorage.setItem("live_device_id",id); }
 return id;
}
export function makeCode(){
 const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
 return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join("");
}
export async function createSession(){
 for(let i=0;i<5;i++){
  const code=makeCode();
  const {data,error}=await supabase.from("live_sessions").insert({code}).select().single();
  if(!error)return data;
  if(error.code!=="23505")throw error;
 }
 throw new Error("No se pudo generar un código único.");
}
export async function findSession(code){
 const {data,error}=await supabase.from("live_sessions")
  .select("*").eq("code",code.toUpperCase()).eq("status","active").gt("expires_at",new Date().toISOString()).maybeSingle();
 if(error)throw error;
 return data;
}
export async function upsertParticipant(sessionId,name,loc){
 const payload={
  session_id:sessionId,device_id:deviceId(),name,
  latitude:loc.latitude,longitude:loc.longitude,accuracy:loc.accuracy,
  speed:loc.speed,heading:loc.heading,last_seen:new Date().toISOString()
 };
 const {data,error}=await supabase.from("live_participants")
  .upsert(payload,{onConflict:"session_id,device_id"}).select().single();
 if(error)throw error;
 return data;
}
export async function getParticipants(sessionId){
 const {data,error}=await supabase.from("live_participants").select("*").eq("session_id",sessionId);
 if(error)throw error;
 return data||[];
}
export async function endSession(id){
 const {error}=await supabase.from("live_sessions").update({status:"ended"}).eq("id",id);
 if(error)throw error;
}
