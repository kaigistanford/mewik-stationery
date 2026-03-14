// ============================================================
//  MEWIK STATIONERY — sync-config.js  v6.0 (Supabase)
//
//  SETUP — 3 steps, takes 5 minutes:
//
//  1. Go to https://supabase.com → Sign Up free (use Google login)
//
//  2. Click "New Project" → name it "mewik" → set any password
//     → click "Create project" → wait 1 minute for it to start
//
//  3. In your project: click the gear icon (Settings) in the
//     left sidebar → click "API" → copy two things:
//       - Project URL  (looks like https://xyz.supabase.co)
//       - anon public key (long string starting with eyJ...)
//     Paste them below replacing YOUR_URL and YOUR_KEY
//
//  4. Still in Supabase: click "SQL Editor" in left sidebar →
//     click "New query" → paste the SQL below → click Run:
//
//  CREATE TABLE IF NOT EXISTS mewik_data (
//    id TEXT PRIMARY KEY DEFAULT 'main',
//    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
//    updated_at TIMESTAMPTZ DEFAULT now()
//  );
//  INSERT INTO mewik_data (id, payload) VALUES ('main', '{}')
//  ON CONFLICT (id) DO NOTHING;
//
//  That is everything. Save this file and the app works on all devices.
// ============================================================

'use strict';

const SYNC = {
  url:    'https://jjpqcqlyrvqlnlmphiwt.supabase.co',   // e.g. https://abcxyz.supabase.co
  key:    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqcHFjcWx5cnZxbG5sbXBoaXd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MTk1OTksImV4cCI6MjA4OTA5NTU5OX0.dLp4CserF9v-s5AS7O_ttIp2SgbBKz6Cvgc2Ue_ikBI',   // anon public key (starts with eyJ...)
  pollMs: 8000,

  isReady() {
    return this.url !== 'YOUR_URL'
        && this.key !== 'YOUR_KEY'
        && this.url.length > 10
        && this.key.length > 20;
  },

  endpoint() {
    return this.url + '/rest/v1/mewik_data';
  },

  headers() {
    return {
      'Content-Type':  'application/json',
      'apikey':        this.key,
      'Authorization': 'Bearer ' + this.key,
      'Prefer':        'return=representation',
    };
  },
};

// ── Empty database structure ──────────────────────────────────
const EMPTY_DB = {
  users:[], requests:[], logs:[], notifs:[],
  ratings:[], services:[], pricing:[], settings:{},
};

// ── In-memory state ───────────────────────────────────────────
let _mem       = null;   // in-memory cache
let _lastFetch = 0;      // timestamp of last remote fetch
let _saveTimer = null;   // debounce timer for writes
let _saving    = false;  // prevent overlapping writes

// ── Safe banner notification (no dependency on app.js) ────────
function _notify(msg, isError) {
  if (typeof showToast === 'function') {
    showToast(isError ? 'Error' : 'Info', msg, isError ? 'error' : 'info', 7000);
    return;
  }
  var old = document.getElementById('_sb_banner');
  if (old) old.remove();
  var el = document.createElement('div');
  el.id = '_sb_banner';
  el.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:999999;'
    + 'background:' + (isError?'#dc2626':'#1d4ed8') + ';color:#fff;'
    + 'padding:14px 48px 14px 20px;font:14px/1.5 sans-serif;'
    + 'white-space:pre-wrap;box-shadow:0 2px 8px rgba(0,0,0,.4)';
  el.textContent = msg;
  var btn = document.createElement('button');
  btn.textContent = '✕';
  btn.style.cssText = 'position:absolute;right:14px;top:50%;transform:translateY(-50%);'
    + 'background:none;border:none;color:#fff;font-size:18px;cursor:pointer;';
  btn.onclick = function(){ el.remove(); };
  el.appendChild(btn);
  document.body.appendChild(el);
}

// ── Read from Supabase ────────────────────────────────────────
async function _remoteRead() {
  var resp = await fetch(SYNC.endpoint() + '?id=eq.main&select=payload', {
    headers: SYNC.headers(),
  });
  if (!resp.ok) throw new Error('Supabase read failed: ' + resp.status);
  var rows = await resp.json();
  if (!rows || rows.length === 0) {
    // Row does not exist yet — create it
    await _remoteWrite(EMPTY_DB);
    return Object.assign({}, EMPTY_DB);
  }
  return Object.assign({}, EMPTY_DB, rows[0].payload || {});
}

