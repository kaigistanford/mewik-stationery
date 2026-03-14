// ============================================================
//  MEWIK STATIONERY — auth.js
//  Handles signup, login, logout, profile update
// ============================================================

'use strict';

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const email    = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  if (!email || !password) {
    showFieldError(errEl, 'Please enter your email and password.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Signing in…';

  try {
    const hash = await hashPassword(password);
    const user = DB.getUserByEmail(email);

    if (!user || user.passwordHash !== hash) {
      showFieldError(errEl, 'Invalid email or password. Please try again.');
      btn.disabled = false;
      btn.innerHTML = 'Sign In';
      return;
    }

    Session.set(user);
    showToast('Welcome back!', `Good to see you, ${user.fullName.split(' ')[0]}.`, 'success');

    setTimeout(() => {
      window.location.href = user.role === 'admin' ? 'admin.html' : 'dashboard.html';
    }, 800);

  } catch (err) {
    showFieldError(errEl, 'An error occurred. Please try again.');
    btn.disabled = false;
    btn.innerHTML = 'Sign In';
  }
}

// ── Signup ────────────────────────────────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  clearErrors();

  const fullName   = document.getElementById('signup-name').value.trim();
  const email      = document.getElementById('signup-email').value.trim().toLowerCase();
  const phone      = document.getElementById('signup-phone').value.trim();
  const university = document.getElementById('signup-university').value.trim();
  const program    = document.getElementById('signup-program').value.trim();
  const level      = document.getElementById('signup-level').value;
  const password   = document.getElementById('signup-password').value;
  const confirm    = document.getElementById('signup-confirm').value;
  const errEl      = document.getElementById('signup-error');
  const btn        = document.getElementById('signup-btn');

  // Validation
  let hasError = false;
  if (!fullName) { showFieldError(document.getElementById('err-name'), 'Full name is required.'); hasError = true; }
  if (!email || !email.includes('@')) { showFieldError(document.getElementById('err-email'), 'Valid email is required.'); hasError = true; }
  if (!phone || phone.length < 10) { showFieldError(document.getElementById('err-phone'), 'Valid WhatsApp number is required.'); hasError = true; }
  if (!university) { showFieldError(document.getElementById('err-university'), 'University/College is required.'); hasError = true; }
  if (!program) { showFieldError(document.getElementById('err-program'), 'Program/course is required.'); hasError = true; }
  if (!level) { showFieldError(document.getElementById('err-level'), 'Level of study is required.'); hasError = true; }
  if (password.length < 6) { showFieldError(document.getElementById('err-password'), 'Password must be at least 6 characters.'); hasError = true; }
  if (password !== confirm) { showFieldError(document.getElementById('err-confirm'), 'Passwords do not match.'); hasError = true; }

  if (hasError) return;

  if (DB.getUserByEmail(email)) {
    showFieldError(errEl, 'An account with this email already exists. Please login instead.');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Creating account…';

  try {
    const passwordHash = await hashPassword(password);
    const user = {
      id:          generateId('USR'),
      fullName,
      email,
      phone,
      university,
      program,
      level,
      passwordHash,
      role:        'student',
      createdAt:   new Date().toISOString(),
    };

    DB.addUser(user);
    Session.set(user);

    // Welcome notification
    DB.addNotif({
      id:        generateId('NTF'),
      userId:    user.id,
      title:     '🎉 Welcome to Mewik Stationery!',
      message:   'Your account has been created. Browse our services and submit your first request.',
      createdAt: new Date().toISOString(),
      read:      false,
    });

    showToast('Account Created!', 'Welcome to Mewik Stationery.', 'success');
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1000);

  } catch (err) {
    showFieldError(errEl, 'Error creating account. Please try again.');
    btn.disabled = false;
    btn.innerHTML = 'Create Account';
  }
}

// ── Profile Update ────────────────────────────────────────────
async function handleProfileUpdate(e) {
  e.preventDefault();
  const user = Session.currentUser();
  if (!user) return;

  const fullName   = document.getElementById('profile-name').value.trim();
  const phone      = document.getElementById('profile-phone').value.trim();
  const university = document.getElementById('profile-university').value.trim();
  const program    = document.getElementById('profile-program').value.trim();
  const level      = document.getElementById('profile-level').value;
  const newPass    = document.getElementById('profile-newpass')?.value;
  const btn        = document.getElementById('profile-btn');

  if (!fullName || !phone || !university || !program || !level) {
    showToast('Missing Fields', 'Please fill in all required fields.', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Saving…';

  let updates = { fullName, phone, university, program, level };

  if (newPass && newPass.length >= 6) {
    const currentPass = document.getElementById('profile-currentpass')?.value;
    const currentHash = await hashPassword(currentPass);
    if (currentHash !== user.passwordHash) {
      showToast('Wrong Password', 'Current password is incorrect.', 'error');
      btn.disabled = false;
      btn.innerHTML = 'Save Changes';
      return;
    }
    updates.passwordHash = await hashPassword(newPass);
  }

  DB.updateUser(user.id, updates);
  Session.set({ ...user, ...updates });

  btn.disabled = false;
  btn.innerHTML = 'Save Changes';
  showToast('Profile Updated', 'Your information has been saved.', 'success');
}

// ── Logout ────────────────────────────────────────────────────
function logout() {
  Session.clear();
  window.location.href = 'index.html';
}

// ── Error Helpers ─────────────────────────────────────────────
function showFieldError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
}
function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.textContent = '';
    el.classList.remove('show');
  });
}

// ── Password Toggle ───────────────────────────────────────────
function initPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = btn.previousElementSibling || btn.closest('.input-group')?.querySelector('input');
      if (!input) return;
      const isText = input.type === 'text';
      input.type = isText ? 'password' : 'text';
      btn.textContent = isText ? '👁️' : '🙈';
    });
  });
}

// ── DOMContentLoaded ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initPasswordToggles();

  // Login page
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    redirectIfLoggedIn();
    loginForm.addEventListener('submit', handleLogin);
  }

  // Signup page
  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    redirectIfLoggedIn();
    signupForm.addEventListener('submit', handleSignup);
  }

  // Profile form
  const profileForm = document.getElementById('profile-form');
  if (profileForm) {
    const user = Session.currentUser();
    if (user) {
      document.getElementById('profile-name').value = user.fullName || '';
      document.getElementById('profile-phone').value = user.phone || '';
      document.getElementById('profile-university').value = user.university || '';
      document.getElementById('profile-program').value = user.program || '';
      const lvl = document.getElementById('profile-level');
      if (lvl) lvl.value = user.level || '';
    }
    profileForm.addEventListener('submit', handleProfileUpdate);
  }

  // Logout buttons
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', logout);
  });
});
