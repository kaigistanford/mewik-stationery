// ============================================================
//  MEWIK STATIONERY — sync-config.js  v7.0
//  100% online — no localStorage cache at all
//  Every read goes directly to Supabase every time.
//
//  PASTE YOUR VALUES BELOW:
// ============================================================
'use strict';

const SYNC = {
  url: 'https://jjpqcqlyrvqlnlmphiwt.supabase.co',   // e.g. https://jjpqcqlyrvqlnlmphiwt.supabase.co
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcHFjcWx5cnZxbG5sbXBoaXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTk1OTksImV4cCI6MjA4OTA5NTU5OX0.dLp4CserF9v-s5AS7O_ttIp2SgbBKz6Cvgc2Ue_ikBI',   // anon public key from Supabase → Settings → API

  pollMs: 8000,

  isReady() {
    return this.url !== 'YOUR_URL'
        && this.key !== 'YOUR_KEY'
        && this.url.includes('supabase')
        && this.key.length > 20;
  },

  ep() {
    return this.url.replace(/\/$/, '') + '/rest/v1/mewik_data';
  },

  h() {
    return {
      'Content-Type':  'application/json',
      'apikey':        this.key,
      'Authorization': 'Bearer ' + this.key,
    };
  },
};

const EMPTY = {
  users:[], requests:[], logs:[], notifs:[],
  ratings:[], services:[], pricing:[], settings:{},
};

// No localStorage. No cache. Every call hits Supabase directly.

async function _read() {
  if (!SYNC.isReady()) throw new Error('Supabase not configured');
  var r = await fetch(SYNC.ep() + '?id=eq.main&select=payload', { headers: SYNC.h() });
  if (!r.ok) throw new Error('Supabase read error: ' + r.status + '. Check your URL and key.');
  var rows = await r.json();
  if (!rows.length) {
    // First ever run — create the row
    await _write(Object.assign({}, EMPTY));
    return Object.assign({}, EMPTY);
  }
  return Object.assign({}, EMPTY, rows[0].payload || {});
}

