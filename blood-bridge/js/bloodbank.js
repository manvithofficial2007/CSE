/* ============================================================
   Blood Bridge – bloodbank.js
   Blood Bank Portal dashboard: overview, stock update by
   blood group, full inventory table.
   ============================================================ */

// ── Constants ─────────────────────────────────────────────
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// ── State ──────────────────────────────────────────────────
let _allBanks    = [];   // full list from API
let _quickBankId = null; // id used by quick-update modal

// ── Helpers ────────────────────────────────────────────────
function escH(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function unitClass(n) {
  if (n === 0)  return 'none';
  if (n <= 2)   return 'low';
  return 'ok';
}

function unitStatusLabel(n) {
  if (n === 0)  return 'No Stock';
  if (n <= 2)   return 'Low Stock';
  return 'Available';
}

// ── Tab navigation ─────────────────────────────────────────
function bbSwitchTab(tabId) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(l => l.classList.remove('active'));

  const panel = document.getElementById(`tab-${tabId}`);
  const link  = document.querySelector(`.sidebar-link[data-tab="${tabId}"]`);
  if (panel) panel.classList.add('active');
  if (link)  link.classList.add('active');

  if (tabId === 'overview') loadOverview();
  if (tabId === 'stock')    loadBankSelector();
  if (tabId === 'history')  loadHistory();
}

function initBBNav() {
  document.querySelectorAll('.sidebar-link[data-tab]').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      bbSwitchTab(link.dataset.tab);
    });
  });
}

// ── Load all banks (shared) ────────────────────────────────
async function fetchAllBanks() {
  const result = await apiGetBloodBanks();
  if (result.ok) _allBanks = result.data;
  return result;
}

// ── OVERVIEW TAB ───────────────────────────────────────────
async function loadOverview() {
  const loading = document.getElementById('ov-loading');
  const grid    = document.getElementById('ov-bg-grid');
  if (loading) loading.style.display = '';
  if (grid)    grid.style.display    = 'none';

  await fetchAllBanks();

  // Summary strip
  const totalUnits  = _allBanks.reduce((s, b) => s + (b.units || 0), 0);
  const lowOrNone   = _allBanks.filter(b => b.units <= 2).length;
  const cities      = new Set(_allBanks.map(b => b.city)).size;

  setText('ov-total-banks', _allBanks.length);
  setText('ov-total-units', totalUnits);
  setText('ov-low-stock',   lowOrNone);
  setText('ov-cities',      cities);

  // Aggregate units per blood group
  const bgTotals = {};
  BLOOD_GROUPS.forEach(bg => { bgTotals[bg] = 0; });
  _allBanks.forEach(b => {
    if (bgTotals[b.blood_group] !== undefined) bgTotals[b.blood_group] += b.units;
  });

  if (grid) {
    grid.innerHTML = BLOOD_GROUPS.map(bg => {
      const units = bgTotals[bg];
      const cls   = unitClass(units);
      const lbl   = unitStatusLabel(units);
      const count = _allBanks.filter(b => b.blood_group === bg).length;
      return `
        <div class="bg-card">
          <div class="bg-card-header">
            <span class="bg-card-name">${count} bank${count !== 1 ? 's' : ''}</span>
            <span class="blood-badge blood-badge-sm">${escH(bg)}</span>
          </div>
          <div class="bg-units ${cls}">${units}</div>
          <div>
            <span class="bg-status ${cls}">${lbl}</span>
          </div>
          <div class="bg-card-footer">
            <button class="btn btn-ghost btn-sm" style="flex:1;"
              onclick="bbSwitchTab('history'); setTimeout(()=>{ document.getElementById('filter-bg').value='${bg}'; renderHistoryTable(); },100);">
              View Banks
            </button>
          </div>
        </div>`;
    }).join('');
    grid.style.display = '';
  }

  if (loading) loading.style.display = 'none';
}