// ── Write to Supabase (upsert) ────────────────────────────────
async function _remoteWrite(data) {
  var resp = await fetch(SYNC.endpoint(), {
    method:  'POST',
    headers: Object.assign({}, SYNC.headers(), { 'Prefer': 'resolution=merge-duplicates,return=minimal' }),
    body:    JSON.stringify({ id: 'main', payload: data, updated_at: new Date().toISOString() }),
  });
  if (!resp.ok) {
    var txt = await resp.text();
    throw new Error('Supabase write failed: ' + resp.status + ' — ' + txt);
  }
}

// ── Get DB (local cache first, then remote) ───────────────────
async function _getDB() {
  // Return in-memory if fresh (< 5 seconds old)
  if (_mem && (Date.now() - _lastFetch < 5000)) return _mem;

  // Load localStorage cache immediately for instant page render
  if (!_mem) {
    try {
      var c = localStorage.getItem('mewik_db');
      if (c) _mem = JSON.parse(c);
    } catch(e) {}
  }

  if (!SYNC.isReady()) {
    if (!_mem) _mem = Object.assign({}, EMPTY_DB);
    return _mem;
  }

  // Fetch fresh from Supabase
  try {
    var remote = await _remoteRead();
    _mem       = remote;
    _lastFetch = Date.now();
    localStorage.setItem('mewik_db', JSON.stringify(_mem));
  } catch(e) {
    console.warn('[Sync] Remote read failed:', e.message);
    if (!_mem) _mem = Object.assign({}, EMPTY_DB);
    _notify('Sync read error: ' + e.message + '\n\nCheck your Supabase URL and key in sync-config.js', true);
  }

  return _mem;
}

// ── Save DB (update local + schedule remote write) ────────────
async function _saveDB(data) {
  _mem = data;
  try { localStorage.setItem('mewik_db', JSON.stringify(data)); } catch(e) {}

  if (!SYNC.isReady()) return;

  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async function() {
    if (_saving) return;
    _saving = true;
    try {
      await _remoteWrite(_mem);
      _lastFetch = Date.now();
    } catch(e) {
      console.warn('[Sync] Write failed:', e.message);
    }
    _saving = false;
  }, 600);
}

