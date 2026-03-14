// ============================================================
//  MEWIK STATIONERY — admin.js  v1.1.0
//  Full admin panel: requests, logs, ratings, settings, accounts
// ============================================================

'use strict';

let adminUser = null;

document.addEventListener('DOMContentLoaded', function() {
  if (!requireLogin()) return;
  adminUser = Session.currentUser();
  if (adminUser.role !== 'admin') { window.location.href = 'dashboard.html'; return; }

  const nameEl = document.querySelector('.sidebar-user-name');
  const initEl = document.querySelector('.sidebar-avatar');
  if (nameEl) nameEl.textContent = adminUser.fullName;
  if (initEl) initEl.textContent = 'A';

  updateNotifDot(adminUser.id);

  const hash = window.location.hash.replace('#','') || 'overview';
  showAdminSection(hash);

  document.querySelectorAll('.sidebar-link[data-section]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const section = link.dataset.section;
      history.pushState(null, '', '#' + section);
      showAdminSection(section);
      document.querySelectorAll('.sidebar-link').forEach(function(l) { l.classList.remove('active'); });
      link.classList.add('active');
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach(function(b) { b.addEventListener('click', logout); });
});

// ── Section Router ─────────────────────────────────────────────
function showAdminSection(name) {
  document.querySelectorAll('.dash-section').forEach(function(s) { s.classList.add('hidden'); });
  const sec = document.getElementById('section-' + name);
  if (sec) sec.classList.remove('hidden');
  const titles = { overview:'Admin Overview', requests:'All Requests', logs:'System Logs', users:'Registered Students', pricing:'Pricing Configuration', ratings:'Student Ratings', settings:'Site Settings', account:'Account Management' };
  const topTitle = document.querySelector('.topbar-title');
  if (topTitle) topTitle.textContent = titles[name] || 'Admin';
  if (name === 'overview')  renderAdminOverview();
  if (name === 'requests')  renderAdminRequests();
  if (name === 'logs')      renderAdminLogs();
  if (name === 'users')     renderAdminUsers();
  if (name === 'pricing')   renderPricing();
  if (name === 'ratings')   renderRatings();
  if (name === 'settings')  renderSettings();
  if (name === 'account')   renderAccountMgmt();
}

// ── Overview ──────────────────────────────────────────────────
function renderAdminOverview() {
  const reqs      = DB.getRequests();
  const active    = reqs.filter(function(r) { return r.status !== 'Completed' && r.status !== 'Cancelled'; });
  const completed = reqs.filter(function(r) { return r.status === 'Completed'; });
  const revenue   = completed.reduce(function(s,r) { return s + (Number(r.price)||0); }, 0);
  const users     = DB.getUsers().filter(function(u) { return u.role !== 'admin'; });
  const ratings   = DB.getRatings();
  const avgRating = ratings.length ? (ratings.reduce(function(s,r) { return s+(r.stars||0); },0) / ratings.length).toFixed(1) : '—';

  setEl('admin-stat-total',     reqs.length);
  setEl('admin-stat-active',    active.length);
  setEl('admin-stat-completed', completed.length);
  setEl('admin-stat-revenue',   'TZS ' + revenue.toLocaleString());
  setEl('admin-stat-users',     users.length);
  setEl('admin-stat-rating',    avgRating + (ratings.length ? ' (' + ratings.length + ')' : ''));

  const recent  = reqs.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).slice(0,5);
  const listEl  = document.getElementById('admin-recent-list');
  if (!listEl) return;
  listEl.innerHTML = recent.length
    ? '<div class="table-wrapper"><table><thead><tr><th>ID</th><th>Student</th><th>Service</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>'
      + recent.map(function(r) {
          return '<tr><td><span style="font-family:var(--font-mono);font-size:0.75rem">' + esc(r.id) + '</span></td>'
            + '<td>' + esc(r.userName) + '</td><td>' + esc(r.serviceType) + '</td>'
            + '<td>' + formatDate(r.createdAt) + '</td><td>' + statusBadge(r.status) + '</td>'
            + '<td><button class="btn btn-secondary btn-sm" onclick="openRequestEdit(\'' + r.id + '\')">Manage</button></td></tr>';
        }).join('')
      + '</tbody></table></div>'
    : '<div class="empty-state"><div class="empty-icon">📬</div><div class="empty-title">No requests yet</div></div>';
}

