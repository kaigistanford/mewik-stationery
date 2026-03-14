// ============================================================
//  MEWIK STATIONERY — app.js
//  Core utilities, DB layer (localStorage), helpers
// ============================================================

'use strict';

// ── Constants ─────────────────────────────────────────────────
const APP = {
  name: 'Mewik Stationery',
  version: '1.0.0',
  whatsapp: '255780580470',          // <-- Replace with real number
  email: 'admin@mewikstationery.co.tz',
  adminPass: 'admin@mewik2024',      // Default admin password (change in production)
};

// ── DB Keys ───────────────────────────────────────────────────
const DB_KEYS = {
  users:    'mewik_users',
  requests: 'mewik_requests',
  services: 'mewik_services',
  pricing:  'mewik_pricing',
  logs:     'mewik_logs',
  notifs:   'mewik_notifs',
  session:  'mewik_session',
};

// ── Database Layer ────────────────────────────────────────────
const DB = {
  get(key) {
    try { return JSON.parse(localStorage.getItem(DB_KEYS[key])) || []; }
    catch { return []; }
  },
  set(key, data) {
    localStorage.setItem(DB_KEYS[key], JSON.stringify(data));
  },
  getObj(key) {
    try { return JSON.parse(localStorage.getItem(DB_KEYS[key])) || {}; }
    catch { return {}; }
  },
  setObj(key, data) {
    localStorage.setItem(DB_KEYS[key], JSON.stringify(data));
  },

  // ── Users ──────────────────────────────────────────────────
  getUsers()       { return this.get('users'); },
  saveUsers(u)     { this.set('users', u); },
  getUserById(id)  { return this.getUsers().find(u => u.id === id); },
  getUserByEmail(e){ return this.getUsers().find(u => u.email === e.toLowerCase()); },

  addUser(user) {
    const users = this.getUsers();
    users.push(user);
    this.saveUsers(users);
  },
  updateUser(id, data) {
    const users = this.getUsers().map(u => u.id === id ? { ...u, ...data } : u);
    this.saveUsers(users);
  },

  // ── Requests ───────────────────────────────────────────────
  getRequests()       { return this.get('requests'); },
  saveRequests(r)     { this.set('requests', r); },
  getRequestById(id)  { return this.getRequests().find(r => r.id === id); },
  getRequestsByUser(uid) { return this.getRequests().filter(r => r.userId === uid); },

  addRequest(req) {
    const reqs = this.getRequests();
    reqs.push(req);
    this.saveRequests(reqs);
  },
  updateRequest(id, data) {
    const reqs = this.getRequests().map(r => r.id === id ? { ...r, ...data } : r);
    this.saveRequests(reqs);
  },

  // ── Logs ───────────────────────────────────────────────────
  getLogs()     { return this.get('logs'); },
  saveLogs(l)   { this.set('logs', l); },
  addLog(log) {
    const logs = this.getLogs();
    logs.push(log);
    this.saveLogs(logs);
  },

  // ── Notifications ──────────────────────────────────────────
  getNotifs(userId) {
    const all = this.get('notifs');
    return all.filter(n => n.userId === userId);
  },
  addNotif(notif) {
    const notifs = this.get('notifs');
    notifs.push(notif);
    this.set('notifs', notifs);
  },
  markNotifsRead(userId) {
    const notifs = this.get('notifs').map(n =>
      n.userId === userId ? { ...n, read: true } : n
    );
    this.set('notifs', notifs);
  },

  // ── Services & Pricing ─────────────────────────────────────
  getServices() { return this.get('services'); },
  getPricing()  { return this.get('pricing'); },
};

// ── Session ───────────────────────────────────────────────────
const Session = {
  get() {
    try { return JSON.parse(localStorage.getItem(DB_KEYS.session)); }
    catch { return null; }
  },
  set(user) { localStorage.setItem(DB_KEYS.session, JSON.stringify(user)); },
  clear()   { localStorage.removeItem(DB_KEYS.session); },
  isLoggedIn() { return !!this.get(); },
  isAdmin()    { return this.get()?.role === 'admin'; },
  currentUser(){ return this.get(); },
};

