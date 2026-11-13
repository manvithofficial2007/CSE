/* ============================================================
   Blood Bridge – admin.js
   Admin dashboard logic: stats, donors, requests, blood banks.
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
let _adminDonors   = [];
let _adminRequests = [];
let _adminBanks    = [];
let _editingBankId = null;
let _stockBankId   = null;

// ── Tab navigation ─────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));

  const panel   = document.getElementById(`tab-${tabId}`);
  const sideBtn = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);

  if (panel)   panel.classList.add('active');
  if (sideBtn) sideBtn.classList.add('active');

  // Lazy load data for the activated tab
  if (tabId === 'overview')   loadOverviewData();
  if (tabId === 'donors')     loadDonorsTab();
  if (tabId === 'requests')   loadRequestsTab();
  if (tabId === 'bloodbanks') loadBanksTab();
}

// Wire up sidebar links
function initAdminNav() {
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab(link.dataset.tab);
    });
  });
}

// ── Overview tab ───────────────────────────────────────────
async function loadOverviewData() {
  const statsResult = await apiGetAdminStats();
  if (statsResult.ok) {
    const s = statsResult.data;
    setText('adm-stat-donors',     s.total_donors);
    setText('adm-stat-requesters', s.total_requesters);
    setText('adm-stat-requests',   s.total_requests);
    setText('adm-stat-pending',    s.pending_requests);
    setText('adm-stat-banks',      s.blood_banks);
  }

  const reqsResult = await apiGetAllRequests();
  const loading    = document.getElementById('overview-requests-loading');
  const container  = document.getElementById('overview-requests-container');

  if (loading)  loading.style.display  = 'none';
  if (container) container.style.display = 'block';

  if (reqsResult.ok) {
    const tbody = document.getElementById('overview-requests-tbody');
    if (tbody) {
      tbody.innerHTML = reqsResult.data.slice(0, 5).map(req => `
        <tr>
          <td><strong>${escHtml(req.patient)}</strong><br/><span style="font-size:12px; color:var(--color-text-muted);">Age: ${escHtml(req.age)}</span></td>
          <td><span class="blood-badge blood-badge-sm">${escHtml(req.blood_group)}</span></td>
          <td style="font-size:13px;">${escHtml(req.hospital)}</td>
          <td style="font-size:13px; color:var(--color-text-muted);">${escHtml(req.date)}</td>
          <td>${statusBadge(req.status)}</td>
        </tr>
      `).join('');
    }
  }
}

// ── Donors tab ─────────────────────────────────────────────
async function loadDonorsTab() {
  const loading   = document.getElementById('donors-loading');
  const container = document.getElementById('donors-container');

  const result = await apiGetAllDonors();
  if (loading)   loading.style.display   = 'none';
  if (container) container.style.display = 'block';

  if (!result.ok) { showToast('Failed to load donors.', 'error'); return; }
  _adminDonors = result.data;
  renderDonorsTable(_adminDonors);
}

function renderDonorsTable(donors) {
  const tbody = document.getElementById('donors-tbody');
  if (!tbody) return;
  tbody.innerHTML = donors.map((d, i) => `
    <tr>
      <td style="color:var(--color-text-muted); font-size:13px;">${i + 1}</td>
      <td><strong>${escHtml(d.name)}</strong></td>
      <td><span class="blood-badge blood-badge-sm">${escHtml(d.blood_group)}</span></td>
      <td>${escHtml(d.city || '—')}</td>
      <td><span class="badge ${d.available ? 'badge-accepted' : 'badge-cancelled'}">${d.available ? 'Available' : 'Unavailable'}</span></td>
      <td>${escHtml(d.total_donations ?? 0)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm" onclick="viewDonor(${d.id})">View</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterDonorsTable() {
  const q = document.getElementById('donor-search')?.value.toLowerCase() || '';
  const filtered = _adminDonors.filter(d =>
    d.name.toLowerCase().includes(q) || d.blood_group.toLowerCase().includes(q)
  );
  renderDonorsTable(filtered);
}

function viewDonor(id) {
  showToast('Donor detail view will be available via backend API.', 'warning');
}

// ── Requests tab ───────────────────────────────────────────
async function loadRequestsTab() {
  const loading   = document.getElementById('adm-requests-loading');
  const container = document.getElementById('adm-requests-container');

  const result = await apiGetAllRequests();
  if (loading)   loading.style.display   = 'none';
  if (container) container.style.display = 'block';

  if (!result.ok) { showToast('Failed to load requests.', 'error'); return; }
  _adminRequests = result.data;
  renderAdminRequests();
}

function renderAdminRequests() {
  const filter = document.getElementById('adm-req-filter')?.value || '';
  const list   = filter ? _adminRequests.filter(r => r.status === filter) : _adminRequests;
  const tbody  = document.getElementById('adm-requests-tbody');
  const count  = document.getElementById('adm-req-count');

  if (count) count.textContent = `${list.length} request${list.length !== 1 ? 's' : ''}`;

  if (!tbody) return;
  tbody.innerHTML = list.map((req, i) => `
    <tr>
      <td style="color:var(--color-text-muted); font-size:13px;">${i + 1}</td>
      <td><strong>${escHtml(req.patient)}</strong><br/><span style="font-size:12px; color:var(--color-text-muted);">Age: ${escHtml(req.age)}</span></td>
      <td><span class="blood-badge blood-badge-sm">${escHtml(req.blood_group)}</span></td>
      <td>${escHtml(req.units)}</td>
      <td style="font-size:13px;">${escHtml(req.hospital)}</td>
      <td style="font-size:13px; color:var(--color-text-muted);">${escHtml(req.date)}</td>
      <td>${statusBadge(req.status)}</td>
    </tr>
  `).join('');
}

// ── Blood banks tab ────────────────────────────────────────
async function loadBanksTab() {
  const loading   = document.getElementById('banks-loading');
  const container = document.getElementById('banks-container');

  const result = await apiGetBloodBanks();
  if (loading)   loading.style.display   = 'none';
  if (container) container.style.display = 'block';

  if (!result.ok) { showToast('Failed to load blood banks.', 'error'); return; }
  _adminBanks = result.data;
  renderBanksTable(_adminBanks);
}

function renderBanksTable(banks) {
  const tbody = document.getElementById('banks-tbody');
  if (!tbody) return;
  tbody.innerHTML = banks.map((bank, i) => {
    const units    = bank.units;
    const unitsCls = units === 0 ? 'color:var(--color-danger)' : units <= 2 ? 'color:var(--color-warning)' : 'color:var(--color-success)';
    return `
      <tr>
        <td style="color:var(--color-text-muted); font-size:13px;">${i + 1}</td>
        <td><strong>${escHtml(bank.name)}</strong><br/><span style="font-size:12px; color:var(--color-text-muted);">${escHtml(bank.address)}</span></td>
        <td><span class="blood-badge blood-badge-sm">${escHtml(bank.blood_group)}</span></td>
        <td><strong style="${unitsCls}">${escHtml(units)}</strong></td>
        <td style="font-size:13px;">${escHtml(bank.contact)}</td>
        <td style="font-size:13px; color:var(--color-text-muted);">${escHtml(bank.updated)}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-sm" onclick="openStockModal(${bank.id})">Update Stock</button>
            <button class="btn btn-ghost btn-sm" onclick="openEditBankModal(${bank.id})">Edit</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

// ── Add / Edit blood bank modal ────────────────────────────
function openAddBankModal() {
  _editingBankId = null;
  document.getElementById('bank-modal-title').textContent = 'Add Blood Bank';
  document.getElementById('bank-name').value        = '';
  document.getElementById('bank-address').value     = '';
  document.getElementById('bank-city').value        = '';
  document.getElementById('bank-blood-group').value = '';
  document.getElementById('bank-units').value       = '';
  document.getElementById('bank-contact').value     = '';
  document.getElementById('bank-email').value       = '';
  document.getElementById('bank-phone').value       = '';
  document.getElementById('bank-password').value    = '';
  // Show credentials section for new banks
  document.getElementById('bank-credentials-section').style.display = '';
  document.getElementById('save-bank-btn').textContent = 'Create Blood Bank';
  document.getElementById('bank-modal').classList.add('open');
}

function openEditBankModal(id) {
  const bank = _adminBanks.find(b => b.id === id);
  if (!bank) return;
  _editingBankId = id;
  document.getElementById('bank-modal-title').textContent = 'Edit Blood Bank';
  document.getElementById('bank-name').value        = bank.name;
  document.getElementById('bank-address').value     = bank.address;
  document.getElementById('bank-city').value        = bank.city || '';
  document.getElementById('bank-blood-group').value = bank.blood_group;
  document.getElementById('bank-units').value       = bank.units;
  document.getElementById('bank-contact').value     = bank.contact;
  // Hide credentials section when editing
  document.getElementById('bank-credentials-section').style.display = 'none';
  document.getElementById('save-bank-btn').textContent = 'Save Changes';
  document.getElementById('bank-modal').classList.add('open');
}

function closeBankModal() {
  document.getElementById('bank-modal').classList.remove('open');
  _editingBankId = null;
}

/** Generate a random strong password and fill the field */
function genPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789@#$!';
  let pwd = '';
  for (let i = 0; i < 12; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
  document.getElementById('bank-password').value = pwd;
}