// ── All Requests ──────────────────────────────────────────────
let requestFilter = 'all';

function renderAdminRequests() {
  const reqs = DB.getRequests()
    .filter(function(r) { return requestFilter === 'all' || r.status === requestFilter; })
    .sort(function(a,b) { return new Date(b.createdAt)-new Date(a.createdAt); });

  const container = document.getElementById('admin-requests-list');
  if (!container) return;

  const filterBar = document.getElementById('req-filter-bar');
  if (filterBar && !filterBar.dataset.init) {
    filterBar.dataset.init = '1';
    const filters = ['all','Submitted','Under Review','In Progress','Quality Check','Completed'];
    filterBar.innerHTML = filters.map(function(f) {
      return '<button class="filter-tab ' + (f === requestFilter ? 'active' : '') + '" onclick="setReqFilter(\'' + f + '\')">' + (f === 'all' ? 'All' : f) + '</button>';
    }).join('');
  }

  if (!reqs.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No requests</div></div>';
    return;
  }

  container.innerHTML = '<div class="table-wrapper"><table><thead><tr>'
    + '<th>Request ID</th><th>Student</th><th>University</th><th>Service</th><th>Deadline</th><th>Status</th><th>Price</th><th>Actions</th>'
    + '</tr></thead><tbody>'
    + reqs.map(function(r) {
        return '<tr>'
          + '<td><span style="font-family:var(--font-mono);font-size:0.75rem">' + esc(r.id) + '</span></td>'
          + '<td><div style="font-weight:600;font-size:0.88rem">' + esc(r.userName) + '</div><div style="font-size:0.75rem;color:var(--gray-mid)">' + esc(r.userEmail) + '</div></td>'
          + '<td style="font-size:0.82rem">' + esc(r.university||'—') + '</td>'
          + '<td style="font-size:0.85rem;max-width:160px">' + esc(r.serviceType) + '</td>'
          + '<td style="font-size:0.82rem">' + formatDate(r.deadline) + '</td>'
          + '<td>' + statusBadge(r.status) + '</td>'
          + '<td style="font-family:var(--font-mono);font-size:0.82rem">' + (r.price ? 'TZS '+Number(r.price).toLocaleString() : '—') + '</td>'
          + '<td><div style="display:flex;gap:6px;flex-wrap:wrap">'
          + '<button class="btn btn-secondary btn-sm" onclick="openRequestEdit(\'' + r.id + '\')">✏️ Manage</button>'
          + (r.requirements ? '<button class="btn btn-outline btn-sm" onclick="downloadRequirements(\'' + r.id + '\')">⬇ Req</button>' : '')
          + '</div></td></tr>';
      }).join('')
    + '</tbody></table></div>';
}

function setReqFilter(f) {
  requestFilter = f;
  document.querySelectorAll('.filter-tab').forEach(function(t) {
    t.classList.toggle('active', t.textContent === f || (f === 'all' && t.textContent === 'All'));
  });
  renderAdminRequests();
}

// ── Open & Save Request Edit Modal ────────────────────────────
function openRequestEdit(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) { showToast('Error', 'Request not found.', 'error'); return; }

  setEl('edit-req-id',                req.id);
  setEl('edit-req-student',           (req.userName||'—') + ' (' + (req.userEmail||'—') + ')');
  setEl('edit-req-service',           req.serviceType||'—');
  setEl('edit-req-deadline',          formatDate(req.deadline));
  setEl('edit-req-description',       req.description||'—');
  setEl('edit-req-requirements-text', req.requirements||'—');
  setEl('edit-req-phone',             req.userPhone||'—');
  setEl('edit-req-university',        req.university||'—');
  setEl('edit-req-program',           req.program||'—');

  const statusEl = document.getElementById('edit-status');
  const priceEl  = document.getElementById('edit-price');
  const payEl    = document.getElementById('edit-payment');
  const notesEl  = document.getElementById('edit-admin-notes');
  const linkEl   = document.getElementById('edit-delivery-link');
  if (statusEl) statusEl.value = req.status        || 'Submitted';
  if (priceEl)  priceEl.value  = req.price          || '';
  if (payEl)    payEl.value    = req.paymentStatus  || 'Pending';
  if (notesEl)  notesEl.value  = req.adminNotes     || '';
  if (linkEl)   linkEl.value   = req.deliveryFile   || '';

  rebind('save-request-btn', function() { saveRequestEdits(reqId); });
  rebind('send-notif-btn',   function() { sendUserNotif(reqId); });
  rebind('download-req-btn', function() { downloadRequirements(reqId); });

  openModal('edit-request');
}

