"use client";

import { supabase } from "./supabaseClient";
import { computeVibeMatch } from "@/lib/vibe";

export const HEVN_DEFAULTS={name:"Hevn Station",category:"Night Club",description:"New Light Hevn 4.0",instagram:"@thehevn",address:"",logo_url:""};
// Server RPC errors are raised as UPPER_SNAKE codes (e.g. REROLL_QUOTA_EXHAUSTED); expose them as `code`.
const errorCode=msg=>{const m=String(msg||"").match(/[A-Z][A-Z0-9_]{3,}/);return m?m[0]:null;};
const rpc=async(name,args)=>{if(!supabase)return{data:null,error:"no client",code:"NO_CLIENT"};const{data,error}=await supabase.rpc(name,args);return{data,error:error?.message||null,code:error?errorCode(error.message):null};};
export const upsertProfile=async(userId,patch)=>{if(!supabase)return{error:"no client"};const safe={...patch};delete safe.xp;delete safe.id;const{data,error}=await supabase.from("profiles").upsert({id:userId,...safe}).select().single();return{data,error:error?.message};};
export const getProfile=async userId=>{if(!supabase||!userId)return null;const{data}=await supabase.from("profiles").select("*").eq("id",userId).maybeSingle();return data;};
export const getMyVenue=async userId=>{if(!supabase)return null;const{data}=await supabase.from("venues").select("*").eq("owner_id",userId).maybeSingle();return data;};
export const createVenue=async(userId,patch)=>{if(!supabase)return{error:"no client"};if(userId){const{data,error}=await supabase.rpc("create_venue_for_current_user",{p_name:patch.name,p_category:patch.category,p_address:patch.address||"",p_description:patch.description||""});return{data,error:error?.message};}return{error:"not authenticated"};};
export const updateVenue=async(venueId,patch)=>{if(!supabase)return{error:"no client"};const{data,error}=await supabase.from("venues").update(patch).eq("id",venueId).select().single();return{data,error:error?.message};};
export const isVenueConfigured=v=>!!v&&!!v.name&&!['','my venue'].includes(String(v.name).trim().toLowerCase());
export const ensureVenue=async(userId,defaults=HEVN_DEFAULTS)=>{const v=await getMyVenue(userId);if(v)return v;return(await createVenue(userId,defaults)).data;};
export const listEvents=async venueId=>{if(!supabase)return[];const{data}=await supabase.from("events").select("*").eq("venue_id",venueId).order("created_at",{ascending:false});return data||[];};
export const listPublishedEvents=async()=>{if(!supabase)return[];const{data}=await supabase.from("events").select("*").in("status",['published','live']);return data||[];};
export const getEvent=async id=>{if(!supabase)return null;const{data}=await supabase.from("events").select("*, venues(name,address)").eq("id",id).maybeSingle();return data;};
export const createEvent=async(venueId,patch)=>{if(!supabase)return{error:"no client"};const{data,error}=await supabase.from("events").insert({venue_id:venueId,...patch}).select().single();return{data,error:error?.message};};
// Ending an event goes through close_event so reroll quota is expired in the ledger.
export const updateEvent=async(id,patch)=>{if(!supabase)return{error:"no client"};const{status,...rest}=patch||{};let data=null;if(Object.keys(rest).length||(status&&status!=='ended')){const r=await supabase.from("events").update(status&&status!=='ended'?patch:rest).eq("id",id).select().single();if(r.error)return{error:matchErrorMessage(errorCode(r.error.message),r.error.message)};data=r.data;}if(status==='ended'){const r=await rpc('close_event',{p_event:id});if(r.error)return{error:r.error};data=r.data;}return{data,error:null};};
export const deleteEvent=async id=>{if(supabase)await supabase.from("events").delete().eq("id",id);};
const getAccessTokenFromUrl=()=>{if(typeof window==='undefined')return null;const q=new URLSearchParams(window.location.search);return q.get('access')||q.get('token');};
export const joinEvent=async(eventId,_userId,explicitToken=null)=>{const token=explicitToken||getAccessTokenFromUrl();if(!token)return{data:null,error:'VENUE_ACCESS_REQUIRED'};return rpc('check_in_to_event',{p_event:eventId,p_token:token});};
// RLS scopes the rows: participants get their own row, venue staff get the whole roster.
// event_participants.user_id points at auth.users (no FK to profiles), so profiles are merged here.
export const listParticipants=async eventId=>{if(!supabase)return[];const{data}=await supabase.from('event_participants').select('*').eq('event_id',eventId).order('joined_at',{ascending:false});const rows=data||[];if(!rows.length)return rows;const ids=[...new Set(rows.map(r=>r.user_id))];const{data:profs}=await supabase.from('profiles').select('id,name,avatar_url,interests,gender').in('id',ids);const byId=Object.fromEntries((profs||[]).map(p=>[p.id,p]));return rows.map(r=>({...r,profiles:byId[r.user_id]||null}));};
export const countParticipants=async eventId=>(await rpc('count_event_participants',{p_event:eventId})).data||0;
export const computeCompat=(a,b)=>{const r=computeVibeMatch(a,b);return{score:r.score,breakdown:{...r.breakdown,reasons:r.reasons}};};
export const findOrCreateMatch=async eventId=>(await rpc('find_match',{p_event:eventId})).data;
export const getMatch=async id=>{if(!supabase)return null;const{data}=await supabase.from('matches').select('*').eq('id',id).maybeSingle();return data;};
export const getMatchPeer=async(match,meId)=>{if(!match||!supabase)return null;const peerId=match.user_a===meId?match.user_b:match.user_a;const{data}=await supabase.from('profiles').select('*').eq('id',peerId).maybeSingle();return data;};
export const getOrCreateMission=async matchId=>(await rpc('create_mission_for_match',{p_match:matchId})).data;
export const updateMission=async(id,patch={})=>{if(patch.status==='complete'||patch.completed===true)return(await rpc('complete_mission',{p_mission:id}));return{data:null,error:null};};
export const listMessages=async matchId=>{if(!supabase)return[];const{data}=await supabase.from('messages').select('*').eq('match_id',matchId).order('created_at',{ascending:true});return data||[];};
export const sendMessage=async(matchId,senderId,content)=>{if(!supabase)return{error:'no client'};const trimmed=(content||'').trim();if(!trimmed)return{error:'empty message'};const{data,error}=await supabase.from('messages').insert({match_id:matchId,sender_id:senderId,content:trimmed.slice(0,2000)}).select().single();return{data,error:error?.message};};
export const subscribeMessages=(matchId,onInsert)=>{if(!supabase)return null;const ch=supabase.channel(`messages:${matchId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'messages',filter:`match_id=eq.${matchId}`},p=>onInsert(p.new)).subscribe();return ch;};
export const createReward=async(_userId,_eventId,missionId)=>{if(!missionId)return{data:null,error:'MISSION_REQUIRED'};return rpc('complete_mission',{p_mission:missionId});};
export const listMyRewards=async userId=>{if(!supabase)return[];const{data}=await supabase.from('rewards').select('*, events(title)').eq('user_id',userId).order('created_at',{ascending:false});return data||[];};
export const redeemReward=async code=>await rpc('redeem_reward',{p_code:code});
export const eventPublicUrl=(eventId,accessToken=null)=>{const base=typeof window!=='undefined'?window.location.origin:'';return`${base}/e/${eventId}${accessToken?`?access=${encodeURIComponent(accessToken)}`:''}`;};
export const rewardRedeemUrl=code=>{const base=typeof window!=='undefined'?window.location.origin:'';return`${base}/r/${encodeURIComponent(code)}`;};

/* ---------- Private profile (birthday, preference) ---------- */
export const getPrivateProfile=async userId=>{if(!supabase||!userId)return null;const{data}=await supabase.from('profile_private').select('*').eq('user_id',userId).maybeSingle();return data;};
export const upsertPrivateProfile=async(userId,patch)=>{if(!supabase)return{error:'no client'};const allowed={};for(const k of['birthday','seeking','energy','goal'])if(patch[k]!==undefined)allowed[k]=patch[k];const{data,error}=await supabase.from('profile_private').upsert({user_id:userId,...allowed,updated_at:new Date().toISOString()}).select().single();return{data,error:error?.message};};
// Avatar photos live in the public "avatars" bucket under <user_id>/ (see supabase/014_avatar_storage.sql).
export const uploadAvatar=async(userId,file)=>{if(!supabase)return{error:'no client'};if(!file)return{error:'Pilih foto'};if(!/^image\/(jpeg|png|webp)$/.test(file.type))return{error:'Foto harus JPG, PNG, atau WEBP'};if(file.size>5*1024*1024)return{error:'Ukuran foto maksimal 5 MB'};const ext=file.type.split('/')[1].replace('jpeg','jpg');const path=`${userId}/avatar-${Date.now()}.${ext}`;const{error}=await supabase.storage.from('avatars').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(error)return{error:error.message};const{data}=supabase.storage.from('avatars').getPublicUrl(path);return{data:data.publicUrl,error:null};};
export const isAdult=birthday=>{if(!birthday)return false;const b=new Date(birthday);if(isNaN(b))return false;const now=new Date();let age=now.getFullYear()-b.getFullYear();const m=now.getMonth()-b.getMonth();if(m<0||(m===0&&now.getDate()<b.getDate()))age--;return age>=18;};
// Mirrors the server's _profile_complete() so the UI can route before calling matchmaking.
export const isMatchProfileComplete=(profile,priv)=>!!(profile&&profile.name?.trim()&&profile.gender&&profile.avatar_url&&!/pravatar\.cc/i.test(profile.avatar_url)&&(profile.interests?.length||0)>=1&&priv?.seeking&&isAdult(priv?.birthday||profile.personality?.birthday));

/* ---------- Random matchmaking (PRD V2 §6.1) ---------- */
export const matchmakingStart=eventId=>rpc('matchmaking_start',{p_event:eventId});
export const matchmakingCurrent=eventId=>rpc('matchmaking_current',{p_event:eventId});
export const matchmakingReroll=(eventId,idempotencyKey)=>rpc('matchmaking_reroll',{p_event:eventId,p_idempotency_key:idempotencyKey||null});
export const matchmakingQuota=eventId=>rpc('matchmaking_quota',{p_event:eventId});
export const matchmakingHistory=eventId=>rpc('matchmaking_history',{p_event:eventId});
export const matchmakingEligibility=eventId=>rpc('matchmaking_eligibility',{p_event:eventId});
// Turns the current random match into a matches row so missions & rewards keep working.
export const matchmakingConfirm=eventId=>rpc('matchmaking_confirm',{p_event:eventId});

/* ---------- Safety (PRD V2 §6.4) ---------- */
export const REPORT_REASONS=[{id:'harassment',label:'Pelecehan / kata-kata kasar'},{id:'inappropriate_content',label:'Konten tidak pantas'},{id:'fake_profile',label:'Profil palsu'},{id:'spam',label:'Spam / promosi'},{id:'underage',label:'Di bawah 18 tahun'},{id:'safety_concern',label:'Membuat saya merasa tidak aman'},{id:'other',label:'Lainnya'}];
export const blockUser=userId=>rpc('block_user',{p_user:userId});
export const unblockUser=userId=>rpc('unblock_user',{p_user:userId});
export const reportUser=({userId,reason,details,eventId,block=true})=>rpc('report_user',{p_user:userId,p_reason:reason,p_details:details||null,p_event:eventId||null,p_block:block});

/* ---------- Venue admin (PRD V2 §11) ---------- */
export const closeEvent=eventId=>rpc('close_event',{p_event:eventId});
export const getEventMatchAnalytics=eventId=>rpc('event_match_analytics',{p_event:eventId});

// Human-readable Indonesian messages for server error codes.
export const MATCH_ERROR_MESSAGES={UNAUTHORIZED:'Silakan masuk terlebih dahulu.',EVENT_NOT_FOUND:'Event tidak ditemukan.',EVENT_NOT_LIVE:'Event belum dimulai.',EVENT_ENDED:'Event sudah berakhir. Sisa kuota ganti match sudah hangus.',NOT_EVENT_PARTICIPANT:'Scan QR di venue dulu untuk ikut matchmaking.',PROFILE_INCOMPLETE:'Lengkapi profil (foto, gender, preferensi, umur 18+) dulu.',ACCOUNT_SUSPENDED:'Akun kamu sedang ditangguhkan.',REROLL_QUOTA_EXHAUSTED:'Kuota ganti match kamu habis.',NO_CANDIDATE_AVAILABLE:'Belum ada orang lain yang cocok. Coba lagi sebentar lagi.',RATE_LIMITED:'Terlalu banyak permintaan. Coba lagi nanti.',INVALID_TARGET:'Pengguna tidak valid.',FORBIDDEN_GENDER_ACTION:'Fitur ini tidak tersedia untuk akunmu.',USER_BLOCKED:'Kalian saling memblokir.',ACCOUNT_DELETED:'Akun ini sudah dihapus.',FORBIDDEN:'Kamu tidak punya akses.',MONETIZATION_SETTINGS_SUPER_ADMIN_ONLY:'Kuota dan harga hanya bisa diubah admin SirGaZ.',EVENT_ENDS_BEFORE_START:'Waktu selesai harus setelah waktu mulai.',REPORT_NOT_FOUND:'Laporan tidak ditemukan.'};
export const matchErrorMessage=(code,fallback)=>MATCH_ERROR_MESSAGES[code]||fallback||'Terjadi kesalahan. Coba lagi.';

/* ---------- Poke & notifications (PRD V2 Alur E, §6.4) ---------- */
export const sendPoke=(eventId,targetId)=>rpc('send_poke',{p_event:eventId,p_target:targetId});
export const pokesReceived=eventId=>rpc('pokes_received',{p_event:eventId||null});
export const pokesSent=eventId=>rpc('pokes_sent',{p_event:eventId||null});
export const listNotifications=async(limit=30)=>{if(!supabase)return[];const{data}=await supabase.from('user_notifications').select('*').order('created_at',{ascending:false}).limit(limit);return data||[];};
export const markNotificationsRead=ids=>rpc('mark_notifications_read',{p_ids:ids&&ids.length?ids:null});
export const subscribeNotifications=(userId,onInsert)=>{if(!supabase||!userId)return null;return supabase.channel(`notif:${userId}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'user_notifications',filter:`user_id=eq.${userId}`},p=>onInsert(p.new)).subscribe();};
export const unsubscribe=ch=>{if(supabase&&ch)supabase.removeChannel(ch);};

