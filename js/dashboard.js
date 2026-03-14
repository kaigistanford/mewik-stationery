// ============================================================
//  MEWIK STATIONERY — dashboard.js  v4.0
//  Student dashboard — polls for live sync every 12s
// ============================================================
'use strict';

let currentUser  = null;
let myRequests   = [];
let currentRatingReqId = null;
let currentStars = 0;
const starLabels = ['','Poor','Fair','Good','Very Good','Excellent'];

document.addEventListener('DOMContentLoaded', async function() {
  if (!requireLogin()) return;
  currentUser = Session.currentUser();
  if (currentUser.role === 'admin') { window.location.href = 'admin.html'; return; }

  const nameEl = document.querySelector('.sidebar-user-name');
  const initEl = document.querySelector('.sidebar-avatar');
  if (nameEl) nameEl.textContent = currentUser.fullName;
  if (initEl) initEl.textContent = currentUser.fullName.charAt(0).toUpperCase();

  // Load my requests
  myRequests = await DB.getRequestsByUser(currentUser.id).catch(() => []);
  await updateNotifDot(currentUser.id);

  // Start polling — refresh every 12s
  startPolling(async function() {
    const fresh = await DB.getRequestsByUser(currentUser.id).catch(() => []);
    // Check if anything changed
    if (JSON.stringify(fresh) !== JSON.stringify(myRequests)) {
      myRequests = fresh;
      refreshCurrentSection();
    }
    await updateNotifDot(currentUser.id);
  });

  // Nav links
  document.querySelectorAll('.sidebar-link[data-section]').forEach(function(link) {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const sec = link.dataset.section;
      history.pushState(null, '', '#' + sec);
      showSection(sec);
      document.querySelectorAll('.sidebar-link').forEach(function(l){l.classList.remove('active');});
      link.classList.add('active');
    });
  });
  document.querySelectorAll('[data-action="logout"]').forEach(function(b){ b.addEventListener('click', logout); });

  const hash = window.location.hash.replace('#','') || 'overview';
  showSection(hash);

  // Set min deadline to tomorrow
  const dl = document.getElementById('req-deadline');
  if (dl) { const t=new Date(); t.setDate(t.getDate()+1); dl.min=t.toISOString().split('T')[0]; }

  // Rating prompt after 2s
  setTimeout(checkRatingPrompt, 2000);
});

function refreshCurrentSection() {
  const active = document.querySelector('.dash-section:not(.hidden)');
  if (!active) return;
  const id = active.id.replace('section-','');
  if (id==='overview') renderOverview();
  if (id==='requests') renderRequests();
  if (id==='history')  renderHistory();
}

// ── Sections ──────────────────────────────────────────────────
function showSection(name) {
  document.querySelectorAll('.dash-section').forEach(function(s){s.classList.add('hidden');});
  const sec = document.getElementById('section-'+name);
  if (sec) sec.classList.remove('hidden');
  const titles = {overview:'Dashboard Overview',requests:'My Requests','new-request':'New Service Request',history:'Service History',profile:'My Profile'};
  const t = document.querySelector('.topbar-title'); if(t) t.textContent = titles[name]||'Dashboard';
  if (name==='overview')    renderOverview();
  if (name==='requests')    renderRequests();
  if (name==='new-request') initRequestForm();
  if (name==='history')     renderHistory();
  if (name==='profile')     initProfileForm();
}

// ── Overview ──────────────────────────────────────────────────
function renderOverview() {
  const reqs      = myRequests.filter(function(r){return !r.hiddenFromUser;});
  const active    = reqs.filter(function(r){return r.status!=='Completed'&&r.status!=='Cancelled';});
  const completed = reqs.filter(function(r){return r.status==='Completed';});
  setEl('stat-active',    active.length);
  setEl('stat-completed', completed.length);
  setEl('stat-total',     reqs.length);
  const greet = document.getElementById('greeting-name');
  if (greet) greet.textContent = currentUser.fullName.split(' ')[0];

  // Recent notifs async
  DB.getNotifs(currentUser.id).then(function(notifs){
    const el = document.getElementById('recent-notifs'); if(!el)return;
    const recent = notifs.slice(0,4);
    el.innerHTML = recent.length
      ? recent.map(function(n){return '<div class="notif-item '+(n.read?'':'unread')+'"><div class="notif-item-title">'+esc(n.title)+'</div><div class="notif-item-text">'+esc(n.message)+'</div><div class="notif-item-time">'+timeAgo(n.createdAt)+'</div></div>';}).join('')
      : '<div class="notif-item"><div class="notif-item-text" style="padding:14px;text-align:center;color:var(--gray-400)">No notifications yet</div></div>';
  }).catch(function(){});

  const recentEl = document.getElementById('recent-requests'); if(!recentEl)return;
  const recent = reqs.slice().sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);}).slice(0,5);
  if (!recent.length) {
    recentEl.innerHTML='<div class="empty-state"><div class="empty-icon">📄</div><div class="empty-title">No requests yet</div><div class="empty-text">Submit your first service request to get started.</div></div>';
    return;
  }
  recentEl.innerHTML = recent.map(function(r){
    return '<div class="request-row" onclick="showRequestDetail(\''+r.id+'\')">'
      +'<div class="req-info"><div class="req-id">'+esc(r.id)+'</div><div class="req-service">'+esc(r.serviceType)+'</div><div class="req-date">'+formatDate(r.createdAt)+'</div></div>'
      +'<div class="req-right">'+statusBadge(r.status)
      +(r.status==='Completed'&&r.deliveryFile?'<button class="btn btn-download btn-sm" onclick="event.stopPropagation();triggerDownload(\''+r.id+'\')">⬇ Download</button>':'')
      +'</div></div>';
  }).join('');
}