function saveRequestEdits(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;

  const newStatus    = document.getElementById('edit-status').value;
  const price        = document.getElementById('edit-price').value;
  const payment      = document.getElementById('edit-payment').value;
  const adminNotes   = document.getElementById('edit-admin-notes').value.trim();
  const deliveryFile = document.getElementById('edit-delivery-link').value.trim();

  const updates = {
    status:        newStatus,
    price:         price ? Number(price) : req.price,
    paymentStatus: payment,
    adminNotes,
    deliveryFile,
  };
  if (newStatus === 'Completed' && req.status !== 'Completed') {
    updates.completedAt = new Date().toISOString();
  }
  DB.updateRequest(reqId, updates);

  // Update log
  DB.saveLogs(DB.getLogs().map(function(l) {
    return l.requestId === reqId
      ? Object.assign({}, l, { status: newStatus, price: updates.price, completedAt: updates.completedAt || l.completedAt })
      : l;
  }));

  // Notify student
  const msgs = {
    'Under Review':  '📋 Your request is now under review.',
    'In Progress':   '⚙️ We have started working on your request.',
    'Quality Check': '🔍 Your work is in final quality check.',
    'Completed':     deliveryFile ? '🎉 Your work is complete! Download it now.' : '🎉 Your request has been completed.',
  };
  if (msgs[newStatus]) {
    DB.addNotif({ id:generateId('NTF'), userId:req.userId, title:'Status Update: '+newStatus, message:msgs[newStatus], createdAt:new Date().toISOString(), read:false });
  }
  // If completed, prompt for rating
  if (newStatus === 'Completed') {
    DB.addNotif({ id:generateId('NTF'), userId:req.userId, title:'⭐ How was our service?', message:'Your work is done. Please take a moment to rate our service — it helps other students.', createdAt:new Date().toISOString(), read:false, ratingPrompt:true, requestId:reqId });
  }

  closeModal('edit-request');
  showToast('Request Updated', 'Status changed to: ' + newStatus, 'success');
  renderAdminRequests();
}

function sendUserNotif(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) { showToast('Error','Request not found.','error'); return; }
  const msgEl = document.getElementById('custom-notif-msg');
  const msg   = msgEl ? msgEl.value.trim() : '';
  if (!msg) { showToast('Missing','Enter a message to send.','warning'); return; }
  DB.addNotif({ id:generateId('NTF'), userId:req.userId, title:'💬 Message from Mewik Admin', message:msg, createdAt:new Date().toISOString(), read:false });
  showToast('Notification Sent', 'Message sent to ' + req.userName + '.', 'success');
  if (msgEl) msgEl.value = '';
}

function downloadRequirements(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;
  const content = 'MEWIK STATIONERY — Student Requirements\n'
    + '========================================\n'
    + 'Request ID:   ' + req.id + '\n'
    + 'Student:      ' + (req.userName||'—') + '\n'
    + 'Email:        ' + (req.userEmail||'—') + '\n'
    + 'Phone:        ' + (req.userPhone||'—') + '\n'
    + 'University:   ' + (req.university||'—') + '\n'
    + 'Program:      ' + (req.program||'—') + '\n'
    + 'Service:      ' + req.serviceType + '\n'
    + 'Deadline:     ' + formatDate(req.deadline) + '\n'
    + 'Submitted:    ' + formatDateTime(req.createdAt) + '\n\n'
    + 'DESCRIPTION\n-----------\n' + (req.description||'—') + '\n\n'
    + 'SPECIFIC REQUIREMENTS\n---------------------\n' + (req.requirements||'—') + '\n';
  const blob = new Blob([content], {type:'text/plain'});
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'requirements-' + req.id + '.txt';
  a.click(); URL.revokeObjectURL(url);
}