// ── Hashing ───────────────────────────────────────────────────
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'mewik_salt_2024');
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── ID Generation ─────────────────────────────────────────────
function generateId(prefix = 'ID') {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substr(2,4).toUpperCase()}`;
}

// ── Date Utils ────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-TZ', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-TZ', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
function daysAgo(dateStr) {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}
function isExpired(dateStr, days) {
  return daysAgo(dateStr) >= days;
}

// ── Cleanup (3-day user history) ─────────────────────────────
function runCleanup() {
  const reqs = DB.getRequests().map(r => {
    if (r.status === 'Completed' && isExpired(r.completedAt || r.createdAt, 3)) {
      return { ...r, hiddenFromUser: true };
    }
    return r;
  });
  DB.saveRequests(reqs);
}

// ── Toast Notifications ───────────────────────────────────────
function showToast(title, message = '', type = 'info', duration = 5000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warning: '⚠️' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <div>
      <div class="toast-title">${title}</div>
      ${message ? `<div class="toast-msg">${message}</div>` : ''}
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">✕</button>
  `;
  container.appendChild(toast);
  if (duration) setTimeout(() => toast.remove(), duration);
}

// ── Progress mapping ──────────────────────────────────────────
const PROGRESS_STAGES = ['Submitted', 'Under Review', 'In Progress', 'Quality Check', 'Completed'];

function getProgressPct(status) {
  const idx = PROGRESS_STAGES.indexOf(status);
  if (idx < 0) return 0;
  return Math.round((idx / (PROGRESS_STAGES.length - 1)) * 100);
}

function statusBadge(status) {
  const map = {
    'Submitted':     'status-submitted',
    'Under Review':  'status-under-review',
    'In Progress':   'status-in-progress',
    'Quality Check': 'status-quality-check',
    'Completed':     'status-completed',
    'Cancelled':     'status-cancelled',
  };
  return `<span class="badge-status ${map[status] || 'status-submitted'}">${status}</span>`;
}

// ── Routing Guard ─────────────────────────────────────────────
function requireLogin(redirect = 'login.html') {
  if (!Session.isLoggedIn()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}
function requireAdmin(redirect = 'login.html') {
  if (!Session.isAdmin()) {
    window.location.href = redirect;
    return false;
  }
  return true;
}
function redirectIfLoggedIn(redirect = 'dashboard.html') {
  if (Session.isLoggedIn()) {
    window.location.href = Session.isAdmin() ? 'admin.html' : redirect;
  }
}

// ── Escape HTML ───────────────────────────────────────────────
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Initialize Sample Data ────────────────────────────────────
function initSampleData() {
  if (DB.getServices().length > 0) return; // Already initialized

  // Services
  const services = [
    {
      id: 'svc-1',
      name: 'Assignment Assistance',
      icon: '📝',
      description: 'Professional assistance for coursework assignments. Covers all subjects and levels at Tanzanian universities and colleges.',
      badge: 'Popular',
      category: 'Academic',
    },
    {
      id: 'svc-2',
      name: 'Field Attachment Report',
      icon: '🏛️',
      description: 'Complete field attachment/internship report writing following IRDP, UDOM, UDSM, and other institutional formats.',
      badge: 'Fast',
      category: 'Academic',
    },
    {
      id: 'svc-3',
      name: 'Socio-Economic Profile',
      icon: '📊',
      description: 'Group project socio-economic profile writing for wards, villages, or districts in Tanzania with proper data tables.',
      badge: 'Group',
      category: 'Academic',
    },
    {
      id: 'svc-4',
      name: 'Research Assistance',
      icon: '🔬',
      description: 'Full research support from proposal writing to final research report. APA and other citation styles supported.',
      badge: 'Premium',
      category: 'Research',
    },
  ];

  // Pricing
  const pricing = [
    { id: 'p-1', service: 'Assignment Assistance',       minPrice: 10000, maxPrice: 50000,  currency: 'TZS' },
    { id: 'p-2', service: 'Field Attachment Report',     minPrice: 30000, maxPrice: 80000,  currency: 'TZS' },
    { id: 'p-3', service: 'Socio-Economic Profile',      minPrice: 40000, maxPrice: 100000, currency: 'TZS' },
    { id: 'p-4', service: 'Research Proposal Writing',   minPrice: 50000, maxPrice: 120000, currency: 'TZS' },
    { id: 'p-5', service: 'Research Report Writing',     minPrice: 80000, maxPrice: 200000, currency: 'TZS' },
    { id: 'p-6', service: 'Full Research Package',       minPrice: 120000, maxPrice: 300000, currency: 'TZS' },
  ];

  DB.set('services', services);
  DB.set('pricing', pricing);

  // Create admin account
  const adminExists = DB.getUsers().find(u => u.role === 'admin');
  if (!adminExists) {
    hashPassword(APP.adminPass).then(hash => {
      DB.addUser({
        id: 'admin-001',
        fullName: 'Mewik Admin',
        email: 'admin@mewik.co.tz',
        phone: APP.whatsapp,
        university: 'Mewik Stationery',
        program: 'Administration',
        level: 'Admin',
        passwordHash: hash,
        role: 'admin',
        createdAt: new Date().toISOString(),
      });
    });
  }
}

// ── Sidebar Toggle ────────────────────────────────────────────
function initSidebar() {
  const sidebar  = document.querySelector('.sidebar');
  const overlay  = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger');
  if (!sidebar) return;

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('show');
  });
  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  });
}

