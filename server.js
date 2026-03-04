/**
 * FuelBunk Pro — REST API Backend
 * Uses Node.js built-in SQLite (node:sqlite) — no native compilation needed
 * Requires Node.js >= 22.5.0
 */

'use strict';

const path     = require('path');
const fs       = require('fs');
const express  = require('express');
const cors     = require('cors');
const morgan   = require('morgan');
const jwt      = require('jsonwebtoken');
const bcrypt   = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

// ── Config ───────────────────────────────────────────────────
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'fuelbunk_dev_secret_change_in_prod';
const JWT_EXPIRY = '12h';
const DB_PATH    = process.env.DB_PATH || path.join(__dirname, 'data', 'fuelbunk.db');
const STATIC_DIR = path.join(__dirname, 'public');

// ── Ensure data directory exists ─────────────────────────────
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// ── Open SQLite ───────────────────────────────────────────────
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA synchronous = NORMAL');
console.log('[DB] Opened:', DB_PATH);

// ── Run schema ────────────────────────────────────────────────
const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schemaSql);
console.log('[DB] Schema applied');

// ── Seed demo tenant if empty ─────────────────────────────────
const tenantCount = db.prepare('SELECT COUNT(*) as n FROM tenants').get().n;
if (tenantCount === 0) {
  db.prepare('INSERT INTO tenants (id,name,location,omc) VALUES (?,?,?,?)').run(
    'demo_station', 'Demo Fuel Station', 'Tumkur, Karnataka', 'BPCL'
  );
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO admin_users (tenant_id,username,name,pass_hash,role) VALUES (?,?,?,?,?)`)
    .run('demo_station', 'admin', 'Demo Owner', hash, 'Owner');
  [['petrol',102.86,96.50],['diesel',88.62,82.30],['premium_petrol',112.50,105.80]].forEach(([ft,sell,buy]) => {
    db.prepare(`INSERT OR IGNORE INTO fuel_prices (tenant_id,fuel_type,sell_price,purchase_price) VALUES (?,?,?,?)`)
      .run('demo_station', ft, sell, buy);
  });
  console.log('[DB] Demo tenant seeded — login: admin / admin123  (tenant: demo_station)');
}

// ── Express ───────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','OPTIONS'] }));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('tiny'));
if (fs.existsSync(STATIC_DIR)) app.use(express.static(STATIC_DIR));

// ── Auth middleware ───────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No token' });
  try { req.auth = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}
function withTenant(req, res, next) {
  req.tenantId = req.auth.tenantId;
  if (!req.tenantId) return res.status(400).json({ error: 'No tenant in token' });
  next();
}
const auth = [requireAuth, withTenant];

// ── Audit helper ─────────────────────────────────────────────
function auditLog(tenantId, user, action, details, ip) {
  try {
    db.prepare(`INSERT INTO audit_log (tenant_id,user,action,details,ip) VALUES (?,?,?,?,?)`)
      .run(tenantId, user, action, JSON.stringify(details||{}), ip||null);
  } catch(e) { console.error('AuditLog:', e.message); }
}

// ── Helpers ───────────────────────────────────────────────────
function safeJson(str, fallback) {
  if (str === null || str === undefined) return fallback;
  try { return JSON.parse(str); } catch { return fallback; }
}
function camelCase(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}

// =============================================================
// AUTH
// =============================================================

app.post('/api/auth/login', (req, res) => {
  const { tenantId, username, password } = req.body;
  if (!tenantId || !username || !password)
    return res.status(400).json({ error: 'tenantId, username, password required' });
  const tenant = db.prepare('SELECT * FROM tenants WHERE id=? AND is_active=1').get(tenantId);
  if (!tenant) return res.status(401).json({ error: 'Station not found' });
  const user = db.prepare('SELECT * FROM admin_users WHERE tenant_id=? AND username=?').get(tenantId, username);
  if (!user || !bcrypt.compareSync(password, user.pass_hash))
    return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign(
    { tenantId, userId: user.id, username: user.username, role: user.role, name: user.name },
    JWT_SECRET, { expiresIn: JWT_EXPIRY }
  );
  auditLog(tenantId, user.name, 'login', { username }, req.ip);
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, username: user.username }, tenant });
});

// =============================================================
// BULK DATA LOAD
// =============================================================

app.get('/api/data', ...auth, (req, res) => {
  const tid = req.tenantId;
  const prices = {}, purchPrices = {};
  db.prepare('SELECT * FROM fuel_prices WHERE tenant_id=?').all(tid).forEach(r => {
    prices[r.fuel_type] = r.sell_price;
    purchPrices[r.fuel_type] = r.purchase_price;
  });
  const settings = {};
  db.prepare('SELECT key,value FROM settings WHERE tenant_id=?').all(tid).forEach(r => {
    try { settings[r.key] = JSON.parse(r.value); } catch { settings[r.key] = r.value; }
  });
  res.json({
    tenant:          db.prepare('SELECT * FROM tenants WHERE id=?').get(tid),
    prices, purchasePrices: purchPrices,
    tanks:           db.prepare('SELECT * FROM tanks WHERE tenant_id=?').all(tid).map(camelCase),
    pumps:           db.prepare('SELECT * FROM pumps WHERE tenant_id=?').all(tid).map(r => ({
                       ...camelCase(r),
                       nozzleLabels:   safeJson(r.nozzle_labels,   []),
                       nozzleFuels:    safeJson(r.nozzle_fuels,    {}),
                       nozzleReadings: safeJson(r.nozzle_readings, {}),
                       nozzleOpen:     safeJson(r.nozzle_open,     {}),
                     })),
    sales:           db.prepare('SELECT * FROM sales WHERE tenant_id=? ORDER BY id DESC').all(tid).map(camelCase),
    employees:       db.prepare('SELECT * FROM employees WHERE tenant_id=? AND is_active=1').all(tid)
                       .map(r => ({ ...camelCase(r), permissions: safeJson(r.permissions, {}) })),
    shifts:          db.prepare('SELECT * FROM shifts WHERE tenant_id=?').all(tid).map(r => ({
                       ...camelCase(r),
                       employeeIds:   safeJson(r.employee_ids,   []),
                       allocations:   safeJson(r.allocations,    {}),
                       openReadings:  safeJson(r.open_readings,  {}),
                       closeReadings: safeJson(r.close_readings, {}),
                     })),
    creditCustomers: db.prepare('SELECT * FROM credit_customers WHERE tenant_id=?').all(tid).map(camelCase),
    expenses:        db.prepare('SELECT * FROM expenses WHERE tenant_id=? ORDER BY id DESC').all(tid)
                       .map(r => ({ ...camelCase(r), fuelTaxBreakdown: safeJson(r.fuel_tax_breakdown, null) })),
    fuelPurchases:   db.prepare('SELECT * FROM fuel_purchases WHERE tenant_id=? ORDER BY id DESC').all(tid).map(camelCase),
    dipReadings:     db.prepare('SELECT * FROM dip_readings WHERE tenant_id=? ORDER BY id DESC LIMIT 500').all(tid).map(camelCase),
    settings,
  });
});

// =============================================================
// SETTINGS
// =============================================================

app.get('/api/settings/:key', ...auth, (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE tenant_id=? AND key=?').get(req.tenantId, req.params.key);
  res.json({ key: req.params.key, value: row ? safeJson(row.value, null) : null });
});
app.put('/api/settings/:key', ...auth, (req, res) => {
  db.prepare(`INSERT INTO settings (tenant_id,key,value) VALUES (?,?,?)
              ON CONFLICT(tenant_id,key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`)
    .run(req.tenantId, req.params.key, JSON.stringify(req.body.value));
  res.json({ ok: true });
});

// =============================================================
// PRICES
// =============================================================

app.get('/api/prices', ...auth, (req, res) => {
  const rows = db.prepare('SELECT * FROM fuel_prices WHERE tenant_id=?').all(req.tenantId);
  const sell = {}, buy = {};
  rows.forEach(r => { sell[r.fuel_type] = r.sell_price; buy[r.fuel_type] = r.purchase_price; });
  res.json({ prices: sell, purchasePrices: buy });
});
app.put('/api/prices', ...auth, (req, res) => {
  const { prices, purchasePrices } = req.body;
  const stmt = db.prepare(`INSERT INTO fuel_prices (tenant_id,fuel_type,sell_price,purchase_price) VALUES (?,?,?,?)
                            ON CONFLICT(tenant_id,fuel_type) DO UPDATE SET
                            sell_price=excluded.sell_price, purchase_price=excluded.purchase_price,
                            updated_at=datetime('now')`);
  ['petrol','diesel','premium_petrol'].forEach(ft => {
    stmt.run(req.tenantId, ft, prices?.[ft]??0, purchasePrices?.[ft]??0);
  });
  auditLog(req.tenantId, req.auth.name, 'prices_update', { prices }, req.ip);
  res.json({ ok: true });
});

// =============================================================
// TANKS
// =============================================================

app.get('/api/tanks', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM tanks WHERE tenant_id=?').all(req.tenantId).map(camelCase));
});
app.post('/api/tanks', ...auth, (req, res) => {
  const t = req.body;
  db.prepare(`INSERT INTO tanks (id,tenant_id,name,fuel_type,capacity,current,last_dip) VALUES (?,?,?,?,?,?,?)`)
    .run(t.id, req.tenantId, t.name, t.fuelType||t.fuel_type, t.capacity||10000, t.current||0, t.lastDip||null);
  res.json({ ok: true, id: t.id });
});
app.put('/api/tanks/:id', ...auth, (req, res) => {
  const t = req.body;
  db.prepare(`UPDATE tanks SET name=?,fuel_type=?,capacity=?,current=?,last_dip=?,updated_at=datetime('now')
              WHERE id=? AND tenant_id=?`)
    .run(t.name, t.fuelType||t.fuel_type, t.capacity, t.current, t.lastDip||null, req.params.id, req.tenantId);
  res.json({ ok: true });
});
app.delete('/api/tanks/:id', ...auth, (req, res) => {
  db.prepare('DELETE FROM tanks WHERE id=? AND tenant_id=?').run(req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// PUMPS
// =============================================================

app.get('/api/pumps', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM pumps WHERE tenant_id=?').all(req.tenantId).map(r => ({
    ...camelCase(r),
    nozzleLabels: safeJson(r.nozzle_labels,[]), nozzleFuels: safeJson(r.nozzle_fuels,{}),
    nozzleReadings: safeJson(r.nozzle_readings,{}), nozzleOpen: safeJson(r.nozzle_open,{}),
  })));
});
app.post('/api/pumps', ...auth, (req, res) => {
  const p = req.body;
  db.prepare(`INSERT INTO pumps (id,tenant_id,name,fuel_type,nozzles,nozzle_labels,nozzle_fuels,nozzle_readings,nozzle_open,current_reading,open_reading)
              VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    .run(p.id, req.tenantId, p.name, p.fuelType||p.fuel_type, p.nozzles||2,
      JSON.stringify(p.nozzleLabels||[]), JSON.stringify(p.nozzleFuels||{}),
      JSON.stringify(p.nozzleReadings||{}), JSON.stringify(p.nozzleOpen||{}),
      p.currentReading||0, p.openReading||0);
  res.json({ ok: true, id: p.id });
});
app.put('/api/pumps/:id', ...auth, (req, res) => {
  const p = req.body;
  db.prepare(`UPDATE pumps SET name=?,fuel_type=?,nozzles=?,nozzle_labels=?,nozzle_fuels=?,
              nozzle_readings=?,nozzle_open=?,current_reading=?,open_reading=?,updated_at=datetime('now')
              WHERE id=? AND tenant_id=?`)
    .run(p.name, p.fuelType||p.fuel_type, p.nozzles||2,
      JSON.stringify(p.nozzleLabels||[]), JSON.stringify(p.nozzleFuels||{}),
      JSON.stringify(p.nozzleReadings||{}), JSON.stringify(p.nozzleOpen||{}),
      p.currentReading||0, p.openReading||0, req.params.id, req.tenantId);
  res.json({ ok: true });
});
app.delete('/api/pumps/:id', ...auth, (req, res) => {
  db.prepare('DELETE FROM pumps WHERE id=? AND tenant_id=?').run(req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// SALES
// =============================================================

app.get('/api/sales', ...auth, (req, res) => {
  const { from, to, limit = 500 } = req.query;
  let sql = 'SELECT * FROM sales WHERE tenant_id=?';
  const params = [req.tenantId];
  if (from) { sql += ' AND date >= ?'; params.push(from); }
  if (to)   { sql += ' AND date <= ?'; params.push(to); }
  sql += ' ORDER BY id DESC LIMIT ?';
  params.push(Number(limit));
  res.json(db.prepare(sql).all(...params).map(camelCase));
});
app.post('/api/sales', ...auth, (req, res) => {
  const s = req.body;
  const result = db.prepare(`INSERT INTO sales
    (tenant_id,date,time,fuel_type,liters,amount,mode,pump,nozzle,vehicle,customer,employee,shift,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.tenantId, s.date, s.time||null, s.fuelType||s.fuel_type,
      s.liters, s.amount, s.mode||'cash', s.pump||null, s.nozzle||null,
      s.vehicle||null, s.customer||null, s.employee||null, s.shift||null, s.source||'admin');
  if ((s.mode||'').toLowerCase() === 'credit' && s.customer) {
    db.prepare(`UPDATE credit_customers SET outstanding=outstanding+? WHERE tenant_id=? AND name=?`)
      .run(s.amount, req.tenantId, s.customer);
  }
  if (s.fuelType || s.fuel_type) {
    db.prepare(`UPDATE tanks SET current=MAX(0,current-?),updated_at=datetime('now') WHERE tenant_id=? AND fuel_type=?`)
      .run(s.liters, req.tenantId, s.fuelType||s.fuel_type);
  }
  res.json({ ok: true, id: result.lastInsertRowid });
});
app.post('/api/sales/batch', ...auth, (req, res) => {
  const { sales } = req.body;
  if (!Array.isArray(sales)) return res.status(400).json({ error: 'sales array required' });
  const insert = db.prepare(`INSERT OR IGNORE INTO sales
    (tenant_id,date,time,fuel_type,liters,amount,mode,pump,nozzle,vehicle,customer,employee,shift,source)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const s of sales) {
    insert.run(req.tenantId, s.date, s.time||null, s.fuelType||s.fuel_type,
      s.liters, s.amount, s.mode||'cash', s.pump||null, s.nozzle||null,
      s.vehicle||null, s.customer||null, s.employee||null, s.shift||null, s.source||'employee_portal');
  }
  res.json({ ok: true, inserted: sales.length });
});

// =============================================================
// EMPLOYEES
// =============================================================

app.get('/api/employees', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM employees WHERE tenant_id=? AND is_active=1').all(req.tenantId)
    .map(r => ({ ...camelCase(r), permissions: safeJson(r.permissions, {}) })));
});
app.post('/api/employees', ...auth, (req, res) => {
  const e = req.body;
  const pinHash = e.pin ? bcrypt.hashSync(String(e.pin), 10) : null;
  const result = db.prepare(`INSERT INTO employees (tenant_id,name,role,pin_hash,salary,balance,permissions) VALUES (?,?,?,?,?,?,?)`)
    .run(req.tenantId, e.name, e.role||'Operator', pinHash, e.salary||0, e.balance||0, JSON.stringify(e.permissions||{}));
  res.json({ ok: true, id: result.lastInsertRowid });
});
app.put('/api/employees/:id', ...auth, (req, res) => {
  const e = req.body;
  const cur = db.prepare('SELECT * FROM employees WHERE id=? AND tenant_id=?').get(req.params.id, req.tenantId);
  if (!cur) return res.status(404).json({ error: 'Not found' });
  const pinHash = e.pin ? bcrypt.hashSync(String(e.pin), 10) : cur.pin_hash;
  db.prepare(`UPDATE employees SET name=?,role=?,pin_hash=?,salary=?,balance=?,permissions=? WHERE id=? AND tenant_id=?`)
    .run(e.name||cur.name, e.role||cur.role, pinHash,
      e.salary??cur.salary, e.balance??cur.balance,
      JSON.stringify(e.permissions||safeJson(cur.permissions,{})),
      req.params.id, req.tenantId);
  res.json({ ok: true });
});
app.post('/api/employees/verify-pin', ...auth, (req, res) => {
  const { employeeId, pin } = req.body;
  const emp = db.prepare('SELECT * FROM employees WHERE id=? AND tenant_id=? AND is_active=1').get(employeeId, req.tenantId);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });
  if (!emp.pin_hash || !bcrypt.compareSync(String(pin), emp.pin_hash))
    return res.status(401).json({ error: 'Invalid PIN' });
  res.json({ ok: true, employee: { id: emp.id, name: emp.name, role: emp.role, permissions: safeJson(emp.permissions,{}) } });
});
app.delete('/api/employees/:id', ...auth, (req, res) => {
  db.prepare('UPDATE employees SET is_active=0 WHERE id=? AND tenant_id=?').run(req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// SHIFTS
// =============================================================

app.get('/api/shifts', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM shifts WHERE tenant_id=?').all(req.tenantId).map(r => ({
    ...camelCase(r),
    employeeIds: safeJson(r.employee_ids,[]), allocations: safeJson(r.allocations,{}),
    openReadings: safeJson(r.open_readings,{}), closeReadings: safeJson(r.close_readings,{}),
  })));
});
app.post('/api/shifts', ...auth, (req, res) => {
  const s = req.body;
  db.prepare(`INSERT INTO shifts (id,tenant_id,date,shift_name,employee_ids,allocations,status,open_readings,close_readings)
              VALUES (?,?,?,?,?,?,?,?,?)`)
    .run(s.id, req.tenantId, s.date, s.shiftName||'Day',
      JSON.stringify(s.employeeIds||[]), JSON.stringify(s.allocations||{}),
      s.status||'open', JSON.stringify(s.openReadings||{}), JSON.stringify(s.closeReadings||{}));
  res.json({ ok: true, id: s.id });
});
app.put('/api/shifts/:id', ...auth, (req, res) => {
  const s = req.body;
  db.prepare(`UPDATE shifts SET shift_name=?,employee_ids=?,allocations=?,status=?,open_readings=?,close_readings=?
              WHERE id=? AND tenant_id=?`)
    .run(s.shiftName||'Day', JSON.stringify(s.employeeIds||[]), JSON.stringify(s.allocations||{}),
      s.status||'open', JSON.stringify(s.openReadings||{}), JSON.stringify(s.closeReadings||{}),
      req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// CREDIT CUSTOMERS
// =============================================================

app.get('/api/credit_customers', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM credit_customers WHERE tenant_id=?').all(req.tenantId).map(camelCase));
});
app.post('/api/credit_customers', ...auth, (req, res) => {
  const c = req.body;
  const result = db.prepare(`INSERT INTO credit_customers (tenant_id,name,phone,credit_limit,outstanding) VALUES (?,?,?,?,?)`)
    .run(req.tenantId, c.name, c.phone||null, c.creditLimit||c.credit_limit||50000, c.outstanding||0);
  res.json({ ok: true, id: result.lastInsertRowid });
});
app.put('/api/credit_customers/:id', ...auth, (req, res) => {
  const c = req.body;
  db.prepare(`UPDATE credit_customers SET name=?,phone=?,credit_limit=?,outstanding=? WHERE id=? AND tenant_id=?`)
    .run(c.name, c.phone||null, c.creditLimit||c.credit_limit, c.outstanding, req.params.id, req.tenantId);
  res.json({ ok: true });
});
app.delete('/api/credit_customers/:id', ...auth, (req, res) => {
  db.prepare('DELETE FROM credit_customers WHERE id=? AND tenant_id=?').run(req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// EXPENSES
// =============================================================

app.get('/api/expenses', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses WHERE tenant_id=? ORDER BY id DESC').all(req.tenantId)
    .map(r => ({ ...camelCase(r), fuelTaxBreakdown: safeJson(r.fuel_tax_breakdown, null) })));
});
app.post('/api/expenses', ...auth, (req, res) => {
  const e = req.body;
  const result = db.prepare(`INSERT INTO expenses
    (tenant_id,date,category,description,amount,source,purchase_id,tax_type,tax_rate,tax_base,
     gst_rate,invoice_value,cgst,sgst,fuel_tax_breakdown,bill_fuels,employee)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.tenantId, e.date, e.category, e.desc||e.description||null, e.amount,
      e.source||'manual', e.purchaseId||null, e.taxType||null, e.taxRate||null, e.taxBase||null,
      e.gstRate||null, e.invoiceValue||null, e.cgst||null, e.sgst||null,
      e.fuelTaxBreakdown ? JSON.stringify(e.fuelTaxBreakdown) : null,
      e.billFuels||null, e.employee||null);
  res.json({ ok: true, id: result.lastInsertRowid });
});
app.delete('/api/expenses/:id', ...auth, (req, res) => {
  db.prepare('DELETE FROM expenses WHERE id=? AND tenant_id=?').run(req.params.id, req.tenantId);
  res.json({ ok: true });
});

// =============================================================
// FUEL PURCHASES
// =============================================================

app.get('/api/fuel_purchases', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM fuel_purchases WHERE tenant_id=? ORDER BY id DESC').all(req.tenantId).map(camelCase));
});
app.post('/api/fuel_purchases', ...auth, (req, res) => {
  const p = req.body;
  const result = db.prepare(`INSERT INTO fuel_purchases (tenant_id,date,fuel_type,liters,rate,total,invoice) VALUES (?,?,?,?,?,?,?)`)
    .run(req.tenantId, p.date, p.fuelType||p.fuel_type, p.liters, p.rate, p.total, p.invoice||null);
  db.prepare(`UPDATE tanks SET current=MIN(capacity,current+?),updated_at=datetime('now') WHERE tenant_id=? AND fuel_type=?`)
    .run(p.liters, req.tenantId, p.fuelType||p.fuel_type);
  res.json({ ok: true, id: result.lastInsertRowid });
});

// =============================================================
// DIP READINGS
// =============================================================

app.get('/api/dip_readings', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM dip_readings WHERE tenant_id=? ORDER BY id DESC LIMIT 200').all(req.tenantId).map(camelCase));
});
app.post('/api/dip_readings', ...auth, (req, res) => {
  const d = req.body;
  const result = db.prepare(`INSERT INTO dip_readings (tenant_id,date,tank_id,cm,mm,volume) VALUES (?,?,?,?,?,?)`)
    .run(req.tenantId, d.date, d.tankId||d.tank_id, d.cm||null, d.mm||null, d.volume||null);
  res.json({ ok: true, id: result.lastInsertRowid });
});

// =============================================================
// AUDIT LOG
// =============================================================

app.get('/api/audit', ...auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log WHERE tenant_id=? ORDER BY id DESC LIMIT 200').all(req.tenantId)
    .map(r => ({ ...camelCase(r), details: safeJson(r.details, {}) })));
});
app.post('/api/audit', ...auth, (req, res) => {
  auditLog(req.tenantId, req.auth.name, req.body.action, req.body.details, req.ip);
  res.json({ ok: true });
});

// =============================================================
// BULK SYNC
// =============================================================

app.post('/api/sync', ...auth, (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'data required' });
  const tid = req.tenantId;
  try {
    if (data.prices) {
      Object.entries(data.prices).forEach(([ft, sell]) => {
        db.prepare(`INSERT INTO fuel_prices (tenant_id,fuel_type,sell_price,purchase_price) VALUES (?,?,?,?)
                    ON CONFLICT(tenant_id,fuel_type) DO UPDATE SET sell_price=excluded.sell_price,
                    purchase_price=COALESCE(excluded.purchase_price,purchase_price),updated_at=datetime('now')`)
          .run(tid, ft, sell, data.purchasePrices?.[ft]||0);
      });
    }
    if (Array.isArray(data.tanks)) {
      data.tanks.forEach(t => {
        db.prepare(`INSERT INTO tanks (id,tenant_id,name,fuel_type,capacity,current,last_dip) VALUES (?,?,?,?,?,?,?)
                    ON CONFLICT(id) DO UPDATE SET name=excluded.name,fuel_type=excluded.fuel_type,
                    capacity=excluded.capacity,current=excluded.current,last_dip=excluded.last_dip,updated_at=datetime('now')`)
          .run(t.id, tid, t.name, t.fuelType||t.fuel_type, t.capacity||10000, t.current||0, t.lastDip||null);
      });
    }
    if (data.settings) {
      Object.entries(data.settings).forEach(([k, v]) => {
        db.prepare(`INSERT INTO settings (tenant_id,key,value) VALUES (?,?,?)
                    ON CONFLICT(tenant_id,key) DO UPDATE SET value=excluded.value,updated_at=datetime('now')`)
          .run(tid, k, JSON.stringify(v));
      });
    }
    auditLog(tid, req.auth.name, 'bulk_sync', { tables: Object.keys(data) }, req.ip);
    res.json({ ok: true });
  } catch(e) {
    console.error('Sync error:', e);
    res.status(500).json({ error: e.message });
  }
});

// =============================================================
// TENANTS (Super Admin)
// =============================================================

app.get('/api/tenants', requireAuth, (req, res) => {
  if (req.auth.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  res.json(db.prepare('SELECT id,name,location,omc,is_active,created_at FROM tenants').all());
});
app.post('/api/tenants', requireAuth, (req, res) => {
  if (req.auth.role !== 'SuperAdmin') return res.status(403).json({ error: 'Forbidden' });
  const { id, name, location, omc, adminUsername, adminPassword } = req.body;
  if (!id||!name||!adminUsername||!adminPassword)
    return res.status(400).json({ error: 'id, name, adminUsername, adminPassword required' });
  db.prepare('INSERT INTO tenants (id,name,location,omc) VALUES (?,?,?,?)').run(id, name, location||'', omc||'');
  const hash = bcrypt.hashSync(adminPassword, 10);
  db.prepare(`INSERT INTO admin_users (tenant_id,username,name,pass_hash,role) VALUES (?,?,?,?,?)`)
    .run(id, adminUsername, name+' Owner', hash, 'Owner');
  res.json({ ok: true });
});

// ── Catch-all → frontend ──────────────────────────────────────
app.get('*', (req, res) => {
  const index = path.join(STATIC_DIR, 'index.html');
  if (fs.existsSync(index)) res.sendFile(index);
  else res.json({ service: 'FuelBunk Pro API', version: '1.0.0-alpha', status: 'running' });
});

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`[FuelBunk] Server running on port ${PORT}`);
  console.log(`[FuelBunk] Database: ${DB_PATH}`);
  console.log(`[FuelBunk] API ready at http://localhost:${PORT}/api`);
});
