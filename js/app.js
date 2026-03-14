// ============================================================
//  MEWIK STATIONERY — app.js  v4.0
//  Core utilities — uses DB from sync-config.js
// ============================================================
'use strict';

const APP = {
  name:      'Mewik Stationery',
  version:   '4.0.0',
  adminPass: 'admin@mewik2024',
};

// ── SHA-256 (works on file://, http, https) ──────────────────
function sha256(s){function rr(v,a){return(v>>>a)|(v<<(32-a));}const mp=Math.pow,mw=mp(2,32);let res='',w=[];const abl=s.length*8;let h=[],k=[],pc=0;const ic={};for(let c=2;pc<64;c++){if(!ic[c]){for(let i=0;i<313;i+=c)ic[i]=c;h[pc]=(mp(c,.5)*mw)|0;k[pc++]=(mp(c,1/3)*mw)|0;}}s+='\x80';while(s.length%64-56)s+='\x00';for(let i=0;i<s.length;i++){const j=s.charCodeAt(i);if(j>>8)return'';w[i>>2]|=j<<((3-i)%4)*8;}w[w.length]=((abl/mw)|0);w[w.length]=(abl|0);for(let j=0;j<w.length;){const ww=w.slice(j,j+=16),oh=h.slice(0);for(let i=0;i<64;i++){const w15=ww[i-15],w2=ww[i-2],a=h[0],e=h[4];const t1=h[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&h[5])^(~e&h[6]))+k[i]+(ww[i]=(i<16)?ww[i]:(ww[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+ww[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&h[1])^(a&h[2])^(h[1]&h[2]));h=[(t1+t2)|0].concat(h);h[4]=(h[4]+t1)|0;h.length=8;}for(let i=0;i<8;i++)h[i]=(h[i]+oh[i])|0;}for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(h[i]>>(j*8))&255;res+=((b<16)?'0':'')+b.toString(16);}return res;}
function hashPassword(pw) { return Promise.resolve(sha256(pw + 'mewik_salt_2024')); }

// ── Session ──────────────────────────────────────────────────
const Session = {
  get()         { try{return JSON.parse(localStorage.getItem('mewik_session'));}catch{return null;} },
  set(u)        { localStorage.setItem('mewik_session', JSON.stringify(u)); },
  clear()       { localStorage.removeItem('mewik_session'); },
  isLoggedIn()  { return !!this.get(); },
  isAdmin()     { return this.get()?.role === 'admin'; },
  currentUser() { return this.get(); },
};