// ── Logs ──────────────────────────────────────────────────────
function renderAdminLogs() {
  const logs = DB.getLogs().slice().reverse();
  const container = document.getElementById('logs-list');
  if (!container) return;
  if (!logs.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No logs yet</div></div>'; return; }
  container.innerHTML = '<div class="table-wrapper"><table><thead><tr>'
    + '<th>Request ID</th><th>Student</th><th>Service</th><th>Submitted</th><th>Completed</th><th>Price (TZS)</th><th>Status</th>'
    + '</tr></thead><tbody>'
    + logs.map(function(l) {
        return '<tr>'
          + '<td><span style="font-family:var(--font-mono);font-size:0.75rem">' + esc(l.requestId) + '</span></td>'
          + '<td>' + esc(l.userName) + '</td><td>' + esc(l.serviceType) + '</td>'
          + '<td>' + formatDate(l.submittedAt) + '</td><td>' + formatDate(l.completedAt) + '</td>'
          + '<td>' + (l.price ? Number(l.price).toLocaleString() : '—') + '</td>'
          + '<td>' + statusBadge(l.status) + '</td></tr>';
      }).join('')
    + '</tbody></table></div>';
}
function exportAllLogs() {
  const logs = DB.getLogs();
  if (!logs.length) { showToast('No Data','No logs to export.','warning'); return; }
  exportToExcel(logs.map(function(l) {
    return { 'Request ID':l.requestId, 'Student Name':l.userName, 'Service':l.serviceType,
      'Submission Date':formatDate(l.submittedAt), 'Completion Date':formatDate(l.completedAt),
      'Price (TZS)':l.price||'', 'Status':l.status };
  }), 'mewik-logs-' + new Date().toISOString().slice(0,10) + '.xlsx', 'Logs');
  showToast('Exported','Logs exported to Excel.','success');
}

// ── Users ──────────────────────────────────────────────────────
function renderAdminUsers() {
  const users = DB.getUsers().filter(function(u) { return u.role !== 'admin'; });
  const container = document.getElementById('users-list');
  if (!container) return;
  if (!users.length) { container.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No registered users</div></div>'; return; }
  container.innerHTML = '<div class="table-wrapper"><table><thead><tr>'
    + '<th>Name</th><th>Email</th><th>Phone</th><th>University</th><th>Program</th><th>Level</th><th>Joined</th><th>Action</th>'
    + '</tr></thead><tbody>'
    + users.map(function(u) {
        return '<tr>'
          + '<td style="font-weight:600">' + esc(u.fullName) + '</td>'
          + '<td>' + esc(u.email) + '</td><td>' + esc(u.phone) + '</td>'
          + '<td>' + esc(u.university) + '</td><td>' + esc(u.program) + '</td>'
          + '<td>' + esc(u.level) + '</td><td>' + formatDate(u.createdAt) + '</td>'
          + '<td><button class="btn btn-danger btn-sm" onclick="deleteUser(\'' + u.id + '\',\'' + esc(u.fullName) + '\')">Delete</button></td>'
          + '</tr>';
      }).join('')
    + '</tbody></table></div>';
}
function deleteUser(id, name) {
  if (!confirm('Delete account for ' + name + '? This cannot be undone.')) return;
  DB.deleteUser(id);
  showToast('User Deleted', name + ' has been removed.', 'success');
  renderAdminUsers();
}

// ── Pricing ────────────────────────────────────────────────────
function renderPricing() {
  const pricing   = DB.getPricing();
  const container = document.getElementById('pricing-list');
  if (!container) return;
  container.innerHTML = pricing.map(function(p) {
    return '<div class="card mb-2"><div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px 20px">'
      + '<div style="font-weight:600;color:var(--green-deep)">' + esc(p.service) + '</div>'
      + '<div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">'
      + '<div><label style="font-size:0.75rem;color:var(--gray-mid);display:block">Min (TZS)</label>'
      + '<input type="number" class="form-control" style="width:130px" id="min-' + p.id + '" value="' + p.minPrice + '"></div>'
      + '<div><label style="font-size:0.75rem;color:var(--gray-mid);display:block">Max (TZS)</label>'
      + '<input type="number" class="form-control" style="width:130px" id="max-' + p.id + '" value="' + p.maxPrice + '"></div>'
      + '<button class="btn btn-primary btn-sm" onclick="savePricing(\'' + p.id + '\')">Save</button>'
      + '</div></div></div>';
  }).join('');
}
function savePricing(id) {
  DB.set('pricing', DB.getPricing().map(function(p) {
    return p.id !== id ? p : Object.assign({}, p, {
      minPrice: Number(document.getElementById('min-'+id).value),
      maxPrice: Number(document.getElementById('max-'+id).value),
    });
  }));
  showToast('Pricing Updated','Price range saved.','success');
}

// ── Ratings ────────────────────────────────────────────────────
function renderRatings() {
  const ratings   = DB.getRatings().slice().reverse();
  const container = document.getElementById('ratings-list');
  if (!container) return;

  if (!ratings.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><div class="empty-title">No ratings yet</div><div class="empty-text">Ratings will appear here once students submit them.</div></div>';
    return;
  }

  const avgStars = (ratings.reduce(function(s,r){return s+(r.stars||0);},0)/ratings.length).toFixed(1);
  setEl('avg-rating-display', avgStars + ' / 5.0 (' + ratings.length + ' total)');

  container.innerHTML = ratings.map(function(r) {
    return '<div class="card mb-2" style="' + (r.approved&&r.visible ? 'border-left:3px solid var(--green-mid)' : 'border-left:3px solid var(--gray-light);opacity:0.75') + '">'
      + '<div class="card-body" style="padding:16px 20px">'
      + '<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:10px">'
      + '<div><div style="font-weight:700;font-size:0.92rem;color:var(--green-deep)">' + esc(r.userName) + '</div>'
      + '<div style="font-size:0.78rem;color:var(--gray-mid)">' + esc(r.userUniversity||'') + ' · ' + esc(r.serviceType||'') + ' · ' + formatDate(r.createdAt) + '</div></div>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">'
      + '<button class="btn btn-sm ' + (r.approved&&r.visible ? 'btn-outline' : 'btn-primary') + '" onclick="toggleRatingVisible(\'' + r.id + '\')">'
      + (r.approved&&r.visible ? '🙈 Hide' : '👁 Show on Site') + '</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteRating(\'' + r.id + '\')">Delete</button>'
      + '</div></div>'
      + '<div style="margin-bottom:8px">' + renderStars(r.stars,'1.1rem') + '</div>'
      + (r.comment ? '<div style="font-size:0.88rem;color:var(--gray-dark);font-style:italic">"' + esc(r.comment) + '"</div>' : '<div style="font-size:0.82rem;color:var(--gray-mid)">No comment</div>')
      + '<div style="margin-top:8px;font-size:0.75rem;color:' + (r.approved&&r.visible ? 'var(--green-rich)' : 'var(--gray-mid)') + '">'
      + (r.approved&&r.visible ? '✅ Visible on landing page' : '⬜ Hidden from public') + '</div>'
      + '</div></div>';
  }).join('');
}
function toggleRatingVisible(id) {
  const r = DB.getRatings().find(function(x){return x.id===id;});
  if (!r) return;
  DB.updateRating(id, { approved: !(r.approved&&r.visible), visible: !(r.approved&&r.visible) });
  renderRatings();
  showToast('Updated', 'Rating visibility changed.', 'success');
}
function deleteRating(id) {
  if (!confirm('Delete this rating? This cannot be undone.')) return;
  DB.deleteRating(id);
  renderRatings();
  showToast('Deleted', 'Rating removed.', 'success');
}

// ── Site Settings ──────────────────────────────────────────────
function renderSettings() {
  const s = DB.getSettings();
  const fields = {
    'set-sitename':    s.siteName,
    'set-tagline':     s.tagline,
    'set-phone':       s.phone,
    'set-whatsapp':    s.whatsapp,
    'set-whatsapp2':   s.whatsapp2,
    'set-email':       s.email,
    'set-address':     s.address,
    'set-hours':       s.hours,
    'set-hero-title':  s.heroTitle   || '',
    'set-hero-sub':    s.heroSubtitle|| '',
    'set-about':       s.aboutText   || '',
  };
  Object.keys(fields).forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.value = fields[id] || '';
  });
}
function saveSettings() {
  const g = function(id) { const el=document.getElementById(id); return el?el.value.trim():''; };
  const updates = {
    siteName:     g('set-sitename'),
    tagline:      g('set-tagline'),
    phone:        g('set-phone'),
    whatsapp:     g('set-whatsapp'),
    whatsapp2:    g('set-whatsapp2'),
    email:        g('set-email'),
    address:      g('set-address'),
    hours:        g('set-hours'),
    heroTitle:    g('set-hero-title'),
    heroSubtitle: g('set-hero-sub'),
    aboutText:    g('set-about'),
  };
  DB.saveSettings(updates);
  showToast('Settings Saved', 'Site information has been updated.', 'success');
}