async function saveBloodBank() {
  const name       = document.getElementById('bank-name').value.trim();
  const address    = document.getElementById('bank-address').value.trim();
  const city       = document.getElementById('bank-city').value.trim();
  const bloodGroup = document.getElementById('bank-blood-group').value;
  const units      = document.getElementById('bank-units').value;
  const contact    = document.getElementById('bank-contact').value.trim();

  let valid = true;
  if (!name)       { showFieldError('bank-name',        'Name is required.');         valid = false; }
  if (!address)    { showFieldError('bank-address',     'Address is required.');       valid = false; }
  if (!city)       { showFieldError('bank-city',        'City is required.');          valid = false; }
  if (!bloodGroup) { showFieldError('bank-blood-group', 'Blood group required.');      valid = false; }
  if (!units && units !== '0') { showFieldError('bank-units', 'Units required.');      valid = false; }
  if (!contact)    { showFieldError('bank-contact',     'Contact required.');          valid = false; }

  // ── EDITING: just update the bank record ──
  if (_editingBankId) {
    if (!valid) return;
    const btn     = document.getElementById('save-bank-btn');
    const restore = setButtonLoading(btn, 'Saving…');
    const result  = await apiUpdateBloodStock(_editingBankId, {
      name, address, city, blood_group: bloodGroup, units: parseInt(units, 10), contact,
    });
    restore();
    if (!result.ok) { showToast(result.data?.message || 'Failed to save.', 'error'); return; }
    closeBankModal();
    showToast('Blood bank updated.', 'success');
    loadBanksTab();
    return;
  }

  // ── ADDING: validate credentials too ──
  const email    = document.getElementById('bank-email').value.trim().toLowerCase();
  const phone    = document.getElementById('bank-phone').value.trim();
  const password = document.getElementById('bank-password').value;

  if (!email)                           { showFieldError('bank-email',    'Email is required.');          valid = false; }
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showFieldError('bank-email', 'Enter a valid email.'); valid = false; }
  if (!phone || !/^\d{10}$/.test(phone)){ showFieldError('bank-phone',    'Enter a valid 10-digit number.'); valid = false; }
  if (!password || password.length < 8) { showFieldError('bank-password', 'Password must be at least 8 characters.'); valid = false; }
  if (!valid) return;

  const btn     = document.getElementById('save-bank-btn');
  const restore = setButtonLoading(btn, 'Creating…');

  const result = await apiRegisterBloodBank({
    name, email, phone, password,
    address, city, blood_group: bloodGroup, units: parseInt(units, 10), contact,
  });
  restore();

  if (!result.ok) {
    showToast(result.error || 'Failed to create blood bank.', 'error');
    return;
  }

  closeBankModal();
  loadBanksTab();

  // Show credentials modal
  document.getElementById('cred-bank-name').textContent = name;
  document.getElementById('cred-email').textContent     = email;
  document.getElementById('cred-password').textContent  = password;
  document.getElementById('cred-modal').classList.add('open');
}

