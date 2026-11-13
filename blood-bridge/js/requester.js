/* ============================================================
   Blood Bridge – requester.js
   Requester dashboard and blood request form logic.
   ============================================================ */

// ── Utility ───────────────────────────────────────────────
function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function statusBadge(status) {
  const map = {
    pending:   '<span class="badge badge-pending">Pending</span>',
    accepted:  '<span class="badge badge-accepted">Accepted</span>',
    cancelled: '<span class="badge badge-cancelled">Cancelled</span>',
  };
  return map[status] || `<span class="badge">${escHtml(status)}</span>`;
}

// ── State ──────────────────────────────────────────────────
let _allRequests   = [];
let _cancelTarget  = null;
let _currentRequest = null; // used by blood-request.html step 2

// ── Dashboard page ─────────────────────────────────────────
function initRequesterDashboard() {
  if (!document.getElementById('requests-tbody')) return;

  const user = getCurrentUser();
  if (user) {
    const el = document.getElementById('req-welcome');
    if (el) el.textContent = `Welcome back, ${user.name.split(' ')[0]}. Here are your blood requests.`;
    const nameEl = document.getElementById('nav-user-name');
    if (nameEl) nameEl.textContent = user.name.split(' ')[0];
  }

  loadRequests();
}

async function loadRequests() {
  const result = await apiGetMyRequests();
  const loading   = document.getElementById('table-loading');
  const container = document.getElementById('table-container');
  const empty     = document.getElementById('requests-empty');

  if (loading) loading.style.display = 'none';

  if (!result.ok) {
    showToast('Failed to load requests.', 'error');
    return;
  }

  _allRequests = result.data;
  renderStats(_allRequests);
  renderRequestsTable(_allRequests);

  const hasRows = _allRequests.length > 0;
  if (container) container.style.display = hasRows ? 'block' : 'none';
  if (empty)     empty.style.display     = hasRows ? 'none'  : 'block';
}

