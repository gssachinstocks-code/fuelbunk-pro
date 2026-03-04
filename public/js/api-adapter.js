/**
 * FuelBunk Pro — Cloud API Adapter
 * Replaces the browser-side FuelDB (IndexedDB) class with REST API calls.
 *
 * Drop this file BEFORE app.js in index.html:
 *   <script src="/js/api-adapter.js"></script>
 *   <script src="/js/app.js"></script>
 *
 * The adapter exposes the same interface as FuelDB so app.js needs
 * zero changes. It also handles:
 *   - JWT auth token storage & refresh
 *   - Optimistic in-memory updates (instant UI, background API call)
 *   - Graceful fallback to IndexedDB if server unreachable
 */

'use strict';

// ── Server base URL (auto-detects same origin) ────────────────
const API_BASE = window.FUELBUNK_API_BASE || '';   // set to 'https://your-server.com' if separate

// ── Token management ──────────────────────────────────────────
const TokenStore = {
  get()      { try { return localStorage.getItem('fb_api_token'); }  catch { return null; } },
  set(t)     { try { localStorage.setItem('fb_api_token', t); }      catch {} },
  clear()    { try { localStorage.removeItem('fb_api_token'); }      catch {} },
  headers()  {
    const t = this.get();
    return t ? { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }
             : { 'Content-Type': 'application/json' };
  }
};

// ── Core fetch wrapper ────────────────────────────────────────
async function apiFetch(method, path, body) {
  const opts = {
    method,
    headers: TokenStore.headers(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  };
  let resp;
  try {
    resp = await fetch(API_BASE + path, opts);
  } catch (networkErr) {
    console.warn('[API] Network error:', networkErr.message);
    throw networkErr;
  }
  if (resp.status === 401) {
    TokenStore.clear();
    // Reload to login screen
    window.dispatchEvent(new CustomEvent('fuelbunk:session-expired'));
    throw new Error('Session expired');
  }
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error('API ' + resp.status + ': ' + text);
  }
  return resp.json();
}

const api = {
  get:    (path)        => apiFetch('GET',    path),
  post:   (path, body)  => apiFetch('POST',   path, body),
  put:    (path, body)  => apiFetch('PUT',    path, body),
  delete: (path)        => apiFetch('DELETE', path),
};

// ── Auth ──────────────────────────────────────────────────────
window.FuelAPI = {
  /**
   * Login — returns { token, user, tenant }
   */
  async login(tenantId, username, password) {
    const result = await api.post('/api/auth/login', { tenantId, username, password });
    TokenStore.set(result.token);
    return result;
  },

  logout() {
    TokenStore.clear();
  },

  isLoggedIn() {
    return !!TokenStore.get();
  },

  /**
   * Load all station data in one request.
   * Returns the same shape as APP.data (tanks, pumps, sales, etc.)
   */
  async loadData() {
    return api.get('/api/data');
  },

  /**
   * Bulk sync the current in-memory state to the server.
   * Safe to call periodically (uses INSERT OR REPLACE).
   */
  async syncData(appData) {
    return api.post('/api/sync', { data: appData });
  },

  // ── Prices ─────────────────────────────────────────────────
  async savePrices(prices, purchasePrices) {
    return api.put('/api/prices', { prices, purchasePrices });
  },

  // ── Sales ──────────────────────────────────────────────────
  async addSale(sale) {
    return api.post('/api/sales', sale);
  },
  async addSalesBatch(sales) {
    return api.post('/api/sales/batch', { sales });
  },
  async getSales(from, to) {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to)   q.set('to',   to);
    return api.get('/api/sales?' + q.toString());
  },

  // ── Tanks ──────────────────────────────────────────────────
  async saveTank(tank) {
    return tank.id && await _exists('tanks', tank.id)
      ? api.put('/api/tanks/' + tank.id, tank)
      : api.post('/api/tanks', tank);
  },
  async deleteTank(id) { return api.delete('/api/tanks/' + id); },

  // ── Pumps ──────────────────────────────────────────────────
  async savePump(pump) {
    return pump.id && await _exists('pumps', pump.id)
      ? api.put('/api/pumps/' + pump.id, pump)
      : api.post('/api/pumps', pump);
  },
  async deletePump(id) { return api.delete('/api/pumps/' + id); },

  // ── Employees ──────────────────────────────────────────────
  async saveEmployee(emp) {
    return emp.id
      ? api.put('/api/employees/' + emp.id, emp)
      : api.post('/api/employees', emp);
  },
  async deleteEmployee(id) { return api.delete('/api/employees/' + id); },
  async verifyPin(employeeId, pin) {
    return api.post('/api/employees/verify-pin', { employeeId, pin });
  },

  // ── Shifts ─────────────────────────────────────────────────
  async saveShift(shift) {
    return shift.id
      ? api.put('/api/shifts/' + shift.id, shift)
      : api.post('/api/shifts', shift);
  },

  // ── Credit Customers ───────────────────────────────────────
  async saveCreditCustomer(c) {
    return c.id
      ? api.put('/api/credit_customers/' + c.id, c)
      : api.post('/api/credit_customers', c);
  },
  async deleteCreditCustomer(id) { return api.delete('/api/credit_customers/' + id); },

  // ── Expenses ───────────────────────────────────────────────
  async addExpense(expense) { return api.post('/api/expenses', expense); },
  async deleteExpense(id)   { return api.delete('/api/expenses/' + id); },

  // ── Fuel Purchases ─────────────────────────────────────────
  async addFuelPurchase(p) { return api.post('/api/fuel_purchases', p); },

  // ── Dip Readings ───────────────────────────────────────────
  async addDipReading(d) { return api.post('/api/dip_readings', d); },

  // ── Settings ───────────────────────────────────────────────
  async getSetting(key, defaultVal = null) {
    try {
      const r = await api.get('/api/settings/' + encodeURIComponent(key));
      return r.value !== null ? r.value : defaultVal;
    } catch { return defaultVal; }
  },
  async setSetting(key, value) {
    return api.put('/api/settings/' + encodeURIComponent(key), { value });
  },

  // ── Audit ──────────────────────────────────────────────────
  async logAudit(action, details) {
    return api.post('/api/audit', { action, details }).catch(() => {});
  },
};