// ── Account Management ─────────────────────────────────────────
function renderAccountMgmt() {
  // Pre-fill admin fields
  const settings = DB.getSettings();
  const nameEl  = document.getElementById('acct-admin-name');
  const emailEl = document.getElementById('acct-admin-email');
  if (nameEl)  nameEl.value  = adminUser.fullName || '';
  if (emailEl) emailEl.value = adminUser.email    || '';
}

function saveAdminAccount() {
  const newName  = document.getElementById('acct-admin-name').value.trim();
  const newEmail = document.getElementById('acct-admin-email').value.trim().toLowerCase();
  const currPass = document.getElementById('acct-curr-pass').value;
  const newPass  = document.getElementById('acct-new-pass').value;
  const confPass = document.getElementById('acct-conf-pass').value;

  if (!newName || !newEmail) { showToast('Missing Fields','Name and email are required.','warning'); return; }

  const updates = { fullName: newName, email: newEmail };

  if (newPass || currPass) {
    if (!currPass) { showToast('Required','Enter your current password to change it.','warning'); return; }
    const currHash = sha256(currPass + 'mewik_salt_2024');
    if (currHash !== adminUser.passwordHash) { showToast('Wrong Password','Current password is incorrect.','error'); return; }
    if (!newPass) { showToast('Missing','Enter a new password.','warning'); return; }
    if (newPass.length < 6) { showToast('Too Short','Password must be at least 6 characters.','warning'); return; }
    if (newPass !== confPass) { showToast('Mismatch','New passwords do not match.','warning'); return; }
    updates.passwordHash = sha256(newPass + 'mewik_salt_2024');
  }

  DB.updateUser(adminUser.id, updates);
  const updated = DB.getUserById(adminUser.id);
  Session.set(updated);
  adminUser = updated;

  // Clear password fields
  ['acct-curr-pass','acct-new-pass','acct-conf-pass'].forEach(function(id) {
    const el = document.getElementById(id); if (el) el.value = '';
  });

  showToast('Account Updated','Your admin account has been saved.','success');
}

