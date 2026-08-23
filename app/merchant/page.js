"use client";

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/lib/supabaseClient";

const origin = () => (typeof window !== "undefined" ? window.location.origin : "https://sirgaz.app");

export default function MerchantDashboardPage() {
  const [session,setSession]=React.useState(null);
  const [email,setEmail]=React.useState("");
  const [otp,setOtp]=React.useState("");
  const [otpSent,setOtpSent]=React.useState(false);
  const [venue,setVenue]=React.useState(null);
  const [events,setEvents]=React.useState([]);
  const [selected,setSelected]=React.useState(null);
  const [accessUrl,setAccessUrl]=React.useState("");
  const [loading,setLoading]=React.useState(true);
  const [saving,setSaving]=React.useState(false);
  const [error,setError]=React.useState("");
  const [venueName,setVenueName]=React.useState("");
  const [eventTitle,setEventTitle]=React.useState("");
  const [eventDescription,setEventDescription]=React.useState("");
  const [start,setStart]=React.useState("");

  const load=React.useCallback(async(userId)=>{
    setLoading(true);setError("");
    const {data:v,error:ve}=await supabase.from("venues").select("*").eq("owner_id",userId).maybeSingle();
    if(ve){setError(ve.message);setLoading(false);return;}
    setVenue(v);
    if(v){
      const {data:ev,error:ee}=await supabase.from("events").select("*").eq("venue_id",v.id).order("created_at",{ascending:false});
      if(ee)setError(ee.message); else {setEvents(ev||[]);setSelected(ev?.[0]||null);}
    }
    setLoading(false);
  },[]);

  React.useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{
      if(!mounted)return;
      setSession(data.session);
      if(data.session?.user)load(data.session.user.id);else setLoading(false);
    });
    const {data:sub}=supabase.auth.onAuthStateChange((_e,s)=>{
      setSession(s);
      if(s?.user)load(s.user.id);else setVenue(null);
    });
    return()=>{mounted=false;sub.subscription.unsubscribe();};
  },[load]);

  const sendOtp=async(e)=>{
    e.preventDefault();setError("");
    const {error:err}=await supabase.auth.signInWithOtp({email:email.trim(),options:{shouldCreateUser:true}});
    if(err)setError(err.message);else setOtpSent(true);
  };

  const verify=async(e)=>{
    e.preventDefault();setError("");
    const {data,error:err}=await supabase.auth.verifyOtp({email:email.trim(),token:otp.trim(),type:"email"});
    if(err)setError(err.message);else if(data.session){setSession(data.session);await load(data.session.user.id);}
  };

  const createVenue=async(e)=>{
    e.preventDefault();setSaving(true);setError("");
    const {data,error:err}=await supabase.rpc("create_venue_for_current_user",{p_name:venueName.trim(),p_category:"Night Club",p_address:"",p_description:""});
    if(err)setError(err.message);else setVenue(data);
    setSaving(false);
  };

  const createEvent=async(e)=>{
    e.preventDefault();if(!venue)return;setSaving(true);setError("");
    const {data,error:err}=await supabase.from("events").insert({venue_id:venue.id,title:eventTitle.trim(),description:eventDescription.trim(),starts_at:start?new Date(start).toISOString():null,status:"live"}).select().single();
    if(err)setError(err.message);else{setEvents(prev=>[data,...prev]);setSelected(data);setEventTitle("");setEventDescription("");setStart("");}
    setSaving(false);
  };

  const generateQr=async()=>{
    if(!selected)return;setSaving(true);setError("");
    const {data,error:err}=await supabase.rpc("create_venue_access_token",{p_event:selected.id,p_label:"Main Venue QR",p_expires_at:null});
    if(err)setError(err.message);else setAccessUrl(`${origin()}/e/${selected.id}?access=${encodeURIComponent(data)}`);
    setSaving(false);
  };

  if(loading)return <div className="min-h-screen bg-black text-white flex items-center justify-center">Loading sirgaZ Venue Portal…</div>;

  if(!session)return <div className="min-h-screen bg-black text-white flex items-center justify-center p-6"><div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7"><div className="text-xs uppercase tracking-[.25em] text-pink-400">sirgaZ Venue</div><h1 className="text-3xl font-semibold mt-2">Venue Control</h1><p className="text-white/50 text-sm mt-2">Login dengan email. Merchant anonymous session sudah dinonaktifkan.</p>{error&&<div className="mt-4 p-3 rounded-xl bg-red-500/10 text-red-300 text-xs">{error}</div>}{!otpSent?<form onSubmit={sendOtp} className="mt-6 space-y-3"><input value={email} onChange={e=>setEmail(e.target.value)} type="email" required placeholder="email@venue.com" className="w-full h-12 rounded-xl bg-white/10 border border-white/10 px-4 outline-none"/><button disabled={!email||saving} className="w-full h-12 rounded-xl bg-pink-600 font-semibold">Send OTP</button></form>:<form onSubmit={verify} className="mt-6 space-y-3"><input value={otp} onChange={e=>setOtp(e.target.value)} inputMode="numeric" required placeholder="6-digit OTP" className="w-full h-12 rounded-xl bg-white/10 border border-white/10 px-4 outline-none"/><button disabled={!otp||saving} className="w-full h-12 rounded-xl bg-pink-600 font-semibold">Verify & Enter</button></form>}</div></div>;

  if(!venue)return <div className="min-h-screen bg-black text-white flex items-center justify-center p-6"><form onSubmit={createVenue} className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-7"><div className="text-xs uppercase tracking-[.25em] text-pink-400">First setup</div><h1 className="text-3xl font-semibold mt-2">Create your venue</h1>{error&&<div className="mt-4 p-3 rounded-xl bg-red-500/10 text-red-300 text-xs">{error}</div>}<input value={venueName} onChange={e=>setVenueName(e.target.value)} required placeholder="Venue name" className="mt-6 w-full h-12 rounded-xl bg-white/10 border border-white/10 px-4 outline-none"/><button disabled={saving} className="mt-3 w-full h-12 rounded-xl bg-pink-600 font-semibold">Create Venue</button></form></div>;

  return <div className="min-h-screen bg-[#09090c] text-white p-6 md:p-10"><div className="max-w-6xl mx-auto"><div className="flex items-center justify-between border-b border-white/10 pb-6"><div><div className="text-xs uppercase tracking-[.25em] text-pink-400">Venue Admin</div><h1 className="text-2xl font-semibold mt-1">{venue.name}</h1></div><button onClick={()=>supabase.auth.signOut()} className="text-xs text-white/50">Sign out</button></div>{error&&<div className="mt-5 p-3 rounded-xl bg-red-500/10 text-red-300 text-sm">{error}</div>}<div className="grid lg:grid-cols-3 gap-6 mt-8"><form onSubmit={createEvent} className="rounded-3xl border border-white/10 bg-white/5 p-6 space-y-3"><h2 className="font-semibold">Create Event</h2><input value={eventTitle} onChange={e=>setEventTitle(e.target.value)} required placeholder="Event title" className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm"/><textarea value={eventDescription} onChange={e=>setEventDescription(e.target.value)} placeholder="Description" className="w-full rounded-xl bg-white/10 border border-white/10 px-3 py-3 text-sm"/><input type="datetime-local" value={start} onChange={e=>setStart(e.target.value)} className="w-full h-11 rounded-xl bg-white/10 border border-white/10 px-3 text-sm"/><button disabled={saving} className="w-full h-11 rounded-xl bg-pink-600 font-semibold">Publish Live Event</button></form><div className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Events</h2><div className="mt-4 space-y-2">{events.map(ev=><button key={ev.id} onClick={()=>{setSelected(ev);setAccessUrl("")}} className={`w-full text-left p-3 rounded-xl border ${selected?.id===ev.id?'border-pink-500 bg-pink-500/10':'border-white/10 bg-white/5'}`}><div className="text-sm font-medium">{ev.title}</div><div className="text-xs text-white/40 mt-1">{ev.status}</div></button>)}</div></div><div className="rounded-3xl border border-white/10 bg-white/5 p-6"><h2 className="font-semibold">Venue QR</h2>{selected?<><p className="text-xs text-white/40 mt-1">QR ini membawa access secret yang hanya disimpan sebagai hash di database.</p><button onClick={generateQr} disabled={saving} className="mt-5 w-full h-11 rounded-xl bg-purple-600 font-semibold">Generate Secure QR</button>{accessUrl&&<div className="mt-5 flex flex-col items-center"><div className="bg-white p-4 rounded-2xl"><QRCodeSVG value={accessUrl} size={180}/></div><div className="mt-3 text-[10px] text-white/40 break-all">{accessUrl}</div></div>}</>:<p className="text-sm text-white/40 mt-5">Select an event.</p>}</div></div></div></div>;
}