// ── Credentials modal ──────────────────────────────────────
function closeCredModal() {
  document.getElementById('cred-modal').classList.remove('open');
}

function copyCredentials() {
  const bankName = document.getElementById('cred-bank-name').textContent;
  const email    = document.getElementById('cred-email').textContent;
  const password = document.getElementById('cred-password').textContent;
  const text = `Blood Bank: ${bankName}\nLogin Email: ${email}\nPassword: ${password}\nPortal: blood-bank-login.html`;
  navigator.clipboard.writeText(text).then(() => {
    showToast('Credentials copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy. Please copy manually.', 'warning');
  });
}

// ── Stock update modal ─────────────────────────────────────
function openStockModal(id) {
  const bank = _adminBanks.find(b => b.id === id);
  if (!bank) return;
  _stockBankId = id;
  document.getElementById('stock-modal-bank-name').textContent = `Updating stock for: ${bank.name}`;
  document.getElementById('stock-units').value = bank.units;
  document.getElementById('stock-modal').classList.add('open');
}

function closeStockModal() {
  document.getElementById('stock-modal').classList.remove('open');
  _stockBankId = null;
}

async function saveStock() {
  const unitsEl = document.getElementById('stock-units');
  if (!unitsEl.value && unitsEl.value !== '0') {
    showFieldError('stock-units', 'Units are required.');
    return;
  }

  const btn     = document.getElementById('save-stock-btn');
  const restore = setButtonLoading(btn, 'Updating…');

  const result = await apiUpdateBloodStock(_stockBankId, { units: parseInt(unitsEl.value, 10) });
  restore();

  if (!result.ok) {
    showToast(result.data?.message || 'Update failed.', 'error');
    return;
  }

  closeStockModal();
  showToast('Stock updated successfully.', 'success');
  loadBanksTab();
}

// ── Helper ─────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initAdminNav();

  // Show current date
  const dateEl = document.getElementById('admin-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

  // Load overview by default
  loadOverviewData();
});