// ── Helpers ──────────────────────────────────────────────────
function generateId(p) { return (p||'ID')+'-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).substr(2,4).toUpperCase(); }
function formatDate(d)     { if(!d)return'—'; return new Date(d).toLocaleDateString('en-TZ',{day:'2-digit',month:'short',year:'numeric'}); }
function formatDateTime(d) { if(!d)return'—'; return new Date(d).toLocaleString('en-TZ',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}); }
function timeAgo(d) { const diff=Date.now()-new Date(d).getTime(),m=Math.floor(diff/60000); if(m<1)return'just now'; if(m<60)return m+'m ago'; const hr=Math.floor(m/60); if(hr<24)return hr+'h ago'; return Math.floor(hr/24)+'d ago'; }
function daysAgo(d) { return Math.floor((Date.now()-new Date(d).getTime())/86400000); }
function esc(s){ if(!s)return''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function setEl(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }
function rebind(id,fn){ const btn=document.getElementById(id); if(!btn)return; const f=btn.cloneNode(true); btn.parentNode.replaceChild(f,btn); f.addEventListener('click',fn); }

// ── Toast ────────────────────────────────────────────────────
function showToast(title, msg, type, dur) {
  msg=msg||''; type=type||'info'; dur=dur===undefined?5000:dur;
  let c=document.querySelector('.toast-container');
  if(!c){c=document.createElement('div');c.className='toast-container';document.body.appendChild(c);}
  const icons={info:'ℹ️',success:'✅',error:'❌',warning:'⚠️'};
  const t=document.createElement('div');
  t.className='toast '+type;
  t.innerHTML='<span class="toast-icon">'+(icons[type]||'ℹ️')+'</span><div><div class="toast-title">'+title+'</div>'+(msg?'<div class="toast-msg">'+msg+'</div>':'')+'</div><button class="toast-close" onclick="this.closest(\'.toast\').remove()">✕</button>';
  c.appendChild(t);
  if(dur) setTimeout(function(){if(t.parentNode)t.remove();},dur);
}

// ── Progress ─────────────────────────────────────────────────
const PROGRESS_STAGES = ['Submitted','Under Review','In Progress','Quality Check','Completed'];
function getProgressPct(s) { const i=PROGRESS_STAGES.indexOf(s); return i<0?0:Math.round((i/(PROGRESS_STAGES.length-1))*100); }
function statusBadge(s) {
  const m={'Submitted':'status-submitted','Under Review':'status-under-review','In Progress':'status-in-progress','Quality Check':'status-quality-check','Completed':'status-completed','Cancelled':'status-cancelled'};
  return '<span class="badge-status '+(m[s]||'status-submitted')+'">'+s+'</span>';
}
function renderStars(r,sz){ sz=sz||'1rem'; let h=''; for(let i=1;i<=5;i++) h+='<span style="color:'+(i<=r?'var(--warning)':'var(--gray-300)')+';font-size:'+sz+'">★</span>'; return h; }

// ── Routing ──────────────────────────────────────────────────
function requireLogin(r)       { if(!Session.isLoggedIn()){window.location.href=r||'login.html';return false;} return true; }
function redirectIfLoggedIn(r) { if(Session.isLoggedIn()) window.location.href=Session.isAdmin()?'admin.html':(r||'dashboard.html'); }

// ── Cleanup ──────────────────────────────────────────────────
async function runCleanup() {
  try {
    const reqs = await DB.getRequests();
    const stale = reqs.filter(r => r.status==='Completed' && !r.hiddenFromUser && daysAgo(r.completedAt||r.createdAt)>=3);
    if (!stale.length) return;
    const updated = reqs.map(r => stale.find(s=>s.id===r.id) ? {...r, hiddenFromUser:true} : r);
    await DB._write('requests', updated);
  } catch(e) {}
}

// ── Seed initial data ─────────────────────────────────────────
async function seedInitialData() {
  try {
    const services = await DB.getServices();
    if (services.length > 0) return;

    const svcData = [
      {id:'svc-1',name:'Assignment Assistance',icon:'📝',description:'Professional assistance for coursework assignments covering all subjects at Tanzanian universities.',badge:'Popular',category:'Academic'},
      {id:'svc-2',name:'Field Attachment Report',icon:'🏛️',description:'Complete field attachment/internship report writing following IRDP, UDOM, UDSM and other institutional formats.',badge:'Fast',category:'Academic'},
      {id:'svc-3',name:'Socio-Economic Profile',icon:'📊',description:'Group project socio-economic profile writing for wards, villages, or districts in Tanzania.',badge:'Group',category:'Academic'},
      {id:'svc-4',name:'Research Assistance',icon:'🔬',description:'Full research support from proposal writing to final research report. APA and other citation styles supported.',badge:'Premium',category:'Research'},
    ];
    const pricingData = [
      {id:'p-1',service:'Assignment Assistance',minPrice:10000,maxPrice:50000,currency:'TZS'},
      {id:'p-2',service:'Field Attachment Report',minPrice:30000,maxPrice:80000,currency:'TZS'},
      {id:'p-3',service:'Socio-Economic Profile',minPrice:40000,maxPrice:100000,currency:'TZS'},
      {id:'p-4',service:'Research Proposal Writing',minPrice:50000,maxPrice:120000,currency:'TZS'},
      {id:'p-5',service:'Research Report Writing',minPrice:80000,maxPrice:200000,currency:'TZS'},
      {id:'p-6',service:'Full Research Package',minPrice:120000,maxPrice:300000,currency:'TZS'},
    ];
    await DB._write('services', svcData);
    await DB._write('pricing', pricingData);

    // Sample ratings
    const sampleRatings = [
      {id:'rtg-001',userId:'sample',userName:'Fatuma M.',userUniversity:'IRDP Dodoma, Year 3',requestId:'sample-1',serviceType:'Field Attachment Report',stars:5,comment:'My field attachment report was done professionally and on time. The writing followed the IRDP format perfectly.',createdAt:new Date(Date.now()-5*86400000).toISOString(),approved:true,visible:true},
      {id:'rtg-002',userId:'sample',userName:'Joseph K.',userUniversity:'UDSM, Bachelor of Arts',requestId:'sample-2',serviceType:'Research Assistance',stars:5,comment:'I was struggling with my research proposal. The team helped me from the title page to the reference list.',createdAt:new Date(Date.now()-3*86400000).toISOString(),approved:true,visible:true},
      {id:'rtg-003',userId:'sample',userName:'Amina S.',userUniversity:'Mzumbe University, Diploma',requestId:'sample-3',serviceType:'Assignment Assistance',stars:4,comment:'Fast service and good communication. Submitted two days before my deadline.',createdAt:new Date(Date.now()-2*86400000).toISOString(),approved:true,visible:true},
    ];
    await DB._write('ratings', sampleRatings);

    // Admin account
    const existingAdmin = await DB.getUserByEmail('admin@mewik.co.tz');
    if (!existingAdmin) {
      const hash = sha256(APP.adminPass + 'mewik_salt_2024');
      await DB.addUser({id:'admin-001',fullName:'Mewik Admin',email:'admin@mewik.co.tz',phone:'+255 616 832 924',university:'Mewik Stationery',program:'Administration',level:'Admin',passwordHash:hash,role:'admin',createdAt:new Date().toISOString()});
    }
  } catch(e) { console.warn('[Seed]', e); }
}

// ── Sidebar ──────────────────────────────────────────────────
function initSidebar() {
  const sidebar=document.querySelector('.sidebar'), overlay=document.querySelector('.sidebar-overlay'), ham=document.querySelector('.hamburger');
  if(!sidebar)return;
  if(ham)ham.addEventListener('click',function(){sidebar.classList.toggle('open');if(overlay)overlay.classList.toggle('show');});
  if(overlay)overlay.addEventListener('click',function(){sidebar.classList.remove('open');overlay.classList.remove('show');});
}

// ── Notification Bell ────────────────────────────────────────
function initNotifBell() {
  const bell=document.querySelector('.notification-btn'), panel=document.querySelector('.notif-panel');
  if(!bell||!panel)return;
  bell.addEventListener('click',async function(e){
    e.stopPropagation();
    panel.classList.toggle('open');
    if(panel.classList.contains('open')){
      const u=Session.currentUser();
      if(u){
        const notifs=await DB.getNotifs(u.id).catch(()=>[]);
        const unread=notifs.filter(n=>!n.read).length;
        const dot=bell.querySelector('.notif-dot');if(dot)dot.style.display='none';
        panel.innerHTML='<div class="notif-panel-header"><span class="notif-panel-title">🔔 Notifications</span><span style="font-size:0.75rem;color:var(--gray-400)">'+unread+' unread</span></div>'
          +(notifs.length?notifs.slice(0,12).map(n=>'<div class="notif-item '+(n.read?'':'unread')+'"><div class="notif-item-title">'+esc(n.title)+'</div><div class="notif-item-text">'+esc(n.message)+'</div><div class="notif-item-time">'+timeAgo(n.createdAt)+'</div></div>').join('')
          :'<div class="notif-item"><div class="notif-item-text" style="text-align:center;padding:14px;color:var(--gray-400)">No notifications yet</div></div>');
        await DB.markNotifsRead(u.id).catch(()=>{});
      }
    }
  });
  document.addEventListener('click',function(){panel.classList.remove('open');});
  panel.addEventListener('click',function(e){e.stopPropagation();});
}

async function updateNotifDot(userId) {
  const notifs=await DB.getNotifs(userId).catch(()=>[]);
  const dot=document.querySelector('.notif-dot');
  if(dot)dot.style.display=notifs.filter(n=>!n.read).length>0?'block':'none';
}

// ── Excel Export ─────────────────────────────────────────────
function exportToExcel(data,fn,sheet){if(typeof XLSX==='undefined'){showToast('Error','Excel library not loaded.','error');return;}const ws=XLSX.utils.json_to_sheet(data),wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,sheet||'Sheet1');XLSX.writeFile(wb,fn||'export.xlsx');}

// ── DOMContentLoaded ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function() {
  initSidebar();
  initNotifBell();
  await seedInitialData().catch(()=>{});
  runCleanup().catch(()=>{});
  const path=window.location.pathname.split('/').pop();
  document.querySelectorAll('.sidebar-link').forEach(function(link){const href=link.getAttribute('href');if(href&&href.includes(path))link.classList.add('active');});
  if(typeof SYNC!=='undefined') updateSyncBadge(SYNC.isReady());
});
