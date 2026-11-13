/* ============================================================
   Blood Bridge – api.js
   Central API configuration and reusable fetch utilities.
   ============================================================ */

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
const API_BASE_URL = 'http://127.0.0.1:5000/api'; // Update when deploying

// ---------------------------------------------------------------------------
// Low-level fetch wrapper
// ---------------------------------------------------------------------------

/**
 * Make an authenticated API request.
 * @param {string} endpoint  - e.g. '/donors', '/blood-requests'
 * @param {object} [options] - standard fetch options (method, body, …)
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('bb_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = { message: await res.text() };
    }

    if (res.status === 401) {
      // Token expired or invalid – clear session and redirect to login
      clearSession();
      window.location.href = '/login.html';
    }

    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    console.error('API request failed:', err);
    return { ok: false, status: 0, data: { message: 'Network error. Please try again.' } };
  }
}

// Shorthand helpers
const apiGet  = (ep)       => apiFetch(ep, { method: 'GET' });
const apiPost = (ep, body) => apiFetch(ep, { method: 'POST',  body: JSON.stringify(body) });
const apiPut  = (ep, body) => apiFetch(ep, { method: 'PUT',   body: JSON.stringify(body) });
const apiPatch= (ep, body) => apiFetch(ep, { method: 'PATCH', body: JSON.stringify(body) });
const apiDel  = (ep)       => apiFetch(ep, { method: 'DELETE' });

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

function saveSession(token, user) {
  localStorage.setItem('bb_token', token);
  localStorage.setItem('bb_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('bb_token');
  localStorage.removeItem('bb_user');
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('bb_user'));
  } catch {
    return null;
  }
}

function isLoggedIn() {
  return !!localStorage.getItem('bb_token');
}

// ---------------------------------------------------------------------------
// Blood bank reference data (real hospital names & contacts — static)
// ---------------------------------------------------------------------------
const BLOOD_BANKS_DATA = [
    // Agra
    { id: 55, name: 'SN Medical College Blood Bank',    address: 'Hospital Road, Agra',       city: 'Agra',              blood_group: 'O+',  units: 5,  contact: '0562-2520166', updated: '2026-11-13' },
    // Ahmedabad
    { id:  1, name: 'Ahmedabad Red Cross Blood Bank',    address: '14, Relief Road',           city: 'Ahmedabad',         blood_group: 'O+',  units: 6,  contact: '079-25506888', updated: '2026-11-13' },
    { id:  2, name: 'Civil Hospital Blood Bank',         address: 'Asarwa, Civil Campus',      city: 'Ahmedabad',         blood_group: 'A+',  units: 3,  contact: '079-22680010', updated: '2026-11-12' },
    // Amritsar
    { id:  3, name: 'Guru Nanak Blood Bank',             address: '10, GT Road',               city: 'Amritsar',          blood_group: 'B+',  units: 4,  contact: '0183-2500100', updated: '2026-11-11' },
    // Aurangabad
    { id: 56, name: 'Government Medical Blood Bank',     address: 'Station Road, Aurangabad',  city: 'Aurangabad',        blood_group: 'A+',  units: 3,  contact: '0240-2334441', updated: '2026-11-12' },
    // Bangalore
    { id:  4, name: 'Jeevan Blood Bank',                 address: '78, MG Road',               city: 'Bangalore',         blood_group: 'B+',  units: 0,  contact: '080-22334455', updated: '2026-11-11' },
    { id:  5, name: 'Manipal Blood Services',            address: '5, Old Airport Road',       city: 'Bangalore',         blood_group: 'O-',  units: 5,  contact: '080-25024444', updated: '2026-11-13' },
    { id:  6, name: 'Victoria Hospital Blood Bank',      address: 'Fort Road, Krishnarajendra', city: 'Bangalore',        blood_group: 'A-',  units: 2,  contact: '080-26703400', updated: '2026-11-10' },
    // Dehradun
    { id: 57, name: 'Doon Hospital Blood Bank',          address: 'Shivanand Chowk, Dehradun', city: 'Dehradun',          blood_group: 'O+',  units: 4,  contact: '0135-2715583', updated: '2026-11-13' },
    // Bhopal
    { id:  7, name: 'Hamidia Hospital Blood Bank',       address: 'Royal Market, Sultanabad',  city: 'Bhopal',            blood_group: 'AB+', units: 3,  contact: '0755-2540222', updated: '2026-11-12' },
    // Bhubaneswar
    { id:  8, name: 'AIIMS Bhubaneswar Blood Bank',      address: 'Sijua, Patrapada',          city: 'Bhubaneswar',       blood_group: 'O+',  units: 7,  contact: '0674-2476789', updated: '2026-11-13' },
    // Hubli
    { id: 58, name: 'KIMS Blood Bank',                   address: 'Vidyanagar, KIMS Hospital',  city: 'Hubli',             blood_group: 'B+',  units: 3,  contact: '0836-2201777', updated: '2026-11-12' },
    // Chandigarh
    { id:  9, name: 'PGI Blood Bank',                    address: 'Sector 12, PGI Hospital',   city: 'Chandigarh',        blood_group: 'A+',  units: 5,  contact: '0172-2755200', updated: '2026-11-13' },
    // Chennai
    { id: 10, name: 'LifeLine Blood Bank',               address: '12, Anna Salai',            city: 'Chennai',           blood_group: 'O+',  units: 8,  contact: '044-23456789', updated: '2026-11-13' },
    { id: 11, name: 'Apollo Blood Bank',                 address: '21, Greams Lane, Thousand Lights', city: 'Chennai',    blood_group: 'A+',  units: 4,  contact: '044-28290200', updated: '2026-11-12' },
    { id: 12, name: 'GH Regional Blood Transfusion Centre', address: 'Park Town',             city: 'Chennai',            blood_group: 'B-',  units: 1,  contact: '044-25305000', updated: '2026-11-11' },
    // Coimbatore
    { id: 13, name: 'Red Cross Blood Centre',            address: '5, Nehru Road',             city: 'Coimbatore',        blood_group: 'A+',  units: 3,  contact: '0422-6543210', updated: '2026-11-12' },
    // Jammu
    { id: 59, name: 'GMC Jammu Blood Bank',              address: 'Bakshi Nagar, GMC Campus',  city: 'Jammu',             blood_group: 'A+',  units: 5,  contact: '0191-2548700', updated: '2026-11-13' },
    // Delhi
    { id: 14, name: 'AIIMS Blood Bank',                  address: 'Ansari Nagar East, AIIMS',  city: 'Delhi',             blood_group: 'O+',  units: 10, contact: '011-26588500', updated: '2026-11-13' },
    { id: 15, name: 'Safdarjung Blood Bank',             address: 'Ansari Nagar, Safdarjung',  city: 'Delhi',             blood_group: 'AB-', units: 2,  contact: '011-26707444', updated: '2026-11-12' },
    { id: 16, name: 'RML Hospital Blood Bank',           address: 'Baba Kharak Singh Marg',    city: 'Delhi',             blood_group: 'B+',  units: 6,  contact: '011-23741908', updated: '2026-11-13' },
    // Faridabad
    { id: 17, name: 'Fortis Escorts Blood Bank',         address: 'Neelam Bata Road',          city: 'Faridabad',         blood_group: 'A+',  units: 3,  contact: '0129-7102222', updated: '2026-11-12' },
    // Ghaziabad
    { id: 18, name: 'MMG District Hospital Blood Bank',  address: 'Hapur Road',                city: 'Ghaziabad',         blood_group: 'O+',  units: 2,  contact: '0120-2820308', updated: '2026-11-11' },
    // Guwahati
    { id: 19, name: 'Gauhati Medical Blood Bank',        address: 'Bhangagarh, GMC Campus',    city: 'Guwahati',          blood_group: 'B+',  units: 4,  contact: '0361-2529457', updated: '2026-11-13' },
    // Gwalior
    { id: 20, name: 'JAH Blood Bank',                    address: 'City Center, Jayajirao',    city: 'Gwalior',           blood_group: 'A-',  units: 1,  contact: '0751-2423582', updated: '2026-11-10' },
    // Mangalore
    { id: 60, name: 'KMC Blood Bank',                    address: 'Ambedkar Circle, KMC',      city: 'Mangalore',         blood_group: 'O+',  units: 7,  contact: '0824-2445858', updated: '2026-11-13' },
    { id: 61, name: 'AJ Hospital Blood Bank',            address: 'Kuntikana, NH 66',          city: 'Mangalore',         blood_group: 'A+',  units: 4,  contact: '0824-2225533', updated: '2026-11-12' },
    // Hyderabad
    { id: 21, name: 'Nizam\'s Blood Bank',               address: 'Panjagutta, Niloufer Rd',   city: 'Hyderabad',         blood_group: 'O+',  units: 9,  contact: '040-23320330', updated: '2026-11-13' },
    { id: 22, name: 'Care Hospital Blood Centre',        address: 'Road No.1, Banjara Hills',  city: 'Hyderabad',         blood_group: 'AB+', units: 4,  contact: '040-30418100', updated: '2026-11-12' },
    // Indore
    { id: 23, name: 'MY Hospital Blood Bank',            address: 'MG Road, Near Rajwada',     city: 'Indore',            blood_group: 'B+',  units: 5,  contact: '0731-2528272', updated: '2026-11-13' },
    // Jaipur
    { id: 24, name: 'SMS Hospital Blood Bank',           address: 'Sawai Ram Singh Road',      city: 'Jaipur',            blood_group: 'O+',  units: 7,  contact: '0141-2518888', updated: '2026-11-13' },
    { id: 25, name: 'Santokba Durlabhji Blood Bank',     address: 'Bhawani Singh Marg',        city: 'Jaipur',            blood_group: 'A+',  units: 3,  contact: '0141-2566251', updated: '2026-11-12' },
    // Jodhpur
    { id: 26, name: 'Dr. SN Medical Blood Bank',         address: 'Residency Road',            city: 'Jodhpur',           blood_group: 'B-',  units: 2,  contact: '0291-2434374', updated: '2026-11-11' },
    // Kanpur
    { id: 27, name: 'GSVM Blood Bank',                   address: 'Swaroop Nagar, GSVM Campus', city: 'Kanpur',           blood_group: 'O+',  units: 6,  contact: '0512-2601190', updated: '2026-11-13' },
    // Prayagraj
    { id: 62, name: 'SRN Allahabad Blood Bank',          address: 'Stanley Road, Prayagraj',   city: 'Prayagraj',         blood_group: 'O+',  units: 6,  contact: '0532-2408318', updated: '2026-11-13' },
    // Kochi
    { id: 28, name: 'Medical Trust Blood Bank',          address: 'MG Road, Ernakulam',        city: 'Kochi',             blood_group: 'A+',  units: 4,  contact: '0484-2358001', updated: '2026-11-12' },
    // Kolkata
    { id: 29, name: 'City Blood Bank',                   address: '34, Park Street',           city: 'Kolkata',           blood_group: 'O-',  units: 2,  contact: '033-11223344', updated: '2026-11-10' },
    { id: 30, name: 'SSKM Blood Bank',                   address: 'AJC Bose Road, SSKM Hospital', city: 'Kolkata',        blood_group: 'AB+', units: 5,  contact: '033-22044440', updated: '2026-11-13' },
    // Kozhikode
    { id: 31, name: 'Kozhikode Med College Blood Bank',  address: 'Medical College Road',      city: 'Kozhikode',         blood_group: 'B+',  units: 3,  contact: '0495-2350216', updated: '2026-11-11' },
    // Shimla
    { id: 63, name: 'IGMC Blood Bank',                   address: 'Circular Road, IGMC',       city: 'Shimla',            blood_group: 'A+',  units: 3,  contact: '0177-2804263', updated: '2026-11-12' },
    // Lucknow
    { id: 32, name: 'KGMU Blood Bank',                   address: 'Shah Mina Road, KGMU',      city: 'Lucknow',           blood_group: 'O+',  units: 8,  contact: '0522-2258888', updated: '2026-11-13' },
    // Ludhiana
    { id: 33, name: 'CMC Blood Bank',                    address: 'Brown Road, CMC',           city: 'Ludhiana',          blood_group: 'A-',  units: 2,  contact: '0161-2302000', updated: '2026-11-12' },
    // Madurai
    { id: 34, name: 'Meenakshi Mission Blood Bank',      address: 'Lake Area, Melur Road',     city: 'Madurai',           blood_group: 'O+',  units: 5,  contact: '0452-2588741', updated: '2026-11-13' },
    // Srinagar
    { id: 64, name: 'SMHS Hospital Blood Bank',          address: 'Karan Nagar, SMHS Campus',  city: 'Srinagar',          blood_group: 'B+',  units: 4,  contact: '0194-2452018', updated: '2026-11-11' },
    // Udupi
    { id: 65, name: 'Manipal Hospital Blood Bank',       address: 'Madhav Nagar, Manipal',     city: 'Udupi',             blood_group: 'O+',  units: 6,  contact: '0820-2922313', updated: '2026-11-13' },
    { id: 66, name: 'District Hospital Blood Bank',      address: 'Court Road, Udupi',         city: 'Udupi',             blood_group: 'A+',  units: 2,  contact: '0820-2522736', updated: '2026-11-12' },
    // Meerut
    { id: 35, name: 'L.L.R.M. Medical Blood Bank',       address: 'Garh Road, LLRM Campus',    city: 'Meerut',            blood_group: 'B+',  units: 3,  contact: '0121-2760166', updated: '2026-11-11' },
    // Mumbai
    { id: 36, name: 'KEM Hospital Blood Bank',           address: 'Acharya Donde Marg, Parel', city: 'Mumbai',            blood_group: 'O+',  units: 12, contact: '022-24136000', updated: '2026-11-13' },
    { id: 37, name: 'Lilavati Blood Bank',               address: 'A Marg, Bandra West',       city: 'Mumbai',            blood_group: 'AB+', units: 6,  contact: '022-26568000', updated: '2026-11-12' },
    { id: 38, name: 'Nair Hospital Blood Bank',          address: 'Dr. A.L. Nair Road, Mumbai Central', city: 'Mumbai',   blood_group: 'A-',  units: 2,  contact: '022-23027600', updated: '2026-11-11' },
    // Mysuru
    { id: 39, name: 'JSS Blood Bank',                    address: 'Ramanuja Road, JSS Hospital', city: 'Mysuru',          blood_group: 'A+',  units: 4,  contact: '0821-2548400', updated: '2026-11-12' },
    // Nagpur
    { id: 40, name: 'Mayo Hospital Blood Bank',          address: 'Central Avenue Road',       city: 'Nagpur',            blood_group: 'O+',  units: 7,  contact: '0712-2700737', updated: '2026-11-13' },
    // Nashik
    { id: 41, name: 'Nashik Civil Blood Bank',           address: 'Dindori Road, Civil Hospital', city: 'Nashik',         blood_group: 'B+',  units: 3,  contact: '0253-2577900', updated: '2026-11-11' },
    // Vijayawada
    { id: 67, name: 'Government General Blood Bank',     address: 'Governorpet, GGH',          city: 'Vijayawada',        blood_group: 'O+',  units: 5,  contact: '0866-2574607', updated: '2026-11-13' },
    // Patna
    { id: 42, name: 'PMCH Blood Bank',                   address: 'Ashok Raj Path, PMCH',      city: 'Patna',             blood_group: 'O+',  units: 5,  contact: '0612-2300790', updated: '2026-11-13' },
    // Pune
    { id: 43, name: 'Sahyadri Blood Services',           address: '90, FC Road',               city: 'Pune',              blood_group: 'AB+', units: 5,  contact: '020-99887766', updated: '2026-11-13' },
    { id: 44, name: 'Sassoon Blood Bank',                address: 'Jai Prakash Narayan Rd, Pune', city: 'Pune',           blood_group: 'O-',  units: 2,  contact: '020-26128000', updated: '2026-11-12' },
    // Raipur
    { id: 45, name: 'Dr. BRAM Hospital Blood Bank',      address: 'G.E. Road, Tatibandh',      city: 'Raipur',            blood_group: 'A+',  units: 4,  contact: '0771-2235025', updated: '2026-11-11' },
    // Rajkot
    { id: 46, name: 'Civil Hospital Blood Bank',         address: 'Sadarbazar, Rajkot',        city: 'Rajkot',            blood_group: 'B+',  units: 3,  contact: '0281-2444000', updated: '2026-11-12' },
    // Ranchi
    { id: 47, name: 'RIMS Blood Bank',                   address: 'Bariatu Road, RIMS',        city: 'Ranchi',            blood_group: 'O+',  units: 6,  contact: '0651-2541162', updated: '2026-11-13' },
    // Surat
    { id: 48, name: 'New Civil Blood Bank',              address: 'Majura Gate, New Civil',    city: 'Surat',             blood_group: 'AB-', units: 1,  contact: '0261-2244000', updated: '2026-11-10' },
    { id: 49, name: 'Kiran Blood Bank',                  address: 'Ram Chowk, Ghod Dod Road',  city: 'Surat',             blood_group: 'A+',  units: 5,  contact: '0261-2454000', updated: '2026-11-13' },
    // Thiruvananthapuram
    { id: 50, name: 'Medical College Blood Bank',        address: 'Medical College Junction',  city: 'Thiruvananthapuram', blood_group: 'O+', units: 7,  contact: '0471-2443151', updated: '2026-11-13' },
    // Vadodara
    { id: 51, name: 'SSG Hospital Blood Bank',           address: 'Raopura, SSG Hospital',     city: 'Vadodara',          blood_group: 'B-',  units: 2,  contact: '0265-2423001', updated: '2026-11-11' },
    // Varanasi
    { id: 52, name: 'BHU Blood Bank',                    address: 'Lanka, BHU Hospital',       city: 'Varanasi',          blood_group: 'O+',  units: 8,  contact: '0542-2307111', updated: '2026-11-13' },
    // Visakhapatnam
    { id: 53, name: 'King George Blood Bank',            address: 'Maharanipeta, KGH',         city: 'Visakhapatnam',     blood_group: 'A+',  units: 4,  contact: '0891-2564891', updated: '2026-11-12' },
    { id: 54, name: 'Seven Hills Blood Centre',          address: 'Rockdale Layout, Visakha',  city: 'Visakhapatnam',     blood_group: 'AB+', units: 3,  contact: '0891-2727272', updated: '2026-11-11' },
];

// ---------------------------------------------------------------------------
// Domain-level API functions (switch between demo & real)
// ---------------------------------------------------------------------------

/* Auth */
async function apiLogin(email, password) {
  return apiPost('/auth/login', { email, password });
}