// Internal helper — simple existence check (checks loaded APP.data first)
async function _exists(store, id) {
  if (window.APP?.data?.[store]) {
    return window.APP.data[store].some(r => r.id === id);
  }
  return false;
}


// ═══════════════════════════════════════════════════════════════
// CLOUD DB ADAPTER
// Replaces window.db (FuelDB / IndexedDB) transparently.
// The app calls db.put('tanks', t), db.add('sales', s), etc.
// These are intercepted and routed to the REST API instead.
// ═══════════════════════════════════════════════════════════════

class CloudDB {
  constructor() {
    this.db    = true;  // truthy — app checks if (db && db.db)
    this.ready = Promise.resolve();
    this._mode = 'cloud';
  }

  // ── Emulate FuelDB interface ──────────────────────────────

  async getAll(storeName) {
    // Data is already loaded in APP.data — return from memory
    const d = window.APP?.data;
    if (!d) return [];
    const map = {
      tanks:           d.tanks           || [],
      pumps:           d.pumps           || [],
      sales:           d.sales           || [],
      employees:       d.employees       || [],
      shifts:          d.shifts          || [],
      creditCustomers: d.creditCustomers || [],
      expenses:        d.expenses        || [],
      fuelPurchases:   d.fuelPurchases   || [],
      dipReadings:     d.dipReadings     || [],
      auditLog:        window.APP.auditLog || [],
      settings:        _settingsToArray(d.settings),
    };
    return map[storeName] || [];
  }

  async get(storeName, key) {
    const all = await this.getAll(storeName);
    if (storeName === 'settings') {
      const s = all.find(r => r.key === key);
      return s || null;
    }
    return all.find(r => r.id === key) || null;
  }

  async put(storeName, data) {
    // Update in-memory immediately
    _inMemoryUpsert(storeName, data);
    // Fire-and-forget to server
    _cloudPut(storeName, data).catch(e => console.warn('[CloudDB.put]', storeName, e.message));
    return data.id;
  }

  async add(storeName, data) {
    // Insert in-memory
    _inMemoryInsert(storeName, data);
    // Fire-and-forget
    _cloudAdd(storeName, data).catch(e => console.warn('[CloudDB.add]', storeName, e.message));
    return data.id;
  }

  async delete(storeName, key) {
    _inMemoryDelete(storeName, key);
    _cloudDelete(storeName, key).catch(e => console.warn('[CloudDB.delete]', storeName, e.message));
  }

  async clear(storeName) {
    // Used only on data reset — handled by server via reset endpoint
    console.warn('[CloudDB] clear() called on', storeName, '— skipping server clear in alpha');
  }

  async bulkPut(storeName, items) {
    items.forEach(item => _inMemoryUpsert(storeName, item));
    // Batch route for sales, otherwise upsert one-by-one
    if (storeName === 'sales') {
      FuelAPI.addSalesBatch(items).catch(e => console.warn('[CloudDB.bulkPut]', e.message));
    } else {
      items.forEach(item => _cloudPut(storeName, item).catch(e => console.warn('[CloudDB.bulkPut]', e.message)));
    }
  }

  async count(storeName) {
    const all = await this.getAll(storeName);
    return all.length;
  }