// ── Active Requests ───────────────────────────────────────────
function renderRequests() {
  const reqs = myRequests.filter(function(r){return !r.hiddenFromUser&&r.status!=='Completed';})
    .sort(function(a,b){return new Date(b.createdAt)-new Date(a.createdAt);});
  const container = document.getElementById('active-requests-list'); if(!container)return;
  if (!reqs.length) {
    container.innerHTML='<div class="empty-state"><div class="empty-icon">📋</div><div class="empty-title">No active requests</div><div class="empty-text">Submit a new request to get started.</div></div>';
    return;
  }
  container.innerHTML = reqs.map(function(r){
    const pct = getProgressPct(r.status);
    return '<div class="card mb-3"><div class="card-body">'
      +'<div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:16px">'
      +'<div><div style="font-family:var(--font-mono);font-size:0.72rem;color:var(--gray-400);margin-bottom:3px">'+esc(r.id)+'</div>'
      +'<div style="font-family:var(--font-display);font-size:1.05rem;font-weight:600;color:var(--gray-900)">'+esc(r.serviceType)+'</div>'
      +'<div style="font-size:0.78rem;color:var(--gray-400);margin-top:2px">Submitted: '+formatDate(r.createdAt)+' · Deadline: '+formatDate(r.deadline)+'</div></div>'
      +statusBadge(r.status)+'</div>'
      +'<div class="progress-steps">'
      +PROGRESS_STAGES.map(function(stage,i){
          const si=PROGRESS_STAGES.indexOf(r.status),cls=i<si?'done':(i===si?'active':'');
          return '<div class="progress-step"><div class="step-dot '+cls+'">'+(i<si?'✓':i+1)+'</div><div class="step-label '+cls+'">'+stage+'</div></div>';
        }).join('')
      +'</div>'
      +'<div class="progress-wrap" style="margin:10px 0 14px"><div class="progress-bar" style="width:'+pct+'%"></div></div>'
      +(r.adminNotes?'<div style="background:var(--navy-50);border-left:3px solid var(--navy-600);padding:9px 13px;border-radius:6px;font-size:0.84rem;margin-bottom:12px"><strong>Admin Note:</strong> '+esc(r.adminNotes)+'</div>':'')
      +(r.price?'<div style="font-size:0.8rem;color:var(--gray-500)">Price: <strong style="color:var(--navy-800)">TZS '+Number(r.price).toLocaleString()+'</strong> · Payment: <strong>'+esc(r.paymentStatus)+'</strong></div>':'')
      +'</div></div>';
  }).join('');
}

// ── History ───────────────────────────────────────────────────
async function renderHistory() {
  const reqs = myRequests.filter(function(r){return r.status==='Completed'&&!r.hiddenFromUser;})
    .sort(function(a,b){return new Date(b.completedAt||b.createdAt)-new Date(a.completedAt||a.createdAt);});
  const container = document.getElementById('history-list'); if(!container)return;
  if (!reqs.length) {
    container.innerHTML='<div class="empty-state"><div class="empty-icon">🏆</div><div class="empty-title">No completed work yet</div><div class="empty-text">Completed requests appear here for 3 days.</div></div>';
    return;
  }
  const rows = await Promise.all(reqs.map(async function(r){
    const rated = await DB.getRatingByRequestId(r.id).catch(()=>null);
    return '<tr>'
      +'<td><span style="font-family:var(--font-mono);font-size:0.72rem">'+esc(r.id)+'</span></td>'
      +'<td>'+esc(r.serviceType)+'</td>'
      +'<td>'+formatDate(r.createdAt)+'</td>'
      +'<td>'+formatDate(r.completedAt)+'</td>'
      +'<td>'+(r.price?Number(r.price).toLocaleString():'—')+'</td>'
      +'<td>'+(r.deliveryFile
          ?'<button class="btn btn-download btn-sm" onclick="triggerDownload(\''+r.id+'\')">⬇ Download</button>'
          :'<span style="color:var(--gray-400);font-size:0.82rem">Pending</span>')
      +'</td>'
      +'<td>'+(rated
          ?'<span>'+renderStars(rated.stars,'0.85rem')+'</span>'
          :'<button class="btn btn-warning btn-sm" onclick="openRatingModal(\''+r.id+'\')">⭐ Rate</button>')
      +'</td></tr>';
  }));
  container.innerHTML='<div class="table-wrapper"><table><thead><tr><th>Request ID</th><th>Service</th><th>Submitted</th><th>Completed</th><th>Price (TZS)</th><th>Download</th><th>Rating</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
}

