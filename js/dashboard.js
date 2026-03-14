// ============================================================
//  MEWIK STATIONERY — dashboard.js
//  Student dashboard: requests, progress, downloads
// ============================================================

'use strict';

let currentUser = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!requireLogin()) return;
  currentUser = Session.currentUser();
  if (currentUser.role === 'admin') {
    window.location.href = 'admin.html';
    return;
  }

  // Populate sidebar user info
  const nameEl = document.querySelector('.sidebar-user-name');
  const initEl = document.querySelector('.sidebar-avatar');
  if (nameEl) nameEl.textContent = currentUser.fullName;
  if (initEl) initEl.textContent = currentUser.fullName.charAt(0).toUpperCase();

  // Topbar greeting
  const greetEl = document.getElementById('greeting-name');
  if (greetEl) greetEl.textContent = currentUser.fullName.split(' ')[0];

  // Update notif dot
  updateNotifDot(currentUser.id);
  renderNotifPanel(currentUser.id);

  // Load active section based on hash
  const hash = window.location.hash.replace('#', '') || 'overview';
  showSection(hash);

  // Nav links
  document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const section = link.dataset.section;
      history.pushState(null, '', `#${section}`);
      showSection(section);
      document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Logout
  document.querySelectorAll('[data-action="logout"]').forEach(b => b.addEventListener('click', logout));

  // Request form
  const reqForm = document.getElementById('request-form');
  if (reqForm) reqForm.addEventListener('submit', handleRequestSubmit);

  // Profile form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) profileForm.addEventListener('submit', handleProfileUpdate);
});

// ── Section Switch ─────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.dash-section').forEach(s => s.classList.add('hidden'));
  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.remove('hidden');

  const topTitle = document.querySelector('.topbar-title');
  const titles = {
    overview: 'Dashboard Overview',
    requests: 'My Requests',
    'new-request': 'New Service Request',
    history:  'Service History',
    profile:  'My Profile',
  };
  if (topTitle) topTitle.textContent = titles[name] || 'Dashboard';

  // Render section content
  if (name === 'overview')     renderOverview();
  if (name === 'requests')     renderRequests();
  if (name === 'new-request')  initRequestForm();
  if (name === 'history')      renderHistory();
  if (name === 'profile')      initProfileForm();
}

// ── Overview ──────────────────────────────────────────────────
function renderOverview() {
  const reqs = DB.getRequestsByUser(currentUser.id).filter(r => !r.hiddenFromUser);
  const active = reqs.filter(r => r.status !== 'Completed' && r.status !== 'Cancelled');
  const completed = reqs.filter(r => r.status === 'Completed');

  setEl('stat-active',    active.length);
  setEl('stat-completed', completed.length);
  setEl('stat-total',     reqs.length);

  // Recent requests (last 5)
  const recent = reqs.slice().sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentEl = document.getElementById('recent-requests');
  if (!recentEl) return;

  if (!recent.length) {
    recentEl.innerHTML = `<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No requests yet</div><div class="empty-text">Submit your first service request to get started.</div></div>`;
    return;
  }

  recentEl.innerHTML = recent.map(r => `
    <div class="request-row" onclick="showRequestDetail('${r.id}')">
      <div class="req-info">
        <div class="req-id">${esc(r.id)}</div>
        <div class="req-service">${esc(r.serviceType)}</div>
        <div class="req-date">${formatDate(r.createdAt)}</div>
      </div>
      <div class="req-right">
        ${statusBadge(r.status)}
        ${r.status === 'Completed' && r.deliveryFile ?
          `<a href="${r.deliveryFile}" target="_blank" class="btn btn-primary btn-sm mt-1">⬇ Download PDF</a>` : ''}
      </div>
    </div>
  `).join('');

  // Notifications panel
  const notifs = DB.getNotifs(currentUser.id).slice().reverse().slice(0, 3);
  const notifEl = document.getElementById('recent-notifs');
  if (notifEl) {
    notifEl.innerHTML = notifs.length ? notifs.map(n => `
      <div class="notif-item ${n.read ? '' : 'unread'}">
        <div class="notif-item-title">${esc(n.title)}</div>
        <div class="notif-item-text">${esc(n.message)}</div>
        <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
      </div>
    `).join('') : '<div class="notif-item"><div class="notif-item-text" style="padding:12px 0;text-align:center">No notifications</div></div>';
  }
}

