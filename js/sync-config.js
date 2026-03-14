// ============================================================
//  MEWIK STATIONERY — sync-config.js  v5.3
//
//  SETUP — TWO steps (read carefully):
//
//  Step 1 — Paste your Master Key below (replace YOUR_MASTER_KEY)
//           Get it from: jsonbin.io → API Keys → Master Key
//
//  Step 2 — Open the app once in any browser. An alert will show
//           your Bin ID. Copy it and paste it below replacing
//           YOUR_BIN_ID, then save this file and redeploy.
//           After Step 2 every device will share the same data.
//
//  You only do Step 2 ONCE. After that, do not change the Bin ID.
// ============================================================

'use strict';

const SYNC = {
  masterKey: '$2a$10$xBnLMGJj7lLX2.tb11S/XeU5xXGB0pHMtxSV3MZsRo2liNf3C/TAq',   // ← Step 1: paste Master Key here
  binId:     '69b5d173b7ec241ddc6b85fe',       // ← Step 2: paste Bin ID here after first run

  baseUrl: 'https://api.jsonbin.io/v3/b',
  pollMs:  10000,

  keyReady() {
    return this.masterKey
        && this.masterKey !== 'YOUR_MASTER_KEY'
        && this.masterKey.length > 10;
  },
  isReady() {
    return this.keyReady()
        && this.binId !== 'YOUR_BIN_ID'
        && this.binId.length > 10;
  },
  headers() {
    return {
      'Content-Type':     'application/json',
      'X-Master-Key':     this.masterKey,
      'X-Bin-Versioning': 'false',
    };
  },
};

const EMPTY_DB = {
  users:[], requests:[], logs:[], notifs:[],
  ratings:[], services:[], pricing:[], settings:{},
};

let _memCache = null;
let _dirty    = false;
let _writing  = false;
let _lastSync = 0;

// ── Get the bin ID (hardcoded in config OR from localStorage fallback) ──
function _getBinId() {
  if (SYNC.binId !== 'YOUR_BIN_ID' && SYNC.binId.length > 10) {
    return SYNC.binId;
  }
  // Fallback: check localStorage (set after first auto-create)
  return localStorage.getItem('mewik_bin_id') || null;
}

