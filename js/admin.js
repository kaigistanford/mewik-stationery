// ============================================================
//  MEWIK STATIONERY — admin.js
//  Admin dashboard: requests, logs, exports, notifications
// ============================================================

'use strict';

let adminUser = null;

document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  adminUser = Session.currentUser();
  if (adminUser.role !== 'admin') {
    window.location.href = 'dashboard.html';
    return;
  }

  // Populate sidebar
  const nameEl = document.querySelector('.sidebar-user-name');
  const initEl = document.querySelector('.sidebar-avatar');
  if (nameEl) nameEl.textContent = adminUser.fullName;
  if (initEl) initEl.textContent = 'A';

  updateNotifDot(adminUser.id);

  const hash = window.location.hash.replace('#', '') || 'overview';
  showAdminSection(hash);

  document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      history.pushState(null, '', `#${section}`);
      showAdminSection(section);
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  document.querySelectorAll('[data-action="logout"]').forEach(b => b.addEventListener('click', logout));
});

// ── Section Switch ─────────────────────────────────────────────
function showAdminSection(name) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.remove('hidden');

  const topTitle = document.querySelector('.topbar-title');
  const titles = {
    overview:  'Admin Overview',
    requests:  'All Requests',
    logs:      'System Logs',
    users:     'Registered Users',
    pricing:   'Pricing Configuration',
  };
  if (topTitle) topTitle.textContent = titles[name] || 'Admin';

  if (name === 'overview')  renderAdminOverview();
  if (name === 'requests')  renderAdminRequests();
  if (name === 'logs')      renderAdminLogs();
  if (name === 'users')     renderAdminUsers();
  if (name === 'pricing')   renderPricing();
}

// ── Overview ──────────────────────────────────────────────────
function renderAdminOverview() {
  const reqs = DB.getRequests();
  const active    = reqs.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled');
  const completed = reqs.filter(r => r.status === 'Completed');
  const revenue   = completed.reduce((sum, r) => sum + (Number(r.price) || 0), 0);
  const users     = DB.getUsers().filter(u => u.role !== 'admin');

  setEl('admin-stat-total',     reqs.length);
  setEl('admin-stat-active',    active.length);
  setEl('admin-stat-completed', completed.length);
  setEl('admin-stat-revenue',   `TZS ${revenue.toLocaleString()}`);
  setEl('admin-stat-users',     users.length);

  // Recent 5 requests
  const recent = reqs.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const listEl = document.getElementById('admin-recent-list');
  if (listEl) {
    listEl.innerHTML = recent.length ? `
      <div class="table-wrapper">
        <table>
          <thead><tr><th>ID</th><th>Student</th><th>Service</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${recent.map(r => `<tr>
              <td><span style="font-family:var(--font-mono);font-size:0.75rem">${esc(r.id)}</span></td>
              <td>${esc(r.userName)}</td>
              <td>${esc(r.serviceType)}</td>
              <td>${formatDate(r.createdAt)}</td>
              <td>${statusBadge(r.status)}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="openRequestEdit('${r.id}')">Manage</button></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : `<div class="empty-state"><div class="empty-icon">📬</div><div class="empty-title">No requests yet</div></div>`;
  }
}

// ── All Requests ──────────────────────────────────────────────
let requestFilter = 'all';

