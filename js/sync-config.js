// ============================================================
//  MEWIK STATIONERY — sync-config.js  v5.2
//
//  SETUP — only one step:
//  1. Go to https://jsonbin.io → login → click "API Keys"
//  2. Click "Create Access Key" → name it anything → copy the Master Key
//  3. Paste it below replacing YOUR_MASTER_KEY → save this file
//
//  The app creates everything else automatically. Done.
// ============================================================

'use strict';

const SYNC = {
  masterKey: '$2a$10$W/dA/v/ac68GEI1O9PKcR.jVqoBZVJMKmeAqdCjGJ9oyyHc71hnEC',   // ← paste ONLY this
  baseUrl:   'https://api.jsonbin.io/v3/b',
  pollMs:    10000,

  isReady() {
    return this.masterKey
        && this.masterKey !== 'YOUR_MASTER_KEY'
        && this.masterKey.length > 10;
  },

  headers() {
    return {
      'Content-Type':     'application/json',
      'X-Master-Key':     this.masterKey,
      'X-Bin-Versioning': 'false',
    };
  },
};

// ── Bootstrap: get or create the ONE shared bin ───────────────
// The bin ID is stored in a tiny "pointer" bin whose ID is
// derived from the master key — same key always → same pointer
// → same data bin. Every device with the same key finds the same data.

const POINTER_NAME = 'mewik-ptr';
const DATA_NAME    = 'mewik-db';
const EMPTY_DB     = {
  users:[], requests:[], logs:[], notifs:[],
  ratings:[], services:[], pricing:[], settings:{},
};

let _dataBinId  = localStorage.getItem('mewik_data_bin') || null;
let _memCache   = null;
let _dirty      = false;
let _writing    = false;
let _lastSync   = 0;
let _setupDone  = false;