  async getSetting(key, defaultVal = null) {
    const d = window.APP?.data?.settings;
    if (d && d[key] !== undefined) return d[key];
    return FuelAPI.getSetting(key, defaultVal);
  }

  async setSetting(key, value) {
    if (window.APP?.data?.settings) window.APP.data.settings[key] = value;
    return FuelAPI.setSetting(key, value);
  }
}

// ── In-memory helpers ─────────────────────────────────────────

function _inMemoryUpsert(storeName, data) {
  const arr = _getArr(storeName);
  if (!arr) return;
  const idx = arr.findIndex(r => r.id === data.id);
  if (idx >= 0) arr[idx] = { ...arr[idx], ...data };
  else arr.unshift(data);
}

function _inMemoryInsert(storeName, data) {
  const arr = _getArr(storeName);
  if (arr) arr.unshift(data);
}

function _inMemoryDelete(storeName, key) {
  const arr = _getArr(storeName);
  if (!arr) return;
  const idx = arr.findIndex(r => r.id === key);
  if (idx >= 0) arr.splice(idx, 1);
}

function _getArr(storeName) {
  const d = window.APP?.data;
  if (!d) return null;
  const keyMap = {
    tanks: 'tanks', pumps: 'pumps', sales: 'sales',
    employees: 'employees', shifts: 'shifts',
    creditCustomers: 'creditCustomers',
    expenses: 'expenses', fuelPurchases: 'fuelPurchases',
    dipReadings: 'dipReadings',
  };
  return d[keyMap[storeName]] || null;
}

function _settingsToArray(settings) {
  if (!settings || typeof settings !== 'object') return [];
  return Object.entries(settings).map(([key, value]) => ({ key, value }));
}

// ── Cloud write helpers ───────────────────────────────────────

async function _cloudPut(storeName, data) {
  switch (storeName) {
    case 'tanks':           return FuelAPI.saveTank(data);
    case 'pumps':           return FuelAPI.savePump(data);
    case 'employees':       return FuelAPI.saveEmployee(data);
    case 'shifts':          return FuelAPI.saveShift(data);
    case 'creditCustomers': return FuelAPI.saveCreditCustomer(data);
    default: console.warn('[CloudDB] No PUT handler for', storeName);
  }
}

async function _cloudAdd(storeName, data) {
  switch (storeName) {
    case 'sales':          return FuelAPI.addSale(data);
    case 'tanks':          return FuelAPI.saveTank(data);
    case 'pumps':          return FuelAPI.savePump(data);
    case 'employees':      return FuelAPI.saveEmployee(data);
    case 'shifts':         return FuelAPI.saveShift(data);
    case 'creditCustomers':return FuelAPI.saveCreditCustomer(data);
    case 'expenses':       return FuelAPI.addExpense(data);
    case 'fuelPurchases':  return FuelAPI.addFuelPurchase(data);
    case 'dipReadings':    return FuelAPI.addDipReading(data);
    case 'auditLog':       return FuelAPI.logAudit(data.action, data);
    default: console.warn('[CloudDB] No ADD handler for', storeName);
  }
}

async function _cloudDelete(storeName, id) {
  switch (storeName) {
    case 'tanks':           return FuelAPI.deleteTank(id);
    case 'pumps':           return FuelAPI.deletePump(id);
    case 'employees':       return FuelAPI.deleteEmployee(id);
    case 'creditCustomers': return FuelAPI.deleteCreditCustomer(id);
    case 'expenses':        return FuelAPI.deleteExpense(id);
    default: console.warn('[CloudDB] No DELETE handler for', storeName);
  }
}


// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP — Replace IndexedDB with CloudDB when server reachable
// ═══════════════════════════════════════════════════════════════

(async function bootstrap() {
  // Check if server is available
  let serverAvailable = false;
  try {
    const r = await fetch(API_BASE + '/api/auth/login', { method: 'HEAD' })
                      .catch(() => null);
    serverAvailable = r !== null;
  } catch {}

  if (!serverAvailable) {
    console.info('[FuelBunk] No server found — running offline with IndexedDB');
    return;
  }

  console.info('[FuelBunk] Cloud server detected — using REST API');

  // Override window.db with CloudDB
  window.db = new CloudDB();

  // Patch initApp to load data from server instead of IndexedDB
  // after auth is confirmed
  window.addEventListener('fuelbunk:session-expired', () => {
    // Clear token, reload
    TokenStore.clear();
    window.location.reload();
  });

  // Expose CloudDB class for app to instantiate (app.js does: window.db = new FuelDB(...))
  window.FuelDB = CloudDB;
  window.CloudDB = CloudDB;

  console.info('[FuelBunk] CloudDB adapter active');
})();