// ── Direct Download via Google Drive link ─────────────────────
function triggerDownload(reqId) {
  const req = myRequests.find(function(r){return r.id===reqId;});
  if (!req || !req.deliveryFile) { showToast('Not Ready','The file is not available yet.','warning'); return; }
  const ext = (req.deliveryFile.match(/\.([a-z]+)(?:\?|$)/i)||[])[1] || 'pdf';
  const filename = (req.serviceType||'completed-work').replace(/[^a-z0-9]/gi,'_').toLowerCase()+'.'+ext;
  downloadFile(req.deliveryFile, filename);
}

// ── Request Form ──────────────────────────────────────────────
async function initRequestForm() {
  const services = await DB.getServices().catch(()=>[]);
  const pricing  = await DB.getPricing().catch(()=>[]);
  const svcSel   = document.getElementById('req-service'); if(!svcSel)return;
  svcSel.innerHTML = '<option value="">— Select a service —</option>'
    + services.map(function(s){return '<option value="'+s.name+'">'+s.icon+' '+s.name+'</option>';}).join('');
  svcSel.addEventListener('change', function() {
    const ro=document.getElementById('research-options'); if(ro)ro.style.display=svcSel.value==='Research Assistance'?'block':'none';
    const pr=document.getElementById('price-range'); if(pr){const m=pricing.find(function(p){return p.service.toLowerCase().includes(svcSel.value.split(' ')[0].toLowerCase());});pr.textContent=m?'Estimated: TZS '+m.minPrice.toLocaleString()+' – '+m.maxPrice.toLocaleString():'';}
  });
  const form=document.getElementById('request-form');
  if(form){const f=form.cloneNode(true);form.parentNode.replaceChild(f,form);f.addEventListener('submit',handleRequestSubmit);}
}

async function handleRequestSubmit(e) {
  e.preventDefault();
  const serviceType=document.getElementById('req-service').value;
  const description=document.getElementById('req-description').value.trim();
  const requirements=document.getElementById('req-requirements').value.trim();
  const deadline=document.getElementById('req-deadline').value;
  const researchStage=document.getElementById('research-stage')?.value||'';
  if(!serviceType){showToast('Missing','Please select a service type.','warning');return;}
  if(!description){showToast('Missing','Please describe your requirements.','warning');return;}
  if(!deadline){showToast('Missing','Please set a deadline.','warning');return;}

  const finalService=serviceType==='Research Assistance'&&researchStage?'Research Assistance — '+researchStage:serviceType;
  const btn=e.target.querySelector('button[type="submit"]');
  if(btn){btn.disabled=true;btn.innerHTML='<span class="spinner spinner-sm"></span> Submitting…';}

  const req={id:generateId('REQ'),userId:currentUser.id,userName:currentUser.fullName,userEmail:currentUser.email,userPhone:currentUser.phone,university:currentUser.university,program:currentUser.program,serviceType:finalService,description,requirements,deadline,status:'Submitted',adminNotes:'',price:null,paymentStatus:'Pending',deliveryFile:null,createdAt:new Date().toISOString(),completedAt:null,hiddenFromUser:false};
  try {
    await DB.addRequest(req);
    await DB.addLog({id:generateId('LOG'),requestId:req.id,userName:currentUser.fullName,serviceType:finalService,submittedAt:req.createdAt,completedAt:null,price:null,status:'Submitted'});
    await DB.addNotif({id:generateId('NTF'),userId:currentUser.id,title:'✅ Request Submitted',message:'Your request for "'+finalService+'" has been submitted. We will review it shortly.',createdAt:new Date().toISOString(),read:false});
    myRequests.unshift(req);
    showToast('Submitted!','Request ID: '+req.id,'success');
    e.target.reset();
    setTimeout(function(){showSection('requests');history.pushState(null,'','#requests');document.querySelectorAll('.sidebar-link').forEach(function(l){l.classList.remove('active');});document.querySelector('.sidebar-link[data-section="requests"]')?.classList.add('active');},1200);
  } catch(err){ showToast('Error','Failed to submit. Please try again.','error'); }
  if(btn){btn.disabled=false;btn.innerHTML='Submit Request 🚀';}
}