// ── Create the bin for the first time and alert the user ─────
async function _createBin() {
  console.log('[Sync] Creating new database bin…');
  const resp = await fetch(SYNC.baseUrl, {
    method:  'POST',
    headers: { ...SYNC.headers(), 'X-Bin-Name': 'mewik-db', 'X-Bin-Private': 'true' },
    body:    JSON.stringify(EMPTY_DB),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('Could not create bin: ' + resp.status + ' — ' + txt);
  }

  const data = await resp.json();
  const id   = (data.metadata && data.metadata.id) || data._id || data.id;

  if (!id) throw new Error('JSONBin did not return a Bin ID. Response: ' + JSON.stringify(data));

  localStorage.setItem('mewik_bin_id', id);
  console.log('[Sync] Bin created:', id);

  // ── Show Bin ID to user so they can paste it into sync-config.js ──
  setTimeout(function() {
    const msg =
      '✅ MEWIK DATABASE CREATED!\n\n' +
      'Your Bin ID is:\n\n' +
      id + '\n\n' +
      'ACTION REQUIRED:\n' +
      '1. Copy the Bin ID above\n' +
      '2. Open  js/sync-config.js\n' +
      '3. Replace  YOUR_BIN_ID  with this ID\n' +
      '4. Save and redeploy the file\n\n' +
      'After that, all devices will sync together.\n' +
      '(This message only appears once.)';
    alert(msg);
  }, 1500);

  return id;
}

// ── Read whole DB from JSONBin ────────────────────────────────
async function _remoteRead() {
  const id   = _getBinId();
  const resp = await fetch(SYNC.baseUrl + '/' + id + '/latest', { headers: SYNC.headers() });
  if (!resp.ok) throw new Error('Read failed: ' + resp.status);
  const json = await resp.json();
  return { ...EMPTY_DB, ...(json.record || {}) };
}

// ── Write whole DB to JSONBin ─────────────────────────────────
async function _remoteWrite(data) {
  const id   = _getBinId();
  const resp = await fetch(SYNC.baseUrl + '/' + id, {
    method:  'PUT',
    headers: SYNC.headers(),
    body:    JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Write failed: ' + resp.status);
}

// ── Get DB (from cache, localStorage, or remote) ──────────────
async function _getDB() {
  // Return in-memory cache if fresh (< 5s old)
  if (_memCache && (Date.now() - _lastSync < 5000)) return _memCache;

  // Restore localStorage cache instantly for fast page render
  if (!_memCache) {
    try {
      const c = localStorage.getItem('mewik_db_cache');
      if (c) _memCache = JSON.parse(c);
    } catch(e) {}
  }

  if (!SYNC.keyReady()) {
    if (!_memCache) _memCache = { ...EMPTY_DB };
    return _memCache;
  }

  // Ensure we have a bin ID
  let binId = _getBinId();
  if (!binId) {
    // First ever run — create the bin
    try {
      binId = await _createBin();
    } catch(e) {
      console.error('[Sync] Bin creation failed:', e.message);
      showToast('Sync Error', e.message, 'error', 8000);
      if (!_memCache) _memCache = { ...EMPTY_DB };
      return _memCache;
    }
  }

  // Read from remote
  try {
    const remote = await _remoteRead();
    _memCache = remote;
    _lastSync = Date.now();
    localStorage.setItem('mewik_db_cache', JSON.stringify(_memCache));
  } catch(e) {
    console.warn('[Sync] Remote read failed, using cache:', e.message);
    if (!_memCache) _memCache = { ...EMPTY_DB };
  }

  return _memCache;
}

// ── Save DB (debounced 600ms write to avoid hammering API) ────
async function _saveDB(data) {
  _memCache = data;
  localStorage.setItem('mewik_db_cache', JSON.stringify(data));
  _dirty = true;

  if (!SYNC.keyReady() || !_getBinId()) return;

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
  }, 600);
}

// ── Public DB API ─────────────────────────────────────────────
const DB = {

  async getUsers()        { return (await _getDB()).users || []; },
  async getUserById(id)   { return (await this.getUsers()).find(u => u.id === id) || null; },
  async getUserByEmail(e) { return (await this.getUsers()).find(u => u.email === e.toLowerCase()) || null; },
  async addUser(u)        { const db=await _getDB(); (db.users=db.users||[]).push(u); await _saveDB(db); },
  async updateUser(id,d)  { const db=await _getDB(); db.users=(db.users||[]).map(u=>u.id===id?{...u,...d}:u); await _saveDB(db); },
  async deleteUser(id)    { const db=await _getDB(); db.users=(db.users||[]).filter(u=>u.id!==id); await _saveDB(db); },

  async getRequests()          { return (await _getDB()).requests || []; },
  async getRequestById(id)     { return (await this.getRequests()).find(r=>r.id===id)||null; },
  async getRequestsByUser(uid) { return (await this.getRequests()).filter(r=>r.userId===uid); },
  async addRequest(r)          { const db=await _getDB(); (db.requests=db.requests||[]).push(r); await _saveDB(db); },
  async updateRequest(id,d)    { const db=await _getDB(); db.requests=(db.requests||[]).map(r=>r.id===id?{...r,...d}:r); await _saveDB(db); },

  async getLogs()          { return (await _getDB()).logs || []; },
  async addLog(l)          { const db=await _getDB(); (db.logs=db.logs||[]).push(l); await _saveDB(db); },
  async updateLog(reqId,d) { const db=await _getDB(); db.logs=(db.logs||[]).map(l=>l.requestId===reqId?{...l,...d}:l); await _saveDB(db); },

  async getNotifs(uid)      { return ((await _getDB()).notifs||[]).filter(n=>n.userId===uid); },
  async addNotif(n)         { const db=await _getDB(); (db.notifs=db.notifs||[]).push(n); await _saveDB(db); },
  async markNotifsRead(uid) { const db=await _getDB(); db.notifs=(db.notifs||[]).map(n=>n.userId===uid?{...n,read:true}:n); await _saveDB(db); },

  async getServices()         { return (await _getDB()).services || []; },
  async getPricing()          { return (await _getDB()).pricing  || []; },
  async savePricingItem(item) { const db=await _getDB(); db.pricing=(db.pricing||[]).map(p=>p.id===item.id?item:p); await _saveDB(db); },

  async getRatings()              { return (await _getDB()).ratings || []; },
  async getPublicRatings()        { return (await this.getRatings()).filter(r=>r.approved&&r.visible); },
  async addRating(r)              { const db=await _getDB(); (db.ratings=db.ratings||[]).push(r); await _saveDB(db); },
  async updateRating(id,d)        { const db=await _getDB(); db.ratings=(db.ratings||[]).map(r=>r.id===id?{...r,...d}:r); await _saveDB(db); },
  async deleteRating(id)          { const db=await _getDB(); db.ratings=(db.ratings||[]).filter(r=>r.id!==id); await _saveDB(db); },
  async getRatingByRequestId(rid) { return (await this.getRatings()).find(r=>r.requestId===rid)||null; },

  async getSettings() {
    const def = {
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
    return { ...def, ...((await _getDB()).settings || {}) };
  },
  async saveSettings(d) { const db=await _getDB(); db.settings=d; await _saveDB(db); },

  async _write(key, val) { const db=await _getDB(); db[key]=val; await _saveDB(db); },
};

// ── Google Drive download ─────────────────────────────────────
function driveDirectUrl(url) {
  if (!url) return null;
  if (url.includes('uc?export=download')) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : url;
}
function downloadFile(url, filename) {
  const a = document.createElement('a');
  a.href = driveDirectUrl(url);
  a.download = filename || 'completed-work.pdf';
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Download Started', 'Your file is downloading. If a confirmation page opens, click the download link.', 'success', 6000);
}

// ── Polling (every 10s) ───────────────────────────────────────
let _pollInterval = null;
let _pollCbs      = [];
let _lastSyncTs   = 0;

function startPolling(cb) {
  if (cb) _pollCbs.push(cb);
  if (_pollInterval || !SYNC.keyReady()) return;

  _pollInterval = setInterval(async function() {
    try {
      const prev = JSON.stringify(_memCache);
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
  const b = document.getElementById('sync-badge');
  if (!b) return;
  if (!SYNC.keyReady()) {
    b.innerHTML = '<span class="offline-badge">💾 Local Only</span>';
  } else if (!_getBinId()) {
    b.innerHTML = '<span class="offline-badge">⚙ Setting up…</span>';
  } else if (ok) {
    const t = _lastSyncTs ? new Date(_lastSyncTs).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'}) : '…';
    b.innerHTML = '<span class="sync-badge">● Live ' + t + '</span>';
  } else {
    b.innerHTML = '<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded', function() { updateSyncBadge(SYNC.keyReady()); });