// Find or create the data bin, using a named search
async function _bootstrap() {
  if (_setupDone && _dataBinId) return true;
  if (!SYNC.isReady()) return false;

  try {
    // 1. Try to find existing bins named mewik-db
    const searchResp = await fetch('https://api.jsonbin.io/v3/b?meta=true', {
      headers: SYNC.headers(),
    });

    if (searchResp.ok) {
      const list = await searchResp.json();
      const bins = list.result || list.bins || list || [];
      const found = Array.isArray(bins)
        ? bins.find(b => (b.record?.name||b.metadata?.name||b.name||'') === DATA_NAME)
        : null;

      if (found) {
        const id = found._id || found.record?._id || found.metadata?.id || found.id;
        if (id) {
          _dataBinId = id;
          localStorage.setItem('mewik_data_bin', id);
          _setupDone = true;
          console.log('[Sync] Found existing bin:', id);
          return true;
        }
      }
    }

    // 2. No existing bin found — create one
    if (!_dataBinId) {
      console.log('[Sync] Creating new data bin…');
      const createResp = await fetch(SYNC.baseUrl, {
        method:  'POST',
        headers: { ...SYNC.headers(), 'X-Bin-Name': DATA_NAME, 'X-Bin-Private': 'true' },
        body:    JSON.stringify(EMPTY_DB),
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error('Create bin failed ' + createResp.status + ': ' + errText);
      }

      const created = await createResp.json();
      const newId   = created.metadata?.id || created._id || created.id;
      if (!newId) throw new Error('No bin ID in response: ' + JSON.stringify(created));

      _dataBinId = newId;
      localStorage.setItem('mewik_data_bin', newId);
      _setupDone = true;
      console.log('[Sync] Created new bin:', newId);
      return true;
    }

  } catch(e) {
    console.error('[Sync] Bootstrap failed:', e.message);
    return false;
  }

  _setupDone = true;
  return !!_dataBinId;
}

// ── Read whole DB ─────────────────────────────────────────────
async function _remoteRead() {
  const resp = await fetch(SYNC.baseUrl + '/' + _dataBinId + '/latest', {
    headers: SYNC.headers(),
  });
  if (!resp.ok) throw new Error('Read failed: ' + resp.status);
  const json = await resp.json();
  return { ...EMPTY_DB, ...(json.record || {}) };
}

// ── Write whole DB ────────────────────────────────────────────
async function _remoteWrite(data) {
  const resp = await fetch(SYNC.baseUrl + '/' + _dataBinId, {
    method:  'PUT',
    headers: SYNC.headers(),
    body:    JSON.stringify(data),
  });
  if (!resp.ok) throw new Error('Write failed: ' + resp.status);
}

// ── Get current DB (init on first call) ──────────────────────
async function _getDB() {
  // Return cached if available and not stale
  if (_memCache && (Date.now() - _lastSync < 5000)) return _memCache;

  // Restore from localStorage immediately for fast render
  if (!_memCache) {
    const cached = localStorage.getItem('mewik_db_cache');
    if (cached) {
      try { _memCache = JSON.parse(cached); } catch(e) {}
    }
  }

  if (SYNC.isReady()) {
    const ok = await _bootstrap();
    if (ok) {
      try {
        const remote = await _remoteRead();
        _memCache  = remote;
        _lastSync  = Date.now();
        localStorage.setItem('mewik_db_cache', JSON.stringify(_memCache));
      } catch(e) {
        console.warn('[Sync] Read error, using cache:', e.message);
        if (!_memCache) _memCache = { ...EMPTY_DB };
      }
    } else {
      if (!_memCache) _memCache = { ...EMPTY_DB };
    }
  } else {
    if (!_memCache) _memCache = { ...EMPTY_DB };
  }

  return _memCache;
}

// ── Save DB (write-through with 600ms debounce) ───────────────
async function _saveDB(data) {
  _memCache = data;
  localStorage.setItem('mewik_db_cache', JSON.stringify(data));
  _dirty = true;

  if (!SYNC.isReady() || !_dataBinId) return;

  clearTimeout(_saveDB._t);
  _saveDB._t = setTimeout(async function() {
    if (!_dirty || _writing) return;
    _writing = true;
    try {
      await _remoteWrite(_memCache);
      _dirty    = false;
      _lastSync = Date.now();
    } catch(e) {
      console.warn('[Sync] Write error:', e.message);
    }
    _writing = false;
  }, 600);
}

// ── DB public API ─────────────────────────────────────────────
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

  async getLogs()   { return (await _getDB()).logs || []; },
  async addLog(l)   { const db=await _getDB(); (db.logs=db.logs||[]).push(l); await _saveDB(db); },
  async updateLog(reqId,d) { const db=await _getDB(); db.logs=(db.logs||[]).map(l=>l.requestId===reqId?{...l,...d}:l); await _saveDB(db); },

  async getNotifs(uid)      { return ((await _getDB()).notifs||[]).filter(n=>n.userId===uid); },
  async addNotif(n)         { const db=await _getDB(); (db.notifs=db.notifs||[]).push(n); await _saveDB(db); },
  async markNotifsRead(uid) { const db=await _getDB(); db.notifs=(db.notifs||[]).map(n=>n.userId===uid?{...n,read:true}:n); await _saveDB(db); },

  async getServices()         { return (await _getDB()).services || []; },
  async getPricing()          { return (await _getDB()).pricing  || []; },
  async savePricingItem(item) { const db=await _getDB(); db.pricing=(db.pricing||[]).map(p=>p.id===item.id?item:p); await _saveDB(db); },

  async getRatings()               { return (await _getDB()).ratings || []; },
  async getPublicRatings()         { return (await this.getRatings()).filter(r=>r.approved&&r.visible); },
  async addRating(r)               { const db=await _getDB(); (db.ratings=db.ratings||[]).push(r); await _saveDB(db); },
  async updateRating(id,d)         { const db=await _getDB(); db.ratings=(db.ratings||[]).map(r=>r.id===id?{...r,...d}:r); await _saveDB(db); },
  async deleteRating(id)           { const db=await _getDB(); db.ratings=(db.ratings||[]).filter(r=>r.id!==id); await _saveDB(db); },
  async getRatingByRequestId(rid)  { return (await this.getRatings()).find(r=>r.requestId===rid)||null; },

  async getSettings() {
    const def = {
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
    return { ...def, ...((await _getDB()).settings||{}) };
  },
  async saveSettings(d) { const db=await _getDB(); db.settings=d; await _saveDB(db); },

  // Used by app.js seed function
  async _write(key,val) { const db=await _getDB(); db[key]=val; await _saveDB(db); },
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
  a.href = driveDirectUrl(url); a.download = filename||'completed-work.pdf'; a.target='_blank';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  showToast('Download Started','Your file is downloading. If a confirmation page opens, click the download link.','success',6000);
}

// ── Polling ───────────────────────────────────────────────────
let _pollInterval = null, _pollCbs = [], _lastSyncTs = 0;

function startPolling(cb) {
  if (cb) _pollCbs.push(cb);
  if (_pollInterval || !SYNC.isReady()) return;

  _pollInterval = setInterval(async function() {
    try {
      const prev = JSON.stringify(_memCache);
      _memCache  = null;       // force fresh remote read
      _lastSync  = 0;
      await _getDB();
      _lastSyncTs = Date.now();
      updateSyncBadge(true);
      if (JSON.stringify(_memCache) !== prev) {
        _pollCbs.forEach(function(fn){ try{fn();}catch(e){} });
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
  const b = document.getElementById('sync-badge'); if (!b) return;
  if (!SYNC.isReady()) {
    b.innerHTML = '<span class="offline-badge">💾 Local Only</span>';
  } else if (ok) {
    const t = _lastSyncTs ? new Date(_lastSyncTs).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'}) : '…';
    b.innerHTML = '<span class="sync-badge">● Live ' + t + '</span>';
  } else {
    b.innerHTML = '<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded', function() { updateSyncBadge(SYNC.isReady()); });