// ── Request Detail Modal ──────────────────────────────────────
function showRequestDetail(reqId) {
  const req=myRequests.find(function(r){return r.id===reqId;}); if(!req)return;
  const pct=getProgressPct(req.status);
  setEl('modal-req-id',req.id); setEl('modal-req-service',req.serviceType);
  setEl('modal-req-desc',req.description||'—'); setEl('modal-req-deadline',formatDate(req.deadline));
  setEl('modal-req-submitted',formatDateTime(req.createdAt));
  setEl('modal-req-notes',req.adminNotes||'No notes yet.');
  setEl('modal-req-price',req.price?'TZS '+Number(req.price).toLocaleString():'Not quoted yet');
  setEl('modal-req-payment',req.paymentStatus||'—');
  const statusEl=document.getElementById('modal-req-status'); if(statusEl)statusEl.innerHTML=statusBadge(req.status);
  const pb=document.getElementById('modal-progress'); if(pb)pb.style.width=pct+'%';
  const dlBtn=document.getElementById('modal-download-btn');
  if(dlBtn){dlBtn.style.display=req.deliveryFile?'inline-flex':'none'; dlBtn.onclick=function(){triggerDownload(reqId);};}
  const b=document.getElementById('request-modal-backdrop'); if(b)b.classList.add('open');
}
function closeModal(id){const b=document.getElementById(id+'-modal-backdrop')||document.getElementById(id+'-backdrop');if(b)b.classList.remove('open');}

// ── Profile ───────────────────────────────────────────────────
function initProfileForm(){
  const u=Session.currentUser(); if(!u)return;
  const map={fullName:'profile-name',phone:'profile-phone',university:'profile-university',program:'profile-program'};
  Object.keys(map).forEach(function(k){const el=document.getElementById(map[k]);if(el)el.value=u[k]||'';});
  const lv=document.getElementById('profile-level');if(lv)lv.value=u.level||'';
}

// ── Rating ────────────────────────────────────────────────────
async function checkRatingPrompt(){
  const completed=myRequests.filter(function(r){return r.status==='Completed'&&!r.hiddenFromUser;});
  for(const r of completed){
    const rated=await DB.getRatingByRequestId(r.id).catch(()=>null);
    if(!rated&&!sessionStorage.getItem('rp_'+r.id)){
      sessionStorage.setItem('rp_'+r.id,'1');
      setTimeout(function(){openRatingModal(r.id);},800);
      break;
    }
  }
}
function openRatingModal(reqId){
  const req=myRequests.find(function(r){return r.id===reqId;}); if(!req)return;
  currentRatingReqId=reqId; currentStars=0;
  document.querySelectorAll('.star-btn').forEach(function(b){b.classList.remove('selected');});
  const lbl=document.getElementById('star-label');if(lbl)lbl.textContent='Tap a star to rate';
  const sn=document.getElementById('rating-service-name');if(sn)sn.textContent=req.serviceType;
  const cmt=document.getElementById('rating-comment');if(cmt)cmt.value='';
  const b=document.getElementById('rating-modal-backdrop');if(b)b.classList.add('open');
}
function selectStar(n){currentStars=n;document.querySelectorAll('.star-btn').forEach(function(b){b.classList.toggle('selected',Number(b.dataset.star)<=n);});const lbl=document.getElementById('star-label');if(lbl)lbl.textContent=starLabels[n]||'';}
async function submitRating(){
  if(!currentStars){showToast('Select Stars','Please tap a star.','warning');return;}
  const req=myRequests.find(function(r){return r.id===currentRatingReqId;}); if(!req)return;
  const already=await DB.getRatingByRequestId(currentRatingReqId).catch(()=>null);
  if(already){showToast('Already Rated','You already rated this service.','info');closeModal('rating');return;}
  const u=Session.currentUser(),comment=document.getElementById('rating-comment')?.value.trim()||'';
  await DB.addRating({id:generateId('RTG'),userId:u.id,userName:u.fullName,userUniversity:u.university+(u.level?', '+u.level:''),requestId:currentRatingReqId,serviceType:req.serviceType,stars:currentStars,comment,createdAt:new Date().toISOString(),approved:true,visible:true});
  closeModal('rating');
  showToast('Thank You! ⭐','Your rating has been submitted.','success');
}
function closeRatingModal(){closeModal('rating');}