function renderAdminRequests() {
  const reqs = DB.getRequests()
    .filter(r => requestFilter === 'all' || r.status === requestFilter)
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = document.getElementById('admin-requests-list');
  if (!container) return;

  // Filter tabs
  const filterBar = document.getElementById('req-filter-bar');
  if (filterBar && !filterBar.dataset.init) {
    filterBar.dataset.init = '1';
    const filters = ['all', 'Submitted', 'Under Review', 'In Progress', 'Quality Check', 'Completed'];
    filterBar.innerHTML = filters.map(f => `
      <button class="filter-tab ${f === requestFilter ? 'active' : ''}" onclick="setReqFilter('${f}')">${f === 'all' ? 'All' : f}</button>`).join('');
  }

  if (!reqs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">No requests</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Request ID</th><th>Student</th><th>University</th><th>Service</th>
          <th>Deadline</th><th>Status</th><th>Price</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${reqs.map(r => `<tr>
            <td><span style="font-family:var(--font-mono);font-size:0.75rem">${esc(r.id)}</span></td>
            <td>
              <div style="font-weight:600;font-size:0.88rem">${esc(r.userName)}</div>
              <div style="font-size:0.75rem;color:var(--gray-mid)">${esc(r.userEmail)}</div>
            </td>
            <td style="font-size:0.82rem">${esc(r.university || '—')}</td>
            <td style="font-size:0.85rem;max-width:160px">${esc(r.serviceType)}</td>
            <td style="font-size:0.82rem">${formatDate(r.deadline)}</td>
            <td>${statusBadge(r.status)}</td>
            <td style="font-family:var(--font-mono);font-size:0.82rem">${r.price ? 'TZS '+Number(r.price).toLocaleString() : '—'}</td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <button class="btn btn-secondary btn-sm" onclick="openRequestEdit('${r.id}')">✏️ Manage</button>
                ${r.requirements ? `<button class="btn btn-outline btn-sm" onclick="downloadRequirements('${r.id}')">⬇ Req</button>` : ''}
              </div>
            </td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function setReqFilter(f) {
  requestFilter = f;
  document.querySelectorAll('.filter-tab').forEach(t => {
    t.classList.toggle('active', t.textContent === f || (f === 'all' && t.textContent === 'All'));
  });
  renderAdminRequests();
}

// ── Open Request Edit Modal ───────────────────────────────────
function openRequestEdit(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;

  const modal = document.getElementById('edit-request-modal');
  if (!modal) return;

  // Populate fields
  setEl('edit-req-id', req.id);
  setEl('edit-req-student', `${req.userName} (${req.userEmail})`);
  setEl('edit-req-service', req.serviceType);
  setEl('edit-req-deadline', formatDate(req.deadline));
  setEl('edit-req-description', req.description || '—');
  setEl('edit-req-requirements-text', req.requirements || '—');

  document.getElementById('edit-status').value      = req.status || 'Submitted';
  document.getElementById('edit-price').value       = req.price || '';
  document.getElementById('edit-payment').value     = req.paymentStatus || 'Pending';
  document.getElementById('edit-admin-notes').value = req.adminNotes || '';
  document.getElementById('edit-delivery-link').value = req.deliveryFile || '';

  const saveBtn = document.getElementById('save-request-btn');
  if (saveBtn) {
    saveBtn.onclick = () => saveRequestEdits(req.id);
  }

  const notifBtn = document.getElementById('send-notif-btn');
  if (notifBtn) notifBtn.onclick = () => sendUserNotif(req);

  openModal('edit-request');
}

function saveRequestEdits(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;

  const newStatus   = document.getElementById('edit-status').value;
  const price       = document.getElementById('edit-price').value;
  const payment     = document.getElementById('edit-payment').value;
  const adminNotes  = document.getElementById('edit-admin-notes').value.trim();
  const deliveryFile= document.getElementById('edit-delivery-link').value.trim();

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
  const logs = DB.getLogs().map(l =>
    l.requestId === reqId ? { ...l, status: newStatus, price: updates.price, completedAt: updates.completedAt || l.completedAt } : l
  );
  DB.saveLogs(logs);

  // Notify student
  const notifMessages = {
    'Under Review':  '📋 Your request is now under review.',
    'In Progress':   '⚙️ We have started working on your request.',
    'Quality Check': '🔍 Your work is in final quality check.',
    'Completed':     deliveryFile ? '🎉 Your work is complete! Download it now.' : '🎉 Your request has been completed!',
  };
  if (notifMessages[newStatus]) {
    DB.addNotif({
      id:        generateId('NTF'),
      userId:    req.userId,
      title:     `Status Update: ${newStatus}`,
      message:   notifMessages[newStatus],
      createdAt: new Date().toISOString(),
      read:      false,
    });
  }

  closeModal('edit-request');
  showToast('Request Updated', `Status changed to: ${newStatus}`, 'success');
  renderAdminRequests();
}

function sendUserNotif(req) {
  const msg = document.getElementById('custom-notif-msg')?.value?.trim();
  if (!msg) { showToast('Missing', 'Enter a message to send.', 'warning'); return; }

  DB.addNotif({
    id:        generateId('NTF'),
    userId:    req.userId,
    title:     '💬 Message from Mewik Admin',
    message:   msg,
    createdAt: new Date().toISOString(),
    read:      false,
  });
  showToast('Notification Sent', `Message sent to ${req.userName}.`, 'success');
  document.getElementById('custom-notif-msg').value = '';
}

function downloadRequirements(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;
  const content = `MEWIK STATIONERY — Student Requirements
========================================
Request ID:   ${req.id}
Student:      ${req.userName}
Email:        ${req.userEmail}
Phone:        ${req.userPhone || '—'}
University:   ${req.university || '—'}
Program:      ${req.program || '—'}
Service:      ${req.serviceType}
Deadline:     ${formatDate(req.deadline)}
Submitted:    ${formatDateTime(req.createdAt)}

DESCRIPTION
-----------
${req.description || '—'}

SPECIFIC REQUIREMENTS
---------------------
${req.requirements || '—'}
`;
  const blob = new Blob([content], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `requirements-${req.id}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Logs ─────────────────────────────────────────────────────
function renderAdminLogs() {
  const logs = DB.getLogs().slice().reverse();
  const container = document.getElementById('logs-list');
  if (!container) return;

  if (!logs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No logs yet</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Request ID</th><th>Student</th><th>Service</th>
          <th>Submitted</th><th>Completed</th><th>Price (TZS)</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${logs.map(l => `<tr>
            <td><span style="font-family:var(--font-mono);font-size:0.75rem">${esc(l.requestId)}</span></td>
            <td>${esc(l.userName)}</td>
            <td>${esc(l.serviceType)}</td>
            <td>${formatDate(l.submittedAt)}</td>
            <td>${formatDate(l.completedAt)}</td>
            <td>${l.price ? Number(l.price).toLocaleString() : '—'}</td>
            <td>${statusBadge(l.status)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function exportAllLogs() {
  const logs = DB.getLogs();
  if (!logs.length) { showToast('No Data', 'No logs to export.', 'warning'); return; }
  const data = logs.map(l => ({
    'Request ID':      l.requestId,
    'Student Name':    l.userName,
    'Service':         l.serviceType,
    'Submission Date': formatDate(l.submittedAt),
    'Completion Date': formatDate(l.completedAt),
    'Price (TZS)':     l.price || '',
    'Status':          l.status,
  }));
  exportToExcel(data, `mewik-logs-${new Date().toISOString().slice(0,10)}.xlsx`, 'Logs');
  showToast('Exported', 'Logs exported to Excel.', 'success');
}

// ── Users ─────────────────────────────────────────────────────
function renderAdminUsers() {
  const users = DB.getUsers().filter(u => u.role !== 'admin');
  const container = document.getElementById('users-list');
  if (!container) return;

  if (!users.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-title">No registered users</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Name</th><th>Email</th><th>Phone</th><th>University</th><th>Program</th><th>Level</th><th>Joined</th>
        </tr></thead>
        <tbody>
          ${users.map(u => `<tr>
            <td style="font-weight:600">${esc(u.fullName)}</td>
            <td>${esc(u.email)}</td>
            <td>${esc(u.phone)}</td>
            <td>${esc(u.university)}</td>
            <td>${esc(u.program)}</td>
            <td>${esc(u.level)}</td>
            <td>${formatDate(u.createdAt)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Pricing ───────────────────────────────────────────────────
function renderPricing() {
  const pricing = DB.getPricing();
  const container = document.getElementById('pricing-list');
  if (!container) return;

  container.innerHTML = pricing.map(p => `
    <div class="card mb-2">
      <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:16px 20px">
        <div style="font-weight:600;color:var(--green-deep)">${esc(p.service)}</div>
        <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
          <div>
            <label style="font-size:0.75rem;color:var(--gray-mid);display:block">Min (TZS)</label>
            <input type="number" class="form-control" style="width:130px" id="min-${p.id}" value="${p.minPrice}">
          </div>
          <div>
            <label style="font-size:0.75rem;color:var(--gray-mid);display:block">Max (TZS)</label>
            <input type="number" class="form-control" style="width:130px" id="max-${p.id}" value="${p.maxPrice}">
          </div>
          <button class="btn btn-primary btn-sm" onclick="savePricing('${p.id}')">Save</button>
        </div>
      </div>
    </div>`).join('');
}

function savePricing(id) {
  const pricing = DB.getPricing().map(p => {
    if (p.id !== id) return p;
    return {
      ...p,
      minPrice: Number(document.getElementById(`min-${id}`).value),
      maxPrice: Number(document.getElementById(`max-${id}`).value),
    };
  });
  DB.set('pricing', pricing);
  showToast('Pricing Updated', 'Price range saved successfully.', 'success');
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) {
  const backdrop = document.getElementById(`${id}-modal-backdrop`);
  if (backdrop) backdrop.classList.add('open');
}
function closeModal(id) {
  const backdrop = document.getElementById(`${id}-modal-backdrop`);
  if (backdrop) backdrop.classList.remove('open');
}

// ── Utility ───────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
