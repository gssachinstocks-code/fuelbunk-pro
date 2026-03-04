-- ============================================================
-- FuelBunk Pro — SQLite Database Schema
-- Alpha / POC Release
-- ============================================================

PRAGMA journal_mode = WAL;       -- Write-Ahead Logging: better concurrency
PRAGMA foreign_keys = ON;        -- Enforce FK constraints
PRAGMA synchronous = NORMAL;     -- Balance safety vs speed for POC

-- ── TENANTS (Fuel Stations) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS tenants (
  id          TEXT PRIMARY KEY,          -- e.g. "station_abc123"
  name        TEXT NOT NULL,             -- "Anekar Fuel Station"
  location    TEXT,
  omc         TEXT,                      -- "BPCL / HPCL / IOCL"
  upi_name    TEXT,
  upi_vpa     TEXT,
  station_code TEXT,
  created_at  TEXT DEFAULT (datetime('now')),
  is_active   INTEGER DEFAULT 1
);

-- ── ADMIN USERS (per-tenant) ────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  username    TEXT NOT NULL,
  name        TEXT NOT NULL,
  pass_hash   TEXT NOT NULL,             -- bcrypt hash
  role        TEXT DEFAULT 'Manager',   -- Owner | Manager | Accountant
  created_at  TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, username)
);

-- ── FUEL PRICES ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_prices (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id      TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  fuel_type      TEXT NOT NULL,          -- petrol | diesel | premium_petrol
  sell_price     REAL NOT NULL DEFAULT 0,
  purchase_price REAL NOT NULL DEFAULT 0,
  updated_at     TEXT DEFAULT (datetime('now')),
  UNIQUE(tenant_id, fuel_type)
);

-- ── TANKS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tanks (
  id          INTEGER PRIMARY KEY,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  fuel_type   TEXT NOT NULL,
  capacity    REAL NOT NULL DEFAULT 10000,
  current     REAL NOT NULL DEFAULT 0,
  last_dip    TEXT,
  updated_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tanks_tenant ON tanks(tenant_id);

-- ── PUMPS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pumps (
  id              INTEGER PRIMARY KEY,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  fuel_type       TEXT NOT NULL,
  nozzles         INTEGER DEFAULT 2,
  nozzle_labels   TEXT,                  -- JSON: ["A","B"]
  nozzle_fuels    TEXT,                  -- JSON: {"A":"petrol","B":"diesel"}
  nozzle_readings TEXT,                  -- JSON: {"A":12345.6,"B":23456.7}
  nozzle_open     TEXT,                  -- JSON: opening readings
  current_reading REAL DEFAULT 0,
  open_reading    REAL DEFAULT 0,
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_pumps_tenant ON pumps(tenant_id);

-- ── SALES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,             -- YYYY-MM-DD
  time        TEXT,
  fuel_type   TEXT NOT NULL,
  liters      REAL NOT NULL,
  amount      REAL NOT NULL,
  mode        TEXT DEFAULT 'cash',       -- cash|upi|card|credit
  pump        INTEGER,
  nozzle      TEXT,
  vehicle     TEXT,
  customer    TEXT,
  employee    TEXT,
  shift       TEXT,
  source      TEXT DEFAULT 'admin',      -- admin | employee_portal
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sales_tenant_date ON sales(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_sales_fuel ON sales(tenant_id, fuel_type);
CREATE INDEX IF NOT EXISTS idx_sales_mode ON sales(tenant_id, mode);

-- ── EMPLOYEES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT DEFAULT 'Operator',
  pin_hash    TEXT,                      -- bcrypt hash of 4-digit PIN
  salary      REAL DEFAULT 0,
  balance     REAL DEFAULT 0,           -- running balance (advances etc.)
  permissions TEXT,                     -- JSON object
  is_active   INTEGER DEFAULT 1,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id);

-- ── SHIFTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shifts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id       TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date            TEXT NOT NULL,
  shift_name      TEXT DEFAULT 'Day',
  employee_ids    TEXT,                  -- JSON array of employee IDs
  allocations     TEXT,                  -- JSON: nozzle→empId map
  status          TEXT DEFAULT 'open',  -- open | closed
  open_readings   TEXT,                  -- JSON
  close_readings  TEXT,                  -- JSON
  created_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shifts_tenant_date ON shifts(tenant_id, date);

-- ── CREDIT CUSTOMERS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_customers (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  credit_limit REAL DEFAULT 50000,
  outstanding REAL DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_credit_tenant ON credit_customers(tenant_id);

-- ── EXPENSES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expenses (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  amount      REAL NOT NULL,
  source      TEXT DEFAULT 'manual',    -- manual | fuel_purchase | employee
  purchase_id INTEGER,                   -- FK to fuel_purchases if source=fuel_purchase
  tax_type    TEXT,                      -- local_sales_tax | gst | null
  tax_rate    REAL,
  tax_base    REAL,
  gst_rate    REAL,
  invoice_value REAL,
  cgst        REAL,
  sgst        REAL,
  fuel_tax_breakdown TEXT,              -- JSON for multi-fuel tax bill
  bill_fuels  TEXT,
  employee    TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_expenses_tenant_date ON expenses(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(tenant_id, category);

-- ── FUEL PURCHASES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fuel_purchases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  fuel_type   TEXT NOT NULL,
  liters      REAL NOT NULL,
  rate        REAL NOT NULL,
  total       REAL NOT NULL,
  invoice     TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_tenant ON fuel_purchases(tenant_id, date);

-- ── DIP READINGS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dip_readings (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  tank_id     INTEGER REFERENCES tanks(id),
  cm          REAL,
  mm          REAL,
  volume      REAL,
  created_at  TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dip_tenant_date ON dip_readings(tenant_id, date);

-- ── SETTINGS (per-tenant key-value) ─────────────────────────
CREATE TABLE IF NOT EXISTS settings (
  tenant_id   TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  key         TEXT NOT NULL,
  value       TEXT,                      -- JSON-serialised value
  updated_at  TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (tenant_id, key)
);

-- ── AUDIT LOG ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id   TEXT NOT NULL,
  user        TEXT,
  action      TEXT NOT NULL,
  details     TEXT,                      -- JSON
  timestamp   TEXT DEFAULT (datetime('now')),
  ip          TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_log(tenant_id, timestamp);