// ── My Requests ───────────────────────────────────────────────
function renderRequests() {
  const reqs = DB.getRequestsByUser(currentUser.id)
    .filter(r => !r.hiddenFromUser && r.status !== 'Completed')
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  const container = document.getElementById('active-requests-list');
  if (!container) return;

  if (!reqs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No active requests</div><div class="empty-text">Submit a new request to get started.</div></div>`;
    return;
  }

  container.innerHTML = reqs.map(r => {
    const pct = getProgressPct(r.status);
    return `
      <div class="card mb-3">
        <div class="card-body">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px;">
            <div>
              <div style="font-family:var(--font-mono);font-size:0.78rem;color:var(--gray-mid);margin-bottom:4px;">${esc(r.id)}</div>
              <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:600;color:var(--green-deep)">${esc(r.serviceType)}</div>
              <div style="font-size:0.82rem;color:var(--gray-mid);margin-top:2px;">Submitted: ${formatDate(r.createdAt)} · Deadline: ${formatDate(r.deadline)}</div>
            </div>
            <div>${statusBadge(r.status)}</div>
          </div>

          <div class="progress-steps">
            ${PROGRESS_STAGES.map((stage, i) => {
              const stageIdx = PROGRESS_STAGES.indexOf(r.status);
              const cls = i < stageIdx ? 'done' : (i === stageIdx ? 'active' : '');
              return `
                <div class="progress-step">
                  <div class="step-dot ${cls}">${i < stageIdx ? '✓' : i+1}</div>
                  <div class="step-label ${cls}">${stage}</div>
                </div>`;
            }).join('')}
          </div>

          <div class="progress-wrap" style="margin:12px 0 16px">
            <div class="progress-bar" style="width:${pct}%"></div>
          </div>

          ${r.adminNotes ? `<div style="background:var(--cream);border-left:3px solid var(--gold);padding:10px 14px;border-radius:6px;font-size:0.85rem;color:var(--gray-dark);margin-bottom:14px;"><strong>Admin Note:</strong> ${esc(r.adminNotes)}</div>` : ''}

          ${r.price ? `<div style="font-size:0.82rem;color:var(--gray-mid)">Price: <strong style="color:var(--green-rich)">TZS ${Number(r.price).toLocaleString()}</strong> · Payment: <strong>${esc(r.paymentStatus)}</strong></div>` : ''}
        </div>
      </div>`;
  }).join('');
}

// ── History ───────────────────────────────────────────────────
function renderHistory() {
  const reqs = DB.getRequestsByUser(currentUser.id)
    .filter(r => r.status === 'Completed' && !r.hiddenFromUser)
    .sort((a,b) => new Date(b.completedAt || b.createdAt) - new Date(a.completedAt || a.createdAt));

  const container = document.getElementById('history-list');
  if (!container) return;

  if (!reqs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">No completed work yet</div><div class="empty-text">Completed requests appear here for 3 days.</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="table-wrapper">
      <table>
        <thead><tr>
          <th>Request ID</th><th>Service</th><th>Submitted</th><th>Completed</th><th>Price (TZS)</th><th>Download</th><th>Rating</th>
        </tr></thead>
        <tbody>
          ${reqs.map(r => {
            const alreadyRated = DB.getRatingByRequestId(r.id);
            return `<tr>
              <td><span style="font-family:var(--font-mono);font-size:0.78rem">${esc(r.id)}</span></td>
              <td>${esc(r.serviceType)}</td>
              <td>${formatDate(r.createdAt)}</td>
              <td>${formatDate(r.completedAt)}</td>
              <td>${r.price ? Number(r.price).toLocaleString() : '—'}</td>
              <td>${r.deliveryFile ? `<a href="${r.deliveryFile}" target="_blank" class="btn btn-primary btn-sm">⬇ PDF</a>` : '—'}</td>
              <td>${alreadyRated
                ? `<span style="color:var(--gold)">${renderStars(alreadyRated.stars,'0.9rem')}</span>`
                : `<button class="btn btn-outline btn-sm" onclick="openRatingModal('${r.id}')">⭐ Rate</button>`
              }</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Request Form ──────────────────────────────────────────────
function initRequestForm() {
  const services = DB.getServices();
  const pricing  = DB.getPricing();
  const svcSel = document.getElementById('req-service');
  if (!svcSel) return;

  svcSel.innerHTML = '<option value="">— Select a service —</option>' +
    services.map(s => `<option value="${s.name}">${s.icon} ${s.name}</option>`).join('');

  // Research sub-option toggle
  svcSel.addEventListener('change', () => {
    const researchOpts = document.getElementById('research-options');
    if (researchOpts) {
      researchOpts.style.display = svcSel.value === 'Research Assistance' ? 'block' : 'none';
    }
    // Show price range
    const pricingEl = document.getElementById('price-range');
    if (pricingEl) {
      const svcName = svcSel.value;
      const match = pricing.find(p => p.service.toLowerCase().includes(svcName.split(' ')[0].toLowerCase()));
      pricingEl.textContent = match ? `Estimated: TZS ${match.minPrice.toLocaleString()} – ${match.maxPrice.toLocaleString()}` : '';
    }
  });

  // File upload
  initFileUpload('req-files', 'file-list');
}

function handleRequestSubmit(e) {
  e.preventDefault();
  const serviceType = document.getElementById('req-service').value;
  const description = document.getElementById('req-description').value.trim();
  const requirements= document.getElementById('req-requirements').value.trim();
  const deadline    = document.getElementById('req-deadline').value;
  const researchStage = document.getElementById('research-stage')?.value;

  if (!serviceType) { showToast('Missing Field', 'Please select a service type.', 'warning'); return; }
  if (!description)  { showToast('Missing Field', 'Please describe your requirements.', 'warning'); return; }
  if (!deadline)     { showToast('Missing Field', 'Please set a deadline.', 'warning'); return; }

  const finalService = serviceType === 'Research Assistance' && researchStage
    ? `Research Assistance — ${researchStage}` : serviceType;

  const req = {
    id:            generateId('REQ'),
    userId:        currentUser.id,
    userName:      currentUser.fullName,
    userEmail:     currentUser.email,
    userPhone:     currentUser.phone,
    university:    currentUser.university,
    program:       currentUser.program,
    serviceType:   finalService,
    description,
    requirements,
    deadline,
    status:        'Submitted',
    adminNotes:    '',
    price:         null,
    paymentStatus: 'Pending',
    deliveryFile:  null,
    createdAt:     new Date().toISOString(),
    completedAt:   null,
    hiddenFromUser: false,
  };

  DB.addRequest(req);

  // Admin log
  DB.addLog({
    id:            generateId('LOG'),
    requestId:     req.id,
    userName:      currentUser.fullName,
    serviceType:   finalService,
    submittedAt:   req.createdAt,
    completedAt:   null,
    price:         null,
    status:        'Submitted',
  });

  // Notification to user
  DB.addNotif({
    id:        generateId('NTF'),
    userId:    currentUser.id,
    title:     '✅ Request Submitted',
    message:   `Your request for "${finalService}" has been submitted. We will review it shortly.`,
    createdAt: new Date().toISOString(),
    read:      false,
  });

  showToast('Request Submitted!', `Your request ID is ${req.id}.`, 'success');
  document.getElementById('request-form').reset();

  setTimeout(() => {
    showSection('requests');
    history.pushState(null, '', '#requests');
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelector('.sidebar-link[data-section="requests"]')?.classList.add('active');
  }, 1200);
}

// ── File Upload ───────────────────────────────────────────────
function initFileUpload(inputId, listId) {
  const zone = document.querySelector('.upload-zone');
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  if (!zone || !input || !list) return;

  let files = [];

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag-over'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
  });
  input.addEventListener('change', () => addFiles(Array.from(input.files)));

  function addFiles(newFiles) {
    files = [...files, ...newFiles];
    renderFiles();
  }
  function renderFiles() {
    list.innerHTML = files.map((f, i) => `
      <div class="file-item">
        <span class="file-item-icon">${fileIcon(f.name)}</span>
        <span class="file-item-name">${esc(f.name)}</span>
        <span class="file-item-size">${formatBytes(f.size)}</span>
        <span class="file-remove" onclick="removeFile(${i})">✕</span>
      </div>`).join('');
  }
  window.removeFile = (i) => { files.splice(i, 1); renderFiles(); };
}