/* ---------- Privacy & account (PRD V2 §10) ---------- */
export const myBlocks=()=>rpc('my_blocks',{});
export const deleteMyAccount=()=>rpc('delete_my_account',{});

/* ---------- Super admin (PRD V2 §11) ---------- */
export const listReports=(status='OPEN')=>rpc('list_reports',{p_status:status,p_limit:200});
export const reviewReport=({reportId,status,note,suspend=false})=>rpc('review_report',{p_report:reportId,p_status:status,p_note:note||null,p_suspend:suspend});
export const setUserSuspension=(userId,suspended,note)=>rpc('set_user_suspension',{p_user:userId,p_suspended:suspended,p_note:note||null});
export const updateEventMonetization=(eventId,s)=>rpc('update_event_monetization',{p_event:eventId,p_free_rerolls:s.free_rerolls??null,p_reroll_pack_size:s.reroll_pack_size??null,p_reroll_pack_price_idr:s.reroll_pack_price_idr??null,p_chat_unlock_price_idr:s.chat_unlock_price_idr??null});
export const isSuperAdmin=async()=>{if(!supabase)return false;const uid=(await supabase.auth.getUser()).data.user?.id;if(!uid)return false;const{data}=await supabase.from('user_roles').select('role').eq('user_id',uid).eq('role','super_admin').limit(1);return!!data?.length;};
export const listAllEvents=async()=>{if(!supabase)return[];const{data}=await supabase.from('events').select('id,title,status,starts_at,ends_at,venue_name,free_rerolls,reroll_pack_size,reroll_pack_price_idr,chat_unlock_price_idr').order('created_at',{ascending:false}).limit(200);return data||[];};