// ── STOCK UPDATE TAB ───────────────────────────────────────
async function loadBankSelector() {
  if (_allBanks.length === 0) await fetchAllBanks();

  const sel = document.getElementById('stock-bank-select');
  if (!sel) return;

  const current = sel.value;
  sel.innerHTML = '<option value="">— Choose a blood bank —</option>';

  // Group by city for readability
  const byCity = {};
  _allBanks.forEach(b => {
    if (!byCity[b.city]) byCity[b.city] = [];
    byCity[b.city].push(b);
  });

  Object.keys(byCity).sort().forEach(city => {
    const grp = document.createElement('optgroup');
    grp.label = city;
    byCity[city].forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.name} (${b.blood_group})`;
      if (String(b.id) === current) opt.selected = true;
      grp.appendChild(opt);
    });
    sel.appendChild(grp);
  });

  if (current) onBankSelect();
}

function onBankSelect() {
  const sel  = document.getElementById('stock-bank-select');
  const id   = parseInt(sel?.value, 10);
  const form = document.getElementById('stock-form-area');
  const ph   = document.getElementById('stock-placeholder');

  if (!id) {
    if (form) form.style.display = 'none';
    if (ph)   ph.style.display   = '';
    return;
  }

  const bank = _allBanks.find(b => b.id === id);
  if (!bank) return;

  if (form) form.style.display = '';
  if (ph)   ph.style.display   = 'none';

  setText('stock-bank-title', bank.name);
  setText('stock-bank-city',  bank.city + (bank.address ? ` · ${bank.address}` : ''));

  // Build one field per blood group; prefill current if this bank matches
  const grid = document.getElementById('stock-fields-grid');
  if (!grid) return;

  // Find ALL banks that share the same name/location to get other blood groups
  // (or just show all 8 groups, pre-filling where data exists)
  const banksAtLocation = _allBanks.filter(b =>
    b.name.toLowerCase() === bank.name.toLowerCase() && b.city === bank.city
  );

  grid.innerHTML = BLOOD_GROUPS.map(bg => {
    const match  = banksAtLocation.find(b => b.blood_group === bg);
    const units  = match ? match.units : '';
    const bankId = match ? match.id : '';
    const cls    = match ? unitClass(match.units) : '';
    return `
      <div class="form-group" style="margin-bottom:0;">
        <label style="display:flex; align-items:center; gap:8px;">
          <span class="blood-badge blood-badge-sm">${escH(bg)}</span>
          ${escH(bg)} Units
          ${match ? `<span class="bg-status ${cls}" style="font-size:11px; padding:1px 8px;">${unitStatusLabel(match.units)}</span>` : '<span style="font-size:11px; color:var(--color-text-light);">Not registered</span>'}
        </label>
        <input
          class="form-control"
          type="number"
          min="0"
          id="stock-field-${escH(bg).replace('+','plus').replace('-','minus')}"
          data-bank-id="${bankId}"
          data-blood-group="${escH(bg)}"
          value="${units}"
          placeholder="${match ? '0' : 'N/A — bank not registered for this group'}"
          ${match ? '' : 'disabled style="background:var(--color-surface); color:var(--color-text-light);"'}
        />
      </div>`;
  }).join('');
}

async function saveAllStock() {
  const btn     = document.getElementById('save-all-stock-btn');
  const restore = setButtonLoading(btn, 'Saving…');

  const inputs = document.querySelectorAll('#stock-fields-grid input[data-bank-id]');
  const tasks  = [];

  inputs.forEach(inp => {
    const bankId = parseInt(inp.dataset.bankId, 10);
    const val    = inp.value.trim();
    if (!bankId || val === '') return;
    tasks.push(apiUpdateBloodStock(bankId, { units: parseInt(val, 10) }));
  });

  if (tasks.length === 0) {
    restore();
    showToast('No changes to save.', 'warning');
    return;
  }

  const results = await Promise.all(tasks);
  restore();

  const failed = results.filter(r => !r.ok).length;
  if (failed > 0) {
    showToast(`${failed} update(s) failed. Please try again.`, 'error');
  } else {
    showToast(`Stock updated for ${tasks.length} blood group(s)!`, 'success');
  }

  // Refresh data
  await fetchAllBanks();
  onBankSelect();
}

// ── HISTORY / INVENTORY TAB ────────────────────────────────
async function loadHistory() {
  const loading   = document.getElementById('history-loading');
  const container = document.getElementById('history-container');

  if (loading)   loading.style.display   = '';
  if (container) container.style.display = 'none';

  await fetchAllBanks();

  // Populate city filter
  const cityFilter = document.getElementById('filter-city');
  if (cityFilter) {
    const cities = [...new Set(_allBanks.map(b => b.city))].sort();
    const cur    = cityFilter.value;
    cityFilter.innerHTML = '<option value="">All Cities</option>' +
      cities.map(c => `<option${c === cur ? ' selected' : ''}>${escH(c)}</option>`).join('');
  }

  if (loading)   loading.style.display   = 'none';
  if (container) container.style.display = '';

  renderHistoryTable();
}

function renderHistoryTable() {
  const cityVal = document.getElementById('filter-city')?.value  || '';
  const bgVal   = document.getElementById('filter-bg')?.value    || '';

  let list = _allBanks;
  if (cityVal) list = list.filter(b => b.city === cityVal);
  if (bgVal)   list = list.filter(b => b.blood_group === bgVal);

  const count = document.getElementById('history-count');
  if (count) count.textContent = `${list.length} record${list.length !== 1 ? 's' : ''}`;

  const tbody = document.getElementById('history-tbody');
  if (!tbody) return;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:32px; color:var(--color-text-muted);">No records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((bank, i) => {
    const cls = unitClass(bank.units);
    const lbl = unitStatusLabel(bank.units);
    return `
      <tr>
        <td style="color:var(--color-text-muted); font-size:13px;">${i + 1}</td>
        <td>
          <strong>${escH(bank.name)}</strong>
          <br/><span style="font-size:12px; color:var(--color-text-muted);">${escH(bank.address)}</span>
        </td>
        <td>${escH(bank.city)}</td>
        <td><span class="blood-badge blood-badge-sm">${escH(bank.blood_group)}</span></td>
        <td><strong style="font-size:16px;" class="${cls === 'ok' ? 'text-success' : cls === 'low' ? 'text-warning' : 'text-danger'}"
              style="color:${cls==='ok'?'var(--color-success)':cls==='low'?'var(--color-warning)':'var(--color-danger)'}">
          ${escH(bank.units)}
        </strong></td>
        <td><span class="bg-status ${cls}">${lbl}</span></td>
        <td style="font-size:13px; color:var(--color-text-muted);">${escH(bank.updated || '—')}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="openQuickModal(${bank.id})">Update</button>
        </td>
      </tr>`;
  }).join('');
}

// ── Quick update modal ─────────────────────────────────────
function openQuickModal(id) {
  const bank = _allBanks.find(b => b.id === id);
  if (!bank) return;
  _quickBankId = id;
  document.getElementById('quick-modal-title').textContent = 'Quick Stock Update';
  document.getElementById('quick-modal-bank').textContent  = `🏥 ${bank.name}, ${bank.city}`;
  document.getElementById('quick-modal-bg-label').innerHTML = `Blood Group: <span class="blood-badge blood-badge-sm">${escH(bank.blood_group)}</span>`;
  document.getElementById('quick-units').value = bank.units;
  document.getElementById('quick-modal').classList.add('open');
}

function closeQuickModal() {
  document.getElementById('quick-modal').classList.remove('open');
  _quickBankId = null;
}

async function saveQuickStock() {
  const unitsEl = document.getElementById('quick-units');
  if (unitsEl.value === '') {
    showFieldError('quick-units', 'Units are required.');
    return;
  }

  const btn     = document.getElementById('quick-save-btn');
  const restore = setButtonLoading(btn, 'Updating…');

  const result = await apiUpdateBloodStock(_quickBankId, { units: parseInt(unitsEl.value, 10) });
  restore();

  if (!result.ok) {
    showToast(result.data?.message || 'Update failed.', 'error');
    return;
  }

  closeQuickModal();
  showToast('Stock updated successfully!', 'success');
  await fetchAllBanks();
  renderHistoryTable();
}

// ── Helper ─────────────────────────────────────────────────
function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Show date
  const dateEl = document.getElementById('bb-date');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Show bank name in nav
  const user = getCurrentUser();
  if (user) {
    const nameEl = document.getElementById('nav-bank-name');
    if (nameEl) nameEl.textContent = user.name || 'Blood Bank Portal';
  }

  initBBNav();
  initHamburger();
  loadOverview();
});