async function apiRegister(payload) {
  return apiPost('/auth/register', payload);
}

async function apiLogout() {
  clearSession();
  return { ok: true };
}

/* Donor */
async function apiGetDonorProfile() {
  return apiGet('/donors/me');
}

async function apiUpdateDonorAvailability(available) {
  return apiPatch('/donors/me/availability', { available });
}

async function apiRegisterDonor(payload) {
  return apiPost('/donors/register', payload);
}

async function apiGetIncomingRequests() {
  return apiGet('/donors/incoming-requests');
}

async function apiAcceptRequest(requestId) {
  return apiPost(`/blood-requests/${requestId}/accept`, {});
}

/* Requester */
async function apiGetMyRequests() {
  return apiGet('/blood-requests/mine');
}

async function apiSubmitBloodRequest(payload) {
  return apiPost('/blood-requests', payload);
}

async function apiCancelRequest(requestId) {
  return apiPatch(`/blood-requests/${requestId}/cancel`, {});
}

/* Blood Banks — always served from static seed data */
async function apiSearchBloodBanks(bloodGroup, city) {
  let results = BLOOD_BANKS_DATA;
  if (city)       results = results.filter(b => b.city === city);
  if (bloodGroup) results = results.filter(b => b.blood_group === bloodGroup);
  return { ok: true, data: results };
}

