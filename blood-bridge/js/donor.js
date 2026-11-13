/* ============================================================
   Blood Bridge – donor.js
   Donor dashboard and registration form logic.
   ============================================================ */

// ── Utility ───────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Donor Registration Form ────────────────────────────────
function initDonorRegisterForm() {
  const form = document.getElementById('donor-register-form');
  if (!form) return;

  const dobInput        = document.getElementById('dr-dob');
  const ageInput        = document.getElementById('dr-age');
  const firstTimeCheck  = document.getElementById('dr-first-time');
  const lastDonGroup    = document.getElementById('last-donation-group');
  const lastDonInput    = document.getElementById('dr-last-donation');
  const lastDonReq      = document.getElementById('last-donation-req');
  const eligWarn        = document.getElementById('eligibility-warning');
  const ageBlockBanner  = document.getElementById('age-block-banner');
  const submitBtn       = document.getElementById('dr-submit-btn');

  // Auto-calculate age from DOB
  if (dobInput) {
    dobInput.addEventListener('change', () => {
      const dob = new Date(dobInput.value);
      if (isNaN(dob)) { ageInput.value = ''; return; }
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;

      ageInput.value = age;

      if (age < 18) {
        ageBlockBanner.style.display = 'flex';
        submitBtn.disabled = true;
      } else {
        ageBlockBanner.style.display = 'none';
        submitBtn.disabled = false;
      }
    });
  }

  // First-time donor toggle
  if (firstTimeCheck) {
    firstTimeCheck.addEventListener('change', () => {
      const isFirst = firstTimeCheck.checked;
      if (lastDonInput) lastDonInput.required = !isFirst;
      if (lastDonReq)   lastDonReq.style.display = isFirst ? 'none' : 'inline';
      if (lastDonInput) lastDonInput.value = '';
      if (eligWarn)     eligWarn.classList.remove('show');
      clearFieldError('dr-last-donation');
    });
  }

  // Eligibility warning (56-day interval)
  if (lastDonInput) {
    lastDonInput.addEventListener('change', () => {
      const lastDate = new Date(lastDonInput.value);
      if (isNaN(lastDate)) { eligWarn?.classList.remove('show'); return; }
      const daysSince = (new Date() - lastDate) / (1000 * 60 * 60 * 24);
      if (daysSince < 56) {
        eligWarn?.classList.add('show');
      } else {
        eligWarn?.classList.remove('show');
      }
    });
  }

  form.addEventListener('submit', handleDonorRegisterSubmit);
}

async function handleDonorRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearAllErrors(form);
  hideAlert('donor-reg-alert');

  // Age block check
  const age = parseInt(document.getElementById('dr-age')?.value, 10);
  if (age < 18) {
    showAlert('donor-reg-alert', 'You must be at least 18 years old to register as a donor.', 'danger');
    return;
  }

  const isFirstTime = document.getElementById('dr-first-time')?.checked;

  const checks = [
    validateRequired('dr-name', 'Full name is required.'),
    validateEmail('dr-email'),
    validatePhone('dr-phone'),
    validateRequired('dr-dob', 'Date of birth is required.'),
    validateRequired('dr-blood-group', 'Blood group is required.'),
    validateRequired('dr-availability', 'Please select your availability.'),
    validateRequired('dr-city', 'City is required.'),
  ];

  if (!isFirstTime) {
    checks.push(validateRequired('dr-last-donation', 'Last donation date is required (or check first-time donor).'));
  }

  const consentCheck = document.getElementById('dr-consent');
  if (consentCheck && !consentCheck.checked) {
    showFieldError('dr-consent', 'You must accept the consent statement to register.');
    checks.push(false);
  }

  if (checks.some(v => !v)) return;

  const btn     = document.getElementById('dr-submit-btn');
  const restore = setButtonLoading(btn, 'Registering…');

  const payload = {
    name:          document.getElementById('dr-name').value.trim(),
    email:         document.getElementById('dr-email').value.trim(),
    phone:         document.getElementById('dr-phone').value.trim(),
    dob:           document.getElementById('dr-dob').value,
    age:           age,
    blood_group:   document.getElementById('dr-blood-group').value,
    available:     document.getElementById('dr-availability').value === 'available',
    first_time:    isFirstTime,
    last_donation: isFirstTime ? null : document.getElementById('dr-last-donation').value,
    city:          document.getElementById('dr-city').value,
  };

  const result = await apiRegisterDonor(payload);
  restore();

  if (!result.ok) {
    showAlert('donor-reg-alert', result.data?.message || 'Registration failed. Please try again.', 'danger');
    return;
  }

  // Show success modal
  const modal = document.getElementById('success-modal');
  if (modal) modal.classList.add('open');
  else {
    showToast('Donor registered successfully!', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  }
}