async function _write(data) {
  if (!SYNC.isReady()) return;
  var r = await fetch(SYNC.ep(), {
    method:  'POST',
    headers: Object.assign({}, SYNC.h(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
    body:    JSON.stringify({ id:'main', payload:data, updated_at:new Date().toISOString() }),
  });
  if (!r.ok) {
    var t = await r.text();
    throw new Error('Supabase write error: ' + r.status + ' — ' + t);
  }
}

// Debounce write to avoid hammering API on rapid changes
var _wt = null, _wbusy = false;
async function _save(data) {
  clearTimeout(_wt);
  _wt = setTimeout(async function() {
    if (_wbusy) return;
    _wbusy = true;
    try { await _write(data); } catch(e) { console.error('[Sync write]', e.message); }
    _wbusy = false;
  }, 500);
}

// All DB operations read fresh from Supabase every time
var DB = {

  async getUsers()        { return (await _read()).users || []; },
  async getUserById(id)   { return (await DB.getUsers()).find(u=>u.id===id) || null; },
  async getUserByEmail(e) { var em=e.toLowerCase(); return (await DB.getUsers()).find(u=>u.email===em)||null; },
  async addUser(user) {
    var d=await _read(); d.users=d.users||[]; d.users.push(user); await _save(d);
  },
  async updateUser(id,upd) {
    var d=await _read(); d.users=(d.users||[]).map(u=>u.id===id?Object.assign({},u,upd):u); await _save(d);
  },
  async deleteUser(id) {
    var d=await _read(); d.users=(d.users||[]).filter(u=>u.id!==id); await _save(d);
  },

  async getRequests()          { return (await _read()).requests||[]; },
  async getRequestById(id)     { return (await DB.getRequests()).find(r=>r.id===id)||null; },
  async getRequestsByUser(uid) { return (await DB.getRequests()).filter(r=>r.userId===uid); },
  async addRequest(req) {
    var d=await _read(); d.requests=d.requests||[]; d.requests.push(req); await _save(d);
  },
  async updateRequest(id,upd) {
    var d=await _read(); d.requests=(d.requests||[]).map(r=>r.id===id?Object.assign({},r,upd):r); await _save(d);
  },

  async getLogs()   { return (await _read()).logs||[]; },
  async addLog(l)   { var d=await _read(); d.logs=d.logs||[]; d.logs.push(l); await _save(d); },
  async updateLog(reqId,upd) {
    var d=await _read(); d.logs=(d.logs||[]).map(l=>l.requestId===reqId?Object.assign({},l,upd):l); await _save(d);
  },

  async getNotifs(uid)     { return ((await _read()).notifs||[]).filter(n=>n.userId===uid); },
  async addNotif(n)        { var d=await _read(); d.notifs=d.notifs||[]; d.notifs.push(n); await _save(d); },
  async markNotifsRead(uid){ var d=await _read(); d.notifs=(d.notifs||[]).map(n=>n.userId===uid?Object.assign({},n,{read:true}):n); await _save(d); },

  async getServices()  { return (await _read()).services||[]; },
  async getPricing()   { return (await _read()).pricing||[]; },
  async savePricingItem(item) {
    var d=await _read(); d.pricing=(d.pricing||[]).map(p=>p.id===item.id?item:p); await _save(d);
  },

  async getRatings()       { return (await _read()).ratings||[]; },
  async getPublicRatings() { return (await DB.getRatings()).filter(r=>r.approved&&r.visible); },
  async addRating(r)       { var d=await _read(); d.ratings=d.ratings||[]; d.ratings.push(r); await _save(d); },
  async updateRating(id,upd){ var d=await _read(); d.ratings=(d.ratings||[]).map(r=>r.id===id?Object.assign({},r,upd):r); await _save(d); },
  async deleteRating(id)   { var d=await _read(); d.ratings=(d.ratings||[]).filter(r=>r.id!==id); await _save(d); },
  async getRatingByRequestId(rid){ return (await DB.getRatings()).find(r=>r.requestId===rid)||null; },

  async getSettings() {
    var def={
      siteName:'Mewik Stationery',tagline:'Your Academic Success, Professionally Delivered',
      phone:'+255 616 832 924',whatsapp:'255621501329',whatsapp2:'255780580470',
      email:'kaigistanford81@gmail.com',
      address:'St. Gemma Road, Miyuji Proper Street, Miyuji — Dodoma City',
      adminName:'Mewik Admin',adminEmail:'admin@mewik.co.tz',
      hours:'Mon – Sat: 8:00 AM – 8:00 PM',
      heroTitle:'Your <em>Academic Success</em>,<br>Professionally Delivered',
      heroSubtitle:'Mewik Stationery provides expert academic assistance for university and college students across Tanzania.',
      aboutText:'',
    };
    return Object.assign({},def,(await _read()).settings||{});
  },
  async saveSettings(s){ var d=await _read(); d.settings=s; await _save(d); },

  async _write(key,val){ var d=await _read(); d[key]=val; await _save(d); },
};

// ── Google Drive download ─────────────────────────────────────
function driveDirectUrl(url){
  if(!url)return null;
  if(url.includes('uc?export=download'))return url;
  var m=url.match(/\/d\/([a-zA-Z0-9_-]+)/)||url.match(/id=([a-zA-Z0-9_-]+)/);
  return m?'https://drive.google.com/uc?export=download&id='+m[1]:url;
}
function downloadFile(url,filename){
  var a=document.createElement('a');
  a.href=driveDirectUrl(url); a.download=filename||'completed-work.pdf'; a.target='_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if(typeof showToast==='function') showToast('Download Started','If a page opens, click the download link.','success',5000);
}

// ── Polling ───────────────────────────────────────────────────
var _pi=null, _pcbs=[], _lst=0;

function startPolling(cb){
  if(cb)_pcbs.push(cb);
  if(_pi||!SYNC.isReady())return;
  _pi=setInterval(async function(){
    try{
      var prev=JSON.stringify(await _read());
      _lst=Date.now();
      updateSyncBadge(true);
      var curr=JSON.stringify(await _read());
      if(curr!==prev) _pcbs.forEach(function(fn){try{fn();}catch(e){}});
    }catch(e){updateSyncBadge(false);}
  },SYNC.pollMs);
}

function stopPolling(){ if(_pi){clearInterval(_pi);_pi=null;} _pcbs=[]; }

function updateSyncBadge(ok){
  var b=document.getElementById('sync-badge'); if(!b)return;
  if(!SYNC.isReady()){
    b.innerHTML='<span class="offline-badge">⚠ Not configured</span>';
  }else if(ok){
    var t=_lst?new Date(_lst).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'}):'…';
    b.innerHTML='<span class="sync-badge">● Live '+t+'</span>';
  }else{
    b.innerHTML='<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded',function(){
  // Clear ALL old localStorage data so it cannot interfere
  var keys=Object.keys(localStorage);
  keys.forEach(function(k){
    if(k.startsWith('mewik'))localStorage.removeItem(k);
  });
  updateSyncBadge(SYNC.isReady());
});