// ── Public DB API ─────────────────────────────────────────────
var DB = {

  // Users
  async getUsers()        { return (await _getDB()).users || []; },
  async getUserById(id)   { return (await this.getUsers()).find(function(u){return u.id===id;})||null; },
  async getUserByEmail(e) {
    var em = e.toLowerCase();
    return (await this.getUsers()).find(function(u){return u.email===em;})||null;
  },
  async addUser(user) {
    var db=await _getDB(); db.users=db.users||[]; db.users.push(user); await _saveDB(db);
  },
  async updateUser(id,d) {
    var db=await _getDB();
    db.users=(db.users||[]).map(function(u){return u.id===id?Object.assign({},u,d):u;});
    await _saveDB(db);
  },
  async deleteUser(id) {
    var db=await _getDB();
    db.users=(db.users||[]).filter(function(u){return u.id!==id;});
    await _saveDB(db);
  },

  // Requests
  async getRequests()          { return (await _getDB()).requests||[]; },
  async getRequestById(id)     { return (await this.getRequests()).find(function(r){return r.id===id;})||null; },
  async getRequestsByUser(uid) { return (await this.getRequests()).filter(function(r){return r.userId===uid;}); },
  async addRequest(r) {
    var db=await _getDB(); db.requests=db.requests||[]; db.requests.push(r); await _saveDB(db);
  },
  async updateRequest(id,d) {
    var db=await _getDB();
    db.requests=(db.requests||[]).map(function(r){return r.id===id?Object.assign({},r,d):r;});
    await _saveDB(db);
  },

  // Logs
  async getLogs()   { return (await _getDB()).logs||[]; },
  async addLog(l)   { var db=await _getDB(); db.logs=db.logs||[]; db.logs.push(l); await _saveDB(db); },
  async updateLog(reqId,d) {
    var db=await _getDB();
    db.logs=(db.logs||[]).map(function(l){return l.requestId===reqId?Object.assign({},l,d):l;});
    await _saveDB(db);
  },

  // Notifications
  async getNotifs(uid) {
    return ((await _getDB()).notifs||[]).filter(function(n){return n.userId===uid;});
  },
  async addNotif(n) {
    var db=await _getDB(); db.notifs=db.notifs||[]; db.notifs.push(n); await _saveDB(db);
  },
  async markNotifsRead(uid) {
    var db=await _getDB();
    db.notifs=(db.notifs||[]).map(function(n){return n.userId===uid?Object.assign({},n,{read:true}):n;});
    await _saveDB(db);
  },

  // Services & Pricing
  async getServices() { return (await _getDB()).services||[]; },
  async getPricing()  { return (await _getDB()).pricing||[]; },
  async savePricingItem(item) {
    var db=await _getDB();
    db.pricing=(db.pricing||[]).map(function(p){return p.id===item.id?item:p;});
    await _saveDB(db);
  },

  // Ratings
  async getRatings()       { return (await _getDB()).ratings||[]; },
  async getPublicRatings() { return (await this.getRatings()).filter(function(r){return r.approved&&r.visible;}); },
  async addRating(r) {
    var db=await _getDB(); db.ratings=db.ratings||[]; db.ratings.push(r); await _saveDB(db);
  },
  async updateRating(id,d) {
    var db=await _getDB();
    db.ratings=(db.ratings||[]).map(function(r){return r.id===id?Object.assign({},r,d):r;});
    await _saveDB(db);
  },
  async deleteRating(id) {
    var db=await _getDB();
    db.ratings=(db.ratings||[]).filter(function(r){return r.id!==id;});
    await _saveDB(db);
  },
  async getRatingByRequestId(rid) {
    return (await this.getRatings()).find(function(r){return r.requestId===rid;})||null;
  },

  // Settings
  async getSettings() {
    var def = {
      siteName:'Mewik Stationery', tagline:'Your Academic Success, Professionally Delivered',
      phone:'+255 616 832 924', whatsapp:'255621501329', whatsapp2:'255780580470',
      email:'kaigistanford81@gmail.com',
      address:'St. Gemma Road, Miyuji Proper Street, Miyuji — Dodoma City',
      adminName:'Mewik Admin', adminEmail:'admin@mewik.co.tz',
      hours:'Mon – Sat: 8:00 AM – 8:00 PM',
      heroTitle:'Your <em>Academic Success</em>,<br>Professionally Delivered',
      heroSubtitle:'Mewik Stationery provides expert academic assistance for university and college students across Tanzania.',
      aboutText:'',
    };
    return Object.assign({}, def, (await _getDB()).settings||{});
  },
  async saveSettings(d) {
    var db=await _getDB(); db.settings=d; await _saveDB(db);
  },

  async _write(key,val) {
    var db=await _getDB(); db[key]=val; await _saveDB(db);
  },
};

// ── Google Drive download ─────────────────────────────────────
function driveDirectUrl(url) {
  if (!url) return null;
  if (url.includes('uc?export=download')) return url;
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/uc?export=download&id='+m[1] : url;
}
function downloadFile(url, filename) {
  var a = document.createElement('a');
  a.href=driveDirectUrl(url); a.download=filename||'completed-work.pdf'; a.target='_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  if (typeof showToast==='function') showToast('Download Started','If a confirmation page opens, click the download link.','success',6000);
}

// ── Polling ───────────────────────────────────────────────────
var _pollInterval=null, _pollCbs=[], _lastSyncTs=0;

function startPolling(cb) {
  if (cb) _pollCbs.push(cb);
  if (_pollInterval || !SYNC.isReady()) return;

  _pollInterval = setInterval(async function(){
    try {
      var prev=JSON.stringify(_mem);
      _mem=null; _lastFetch=0;
      await _getDB();
      _lastSyncTs=Date.now();
      updateSyncBadge(true);
      if (JSON.stringify(_mem)!==prev) {
        _pollCbs.forEach(function(fn){try{fn();}catch(e){}});
      }
    } catch(e){ updateSyncBadge(false); }
  }, SYNC.pollMs);
}

function stopPolling(){
  if(_pollInterval){clearInterval(_pollInterval);_pollInterval=null;}
  _pollCbs=[];
}

function updateSyncBadge(ok){
  var b=document.getElementById('sync-badge'); if(!b)return;
  if(!SYNC.isReady()){
    b.innerHTML='<span class="offline-badge">💾 Local Only</span>';
  } else if(ok){
    var t=_lastSyncTs?new Date(_lastSyncTs).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'}):'…';
    b.innerHTML='<span class="sync-badge">● Live '+t+'</span>';
  } else {
    b.innerHTML='<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded',function(){updateSyncBadge(SYNC.isReady());});