// ── Notification Bell ─────────────────────────────────────────
function initNotifBell() {
  const bell = document.querySelector('.notification-btn');
  const panel = document.querySelector('.notif-panel');
  if (!bell || !panel) return;

  bell.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      const user = Session.currentUser();
      if (user) {
        DB.markNotifsRead(user.id);
        renderNotifPanel(user.id);
        const dot = bell.querySelector('.notif-dot');
        if (dot) dot.style.display = 'none';
      }
    }
  });
  document.addEventListener('click', () => panel.classList.remove('open'));
  panel.addEventListener('click', e => e.stopPropagation());
}

function renderNotifPanel(userId) {
  const panel = document.querySelector('.notif-panel');
  if (!panel) return;
  const notifs = DB.getNotifs(userId).slice().reverse().slice(0, 15);
  const list = panel.querySelector('.notif-list') || panel;
  const items = notifs.length ? notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}">
      <div class="notif-item-title">${esc(n.title)}</div>
      <div class="notif-item-text">${esc(n.message)}</div>
      <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
    </div>
  `).join('') : '<div class="notif-item"><div class="notif-item-text" style="text-align:center;padding:12px 0">No notifications yet</div></div>';

  panel.innerHTML = `
    <div class="notif-panel-header">
      <span class="notif-panel-title">🔔 Notifications</span>
      <span style="font-size:0.78rem;color:var(--gray-mid)">${notifs.filter(n=>!n.read).length} unread</span>
    </div>
    <div class="notif-list">${items}</div>
  `;
}

function updateNotifDot(userId) {
  const unread = DB.getNotifs(userId).filter(n => !n.read).length;
  const dot = document.querySelector('.notif-dot');
  if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
}

// ── Excel Export (SheetJS) ─────────────────────────────────────
function exportToExcel(data, filename = 'export.xlsx', sheetName = 'Sheet1') {
  if (typeof XLSX === 'undefined') {
    showToast('Error', 'Excel library not loaded. Please try again.', 'error');
    return;
  }
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSampleData();
  runCleanup();
  initSidebar();
  initNotifBell();

  // Active nav link
  const path = window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href.includes(path)) link.classList.add('active');
  });
});
