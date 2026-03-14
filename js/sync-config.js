// ============================================================
//  MEWIK STATIONERY — sync-config.js  v5.4
//
//  SETUP — TWO steps:
//
//  Step 1: Paste your Master Key below (replace YOUR_MASTER_KEY)
//          Get it from: jsonbin.io → API Keys → Master Key
//
//  Step 2: Open the app in a browser. After a few seconds a
//          blue banner appears at the top showing your Bin ID.
//          Copy it, paste it below replacing YOUR_BIN_ID,
//          save this file, then redeploy. Done.
//
//  After Step 2, never change the Bin ID again.
// ============================================================

'use strict';

const SYNC = {
  masterKey: 'YOUR_MASTER_KEY',   // ← Step 1: paste Master Key here
  binId:     'YOUR_BIN_ID',       // ← Step 2: paste Bin ID here after first run

  baseUrl: 'https://api.jsonbin.io/v3/b',
  pollMs:  10000,

  // Key is pasted
  keyReady() {
    return typeof this.masterKey === 'string'
        && this.masterKey.length > 20
        && this.masterKey !== 'YOUR_MASTER_KEY';
  },

  // Both key AND bin ID are set — full sync available
  isReady() {
    return this.keyReady()
        && typeof this.binId === 'string'
        && this.binId.length > 10
        && this.binId !== 'YOUR_BIN_ID';
  },

  headers() {
    return {
      'Content-Type':     'application/json',
      'X-Master-Key':     this.masterKey,
      'X-Bin-Versioning': 'false',
    };
  },
};

// ── Safe notification (does not depend on app.js) ─────────────
function _syncNotify(msg, isError) {
  // Try showToast if available (app.js already loaded)
  if (typeof showToast === 'function') {
    showToast(isError ? 'Sync Error' : 'Sync', msg, isError ? 'error' : 'info', 8000);
    return;
  }
  // Otherwise show a simple banner at top of page
  var existing = document.getElementById('_sync_banner');
  if (existing) existing.remove();
  var banner = document.createElement('div');
  banner.id = '_sync_banner';
  banner.style.cssText = [
    'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
    'background:' + (isError ? '#dc2626' : '#1d4ed8'),
    'color:#fff', 'padding:14px 20px', 'font-family:sans-serif',
    'font-size:14px', 'line-height:1.5', 'white-space:pre-wrap',
    'box-shadow:0 2px 12px rgba(0,0,0,0.3)',
  ].join(';');
  banner.textContent = msg;
  var close = document.createElement('button');
  close.textContent = '✕';
  close.style.cssText = 'float:right;background:none;border:none;color:#fff;font-size:18px;cursor:pointer;margin-left:16px;';
  close.onclick = function(){ banner.remove(); };
  banner.insertBefore(close, banner.firstChild);
  document.body.appendChild(banner);
}

// ── Empty database structure ──────────────────────────────────
const EMPTY_DB = {
  users:[], requests:[], logs:[], notifs:[],
  ratings:[], services:[], pricing:[], settings:{},
};

// ── State ─────────────────────────────────────────────────────
let _memCache  = null;
let _dirty     = false;
let _writing   = false;
let _lastSync  = 0;
let _binId     = null;   // resolved at runtime — ALWAYS from SYNC.binId, never from localStorage

// The bin ID comes ONLY from sync-config.js, not from localStorage.
// This ensures every device uses the exact same bin.
function _getBinId() {
  return SYNC.isReady() ? SYNC.binId : null;
}

// ── Create the shared bin (first-time setup only) ─────────────
async function _createBin() {
  var resp = await fetch(SYNC.baseUrl, {
    method:  'POST',
    headers: Object.assign({}, SYNC.headers(), {
      'X-Bin-Name':    'mewik-db',
      'X-Bin-Private': 'true',
    }),
    body: JSON.stringify(EMPTY_DB),
  });

  if (!resp.ok) {
    var errText = await resp.text();
    throw new Error('JSONBin error ' + resp.status + ': ' + errText);
  }

  var data = await resp.json();
  var id   = (data.metadata && data.metadata.id)
           || data._id
           || data.id
           || null;

  if (!id) throw new Error('JSONBin did not return a Bin ID. Got: ' + JSON.stringify(data));
  return id;
}

// ── Show Bin ID banner so user can copy it ───────────────────
function _showBinIdBanner(id) {
  var msg = '🎉 DATABASE CREATED — YOUR BIN ID IS BELOW. COPY IT NOW:\n\n'
    + id + '\n\n'
    + 'Then open  js/sync-config.js,  replace  YOUR_BIN_ID  with the ID above, save and redeploy.';
  _syncNotify(msg, false);
  console.log('=== MEWIK BIN ID ===', id, '====================');
}