function resetUserPassword(userId) {
  const newPass = document.getElementById('reset-user-pass-' + userId);
  if (!newPass || !newPass.value.trim()) { showToast('Enter Password','Type a new password for this user.','warning'); return; }
  if (newPass.value.trim().length < 6) { showToast('Too Short','Password must be at least 6 characters.','warning'); return; }
  const hash = sha256(newPass.value.trim() + 'mewik_salt_2024');
  DB.updateUser(userId, { passwordHash: hash });
  newPass.value = '';
  showToast('Password Reset','User password has been updated.','success');
}

function renderUserResetList() {
  const users = DB.getUsers().filter(function(u) { return u.role !== 'admin'; });
  const container = document.getElementById('user-reset-list');
  if (!container) return;
  if (!users.length) { container.innerHTML = '<p style="color:var(--gray-mid);font-size:0.88rem">No registered students yet.</p>'; return; }
  container.innerHTML = users.map(function(u) {
    return '<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 0;border-bottom:1px solid var(--gray-light)">'
      + '<div style="flex:1;min-width:160px"><div style="font-weight:600;font-size:0.88rem">' + esc(u.fullName) + '</div>'
      + '<div style="font-size:0.75rem;color:var(--gray-mid)">' + esc(u.email) + '</div></div>'
      + '<input type="password" id="reset-user-pass-' + u.id + '" class="form-control" style="width:180px" placeholder="New password…">'
      + '<button class="btn btn-secondary btn-sm" onclick="resetUserPassword(\'' + u.id + '\')">Reset Password</button>'
      + '</div>';
  }).join('');
}

// ── Modals ─────────────────────────────────────────────────────
function openModal(id) {
  const backdrop = document.getElementById(id + '-modal-backdrop');
  if (backdrop) backdrop.classList.add('open');
}
function closeModal(id) {
  const backdrop = document.getElementById(id + '-modal-backdrop');
  if (backdrop) backdrop.classList.remove('open');
}

// ── Helpers ────────────────────────────────────────────────────
function setEl(id, val) { const el=document.getElementById(id); if(el) el.textContent=val; }

function rebind(id, fn) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.addEventListener('click', fn);
}
