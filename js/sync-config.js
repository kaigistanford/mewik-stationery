// ============================================================
//  MEWIK STATIONERY — sync-config.js  v4.0
//  Cross-device sync via JSONBin.io + Google Drive downloads
//
//  SETUP (2 minutes only):
//  1. Go to https://jsonbin.io  →  Click Sign Up (free)
//  2. After login: left sidebar → API Keys → Create Access Key
//  3. Give it any name, copy the key that appears
//  4. Replace YOUR_MASTER_KEY below with your key
//  5. Save file and upload to GitHub — done!
// ============================================================

'use strict';

const SYNC = {
  masterKey: '$2a$10$EGi0YZvvS54SrvOjDetz3u4n/3Bzir6sbzGVTvwRIsIUnRzyD0HwO',   // ← paste your JSONBin key here
  baseUrl:   'https://api.jsonbin.io/v3/b',
  pollMs:    12000,                // check for updates every 12 seconds

  // Bin IDs are auto-created on first use and saved locally
  bins: {},

  isReady() {
    return this.masterKey && this.masterKey !== 'YOUR_MASTER_KEY';
  },
  getBinId(name) {
    return this.bins[name] || localStorage.getItem('mewik_bin_' + name) || null;
  },
  saveBinId(name, id) {
    this.bins[name] = id;
    localStorage.setItem('mewik_bin_' + name, id);
  },
  headers() {
    return { 'Content-Type': 'application/json', 'X-Master-Key': this.masterKey, 'X-Bin-Versioning': 'false' };
  },
};