// ── Remote read ───────────────────────────────────────────────
async function _remoteRead() {
  var id   = _getBinId();
  var resp = await fetch(SYNC.baseUrl + '/' + id + '/latest', { headers: SYNC.headers() });
  if (!resp.ok) throw new Error('Read ' + resp.status);
  var json = await resp.json();
  return Object.assign({}, EMPTY_DB, json.record || {});
}

// ── Remote write ──────────────────────────────────────────────
async function _remoteWrite(data) {
  var id   = _getBinId();
  var resp = await fetch(SYNC.baseUrl + '/' + id, {
    method:  'PUT',
    headers: SYNC.headers(),
    body:    JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Write ' + resp.status);
}

// ── Get DB ────────────────────────────────────────────────────
async function _getDB() {
  // Return in-memory cache if it is fresh (less than 5 seconds old)
  if (_memCache && (Date.now() - _lastSync < 5000)) return _memCache;

  // Always start with localStorage cache for instant rendering
  if (!_memCache) {
    try {
      var c = localStorage.getItem('mewik_db_cache');
      if (c) _memCache = JSON.parse(c);
    } catch(e) {}
  }

  // No Master Key — work offline only
  if (!SYNC.keyReady()) {
    if (!_memCache) _memCache = Object.assign({}, EMPTY_DB);
    return _memCache;
  }

  // Master Key present but no Bin ID yet — create the bin
  if (!SYNC.isReady()) {
    try {
      var newId = await _createBin();
      _showBinIdBanner(newId);
      // Use EMPTY_DB for this session; user must paste the ID to enable sync
      if (!_memCache) _memCache = Object.assign({}, EMPTY_DB);
    } catch(e) {
      _syncNotify('Could not create database: ' + e.message, true);
      if (!_memCache) _memCache = Object.assign({}, EMPTY_DB);
    }
    return _memCache;
  }

  // Full sync — read from remote
  try {
    var remote = await _remoteRead();
    _memCache  = remote;
    _lastSync  = Date.now();
    localStorage.setItem('mewik_db_cache', JSON.stringify(_memCache));
  } catch(e) {
    console.warn('[Sync] Read failed, using cache:', e.message);
    if (!_memCache) _memCache = Object.assign({}, EMPTY_DB);
  }

  return _memCache;
}

// ── Save DB (debounced 800ms to batch rapid writes) ───────────
async function _saveDB(data) {
  _memCache = data;
  _dirty    = true;
  // Always update localStorage immediately for offline fallback
  try { localStorage.setItem('mewik_db_cache', JSON.stringify(data)); } catch(e){}

  if (!SYNC.isReady()) return;   // no bin ID yet — skip remote write

  clearTimeout(_saveDB._t);
  _saveDB._t = setTimeout(async function() {
    if (!_dirty || _writing) return;
    _writing = true;
    try {
      await _remoteWrite(_memCache);
      _dirty    = false;
      _lastSync = Date.now();
    } catch(e) {
      console.warn('[Sync] Write failed:', e.message);
    }
    _writing = false;
  }, 800);
}

// ── Public DB API ─────────────────────────────────────────────
var DB = {

  // Users
  async getUsers()        { return (await _getDB()).users || []; },
  async getUserById(id)   { return (await this.getUsers()).find(function(u){ return u.id === id; }) || null; },
  async getUserByEmail(e) {
    var em = e.toLowerCase();
    return (await this.getUsers()).find(function(u){ return u.email === em; }) || null;
  },
  async addUser(user) {
    var db = await _getDB();
    db.users = db.users || [];
    db.users.push(user);
    await _saveDB(db);
  },
  async updateUser(id, data) {
    var db = await _getDB();
    db.users = (db.users||[]).map(function(u){ return u.id===id ? Object.assign({},u,data) : u; });
    await _saveDB(db);
  },
  async deleteUser(id) {
    var db = await _getDB();
    db.users = (db.users||[]).filter(function(u){ return u.id!==id; });
    await _saveDB(db);
  },

  // Requests
  async getRequests()          { return (await _getDB()).requests || []; },
  async getRequestById(id)     { return (await this.getRequests()).find(function(r){ return r.id===id; })||null; },
  async getRequestsByUser(uid) { return (await this.getRequests()).filter(function(r){ return r.userId===uid; }); },
  async addRequest(req) {
    var db = await _getDB(); db.requests=db.requests||[]; db.requests.push(req); await _saveDB(db);
  },
  async updateRequest(id, data) {
    var db = await _getDB();
    db.requests=(db.requests||[]).map(function(r){ return r.id===id?Object.assign({},r,data):r; });
    await _saveDB(db);
  },

  // Logs
  async getLogs() { return (await _getDB()).logs || []; },
  async addLog(log) {
    var db=await _getDB(); db.logs=db.logs||[]; db.logs.push(log); await _saveDB(db);
  },
  async updateLog(reqId, data) {
    var db=await _getDB();
    db.logs=(db.logs||[]).map(function(l){ return l.requestId===reqId?Object.assign({},l,data):l; });
    await _saveDB(db);
  },

  // Notifications
  async getNotifs(uid) {
    return ((await _getDB()).notifs||[]).filter(function(n){ return n.userId===uid; });
  },
  async addNotif(n) {
    var db=await _getDB(); db.notifs=db.notifs||[]; db.notifs.push(n); await _saveDB(db);
  },
  async markNotifsRead(uid) {
    var db=await _getDB();
    db.notifs=(db.notifs||[]).map(function(n){ return n.userId===uid?Object.assign({},n,{read:true}):n; });
    await _saveDB(db);
  },

  // Services & Pricing
  async getServices() { return (await _getDB()).services||[]; },
  async getPricing()  { return (await _getDB()).pricing||[]; },
  async savePricingItem(item) {
    var db=await _getDB();
    db.pricing=(db.pricing||[]).map(function(p){ return p.id===item.id?item:p; });
    await _saveDB(db);
  },

  // Ratings
  async getRatings()       { return (await _getDB()).ratings||[]; },
  async getPublicRatings() { return (await this.getRatings()).filter(function(r){ return r.approved&&r.visible; }); },
  async addRating(r) {
    var db=await _getDB(); db.ratings=db.ratings||[]; db.ratings.push(r); await _saveDB(db);
  },
  async updateRating(id, data) {
    var db=await _getDB();
    db.ratings=(db.ratings||[]).map(function(r){ return r.id===id?Object.assign({},r,data):r; });
    await _saveDB(db);
  },
  async deleteRating(id) {
    var db=await _getDB();
    db.ratings=(db.ratings||[]).filter(function(r){ return r.id!==id; });
    await _saveDB(db);
  },
  async getRatingByRequestId(rid) {
    return (await this.getRatings()).find(function(r){ return r.requestId===rid; })||null;
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
    var db = await _getDB();
    return Object.assign({}, def, db.settings||{});
  },
  async saveSettings(d) {
    var db=await _getDB(); db.settings=d; await _saveDB(db);
  },

  // Internal (used by seed function in app.js)
  async _write(key, val) {
    var db=await _getDB(); db[key]=val; await _saveDB(db);
  },
};

// ── Google Drive download ─────────────────────────────────────
function driveDirectUrl(url) {
  if (!url) return null;
  if (url.includes('uc?export=download')) return url;
  var m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : url;
}
function downloadFile(url, filename) {
  var a = document.createElement('a');
  a.href     = driveDirectUrl(url);
  a.download = filename || 'completed-work.pdf';
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // showToast may or may not be available here — guard it
  if (typeof showToast === 'function') {
    showToast('Download Started', 'If a confirmation page opens, click the download link.', 'success', 6000);
  }
}

// ── Polling ───────────────────────────────────────────────────
var _pollInterval = null;
var _pollCbs      = [];
var _lastSyncTs   = 0;

function startPolling(cb) {
  if (cb) _pollCbs.push(cb);
  if (_pollInterval || !SYNC.isReady()) return;

  _pollInterval = setInterval(async function() {
    try {
      var prev   = JSON.stringify(_memCache);
      _memCache  = null;
      _lastSync  = 0;
      await _getDB();
      _lastSyncTs = Date.now();
      updateSyncBadge(true);
      if (JSON.stringify(_memCache) !== prev) {
        _pollCbs.forEach(function(fn){ try{ fn(); } catch(e){} });
      }
    } catch(e) {
      updateSyncBadge(false);
    }
  }, SYNC.pollMs);
}

function stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
  _pollCbs = [];
}

function updateSyncBadge(ok) {
  var b = document.getElementById('sync-badge');
  if (!b) return;
  if (!SYNC.keyReady()) {
    b.innerHTML = '<span class="offline-badge">💾 Local Only</span>';
  } else if (!SYNC.isReady()) {
    b.innerHTML = '<span class="offline-badge">⚙ First-time setup…</span>';
  } else if (ok) {
    var t = _lastSyncTs
      ? new Date(_lastSyncTs).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'})
      : '…';
    b.innerHTML = '<span class="sync-badge">● Live ' + t + '</span>';
  } else {
    b.innerHTML = '<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded', function() {
  updateSyncBadge(SYNC.keyReady());
});