// ── Donor Dashboard ────────────────────────────────────────
let _incomingRequests = [];
let _acceptedIds      = new Set(); // track accepted request IDs this session

function initDonorDashboard() {
  if (!document.getElementById('incoming-grid')) return;

  const user = getCurrentUser();
  if (user) {
    const welcomeEl = document.getElementById('donor-welcome');
    const nameEl    = document.getElementById('nav-user-name');
    if (welcomeEl) welcomeEl.textContent = `Welcome back, ${user.name.split(' ')[0]}!`;
    if (nameEl)    nameEl.textContent    = user.name.split(' ')[0];
  }

  loadDonorProfile();
  loadIncomingRequests();
  loadDonationHistory();
}

async function loadDonorProfile() {
  const result = await apiGetDonorProfile();
  if (!result.ok) return;

  const donor = result.data;

  // Avatar initials
  const avatar = document.getElementById('profile-avatar');
  if (avatar) avatar.textContent = (donor.name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  const nameEl  = document.getElementById('profile-name');
  const metaEl  = document.getElementById('profile-meta');
  const tagsEl  = document.getElementById('profile-tags');

  if (nameEl) nameEl.textContent = donor.name || '—';
  if (metaEl) metaEl.innerHTML   = `${escHtml(donor.email)} · ${escHtml(donor.phone)}`;
  if (tagsEl) tagsEl.innerHTML   = `
    <span class="blood-badge">${escHtml(donor.blood_group)}</span>
    <span class="badge badge-info">${escHtml(donor.city)}</span>
    <span class="badge ${donor.available ? 'badge-accepted' : 'badge-cancelled'}">${donor.available ? 'Available' : 'Unavailable'}</span>
  `;

  // Availability toggle
  const toggle = document.getElementById('availability-toggle');
  if (toggle) toggle.checked = !!donor.available;

  // Dates
  const lastEl = document.getElementById('last-donation-date');
  const nextEl = document.getElementById('next-eligible-date');
  if (lastEl) lastEl.textContent = donor.last_donation   ? formatDate(donor.last_donation) : 'No donations yet';
  if (nextEl) nextEl.textContent = donor.next_eligible   ? formatDate(donor.next_eligible) : '—';

  // Stats
  const statDon = document.getElementById('stat-total-donations');
  if (statDon) statDon.textContent = donor.total_donations ?? 0;
}

async function toggleAvailability(available) {
  const result = await apiUpdateDonorAvailability(available);
  if (!result.ok) {
    showToast('Failed to update availability.', 'error');
    // Revert toggle
    const toggle = document.getElementById('availability-toggle');
    if (toggle) toggle.checked = !available;
    return;
  }
  showToast(available ? 'You are now available to donate.' : 'You are marked as unavailable.', 'success');
}

async function loadIncomingRequests() {
  const loading   = document.getElementById('incoming-loading');
  const container = document.getElementById('incoming-container');
  const empty     = document.getElementById('incoming-empty');
  const grid      = document.getElementById('incoming-grid');
  const statPend  = document.getElementById('stat-pending-resp');

  const result = await apiGetIncomingRequests();

  if (loading)   loading.style.display   = 'none';
  if (!result.ok) {
    showToast('Failed to load incoming requests.', 'error');
    return;
  }

  _incomingRequests = result.data;
  if (statPend) statPend.textContent = _incomingRequests.length;

  if (!_incomingRequests.length) {
    if (empty)     empty.style.display     = 'block';
    if (container) container.style.display = 'none';
    return;
  }

  if (container) container.style.display = 'block';
  if (empty)     empty.style.display     = 'none';
  if (grid) grid.innerHTML = _incomingRequests.map(req => renderIncomingCard(req)).join('');
}

function renderIncomingCard(req) {
  const alreadyAccepted = _acceptedIds.has(req.id);
  const urgencyBadge = req.urgency === 'high'
    ? '<span class="badge badge-critical">Urgent</span>'
    : '<span class="badge badge-info">Normal</span>';

  return `
    <div class="request-card" id="req-card-${req.id}">
      <div class="request-card-header">
        <div>
          <div style="font-size:15px; font-weight:700;">${escHtml(req.patient)}</div>
          <div style="font-size:13px; color:var(--color-text-muted); margin-top:2px;">Age: ${escHtml(req.age)}</div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px;">
          <span class="blood-badge">${escHtml(req.blood_group)}</span>
          ${urgencyBadge}
        </div>
      </div>
      <div class="request-card-body">
        <div class="request-info-row">🏥 <strong>${escHtml(req.hospital)}</strong></div>
        <div class="request-info-row">📍 ${escHtml(req.city || req.pincode || '—')}</div>
        <div class="request-info-row">🩸 Units needed: <strong>${escHtml(req.units)}</strong></div>
        <div class="request-info-row">📅 ${escHtml(req.date)}</div>
      </div>
      <div class="request-card-footer">
        ${alreadyAccepted
          ? `<span class="badge badge-accepted" style="font-size:13px; padding:6px 14px;">✓ Accepted</span>`
          : `<button class="btn btn-success btn-block" id="accept-btn-${req.id}" onclick="acceptRequest(${req.id})">Accept Request</button>`
        }
      </div>
    </div>`;
}

async function acceptRequest(requestId) {
  const btn     = document.getElementById(`accept-btn-${requestId}`);
  if (!btn) return;
  const restore = setButtonLoading(btn, 'Accepting…');

  const result = await apiAcceptRequest(requestId);
  restore();

  if (!result.ok) {
    if (result.status === 409) {
      // Already accepted by another donor
      _acceptedIds.add(requestId); // prevent future clicks
      btn.disabled  = true;
      btn.textContent = 'No longer available';
      btn.className = 'btn btn-ghost btn-block';
      showToast('This request has already been accepted by another donor.', 'warning');
    } else {
      showToast(result.data?.message || 'Failed to accept request.', 'error');
    }
    return;
  }

  // Success – update UI
  _acceptedIds.add(requestId);
  const footer = btn.closest('.request-card-footer');
  if (footer) {
    footer.innerHTML = `<span class="badge badge-accepted" style="font-size:13px; padding:6px 14px;">✓ Accepted</span>`;
  }

  // Update accepted stat counter
  const statAccepted = document.getElementById('stat-accepted-req');
  if (statAccepted) statAccepted.textContent = parseInt(statAccepted.textContent || '0', 10) + 1;

  showToast('Request accepted! Please coordinate with the patient.', 'success');
}

async function loadDonationHistory() {
  // For now, show accepted requests as history
  const loading   = document.getElementById('history-loading');
  const container = document.getElementById('history-container');
  const empty     = document.getElementById('history-empty');
  const tbody     = document.getElementById('history-tbody');

  // Reuse blood requests data as placeholder (would be separate endpoint in real API)
  const result = await apiGetMyRequests();

  if (loading) loading.style.display = 'none';
  if (!result.ok) return;

  const accepted = result.data.filter(r => r.status === 'accepted');
  const statAccepted = document.getElementById('stat-accepted-req');
  if (statAccepted) statAccepted.textContent = accepted.length;

  if (!accepted.length) {
    if (empty)     empty.style.display     = 'block';
    if (container) container.style.display = 'none';
    return;
  }

  if (container) container.style.display = 'block';
  if (empty)     empty.style.display     = 'none';
  if (tbody) {
    tbody.innerHTML = accepted.map(req => `
      <tr>
        <td><strong>${escHtml(req.patient)}</strong></td>
        <td><span class="blood-badge blood-badge-sm">${escHtml(req.blood_group)}</span></td>
        <td>${escHtml(req.units)}</td>
        <td style="font-size:13px;">${escHtml(req.hospital)}</td>
        <td style="font-size:13px; color:var(--color-text-muted);">${escHtml(req.date)}</td>
        <td><span class="badge badge-accepted">Accepted</span></td>
      </tr>
    `).join('');
  }
}

// ── Helpers ────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDonorRegisterForm();
  initDonorDashboard();
});
