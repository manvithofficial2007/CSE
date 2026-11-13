/* ============================================================
   Blood Bridge – auth.js
   Authentication helpers: login, register, logout, guards.
   ============================================================ */

// ---------------------------------------------------------------------------
// Toast & UI utilities (shared across all pages)
// ---------------------------------------------------------------------------

/** HTML-escape a string to prevent XSS in template literals */
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/** Show a toast notification. type: 'success' | 'error' | 'warning' */
function showToast(message, type = 'success', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', warning: '⚠' };
  toast.innerHTML = `<span>${icons[type] || '•'}</span> ${message}`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity .3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/** Set a button into loading state. Returns a restore function. */
function setButtonLoading(btn, label = 'Loading…') {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${label}`;
  return () => {
    btn.disabled = false;
    btn.innerHTML = original;
  };
}

/** Show an inline alert inside a container element. */
function showAlert(containerId, message, type = 'danger') {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = message;
  el.style.display = 'flex';
  el.setAttribute('role', 'alert');
}

function hideAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.style.display = 'none';
}

// ---------------------------------------------------------------------------
// Field validation helpers
// ---------------------------------------------------------------------------

function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) field.classList.add('error');
  if (errorEl) { errorEl.textContent = message; errorEl.classList.add('show'); }
}

function clearFieldError(fieldId) {
  const field = document.getElementById(fieldId);
  const errorEl = document.getElementById(`${fieldId}-error`);
  if (field) field.classList.remove('error');
  if (errorEl) errorEl.classList.remove('show');
}

function clearAllErrors(form) {
  form.querySelectorAll('.form-control.error').forEach(el => el.classList.remove('error'));
  form.querySelectorAll('.field-error.show').forEach(el => el.classList.remove('show'));
}

/** Validate a single required field. Returns true if valid. */
function validateRequired(fieldId, message = 'This field is required.') {
  const field = document.getElementById(fieldId);
  if (!field) return true;
  if (!field.value.trim()) {
    showFieldError(fieldId, message);
    return false;
  }
  clearFieldError(fieldId);
  return true;
}

function validateEmail(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field || !field.value.trim()) return validateRequired(fieldId, 'Email is required.');
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(field.value.trim())) {
    showFieldError(fieldId, 'Enter a valid email address.');
    return false;
  }
  clearFieldError(fieldId);
  return true;
}

function validatePhone(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field || !field.value.trim()) return validateRequired(fieldId, 'Phone number is required.');
  if (!/^\d{10}$/.test(field.value.trim())) {
    showFieldError(fieldId, 'Enter a valid 10-digit phone number.');
    return false;
  }
  clearFieldError(fieldId);
  return true;
}

function validateMinLength(fieldId, min, label = 'Password') {
  const field = document.getElementById(fieldId);
  if (!field || !field.value) return validateRequired(fieldId);
  if (field.value.length < min) {
    showFieldError(fieldId, `${label} must be at least ${min} characters.`);
    return false;
  }
  clearFieldError(fieldId);
  return true;
}

// ---------------------------------------------------------------------------
// Password visibility toggle
// ---------------------------------------------------------------------------

function initPasswordToggle(inputId, toggleId) {
  const input  = document.getElementById(inputId);
  const toggle = document.getElementById(toggleId);
  if (!input || !toggle) return;

  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.textContent = show ? '🙈' : '👁';
  });
}

// ---------------------------------------------------------------------------
// Navbar user state
// ---------------------------------------------------------------------------

/** Update the navbar to reflect logged-in / logged-out state. */
function updateNavbarAuth() {
  const user = getCurrentUser();
  const loginLink  = document.getElementById('nav-login');
  const userMenu   = document.getElementById('nav-user-menu');
  const userNameEl = document.getElementById('nav-user-name');

  if (!user) {
    if (loginLink)  loginLink.style.display  = '';
    if (userMenu)   userMenu.style.display    = 'none';
    return;
  }

  if (loginLink)  loginLink.style.display  = 'none';
  if (userMenu)   userMenu.style.display   = '';
  if (userNameEl) userNameEl.textContent   = user.name.split(' ')[0];
}

// ---------------------------------------------------------------------------
// Route guards
// ---------------------------------------------------------------------------

/** Redirect to login if not logged in. */
function requireAuth(redirectTo = 'login.html') {
  if (!isLoggedIn()) {
    window.location.href = redirectTo;
    return false;
  }
  return true;
}

/** Redirect dashboard if already logged in. */
function redirectIfLoggedIn(role) {
  if (!isLoggedIn()) return;
  const user = getCurrentUser();
  const dest = {
    requester:  'requester-dashboard.html',
    donor:      'donor-dashboard.html',
    admin:      'admin-dashboard.html',
    blood_bank: 'blood-bank-dashboard.html',
  };
  window.location.href = dest[user?.role] || 'index.html';
}

// ---------------------------------------------------------------------------
// Login form handler
// ---------------------------------------------------------------------------

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearAllErrors(form);
  hideAlert('login-alert');

  const emailValid = validateEmail('login-email');
  const passValid  = validateMinLength('login-password', 4, 'Password');
  if (!emailValid || !passValid) return;

  const btn      = form.querySelector('[type="submit"]');
  const restore  = setButtonLoading(btn, 'Signing in…');
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  const result = await apiLogin(email, password);
  restore();

  if (!result.ok) {
    showAlert('login-alert', result.data?.message || 'Login failed. Please try again.');
    return;
  }

  saveSession(result.data.token, result.data.user);
  showToast('Welcome back, ' + result.data.user.name.split(' ')[0] + '!', 'success');

  const role = result.data.user.role;
  setTimeout(() => {
    if (role === 'donor')       window.location.href = 'donor-dashboard.html';
    else if (role === 'admin')  window.location.href = 'admin-dashboard.html';
    else if (role === 'blood_bank') window.location.href = 'blood-bank-dashboard.html';
    else                        window.location.href = 'requester-dashboard.html';
  }, 500);
}

// ---------------------------------------------------------------------------
// Register form handler
// ---------------------------------------------------------------------------

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearAllErrors(form);
  hideAlert('register-alert');

  const checks = [
    validateRequired('reg-name',  'Full name is required.'),
    validateEmail('reg-email'),
    validatePhone('reg-phone'),
    validateMinLength('reg-password', 8),
  ];

  const password = document.getElementById('reg-password')?.value;
  const confirm  = document.getElementById('reg-confirm')?.value;
  if (password && confirm && password !== confirm) {
    showFieldError('reg-confirm', 'Passwords do not match.');
    checks.push(false);
  } else {
    clearFieldError('reg-confirm');
  }

  if (checks.some(v => !v)) return;

  const btn     = form.querySelector('[type="submit"]');
  const restore = setButtonLoading(btn, 'Creating account…');

  const payload = {
    name:     document.getElementById('reg-name').value.trim(),
    email:    document.getElementById('reg-email').value.trim(),
    phone:    document.getElementById('reg-phone').value.trim(),
    password: document.getElementById('reg-password').value,
  };

  const result = await apiRegister(payload);
  restore();

  if (!result.ok) {
    showAlert('register-alert', result.data?.message || 'Registration failed. Please try again.');
    return;
  }

  showToast('Account created! Please log in.', 'success');
  setTimeout(() => { window.location.href = 'login.html'; }, 1000);
}

// ---------------------------------------------------------------------------
// Logout
// ---------------------------------------------------------------------------

function logout(redirectTo = 'index.html') {
  clearSession();
  showToast('You have been logged out.', 'success');
  setTimeout(() => { window.location.href = redirectTo; }, 400);
}

// ---------------------------------------------------------------------------
// Hamburger menu
// ---------------------------------------------------------------------------

function initHamburger() {
  const btn     = document.getElementById('hamburger');
  const overlay = document.getElementById('nav-overlay');
  if (!btn || !overlay) return;
  btn.addEventListener('click', () => overlay.classList.toggle('open'));
  // Close when any nav link inside overlay is clicked
  overlay.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => overlay.classList.remove('open'));
  });
}

// ---------------------------------------------------------------------------
// Bootstrap on DOM ready
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  updateNavbarAuth();
  initHamburger();
  initPasswordToggle('login-password', 'toggle-login-pwd');
  initPasswordToggle('reg-password', 'toggle-reg-pwd');
  initPasswordToggle('reg-confirm', 'toggle-reg-confirm');

  const loginForm    = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm)    loginForm.addEventListener('submit', handleLoginSubmit);
  if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
});
