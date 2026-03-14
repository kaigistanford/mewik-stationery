// ============================================================
//  MEWIK STATIONERY — auth.js v2.0
// ============================================================
'use strict';

async function handleLogin(e) {
  e.preventDefault();
  const email=document.getElementById('login-email').value.trim().toLowerCase();
  const pass =document.getElementById('login-password').value;
  const btn  =document.getElementById('login-btn');
  const errEl=document.getElementById('login-error');
  clearError(errEl);
  if(!email||!pass){showError(errEl,'Please enter your email and password.');return;}
  btn.disabled=true;
  btn.innerHTML='<span class="spinner spinner-sm"></span> Signing in…';
  try {
    const hash=sha256(pass+'mewik_salt_2024');
    const user=await DB.getUserByEmail(email);
    if(!user||user.passwordHash!==hash){showError(errEl,'Invalid email or password.');btn.disabled=false;btn.innerHTML='Sign In';return;}
    Session.set(user);
    showToast('Welcome back!','Good to see you, '+user.fullName.split(' ')[0]+'.','success');
    setTimeout(function(){window.location.href=user.role==='admin'?'admin.html':'dashboard.html';},700);
  } catch(err) {
    showError(errEl,'Error signing in. Please try again.');
    btn.disabled=false;btn.innerHTML='Sign In';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  clearAllErrors();
  const g=function(id){return document.getElementById(id)?.value.trim()||'';};
  const fullName=g('signup-name'),email=g('signup-email').toLowerCase(),phone=g('signup-phone'),
        university=g('signup-university'),program=g('signup-program'),
        level=document.getElementById('signup-level')?.value||'',
        password=document.getElementById('signup-password')?.value||'',
        confirm=document.getElementById('signup-confirm')?.value||'';
  const btn=document.getElementById('signup-btn');
  let err=false;
  if(!fullName)        {showError(document.getElementById('err-name'),'Required.');err=true;}
  if(!email||!email.includes('@')) {showError(document.getElementById('err-email'),'Valid email required.');err=true;}
  if(!phone||phone.length<9) {showError(document.getElementById('err-phone'),'Valid phone required.');err=true;}
  if(!university)      {showError(document.getElementById('err-university'),'Required.');err=true;}
  if(!program)         {showError(document.getElementById('err-program'),'Required.');err=true;}
  if(!level)           {showError(document.getElementById('err-level'),'Select your level.');err=true;}
  if(password.length<6){showError(document.getElementById('err-password'),'Min. 6 characters.');err=true;}
  if(password!==confirm){showError(document.getElementById('err-confirm'),'Passwords do not match.');err=true;}
  if(err)return;
  const existing=await DB.getUserByEmail(email);
  if(existing){showError(document.getElementById('signup-error'),'Account already exists. Please login.');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner spinner-sm"></span> Creating account…';
  try {
    const hash=sha256(password+'mewik_salt_2024');
    const user={id:generateId('USR'),fullName,email,phone,university,program,level,passwordHash:hash,role:'student',createdAt:new Date().toISOString()};
    await DB.addUser(user);
    await DB.addNotif({id:generateId('NTF'),userId:user.id,title:'🎉 Welcome to Mewik Stationery!',message:'Your account has been created. Browse our services and submit your first request.',createdAt:new Date().toISOString(),read:false});
    Session.set(user);
    showToast('Account Created!','Welcome to Mewik Stationery.','success');
    setTimeout(function(){window.location.href='dashboard.html';},900);
  } catch(err2) {
    showError(document.getElementById('signup-error'),'Error creating account. Please try again.');
    btn.disabled=false;btn.innerHTML='Create Account';
  }
}

async function handleProfileUpdate(e) {
  e.preventDefault();
  const user=Session.currentUser();if(!user)return;
  const g=function(id){return document.getElementById(id)?.value.trim()||'';};
  const fullName=g('profile-name'),phone=g('profile-phone'),university=g('profile-university'),program=g('profile-program'),level=document.getElementById('profile-level')?.value||'';
  const newPass=document.getElementById('profile-newpass')?.value||'';
  const btn=document.getElementById('profile-btn');
  if(!fullName||!phone||!university||!program||!level){showToast('Missing Fields','Please fill in all required fields.','warning');return;}
  btn.disabled=true;btn.innerHTML='<span class="spinner spinner-sm"></span> Saving…';
  let updates={fullName,phone,university,program,level};
  if(newPass){
    if(newPass.length<6){showToast('Too Short','Password must be at least 6 characters.','warning');btn.disabled=false;btn.innerHTML='Save Changes';return;}
    const currPass=document.getElementById('profile-currentpass')?.value||'';
    const currHash=sha256(currPass+'mewik_salt_2024');
    if(currHash!==user.passwordHash){showToast('Wrong Password','Current password is incorrect.','error');btn.disabled=false;btn.innerHTML='Save Changes';return;}
    updates.passwordHash=sha256(newPass+'mewik_salt_2024');
  }
  await DB.updateUser(user.id,updates);
  Session.set({...user,...updates});
  btn.disabled=false;btn.innerHTML='Save Changes';
  showToast('Profile Updated','Your information has been saved.','success');
}

function logout(){Session.clear();window.location.href='index.html';}

function showError(el,msg){if(!el)return;el.textContent=msg;el.classList.add('show');}
function clearError(el){if(!el)return;el.textContent='';el.classList.remove('show');}
function clearAllErrors(){document.querySelectorAll('.form-error').forEach(function(el){el.textContent='';el.classList.remove('show');});}

function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach(function(btn){
    btn.addEventListener('click',function(){
      const inp=btn.closest('.input-group')?.querySelector('input')||btn.previousElementSibling;
      if(!inp)return;
      const t=inp.type==='text';
      inp.type=t?'password':'text';
      btn.textContent=t?'👁️':'🙈';
    });
  });
}

document.addEventListener('DOMContentLoaded',function(){
  initPasswordToggles();
  const lf=document.getElementById('login-form');
  if(lf){redirectIfLoggedIn();lf.addEventListener('submit',handleLogin);}
  const sf=document.getElementById('signup-form');
  if(sf){redirectIfLoggedIn();sf.addEventListener('submit',handleSignup);}
  const pf=document.getElementById('profile-form');
  if(pf){
    const u=Session.currentUser();
    if(u){
      const f={fullName:'profile-name',phone:'profile-phone',university:'profile-university',program:'profile-program'};
      Object.keys(f).forEach(function(k){const el=document.getElementById(f[k]);if(el)el.value=u[k]||'';});
      const lv=document.getElementById('profile-level');if(lv)lv.value=u.level||'';
    }
    pf.addEventListener('submit',handleProfileUpdate);
  }
  document.querySelectorAll('[data-action="logout"]').forEach(function(b){b.addEventListener('click',logout);});
});