// ── JSONBin REST operations ───────────────────────────────────
const JSONBin = {
  async create(name, data) {
    const resp = await fetch(SYNC.baseUrl, {
      method: 'POST',
      headers: { ...SYNC.headers(), 'X-Bin-Name': 'mewik-' + name, 'X-Bin-Private': 'true' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) throw new Error('Create failed: ' + resp.status);
    const json = await resp.json();
    SYNC.saveBinId(name, json.metadata.id);
    return data;
  },
  async read(name) {
    const id = SYNC.getBinId(name);
    if (!id) return null;
    const resp = await fetch(SYNC.baseUrl + '/' + id + '/latest', { headers: SYNC.headers() });
    if (resp.status === 404) { SYNC.saveBinId(name, null); return null; }
    if (!resp.ok) throw new Error('Read failed: ' + resp.status);
    return (await resp.json()).record;
  },
  async write(name, data) {
    const id = SYNC.getBinId(name);
    if (!id) return JSONBin.create(name, data);
    const resp = await fetch(SYNC.baseUrl + '/' + id, { method: 'PUT', headers: SYNC.headers(), body: JSON.stringify(data) });
    if (!resp.ok) throw new Error('Write failed: ' + resp.status);
    return data;
  },
};

// ── Unified DB layer ──────────────────────────────────────────
const DB = {
  _ls(key, def)      { try{const v=JSON.parse(localStorage.getItem('mewikd_'+key));return v!==null?v:def;}catch{return def;} },
  _lsSave(key, val)  { localStorage.setItem('mewikd_'+key, JSON.stringify(val)); },

  async _read(name, def) {
    if (SYNC.isReady()) {
      try {
        const remote = SYNC.getBinId(name) ? await JSONBin.read(name) : null;
        if (remote !== null) { this._lsSave(name, remote); return remote; }
        // Bin doesn't exist yet — create with local or default data
        const local = this._ls(name, def);
        await JSONBin.create(name, local);
        return local;
      } catch(e) { console.warn('[DB]', name, e.message); }
    }
    return this._ls(name, def);
  },

  async _write(name, val) {
    this._lsSave(name, val);
    if (SYNC.isReady()) {
      try { await JSONBin.write(name, val); }
      catch(e) { console.warn('[DB write]', name, e.message); }
    }
  },

  // ── Users ──────────────────────────────────────────────────
  async getUsers()        { return this._read('users', []); },
  async getUserById(id)   { return (await this.getUsers()).find(u=>u.id===id)||null; },
  async getUserByEmail(e) { return (await this.getUsers()).find(u=>u.email===e.toLowerCase())||null; },
  async addUser(user)     { const a=await this.getUsers();a.push(user);await this._write('users',a); },
  async updateUser(id,d)  { await this._write('users',(await this.getUsers()).map(u=>u.id===id?{...u,...d}:u)); },
  async deleteUser(id)    { await this._write('users',(await this.getUsers()).filter(u=>u.id!==id)); },

  // ── Requests ───────────────────────────────────────────────
  async getRequests()          { return this._read('requests', []); },
  async getRequestById(id)     { return (await this.getRequests()).find(r=>r.id===id)||null; },
  async getRequestsByUser(uid) { return (await this.getRequests()).filter(r=>r.userId===uid); },
  async addRequest(req)        { const a=await this.getRequests();a.push(req);await this._write('requests',a); },
  async updateRequest(id,d)    { await this._write('requests',(await this.getRequests()).map(r=>r.id===id?{...r,...d}:r)); },

  // ── Logs ───────────────────────────────────────────────────
  async getLogs()              { return this._read('logs', []); },
  async addLog(log)            { const a=await this.getLogs();a.push(log);await this._write('logs',a); },
  async updateLog(reqId,d)     { await this._write('logs',(await this.getLogs()).map(l=>l.requestId===reqId?{...l,...d}:l)); },

  // ── Notifications ───────────────────────────────────────────
  async getNotifs(uid)         { return (await this._read('notifs',[])).filter(n=>n.userId===uid); },
  async addNotif(n)            { const a=await this._read('notifs',[]);a.push(n);await this._write('notifs',a); },
  async markNotifsRead(uid)    { await this._write('notifs',(await this._read('notifs',[])).map(n=>n.userId===uid?{...n,read:true}:n)); },

  // ── Services & Pricing ─────────────────────────────────────
  async getServices()          { return this._read('services', []); },
  async getPricing()           { return this._read('pricing', []); },
  async savePricingItem(item)  { await this._write('pricing',(await this.getPricing()).map(p=>p.id===item.id?item:p)); },

  // ── Ratings ────────────────────────────────────────────────
  async getRatings()           { return this._read('ratings', []); },
  async getPublicRatings()     { return (await this.getRatings()).filter(r=>r.approved&&r.visible); },
  async addRating(r)           { const a=await this.getRatings();a.push(r);await this._write('ratings',a); },
  async updateRating(id,d)     { await this._write('ratings',(await this.getRatings()).map(r=>r.id===id?{...r,...d}:r)); },
  async deleteRating(id)       { await this._write('ratings',(await this.getRatings()).filter(r=>r.id!==id)); },
  async getRatingByRequestId(rid){ return (await this.getRatings()).find(r=>r.requestId===rid)||null; },

  // ── Settings ───────────────────────────────────────────────
  async getSettings() {
    const def={siteName:'Mewik Stationery',tagline:'Your Academic Success, Professionally Delivered',phone:'+255 616 832 924',whatsapp:'255621501329',whatsapp2:'255780580470',email:'kaigistanford81@gmail.com',address:'St. Gemma Road, Miyuji Proper Street, Miyuji — Dodoma City',adminName:'Mewik Admin',adminEmail:'admin@mewik.co.tz',hours:'Mon – Sat: 8:00 AM – 8:00 PM',heroTitle:'Your <em>Academic Success</em>,<br>Professionally Delivered',heroSubtitle:'Mewik Stationery provides expert academic assistance for university and college students across Tanzania.',aboutText:''};
    return {...def,...(await this._read('settings',def))};
  },
  async saveSettings(d) { await this._write('settings',d); },

  // ── Full sync pull (for polling) ────────────────────────────
  async syncAll() {
    if (!SYNC.isReady()) return false;
    let changed = false;
    for (const key of ['users','requests','logs','notifs','ratings','services','pricing','settings']) {
      try {
        const remote = await JSONBin.read(key);
        if (remote !== null) {
          const cur = JSON.stringify(this._ls(key, null));
          if (JSON.stringify(remote) !== cur) { this._lsSave(key, remote); changed = true; }
        }
      } catch(e) {}
    }
    return changed;
  },
};

// ── Google Drive → Direct Download ────────────────────────────
function driveDirectUrl(url) {
  if (!url) return null;
  if (url.includes('uc?export=download')) return url;
  const m = url.match(/\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : url;
}

function downloadFile(url, filename) {
  const direct = driveDirectUrl(url);
  filename = filename || 'completed-work.pdf';
  const a = document.createElement('a');
  a.href     = direct;
  a.download = filename;
  a.target   = '_blank';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  showToast('Download Started', 'Your file is downloading. If a confirmation page appears, click the download link.', 'success', 6000);
}

// ── Polling ───────────────────────────────────────────────────
let _pollInterval = null, _pollCbs = [], _lastSync = 0;

function startPolling(cb) {
  if (cb) _pollCbs.push(cb);
  if (_pollInterval || !SYNC.isReady()) return;
  _pollInterval = setInterval(async function() {
    try {
      const changed = await DB.syncAll();
      _lastSync = Date.now();
      updateSyncBadge(true);
      if (changed) _pollCbs.forEach(function(fn){try{fn();}catch(e){}});
    } catch(e) { updateSyncBadge(false); }
  }, SYNC.pollMs);
}

function stopPolling() { if(_pollInterval){clearInterval(_pollInterval);_pollInterval=null;} _pollCbs=[]; }

function updateSyncBadge(ok) {
  const b = document.getElementById('sync-badge'); if (!b) return;
  if (!SYNC.isReady()) {
    b.innerHTML = '<span class="offline-badge">💾 Local Mode</span>';
  } else if (ok) {
    const t = _lastSync ? new Date(_lastSync).toLocaleTimeString('en-TZ',{hour:'2-digit',minute:'2-digit'}) : '…';
    b.innerHTML = '<span class="sync-badge">● Synced ' + t + '</span>';
  } else {
    b.innerHTML = '<span class="offline-badge">⚠ Sync Error</span>';
  }
}

document.addEventListener('DOMContentLoaded', function() { updateSyncBadge(SYNC.isReady()); });