async function apiGetBloodBanks() {
  return { ok: true, data: BLOOD_BANKS_DATA };
}

async function apiUpdateBloodStock(bankId, payload) {
  // Update the in-memory list so changes reflect during the session
  const bank = BLOOD_BANKS_DATA.find(b => b.id === bankId);
  if (bank && payload.units !== undefined) bank.units = payload.units;
  return { ok: true, data: { message: 'Stock updated.' } };
}

async function apiAddBloodBank(payload) {
  const newId = Math.max(...BLOOD_BANKS_DATA.map(b => b.id)) + 1;
  const bank  = { id: newId, ...payload, updated: new Date().toISOString().slice(0, 10) };
  BLOOD_BANKS_DATA.push(bank);
  return { ok: true, data: bank };
}

/* Admin */
async function apiGetAdminStats() {
  return apiGet('/admin/stats');
}

async function apiGetAllDonors() {
  return apiGet('/admin/donors');
}

async function apiGetAllRequests() {
  return apiGet('/admin/blood-requests');
}

/**
 * Register a new blood_bank user account then create the blood bank record.
 * Returns { ok, user, bank, error } — caller shows credentials on success.
 */
async function apiRegisterBloodBank({ name, email, phone, password, address, city, blood_group, units, contact }) {
  // 1 – Create the user account with role blood_bank
  const userResult = await apiPost('/auth/register', {
    name, email, phone, password, role: 'blood_bank',
  });
  if (!userResult.ok) return { ok: false, error: userResult.data?.message || 'Failed to register account.' };

  // 2 – Create the blood bank record
  const bankResult = await apiPost('/blood-banks', { name, address, city, blood_group, units, contact });
  if (!bankResult.ok) return { ok: false, error: bankResult.data?.message || 'Account created but failed to add blood bank.' };

  return { ok: true, user: { email, password }, bank: bankResult.data };
}