function renderStats(requests) {
  const total     = requests.length;
  const pending   = requests.filter(r => r.status === 'pending').length;
  const accepted  = requests.filter(r => r.status === 'accepted').length;
  const cancelled = requests.filter(r => r.status === 'cancelled').length;

  setText('stat-total',     total);
  setText('stat-pending',   pending);
  setText('stat-accepted',  accepted);
  setText('stat-cancelled', cancelled);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function renderRequestsTable(requests) {
  const tbody = document.getElementById('requests-tbody');
  if (!tbody) return;

  if (!requests.length) {
    const container = document.getElementById('table-container');
    const empty     = document.getElementById('requests-empty');
    if (container) container.style.display = 'none';
    if (empty)     empty.style.display     = 'block';
    return;
  }

  tbody.innerHTML = requests.map((req, i) => `
    <tr>
      <td style="color:var(--color-text-muted); font-size:13px;">${i + 1}</td>
      <td><strong>${escHtml(req.patient)}</strong><br/><span style="font-size:12px; color:var(--color-text-muted);">Age: ${escHtml(req.age)}</span></td>
      <td><span class="blood-badge blood-badge-sm">${escHtml(req.blood_group)}</span></td>
      <td>${escHtml(req.units)}</td>
      <td style="font-size:13px;">${escHtml(req.hospital)}</td>
      <td style="font-size:13px; color:var(--color-text-muted);">${escHtml(req.date)}</td>
      <td>${statusBadge(req.status)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewRequestDetails(${req.id})">Details</button>
          ${req.status === 'pending' ? `<button class="btn btn-sm" style="background:var(--color-danger-light);color:var(--color-danger);border-color:var(--color-danger-light);" onclick="openCancelModal(${req.id})">Cancel</button>` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterRequests() {
  const filter = document.getElementById('filter-status')?.value || '';
  const filtered = filter ? _allRequests.filter(r => r.status === filter) : _allRequests;
  renderRequestsTable(filtered);
  const container = document.getElementById('table-container');
  const empty     = document.getElementById('requests-empty');
  if (container) container.style.display = filtered.length ? 'block' : 'none';
  if (empty)     empty.style.display     = filtered.length ? 'none'  : 'block';
}

// ── Request details modal ──────────────────────────────────
function viewRequestDetails(id) {
  const req = _allRequests.find(r => r.id === id);
  if (!req) return;

  const body = document.getElementById('details-modal-body');
  if (body) {
    body.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; font-size:14px;">
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Patient</span><div style="margin-top:4px;font-weight:600;">${escHtml(req.patient)}, Age ${escHtml(req.age)}</div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Blood Group</span><div style="margin-top:4px;"><span class="blood-badge blood-badge-sm">${escHtml(req.blood_group)}</span></div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Units Required</span><div style="margin-top:4px;font-weight:600;">${escHtml(req.units)}</div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Status</span><div style="margin-top:4px;">${statusBadge(req.status)}</div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Hospital</span><div style="margin-top:4px;font-weight:600;">${escHtml(req.hospital)}</div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">City</span><div style="margin-top:4px;">${escHtml(req.city || '—')}</div></div>
        <div><span style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--color-text-muted);">Date</span><div style="margin-top:4px;">${escHtml(req.date)}</div></div>
      </div>`;
  }
  document.getElementById('details-modal')?.classList.add('open');
}

function closeDetailsModal() {
  document.getElementById('details-modal')?.classList.remove('open');
}

// ── Cancel modal ───────────────────────────────────────────
function openCancelModal(id) {
  _cancelTarget = id;
  document.getElementById('cancel-modal')?.classList.add('open');
}

function closeCancelModal() {
  _cancelTarget = null;
  document.getElementById('cancel-modal')?.classList.remove('open');
}

async function confirmCancel() {
  if (!_cancelTarget) return;
  const btn     = document.getElementById('confirm-cancel-btn');
  const restore = setButtonLoading(btn, 'Cancelling…');

  const result = await apiCancelRequest(_cancelTarget);
  restore();

  if (!result.ok) {
    showToast(result.data?.message || 'Failed to cancel.', 'error');
    return;
  }

  // Update local state
  const req = _allRequests.find(r => r.id === _cancelTarget);
  if (req) req.status = 'cancelled';

  closeCancelModal();
  renderStats(_allRequests);
  renderRequestsTable(_allRequests);
  showToast('Request cancelled.', 'success');
}

// ── Blood request form (blood-request.html) ────────────────
let _submittedRequest = null;

function initBloodRequestForm() {
  const form = document.getElementById('blood-request-form');
  if (!form) return;
  form.addEventListener('submit', handleBloodRequestSubmit);
}

async function handleBloodRequestSubmit(e) {
  e.preventDefault();
  const form = e.target;
  clearAllErrors(form);
  hideAlert('request-alert');

  const checks = [
    validateRequired('req-name', 'Patient / Attender name is required.'),
    validateRequired('req-age', 'Age is required.'),
    validateRequired('req-blood-group', 'Blood group is required.'),
    validateRequired('req-units', 'Units required.'),
    validatePhone('req-contact'),
    validateRequired('req-hospital', 'Hospital name is required.'),
    validateRequired('req-city', 'City is required.'),
  ];

  if (checks.some(v => !v)) return;

  const payload = {
    patient:     document.getElementById('req-name').value.trim(),
    age:         document.getElementById('req-age').value,
    blood_group: document.getElementById('req-blood-group').value,
    units:       document.getElementById('req-units').value,
    contact:     document.getElementById('req-contact').value.trim(),
    hospital:    document.getElementById('req-hospital').value.trim(),
    city:        document.getElementById('req-city').value,
    notes:       document.getElementById('req-notes')?.value.trim() || '',
  };

  _submittedRequest = payload;
  showBankStep(payload);
}

async function showBankStep(payload) {
  const formStep = document.getElementById('request-form-step');
  const bankStep = document.getElementById('blood-bank-step');
  const loading  = document.getElementById('bb-results-loading');
  const container= document.getElementById('bb-results-container');
  const summary  = document.getElementById('bb-search-summary');

  if (formStep) formStep.style.display = 'none';
  if (bankStep) bankStep.style.display = 'block';

  // Update step indicators
  updateStepIndicator(1, false);
  updateStepIndicator(2, true);

  if (summary) summary.textContent = `Checking blood banks in ${payload.city} for blood group ${payload.blood_group}…`;
  if (loading)   loading.style.display   = 'block';
  if (container) container.style.display = 'none';

  const result = await apiSearchBloodBanks(payload.blood_group, payload.city);

  if (loading) loading.style.display = 'none';
  if (container) container.style.display = 'block';

  if (!result.ok) {
    if (summary) summary.textContent = 'Failed to load blood bank data.';
    return;
  }

  const banks = result.data;
  const sufficient = banks.filter(b => b.units >= parseInt(payload.units, 10));
  const insufficientSection = document.getElementById('notify-donors-section');

  if (summary) {
    summary.textContent = `Found ${banks.length} blood bank(s) in ${payload.city}. ${sufficient.length} have sufficient stock (${payload.units} unit${payload.units != 1 ? 's' : ''}).`;
  }

  if (banks.length === 0 || sufficient.length === 0) {
    // No sufficient stock → show notify donors
    if (container) container.innerHTML = banks.length === 0
      ? '<p style="padding:16px; font-size:14px; color:var(--color-text-muted);">No registered blood banks found in your city.</p>'
      : renderBankCards(banks);
    if (insufficientSection) insufficientSection.style.display = 'block';
  } else {
    if (container) container.innerHTML = renderBankCards(banks);
    if (insufficientSection) insufficientSection.style.display = 'none';
  }
}

function renderBankCards(banks) {
  return banks.map(bank => {
    const units = bank.units;
    const unitsCls = units === 0 ? 'units-none' : units <= 2 ? 'units-low' : 'units-available';
    const unitsLbl = units === 0 ? 'Out of stock' : `${units} unit${units !== 1 ? 's' : ''} available`;
    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:14px 20px; border-bottom:1px solid var(--color-border-light); flex-wrap:wrap; gap:12px;">
        <div>
          <div style="font-size:14px; font-weight:700;">${escHtml(bank.name)}</div>
          <div style="font-size:12px; color:var(--color-text-muted); margin-top:2px;">📍 ${escHtml(bank.address)} · 📞 ${escHtml(bank.contact)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <span style="padding:3px 10px; border-radius:20px; font-size:12px; font-weight:700;" class="${unitsCls} bb-units-badge">${unitsLbl}</span>
          <a class="btn btn-primary btn-sm" href="tel:${escHtml(bank.contact)}">📞 Call</a>
        </div>
      </div>`;
  }).join('');
}

function showRequestStep() {
  const formStep = document.getElementById('request-form-step');
  const bankStep = document.getElementById('blood-bank-step');
  if (formStep) formStep.style.display = 'block';
  if (bankStep) bankStep.style.display = 'none';
  updateStepIndicator(1, true);
  updateStepIndicator(2, false);
}

function updateStepIndicator(num, active) {
  const el = document.getElementById(`step-ind-${num}`);
  if (!el) return;
  const dot = el.querySelector('span');
  el.style.color = active ? 'var(--color-primary)' : 'var(--color-text-muted)';
  if (dot) {
    dot.style.background = active ? 'var(--color-primary)' : 'var(--color-border)';
    dot.style.color      = active ? '#fff' : 'var(--color-text-muted)';
  }
}

async function notifyDonors() {
  const btn     = document.getElementById('notify-donors-btn');
  const restore = setButtonLoading(btn, 'Notifying…');

  const result = await apiSubmitBloodRequest(_submittedRequest);
  restore();

  if (!result.ok) {
    showToast(result.data?.message || 'Failed to submit request.', 'error');
    return;
  }

  document.getElementById('notify-donors-section').style.display = 'none';
  document.getElementById('request-submitted').style.display    = 'block';
  showToast('Donors notified successfully!', 'success');
}

// ── Init on page load ──────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initRequesterDashboard();
  initBloodRequestForm();
});