function fileIcon(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['pdf'].includes(ext)) return '📕';
  if (['doc','docx'].includes(ext)) return '📘';
  if (['jpg','jpeg','png','gif'].includes(ext)) return '🖼️';
  if (['zip','rar'].includes(ext)) return '🗜️';
  return '📄';
}
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes/1024).toFixed(1) + ' KB';
  return (bytes/1048576).toFixed(1) + ' MB';
}

// ── Profile Form ──────────────────────────────────────────────
function initProfileForm() {
  const user = Session.currentUser();
  if (!user) return;
  const fields = { 'profile-name': user.fullName, 'profile-phone': user.phone,
    'profile-university': user.university, 'profile-program': user.program };
  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  }
  const lvl = document.getElementById('profile-level');
  if (lvl) lvl.value = user.level || '';
}

// ── Request Detail Modal ───────────────────────────────────────
function showRequestDetail(reqId) {
  const req = DB.getRequestById(reqId);
  if (!req) return;

  const pct = getProgressPct(req.status);
  const modal = document.getElementById('request-modal');
  if (!modal) return;

  document.getElementById('modal-req-id').textContent    = req.id;
  document.getElementById('modal-req-service').textContent = req.serviceType;
  document.getElementById('modal-req-status').innerHTML  = statusBadge(req.status);
  document.getElementById('modal-req-desc').textContent  = req.description || '—';
  document.getElementById('modal-req-deadline').textContent = formatDate(req.deadline);
  document.getElementById('modal-req-submitted').textContent = formatDateTime(req.createdAt);
  document.getElementById('modal-req-notes').textContent = req.adminNotes || 'No notes yet.';
  document.getElementById('modal-req-price').textContent = req.price ? `TZS ${Number(req.price).toLocaleString()}` : 'Not quoted yet';
  document.getElementById('modal-req-payment').textContent = req.paymentStatus || '—';

  const progressEl = document.getElementById('modal-progress');
  if (progressEl) progressEl.style.width = `${pct}%`;

  const dlBtn = document.getElementById('modal-download-btn');
  if (dlBtn) {
    if (req.deliveryFile) {
      dlBtn.href = req.deliveryFile;
      dlBtn.style.display = 'inline-flex';
    } else {
      dlBtn.style.display = 'none';
    }
  }

  openModal('request-modal');
}

// ── Modal Helpers ─────────────────────────────────────────────
function openModal(id) {
  const backdrop = document.getElementById(`${id}-backdrop`);
  if (backdrop) backdrop.classList.add('open');
}
function closeModal(id) {
  const backdrop = document.getElementById(`${id}-backdrop`);
  if (backdrop) backdrop.classList.remove('open');
}

// ── Utility ───────────────────────────────────────────────────
function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}
