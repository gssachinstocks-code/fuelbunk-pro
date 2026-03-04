// ═══════════════════════════════════════════════════════════
// FUELBUNK PRO — IndexedDB Data Layer
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// FUELBUNK PRO — MULTI-TENANT LAYER
// Each tenant gets their own namespaced IndexedDB
// ═══════════════════════════════════════════════════════════

const MT_REGISTRY_KEY = 'fb_tenants';       // localStorage key for tenant list
const MT_ACTIVE_KEY   = 'fb_active_tenant'; // localStorage key for current tenant
const MT_SUPER_KEY    = 'fb_super_session'; // localStorage key for super admin session
const MT_DB_VERSION   = 4;

// Super admin credentials — defaults, overridden by localStorage if changed
const SUPER_ADMIN_DEFAULTS = {
  username: 'superadmin',
  passHash: '357db263b95cb33ae4ec8dffed73206e8bf7c162895b0591fbd387e3e2f8c6ae', // FuelBunk@Super2026
};
function mt_getSuperCreds() {
  try {
    const stored = JSON.parse(localStorage.getItem('fb_super_creds') || 'null');
    return stored || SUPER_ADMIN_DEFAULTS;
  } catch { return SUPER_ADMIN_DEFAULTS; }
}
function mt_saveSuperCreds(username, passHash) {
  localStorage.setItem('fb_super_creds', JSON.stringify({ username, passHash }));
}

// ── Tenant Registry (stored in localStorage) ──
function mt_getTenants() {
  try { return JSON.parse(localStorage.getItem(MT_REGISTRY_KEY) || '[]'); } catch { return []; }
}
function mt_saveTenants(tenants) {
  localStorage.setItem(MT_REGISTRY_KEY, JSON.stringify(tenants));
}
function mt_getActiveTenant() {
  try {
    const raw = localStorage.getItem(MT_ACTIVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}
function mt_setActiveTenant(tenant) {
  localStorage.setItem(MT_ACTIVE_KEY, JSON.stringify(tenant));
}
function mt_clearActiveTenant() {
  localStorage.removeItem(MT_ACTIVE_KEY);
  localStorage.removeItem(MT_SUPER_KEY);
}
function mt_dbName(tenantId) {
  return 'FuelBunkPro_' + tenantId;
}

// ── Super Admin Session ──
function mt_getSuperSession() {
  try { return JSON.parse(localStorage.getItem(MT_SUPER_KEY) || 'null'); } catch { return null; }
}
function mt_saveSuperSession() {
  localStorage.setItem(MT_SUPER_KEY, JSON.stringify({ loggedIn: true, at: Date.now() }));
}
function mt_clearSuperSession() {
  localStorage.removeItem(MT_SUPER_KEY);
}
function mt_isSuperLoggedIn() {
  const s = mt_getSuperSession();
  if (!s || !s.loggedIn) return false;
  if (Date.now() - s.at > 4 * 60 * 60 * 1000) { mt_clearSuperSession(); return false; } // 4hr
  return true;
}

// ── Tenant Selector UI ──
async function mt_showSelector() {
  const tenants = mt_getTenants();
  const app = document.getElementById('app');
  const isSuperLoggedIn = mt_isSuperLoggedIn();
  document.body.classList.add('app-ready');

  app.innerHTML = `
    <div style="position:fixed;inset:0;background:var(--bg-0);overflow-y:auto;z-index:9999">
      <div style="max-width:560px;margin:0 auto;padding:28px 20px 60px">

        <!-- Header -->
        <div style="text-align:center;margin-bottom:28px">
          <div style="width:64px;height:64px;border-radius:18px;background:linear-gradient(135deg,var(--accent),var(--accent-light));display:grid;place-items:center;font-size:28px;margin:0 auto 12px;box-shadow:0 8px 30px rgba(212,148,15,0.25)">⛽</div>
          <h1 style="font-size:22px;font-weight:900;color:var(--text-0);letter-spacing:-0.5px">FuelBunk Pro</h1>
          <p style="font-size:11px;color:var(--text-3);margin-top:4px">Multi-Station Management System</p>
        </div>

        <!-- Station List -->
        <div style="background:var(--bg-2);border-radius:var(--radius);border:1px solid var(--border);overflow:hidden;margin-bottom:14px">
          <div style="padding:12px 18px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
            <h4 style="font-size:12px;font-weight:700;color:var(--text-0)">🏪 Select Your Station</h4>
            ${isSuperLoggedIn ? '<button class="btn btn-accent btn-sm" onclick="mt_openAddTenant()">+ Add Station</button>' : ''}
          </div>
          <div style="padding:8px">
            ${tenants.length === 0 ? `
              <div style="text-align:center;padding:30px 20px;color:var(--text-3)">
                <div style="font-size:32px;margin-bottom:8px">🏪</div>
                <div style="font-weight:600;margin-bottom:4px">No stations yet</div>
                <div style="font-size:12px">Login as Super Admin below to add stations</div>
              </div>
            ` : tenants.map(t => {
              const isActive = t.active !== false;
              return `
              <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);margin-bottom:4px;border:1px solid ${isActive ? 'transparent' : 'rgba(239,68,68,0.15)'};background:${isActive ? 'transparent' : 'rgba(239,68,68,0.03)'}">
                <div style="width:40px;height:40px;border-radius:10px;background:linear-gradient(135deg,${t.color||'var(--accent)'},${t.colorLight||'var(--accent-light)'});display:grid;place-items:center;font-size:18px;flex-shrink:0;opacity:${isActive?1:0.5}">${t.icon||'⛽'}</div>
                <div style="flex:1;min-width:0;cursor:${isActive?'pointer':'default'}" onclick="${isActive ? `mt_selectTenant('${t.id}')` : ''}">
                  <div style="font-weight:700;color:${isActive?'var(--text-0)':'var(--text-3)'};font-size:13px">${t.name}</div>
                  <div style="font-size:10px;color:var(--text-3);margin-top:1px">${t.location||''} ${isActive ? '' : '· <span style="color:var(--red);font-weight:600">INACTIVE</span>'}</div>
                </div>
                ${isActive ? `<div style="color:var(--text-3);font-size:16px;cursor:pointer" onclick="mt_selectTenant('${t.id}')">›</div>` : ''}
                ${isSuperLoggedIn ? `
                  <button onclick="event.stopPropagation();mt_openEditTenant('${t.id}')" style="background:transparent;border:none;color:var(--text-3);cursor:pointer;padding:4px;font-size:13px" title="Edit">✏️</button>
                  <button onclick="event.stopPropagation();mt_toggleStation('${t.id}')" style="background:${isActive ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)'};border:1px solid ${isActive ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'};color:${isActive ? 'var(--red)' : 'var(--green)'};cursor:pointer;padding:3px 8px;font-size:10px;font-weight:700;border-radius:4px" title="${isActive ? 'Deactivate' : 'Activate'}">${isActive ? '⏸ Off' : '▶ On'}</button>
                  <button onclick="event.stopPropagation();mt_manageStationAdmins('${t.id}')" style="background:rgba(212,148,15,0.12);border:1px solid rgba(212,148,15,0.3);color:var(--accent-light);cursor:pointer;padding:3px 8px;font-size:10px;font-weight:700;border-radius:4px" title="Manage Admins">👤 Admins</button>
                  <button onclick="event.stopPropagation();mt_viewStationData('${t.id}')" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.25);color:var(--blue);cursor:pointer;padding:3px 8px;font-size:10px;font-weight:700;border-radius:4px" title="View Data">📊 Data</button>
                  <button onclick="event.stopPropagation();mt_confirmDeleteTenant('${t.id}')" style="background:transparent;border:none;color:var(--red);cursor:pointer;padding:4px;font-size:13px" title="Delete">🗑</button>
                ` : ''}
              </div>`;
            }).join('')}
          </div>
        </div>

        <!-- Super Admin Panel -->
        <div style="background:var(--bg-2);border-radius:var(--radius);border:1px solid ${isSuperLoggedIn ? 'rgba(212,148,15,0.3)' : 'var(--border)'};overflow:hidden">
          <div style="padding:12px 18px;border-bottom:1px solid var(--border-light);display:flex;justify-content:space-between;align-items:center">
            <h4 style="font-size:12px;font-weight:700;color:var(--text-0)">🛡 Super Admin</h4>
            ${isSuperLoggedIn ? '<span style="font-size:10px;font-weight:700;color:var(--green);background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);padding:2px 8px;border-radius:4px">✓ LOGGED IN</span>' : ''}
          </div>
          <div style="padding:14px 18px">
            ${isSuperLoggedIn ? `
              <div style="font-size:11px;color:var(--text-2);margin-bottom:12px;line-height:1.6">Full control: add/edit stations, manage admins, activate/deactivate and view all data.</div>
              <button class="btn btn-ghost btn-sm btn-block" onclick="mt_changeSupercreds()" style="font-size:11px;margin-bottom:8px">🔑 Change Super Admin Credentials</button>
              <button class="btn btn-ghost btn-sm btn-block" onclick="mt_superLogout()" style="font-size:11px;color:var(--red)">⏻ Logout Super Admin</button>
            ` : `
              <div style="display:flex;gap:8px;margin-bottom:10px">
                <input class="form-input" id="superUser" placeholder="Username" style="flex:1;font-size:13px" autocomplete="off" />
                <input class="form-input" id="superPass" type="password" placeholder="Password" style="flex:1;font-size:13px" onkeydown="if(event.key==='Enter')mt_doSuperLogin()" />
              </div>
              <button class="btn btn-ghost btn-sm btn-block" onclick="mt_doSuperLogin()" style="font-size:12px">🔐 Super Admin Login</button>
            `}
          </div>
        </div>

        <div style="text-align:center;font-size:10px;color:var(--text-3);margin-top:16px">FuelBunk Pro v3.0 • Multi-Tenant Edition</div>
      </div>
    </div>
  `;
}

function mt_toast(msg, type='info') {
  const c = document.getElementById('toastContainer') || (() => {
    const el = document.createElement('div');
    el.id = 'toastContainer';
    el.className = 'toast-container';
    document.body.appendChild(el);
    return el;
  })();
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

function mt_selectTenant(id) {
  const t = mt_getTenants().find(x => x.id === id);
  if (!t) return;
  if (t.active === false) { mt_toast('This station is inactive. Contact Super Admin to activate.', 'error'); return; }
  mt_setActiveTenant(t);
  location.reload();
}

function mt_openAddTenant() { mt_showTenantForm(null); }
function mt_openEditTenant(id) {
  const t = mt_getTenants().find(x => x.id === id);
  if (!t) return;
  mt_showTenantForm(t);
}

function mt_showTenantForm(existing) {
  const isEdit = !!existing;
  const app = document.getElementById('app');
  const newId = existing?.id || ('t_' + Date.now().toString(36));
  app.innerHTML = `
    <div style="position:fixed;inset:0;background:var(--bg-0);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;z-index:9999">
      <div style="width:100%;max-width:480px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <button onclick="mt_showSelector()" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text-1);border-radius:var(--radius-sm);padding:8px 14px;cursor:pointer;font-size:13px;font-weight:600">← Back</button>
          <h2 style="font-size:20px;font-weight:800;color:var(--text-0)">${isEdit ? '✏️ Edit Station' : '➕ Add New Station'}</h2>
        </div>
        <div style="background:var(--bg-2);border-radius:var(--radius);border:1px solid var(--border);padding:24px;margin-bottom:16px">
          <div class="form-group"><label class="form-label">Station Name *</label>
            <input class="form-input" id="tName" placeholder="e.g. Sri Lakshmi Fuel Station" value="${existing?.name||''}" />
          </div>
          <div class="form-group"><label class="form-label">Location</label>
            <input class="form-input" id="tLocation" placeholder="e.g. Tumakuru, Karnataka" value="${existing?.location||''}" />
          </div>
          <div class="form-group"><label class="form-label">Owner Name</label>
            <input class="form-input" id="tOwner" placeholder="e.g. Ramesh Kumar" value="${existing?.ownerName||''}" />
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Phone</label>
              <input class="form-input" id="tPhone" placeholder="9876543210" value="${existing?.phone||''}" />
            </div>
            <div class="form-group"><label class="form-label">Station Icon</label>
              <select class="form-input" id="tIcon">
                ${['⛽','🛢️','🏪','⚡','🚗','🏭'].map(i => `<option ${(existing?.icon||'⛽')===i?'selected':''}>${i}</option>`).join('')}
              </select>
            </div>
          </div>
          ${!isEdit ? `
          <div style="background:var(--bg-0);border-radius:var(--radius-sm);border:1px solid var(--border-light);padding:14px;margin-top:4px">
            <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">Admin Credentials for this Station</div>
            <div class="form-row">
              <div class="form-group mb-0"><label class="form-label">Admin Username</label>
                <input class="form-input" id="tAdminUser" placeholder="admin" value="admin" />
              </div>
              <div class="form-group mb-0"><label class="form-label">Admin Password</label>
                <input class="form-input" id="tAdminPass" type="password" placeholder="admin123" value="admin123" />
              </div>
            </div>
          </div>
          ` : ''}
        </div>
        <input type="hidden" id="tId" value="${newId}" />
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="mt_showSelector()">Cancel</button>
          <button class="btn btn-accent" style="flex:1" onclick="mt_saveTenant(${isEdit})">💾 ${isEdit ? 'Save Changes' : 'Create Station'}</button>
        </div>
      </div>
    </div>
  `;
}

async function mt_saveTenant(isEdit) {
  const id       = document.getElementById('tId')?.value;
  const name     = document.getElementById('tName')?.value?.trim();
  const location = document.getElementById('tLocation')?.value?.trim();
  const ownerName= document.getElementById('tOwner')?.value?.trim();
  const phone    = document.getElementById('tPhone')?.value?.trim();
  const icon     = document.getElementById('tIcon')?.value || '⛽';
  if (!name || name.length < 2) { mt_toast('Enter a station name', 'error'); return; }
  const tenants = mt_getTenants();
  const colors = [['#d4940f','#f0b429'],['#3b82f6','#60a5fa'],['#22c55e','#4ade80'],['#a855f7','#c084fc'],['#ef4444','#f87171'],['#06b6d4','#22d3ee']];
  const colorIdx = tenants.length % colors.length;
  if (isEdit) {
    const idx = tenants.findIndex(t => t.id === id);
    if (idx === -1) { mt_toast('Station not found', 'error'); return; }
    tenants[idx] = { ...tenants[idx], name, location, ownerName, phone, icon };
    mt_saveTenants(tenants);
    mt_toast(`${name} updated`, 'success');
    mt_showSelector();
  } else {
    if (tenants.find(t => t.name.toLowerCase() === name.toLowerCase())) { mt_toast('A station with this name already exists', 'error'); return; }
    const adminUser = document.getElementById('tAdminUser')?.value?.trim() || 'admin';
    const adminPass = document.getElementById('tAdminPass')?.value || 'admin123';
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(adminPass));
    const adminPassHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    const newTenant = { id, name, location, ownerName, phone, icon, color: colors[colorIdx][0], colorLight: colors[colorIdx][1], createdAt: new Date().toISOString(), active: true, adminUsers: [{ id: 1, name: ownerName || 'Owner', username: adminUser, passHash: adminPassHash, role: 'Owner' }] };
    tenants.push(newTenant);
    mt_saveTenants(tenants);
    mt_toast(`${name} created!`, 'success');
    mt_showSelector();
  }
}

function mt_confirmDeleteTenant(id) {
  const t = mt_getTenants().find(x => x.id === id);
  if (!t) return;
  document.getElementById('app').innerHTML += `
    <div id="mtDeleteOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px">
      <div style="background:var(--bg-2);border-radius:16px;border:1px solid var(--border);padding:28px;max-width:380px;width:100%;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">⚠️</div>
        <div style="font-size:16px;font-weight:700;color:var(--text-0);margin-bottom:8px">Delete "${t.name}"?</div>
        <div style="font-size:13px;color:var(--text-2);margin-bottom:20px;line-height:1.6">This permanently deletes the station and ALL its data. Cannot be undone.</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="document.getElementById('mtDeleteOverlay').remove()">Cancel</button>
          <button class="btn btn-red" style="flex:1" onclick="mt_deleteTenant('${id}')">🗑 Delete</button>
        </div>
      </div>
    </div>
  `;
}

async function mt_deleteTenant(id) {
  const tenants = mt_getTenants();
  const t = tenants.find(x => x.id === id);
  if (!t) return;
  try { indexedDB.deleteDatabase(mt_dbName(id)); } catch(e) {}
  mt_saveTenants(tenants.filter(x => x.id !== id));
  const active = mt_getActiveTenant();
  if (active?.id === id) mt_clearActiveTenant();
  mt_toast(`${t.name} deleted`, 'success');
  mt_showSelector();
}

// ── Super Admin: Manage Station Admin Users ──
function mt_manageStationAdmins(id) {
  const tenants = mt_getTenants();
  const t = tenants.find(x => x.id === id);
  if (!t) return;

  function renderAdminList() {
    const admins = t.adminUsers || [];
    return admins.length ? admins.map((u, i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div style="width:34px;height:34px;border-radius:50%;background:var(--accent);display:grid;place-items:center;font-size:13px;font-weight:800;color:#000;flex-shrink:0">${(u.name||'?')[0].toUpperCase()}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:700;color:var(--text-0)">${u.name}</div>
          <div style="font-size:11px;color:var(--text-3)">@${u.username} · ${u.role||'Admin'}</div>
        </div>
        <button onclick="mt_resetStationAdminPass('${id}',${i})" style="background:rgba(212,148,15,0.1);border:1px solid rgba(212,148,15,0.25);color:var(--accent-light);cursor:pointer;padding:4px 10px;font-size:11px;font-weight:700;border-radius:6px">🔑 Reset PW</button>
        ${admins.length > 1 ? `<button onclick="mt_deleteStationAdmin('${id}',${i})" style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);color:var(--red);cursor:pointer;padding:4px 8px;font-size:11px;border-radius:6px">✕</button>` : ''}
      </div>`).join('') : '<div style="color:var(--text-3);font-size:13px;padding:12px 0">No admin users</div>';
  }

  const overlay = document.createElement('div');
  overlay.id = 'adminMgrOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(6px);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  overlay.innerHTML = `
    <div style="background:var(--bg-1);border-radius:16px;border:1px solid var(--border);width:100%;max-width:480px">
      <div style="padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text-0)">👤 Manage Admins</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px">${t.name}</div>
        </div>
        <button onclick="document.getElementById('adminMgrOverlay').remove()" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text-2);border-radius:8px;padding:5px 12px;cursor:pointer;font-size:12px">✕ Close</button>
      </div>

      <div style="padding:18px 22px">
        <!-- Admin List -->
        <div id="adminListContainer">${renderAdminList()}</div>

        <!-- Add New Admin -->
        <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-top:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">➕ Add New Admin</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div><label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:4px">Full Name *</label>
              <input class="form-input" id="newSAName" placeholder="e.g. Ramesh Kumar" style="font-size:13px" /></div>
            <div><label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:4px">Role</label>
              <select class="form-input" id="newSARole" style="font-size:13px">
                <option>Owner</option><option>Manager</option><option>Accountant</option>
              </select></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
            <div><label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:4px">Username *</label>
              <input class="form-input" id="newSAUser" placeholder="e.g. admin" autocomplete="off" style="font-size:13px" /></div>
            <div><label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:4px">Password *</label>
              <input class="form-input" id="newSAPass" type="password" placeholder="Min 6 chars" style="font-size:13px" /></div>
          </div>
          <button onclick="mt_addStationAdmin('${id}')" class="btn btn-accent btn-block" style="font-size:13px">💾 Add Admin User</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function mt_addStationAdmin(tenantId) {
  const name = document.getElementById('newSAName')?.value?.trim();
  const role = document.getElementById('newSARole')?.value || 'Manager';
  const username = document.getElementById('newSAUser')?.value?.trim()?.toLowerCase();
  const pass = document.getElementById('newSAPass')?.value || '';
  if (!name || name.length < 2) { mt_toast('Enter full name', 'error'); return; }
  if (!username || username.length < 2) { mt_toast('Enter username', 'error'); return; }
  if (pass.length < 6) { mt_toast('Password must be at least 6 characters', 'error'); return; }

  const tenants = mt_getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) return;

  if ((tenants[idx].adminUsers||[]).find(u => u.username === username)) {
    mt_toast('Username already exists for this station', 'error'); return;
  }

  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  const passHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const newUser = { id: Date.now(), name, username, passHash, role };
  tenants[idx].adminUsers = [...(tenants[idx].adminUsers||[]), newUser];
  mt_saveTenants(tenants);
  mt_toast(`${name} added as admin`, 'success');
  // Refresh overlay
  document.getElementById('adminMgrOverlay').remove();
  mt_manageStationAdmins(tenantId);
}

async function mt_resetStationAdminPass(tenantId, userIdx) {
  const newPass = prompt(`Enter new password for this admin (min 6 chars):`);
  if (!newPass) return;
  if (newPass.length < 6) { mt_toast('Password too short (min 6)', 'error'); return; }
  const tenants = mt_getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) return;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPass));
  const passHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  tenants[idx].adminUsers[userIdx].passHash = passHash;
  mt_saveTenants(tenants);
  mt_toast('Password reset successfully', 'success');
  document.getElementById('adminMgrOverlay').remove();
  mt_manageStationAdmins(tenantId);
}

function mt_deleteStationAdmin(tenantId, userIdx) {
  if (!confirm('Remove this admin user?')) return;
  const tenants = mt_getTenants();
  const idx = tenants.findIndex(t => t.id === tenantId);
  if (idx === -1) return;
  tenants[idx].adminUsers = tenants[idx].adminUsers.filter((_, i) => i !== userIdx);
  mt_saveTenants(tenants);
  mt_toast('Admin removed', 'success');
  document.getElementById('adminMgrOverlay').remove();
  mt_manageStationAdmins(tenantId);
}

// ── Change Super Admin Credentials ──
function mt_changeSupercreds() {
  const overlay = document.createElement('div');
  overlay.id = 'superCredsOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);z-index:10003;display:flex;align-items:center;justify-content:center;padding:20px';
  const creds = mt_getSuperCreds();
  overlay.innerHTML = `
    <div style="background:var(--bg-1);border-radius:16px;border:1px solid rgba(212,148,15,0.3);width:100%;max-width:420px;padding:24px">
      <div style="font-size:16px;font-weight:800;color:var(--text-0);margin-bottom:4px">🔑 Change Super Admin Credentials</div>
      <div style="font-size:11px;color:var(--text-3);margin-bottom:20px">Current username: <strong style="color:var(--accent-light)">${creds.username}</strong></div>

      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px">New Username</label>
        <input class="form-input" id="scNewUser" placeholder="${creds.username}" value="${creds.username}" autocomplete="off" />
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px">New Password</label>
        <input class="form-input" id="scNewPass" type="password" placeholder="Enter new password (min 6 chars)" autocomplete="new-password" />
      </div>
      <div style="margin-bottom:20px">
        <label style="font-size:11px;color:var(--text-3);display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:0.5px">Confirm Password</label>
        <input class="form-input" id="scConfPass" type="password" placeholder="Confirm new password" autocomplete="new-password" />
      </div>
      <div style="background:rgba(212,148,15,0.08);border:1px solid rgba(212,148,15,0.2);border-radius:8px;padding:10px 12px;font-size:11px;color:var(--accent-light);margin-bottom:16px;line-height:1.6">
        ⚠️ Save these credentials securely. If lost, you cannot recover super admin access.
      </div>
      <div style="display:flex;gap:10px">
        <button onclick="document.getElementById('superCredsOverlay').remove()" class="btn btn-ghost" style="flex:1">Cancel</button>
        <button onclick="mt_saveSupercreds()" class="btn btn-accent" style="flex:1">💾 Save Credentials</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function mt_saveSupercreds() {
  const newUser = document.getElementById('scNewUser')?.value?.trim()?.toLowerCase();
  const newPass = document.getElementById('scNewPass')?.value || '';
  const confPass = document.getElementById('scConfPass')?.value || '';
  if (!newUser || newUser.length < 3) { mt_toast('Username must be at least 3 characters', 'error'); return; }
  if (newPass.length < 6) { mt_toast('Password must be at least 6 characters', 'error'); return; }
  if (newPass !== confPass) { mt_toast('Passwords do not match', 'error'); return; }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPass));
  const passHash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  mt_saveSuperCreds(newUser, passHash);
  document.getElementById('superCredsOverlay').remove();
  mt_toast('Super admin credentials updated! Use new login next time.', 'success');
}

async function mt_doSuperLogin() {
  const u = (document.getElementById('superUser')?.value || '').trim().toLowerCase();
  const p = document.getElementById('superPass')?.value || '';
  if (!u || !p) { mt_toast('Enter credentials', 'error'); return; }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  const creds = mt_getSuperCreds();
  const isValid = (u === creds.username && hash === creds.passHash);
  if (!isValid) { mt_toast('Invalid super admin credentials', 'error'); return; }
  mt_saveSuperSession();
  mt_toast('Super Admin logged in', 'success');
  mt_showSelector();
}

function mt_superLogout() {
  mt_clearSuperSession();
  mt_showSelector();
}

// ── Super Admin: Toggle Station Active/Inactive ──
function mt_toggleStation(id) {
  const tenants = mt_getTenants();
  const idx = tenants.findIndex(t => t.id === id);
  if (idx === -1) return;
  const wasActive = tenants[idx].active !== false;
  tenants[idx].active = !wasActive;
  mt_saveTenants(tenants);
  mt_toast(`Station ${wasActive ? 'deactivated' : 'activated'} successfully`, wasActive ? 'error' : 'success');
  mt_showSelector();
}

// ── Super Admin: View All Station Data ──
async function mt_viewStationData(id) {
  const tenants = mt_getTenants();
  const t = tenants.find(x => x.id === id);
  if (!t) return;

  const app = document.getElementById('app');
  // Show loading
  const overlay = document.createElement('div');
  overlay.id = 'stationDataOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);backdrop-filter:blur(6px);z-index:10001;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto';
  overlay.innerHTML = `<div style="color:var(--text-1);font-size:14px;text-align:center"><div style="font-size:32px;margin-bottom:12px">⏳</div>Loading station data...</div>`;
  document.body.appendChild(overlay);

  // Load this station's IndexedDB
  let stData = { sales:[], tanks:[], pumps:[], employees:[], shifts:[], expenses:[], creditCustomers:[], fuelPurchases:[], dipReadings:[] };
  try {
    const dbName = mt_dbName(id);
    const stDb = await new Promise((resolve, reject) => {
      const req = indexedDB.open(dbName, MT_DB_VERSION);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror = () => resolve(null);
      req.onupgradeneeded = e => resolve(e.target.result);
      setTimeout(() => resolve(null), 3000);
    });

    if (stDb) {
      const stores = ['sales','tanks','pumps','employees','shifts','expenses','creditCustomers','fuelPurchases','dipReadings'];
      for (const store of stores) {
        try {
          const existing = Array.from(stDb.objectStoreNames);
          if (existing.includes(store)) {
            stData[store] = await new Promise((res) => {
              const tx = stDb.transaction(store, 'readonly');
              const req2 = tx.objectStore(store).getAll();
              req2.onsuccess = () => res(req2.result || []);
              req2.onerror = () => res([]);
            });
          }
        } catch(e) { stData[store] = []; }
      }
      stDb.close();
    }
  } catch(e) { /* use empty data */ }

  // Calculate summary stats
  const today = new Date().toISOString().split('T')[0];
  const salesAll = stData.sales || [];
  const todaySales = salesAll.filter(s => s.date === today);
  const totalRevenue = salesAll.reduce((s, x) => s + (x.amount || 0), 0);
  const todayRevenue = todaySales.reduce((s, x) => s + (x.amount || 0), 0);
  const totalLiters = salesAll.reduce((s, x) => s + (x.liters || 0), 0);
  const creditCusts = stData.creditCustomers || [];
  const totalOutstanding = creditCusts.reduce((s, x) => s + (x.outstanding || 0), 0);

  const fmt2 = n => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n || 0);
  const cur2 = n => '₹' + fmt2(n);

  // Payment mode breakdown
  const payModes = {};
  salesAll.forEach(s => { payModes[s.mode] = (payModes[s.mode]||0) + (s.amount||0); });

  // Tank summary
  const tanks = stData.tanks || [];
  const tankHtml = tanks.length ? tanks.map(tk => {
    const pct = tk.capacity ? Math.round((tk.current||0)/tk.capacity*100) : 0;
    const col = pct > 40 ? 'var(--green)' : pct > 15 ? '#f97316' : 'var(--red)';
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:11px;font-weight:600;color:var(--text-1)">${tk.fuelType||'Tank'} (Tank ${tk.id})</span>
        <span style="font-size:11px;color:${col};font-weight:700">${fmt2(tk.current||0)}L / ${fmt2(tk.capacity||0)}L (${pct}%)</span>
      </div>
      <div style="height:6px;background:var(--bg-0);border-radius:3px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:${col};border-radius:3px;transition:width 0.5s"></div>
      </div>
    </div>`;
  }).join('') : '<div style="color:var(--text-3);font-size:12px">No tank data</div>';

  // Recent sales table
  const recentSales = salesAll.slice(-10).reverse();
  const salesHtml = recentSales.length ? recentSales.map(s => `
    <tr>
      <td style="padding:6px 8px;font-size:11px;color:var(--text-2)">${s.date||'-'}</td>
      <td style="padding:6px 8px;font-size:11px;font-weight:600;color:var(--text-0)">${s.fuelType||'-'}</td>
      <td style="padding:6px 8px;font-size:11px;color:var(--text-1)">${fmt2(s.liters||0)}L</td>
      <td style="padding:6px 8px;font-size:11px;font-weight:700;color:var(--accent-light)">${cur2(s.amount||0)}</td>
      <td style="padding:6px 8px;font-size:10px;color:var(--text-3)">${s.mode||'-'}</td>
    </tr>
  `).join('') : '<tr><td colspan="5" style="padding:16px;text-align:center;color:var(--text-3);font-size:12px">No sales recorded</td></tr>';

  // Employees list
  const empHtml = (stData.employees||[]).length ? (stData.employees||[]).map(e =>
    `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--border-light)">
      <div style="width:28px;height:28px;border-radius:50%;background:${e.color||'var(--accent)'};display:grid;place-items:center;font-size:11px;font-weight:700;color:#000;flex-shrink:0">${(e.name||'?')[0]}</div>
      <div style="flex:1"><div style="font-size:12px;font-weight:600;color:var(--text-0)">${e.name||'-'}</div><div style="font-size:10px;color:var(--text-3)">${e.role||'-'} · ${e.shift||'-'}</div></div>
      <div style="font-size:11px;color:var(--text-2)">${cur2(e.salary||0)}/mo</div>
    </div>`
  ).join('') : '<div style="color:var(--text-3);font-size:12px;padding:10px 0">No employees found</div>';

  overlay.innerHTML = `
    <div style="background:var(--bg-1);border-radius:16px;border:1px solid var(--border);width:100%;max-width:680px;max-height:90vh;overflow-y:auto">

      <!-- Header -->
      <div style="padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;background:var(--bg-1);z-index:10">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,${t.color||'var(--accent)'},${t.colorLight||'var(--accent-light)'});display:grid;place-items:center;font-size:20px">${t.icon||'⛽'}</div>
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text-0)">${t.name}</div>
            <div style="font-size:11px;color:var(--text-3)">${t.location||''} ${t.ownerName ? '· '+t.ownerName : ''}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;${t.active!==false ? 'background:rgba(34,197,94,0.12);color:var(--green);border:1px solid rgba(34,197,94,0.25)' : 'background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.2)'}">${t.active!==false ? '● ACTIVE' : '● INACTIVE'}</span>
          <button onclick="document.getElementById('stationDataOverlay').remove()" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text-2);border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;font-weight:600">✕ Close</button>
        </div>
      </div>

      <div style="padding:20px 24px">

        <!-- KPI Row -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
          ${[
            ['Total Revenue', cur2(totalRevenue), 'var(--accent-light)', '💰'],
            ['Today Revenue', cur2(todayRevenue), 'var(--green)', '📅'],
            ['Total Litres', fmt2(totalLiters)+'L', 'var(--blue)', '⛽'],
            ['Outstanding', cur2(totalOutstanding), totalOutstanding>0?'var(--red)':'var(--text-2)', '💳'],
          ].map(([lbl,val,col,ico]) => `
            <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:12px;text-align:center">
              <div style="font-size:18px;margin-bottom:4px">${ico}</div>
              <div style="font-size:15px;font-weight:800;color:${col}">${val}</div>
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${lbl}</div>
            </div>
          `).join('')}
        </div>

        <!-- Stats Row -->
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px">
          ${[
            ['Total Sales', salesAll.length],
            ['Today Sales', todaySales.length],
            ['Employees', (stData.employees||[]).length],
            ['Credit Customers', creditCusts.length],
          ].map(([lbl,val]) => `
            <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center">
              <div style="font-size:18px;font-weight:800;color:var(--text-0)">${val}</div>
              <div style="font-size:9px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-top:2px">${lbl}</div>
            </div>
          `).join('')}
        </div>

        <!-- Tanks -->
        <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:12px">🛢️ Tank Levels</div>
          ${tankHtml}
        </div>

        <!-- Two cols: Employees + Payment modes -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px">
          <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">👥 Staff (${(stData.employees||[]).length})</div>
            ${empHtml}
          </div>
          <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:16px">
            <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">💳 Payment Modes</div>
            ${Object.keys(payModes).length ? Object.entries(payModes).map(([mode, amt]) => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-light)">
                <span style="font-size:12px;font-weight:600;color:var(--text-1);text-transform:capitalize">${mode}</span>
                <span style="font-size:12px;font-weight:700;color:var(--accent-light)">${cur2(amt)}</span>
              </div>
            `).join('') : '<div style="color:var(--text-3);font-size:12px">No data</div>'}
          </div>
        </div>

        <!-- Recent Sales -->
        <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="padding:12px 16px;border-bottom:1px solid var(--border-light);font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px">💰 Last 10 Sales</div>
          <div style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse">
              <thead>
                <tr style="background:var(--bg-0)">
                  <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Date</th>
                  <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Fuel</th>
                  <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Litres</th>
                  <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Amount</th>
                  <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase">Mode</th>
                </tr>
              </thead>
              <tbody>${salesHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- Station Info Footer -->
        <div style="margin-top:14px;background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:14px">
          <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">ℹ️ Station Info</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
            ${[['ID', t.id],['Owner', t.ownerName||'-'],['Phone', t.phone||'-'],['Created', t.createdAt ? t.createdAt.split('T')[0] : '-'],['Admin Users', (t.adminUsers||[]).length + ' user(s)'],['DB Size', (stData.sales||[]).length + ' sales records']].map(([k,v]) => `
              <div style="display:flex;gap:6px"><span style="color:var(--text-3);min-width:80px">${k}:</span><span style="color:var(--text-1);font-weight:600">${v}</span></div>
            `).join('')}
          </div>
        </div>

      </div>
    </div>
  `;
}


// ── Tenant Settings (change admin password etc.) ──
function mt_getTenantAdminUsers(tenantId) {
  const t = mt_getTenants().find(x => x.id === tenantId);
  return t?.adminUsers || [];
}

// ═══════════════════════════════════════════════════════════
// END MULTI-TENANT LAYER
// ═══════════════════════════════════════════════════════════

const DB_NAME = 'FuelBunkPro'; // Will be overridden per-tenant below
const DB_VERSION = 4;

class FuelDB {
  constructor(dbName) {
    this.db = null;
    this.ready = this.init(dbName);
  }

  init(dbName) {
    this._dbName = dbName || DB_NAME;
    return new Promise((resolve, reject) => {
      let resolved = false;
      const req = indexedDB.open(this._dbName, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        const stores = [
          { name: 'sales', keyPath: 'id', autoIncrement: true, indexes: ['date', 'fuelType', 'mode', 'shift'] },
          { name: 'tanks', keyPath: 'id' },
          { name: 'pumps', keyPath: 'id' },
          { name: 'dipReadings', keyPath: 'id', autoIncrement: true, indexes: ['date', 'tankId'] },
          { name: 'expenses', keyPath: 'id', autoIncrement: true, indexes: ['date', 'category'] },
          { name: 'fuelPurchases', keyPath: 'id', autoIncrement: true, indexes: ['date', 'fuelType'] },
          { name: 'creditCustomers', keyPath: 'id', autoIncrement: true },
          { name: 'creditTransactions', keyPath: 'id', autoIncrement: true, indexes: ['customerId', 'date'] },
          { name: 'employees', keyPath: 'id', autoIncrement: true },
          { name: 'shifts', keyPath: 'id' },
          { name: 'settings', keyPath: 'key' },
          { name: 'pendingSync', keyPath: 'id', autoIncrement: true },
          { name: 'auditLog', keyPath: 'id', indexes: ['timestamp', 'user', 'action'] },
        ];
        stores.forEach(s => {
          if (!db.objectStoreNames.contains(s.name)) {
            const store = db.createObjectStore(s.name, { keyPath: s.keyPath, autoIncrement: s.autoIncrement || false });
            (s.indexes || []).forEach(idx => store.createIndex(idx, idx, { unique: false }));
          }
        });
      };
      req.onblocked = () => {
        console.warn('IndexedDB upgrade blocked — closing old connections');
        if (!resolved) { resolved = true; resolve(); }
      };
      req.onsuccess = (e) => { this.db = e.target.result; if (!resolved) { resolved = true; resolve(); } };
      req.onerror = (e) => { if (!resolved) { resolved = true; reject(e.target.error); } };
      // Safety timeout — don't let DB init hang the whole app
      setTimeout(() => { if (!resolved) { resolved = true; console.warn('IndexedDB init timed out'); resolve(); } }, 3000);
    });
  }

  async tx(storeName, mode = 'readonly') {
    await this.ready;
    return this.db.transaction(storeName, mode).objectStore(storeName);
  }

  // Generic CRUD
  async getAll(storeName) {
    const store = await this.tx(storeName);
    return new Promise((res, rej) => {
      const req = store.getAll();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async get(storeName, key) {
    const store = await this.tx(storeName);
    return new Promise((res, rej) => {
      const req = store.get(key);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async put(storeName, data) {
    const store = await this.tx(storeName, 'readwrite');
    return new Promise((res, rej) => {
      const req = store.put(data);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async add(storeName, data) {
    const store = await this.tx(storeName, 'readwrite');
    return new Promise((res, rej) => {
      const req = store.add(data);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  async delete(storeName, key) {
    const store = await this.tx(storeName, 'readwrite');
    return new Promise((res, rej) => {
      const req = store.delete(key);
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async clear(storeName) {
    const store = await this.tx(storeName, 'readwrite');
    return new Promise((res, rej) => {
      const req = store.clear();
      req.onsuccess = () => res();
      req.onerror = () => rej(req.error);
    });
  }

  async count(storeName) {
    const store = await this.tx(storeName);
    return new Promise((res, rej) => {
      const req = store.count();
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  // Query by index
  async getByIndex(storeName, indexName, value) {
    const store = await this.tx(storeName);
    const index = store.index(indexName);
    return new Promise((res, rej) => {
      const req = index.getAll(value);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });
  }

  // Bulk insert
  async bulkPut(storeName, items) {
    await this.ready;
    return new Promise((res, rej) => {
      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      items.forEach(item => store.put(item));
      transaction.oncomplete = () => res();
      transaction.onerror = () => rej(transaction.error);
    });
  }

  // Settings helpers
  async getSetting(key, defaultVal = null) {
    const row = await this.get('settings', key);
    return row ? row.value : defaultVal;
  }

  async setSetting(key, value) {
    return this.put('settings', { key, value });
  }
}

// Singleton — tenant-namespaced
const _activeTenant = (function() {
  try { return JSON.parse(localStorage.getItem('fb_active_tenant') || 'null'); } catch { return null; }
})();
const _tenantDbName = _activeTenant ? ('FuelBunkPro_' + _activeTenant.id) : 'FuelBunkPro_demo';
try { window.db = new FuelDB(_tenantDbName); } catch(e) { console.warn('FuelDB init error:', e); window.db = null; }

// ═══════════════════════════════════════════════════════════
// FUELBUNK PRO — Utilities
// ═══════════════════════════════════════════════════════════

// ── FORMATTERS ───────────────────────────────────────────────
const fmt = n => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const cur = n => '₹' + fmt(n);
const today = () => new Date().toISOString().split('T')[0];
const now = () => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });

// ── SECURITY UTILITIES ──────────────────────────────────────
// XSS Sanitizer — use on ALL user-entered data before rendering
function sanitize(str) {
  if (str === null || str === undefined) return '';
  if (typeof str !== 'string') return String(str);
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// SHA-256 hash using Web Crypto API
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Synchronous hash fallback for initial load (simple djb2 + hex)
function hashSync(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) + str.charCodeAt(i);
  return (h >>> 0).toString(16).padStart(8,'0');
}

// App Secret for session signing
function getAppSecret() {
  let secret = localStorage.getItem('fb_app_secret');
  if (!secret) {
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    secret = Array.from(arr).map(b => b.toString(16).padStart(2,'0')).join('');
    localStorage.setItem('fb_app_secret', secret);
  }
  return secret;
}

// Session signing
function signData(payload) {
  const raw = JSON.stringify(payload);
  const sig = hashSync(raw + getAppSecret());
  return JSON.stringify({ payload: raw, sig });
}
function verifyData(stored) {
  try {
    const { payload, sig } = JSON.parse(stored);
    const expected = hashSync(payload + getAppSecret());
    if (sig !== expected) return null;
    return JSON.parse(payload);
  } catch { return null; }
}

// Rate Limiting
const loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000; // 5 minutes

function checkRateLimit(key) {
  const r = loginAttempts[key];
  if (!r) return true;
  if (r.lockedUntil && Date.now() < r.lockedUntil) {
    const sec = Math.ceil((r.lockedUntil - Date.now()) / 1000);
    toast('Account locked. Try again in ' + sec + 's', 'error');
    return false;
  }
  if (r.lockedUntil && Date.now() >= r.lockedUntil) {
    delete loginAttempts[key];
    return true;
  }
  return r.count < MAX_LOGIN_ATTEMPTS;
}
function recordFailedLogin(key) {
  if (!loginAttempts[key]) loginAttempts[key] = { count: 0 };
  loginAttempts[key].count++;
  if (loginAttempts[key].count >= MAX_LOGIN_ATTEMPTS) {
    loginAttempts[key].lockedUntil = Date.now() + LOCKOUT_MS;
    toast('Too many failed attempts. Locked for 5 minutes.', 'error');
  }
}
function recordSuccessLogin(key) { delete loginAttempts[key]; }

// Audit Log
function auditLog(action, details) {
  const entry = {
    id: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    user: APP.role === 'admin'
      ? (APP.adminUser?.name || 'Admin')
      : (empState?.user?.name || 'Employee'),
    role: APP.role || 'unknown',
    action: action,
    details: details || {},
  };
  if (!APP.auditLog) APP.auditLog = [];
  APP.auditLog.unshift(entry);
  // Non-blocking DB write with timeout
  if (db && db.db) {
    Promise.race([
      db.add('auditLog', entry),
      new Promise((_, rej) => setTimeout(() => rej('timeout'), 2000))
    ]).catch(() => {});
  }
}

// Schema validators
function validateSessionShape(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.loggedIn !== 'boolean') return false;
  if (!['admin', 'employee', null].includes(data.role)) return false;
  if (data.loggedIn && !data.timestamp) return false;
  return true;
}
function validateEmpSessionShape(data) {
  if (!data || typeof data !== 'object') return false;
  if (typeof data.active !== 'boolean') return false;
  if (data.active && (!data.user || typeof data.user.id !== 'number')) return false;
  if (typeof data.openReadings !== 'object') return false;
  if (!Array.isArray(data.sales)) return false;
  // Ensure arrays/objects have correct types if present
  if (data.closeReadings !== undefined && typeof data.closeReadings !== 'object') return false;
  if (data.dipReadings !== undefined && !Array.isArray(data.dipReadings)) return false;
  // Coerce page to string if missing
  if (!data.page || typeof data.page !== 'string') data.page = 'readings';
  return true;
}

// Input validators
function validateSaleInput(fuelType, liters, amount, vehicle, prices) {
  const errors = [];
  if (!fuelType || !['petrol','diesel','premium','premium_petrol'].includes(fuelType))
    errors.push('Invalid fuel type');
  if (isNaN(liters) || liters <= 0)
    errors.push('Liters must be positive');
  // No upper liter limit — allow bulk/tanker sales
  if (isNaN(amount) || amount <= 0)
    errors.push('Amount must be positive');
  if (amount > 10000000)
    errors.push('Amount exceeds ₹1,00,00,000 limit');
  const price = prices?.[fuelType] || 0;
  if (price > 0 && liters > 0) {
    const expected = liters * price;
    const tolerance = Math.max(1, expected * 0.01); // 1% tolerance or ₹1 min
    if (Math.abs(amount - expected) > tolerance)
      errors.push('Amount mismatch with rate. Expected ≈₹' + expected.toFixed(2));
  }
  if (!vehicle || vehicle.length < 2)
    errors.push('Enter valid vehicle number');
  if (vehicle && !/^[A-Z0-9\s\-\.]+$/i.test(vehicle))
    errors.push('Vehicle number has invalid characters');
  return errors;
}
function validateReading(opening, closing) {
  if (isNaN(closing) || closing < 0) return 'Invalid reading';
  if (opening !== undefined && closing < opening)
    return 'Closing reading cannot be less than opening';
  if (closing - (opening || 0) > 10000)
    return 'Reading difference too large (>10000L). Verify.';
  return null;
}
function validateExpenseInput(amount, category, desc) {
  const errors = [];
  if (isNaN(amount) || amount <= 0) errors.push('Amount must be positive');
  if (amount > 500000) errors.push('Amount exceeds ₹5,00,000 limit');
  if (!category) errors.push('Select category');
  if (!desc || desc.trim().length < 3) errors.push('Enter description (min 3 chars)');
  return errors;
}

// Session expiry constants
const SESSION_MAX_AGE = 12 * 60 * 60 * 1000; // 12 hours
const SESSION_IDLE_TIMEOUT = 30 * 60 * 1000;  // 30 minutes
let idleTimer = null;

function resetIdleTimer() {
  clearTimeout(idleTimer);
  // Update lastActive in session
  const raw = localStorage.getItem('fb_session');
  if (raw) {
    const data = verifyData(raw);
    if (data) {
      data.lastActive = Date.now();
      localStorage.setItem('fb_session', signData(data));
    }
  }
  idleTimer = setTimeout(() => {
    if (APP.loggedIn) {
      toast('Session expired due to inactivity', 'info');
      appLogout();
    }
  }, SESSION_IDLE_TIMEOUT);
}

// Backup reminder
function checkBackupReminder() {
  const lastBackup = localStorage.getItem('fb_last_backup');
  const daysSince = lastBackup ? Math.floor((Date.now() - parseInt(lastBackup)) / 86400000) : 999;
  if (daysSince >= 7 && APP.role === 'admin') {
    setTimeout(() => toast('You haven\'t backed up data in ' + daysSince + ' days. Go to Settings → Export.', 'info'), 3000);
  }
}

// ── FUEL TYPES ───────────────────────────────────────────────
const FUEL_TYPES = [
  { id: 'petrol', name: 'Petrol (MS)', short: 'Petrol', color: '#ef4444', cssClass: 'c-petrol', icon: '🔴' },
  { id: 'diesel', name: 'Diesel (HSD)', short: 'Diesel', color: '#f97316', cssClass: 'c-diesel', icon: '🟠' },
  { id: 'premium_petrol', name: 'XP95 Premium', short: 'Premium', color: '#a855f7', cssClass: 'c-premium', icon: '🟣' },
];
const getFuel = id => FUEL_TYPES.find(f => f.id === id) || FUEL_TYPES[0];

// ── IOCL Standard Dip Chart — 10,000 Litre Tank ──────────────
// Source: IOCL Official Dip Chart (Horizontal Cylindrical Tank)
// Index = dip depth in cm (1–194)
// vol   = volume in litres at full-cm dip
// diff  = litres per mm (for sub-cm interpolation)
// Usage: volume = IOCL_DIP_10K[cm].vol + (mm × IOCL_DIP_10K[cm].diff)

const IOCL_DIP_10K = {
  // cm : { vol, diff }
  1:  { vol:6.95,    diff:null },
  2:  { vol:19.64,   diff:1.27 },
  3:  { vol:36.02,   diff:1.64 },
  4:  { vol:55.37,   diff:1.93 },
  5:  { vol:77.26,   diff:2.19 },
  6:  { vol:101.40,  diff:2.41 },
  7:  { vol:127.57,  diff:2.62 },
  8:  { vol:155.62,  diff:2.80 },
  9:  { vol:185.40,  diff:2.98 },
  10: { vol:216.79,  diff:3.14 },
  11: { vol:249.71,  diff:3.29 },
  12: { vol:284.07,  diff:3.44 },
  13: { vol:319.80,  diff:3.57 },
  14: { vol:356.82,  diff:3.70 },
  15: { vol:395.09,  diff:3.83 },
  16: { vol:434.54,  diff:3.95 },
  17: { vol:475.13,  diff:4.06 },
  18: { vol:516.82,  diff:4.17 },
  19: { vol:559.57,  diff:4.27 },
  20: { vol:603.32,  diff:4.38 },
  21: { vol:648.06,  diff:4.47 },
  22: { vol:693.75,  diff:4.57 },
  23: { vol:740.35,  diff:4.66 },
  24: { vol:787.84,  diff:4.75 },
  25: { vol:836.19,  diff:4.83 },
  26: { vol:885.38,  diff:4.92 },
  27: { vol:935.37,  diff:5.00 },
  28: { vol:986.14,  diff:5.08 },
  29: { vol:1037.68, diff:5.15 },
  30: { vol:1089.95, diff:5.23 },
  31: { vol:1142.95, diff:5.30 },
  32: { vol:1196.65, diff:5.37 },
  33: { vol:1251.02, diff:5.44 },
  34: { vol:1306.06, diff:5.50 },
  35: { vol:1361.74, diff:5.57 },
  36: { vol:1418.05, diff:5.63 },
  37: { vol:1474.97, diff:5.69 },
  38: { vol:1532.49, diff:5.75 },
  39: { vol:1590.58, diff:5.81 },
  40: { vol:1649.24, diff:5.87 },
  41: { vol:1708.45, diff:5.92 },
  42: { vol:1768.20, diff:5.97 },
  43: { vol:1828.46, diff:6.03 },
  44: { vol:1889.24, diff:6.08 },
  45: { vol:1950.50, diff:6.13 },
  46: { vol:2012.26, diff:6.18 },
  47: { vol:2074.48, diff:6.22 },
  48: { vol:2137.16, diff:6.27 },
  49: { vol:2200.29, diff:6.31 },
  50: { vol:2263.85, diff:6.36 },
  51: { vol:2327.83, diff:6.40 },
  52: { vol:2392.23, diff:6.44 },
  53: { vol:2457.02, diff:6.48 },
  54: { vol:2522.21, diff:6.52 },
  55: { vol:2587.78, diff:6.56 },
  56: { vol:2653.71, diff:6.59 },
  57: { vol:2720.01, diff:6.63 },
  58: { vol:2786.66, diff:6.66 },
  59: { vol:2853.64, diff:6.70 },
  60: { vol:2920.96, diff:6.73 },
  61: { vol:2988.60, diff:6.76 },
  62: { vol:3056.54, diff:6.79 },
  63: { vol:3124.79, diff:6.83 },
  64: { vol:3193.34, diff:6.85 },
  65: { vol:3262.16, diff:6.88 },
  66: { vol:3331.27, diff:6.91 },
  67: { vol:3400.64, diff:6.94 },
  68: { vol:3470.27, diff:6.96 },
  69: { vol:3540.14, diff:6.99 },
  70: { vol:3610.26, diff:7.01 },
  71: { vol:3680.62, diff:7.04 },
  72: { vol:3751.19, diff:7.06 },
  73: { vol:3821.99, diff:7.08 },
  74: { vol:3892.99, diff:7.10 },
  75: { vol:3964.20, diff:7.12 },
  76: { vol:4035.59, diff:7.14 },
  77: { vol:4107.18, diff:7.16 },
  78: { vol:4178.94, diff:7.18 },
  79: { vol:4250.87, diff:7.19 },
  80: { vol:4322.96, diff:7.21 },
  81: { vol:4395.21, diff:7.22 },
  82: { vol:4467.61, diff:7.24 },
  83: { vol:4540.15, diff:7.25 },
  84: { vol:4612.82, diff:7.27 },
  85: { vol:4685.61, diff:7.28 },
  86: { vol:4758.53, diff:7.29 },
  87: { vol:4831.56, diff:7.30 },
  88: { vol:4904.69, diff:7.31 },
  89: { vol:4977.92, diff:7.32 },
  90: { vol:5051.24, diff:7.33 },
  91: { vol:5124.64, diff:7.34 },
  92: { vol:5198.12, diff:7.35 },
  93: { vol:5271.67, diff:7.36 },
  94: { vol:5345.29, diff:7.36 },
  95: { vol:5418.96, diff:7.36 },
  96: { vol:5492.68, diff:7.36 },
  97: { vol:5566.38, diff:7.37 },
  98: { vol:5640.12, diff:7.37 },
  99: { vol:5713.82, diff:7.37 },
  100:{ vol:5787.52, diff:7.37 },
  101:{ vol:5861.22, diff:7.36 },
  102:{ vol:5934.82, diff:7.36 },
  103:{ vol:6008.42, diff:7.35 },
  104:{ vol:6081.92, diff:7.34 },
  105:{ vol:6111.26, diff:7.33 },
  106:{ vol:6184.49, diff:7.32 },
  107:{ vol:6257.62, diff:7.31 },
  108:{ vol:6330.65, diff:7.30 },
  109:{ vol:6403.57, diff:7.29 },
  110:{ vol:6476.36, diff:7.28 },
  111:{ vol:6549.03, diff:7.27 },
  112:{ vol:6621.57, diff:7.25 },
  113:{ vol:6693.97, diff:7.24 },
  114:{ vol:6766.22, diff:7.22 },
  115:{ vol:6838.31, diff:7.21 },
  116:{ vol:6910.24, diff:7.19 },
  117:{ vol:6982.00, diff:7.18 },
  118:{ vol:7053.59, diff:7.16 },
  119:{ vol:7124.98, diff:7.14 },
  120:{ vol:7196.19, diff:7.12 },
  121:{ vol:7267.19, diff:7.10 },
  122:{ vol:7337.99, diff:7.08 },
  123:{ vol:7408.56, diff:7.06 },
  124:{ vol:7478.92, diff:7.04 },
  125:{ vol:7549.03, diff:7.01 },
  126:{ vol:7618.91, diff:6.99 },
  127:{ vol:7688.54, diff:6.96 },
  128:{ vol:7757.91, diff:6.94 },
  129:{ vol:7827.01, diff:6.91 },
  130:{ vol:7895.84, diff:6.88 },
  131:{ vol:7964.38, diff:6.85 },
  132:{ vol:8032.64, diff:6.83 },
  133:{ vol:8100.58, diff:6.79 },
  134:{ vol:8168.22, diff:6.76 },
  135:{ vol:8235.54, diff:6.73 },
  136:{ vol:8302.52, diff:6.70 },
  137:{ vol:8369.17, diff:6.66 },
  138:{ vol:8435.46, diff:6.63 },
  139:{ vol:8501.40, diff:6.59 },
  140:{ vol:8566.97, diff:6.56 },
  141:{ vol:8632.16, diff:6.52 },
  142:{ vol:8696.95, diff:6.48 },
  143:{ vol:8761.35, diff:6.44 },
  144:{ vol:8825.33, diff:6.40 },
  145:{ vol:8888.83, diff:6.36 },
  146:{ vol:8952.02, diff:6.31 },
  147:{ vol:9014.70, diff:6.27 },
  148:{ vol:9076.92, diff:6.22 },
  149:{ vol:9138.67, diff:6.18 },
  150:{ vol:9199.94, diff:6.13 },
  151:{ vol:9260.72, diff:6.08 },
  152:{ vol:9320.98, diff:6.03 },
  153:{ vol:9380.73, diff:5.97 },
  154:{ vol:9439.94, diff:5.92 },
  155:{ vol:9498.60, diff:5.87 },
  156:{ vol:9556.69, diff:5.81 },
  157:{ vol:9614.21, diff:5.75 },
  158:{ vol:9671.13, diff:5.69 },
  159:{ vol:9727.44, diff:5.63 },
  160:{ vol:9783.12, diff:5.57 },
  161:{ vol:9838.16, diff:5.50 },
  162:{ vol:9892.53, diff:5.44 },
  163:{ vol:9946.23, diff:5.37 },
  164:{ vol:9999.22, diff:5.30 },
  165:{ vol:10051.50,diff:5.23 },
  166:{ vol:10103.04,diff:5.15 },
  167:{ vol:10153.81,diff:5.08 },
  168:{ vol:10203.80,diff:5.00 },
  169:{ vol:10252.99,diff:4.92 },
  170:{ vol:10301.33,diff:4.83 },
  171:{ vol:10348.83,diff:4.75 },
  172:{ vol:10395.43,diff:4.66 },
  173:{ vol:10441.12,diff:4.57 },
  174:{ vol:10485.85,diff:4.47 },
  175:{ vol:10529.61,diff:4.38 },
  176:{ vol:10572.36,diff:4.27 },
  177:{ vol:10614.04,diff:4.17 },
  178:{ vol:10654.64,diff:4.06 },
  179:{ vol:10694.09,diff:3.95 },
  180:{ vol:10732.36,diff:3.83 },
  181:{ vol:10769.38,diff:3.70 },
  182:{ vol:10805.11,diff:3.57 },
  183:{ vol:10839.46,diff:3.44 },
  184:{ vol:10872.38,diff:3.29 },
  185:{ vol:10903.78,diff:3.14 },
  186:{ vol:10933.56,diff:2.98 },
  187:{ vol:10961.60,diff:2.80 },
  188:{ vol:10987.78,diff:2.62 },
  189:{ vol:11011.92,diff:2.41 },
  190:{ vol:11033.81,diff:2.19 },
  191:{ vol:11053.16,diff:1.93 },
  192:{ vol:11069.54,diff:1.64 },
  193:{ vol:11082.23,diff:1.27 },
  194:{ vol:11089.78,diff:0.70 },
};

// Lookup: dipCm (integer), dipMm (0–9)
// Returns litres (capped at 10000 for 10kL tank)
function ioclDipToLiters(dipCm, dipMm) {
  dipCm = Math.max(1, Math.min(194, Math.round(dipCm)));
  dipMm = Math.max(0, Math.min(9, Math.round(dipMm)));
  const row = IOCL_DIP_10K[dipCm];
  if (!row) return 0;
  const mmAdd = dipMm > 0 && row.diff ? dipMm * row.diff : 0;
  return Math.round((row.vol + mmAdd) * 100) / 100;
}

// Does this tank use IOCL 10K dip chart?
function tankUsesIoclChart(tank) {
  return tank && Number(tank.capacity) === 10000;
}

// ── IOCL Standard Dip Chart — 20,000 Litre Tank ──────────────
// Source: IOCL Official Dip Chart (Horizontal Cylindrical Tank)
// Full range: cm 1–210 (both chart pages integrated)

const IOCL_DIP_20K = {
  1: { vol: 12.06, diff: null },
  2: { vol: 34.06, diff: 2.20 },
  3: { vol: 62.48, diff: 2.84 },
  4: { vol: 96.06, diff: 3.36 },
  5: { vol: 134.05, diff: 3.80 },
  6: { vol: 175.95, diff: 4.19 },
  7: { vol: 221.41, diff: 4.55 },
  8: { vol: 270.11, diff: 4.87 },
  9: { vol: 321.84, diff: 5.17 },
  10: { vol: 376.39, diff: 5.45 },
  11: { vol: 433.59, diff: 5.72 },
  12: { vol: 493.32, diff: 5.97 },
  13: { vol: 555.42, diff: 6.21 },
  14: { vol: 619.81, diff: 6.44 },
  15: { vol: 686.36, diff: 6.66 },
  16: { vol: 755.00, diff: 6.86 },
  17: { vol: 825.64, diff: 7.06 },
  18: { vol: 898.20, diff: 7.26 },
  19: { vol: 972.61, diff: 7.44 },
  20: { vol: 1048.81, diff: 7.62 },
  21: { vol: 1126.73, diff: 7.79 },
  22: { vol: 1206.33, diff: 7.96 },
  23: { vol: 1287.54, diff: 8.12 },
  24: { vol: 1370.31, diff: 8.28 },
  25: { vol: 1454.61, diff: 8.43 },
  26: { vol: 1540.38, diff: 8.58 },
  27: { vol: 1627.58, diff: 8.72 },
  28: { vol: 1716.17, diff: 8.86 },
  29: { vol: 1806.11, diff: 8.99 },
  30: { vol: 1897.37, diff: 9.13 },
  31: { vol: 1989.90, diff: 9.25 },
  32: { vol: 2083.69, diff: 9.38 },
  33: { vol: 2178.69, diff: 9.50 },
  34: { vol: 2274.87, diff: 9.62 },
  35: { vol: 2372.20, diff: 9.73 },
  36: { vol: 2470.66, diff: 9.85 },
  37: { vol: 2570.21, diff: 9.96 },
  38: { vol: 2670.84, diff: 10.06 },
  39: { vol: 2772.50, diff: 10.17 },
  40: { vol: 2875.18, diff: 10.27 },
  41: { vol: 2978.86, diff: 10.37 },
  42: { vol: 3083.50, diff: 10.46 },
  43: { vol: 3189.09, diff: 10.56 },
  44: { vol: 3295.60, diff: 10.65 },
  45: { vol: 3403.01, diff: 10.74 },
  46: { vol: 3511.30, diff: 10.83 },
  47: { vol: 3620.45, diff: 10.91 },
  48: { vol: 3730.44, diff: 11.00 },
  49: { vol: 3841.24, diff: 11.08 },
  50: { vol: 3952.85, diff: 11.16 },
  51: { vol: 4065.23, diff: 11.24 },
  52: { vol: 4178.38, diff: 11.31 },
  53: { vol: 4292.26, diff: 11.39 },
  54: { vol: 4406.88, diff: 11.46 },
  55: { vol: 4522.20, diff: 11.53 },
  56: { vol: 4638.21, diff: 11.60 },
  57: { vol: 4754.89, diff: 11.67 },
  58: { vol: 4872.23, diff: 11.73 },
  59: { vol: 4990.21, diff: 11.80 },
  60: { vol: 5108.82, diff: 11.86 },
  61: { vol: 5228.03, diff: 11.92 },
  62: { vol: 5347.84, diff: 11.98 },
  63: { vol: 5468.22, diff: 12.04 },
  64: { vol: 5589.17, diff: 12.09 },
  65: { vol: 5710.67, diff: 12.15 },
  66: { vol: 5832.70, diff: 12.20 },
  67: { vol: 5955.25, diff: 12.25 },
  68: { vol: 6078.30, diff: 12.31 },
  69: { vol: 6201.85, diff: 12.35 },
  70: { vol: 6325.87, diff: 12.40 },
  71: { vol: 6450.36, diff: 12.45 },
  72: { vol: 6575.30, diff: 12.49 },
  73: { vol: 6700.67, diff: 12.54 },
  74: { vol: 6826.47, diff: 12.58 },
  75: { vol: 6952.69, diff: 12.62 },
  76: { vol: 7079.30, diff: 12.66 },
  77: { vol: 7206.29, diff: 12.70 },
  78: { vol: 7333.66, diff: 12.74 },
  79: { vol: 7461.39, diff: 12.77 },
  80: { vol: 7589.47, diff: 12.81 },
  81: { vol: 7717.88, diff: 12.84 },
  82: { vol: 7846.62, diff: 12.87 },
  83: { vol: 7975.67, diff: 12.91 },
  84: { vol: 8105.02, diff: 12.94 },
  85: { vol: 8234.66, diff: 12.96 },
  86: { vol: 8364.58, diff: 12.99 },
  87: { vol: 8494.76, diff: 13.02 },
  88: { vol: 8625.20, diff: 13.04 },
  89: { vol: 8755.88, diff: 13.07 },
  90: { vol: 8886.79, diff: 13.09 },
  91: { vol: 9017.92, diff: 13.11 },
  92: { vol: 9149.26, diff: 13.13 },
  93: { vol: 9280.80, diff: 13.15 },
  94: { vol: 9412.52, diff: 13.17 },
  95: { vol: 9544.43, diff: 13.19 },
  96: { vol: 9676.50, diff: 13.21 },
  97: { vol: 9808.72, diff: 13.22 },
  98: { vol: 9941.08, diff: 13.24 },
  99: { vol: 10073.58, diff: 13.25 },
  100: { vol: 10206.21, diff: 13.26 },
  101: { vol: 10338.94, diff: 13.27 },
  102: { vol: 10471.78, diff: 13.28 },
  103: { vol: 10604.71, diff: 13.29 },
  104: { vol: 10737.72, diff: 13.30 },
  105: { vol: 10870.82, diff: 13.30 },
  106: { vol: 11003.82, diff: 13.30 },
  107: { vol: 11051.54, diff: 13.30 },
  108: { vol: 11184.47, diff: 13.29 },
  109: { vol: 11317.31, diff: 13.28 },
  110: { vol: 11450.04, diff: 13.27 },
  111: { vol: 11528.67, diff: 13.26 },
  112: { vol: 11715.17, diff: 13.25 },
  113: { vol: 11847.53, diff: 13.24 },
  114: { vol: 11979.75, diff: 13.22 },
  115: { vol: 12111.82, diff: 13.21 },
  116: { vol: 12243.73, diff: 13.19 },
  117: { vol: 12375.45, diff: 13.17 },
  118: { vol: 12506.99, diff: 13.15 },
  119: { vol: 12638.33, diff: 13.13 },
  120: { vol: 12769.46, diff: 13.11 },
  121: { vol: 12900.37, diff: 13.09 },
  122: { vol: 13031.05, diff: 13.07 },
  123: { vol: 13161.49, diff: 13.04 },
  124: { vol: 13291.67, diff: 13.02 },
  125: { vol: 13421.59, diff: 12.99 },
  126: { vol: 13551.23, diff: 12.96 },
  127: { vol: 13680.58, diff: 12.94 },
  128: { vol: 13809.63, diff: 12.91 },
  129: { vol: 13938.37, diff: 12.87 },
  130: { vol: 14066.78, diff: 12.84 },
  131: { vol: 14194.86, diff: 12.81 },
  132: { vol: 14322.59, diff: 12.77 },
  133: { vol: 14449.96, diff: 12.74 },
  134: { vol: 14576.95, diff: 12.70 },
  135: { vol: 14703.56, diff: 12.66 },
  136: { vol: 14829.78, diff: 12.62 },
  137: { vol: 14955.58, diff: 12.58 },
  138: { vol: 15080.95, diff: 12.54 },
  139: { vol: 15205.89, diff: 12.49 },
  140: { vol: 15330.38, diff: 12.45 },
  141: { vol: 15454.40, diff: 12.40 },
  142: { vol: 15577.95, diff: 12.35 },
  143: { vol: 15701.00, diff: 12.31 },
  144: { vol: 15823.55, diff: 12.25 },
  145: { vol: 15945.58, diff: 12.20 },
  146: { vol: 16067.08, diff: 12.15 },
  147: { vol: 16188.03, diff: 12.09 },
  148: { vol: 16308.41, diff: 12.04 },
  149: { vol: 16428.22, diff: 11.98 },
  150: { vol: 16547.43, diff: 11.92 },
  151: { vol: 16666.04, diff: 11.86 },
  152: { vol: 16784.02, diff: 11.80 },
  153: { vol: 16901.36, diff: 11.73 },
  154: { vol: 17018.04, diff: 11.67 },
  155: { vol: 17134.05, diff: 11.60 },
  156: { vol: 17249.37, diff: 11.53 },
  157: { vol: 17363.99, diff: 11.46 },
  158: { vol: 17477.87, diff: 11.39 },
  159: { vol: 17591.02, diff: 11.31 },
  160: { vol: 17703.40, diff: 11.24 },
  161: { vol: 17815.01, diff: 11.16 },
  162: { vol: 17925.81, diff: 11.08 },
  163: { vol: 18035.80, diff: 11.00 },
  164: { vol: 18144.95, diff: 10.91 },
  165: { vol: 18253.24, diff: 10.83 },
  166: { vol: 18360.65, diff: 10.74 },
  167: { vol: 18467.16, diff: 10.65 },
  168: { vol: 18572.75, diff: 10.56 },
  169: { vol: 18677.39, diff: 10.46 },
  170: { vol: 18781.07, diff: 10.37 },
  171: { vol: 18883.75, diff: 10.27 },
  172: { vol: 18985.41, diff: 10.17 },
  173: { vol: 19086.04, diff: 10.06 },
  174: { vol: 19185.59, diff:  9.96 },
  175: { vol: 19284.05, diff:  9.85 },
  176: { vol: 19381.38, diff:  9.73 },
  177: { vol: 19477.56, diff:  9.62 },
  178: { vol: 19572.56, diff:  9.50 },
  179: { vol: 19666.35, diff:  9.38 },
  180: { vol: 19758.88, diff:  9.25 },
  181: { vol: 19850.14, diff:  9.13 },
  182: { vol: 19940.08, diff:  8.99 },
  183: { vol: 20028.67, diff:  8.86 },
  184: { vol: 20115.87, diff:  8.72 },
  185: { vol: 20201.64, diff:  8.58 },
  186: { vol: 20285.94, diff:  8.43 },
  187: { vol: 20368.71, diff:  8.28 },
  188: { vol: 20449.92, diff:  8.12 },
  189: { vol: 20529.52, diff:  7.96 },
  190: { vol: 20607.44, diff:  7.79 },
  191: { vol: 20683.64, diff:  7.62 },
  192: { vol: 20758.05, diff:  7.44 },
  193: { vol: 20830.61, diff:  7.26 },
  194: { vol: 20901.25, diff:  7.06 },
  195: { vol: 20969.89, diff:  6.86 },
  196: { vol: 21036.44, diff:  6.66 },
  197: { vol: 21100.83, diff:  6.44 },
  198: { vol: 21162.93, diff:  6.21 },
  199: { vol: 21222.66, diff:  5.97 },
  200: { vol: 21279.86, diff:  5.72 },
  201: { vol: 21334.41, diff:  5.45 },
  202: { vol: 21386.14, diff:  5.17 },
  203: { vol: 21434.84, diff:  4.87 },
  204: { vol: 21480.30, diff:  4.55 },
  205: { vol: 21522.20, diff:  4.19 },
  206: { vol: 21560.06, diff:  3.80 }, // Note: chart shows 21506.19 which seems a print error; corrected
  207: { vol: 21593.77, diff:  3.36 },
  208: { vol: 21622.19, diff:  2.84 },
  209: { vol: 21644.19, diff:  2.20 },
  210: { vol: 21656.25, diff:  1.21 },
};

// Min cm available in 20K chart
const IOCL_20K_MIN_CM = 1;
const IOCL_20K_MAX_CM = 210;

function ioclDipToLiters20K(dipCm, dipMm) {
  dipMm = Math.max(0, Math.min(9, Math.round(dipMm)));
  if (dipCm < IOCL_20K_MIN_CM) return null; // below chart range
  dipCm = Math.min(IOCL_20K_MAX_CM, Math.round(dipCm));
  const row = IOCL_DIP_20K[dipCm];
  if (!row) return null;
  const mmAdd = dipMm > 0 && row.diff ? dipMm * row.diff : 0;
  return Math.round((row.vol + mmAdd) * 100) / 100;
}

function getDipChart(tank) {
  if (!tank) return null;
  const cap = Number(tank.capacity);
  if (cap === 10000) return '10K';
  if (cap === 20000) return '20K';
  return null;
}




const payColors = { cash: '#22c55e', upi: '#3b82f6', card: '#a855f7', credit: '#ef4444' };
const catColors = { 'Fuel Purchase': '#f97316', Salary: '#3b82f6', Electricity: '#a855f7', Maintenance: '#ef4444', Insurance: '#06b6d4', Misc: '#6b7080', 'Sales Tax': '#d4940f', 'Local Sales Tax': '#d4940f', 'Lube Purchase': '#22c55e', 'GST': '#06b6d4', 'Lube GST': '#0891b2', Rent: '#8b5cf6' };

// ── HTML HELPERS ─────────────────────────────────────────────
function badge(text, cls = 'badge-accent') {
  return `<span class="badge ${cls}">${text}</span>`;
}

function badgeColor(text, color) {
  return `<span class="badge" style="background:${color}14;color:${color}">${text}</span>`;
}

function statCard(title, value, sub, icon, trend) {
  const trendHtml = trend
    ? `<span class="stat-trend ${trend > 0 ? 'up' : 'down'}">${trend > 0 ? '▲' : '▼'} ${Math.abs(trend)}%</span>`
    : '';
  return `<div class="card stat">
    <div class="stat-icon">${icon || ''}</div>
    <div class="stat-label">${title}</div>
    <div class="stat-value mono">${value}</div>
    <div class="stat-foot">${trendHtml}<span class="stat-sub">${sub || ''}</span></div>
  </div>`;
}

function miniBar(items, color) {
  const max = Math.max(...items.map(i => i.v), 1);
  return `<div class="mini-bars">${items.map(i =>
    `<div class="mini-bar-col"><div class="bar" style="height:${Math.max((i.v / max) * 48, 3)}px;background:linear-gradient(180deg,${color},${color}44)"></div><span class="lbl">${i.l}</span></div>`
  ).join('')}</div>`;
}

function progressBar(pct, color, height = 'progress-md') {
  const safePct = isNaN(pct) || !isFinite(pct) ? 0 : Math.min(100, Math.max(0, pct));
  return `<div class="progress ${height}"><div class="progress-bar" style="width:${safePct}%;background:${color}"></div><span class="pct">${safePct.toFixed(1)}%</span></div>`;
}

// ── TOASTS ───────────────────────────────────────────────────
let toastContainer = null;
function toast(msg, type = 'success') {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  const icons = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── MODALS ───────────────────────────────────────────────────
function openModal(title, bodyHtml, footerHtml = '', width = 520) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="width:min(${width}px,calc(100vw - 32px))" onclick="event.stopPropagation()">
      <div class="modal-head">
        <h3>${title}</h3>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal-foot">${footerHtml}</div>` : ''}
    </div>`;
  overlay.addEventListener('click', closeModal);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));
}

function closeModal() {
  const el = document.getElementById('modal-overlay');
  if (el) {
    el.classList.remove('open');
    setTimeout(() => el.remove(), 250);
  }
}

// ── QR CODE GENERATOR (Simple) ───────────────────────────────
// Minimal QR for UPI - uses a canvas-based approach
function generateUPIQR(container, { vpa, name, amount, note }) {
  const upiStr = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}${amount ? '&am=' + amount : ''}${note ? '&tn=' + encodeURIComponent(note) : ''}&cu=INR`;

  // Create a simple visual QR representation
  // In production, use a library like qrcode.js
  const size = 200;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.className = 'qr-canvas';
  const ctx = canvas.getContext('2d');

  // Generate a deterministic pattern from the UPI string
  let hash = 0;
  for (let i = 0; i < upiStr.length; i++) {
    hash = ((hash << 5) - hash + upiStr.charCodeAt(i)) | 0;
  }

  const modules = 25;
  const cellSize = size / modules;

  // White background
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, size, size);

  // QR-like pattern
  ctx.fillStyle = '#000';

  // Position detection patterns (corners)
  function drawFinderPattern(x, y) {
    const s = cellSize;
    ctx.fillRect(x * s, y * s, 7 * s, 7 * s);
    ctx.fillStyle = 'white';
    ctx.fillRect((x + 1) * s, (y + 1) * s, 5 * s, 5 * s);
    ctx.fillStyle = '#000';
    ctx.fillRect((x + 2) * s, (y + 2) * s, 3 * s, 3 * s);
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(modules - 7, 0);
  drawFinderPattern(0, modules - 7);

  // Data modules (seeded random)
  let seed = Math.abs(hash);
  const rng = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  for (let y = 0; y < modules; y++) {
    for (let x = 0; x < modules; x++) {
      // Skip finder patterns
      if ((x < 8 && y < 8) || (x > modules - 9 && y < 8) || (x < 8 && y > modules - 9)) continue;
      if (rng() > 0.5) {
        ctx.fillStyle = '#000';
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      }
    }
  }

  container.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'qr-container';
  wrapper.appendChild(canvas);

  const info = document.createElement('div');
  info.className = 'upi-info';
  info.innerHTML = `
    <div style="font-size:14px;color:#333;font-weight:700;margin-bottom:4px">Scan & Pay</div>
    <div class="upi-id">${vpa}</div>
    ${amount ? `<div style="font-size:18px;color:#000;font-weight:800;margin-top:8px">₹${amount}</div>` : ''}
    <div style="font-size:10px;color:#888;margin-top:6px">UPI Payment</div>
  `;
  wrapper.appendChild(info);
  container.appendChild(wrapper);

  // Store UPI string for copy
  container.dataset.upiString = upiStr;
  return upiStr;
}

// ── PDF REPORT GENERATOR ─────────────────────────────────────
function generatePDFReport(title, sections) {
  // Resolve station name dynamically
  const stationName = APP.data?.upiName || APP.tenant?.name || 'Fuel Station';
  const stationLocation = APP.tenant?.location || '';
  const stationCode = APP.data?.stationCode || APP.tenant?.stationCode || '';
  // Create a printable HTML document
  // Use HTML entity for ₹ to avoid encoding issues in blob URL
  const safeRs = v => '&#8377;' + new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(v);
  // Replace ₹ with HTML entity in all section content
  const safeSections = sections.map(s => s.replace(/₹/g, '&#8377;'));
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', system-ui, sans-serif; color: #333; padding: 40px; font-size: 12px; line-height: 1.6; }
        .header { text-align: center; border-bottom: 3px solid #d4940f; padding-bottom: 16px; margin-bottom: 24px; }
        .header h1 { font-size: 22px; color: #1a1a1a; }
        .header h2 { font-size: 14px; color: #666; font-weight: 400; }
        .header .meta { font-size: 11px; color: #888; margin-top: 8px; }
        .section { margin-bottom: 20px; page-break-inside: avoid; }
        .section h3 { font-size: 14px; color: #d4940f; border-bottom: 1px solid #eee; padding-bottom: 6px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
        th { background: #f5f5f5; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 2px solid #ddd; }
        th.r { text-align: right; }
        td { padding: 7px 10px; border-bottom: 1px solid #eee; }
        td.r { text-align: right; }
        .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
        .summary-box { background: #f8f9fa; padding: 12px; border-radius: 6px; border-left: 3px solid #d4940f; }
        .summary-box .label { font-size: 10px; color: #888; text-transform: uppercase; }
        .summary-box .value { font-size: 18px; font-weight: 700; color: #1a1a1a; }
        .footer { text-align: center; font-size: 10px; color: #aaa; margin-top: 30px; padding-top: 12px; border-top: 1px solid #eee; }
        .text-green { color: #16a34a; }
        .text-red { color: #dc2626; }
        .fw-700 { font-weight: 700; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${stationName}</h1>
        ${stationLocation ? '<p style="color:#666;font-size:12px;margin-top:2px">' + stationLocation + '</p>' : ''}
        <h2>${title}</h2>
        <div class="meta">Generated: ${new Date().toLocaleString('en-IN')}${stationCode ? ' | Station Code: ' + stationCode : ''}</div>
      </div>
      ${safeSections.join('')}
      <div class="footer">
        FuelBunk Pro — Auto Generated Report${APP.data?.omcName ? ' | OMC: ' + APP.data.omcName : ''}<br>
        This is a computer-generated document and does not require a signature.
      </div>
    </body>
    </html>
  `;

  // Try window.open first (works on hosted/https)
  // For file:// protocol (local HTML) use in-app iframe overlay instead
  const blob = new Blob([printContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  // Always try popup first — if blocked, fall through to overlay
  let opened = false;
  try {
    const pw = window.open(blobUrl, '_blank');
    if (pw && !pw.closed) { opened = true; setTimeout(() => { try { pw.focus(); } catch(e){} URL.revokeObjectURL(blobUrl); }, 2000); }
  } catch(e) {}

  if (!opened) {
    // In-app fullscreen report overlay (works on file://, content://, any blocked popup)
    const closeBtn = '<button onclick="document.getElementById(\'reportOverlay\').remove()" style="background:#d4940f;color:#000;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#10005; Close</button>';
    const printBtn = '<button onclick="document.getElementById(\'reportFrame\').contentWindow.print()" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#128424; Print / Save PDF</button>';
    const dlBtn    = '<a href="' + blobUrl + '" download="fuelbunk-report.html" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px;text-decoration:none">&#8595; Download</a>';
    const toolbar  = '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1a1a2e;border-bottom:2px solid #d4940f;flex-shrink:0">' + closeBtn + '<span style="color:#fff;font-size:13px;font-weight:600;flex:1">FuelBunk Pro &#8212; Report</span>' + printBtn + dlBtn + '</div>';
    const frame    = '<iframe id="reportFrame" src="' + blobUrl + '" style="flex:1;border:none;width:100%;height:100%"></iframe>';
    const overlay  = document.createElement('div');
    overlay.id = 'reportOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column';
    overlay.innerHTML = toolbar + frame;
    // Remove any existing overlay
    const existing = document.getElementById('reportOverlay');
    if (existing) existing.remove();
    document.body.appendChild(overlay);
  }
}

// ── LOCAL NOTIFICATIONS ──────────────────────────────────────
async function requestNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendLocalNotification(title, body, tag = 'fuelbunk') {
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: 'icons/icon-192.png', tag, vibrate: [200, 100, 200] });
  }
}

// Check for low tank alerts
function checkTankAlerts(tanks) {
  tanks.forEach(t => {
    if (!t.capacity || t.capacity <= 0) return;
    const pct = (t.current / t.capacity) * 100;
    if (pct < 20) {
      const fuel = getFuel(t.fuelType);
      sendLocalNotification(
        `⚠️ Low Fuel Alert — Tank ${t.id}`,
        `${fuel.name} is at ${pct.toFixed(0)}% (${fmt(t.current)}L remaining). Order refill soon.`
      );
    }
  });
}

// Check for credit limit alerts
function checkCreditAlerts(customers) {
  customers.forEach(c => {
    if (!c.limit || c.limit <= 0) return;
    const pct = (c.outstanding / c.limit) * 100;
    if (pct > 85) {
      sendLocalNotification(
        `🚨 Credit Limit Alert — ${sanitize(c.name)}`,
        `Outstanding: ${cur(c.outstanding)} (${pct.toFixed(0)}% of limit). Consider blocking further credit.`
      );
    }
  });
}

// ── SHARE / EXPORT ───────────────────────────────────────────
async function shareData(title, text) {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return true;
    } catch (e) {
      if (e.name !== 'AbortError') console.error(e);
    }
  }
  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'success');
    return true;
  } catch (e) {
    toast('Could not share/copy', 'error');
    return false;
  }
}

// ── EXPORT TO CSV ────────────────────────────────────────────
function exportCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast(`Exported ${filename}`, 'success');
}

// Make globally available
window.fmt = fmt;
window.cur = cur;
window.today = today;
window.now = now;
window.FUEL_TYPES = FUEL_TYPES;
window.getFuel = getFuel;
window.payColors = payColors;
window.catColors = catColors;
window.badge = badge;
window.badgeColor = badgeColor;
window.statCard = statCard;
window.miniBar = miniBar;
window.progressBar = progressBar;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.generateUPIQR = generateUPIQR;
window.openUPIPaymentModal = openUPIPaymentModal;
window.openUPIIntent = openUPIIntent;
window.payViaRazorpay = payViaRazorpay;
window.copyUPILink2 = copyUPILink2;
window.shareUPILink2 = shareUPILink2;
window.confirmUPIPayment = confirmUPIPayment;
window.recordSaleWithUPI = recordSaleWithUPI;
window.generatePDFReport = generatePDFReport;
window.requestNotificationPermission = requestNotificationPermission;
window.sendLocalNotification = sendLocalNotification;
window.checkTankAlerts = checkTankAlerts;
window.checkCreditAlerts = checkCreditAlerts;
window.shareData = shareData;
window.exportCSV = exportCSV;

// ═══════════════════════════════════════════════════════════
// FUELBUNK PRO — Page Renderers
// ═══════════════════════════════════════════════════════════

// ── DASHBOARD ────────────────────────────────────────────────
function renderDashboard(D) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todaySales = D.sales.filter(s => (s.date || '').slice(0, 10) === todayIso);
  const totalRevenue = todaySales.reduce((a, s) => a + s.amount, 0);
  const totalLiters = todaySales.reduce((a, s) => a + s.liters, 0);
  const cashSales = todaySales.filter(s => s.mode === 'cash').reduce((a, s) => a + s.amount, 0);

  // ── Build weekly chart data from real D.sales ──
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  D.weekly = Array.from({length: 7}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const iso = d.toISOString().slice(0, 10);
    const daySales = D.sales.filter(s => (s.date || '').slice(0, 10) === iso);
    return {
      day: dayNames[d.getDay()],
      petrol:  daySales.filter(s => s.fuelType === 'petrol').reduce((a,s) => a + s.liters, 0),
      diesel:  daySales.filter(s => s.fuelType === 'diesel').reduce((a,s) => a + s.liters, 0),
      premium: daySales.filter(s => s.fuelType !== 'petrol' && s.fuelType !== 'diesel').reduce((a,s) => a + s.liters, 0),
      revenue: daySales.reduce((a,s) => a + s.amount, 0),
    };
  });
  // Credit pending = customer outstanding balances (authoritative source)
  const totalCredit = D.creditCustomers.reduce((a, c) => a + (c.outstanding || 0), 0);
  const h = new Date().getHours();

  // Payment breakdown
  let payBars = '';
  ['cash', 'upi', 'card', 'credit'].forEach(mode => {
    const total = todaySales.filter(s => s.mode === mode).reduce((a, s) => a + s.amount, 0);
    const pct = totalRevenue > 0 ? (total / totalRevenue) * 100 : 0;
    payBars += `<div style="margin-bottom:10px">
      <div class="flex-between" style="font-size:12px;margin-bottom:4px">
        <span style="text-transform:capitalize">${mode}</span>
        <span style="color:${payColors[mode]}" class="fw-700 mono">${cur(total)} (${pct.toFixed(1)}%)</span>
      </div>
      <div class="progress progress-xs"><div class="progress-bar" style="width:${pct}%;background:${payColors[mode]}"></div></div>
    </div>`;
  });

  // Tank gauges
  let tanksHtml = D.tanks.map(t => {
    const fuel = getFuel(t.fuelType);
    const pct = t.capacity > 0 ? (t.current / t.capacity) * 100 : 0;
    const isLow = pct < 25;
    const barColor = isLow ? '#ef4444' : fuel.color;
    return `<div class="card card-pad">
      <div class="flex-between mb-10">
        <span class="fw-600" style="color:var(--text-0);font-size:13px">Tank ${t.id} — <span style="color:${fuel.color}">${fuel.short}</span></span>
        ${isLow ? badge('LOW', 'badge-red') : ''}
      </div>
      ${progressBar(pct, barColor, 'progress-lg')}
      <div class="flex-between mt-8" style="font-size:11px;color:var(--text-3)"><span class="mono">${fmt(t.current)} L</span><span>/ ${fmt(t.capacity)} L</span></div>
    </div>`;
  }).join('');

  // Weekly charts
  const petrolBars = miniBar(D.weekly.map(d => ({ l: d.day, v: d.petrol })), '#ef4444');
  const dieselBars = miniBar(D.weekly.map(d => ({ l: d.day, v: d.diesel })), '#f97316');
  const premiumBars = miniBar(D.weekly.map(d => ({ l: d.day, v: d.premium })), '#a855f7');
  const revBars = miniBar(D.weekly.map(d => ({ l: d.day, v: d.revenue })), '#22c55e');
  const weeklyTotal = D.weekly.reduce((a, d) => a + d.revenue, 0);
  const avgRev = weeklyTotal / 7;

  // Active shift
  let shiftsHtml = D.shifts.map(s => {
    const [sh] = s.start.split(':').map(Number);
    const [eh] = s.end.split(':').map(Number);
    const isActive = sh < eh ? (h >= sh && h < eh) : (h >= sh || h < eh);
    return `<div class="shift-block ${isActive ? 'is-active' : ''}" style="margin-bottom:8px">
      <div class="flex-between">
        <div><span class="fw-600" style="color:${isActive ? 'var(--accent-light)' : 'var(--text-3)'};font-size:13px">${s.name}</span>
        <span style="font-size:12px;color:var(--text-3);margin-left:8px" class="mono">${s.start} – ${s.end}</span></div>
        ${isActive ? badge('LIVE', 'badge-accent') : ''}
      </div>
      ${(() => {
        // Resolve manager live: by ID first, then fall back to name match
        let managerName = s.manager || '—';
        if (s.managerId) {
          const me = D.employees.find(e => e.id === s.managerId);
          if (me) managerName = me.name;
        } else if (s.manager) {
          // legacy: name stored, try to find current name by matching Shift Manager role
          const me = D.employees.find(e => e.role === 'Shift Manager' && e.name === s.manager);
          if (!me) {
            // name may have changed — show whatever is in s.manager but flag it
            managerName = s.manager;
          }
        }
        return managerName !== '—'
          ? `<div style="font-size:12px;color:var(--text-3);margin-top:4px">Manager: <span style="color:var(--text-1);font-weight:600">${sanitize(managerName)}</span></div>`
          : '';
      })()}
    </div>`;
  }).join('');

  return `
    <div class="g g-auto-sm mb-24 gap-16">
      ${statCard('Today\'s Revenue', cur(totalRevenue), 'all pumps today', '💰')}
      ${statCard('Liters Sold Today', fmt(totalLiters) + ' L', 'all fuel types', '⛽')}
      ${statCard('Cash in Hand', cur(cashSales), 'cash sales today', '💵')}
      ${statCard('Credit Pending', cur(totalCredit), D.creditCustomers.length + ' accounts', '📋')}
    </div>

    <div class="g g-2 gap-16 mb-24">
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📊 Weekly Sales Volume (Liters)</h4>
        <div class="flex" style="gap:20px">
          <div style="flex:1"><div class="c-petrol fw-700 mb-8" style="font-size:11px">Petrol</div>${petrolBars}</div>
          <div style="flex:1"><div class="c-diesel fw-700 mb-8" style="font-size:11px">Diesel</div>${dieselBars}</div>
          <div style="flex:1"><div class="c-premium fw-700 mb-8" style="font-size:11px">Premium</div>${premiumBars}</div>
        </div>
      </div>
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📈 Weekly Revenue</h4>
        ${revBars}
        <div class="flex-between mt-12" style="font-size:11px;color:var(--text-3)">
          <span>Avg: <span class="mono fw-600">${cur(avgRev)}</span>/day</span>
          <span>Peak: <span class="mono fw-600">${cur(D.weekly.length ? Math.max(...D.weekly.map(d => d.revenue)) : 0)}</span></span>
        </div>
      </div>
    </div>

    <h4 class="mb-14 fw-700" style="color:var(--text-0);font-size:13px">🛢️ Tank Levels</h4>
    <div class="g g-auto mb-24 gap-16">${tanksHtml}</div>

    <div class="g g-2 gap-16 mb-24">
      <div class="card card-pad"><h4 class="mb-14 fw-700" style="color:var(--text-0);font-size:13px">💳 Sales by Payment</h4>${payBars}</div>
      <div class="card card-pad"><h4 class="mb-14 fw-700" style="color:var(--text-0);font-size:13px">⏰ Shift Status</h4>${shiftsHtml}</div>
    </div>
    <div class="card card-pad">
      <div class="flex-between mb-16">
        <h4 class="fw-700" style="color:var(--text-0);font-size:13px">🧑‍🔧 Employee Status</h4>
        <span style="font-size:11px;color:var(--text-3)">${D.employees.filter(e=>e.status!=='inactive').length} active staff</span>
      </div>
      ${(() => {
        // Check for active employee session (same tab or cross-tab via localStorage)
        let activeSessions = [];
        try {
          const raw = localStorage.getItem('fb_emp_session');
          if (raw) {
            const s = verifyData(raw);
            if (s && s.active && s.user) {
              const sales = (s.sales || []).length;
              const opens = Object.keys(s.openReadings || {}).length;
              const closes = Object.keys(s.closeReadings || {}).length;
              const totalNozzles = (() => {
                const emp = D.employees.find(e => e.id === s.user.id);
                return emp ? 1 : 0; // rough check
              })();
              activeSessions.push({ ...s.user, sales, opens, closes, page: s.page || 'readings' });
            }
          }
        } catch(e) {}
        if (activeSessions.length === 0) {
          return '<div style="text-align:center;padding:16px 0;color:var(--text-3);font-size:12px">No employee sessions active right now</div>';
        }
        return activeSessions.map(u => {
          const emp = D.employees.find(e => e.id === u.id);
          const shift = emp?.shift || '—';
          const pageLabels = {readings:'Taking Readings',sales:'Recording Sales',overview:'Overview',dip:'Dip Reading',expense:'Logging Expense',history:'Viewing History',complete:'Shift Complete'};
          const pageLabel = pageLabels[u.page] || u.page;
          const statusColor = u.page === 'complete' ? 'var(--green)' : 'var(--accent-light)';
          const ini = sanitize(u.name||'').charAt(0).toUpperCase();
          return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">'
            + '<div style="display:flex;align-items:center;gap:10px">'
            + '<div style="width:32px;height:32px;border-radius:50%;background:rgba(34,197,94,0.12);border:2px solid rgba(34,197,94,0.3);display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--green)">' + ini + '</div>'
            + '<div>'
            + '<div class="fw-700" style="color:var(--text-0);font-size:13px">' + sanitize(u.name||'') + ' <span style="font-size:10px;color:var(--text-3);font-weight:500">' + sanitize(u.role||'') + '</span></div>'
            + '<div style="font-size:11px;color:var(--text-3)">Shift: ' + sanitize(shift) + ' &nbsp;·&nbsp; <span style="color:' + statusColor + ';font-weight:600">' + pageLabel + '</span></div>'
            + '</div></div>'
            + '<div style="text-align:right;display:flex;gap:6px">'
            + badge(u.opens + ' readings', 'badge-blue')
            + badge(u.sales + ' sales', 'badge-green')
            + '</div></div>';
        }).join('');
      })()}
    </div>`;
}

// ── TANKS & INVENTORY ────────────────────────────────────────
function renderTanks(D) {
  const tanksHtml = D.tanks.map(t => {
    const fuel = getFuel(t.fuelType);
    const pct = t.capacity > 0 ? Math.min(100, (t.current / t.capacity) * 100) : 0;
    const barColor = pct < 20 ? '#ef4444' : pct < 40 ? '#f97316' : fuel.color;
    const pctLabel = pct < 20 ? '⚠️ LOW' : pct < 40 ? '⚡ MED' : '✅ OK';
    const pctBg = pct < 20 ? 'rgba(239,68,68,0.12)' : pct < 40 ? 'rgba(249,115,22,0.1)' : 'rgba(34,197,94,0.1)';
    const pctColor = pct < 20 ? 'var(--red)' : pct < 40 ? '#f97316' : 'var(--green)';
    const dipSource = t.lastDip ? `Last dip: ${t.lastDip}` : 'No dip recorded';
    return `<div class="card card-pad" style="border-top:3px solid ${fuel.color}">
      <!-- Tank header -->
      <div class="flex-between mb-10">
        <div>
          <div class="fw-800" style="color:var(--text-0);font-size:15px">Tank ${t.id}
            <span style="font-size:10px;font-weight:700;color:${fuel.color};background:${fuel.color}22;padding:2px 7px;border-radius:4px;margin-left:6px">${fuel.short}</span>
          </div>
          <div style="font-size:10px;color:var(--text-3);margin-top:2px">${dipSource}</div>
        </div>
        <span style="font-size:10px;font-weight:800;padding:3px 9px;border-radius:5px;background:${pctBg};color:${pctColor}">${pctLabel} ${Math.round(pct)}%</span>
      </div>

      <!-- Main qty — this IS the dip reading / available fuel -->
      <div style="background:${fuel.color}0f;border:1px solid ${fuel.color}33;border-radius:10px;padding:14px 16px;margin-bottom:12px;text-align:center">
        <div style="font-size:11px;font-weight:700;color:${fuel.color};text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">⛽ Available to Dispense</div>
        <div class="mono fw-900" style="font-size:32px;color:var(--text-0);line-height:1">${fmt(t.current)}<span style="font-size:14px;color:var(--text-3);font-weight:400"> L</span></div>
        <div style="font-size:11px;color:var(--text-3);margin-top:4px">Tank capacity: ${fmt(t.capacity)} L &nbsp;·&nbsp; Empty: ${fmt(Math.max(0, t.capacity - t.current))} L</div>
      </div>

      <!-- Fill bar -->
      ${progressBar(pct, barColor, 'progress-lg')}

      <!-- Action buttons -->
      <div style="display:flex;gap:6px;margin-top:12px">
        <button class="btn btn-accent btn-sm" style="flex:2" onclick="openDipModal(${t.id})">📏 Record Dip</button>
        <button class="btn btn-ghost btn-sm" style="flex:1" onclick="openEditTankModal(${t.id})">✏️</button>
        <button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="confirmDeleteTank(${t.id})">🗑</button>
      </div>
    </div>`;
  }).join('');

  const dipRows = D.dipReadings.map(r => {
    const diff = r.reading - r.calculated;
    const diffHtml = diff === 0 ? `<span style="color:var(--green)" class="fw-700">OK</span>` :
      `<span style="color:${diff < 0 ? 'var(--red)' : 'var(--orange)'}" class="fw-700">${diff > 0 ? '+' : ''}${fmt(diff)} L</span>`;
    const dipTank = D.tanks.find(t => t.id === r.tankId);
    const dipFuel = dipTank ? getFuel(dipTank.fuelType) : null;
    const tankLabel = dipTank ? `Tank ${r.tankId} <span style="font-size:10px;color:${dipFuel?.color||'var(--text-3)'}">${dipFuel?.short||''}</span>` : `Tank ${r.tankId}`;
    return `<tr><td>${r.date}</td><td class="mono">${r.time}</td><td>${tankLabel}</td><td class="r mono fw-700" style="color:var(--accent-light)">${fmt(r.reading)}</td><td class="r mono" style="color:var(--text-3)">${fmt(r.calculated)}</td><td class="r">${diffHtml}</td></tr>`;
  }).join('');

  const purchaseRows = D.fuelPurchases.map(r => {
    const fuel = getFuel(r.fuelType);
    return `<tr><td>${r.date}</td><td style="color:${fuel.color}" class="fw-600">${fuel.name}</td><td class="r mono">${fmt(r.liters)}</td><td class="r mono">${cur(r.rate)}</td><td class="r mono fw-700">${cur(r.total)}</td><td class="mono" style="font-size:12px">${r.invoice}</td></tr>`;
  }).join('');

  return `
    <div class="page-hdr">
      <h3>🛢️ Tank & Inventory</h3>
      <div class="flex" style="gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openAddTankModal()">+ Add Tank</button>
        <button class="btn btn-accent" onclick="openDipModal()">+ Record Dip</button>
        <button class="btn btn-ghost" onclick="openPurchaseModal()">+ Fuel Purchase</button>
      </div>
    </div>
    <div class="g g-auto gap-16 mb-24">${tanksHtml}</div>
    <div class="card mb-24">
      <div class="card-head"><h4>📏 Recent Dip Readings</h4><button class="btn btn-ghost btn-sm" onclick="exportDipCSV()">↓ Export</button></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Time</th><th>Tank</th><th class="r">Available Qty (L)</th><th class="r">Prev Book Stock (L)</th><th class="r">Variance</th></tr></thead><tbody>${dipRows}</tbody></table></div></div>
    </div>
    <div class="card">
      <div class="card-head"><h4>🚛 Fuel Purchases</h4></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Fuel</th><th class="r">Qty (L)</th><th class="r">Rate/L</th><th class="r">Total</th><th>Invoice</th></tr></thead><tbody>${purchaseRows}</tbody></table></div></div>
    </div>`;
}

// ── PUMPS & METERS ───────────────────────────────────────────
function renderPumps(D) {
  const pumpCards = D.pumps.map(p => {
    const fuel = getFuel(p.fuelType);
    const sold = Math.max(0, (p.currentReading || 0) - (p.openReading || 0));
    const rev  = sold * (D.prices[p.fuelType] || 0);

    // Per-nozzle fuel display
    const nozzleLabels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
    const nozzleFuels  = p.nozzleFuels  || {};  // { 'A': 'petrol', 'B': 'diesel' }
    const nozzlePills  = nozzleLabels.map(n => {
      const nf   = getFuel(nozzleFuels[n] || p.fuelType);
      return `<span style="background:${nf.color}18;border:1px solid ${nf.color}44;color:${nf.color};padding:2px 8px;border-radius:4px;font-size:10px;font-weight:800">N${n}: ${nf.short}</span>`;
    }).join('');

    // Per-nozzle breakdown for mixed-fuel pumps
    const allSameFuel = nozzleLabels.every(n => (nozzleFuels[n]||p.fuelType) === (nozzleFuels[nozzleLabels[0]]||p.fuelType));
    const nozzleBreakdown = allSameFuel ? '' : nozzleLabels.map(n => {
      const nft  = getFuel(nozzleFuels[n] || p.fuelType);
      const nOpen  = (p.nozzleOpen || {})[n] ?? 0;
      const nClose = (p.nozzleReadings || {})[n] ?? 0;
      const nSold  = Math.max(0, nClose - nOpen);
      const nRev   = nSold * (D.prices[nozzleFuels[n] || p.fuelType] || 0);
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:${nft.color}0f;border-radius:6px;border:1px solid ${nft.color}22;margin-bottom:4px">
        <span style="font-size:11px;font-weight:700;color:${nft.color}">N${n}: ${nft.short}</span>
        <span class="mono fw-700" style="font-size:12px;color:var(--green)">${fmt(nSold)} L</span>
        <span class="mono" style="font-size:11px;color:var(--text-3)">${cur(nRev)}</span>
      </div>`;
    }).join('');

    return `<div class="card card-pad">
      <div class="flex-between mb-10">
        <div>
          <div class="fw-800" style="color:var(--text-0);font-size:15px">${p.name}</div>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">${nozzlePills}</div>
        </div>
        <div style="display:flex;align-items:flex-start;gap:6px">
          ${badge(p.status.toUpperCase(), p.status === 'active' ? 'badge-green' : 'badge-red')}
          <button onclick="openEditPumpModal(${p.id})" style="background:var(--bg-2);border:1px solid var(--border);color:var(--text-3);border-radius:6px;padding:3px 7px;cursor:pointer;font-size:12px" title="Edit Pump & Nozzles">✏️</button>
        </div>
      </div>
      ${allSameFuel ? `<div class="g" style="grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:10px">
        <div class="dbox"><div class="dbox-label">Opening</div><div class="dbox-value mono" style="font-size:13px">${fmt(p.openReading)}</div></div>
        <div class="dbox"><div class="dbox-label">Current</div><div class="dbox-value mono" style="font-size:13px">${fmt(p.currentReading)}</div></div>
        <div class="dbox"><div class="dbox-label">Sold</div><div class="dbox-value mono" style="font-size:13px;color:var(--green)">${fmt(sold)} L</div></div>
      </div>
      <div class="flex-between mb-10" style="font-size:12px">
        <span style="color:var(--text-3)">Revenue</span>
        <span class="mono fw-700" style="color:var(--text-0)">${cur(rev)}</span>
      </div>` : `<div style="margin-bottom:10px">${nozzleBreakdown}</div>`}
      <button class="btn btn-ghost btn-sm btn-block" onclick="openReadingModal(${p.id})">⚙️ Update Reading</button>
    </div>`;
  }).join('');

  const reconRows = D.pumps.flatMap(p => {
    const labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
    const nf = p.nozzleFuels || {};
    const nr = p.nozzleReadings || {};
    // If all nozzles have same fuel, keep single row using aggregate readings
    const fuels = labels.map(n => nf[n] || p.fuelType);
    const allSameFuel = fuels.every(f => f === fuels[0]);
    if (allSameFuel) {
      const fuel = getFuel(fuels[0]);
      const open = p.openReading || 0;
      const cur_ = p.currentReading || 0;
      const sold = Math.max(0, cur_ - open);
      const rev  = sold * ((D.prices || {})[fuels[0]] || 0);
      return [`<tr><td class="fw-600">${p.name}</td><td style="color:${fuel.color}" class="fw-600">${fuel.short}</td>
        <td class="r mono">${fmt(open)}</td><td class="r mono">${fmt(cur_)}</td>
        <td class="r mono fw-700" style="color:var(--green)">${fmt(sold)}</td><td class="r mono fw-700">${cur(rev)}</td></tr>`];
    }
    // Mixed fuel pump — one row per nozzle
    return labels.map((n, i) => {
      const ft   = nf[n] || p.fuelType;
      const fuel = getFuel(ft);
      const open  = nr[n] !== undefined ? (nr[n] - (p.nozzleOpen?.[n] || 0)) >= 0 ? (p.nozzleOpen?.[n] || 0) : 0 : (p.openReading || 0);
      const close = nr[n] !== undefined ? nr[n] : (p.currentReading || 0);
      // Use sales data as source for per-nozzle sold when nozzleReadings available
      const nozzleSales = D.sales.filter(s => s.pump === p.id && (s.nozzle === n || s.nozzle === String(n)));
      const todayIso = new Date().toISOString().slice(0,10);
      const todayNozzleSales = nozzleSales.filter(s => (s.date||'').slice(0,10) === todayIso);
      const soldL = todayNozzleSales.reduce((a,s) => a + (s.liters||0), 0);
      const soldR = todayNozzleSales.reduce((a,s) => a + (s.amount||0), 0);
      // Fall back to nozzleReading diff if we have it
      const openR = p.nozzleOpen?.[n] ?? 0;
      const closeR = nr[n] ?? 0;
      const meterSold = closeR > openR ? closeR - openR : soldL;
      const meterRev  = meterSold * ((D.prices || {})[ft] || 0);
      const rowspan = i === 0 ? ` rowspan="${labels.length}" style="vertical-align:middle"` : 'style="display:none"';
      return `<tr>
        ${i === 0 ? `<td class="fw-600" rowspan="${labels.length}" style="vertical-align:middle">${p.name}</td>` : ''}
        <td style="color:${fuel.color};padding-left:${i>0?'28':''}px" class="fw-600">N${n}: ${fuel.short}</td>
        <td class="r mono">${fmt(openR)}</td><td class="r mono">${fmt(closeR)}</td>
        <td class="r mono fw-700" style="color:var(--green)">${fmt(meterSold)}</td>
        <td class="r mono fw-700">${cur(meterRev)}</td>
      </tr>`;
    });
  }).join('');

  return `
    <div class="page-hdr"><h3>⛽ Pumps & Meters</h3><button class="btn btn-accent btn-sm" onclick="openAddPumpModal()">+ Add Pump</button></div>
    ${pumpCards.trim() ? `<div class="g g-auto gap-16 mb-24">${pumpCards}</div>` : `
      <div style="text-align:center;padding:48px 20px;color:var(--text-3)">
        <div style="font-size:48px;margin-bottom:12px;opacity:0.4">⛽</div>
        <div class="fw-700" style="font-size:16px;color:var(--text-2);margin-bottom:6px">No pumps added yet</div>
        <div style="font-size:13px;margin-bottom:20px">Add your first pump to start recording meter readings</div>
        <button class="btn btn-accent" onclick="openAddPumpModal()">+ Add Your First Pump</button>
      </div>`}
    <div class="card">
      <div class="card-head"><h4>📋 Pump Reconciliation</h4><button class="btn btn-ghost btn-sm" onclick="exportPumpCSV()">↓ Export</button></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Pump</th><th>Fuel</th><th class="r">Opening</th><th class="r">Current</th><th class="r">Sold (L)</th><th class="r">Revenue</th></tr></thead><tbody>${reconRows}</tbody></table></div></div>
    </div>`;
}

// ── SALES ────────────────────────────────────────────────────
function renderSales(D, filter = 'all') {
  const todayIso = new Date().toISOString().slice(0, 10);
  const allFiltered = filter === 'all' ? D.sales : D.sales.filter(s => s.fuelType === filter);
  const filtered = APP.salesAllTime ? allFiltered : allFiltered.filter(s => (s.date || '').slice(0, 10) === todayIso);
  const total = filtered.reduce((a, s) => a + s.amount, 0);

  const filters = [{ id: 'all', name: 'All' }, ...FUEL_TYPES].map(f =>
    `<button class="filter-chip ${APP.salesFilter === f.id ? 'active' : ''}" onclick="APP.salesFilter='${f.id}';renderPage()">${f.short || f.name}</button>`
  ).join('');

  const rows = filtered.map(s => {
    const fuel = getFuel(s.fuelType);
    const empName = s.employee ? sanitize(s.employee) : '—';
    return `<tr><td class="mono" style="font-size:11px;white-space:nowrap">${s.time}</td><td class="mono fw-600">${sanitize(s.vehicle)}</td>
      <td style="color:${fuel.color}" class="fw-600">${fuel.short}</td>
      <td class="r mono">${fmt(s.liters)}</td><td class="r mono fw-700">${cur(s.amount)}</td>
      <td class="mono" style="font-size:11px">${s.pump ? 'P'+s.pump : '—'}</td>
      <td style="font-size:11px;font-weight:600;color:var(--text-1)">${empName}</td>
      <td>${badgeColor(s.mode, payColors[s.mode])}</td>
      <td>${sanitize(s.customer) || '—'}</td></tr>`;
  }).join('');

  return `
    <div class="page-hdr">
      <h3>💰 Today's Sales</h3>
      <div class="flex" style="gap:8px;flex-wrap:wrap">
        <div class="filters">${filters}</div>
        <button class="btn btn-accent" onclick="openSaleModal()">+ New Sale</button>
      </div>
    </div>
    <div class="card">
      <div class="card-head">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="color:var(--text-3);font-size:13px">${filtered.length} today</span>
          ${allFiltered.length > filtered.length ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:2px 8px" onclick="APP.salesFilter='${filter}';APP.salesAllTime=true;renderPage()">Show all-time (${allFiltered.length})</button>` : ''}
        </div>
        <span class="mono fw-700" style="color:var(--green)">Total: ${cur(total)}</span>
      </div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Time</th><th>Vehicle</th><th>Fuel</th><th class="r">Liters</th><th class="r">Amount</th><th>Pump</th><th>Employee</th><th>Payment</th><th>Customer</th></tr></thead><tbody>${rows}</tbody></table></div></div>
    </div>
    <div class="flex" style="gap:8px;margin-top:16px">
      <button class="btn btn-ghost" onclick="exportSalesCSV()">↓ Export CSV</button>
      <button class="btn btn-ghost" onclick="shareSalesSummary()">📤 Share Summary</button>
    </div>`;
}

// ── CREDIT MANAGEMENT ────────────────────────────────────────
function renderCredit(D) {
  const totalOut = D.creditCustomers.reduce((a, c) => a + c.outstanding, 0);
  const totalLimit = D.creditCustomers.reduce((a, c) => a + c.limit, 0);

  const cards = D.creditCustomers.map(c => {
    const pct = c.limit > 0 ? Math.min(100, (c.outstanding / c.limit) * 100) : 0;
    const barColor = pct > 80 ? '#ef4444' : pct > 60 ? '#f97316' : '#22c55e';
    return `<div class="card card-pad">
      <div class="flex-between mb-14" style="align-items:flex-start">
        <div><div class="fw-800" style="color:var(--text-0);font-size:16px">${sanitize(c.name)}</div>
          ${badge(c.type, c.type === 'Fleet' ? 'badge-blue' : 'badge-purple')}</div>
        <div class="text-right"><div class="mono fw-800" style="color:${pct > 80 ? 'var(--red)' : 'var(--orange)'};font-size:20px">${cur(c.outstanding)}</div>
          <div style="font-size:11px;color:var(--text-3)">of ${cur(c.limit)}</div></div>
      </div>
      <div class="progress progress-sm mb-12"><div class="progress-bar" style="width:${pct}%;background:${barColor}"></div></div>
      <div class="flex-between" style="font-size:12px;color:var(--text-3)"><span>Used: ${pct.toFixed(0)}%</span><span>Free: ${cur(c.limit - c.outstanding)}</span></div>
      <div class="mt-8" style="font-size:12px;color:var(--text-3)">Last paid: <span style="color:var(--text-1)" class="mono">${c.lastPayment}</span></div>
      <div class="flex mt-14" style="gap:8px">
        <button class="btn btn-green-ghost btn-sm" style="flex:1" onclick="openPaymentModal(${c.id})">💵 Record Payment</button>
        <button class="btn btn-blue-ghost btn-sm" style="flex:1" onclick="openUPIModal('${sanitize(c.name)}', ${c.outstanding})">📱 UPI Request</button>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="page-hdr"><h3>💳 Credit Management</h3><button class="btn btn-accent" onclick="openCreditCustomerModal()">+ Add Customer</button></div>
    <div class="g g-auto-sm mb-24 gap-16">
      ${statCard('Total Outstanding', cur(totalOut), '', '📋')}
      ${statCard('Credit Limit', cur(totalLimit), '', '🏦')}
      ${statCard('Active Accounts', D.creditCustomers.length, 'fleet & govt', '👥')}
    </div>
    <div class="g g-auto-lg gap-16">${cards}</div>`;
}

// ── STAFF & SHIFTS ───────────────────────────────────────────
function renderStaff(D) {
  const payroll = D.employees.reduce((a, e) => a + e.salary, 0);
  const totalNozzles = D.pumps.reduce((a, p) => a + (p.nozzleLabels || ['A','B']).length, 0);
  const shiftAlloc = allocations[allocShift] || {};
  const assignedCount = Object.values(shiftAlloc).filter(v => v).length;
  const shiftEmps = D.employees.filter(e => (e.shift||'').split(',').map(s=>s.trim()).includes(allocShift));
  const empOptions = shiftEmps.map(e => `<option value="${e.id}">${e.name} (${e.role})</option>`).join('');

  // Shift tabs
  const shiftTabs = D.shifts.map(s =>
    `<button class="shift-tab ${allocShift === s.name ? 'active' : ''}" onclick="allocShift='${s.name}';renderPage()">${s.name} <span style="font-size:10px;opacity:0.6;margin-left:3px">${s.start}–${s.end}</span></button>`
  ).join('');

  // Fuel info helper
  const fuelInfo = {
    petrol: { name:'Petrol (MS)', short:'Petrol', color:'var(--petrol-color)', cls:'badge-red' },
    diesel: { name:'Diesel (HSD)', short:'Diesel', color:'var(--diesel-color)', cls:'badge-orange' },
    premium_petrol: { name:'XP95 Premium', short:'Premium', color:'var(--premium-color)', cls:'badge-purple' },
  };

  // ═══ ALLOCATION BOARD ═══
  const allocBoard = D.pumps.map(p => {
    const f = fuelInfo[p.fuelType] || fuelInfo.petrol;
    const nLabels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : ['A','B']);

    const pNozzleFuels = p.nozzleFuels || {};
    const nozzleRows = nLabels.map(n => {
      const key = `${p.id}_${n}`;
      const empId = shiftAlloc[key];
      const emp = empId ? D.employees.find(e => e.id === empId) : null;
      const isAssigned = !!emp;
      const nFuelType = pNozzleFuels[n] || p.fuelType;
      const nFuelInfo = fuelInfo[nFuelType] || fuelInfo.petrol;

      return `<div class="alloc-nozzle ${isAssigned ? 'assigned' : ''}">
        <div class="alloc-nozzle-head">
          <span class="alloc-nozzle-label">Nozzle ${n} <span style="font-size:9px;font-weight:700;color:${nFuelInfo.color};background:${nFuelInfo.color}18;padding:1px 6px;border-radius:3px;margin-left:4px">${nFuelInfo.short}</span></span>
          <span class="alloc-nozzle-status" style="background:${isAssigned ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${isAssigned ? 'var(--green)' : 'var(--red)'}">
            ${isAssigned ? '✓ Assigned' : '⚠ Unassigned'}
          </span>
        </div>
        ${isAssigned ? `
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="emp-chip assigned">
              <span class="emp-av" style="background:${empColor(emp)}">${empInitials(emp.name)}</span>
              <span>${sanitize(emp.name)}</span>
              <span style="font-size:10px;color:var(--text-3);font-weight:500">${sanitize(emp.role)}</span>
            </div>
            <div style="display:flex;gap:4px">
              <button class="btn btn-ghost btn-sm" onclick="openChangeAllocModal(${p.id},'${n}')" title="Change">✏️</button>
              <button class="btn btn-sm" style="background:rgba(239,68,68,0.08);color:var(--red);border:none" onclick="removeAlloc(${p.id},'${n}')" title="Remove">✕</button>
            </div>
          </div>
        ` : `
          <select class="alloc-select" onchange="assignNozzle(${p.id},'${n}',this.value)">
            <option value="">— Select Employee —</option>
            ${empOptions}
          </select>
        `}
      </div>`;
    }).join('');

    // Build per-nozzle fuel pills for pump header
    const pumpNozzlePills = nLabels.map(n => {
      const ft = pNozzleFuels[n] || p.fuelType;
      const fi2 = fuelInfo[ft] || fuelInfo.petrol;
      return `<span style="font-size:9px;font-weight:800;color:${fi2.color};background:${fi2.color}18;padding:2px 7px;border-radius:4px">N${n}: ${fi2.short}</span>`;
    }).join(' ');
    return `<div class="alloc-pump">
      <div class="alloc-pump-head">
        <div>
          <div class="alloc-pump-name">${p.name}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">${pumpNozzlePills}</div>
        </div>
      </div>
      <div class="alloc-nozzles">${nozzleRows}</div>
    </div>`;
  }).join('');

  // ═══ EMPLOYEE ASSIGNMENT SUMMARY ═══
  const empSummaryRows = shiftEmps.map(emp => {
    const assignedNozzles = [];
    Object.entries(shiftAlloc).forEach(([key, id]) => {
      if (id === emp.id) {
        const [pumpId, nozzle] = key.split('_');
        const pump = D.pumps.find(p => p.id === parseInt(pumpId));
        assignedNozzles.push({ pump: pump?.name || `Pump ${pumpId}`, nozzle, fuelType: pump?.fuelType });
      }
    });
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <span class="emp-av" style="width:28px;height:28px;border-radius:8px;background:${empColor(emp)};display:grid;place-items:center;color:#fff;font-size:10px;font-weight:800;flex-shrink:0">${empInitials(emp.name)}</span>
        <div><div class="fw-700" style="color:var(--text-0)">${sanitize(emp.name)}</div><div style="font-size:10px;color:var(--text-3)">${sanitize(emp.role)}</div></div>
      </div></td>
      <td style="font-size:12px">${assignedNozzles.length > 0 ? assignedNozzles.map(a => {
        const fi = fuelInfo[a.fuelType] || fuelInfo.petrol;
        return `<span class="nozzle-tag"><span class="dot" style="background:${fi.color}"></span>${a.pump}‑${a.nozzle}</span>`;
      }).join('') : '<span style="color:var(--red);font-weight:600;font-size:11px">⚠ No nozzles assigned</span>'}</td>
      <td class="r"><span class="mono fw-700" style="color:${assignedNozzles.length > 0 ? 'var(--green)' : 'var(--red)'}">${assignedNozzles.length}</span></td>
    </tr>`;
  }).join('');

  // ═══ SHIFT SCHEDULE ═══
  const h = new Date().getHours();
  const shiftCards = D.shifts.map(s => {
    const emps = D.employees.filter(e => (e.shift||'').split(',').map(x=>x.trim()).includes(s.name));
    const [sh] = s.start.split(':').map(Number);
    const [eh] = s.end.split(':').map(Number);
    const isActive = sh < eh ? (h >= sh && h < eh) : (h >= sh || h < eh);
    return `<div class="dbox-lg" style="border:1px solid ${isActive ? 'rgba(212,148,15,0.3)' : 'var(--border-light)'};border-radius:var(--radius);${isActive ? 'background:rgba(212,148,15,0.04)' : ''}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="fw-700" style="color:${isActive ? 'var(--accent-light)' : 'var(--text-0)'};font-size:15px">${s.name} Shift</span>
          ${isActive ? badge('ACTIVE', 'badge-accent') : ''}
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn btn-ghost btn-sm" onclick="openEditShiftModal('${s.id}')" title="Edit Shift" style="padding:4px 8px">✏️</button>
          <button class="btn btn-sm" onclick="confirmDeleteShift('${s.id}')" title="Delete Shift" style="background:rgba(239,68,68,0.08);color:var(--red);border:none;padding:4px 8px">🗑</button>
        </div>
      </div>
      <div class="mono fw-800 mb-8" style="color:var(--text-0);font-size:20px">${s.start} — ${s.end}</div>
      <div style="font-size:12px;color:var(--text-3)">Manager: <span style="color:var(--text-1)">${(() => { const me = s.managerId ? D.employees.find(e=>e.id===s.managerId) : D.employees.find(e=>e.role==='Shift Manager'&&e.name===s.manager); return sanitize(me ? me.name : (s.manager||'—')); })()}</span> · Staff: ${emps.length}</div>
      <div style="display:flex;gap:4px;margin-top:8px;flex-wrap:wrap">${emps.map(e =>
        `<span style="width:24px;height:24px;border-radius:6px;background:${empColor(e)};display:grid;place-items:center;color:#fff;font-size:8px;font-weight:800" title="${e.name}">${empInitials(e.name)}</span>`
      ).join('')}</div>
    </div>`;
  }).join('');

  // ═══ EMPLOYEE DIRECTORY ═══
  const empRows = D.employees.map(e => {
    const hasPIN = !!getEmpPinHash(e.id);
    const pendingBal = e.pendingBalance || 0;
    const pendingEntries = (e.balanceEntries || []).filter(b => b.status === 'pending');
    return `<tr>
      <td><div style="display:flex;align-items:center;gap:8px">
        <span style="width:28px;height:28px;border-radius:8px;background:${empColor(e)};display:grid;place-items:center;color:#fff;font-size:10px;font-weight:800;flex-shrink:0">${empInitials(e.name)}</span>
        <div>
          <div class="fw-700" style="color:var(--text-0)">${sanitize(e.name)}</div>
          <div style="font-size:10px;color:var(--text-3)">${sanitize(e.phone||'')}</div>
          ${pendingBal > 0 ? `<div style="font-size:10px;font-weight:700;color:var(--red);margin-top:2px">⚠ Balance: ${cur(pendingBal)}</div>` : ''}
        </div>
      </div></td>
      <td>${badge(e.role, e.role === 'Shift Manager' ? 'badge-accent' : 'badge-blue')}</td>
      <td>${(e.shift||'').split(',').map(s=>`<span style="font-size:10px;font-weight:600;color:var(--accent-light);background:rgba(212,148,15,0.08);padding:1px 7px;border-radius:3px;margin-right:3px">${sanitize(s.trim())}</span>`).join('')}</td>
      <td class="r mono fw-600">${cur(e.salary)}</td>
      <td class="r">
        ${pendingEntries.length > 0
          ? `<button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.25);font-size:11px;padding:4px 10px" onclick="openEmpBalanceModal(${e.id})">
               ⚠️ ${cur(pendingBal)} pending
             </button>`
          : `<span style="font-size:11px;color:var(--green);font-weight:600">✅ No balance</span>`
        }
      </td>
      <td class="r">${hasPIN ? '<span style="color:var(--green);font-size:11px;font-weight:700">✓ PIN Set</span>' : '<span style="color:var(--red);font-size:11px;font-weight:700">⚠ No PIN</span>'}</td>
      <td class="r">
        <div style="display:flex;gap:4px;justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" onclick="openEditEmployeeModal(${e.id})" title="Edit">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="openSetPINModal(${e.id})" title="Set PIN" style="color:var(--accent-light)">🔑</button>
          <button class="btn btn-sm" onclick="confirmDeleteEmployee(${e.id})" title="Delete" style="background:rgba(239,68,68,0.08);color:var(--red);border:none">🗑</button>
        </div>
      </td>
    </tr>`;
  }).join('');

  return `
    <div class="page-hdr"><h3>👥 Staff & Allocation</h3><button class="btn btn-accent" onclick="openEmployeeModal()">+ Add Employee</button></div>

    <!-- Stats -->
    ${(() => {
      const totalPending = D.employees.reduce((a,e) => a + (e.pendingBalance||0), 0);
      const pendingCount = D.employees.filter(e => (e.pendingBalance||0) > 0).length;
      return `<div class="g g-auto-sm mb-24 gap-16">
        ${statCard('Total Staff', D.employees.length, 'across all shifts', '👤')}
        ${statCard('Monthly Payroll', cur(payroll), '', '💰')}
        ${statCard('Total Nozzles', totalNozzles, D.pumps.length + ' pumps', '⛽')}
        ${totalPending > 0
          ? `<div class="stat-card" style="border:1px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.04);cursor:pointer" onclick="document.getElementById('empDirectorySection')?.scrollIntoView({behavior:'smooth'})">
               <div style="font-size:22px;margin-bottom:4px">⚠️</div>
               <div class="stat-value" style="color:var(--red)">${cur(totalPending)}</div>
               <div class="stat-label">${pendingCount} employee${pendingCount>1?'s':''} with balance</div>
             </div>`
          : statCard('Assigned', assignedCount + '/' + totalNozzles, allocShift + ' shift', '✅')}
      </div>`;
    })()}

    <!-- ═══ PUMP & NOZZLE ALLOCATION BOARD ═══ -->
    <div class="card mb-24">
      <div class="card-head">
        <h4>⛽ Pump & Nozzle Allocation Board</h4>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="autoAssignAlloc()">⚡ Auto Assign</button>
          <button class="btn btn-ghost btn-sm" onclick="clearShiftAllocConfirm()">🗑 Clear All</button>
          <button class="btn btn-accent btn-sm" onclick="copyAllocModal()">📋 Copy to Shift</button>
        </div>
      </div>
      <div style="padding:16px 20px 4px">
        <div class="shift-tabs mb-12">${shiftTabs}</div>
        <div style="font-size:12px;color:var(--text-3);margin-bottom:14px">
          Assign employees to individual pump nozzles for <strong style="color:var(--accent-light)">${allocShift}</strong> shift
          · <span style="color:var(--text-2)">${shiftEmps.length} employees available</span>
          ${assignedCount >= totalNozzles ? ' · <span style="color:var(--green);font-weight:600">All nozzles covered ✓</span>' : ''}
        </div>
      </div>
      <div style="padding:0 20px 20px">
        <div class="alloc-board">${allocBoard}</div>
      </div>
    </div>

    <!-- Employee Assignment Summary -->
    <div class="card mb-24">
      <div class="card-head"><h4>👥 Employee Assignment Summary — ${allocShift} Shift</h4></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Employee</th><th>Assigned Nozzles</th><th class="r">Count</th></tr></thead><tbody>${empSummaryRows}</tbody></table></div></div>
    </div>

    <!-- Shift Schedule -->
    <div class="card mb-24">
      <div class="card-head"><h4>⏰ Shift Schedule</h4><button class="btn btn-accent btn-sm" onclick="openAddShiftModal()">+ Add Shift</button></div>
      <div class="card-body" style="padding:14px"><div class="g" style="grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px">${shiftCards}</div></div>
    </div>

    <!-- Employee Directory -->
    <div class="card" id="empDirectorySection">
      <div class="card-head"><h4>📋 Employee Directory</h4></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Shift</th><th class="r">Salary</th><th class="r">PIN</th><th class="r">Actions</th></tr></thead><tbody>${empRows}</tbody></table></div></div>
    </div>`;
}

// ── FINANCE ──────────────────────────────────────────────────
function renderFinance(D) {
  const totalRevenue = D.sales.reduce((a, s) => a + s.amount, 0);
  const gross = totalRevenue; // Revenue is gross before fuel purchase cost

  // ── Fuel Purchases — listed individually by transaction ──
  const fuelPurchases = (D.fuelPurchases || []).sort((a, b) => (b.id||0) - (a.id||0));
  const totalFuelCost = fuelPurchases.reduce((a, p) => a + (p.total || 0), 0);

  // Real non-fuel expenses from expense register
  const allExpenses = D.expenses || [];
  const opExpenses = allExpenses.filter(e => (e.source !== 'fuel_purchase') && !(e.category || '').includes('Fuel'));
  const opEx = opExpenses.reduce((a, e) => a + e.amount, 0);

  // Group opExpenses by category
  const expByCategory = {};
  opExpenses.forEach(e => {
    const cat = e.category || 'Misc';
    expByCategory[cat] = (expByCategory[cat] || 0) + e.amount;
  });

  const salary = D.employees.reduce((a, e) => a + (e.salary || 0), 0);
  const netProfit = totalRevenue - totalFuelCost - opEx - salary;

  // ── Build P&L rows ──
  // Section 1: Revenue
  const revenueRow = `<div class="flex-between" style="padding:9px 0;border-bottom:1px solid var(--border-light)">
    <span style="color:var(--text-2);font-size:13px">Revenue</span>
    <span style="color:var(--green)" class="mono fw-700">${cur(totalRevenue)}</span>
  </div>`;

  // Section 2: Fuel Purchases — each purchase as its own line
  let fuelPurchaseRows = '';
  if (fuelPurchases.length > 0) {
    fuelPurchaseRows = fuelPurchases.map(p => {
      const fi = getFuel(p.fuelType) || { short: p.fuelType, name: p.fuelType, color: '#f97316' };
      const inv = p.invoice ? `<span style="font-size:9px;color:var(--text-3);margin-left:6px;font-family:var(--mono)">${sanitize(p.invoice)}</span>` : '';
      const detail = `<span style="font-size:10px;color:var(--text-3);margin-left:6px">${fmt(p.liters)}L @ ₹${(p.rate||0).toFixed(2)}/L</span>`;
      return `<div class="flex-between" style="padding:7px 0 7px 14px;border-bottom:1px solid var(--border-light);background:rgba(249,115,22,0.03)">
        <div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px">
          <span style="font-size:10px;font-weight:800;color:${fi.color};background:${fi.color}18;padding:1px 7px;border-radius:3px">${fi.short}</span>
          ${detail}${inv}
          <span style="font-size:10px;color:var(--text-3);margin-left:4px">${p.date||''}</span>
        </div>
        <span style="color:var(--red)" class="mono fw-700">-${cur(p.total||0)}</span>
      </div>`;
    }).join('');
    fuelPurchaseRows = `
      <div style="padding:8px 0 4px;font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px">⛽ Fuel Purchases</div>
      ${fuelPurchaseRows}
      <div class="flex-between" style="padding:7px 0;border-bottom:2px solid var(--border)">
        <span style="color:var(--text-2);font-size:12px;font-weight:600">Total Fuel Cost</span>
        <span style="color:var(--red)" class="mono fw-700">-${cur(totalFuelCost)}</span>
      </div>`;
  } else {
    fuelPurchaseRows = `<div style="padding:8px 14px;font-size:11px;color:var(--text-3);border-bottom:1px solid var(--border-light)">No fuel purchases recorded</div>`;
  }

  // Gross Profit row (Revenue - Fuel Cost)
  const grossProfit = totalRevenue - totalFuelCost;
  const grossRow = `<div class="flex-between" style="padding:10px 0;border-bottom:2px solid var(--border)">
    <span style="color:var(--text-0);font-weight:800;font-size:13px">Gross Profit</span>
    <span style="color:${grossProfit >= 0 ? 'var(--accent-light)' : 'var(--red)'}" class="mono fw-800">${grossProfit < 0 ? '-' : ''}${cur(Math.abs(grossProfit))}</span>
  </div>`;

  // Section 3: Other operating expenses grouped by category
  const hasOpEx = salary > 0 || Object.keys(expByCategory).length > 0;
  let opExpRows = '';
  if (hasOpEx) {
    const opLines = [];
    if (salary > 0) opLines.push(`<div class="flex-between" style="padding:7px 0 7px 14px;border-bottom:1px solid var(--border-light)"><span style="color:var(--text-3);font-size:13px">Salaries</span><span style="color:var(--red)" class="mono fw-700">-${cur(salary)}</span></div>`);
    Object.entries(expByCategory).forEach(([cat, amt]) => {
      opLines.push(`<div class="flex-between" style="padding:7px 0 7px 14px;border-bottom:1px solid var(--border-light)"><span style="color:var(--text-3);font-size:13px">${cat}</span><span style="color:var(--red)" class="mono fw-700">-${cur(amt)}</span></div>`);
    });
    opExpRows = `<div style="padding:8px 0 4px;font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px">🧾 Operating Expenses</div>` + opLines.join('');
  }

  const pnlHtml = revenueRow + fuelPurchaseRows + grossRow + opExpRows;

  const marginCards = FUEL_TYPES.map(f => {
    const sell = D.prices[f.id] || 0, buy = D.purchasePrices[f.id] || 0, margin = sell - buy, pct = sell > 0 ? (margin / sell) * 100 : 0;
    const sold = D.sales.filter(s => s.fuelType === f.id).reduce((a, s) => a + s.liters, 0);
    return `<div class="dbox-lg mb-12" style="border:1px solid var(--border-light);border-radius:var(--radius)">
      <div class="flex-between mb-8"><span style="color:${f.color}" class="fw-700">${f.name}</span><span class="mono fw-800" style="color:var(--green)">₹${margin.toFixed(2)}/L</span></div>
      <div class="g" style="grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:11px">
        <div><div style="color:var(--text-3)">Purchase</div><div class="mono fw-600">${cur(buy)}</div></div>
        <div><div style="color:var(--text-3)">Selling</div><div class="mono fw-600">${cur(sell)}</div></div>
        <div><div style="color:var(--text-3)">Margin</div><div class="mono fw-600" style="color:var(--green)">${pct.toFixed(1)}%</div></div>
      </div>
      <div class="mt-8" style="font-size:12px;color:var(--text-3)">Today: ${fmt(sold)}L → <span class="mono fw-700" style="color:var(--green)">${cur(sold * margin)}</span></div>
    </div>`;
  }).join('');

  // Merge all expenses (incl. fuel purchases auto-entries) sorted by date desc
  const allExpRows = [...(D.expenses || [])].sort((a, b) => (b.id || 0) - (a.id || 0));
  const expRows = allExpRows.length > 0
    ? allExpRows.map(e => {
        const isFuel = (e.category || '') === 'Fuel Purchase';
        const catColor = catColors[e.category] || '#6b7080';
        return `<tr style="${isFuel ? 'background:rgba(249,115,22,0.04)' : ''}">
          <td style="font-size:12px">${e.date}</td>
          <td>${badgeColor(e.category || 'Misc', catColor)}${e.taxType === 'gst' ? ' <span style="font-size:9px;background:rgba(6,182,212,0.15);color:#06b6d4;padding:1px 5px;border-radius:3px;font-weight:700">GST</span>' : ''}${e.taxType === 'local_sales_tax' ? ' <span style="font-size:9px;background:rgba(212,148,15,0.15);color:var(--accent-light);padding:1px 5px;border-radius:3px;font-weight:700">SALES TAX</span>' : ''}</td>
          <td style="font-size:12px;color:var(--text-2)">${sanitize(e.desc || '')}${e.billFuels ? ' <span style="font-size:10px;color:var(--text-3)">[' + e.billFuels + ']</span>' : ''}${e.gstRate ? ' <span style="font-size:10px;color:var(--text-3)">GST ' + e.gstRate + '%</span>' : ''}</td>
          <td class="r mono fw-700" style="color:var(--red)">${cur(e.amount)}</td>
        </tr>`;
      }).join('')
    : `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-3)">No expenses recorded yet</td></tr>`;

  return `
    <div class="page-hdr"><h3>📈 Financial Management</h3>
      <div class="flex" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-accent" onclick="openExpenseModal()">+ Add Expense</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:6px 10px" onclick="openExpenseModal('Local Sales Tax (Bill)')" title="Record local sales tax on petrol">🏷 Tax</button>
        <button class="btn btn-ghost" style="font-size:11px;padding:6px 10px" onclick="openExpenseModal('GST — Lube / Lubricants')" title="Record GST on lube purchase">📦 Lube GST</button>
        <button class="btn btn-ghost" onclick="generatePLReport()">📄 P&L Report</button>
      </div>
    </div>
    <div class="g g-auto-sm mb-24 gap-16">
      ${statCard("Today's Revenue", cur(totalRevenue), 'all sales', '💰')}
      ${statCard('Fuel Purchased', cur(totalFuelCost), fuelPurchases.length + ' purchase(s)', '🛢️')}
      ${statCard('Gross Profit', cur(grossProfit), totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) + '% margin' : '—', '📊')}
      ${statCard('Operating Exp', cur(opEx), 'this month', '🧾')}
    </div>
    <div class="g g-2 gap-16 mb-24">
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📊 P&L — Monthly Estimate</h4>
        ${pnlHtml}
        <div class="flex-between" style="padding:14px 0 0;margin-top:10px;border-top:2px solid rgba(212,148,15,0.3)">
          <span class="fw-800" style="color:var(--accent-light);font-size:15px">Net Profit</span>
          <span class="mono fw-800" style="color:${netProfit >= 0 ? 'var(--green)' : 'var(--red)'};font-size:15px">${netProfit < 0 ? '-' : ''}${cur(Math.abs(netProfit))}</span>
        </div>
      </div>
      <div class="card card-pad"><h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">⛽ Fuel Margins</h4>${marginCards}</div>
    </div>
    <div class="card">
      <div class="card-head"><h4>🧾 Expense Register</h4><button class="btn btn-ghost btn-sm" onclick="exportExpenseCSV()">↓ Export</button></div>
      <div class="card-body"><div class="tbl-wrap"><table><thead><tr><th>Date</th><th>Category</th><th>Description</th><th class="r">Amount</th></tr></thead>
        <tbody>${expRows}</tbody>
        ${allExpRows.length > 0 ? `<tfoot><tr style="border-top:2px solid var(--border)"><td colspan="3" style="padding:8px;font-weight:700;color:var(--text-0)">Total</td><td class="r mono fw-800" style="color:var(--red);padding:8px">${cur(allExpRows.reduce((a,e)=>a+e.amount,0))}</td></tr></tfoot>` : ''}
      </table></div></div>
    </div>`;
}

// ── REPORTS ───────────────────────────────────────────────────
function renderReports(D) {
  if (!D) return '<div style="padding:40px;text-align:center;color:var(--text-3)">Loading...</div>';
  const totalRevenue = D.sales.reduce((a, s) => a + s.amount, 0);
  const cogs = D.sales.reduce((a, s) => a + s.liters * D.purchasePrices[s.fuelType], 0);
  const totalLiters = D.sales.reduce((a, s) => a + s.liters, 0);
  const totalStock = D.tanks.reduce((a, t) => a + (t.current || 0), 0);

  const todayIso2 = new Date().toISOString().slice(0,10);
  const todaySalesOnly = D.sales.filter(s => (s.date||'').slice(0,10) === todayIso2);
  const totalSoldToday = todaySalesOnly.reduce((a,s) => a + (s.liters||0), 0);
  const openingStock = totalStock + totalSoldToday; // closing stock + what was sold = opening stock
  const todayLiters = totalSoldToday;
  const todayRev = todaySalesOnly.reduce((a,s) => a + (s.amount||0), 0);
  const fuelReceived = D.fuelPurchases ? D.fuelPurchases.filter(f=>(f.date||'').slice(0,10)===todayIso2).reduce((a,f)=>a+(f.liters||0),0) : 0;
  const dsrItems = [
    { l: 'Closing Stock', v: fmt(totalStock) + ' L' },
    { l: 'Fuel Received', v: fmt(fuelReceived) + ' L' },
    { l: 'Total Sales', v: fmt(todayLiters) + ' L' },
    { l: 'Revenue', v: cur(todayRev), cls: 'color:var(--green)' },
    { l: 'Transactions', v: todaySalesOnly.length },
    { l: 'Cash Collected', v: cur(todaySalesOnly.filter(s=>s.mode==='cash').reduce((a,s)=>a+s.amount,0)) },
  ].map(i => `<div class="dbox"><div class="dbox-label">${i.l}</div><div class="dbox-value mono" style="font-size:14px;${i.cls || ''}">${i.v}</div></div>`).join('');

  const reports = [
    { n: 'Monthly P&L Statement', d: 'Revenue, COGS, expenses, net profit', fn: 'generatePLReport()' },
    { n: 'Daily Shift Report', d: 'Complete DSR with pump readings', fn: 'generateDSRReport()' },
    { n: 'Credit Outstanding', d: 'Customer-wise aging report', fn: 'generateCreditReport()' },
    { n: 'Tank Reconciliation', d: 'Dip vs book stock variance', fn: 'generateTankReport()' },
    { n: 'Pump Sales Report', d: 'Per-pump meter & sales data', fn: 'generatePumpReport()' },
    { n: 'GST Summary', d: 'Tax computation for filing', fn: 'generateGSTReport()' },
    { n: 'Employee Shift Report', d: 'Monthly attendance & shift history per employee', fn: 'generateShiftReport()' },
  ].map(r => `<div class="flex-between" style="padding:12px 0;border-bottom:1px solid var(--border-light)">
    <div><div class="fw-600" style="font-size:13px;color:var(--text-1)">${r.n}</div><div style="font-size:11px;color:var(--text-3)">${r.d}</div></div>
    <button class="btn btn-ghost btn-sm" onclick="${r.fn}">📄 Generate</button>
  </div>`).join('');

  const creditPct = totalRevenue ? ((D.sales.filter(s => s.mode === 'credit').reduce((a, s) => a + s.amount, 0) / totalRevenue) * 100).toFixed(1) : 0;
  const upiPct = totalRevenue ? ((D.sales.filter(s => s.mode === 'upi').reduce((a, s) => a + s.amount, 0) / totalRevenue) * 100).toFixed(1) : 0;
  const kpis = [
    { l: 'Avg Sale Value', v: cur(D.sales.length ? totalRevenue / D.sales.length : 0), c: '#22c55e' },
    { l: 'Avg Liters/Txn', v: (D.sales.length ? totalLiters / D.sales.length : 0).toFixed(1) + ' L', c: '#3b82f6' },
    { l: 'Gross Margin', v: (totalRevenue ? ((totalRevenue - cogs) / totalRevenue * 100) : 0).toFixed(1) + '%', c: '#d4940f' },
    { l: 'Credit Ratio', v: creditPct + '%', c: '#ef4444' },
    { l: 'UPI Adoption', v: upiPct + '%', c: '#a855f7' },
    { l: 'Total Transactions', v: D.sales.length, c: '#f97316' },
  ].map(k => `<div class="dbox text-center" style="padding:16px;border-radius:var(--radius)">
    <div class="mono fw-800" style="color:${k.c};font-size:22px">${k.v}</div>
    <div class="fw-600 mt-8" style="font-size:10px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px">${k.l}</div>
  </div>`).join('');

  return `
    <div class="page-hdr"><h3>📄 Reports & Analytics</h3></div>
    <div class="g g-2 gap-16 mb-24">
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📋 Daily Shift Report (DSR)</h4>
        <div class="g" style="grid-template-columns:1fr 1fr;gap:10px">${dsrItems}</div>
        <button class="btn btn-accent btn-block mt-16" onclick="generateDSRReport()">📄 Generate Full DSR</button>
      </div>
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">⚡ Quick Reports</h4>
        ${reports}
      </div>
    </div>
    <div class="card card-pad">
      <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📊 Key Performance Indicators</h4>
      <div class="g" style="grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px">${kpis}</div>
    </div>
    <div class="card card-pad mt-16">
      <div class="flex-between mb-16"><h4 class="fw-700" style="color:var(--text-0);font-size:13px">🔒 Audit Trail</h4><span class="badge badge-green">${(APP.auditLog||[]).length} entries</span></div>
      <div class="tbl-wrap"><table><thead><tr><th>Time</th><th>User</th><th>Action</th><th>Details</th></tr></thead><tbody>
      ${(APP.auditLog||[]).slice(0,50).map(l => `<tr>
        <td style="font-size:11px;white-space:nowrap;color:var(--text-3)">${sanitize((l.timestamp||'').substring(0,19).replace('T',' '))}</td>
        <td class="fw-600" style="font-size:12px">${sanitize(l.user||'')}</td>
        <td>${badge(sanitize(l.action||''), l.action==='login'||l.action==='logout'?'badge-blue':l.action==='price_change'||l.action==='data_clear'?'badge-red':'badge-accent')}</td>
        <td style="font-size:10px;color:var(--text-3);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sanitize(JSON.stringify(l.details||{})).substring(0,80)}</td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:20px">No audit entries yet</td></tr>'}
      </tbody></table></div>
    </div>`;
}

// ── SETTINGS ─────────────────────────────────────────────────
function renderSettings(D) {
  const priceCards = FUEL_TYPES.map(f => {
    const margin = D.prices[f.id] - D.purchasePrices[f.id];
    return `<div class="flex-between" style="padding:14px;background:var(--bg-0);border-radius:var(--radius);margin-bottom:10px;border:1px solid var(--border-light)">
      <div><div style="color:${f.color}" class="fw-700">${f.name}</div><div style="font-size:11px;color:var(--text-3)">Purchase: ${cur(D.purchasePrices[f.id])}/L</div></div>
      <div class="text-right"><div class="mono fw-800" style="color:var(--text-0);font-size:22px">₹${D.prices[f.id].toFixed(2)}</div>
        <div class="mono fw-600" style="font-size:11px;color:var(--green)">Margin: ₹${margin.toFixed(2)}/L</div></div>
    </div>`;
  }).join('');

  const _t = APP.tenant || {};
  const info = [
    ['Station Name', _t.name || 'FuelBunk Station'],
    ['Owner', _t.ownerName || '—'],
    ['Location', _t.location || '—'],
    ['Contact', _t.phone || '—'],
    ['Tanks', D.tanks.length + ' Underground Tanks'],
    ['Pumps', D.pumps.length + ' Dispensing Units'],
    ['Station ID', _t.id || 'demo'],
  ].map(([l, v]) => `<div class="flex-between" style="padding:10px 0;border-bottom:1px solid var(--border-light);font-size:13px">
    <span style="color:var(--text-3)">${l}</span><span class="fw-600" style="color:var(--text-1)">${v}</span>
  </div>`).join('');

  return `
    <div class="page-hdr"><h3>⚙️ Settings</h3></div>
    <div class="g g-auto gap-16 mb-24">
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">⛽ Fuel Prices</h4>
        ${priceCards}
        <button class="btn btn-accent btn-block mt-12" onclick="openPriceModal()">&#9881;&#65039; Update Selling Prices</button>
        <button class="btn btn-ghost btn-block mt-8" onclick="openPurchasePriceModal()" style="font-size:12px">Update Purchase Prices (COGS)</button>
      </div>
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">🏢 Station Information</h4>
        ${info}
      </div>
    </div>
    <div class="g g-2 gap-16">
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">📱 UPI Payment Settings</h4>
        <div class="form-group">
          <label class="form-label">UPI VPA (Your payment address)</label>
          <input class="form-input" id="upiVPA" value="${D.upiVPA || ''}" placeholder="e.g. station@okaxis" />
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">Your UPI ID — customers pay to this</div>
        </div>
        <div class="form-group">
          <label class="form-label">Station / Merchant Name</label>
          <input class="form-input" id="upiName" value="${D.upiName || APP.tenant?.name || ''}" placeholder="e.g. Sri Lakshmi Fuel Station" />
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">This name appears on all reports and receipts</div>
        </div>
        <div class="form-group">
          <label class="form-label">Station Code (for reports)</label>
          <input class="form-input" id="stationCode" value="${D.stationCode || ''}" placeholder="e.g. KA/TUM/FSL/2024/0142" />
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">OMC assigned station code — printed on DSR</div>
        </div>
        <div class="form-group">
          <label class="form-label">Oil Company (OMC) Name</label>
          <input class="form-input" id="omcName" value="${D.omcName || ''}" placeholder="e.g. Bharat Petroleum Corporation Ltd." />
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">Printed on report footer</div>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:6px">
            Razorpay Key ID <span style="font-size:10px;background:rgba(59,130,246,0.12);color:var(--blue);padding:1px 6px;border-radius:4px;font-weight:700">AUTO-CONFIRM</span>
          </label>
          <input class="form-input" id="rzpKey" value="${D.razorpayKey || ''}" placeholder="rzp_live_XXXXXXXXXX" autocomplete="off" />
          <div style="font-size:11px;color:var(--text-3);margin-top:3px">
            Get from <a href="https://dashboard.razorpay.com/app/keys" target="_blank" style="color:var(--accent-light)">dashboard.razorpay.com → Settings → API Keys</a>. 
            Enables auto-confirmation of payments (2% fee per txn).
          </div>
        </div>
        <button class="btn btn-accent btn-block" onclick="saveUPISettings()">💾 Save UPI Settings</button>
        <div id="upiQRPreview" class="text-center mt-16"></div>
      </div>
      <div class="card card-pad">
        <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">🔔 Notifications</h4>
        <div class="flex-between mb-14" style="padding:12px;background:var(--bg-0);border-radius:var(--radius-sm)">
          <div><div class="fw-600" style="font-size:13px;color:var(--text-0)">Push Notifications</div><div style="font-size:11px;color:var(--text-3)">Get alerts for low tanks & credit</div></div>
          <button class="btn btn-ghost btn-sm" onclick="enableNotifications()">Enable</button>
        </div>
        <div class="flex-between mb-14" style="padding:12px;background:var(--bg-0);border-radius:var(--radius-sm)">
          <div><div class="fw-600" style="font-size:13px;color:var(--text-0)">Low Tank Alert</div><div style="font-size:11px;color:var(--text-3)">Alert when tank below 20%</div></div>
          ${badge('ACTIVE', 'badge-green')}
        </div>
        <div class="flex-between" style="padding:12px;background:var(--bg-0);border-radius:var(--radius-sm)">
          <div><div class="fw-600" style="font-size:13px;color:var(--text-0)">Credit Limit Alert</div><div style="font-size:11px;color:var(--text-3)">Alert when usage above 85%</div></div>
          ${badge('ACTIVE', 'badge-green')}
        </div>
        <h4 class="mt-16 mb-14 fw-700" style="color:var(--text-0);font-size:13px">💾 Data Management</h4>
        <div class="flex" style="gap:8px">
          <button class="btn btn-ghost" style="flex:1" onclick="exportAllData()">↓ Export All Data</button>
          <button class="btn btn-ghost" style="flex:1;border-color:rgba(239,68,68,0.25);color:var(--red)" onclick="confirmResetData()">⚠ Reset Data</button>
        </div>
      </div>
    </div>

    <!-- Tenant Admin Users Management -->
    <div class="card card-pad mt-16">
      <h4 class="mb-16 fw-700" style="color:var(--text-0);font-size:13px">👤 Admin Users — ${sanitize((_t.name||'Station'))}</h4>
      <div style="margin-bottom:12px">
        ${((_t.adminUsers||[]).map((u,i) => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)">
            <div>
              <div class="fw-700" style="color:var(--text-0);font-size:13px">${sanitize(u.name)}</div>
              <div style="font-size:11px;color:var(--text-3)">${sanitize(u.username)} · ${badge(u.role,'badge-accent')}</div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="openChangeAdminPassModal(${i})">🔑 Change Password</button>
          </div>`).join('')) || '<div style="color:var(--text-3);font-size:13px">No admin users found</div>'}
      </div>
      <button class="btn btn-ghost btn-sm btn-block" onclick="openAddAdminUserModal()">+ Add Admin User</button>
    </div>

    <!-- Switch Station -->
    <div class="card card-pad mt-16" style="text-align:center">
      <div style="font-size:11px;color:var(--text-3);margin-bottom:12px">You are managing: <strong style="color:var(--accent-light)">${sanitize(_t.name||'Demo')}</strong></div>
      <button class="btn btn-ghost btn-block" onclick="mt_switchStation()">🏪 Switch to a Different Station</button>
    </div>`;
}

// Expose to global
window.renderDashboard = renderDashboard;
window.renderTanks = renderTanks;
window.openAddTankModal = openAddTankModal;
window.updateTankFuelPreview = updateTankFuelPreview;
window.selectTankCap = selectTankCap;
window.selectEditTankCap = selectEditTankCap;
window.updateEditTankFuelOpts = updateEditTankFuelOpts;
window.saveNewTank = saveNewTank;
window.openEditTankModal = openEditTankModal;
window.saveEditTank = saveEditTank;
window.confirmDeleteTank = confirmDeleteTank;
window.deleteTank = deleteTank;
window.openDipModal = openDipModal;
window.onDipTankChange = onDipTankChange;
window.updateDipPreview = updateDipPreview;
window.saveDip = saveDip;
window.ioclDipToLiters = ioclDipToLiters;
window.ioclDipToLiters20K = ioclDipToLiters20K;
window.tankUsesIoclChart = tankUsesIoclChart;
window.getDipChart = getDipChart;
window._tankChartType = _tankChartType;
window.renderPumps = renderPumps;
window.openReadingModal = openReadingModal;
window.updateNozzlePreview = updateNozzlePreview;
window.saveReading = saveReading;
window.openEditPumpModal = openEditPumpModal;
window.saveEditPump = saveEditPump;
window.openAddPumpModal = openAddPumpModal;
window.renderAddPumpNozzleRows = renderAddPumpNozzleRows;
window.saveAddPump = saveAddPump;
window.confirmDeletePump = confirmDeletePump;
window.deletePump = deletePump;
window.renderSales = renderSales;
window.renderCredit = renderCredit;
// ── Employee Balance Modal — admin review & settle ────────────
function openEmpBalanceModal(empId) {
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp) return;

  const pending = (emp.balanceEntries || []).filter(b => b.status === 'pending');
  if (!pending.length) { toast('No pending balances', 'info'); return; }

  const totalLiters = pending.reduce((a, b) => a + b.totalDiffLiters, 0);
  const totalAmount = pending.reduce((a, b) => a + b.totalDiffAmount, 0);

  const entryRows = pending.map((b, idx) => {
    const rows = b.entries.map(e =>
      `<tr style="font-size:11px">
        <td style="padding:5px 8px;color:var(--text-3)">${e.pump} · N${e.nozzle}</td>
        <td style="padding:5px 8px"><span style="font-size:10px;font-weight:700;color:var(--accent-light)">${e.fuelName}</span></td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--mono)">${fmt(e.meterSold)} L</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--mono)">${fmt(e.salesSold)} L</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--mono);color:var(--red);font-weight:700">${fmt(Math.abs(e.diffLiters))} L</td>
        <td style="padding:5px 8px;text-align:right;font-family:var(--mono);color:var(--red);font-weight:700">${cur(e.diffAmount)}</td>
      </tr>`
    ).join('');
    return `<div style="background:var(--bg-0);border:1px solid var(--border);border-radius:8px;margin-bottom:10px;overflow:hidden">
      <div style="padding:10px 14px;background:rgba(239,68,68,0.05);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <span style="font-size:12px;font-weight:700;color:var(--text-0)">📅 ${b.date}</span>
          ${b.shift ? `<span style="font-size:11px;color:var(--text-3);margin-left:8px">${b.shift} Shift</span>` : ''}
        </div>
        <div style="text-align:right">
          <div style="font-size:13px;font-weight:800;color:var(--red)">${cur(b.totalDiffAmount)}</div>
          <div style="font-size:10px;color:var(--text-3)">${fmt(b.totalDiffLiters)} L unaccounted</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="background:var(--bg-2)">
          <th style="padding:5px 8px;text-align:left;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Nozzle</th>
          <th style="padding:5px 8px;text-align:left;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Fuel</th>
          <th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Meter</th>
          <th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Sales</th>
          <th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Diff (L)</th>
          <th style="padding:5px 8px;text-align:right;font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase">Amount</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="padding:8px 14px;display:flex;gap:8px;justify-content:flex-end;border-top:1px solid var(--border)">
        <button class="btn btn-sm" style="background:rgba(34,197,94,0.1);color:var(--green);border:1px solid rgba(34,197,94,0.25);font-size:11px"
          onclick="settleEmpBalance(${empId}, ${b.id}, 'cash', 'Settled in cash')">💵 Settled (Cash)</button>
        <button class="btn btn-sm" style="background:rgba(239,68,68,0.08);color:var(--red);border:1px solid rgba(239,68,68,0.2);font-size:11px"
          onclick="settleEmpBalance(${empId}, ${b.id}, 'deduct', 'Deducted from salary')">✂️ Deduct Salary</button>
        <button class="btn btn-sm" style="background:rgba(100,100,100,0.08);color:var(--text-2);border:1px solid var(--border);font-size:11px"
          onclick="settleEmpBalance(${empId}, ${b.id}, 'waived', 'Waived by manager')">🙏 Waive</button>
      </div>
    </div>`;
  }).join('');

  openModal(`⚠️ Pending Balance — ${sanitize(emp.name)}`,
    `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
       <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px;text-align:center">
         <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Total Balance</div>
         <div style="font-size:26px;font-weight:900;color:var(--red);font-family:var(--mono)">${cur(totalAmount)}</div>
       </div>
       <div style="background:rgba(239,68,68,0.07);border:1px solid rgba(239,68,68,0.2);border-radius:10px;padding:14px;text-align:center">
         <div style="font-size:10px;font-weight:700;color:var(--red);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Unaccounted</div>
         <div style="font-size:26px;font-weight:900;color:var(--text-0);font-family:var(--mono)">${fmt(totalLiters)} L</div>
       </div>
     </div>
     <div style="font-size:12px;color:var(--text-3);margin-bottom:14px">
       These differences were accepted during shift submission. Choose how to settle each entry.
     </div>
     ${entryRows}`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>
     <button class="btn btn-accent" onclick="settleAllEmpBalance(${empId})">✅ Settle All (Cash)</button>`
  );
}

async function settleEmpBalance(empId, balanceId, method, note) {
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp || !emp.balanceEntries) return;

  const entry = emp.balanceEntries.find(b => b.id === balanceId);
  if (!entry || entry.status !== 'pending') return;

  entry.status    = 'settled';
  entry.settledAt = today() + ' ' + now();
  entry.settledBy = APP.data?.adminUser?.name || 'Admin';
  entry.method    = method;
  entry.note      = note;

  emp.pendingBalance = Math.max(0, (emp.pendingBalance || 0) - entry.totalDiffAmount);
  await db.put('employees', emp);
  APP.data.employees = APP.data.employees.map(e => e.id === empId ? emp : e);
  auditLog('emp_balance_settle', { empId, empName: emp.name, balanceId, method, amount: entry.totalDiffAmount });
  closeModal();
  toast(`✅ Balance of ${cur(entry.totalDiffAmount)} settled (${note})`, 'success');
  renderPage();
}

async function settleAllEmpBalance(empId) {
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp || !emp.balanceEntries) return;

  const pending = emp.balanceEntries.filter(b => b.status === 'pending');
  const totalAmt = pending.reduce((a, b) => a + b.totalDiffAmount, 0);
  pending.forEach(b => {
    b.status    = 'settled';
    b.settledAt = today() + ' ' + now();
    b.settledBy = APP.data?.adminUser?.name || 'Admin';
    b.method    = 'cash';
    b.note      = 'Settled all in cash';
  });
  emp.pendingBalance = 0;
  await db.put('employees', emp);
  APP.data.employees = APP.data.employees.map(e => e.id === empId ? emp : e);
  auditLog('emp_balance_settle_all', { empId, empName: emp.name, totalAmt });
  closeModal();
  toast(`✅ All balances cleared for ${sanitize(emp.name)} — ${cur(totalAmt)} settled`, 'success');
  renderPage();
}

window.openEmpBalanceModal  = openEmpBalanceModal;
window.settleEmpBalance     = settleEmpBalance;
window.settleAllEmpBalance  = settleAllEmpBalance;

window.renderStaff = renderStaff;
window.mt_showSelector = mt_showSelector;
window.mt_toggleStation = mt_toggleStation;
window.mt_viewStationData = mt_viewStationData;
window.mt_manageStationAdmins = mt_manageStationAdmins;
window.mt_addStationAdmin = mt_addStationAdmin;
window.mt_resetStationAdminPass = mt_resetStationAdminPass;
window.mt_deleteStationAdmin = mt_deleteStationAdmin;
window.mt_changeSupercreds = mt_changeSupercreds;
window.mt_saveSupercreds = mt_saveSupercreds;
window.mt_switchStation = mt_switchStation;
window.mt_doSuperLogin = mt_doSuperLogin;
window.mt_superLogout = mt_superLogout;
window.mt_openAddTenant = mt_openAddTenant;
window.mt_openEditTenant = mt_openEditTenant;
window.mt_saveTenant = mt_saveTenant;
window.mt_confirmDeleteTenant = mt_confirmDeleteTenant;
window.mt_deleteTenant = mt_deleteTenant;
window.mt_selectTenant = mt_selectTenant;
window.openEditEmployeeModal = openEditEmployeeModal;
window.saveEditEmployee = saveEditEmployee;
window.openSetPINModal = openSetPINModal;
window.saveEmployeePIN = saveEmployeePIN;
window.confirmDeleteEmployee = confirmDeleteEmployee;
window.deleteEmployee = deleteEmployee;
window.openAddShiftModal = openAddShiftModal;
window.saveNewShift = saveNewShift;
window.openEditShiftModal = openEditShiftModal;
window.saveEditShift = saveEditShift;
window.confirmDeleteShift = confirmDeleteShift;
window.deleteShift = deleteShift;
window.renderFinance = renderFinance;
window.renderReports = renderReports;
window.renderSettings = renderSettings;
window.openChangeAdminPassModal = openChangeAdminPassModal;
window.saveAdminPassword = saveAdminPassword;
window.openAddAdminUserModal = openAddAdminUserModal;
window.saveNewAdminUser = saveNewAdminUser;
window.mt_doSwitchStation = mt_doSwitchStation;
window.emp_nozzleRecon = emp_nozzleRecon;
window.emp_nozzleSalesLiters = emp_nozzleSalesLiters;
window.emp_refreshNozzles = emp_refreshNozzles;

// ═══════════════════════════════════════════════════════════
// FUELBUNK PRO — Main Application
// ═══════════════════════════════════════════════════════════

const APP = {
  page: 'dashboard',
  salesFilter: 'all',
  sidebarOpen: true,
  data: null,
  deferredPrompt: null,
  loggedIn: false,
  role: null, // 'admin' or 'employee'
  adminUser: null,
  auditLog: [],
  salesAllTime: false,
};

// ── SEED DATA ────────────────────────────────────────────────
const SEED = {
  tanks: [],
  pumps: [],
  shifts: [],
  employees: [],
  sales: [],
  creditCustomers: [],
  expenses: [],
  fuelPurchases: [],
  dipReadings: [],
  prices: { petrol: 102.86, diesel: 88.62, premium_petrol: 112.50 },
  purchasePrices: { petrol: 96.50, diesel: 82.30, premium_petrol: 105.80 },
  weekly: [
    { day: 'Mon', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Tue', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Wed', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Thu', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Fri', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Sat', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
    { day: 'Sun', petrol: 0, diesel: 0, premium: 0, revenue: 0 },
  ],
  upiVPA: '',
  upiName: '',
};

// ── ALLOCATION SYSTEM ────────────────────────────────────────
const EMP_COLORS = ['#22c55e','#3b82f6','#a855f7','#f97316','#06b6d4','#eab308','#ec4899','#14b8a6','#f43f5e','#8b5cf6'];
function empInitials(name) { return (name||'').split(' ').map(w=>w[0]).join('').toUpperCase(); }
function empColor(emp) { return emp.color || EMP_COLORS[(emp.id || 0) % EMP_COLORS.length]; }

let allocShift = 'Morning'; // current shift tab on allocation board

function loadAllocations() {
  try { return JSON.parse(localStorage.getItem('fb_allocations')) || null; } catch { return null; }
}
function getDefaultAllocations() {
  return {
    Morning: { '1_A':4,'1_B':5,'2_A':4,'2_B':5,'3_A':4,'3_B':5,'4_A':4,'4_B':5,'5_A':5 },
    Afternoon: { '1_A':6,'1_B':6,'2_A':6,'2_B':6,'3_A':6,'3_B':6,'4_A':6,'4_B':6,'5_A':6 },
    Night: { '1_A':7,'1_B':7,'2_A':7,'2_B':7,'3_A':7,'3_B':7,'4_A':7,'4_B':7,'5_A':7 },
  };
}
let allocations = loadAllocations() || getDefaultAllocations();
function saveAllocations() { try { localStorage.setItem('fb_allocations', JSON.stringify(allocations)); } catch {} }

// ── NAVIGATION ───────────────────────────────────────────────
const PAGES = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊', group: 'main' },
  { id: 'tanks', label: 'Tanks & Inventory', icon: '🛢️', group: 'main' },
  { id: 'pumps', label: 'Pumps & Meters', icon: '⛽', group: 'main' },
  { id: 'sales', label: 'Sales', icon: '💰', group: 'main' },
  { id: 'credit', label: 'Credit Mgmt', icon: '💳', group: 'finance' },
  { id: 'staff', label: 'Staff & Allocation', icon: '👥', group: 'finance' },
  { id: 'finance', label: 'Finance', icon: '📈', group: 'finance' },
  { id: 'reports', label: 'Reports', icon: '📄', group: 'reports' },
  { id: 'settings', label: 'Settings', icon: '⚙️', group: 'reports' },
];

function navigate(pageId) {
  APP.page = pageId;
  APP.salesFilter = 'all';
  APP.salesAllTime = false;
  window.location.hash = pageId;
  document.getElementById('pageTitle').textContent = PAGES.find(p => p.id === pageId)?.label || 'Dashboard';
  const _tb = APP.tenant;
  document.getElementById('breadcrumb').textContent = (_tb ? (_tb.name + (_tb.location ? ' • ' + _tb.location : '')) : 'FuelBunk Pro');
  buildNav();
  renderPage();
  // Close mobile sidebar
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  sidebar.classList.remove('mobile-open');
  if (overlay) overlay.style.display = 'none';
}

function buildNav() {
  const groups = { main: 'Operations', finance: 'Finance', employee: 'Employee', reports: 'Reports' };
  let html = '';
  let lastGroup = '';
  PAGES.forEach(p => {
    if (p.group !== lastGroup) {
      html += `<div class="nav-group-label">${groups[p.group]}</div>`;
      lastGroup = p.group;
    }
    html += `<button class="nav-btn ${p.id === APP.page ? 'active' : ''}" onclick="navigate('${p.id}')">
      <span class="nav-icon">${p.icon}</span><span class="nav-label">${p.label}</span>
    </button>`;
  });
  document.getElementById('nav').innerHTML = html;
}

function toggleSidebar() {
  const el = document.getElementById('sidebar');
  const overlay = document.getElementById('mobileOverlay');
  if (window.innerWidth < 769) {
    const isOpen = el.classList.toggle('mobile-open');
    if (overlay) overlay.style.display = isOpen ? 'block' : 'none';
  } else {
    APP.sidebarOpen = !APP.sidebarOpen;
    el.classList.toggle('collapsed', !APP.sidebarOpen);
  }
}

// ── CLOCK ────────────────────────────────────────────────────
function updateClock() {
  const n = new Date();
  document.getElementById('clock').textContent = n.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  document.getElementById('dateEl').textContent = n.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── RENDER ───────────────────────────────────────────────────
function renderPage() {
  const D = APP.data;
  const el = document.getElementById('content');
  if (!el) { console.error('No #content element'); return; }
  el.className = 'content';

  // Guard: if data not loaded yet, show loading state
  if (!D && APP.page !== 'employee') {
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-3)"><div style="font-size:40px;margin-bottom:16px">⏳</div><div class="fw-700">Loading data...</div><div style="font-size:12px;margin-top:8px">If this persists, try refreshing the page.</div></div>';
    return;
  }

  // Tanks page: do a quick async refresh to pick up any external changes
  // but only AFTER initial render to avoid layout flash
  if (APP.page === 'tanks' && APP.role === 'admin') {
    setTimeout(function() {
      db.getAll('tanks').then(function(freshTanks) {
        if (freshTanks.length) {
          var changed = freshTanks.some(function(ft) {
            var existing = APP.data.tanks.find(function(t) { return t.id === ft.id; });
            return !existing || existing.current !== ft.current;
          });
          if (changed) {
            APP.data.tanks = freshTanks;
            var el2 = document.getElementById('content');
            if (el2 && APP.page === 'tanks') try { el2.innerHTML = renderTanks(APP.data); } catch(e) {}
          }
        }
      }).catch(function() {});
    }, 500);
  }

  try {
    let html = '';
    switch (APP.page) {
      case 'dashboard': html = renderDashboard(D); break;
      case 'tanks': html = renderTanks(D); break;
      case 'pumps': html = renderPumps(D); break;
      case 'sales': html = renderSales(D, APP.salesFilter); break;
      case 'credit': html = renderCredit(D); break;
      case 'staff': html = renderStaff(D); break;
      case 'finance': html = renderFinance(D); break;
      case 'reports': html = renderReports(D); break;
      case 'employee': html = renderEmployeePortal(); break;
      case 'settings': html = renderSettings(D); break;
      default: html = renderDashboard(D);
    }
    if (!html || html.trim().length === 0) {
      el.innerHTML = '<div style="padding:40px;color:var(--text-2);text-align:center"><p>⚠️ Page "' + APP.page + '" returned empty content.</p><p style="font-size:11px;margin-top:8px">Data keys: ' + (D ? Object.keys(D).join(', ') : 'null') + '</p><p style="font-size:11px">Tanks: ' + (D?.tanks?.length || 0) + ', Sales: ' + (D?.sales?.length || 0) + '</p></div>';
    } else {
      el.innerHTML = html;
    }
  } catch (err) {
    console.error('Render error on page "' + APP.page + '":', err);
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--text-3)"><div style="font-size:40px;margin-bottom:16px">⚠️</div><div class="fw-700" style="color:var(--red)">Render Error</div><div style="font-size:12px;margin-top:8px;color:var(--text-2)">' + sanitize(String(err.message || err)) + '</div><button class="btn btn-accent mt-16" onclick="location.reload()">🔄 Reload App</button></div>';
  }
}

// ── MODAL FORMS ──────────────────────────────────────────────

function openSaleModal() {
  const fuelOpts = FUEL_TYPES.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  const pumpOpts = APP.data.pumps.map(p => `<option value="${p.id}">${p.name} (${getFuel(p.fuelType).short})</option>`).join('');
  openModal('Record New Sale', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fuel Type</label><select class="form-input" id="saleFuel">${fuelOpts}</select></div>
      <div class="form-group"><label class="form-label">Pump</label><select class="form-input" id="salePump">${pumpOpts}</select></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Liters</label><input class="form-input" id="saleLiters" type="number" step="0.1" placeholder="Enter liters" oninput="calcSaleAmount()"/></div>
      <div class="form-group"><label class="form-label">Amount (₹)</label><input class="form-input" id="saleAmount" type="number" step="0.01" placeholder="Auto-calculated" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Vehicle No.</label><input class="form-input" id="saleVehicle" placeholder="KA00XX0000" style="text-transform:uppercase" oninput="this.value=this.value.toUpperCase()" onpaste="setTimeout(()=>this.value=this.value.toUpperCase(),0)" /></div>
      <div class="form-group"><label class="form-label">Payment Mode</label><select class="form-input" id="saleMode">
        <option value="cash">Cash</option><option value="upi">UPI</option><option value="card">Card</option><option value="credit">Credit</option>
      </select></div>
    </div>
    <div class="form-group"><label class="form-label">Customer (for credit)</label><input class="form-input" id="saleCustomer" placeholder="Optional" /></div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="saveSale()">💾 Save Sale</button>`);
}

function calcSaleAmount() {
  const fuelId = document.getElementById('saleFuel').value;
  const liters = parseFloat(document.getElementById('saleLiters').value) || 0;
  document.getElementById('saleAmount').value = (liters * (APP.data.prices[fuelId] || 0)).toFixed(2);
}

function saveSale() {
  const fuelType = document.getElementById('saleFuel').value;
  const liters = parseFloat(document.getElementById('saleLiters').value);
  const amount = parseFloat(document.getElementById('saleAmount').value);
  const vehicle = (document.getElementById('saleVehicle').value || '').toUpperCase().trim();
  const mode = document.getElementById('saleMode').value;
  const pump = parseInt(document.getElementById('salePump').value);
  const customer = (document.getElementById('saleCustomer')?.value || '').trim();

  // Input validation
  const errors = validateSaleInput(fuelType, liters, amount, vehicle, APP.data.prices);
  if (errors.length > 0) { toast(errors[0], 'error'); return; }

  const sale = {
    id: Date.now(), date: today(), time: now(), fuelType, liters, amount,
    mode, pump, vehicle: sanitize(vehicle), customer: customer ? sanitize(customer) : undefined, shift: 'Current'
  };
  // If UPI — launch UPI payment modal, record after confirmation
  if (mode === 'upi') {
    closeModal();
    openUPIPaymentModal(amount, fuelType, liters, (txnId) => {
      sale.upiTxnId = txnId || null;
      APP.data.sales.unshift(sale);
      db.add('sales', sale).catch(() => {});
      db.add('pendingSync', { ...sale, type: 'sale' }).catch(() => {});
      const tank = APP.data.tanks.find(t => t.fuelType === fuelType);
      if (tank) { tank.current = Math.max(0, tank.current - liters); db.put('tanks', tank).catch(() => {}); }
      const pumpData = APP.data.pumps.find(p => p.id === pump);
      if (pumpData) { pumpData.currentReading += liters; db.put('pumps', pumpData).catch(() => {}); }
      auditLog('sale_add', { fuelType, liters, amount, vehicle, mode: 'upi', pump, upiTxnId: txnId });
      toast(`✅ Sale + UPI recorded: ${fmt(liters)}L — ${cur(amount)}`, 'success');
      renderPage();
    });
    return;
  }

  APP.data.sales.unshift(sale);
  db.add('sales', sale).catch(() => {});
  db.add('pendingSync', { ...sale, type: 'sale' }).catch(() => {});

  // Update tank level
  const tank = APP.data.tanks.find(t => t.fuelType === fuelType);
  if (tank) { tank.current = Math.max(0, tank.current - liters); db.put('tanks', tank).catch(() => {}); }

  // Update pump reading
  const pumpData = APP.data.pumps.find(p => p.id === pump);
  if (pumpData) { pumpData.currentReading += liters; db.put('pumps', pumpData).catch(() => {}); }

  // Deduct from tank inventory (admin manual sale → tank must reflect it)
  const saleActualFuel = fuelType;
  const saleTank = APP.data.tanks.find(t => t.fuelType === saleActualFuel);
  if (saleTank && liters > 0) {
    saleTank.current = Math.max(0, saleTank.current - liters);
    db.put('tanks', saleTank).catch(() => {});
  }

  // If credit sale, update customer outstanding
  if (mode === 'credit' && customer) {
    const cust = APP.data.creditCustomers.find(c => c.name === customer);
    if (cust) { cust.outstanding = (cust.outstanding || 0) + amount; db.put('creditCustomers', cust).catch(() => {}); }
  }

  auditLog('sale_add', { fuelType, liters, amount, vehicle, mode, pump, customer: customer || undefined });
  closeModal();
  toast(`Sale recorded: ${fmt(liters)}L ${getFuel(fuelType).short} — ${cur(amount)}`, 'success');
  renderPage();
}

// ── TANK MANAGEMENT ──────────────────────────────────────────

const TANK_CAPACITIES = [10000, 16000, 20000];

function openAddTankModal() {
  const fuelOpts = FUEL_TYPES.map((f, i) =>
    `<label style="flex:1;cursor:pointer">
      <input type="radio" name="newTankFuelR" value="${f.id}" ${i===0?'checked':''} style="display:none" onchange="updateTankFuelPreview()">
      <div class="tank-fuel-opt" id="fuelOpt_${f.id}" style="border:2px solid ${i===0?f.color:'var(--border)'};background:${i===0?f.color+'18':'var(--bg-0)'};border-radius:10px;padding:12px 8px;text-align:center;transition:all 0.15s">
        <div style="font-size:18px;margin-bottom:4px">${f.icon||'⛽'}</div>
        <div style="font-size:11px;font-weight:800;color:${i===0?f.color:'var(--text-2)'}" id="fuelOptLabel_${f.id}">${f.short}</div>
        <div style="font-size:9px;color:var(--text-3);margin-top:2px">${f.name}</div>
      </div>
    </label>`
  ).join('');

  const capOpts = TANK_CAPACITIES.map((c, i) => {
    const labels = {10000:'Standard',16000:'Medium',20000:'Large'};
    return `<label style="flex:1;cursor:pointer">
      <input type="radio" name="newTankCapR" value="${c}" ${i===0?'checked':''} style="display:none">
      <div class="tank-cap-opt" id="capOpt_${c}" style="border:2px solid ${i===0?'var(--accent)':'var(--border)'};background:${i===0?'rgba(212,148,15,0.1)':'var(--bg-0)'};border-radius:10px;padding:14px 8px;text-align:center;transition:all 0.15s" onclick="selectTankCap(${c})">
        <div style="font-size:18px;font-weight:900;color:${i===0?'var(--accent-light)':'var(--text-1)'};" id="capOptVal_${c}">${(c/1000).toFixed(0)}K</div>
        <div style="font-size:10px;font-weight:700;color:var(--text-2);margin-top:2px">${c.toLocaleString('en-IN')} L</div>
        <div style="font-size:9px;color:var(--text-3);margin-top:1px">${labels[c]||''}</div>
      </div>
    </label>`;
  }).join('');

  openModal('🛢️ Add New Tank',
    `<div class="form-group">
       <label class="form-label">Fuel Type *</label>
       <div style="display:flex;gap:8px;margin-top:4px">${fuelOpts}</div>
     </div>
     <div class="form-group" style="margin-top:16px">
       <label class="form-label">Tank Capacity *</label>
       <div style="display:flex;gap:8px;margin-top:4px" id="capOptRow">${capOpts}</div>
     </div>
     <div class="form-group" style="margin-top:16px">
       <label class="form-label">Current Level (L) <span style="color:var(--text-3);font-weight:400">— Starting stock</span></label>
       <input class="form-input" id="newTankCurrent" type="number" min="0" placeholder="0" value="0" style="font-size:16px;font-weight:700" />
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveNewTank()">🛢️ Add Tank</button>`
  );
  // Init first fuel option highlight
  updateTankFuelPreview();
}

function selectTankCap(selected) {
  TANK_CAPACITIES.forEach(c => {
    const el = document.getElementById('capOpt_' + c);
    const val = document.getElementById('capOptVal_' + c);
    if (!el) return;
    const isSelected = c === selected;
    el.style.borderColor = isSelected ? 'var(--accent)' : 'var(--border)';
    el.style.background = isSelected ? 'rgba(212,148,15,0.1)' : 'var(--bg-0)';
    if (val) val.style.color = isSelected ? 'var(--accent-light)' : 'var(--text-1)';
    // Update radio
    const radio = document.querySelector(`input[name="newTankCapR"][value="${c}"]`);
    if (radio) radio.checked = isSelected;
  });
}

function updateTankFuelPreview() {
  const sel = document.querySelector('input[name="newTankFuelR"]:checked')?.value;
  FUEL_TYPES.forEach(f => {
    const el = document.getElementById('fuelOpt_' + f.id);
    const lbl = document.getElementById('fuelOptLabel_' + f.id);
    if (!el) return;
    const isSelected = f.id === sel;
    el.style.borderColor = isSelected ? f.color : 'var(--border)';
    el.style.background = isSelected ? f.color + '18' : 'var(--bg-0)';
    if (lbl) lbl.style.color = isSelected ? f.color : 'var(--text-2)';
  });
}

async function saveNewTank() {
  const fuelType = document.querySelector('input[name="newTankFuelR"]:checked')?.value;
  const capacity = parseInt(document.querySelector('input[name="newTankCapR"]:checked')?.value || '0');
  const current  = parseFloat(document.getElementById('newTankCurrent')?.value) || 0;

  if (!fuelType) { toast('Select a fuel type', 'error'); return; }
  if (!capacity) { toast('Select capacity', 'error'); return; }
  if (current > capacity) { toast(`Current level (${fmt(current)}L) cannot exceed capacity (${fmt(capacity)}L)`, 'error'); return; }

  try {
    const tanks = await db.getAll('tanks');
    const newId = tanks.length > 0 ? Math.max(...tanks.map(t => t.id)) + 1 : 1;
    const newTank = {
      id: newId,
      fuelType,
      capacity,
      current,
      lastDip: new Date().toISOString().split('T')[0]
    };
    await db.put('tanks', newTank);
    APP.data.tanks = await db.getAll('tanks');
    closeModal();
    toast(`Tank ${newId} (${getFuel(fuelType).short}, ${fmt(capacity)}L) added`, 'success');
    renderPage();
  } catch(e) {
    // Fallback: update in-memory only
    const tanks = APP.data.tanks;
    const newId = tanks.length > 0 ? Math.max(...tanks.map(t => t.id)) + 1 : 1;
    APP.data.tanks.push({ id: newId, fuelType, capacity, current, lastDip: new Date().toISOString().split('T')[0] });
    closeModal();
    toast(`Tank ${newId} added`, 'success');
    renderPage();
  }
}

function openEditTankModal(tankId) {
  const tank = APP.data.tanks.find(t => t.id === tankId);
  if (!tank) return;
  const fuel = getFuel(tank.fuelType);

  const fuelOpts = FUEL_TYPES.map(f =>
    `<label style="flex:1;cursor:pointer">
      <input type="radio" name="editTankFuelR" value="${f.id}" ${f.id===tank.fuelType?'checked':''} style="display:none" onchange="updateEditTankFuelOpts()">
      <div id="eFuelOpt_${f.id}" style="border:2px solid ${f.id===tank.fuelType?f.color:'var(--border)'};background:${f.id===tank.fuelType?f.color+'18':'var(--bg-0)'};border-radius:10px;padding:12px 8px;text-align:center;transition:all 0.15s;cursor:pointer" onclick="this.previousElementSibling.checked=true;updateEditTankFuelOpts()">
        <div style="font-size:18px;margin-bottom:4px">${f.icon||'⛽'}</div>
        <div style="font-size:11px;font-weight:800;color:${f.id===tank.fuelType?f.color:'var(--text-2)'}" id="eFuelLbl_${f.id}">${f.short}</div>
        <div style="font-size:9px;color:var(--text-3)">${f.name}</div>
      </div>
    </label>`
  ).join('');

  const capOpts = TANK_CAPACITIES.map(c => {
    const labels = {10000:'Standard',16000:'Medium',20000:'Large'};
    const isSel = c === tank.capacity;
    return `<label style="flex:1;cursor:pointer">
      <input type="radio" name="editTankCapR" value="${c}" ${isSel?'checked':''} style="display:none">
      <div id="eCapOpt_${c}" style="border:2px solid ${isSel?'var(--accent)':'var(--border)'};background:${isSel?'rgba(212,148,15,0.1)':'var(--bg-0)'};border-radius:10px;padding:14px 8px;text-align:center;transition:all 0.15s;cursor:pointer" onclick="selectEditTankCap(${c})">
        <div style="font-size:18px;font-weight:900;color:${isSel?'var(--accent-light)':'var(--text-1)'};" id="eCapVal_${c}">${(c/1000).toFixed(0)}K</div>
        <div style="font-size:10px;font-weight:700;color:var(--text-2);margin-top:2px">${c.toLocaleString('en-IN')} L</div>
        <div style="font-size:9px;color:var(--text-3)">${labels[c]||''}</div>
      </div>
    </label>`;
  }).join('');

  openModal(`✏️ Edit Tank ${tankId}`,
    `<div style="background:${fuel.color}18;border:1px solid ${fuel.color}44;border-radius:8px;padding:10px 14px;margin-bottom:16px;display:flex;align-items:center;gap:8px">
       <span style="width:10px;height:10px;border-radius:50%;background:${fuel.color};display:inline-block"></span>
       <span style="font-size:13px;font-weight:700;color:var(--text-0)">Tank ${tankId}</span>
       <span style="font-size:12px;color:var(--text-2)">Current stock: <strong>${fmt(tank.current)} L</strong></span>
     </div>
     <div class="form-group">
       <label class="form-label">Fuel Type *</label>
       <div style="display:flex;gap:8px;margin-top:4px">${fuelOpts}</div>
     </div>
     <div class="form-group" style="margin-top:16px">
       <label class="form-label">Tank Capacity *</label>
       <div style="display:flex;gap:8px;margin-top:4px">${capOpts}</div>
     </div>
     <div class="form-group" style="margin-top:16px">
       <label class="form-label">Current Level (L)</label>
       <input class="form-input" id="editTankCurrent" type="number" min="0" value="${tank.current}" style="font-size:16px;font-weight:700" />
       <div style="font-size:11px;color:var(--text-3);margin-top:4px">Current level will be preserved if it fits within new capacity</div>
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-red btn-sm" onclick="confirmDeleteTank(${tankId});closeModal()" style="margin-right:auto">🗑</button>
     <button class="btn btn-accent" onclick="saveEditTank(${tankId})">💾 Save Changes</button>`
  );
}

function selectEditTankCap(selected) {
  TANK_CAPACITIES.forEach(c => {
    const el = document.getElementById('eCapOpt_' + c);
    const val = document.getElementById('eCapVal_' + c);
    if (!el) return;
    const isSel = c === selected;
    el.style.borderColor = isSel ? 'var(--accent)' : 'var(--border)';
    el.style.background = isSel ? 'rgba(212,148,15,0.1)' : 'var(--bg-0)';
    if (val) val.style.color = isSel ? 'var(--accent-light)' : 'var(--text-1)';
    const radio = document.querySelector(`input[name="editTankCapR"][value="${c}"]`);
    if (radio) radio.checked = isSel;
  });
}

function updateEditTankFuelOpts() {
  const sel = document.querySelector('input[name="editTankFuelR"]:checked')?.value;
  FUEL_TYPES.forEach(f => {
    const el = document.getElementById('eFuelOpt_' + f.id);
    const lbl = document.getElementById('eFuelLbl_' + f.id);
    if (!el) return;
    const isSel = f.id === sel;
    el.style.borderColor = isSel ? f.color : 'var(--border)';
    el.style.background = isSel ? f.color + '18' : 'var(--bg-0)';
    if (lbl) lbl.style.color = isSel ? f.color : 'var(--text-2)';
  });
}

async function saveEditTank(tankId) {
  const fuelType = document.querySelector('input[name="editTankFuelR"]:checked')?.value;
  const capacity = parseInt(document.querySelector('input[name="editTankCapR"]:checked')?.value || '0');
  const current  = parseFloat(document.getElementById('editTankCurrent')?.value) || 0;

  if (!fuelType) { toast('Select a fuel type', 'error'); return; }
  if (!capacity) { toast('Select capacity', 'error'); return; }
  if (current > capacity) { toast(`Current level (${fmt(current)}L) exceeds new capacity (${fmt(capacity)}L). Reduce current level first.`, 'error'); return; }

  const updatedTank = { id: tankId, fuelType, capacity, current, lastDip: APP.data.tanks.find(t=>t.id===tankId)?.lastDip || '' };

  try {
    await db.put('tanks', updatedTank);
    APP.data.tanks = await db.getAll('tanks');
  } catch(e) {
    const idx = APP.data.tanks.findIndex(t => t.id === tankId);
    if (idx >= 0) APP.data.tanks[idx] = updatedTank;
  }
  closeModal();
  toast(`Tank ${tankId} updated — ${getFuel(fuelType).short}, ${fmt(capacity)}L capacity`, 'success');
  renderPage();
}

function confirmDeleteTank(tankId) {
  const tank = APP.data.tanks.find(t => t.id === tankId);
  if (!tank) return;
  const fuel = getFuel(tank.fuelType);
  openModal('🗑 Delete Tank',
    `<div style="text-align:center;padding:10px 0">
       <div style="font-size:40px;margin-bottom:12px">⚠️</div>
       <div style="font-size:15px;font-weight:700;color:var(--text-0);margin-bottom:8px">Delete Tank ${tankId}?</div>
       <div style="font-size:13px;color:var(--text-2);line-height:1.6">
         <strong style="color:${fuel.color}">${fuel.name}</strong> · ${fmt(tank.capacity)}L capacity<br>
         Current stock: <strong>${fmt(tank.current)}L</strong><br><br>
         <span style="color:var(--red)">This will also delete all dip readings for this tank.</span>
       </div>
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-red" onclick="deleteTank(${tankId})">🗑 Delete Tank</button>`
  );
}

async function deleteTank(tankId) {
  try {
    // Delete tank
    await db.delete('tanks', tankId);
    // Also delete dip readings for this tank
    const dips = (APP.data.dipReadings || []).filter(d => d.tankId !== tankId);
    APP.data.tanks = await db.getAll('tanks');
    APP.data.dipReadings = dips;
  } catch(e) {
    APP.data.tanks = APP.data.tanks.filter(t => t.id !== tankId);
    APP.data.dipReadings = (APP.data.dipReadings || []).filter(d => d.tankId !== tankId);
  }
  closeModal();
  toast(`Tank ${tankId} deleted`, 'success');
  renderPage();
}

// ── DIP CHART HELPER ─────────────────────────────────────────
// Returns: '10K' | '20K' | null
function _tankChartType(tank) {
  if (!tank) return null;
  const cap = Number(tank.capacity);
  if (cap === 10000) return '10K';
  if (cap === 20000) return '20K';
  return null;
}

function _chartLabel(type) {
  if (type === '10K') return '📊 IOCL 10,000L Chart (1–194 cm)';
  if (type === '20K') return '📊 IOCL 20,000L Chart (1–210 cm)';
  return null;
}

function _cmRange(type) {
  if (type === '10K') return { min: 1, max: 194, placeholder: 'e.g. 87' };
  if (type === '20K') return { min: 1, max: 210, placeholder: 'e.g. 105' };
  return null;
}

function openDipModal(preselect) {
  // If called with a specific tankId, lock to that tank — no dropdown shown
  const lockedTank = preselect ? APP.data.tanks.find(t => t.id == preselect) : null;
  const firstTank  = lockedTank || APP.data.tanks[0];
  const chartType  = _tankChartType(firstTank);
  const useChart   = !!chartType;
  const cmR        = _cmRange(chartType) || { min:1, max:999, placeholder:'e.g. 87' };
  const mmOpts     = Array.from({length:10},(_,i)=>`<option value="${i}">${i} mm</option>`).join('');

  // Build tank selector — hidden (locked) if called from a specific tank card
  const tankOpts = APP.data.tanks.map(t => {
    const tf = getFuel(t.fuelType);
    const ct = _tankChartType(t);
    const tag = ct ? ` 📊 IOCL ${ct}` : '';
    return `<option value="${t.id}" ${t.id==firstTank?.id?'selected':''}">Tank ${t.id} — ${tf.short}${tag} (${fmt(t.capacity)}L)</option>`;
  }).join('');

  const fuel = getFuel(firstTank?.fuelType || 'petrol');
  const tankSelectorHtml = lockedTank
    ? `<input type="hidden" id="dipTank" value="${firstTank.id}" />
       <div style="background:${fuel.color}15;border:1px solid ${fuel.color}44;border-radius:10px;padding:12px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px">
         <span style="width:10px;height:10px;border-radius:50%;background:${fuel.color};display:inline-block;flex-shrink:0"></span>
         <div>
           <div style="font-size:13px;font-weight:800;color:var(--text-0)">Tank ${firstTank.id} — ${fuel.name}</div>
           <div style="font-size:11px;color:var(--text-3)">Capacity: ${fmt(firstTank.capacity)} L &nbsp;·&nbsp; Current: ${fmt(firstTank.current)} L</div>
         </div>
       </div>`
    : `<div class="form-group">
         <label class="form-label">Tank</label>
         <select class="form-input" id="dipTank" onchange="onDipTankChange()">${tankOpts}</select>
       </div>`;

  openModal('📏 Record Dip Reading',
    tankSelectorHtml +
    `<!-- IOCL Chart Input -->
     <div id="dipChartSection" style="${useChart ? '' : 'display:none'}">
       <div id="dipChartBadge" style="background:rgba(212,148,15,0.07);border:1px solid rgba(212,148,15,0.22);border-radius:8px;padding:10px 14px;margin-bottom:14px">
         <div style="font-size:11px;font-weight:700;color:var(--accent-light);margin-bottom:1px" id="dipChartLabel">${_chartLabel(chartType) || ''}</div>
         <div style="font-size:10px;color:var(--text-3)">Enter dip rod reading → Volume calculated automatically</div>
       </div>
       <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
         <div>
           <label class="form-label">Dip Cm <span id="dipCmRange" style="color:var(--text-3);font-weight:400">(${cmR.min}–${cmR.max})</span></label>
           <input class="form-input" id="dipCm" type="number" min="${cmR.min}" max="${cmR.max}" step="1"
             placeholder="${cmR.placeholder}" oninput="updateDipPreview()"
             style="font-size:22px;font-weight:800;text-align:center" />
         </div>
         <div>
           <label class="form-label">+ mm (0–9)</label>
           <select class="form-input" id="dipMm" onchange="updateDipPreview()"
             style="font-size:22px;font-weight:800;text-align:center">${mmOpts}</select>
         </div>
       </div>

       <!-- 20K full coverage 1-210cm — no fallback needed -->

       <!-- Live Calculation Preview -->
       <div id="dipCalcPreview" style="background:var(--bg-0);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:4px;display:none">
         <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
           <span style="font-size:11px;color:var(--accent-light);font-weight:700;text-transform:uppercase;letter-spacing:0.5px">⛽ Available Qty Will Be Set To</span>
           <span id="dipCalcPct" style="font-size:11px;font-weight:700;padding:2px 9px;border-radius:5px"></span>
         </div>
         <div style="font-size:32px;font-weight:900;color:var(--text-0);line-height:1;margin-bottom:6px">
           <span id="dipCalcVol">—</span><span style="font-size:14px;color:var(--text-3);font-weight:400"> L</span>
         </div>
         <div style="font-size:11px;color:var(--text-3);margin-bottom:10px" id="dipCalcFormula"></div>
         <div style="height:7px;background:var(--bg-2);border-radius:4px;overflow:hidden">
           <div id="dipCalcBar" style="height:100%;border-radius:4px;transition:width 0.3s,background 0.3s;width:0%"></div>
         </div>
       </div>
     </div>

     <!-- Direct Litre Input (non-chart tanks) -->
     <div id="dipDirectSection" style="${useChart ? 'display:none' : ''}">
       <div class="form-group">
         <label class="form-label">Physical Dip Reading (Litres) — Sets Available Qty</label>
         <input class="form-input" id="dipReading" type="number" step="1"
           placeholder="Enter measured litres" style="font-size:22px;font-weight:700;text-align:center" />
         <div style="font-size:11px;color:var(--accent-light);margin-top:4px;font-weight:600">
           ⚠️ This value will be set as the tank's available fuel quantity
         </div>
       </div>
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveDip()">💾 Save — Set Available Qty</button>`
  );
}


function onDipTankChange() {
  const tankId = parseInt(document.getElementById('dipTank')?.value);
  const tank = APP.data.tanks.find(t => t.id === tankId);
  const ct = _tankChartType(tank);
  const useChart = !!ct;
  const cmR = _cmRange(ct) || { min:1, max:999 };

  const chartSec = document.getElementById('dipChartSection');
  const directSec = document.getElementById('dipDirectSection');
  const labelEl = document.getElementById('dipChartLabel');
  const cmRangeEl = document.getElementById('dipCmRange');
  const cmInput = document.getElementById('dipCm');

  if (chartSec) chartSec.style.display = useChart ? '' : 'none';
  if (directSec) directSec.style.display = useChart ? 'none' : '';
  if (labelEl) labelEl.textContent = _chartLabel(ct) || '';
  if (cmRangeEl) cmRangeEl.textContent = `(${cmR.min}–${cmR.max})`;
  if (cmInput) { cmInput.min = cmR.min; cmInput.max = cmR.max; cmInput.value = ''; }

  const preview = document.getElementById('dipCalcPreview');
  if (preview) preview.style.display = 'none';

  // Full 1-210cm coverage — no below-range elements needed
}

function updateDipPreview() {
  const cm = parseInt(document.getElementById('dipCm')?.value);
  const mm = parseInt(document.getElementById('dipMm')?.value) || 0;
  const preview = document.getElementById('dipCalcPreview');
  const volEl   = document.getElementById('dipCalcVol');
  const fmlaEl  = document.getElementById('dipCalcFormula');
  const pctEl   = document.getElementById('dipCalcPct');
  const barEl   = document.getElementById('dipCalcBar');


  if (!preview || !volEl) return;

  const tankId = parseInt(document.getElementById('dipTank')?.value);
  const tank = APP.data.tanks.find(t => t.id === tankId);
  const ct = _tankChartType(tank);
  const capacity = tank?.capacity || 10000;

  if (!cm || isNaN(cm)) { preview.style.display = 'none'; return; }

  let row = null, total = null;

  if (ct === '10K') {
    if (cm < 1 || cm > 194) { preview.style.display = 'none'; return; }
    row = IOCL_DIP_10K[cm];
  } else if (ct === '20K') {
    // Show below-range notice if cm < 127
    if (cm < IOCL_20K_MIN_CM) {
        preview.style.display = 'none';
      return;
    }
    if (cm > IOCL_20K_MAX_CM) { preview.style.display = 'none'; return; }
    row = IOCL_DIP_20K[cm];
  }

  if (!row) { preview.style.display = 'none'; return; }

  const mmAdd = mm > 0 && row.diff ? mm * row.diff : 0;
  total = Math.round((row.vol + mmAdd) * 100) / 100;

  const pct = Math.min(100, Math.round(total / capacity * 100));
  const barCol = pct < 20 ? 'var(--red)' : pct < 40 ? '#f97316' : 'var(--green)';

  volEl.textContent = total.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  fmlaEl.innerHTML = mm > 0 && row.diff
    ? `${cm}cm = ${row.vol}L + ${mm}mm × ${row.diff} L/mm = <strong>+${mmAdd.toFixed(2)}L</strong>`
    : `${cm}cm → ${row.vol}L (IOCL ${ct} chart)`;
  pctEl.textContent = pct + '% full';
  pctEl.style.background = pct < 20 ? 'rgba(239,68,68,0.12)' : pct < 40 ? 'rgba(249,115,22,0.12)' : 'rgba(34,197,94,0.12)';
  pctEl.style.color = barCol;
  barEl.style.width = pct + '%';
  barEl.style.background = barCol;
  preview.style.display = '';
}

function saveDip() {
  const tankId = parseInt(document.getElementById('dipTank').value);
  const tank = APP.data.tanks.find(t => t.id === tankId);
  const ct = _tankChartType(tank);

  let reading;
  let method = 'direct';

  if (ct === '10K') {
    const cm = parseInt(document.getElementById('dipCm')?.value);
    const mm = parseInt(document.getElementById('dipMm')?.value) || 0;
    if (!cm || cm < 1 || cm > 194) { toast('Enter dip reading in cm (1–194)', 'error'); return; }
    reading = ioclDipToLiters(cm, mm);
    method = 'iocl_10k';

  } else if (ct === '20K') {
    const cm = parseInt(document.getElementById('dipCm')?.value);
    const mm = parseInt(document.getElementById('dipMm')?.value) || 0;
    if (!cm || cm < 1 || cm > 210) { toast('Enter dip reading in cm (1–210)', 'error'); return; }
    const result = ioclDipToLiters20K(cm, mm);
    if (result === null) { toast(`Chart data not available for ${cm}cm`, 'error'); return; }
    reading = result;
    method = 'iocl_20k';

  } else {
    reading = parseFloat(document.getElementById('dipReading')?.value);
    if (isNaN(reading) || reading < 0) { toast('Enter valid dip reading', 'error'); return; }
    if (tank && reading > tank.capacity) { toast('Reading exceeds tank capacity (' + fmt(tank.capacity) + 'L)', 'error'); return; }
  }

  if (reading > (tank?.capacity || 99999) * 1.15) {
    toast('Reading seems too high — check dip measurement', 'error'); return;
  }

  const dip = {
    id: Date.now(), date: today(), time: now(),
    tankId, reading,
    calculated: tank ? tank.current : reading,
    method
  };
  APP.data.dipReadings.unshift(dip);
  db.add('dipReadings', dip).catch(() => {});
  if (tank) { tank.current = reading; tank.lastDip = today() + ' ' + now(); db.put('tanks', tank).catch(() => {}); }
  auditLog('dip_reading', { tankId, reading, method });
  closeModal();
  toast(`✅ Tank ${tankId} — Available Qty set to ${reading.toLocaleString('en-IN', {maximumFractionDigits:1})} L`, 'success');
  renderPage();
}

function openExpenseModal(prefillCategory) {
  const categories = [
    { group: '🏪 Operating', items: ['Electricity', 'Rent', 'Salary', 'Maintenance', 'Insurance', 'Misc'] },
    { group: '🧾 Taxes', items: ['Local Sales Tax (Bill)', 'GST — Lube / Lubricants'] },
    { group: '🛢️ Purchases', items: ['Lube / Lubricants', 'Other Purchase'] },
  ];
  const allOpts = categories.map(g =>
    `<optgroup label="${g.group}">${g.items.map(i => `<option value="${i}">${i}</option>`).join('')}</optgroup>`
  ).join('');

  // Fuel rows for multi-fuel tax bill
  const fuelRows = [
    { id: 'petrol',          label: 'Petrol (MS)',    color: '#ef4444', defaultRate: '3' },
    { id: 'diesel',          label: 'Diesel (HSD)',   color: '#f97316', defaultRate: '3' },
    { id: 'premium_petrol',  label: 'XP95 Premium',  color: '#a855f7', defaultRate: '3' },
  ].map(f => `
    <div id="taxRow_${f.id}" style="display:none;border:1px solid var(--border);border-radius:8px;padding:10px;margin-bottom:8px;background:var(--bg-0)">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${f.color};display:inline-block;flex-shrink:0"></span>
        <span style="font-size:12px;font-weight:700;color:var(--text-0)">${f.label}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px">Sale Amount (₹)</div>
          <input class="form-input" id="taxSale_${f.id}" type="number" inputmode="decimal" step="0.01" placeholder="₹ Sales" oninput="expCalcTax()" style="padding:8px;font-size:13px" />
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px">Tax Rate (%)</div>
          <input class="form-input" id="taxRate_${f.id}" type="number" inputmode="decimal" step="0.01" value="${f.defaultRate}" oninput="expCalcTax()" style="padding:8px;font-size:13px" />
        </div>
        <div>
          <div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;margin-bottom:4px">Tax Amount (₹)</div>
          <input class="form-input mono" id="taxAmt_${f.id}" type="text" readonly placeholder="—" style="padding:8px;font-size:13px;background:var(--bg-2);color:var(--accent-light);font-weight:700" />
        </div>
      </div>
    </div>`).join('');

  openModal('Add Expense', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Category</label>
        <select class="form-input" id="expCategory" onchange="expCategoryChanged()">${allOpts}</select>
      </div>
      <div class="form-group">
        <label class="form-label">Total Amount (₹)</label>
        <input class="form-input mono fw-700" id="expAmount" type="number" inputmode="decimal" step="0.01" placeholder="0.00" readonly style="background:var(--bg-2)" />
      </div>
    </div>

    <!-- Local Sales Tax multi-fuel bill -->
    <div id="expTaxBlock" style="display:none;background:rgba(212,148,15,0.06);border:1px solid rgba(212,148,15,0.25);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--accent-light);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">🧾 Sales Tax Bill — Select Fuels in This Bill</div>

      <!-- Fuel checkboxes -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-0);border:2px solid var(--border);border-radius:8px;padding:8px 12px;transition:border 0.15s" id="taxChkWrap_petrol">
          <input type="checkbox" id="taxChk_petrol" onchange="expToggleFuel('petrol')" style="width:16px;height:16px;accent-color:#ef4444" />
          <span style="font-size:12px;font-weight:700;color:#ef4444">● Petrol (MS)</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-0);border:2px solid var(--border);border-radius:8px;padding:8px 12px;transition:border 0.15s" id="taxChkWrap_diesel">
          <input type="checkbox" id="taxChk_diesel" onchange="expToggleFuel('diesel')" style="width:16px;height:16px;accent-color:#f97316" />
          <span style="font-size:12px;font-weight:700;color:#f97316">● Diesel (HSD)</span>
        </label>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;background:var(--bg-0);border:2px solid var(--border);border-radius:8px;padding:8px 12px;transition:border 0.15s" id="taxChkWrap_premium_petrol">
          <input type="checkbox" id="taxChk_premium_petrol" onchange="expToggleFuel('premium_petrol')" style="width:16px;height:16px;accent-color:#a855f7" />
          <span style="font-size:12px;font-weight:700;color:#a855f7">● XP95 Premium</span>
        </label>
      </div>

      <!-- Per-fuel rows (shown when checkbox ticked) -->
      ${fuelRows}

      <!-- Bill total summary -->
      <div id="expTaxSummary" style="display:none;padding:10px 12px;background:rgba(212,148,15,0.1);border-radius:6px;margin-top:4px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
          <div style="font-size:12px;color:var(--text-2)">Total Taxable Sales</div>
          <div class="mono fw-700" id="taxTotalSales" style="color:var(--text-0)">₹0.00</div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;flex-wrap:wrap;gap:8px">
          <div style="font-size:13px;font-weight:700;color:var(--text-0)">Total Tax Payable</div>
          <div class="mono fw-800" id="taxTotalPayable" style="color:var(--accent-light);font-size:16px">₹0.00</div>
        </div>
      </div>
    </div>

    <!-- GST Lube block -->
    <div id="expGSTBlock" style="display:none;background:rgba(6,182,212,0.06);border:1px solid rgba(6,182,212,0.25);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:#06b6d4;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:10px">📦 GST — Lube Purchase</div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Invoice Value (₹) incl. GST</label>
          <input class="form-input" id="expGSTInvoice" type="number" inputmode="decimal" step="0.01" placeholder="Total bill amount" oninput="expCalcGST()" />
        </div>
        <div class="form-group">
          <label class="form-label">GST Rate</label>
          <select class="form-input" id="expGSTRate" onchange="expCalcGST()">
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18" selected>18%</option>
            <option value="28">28%</option>
            <option value="custom">Custom...</option>
          </select>
        </div>
      </div>
      <input class="form-input" id="expGSTCustomRate" type="number" inputmode="decimal" step="0.01" placeholder="Custom GST %" style="display:none;margin-bottom:8px" oninput="expCalcGST()" />
      <div id="expGSTSummary" style="display:none;padding:10px;background:rgba(6,182,212,0.08);border-radius:6px">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;text-align:center">
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:600">Base Value</div><div class="mono fw-700" id="expGSTBase" style="color:var(--text-0)">₹0.00</div></div>
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:600">CGST</div><div class="mono fw-700" id="expCGST" style="color:#06b6d4">₹0.00</div></div>
          <div><div style="font-size:10px;color:var(--text-3);text-transform:uppercase;font-weight:600">SGST</div><div class="mono fw-700" id="expSGST" style="color:#06b6d4">₹0.00</div></div>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid rgba(6,182,212,0.2)">
          <span style="font-size:12px;font-weight:700;color:var(--text-0)">Total GST</span>
          <span class="mono fw-800" id="expGSTTotal" style="color:#06b6d4;font-size:15px">₹0.00</span>
        </div>
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Bill / Invoice No. & Notes</label>
      <input class="form-input" id="expDesc" placeholder="Bill no., period (e.g. March 2026), vendor…" />
    </div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="saveExpense()">💾 Save</button>`);

  if (prefillCategory) {
    const sel = document.getElementById('expCategory');
    if (sel) { sel.value = prefillCategory; expCategoryChanged(); }
  } else {
    expCategoryChanged();
  }
}

// Toggle fuel row visibility when checkbox ticked/unticked
function expToggleFuel(fuelId) {
  const checked = document.getElementById('taxChk_' + fuelId)?.checked;
  const row  = document.getElementById('taxRow_' + fuelId);
  const wrap = document.getElementById('taxChkWrap_' + fuelId);
  if (row) row.style.display = checked ? 'block' : 'none';
  if (wrap) {
    const colors = { petrol: '#ef4444', diesel: '#f97316', premium_petrol: '#a855f7' };
    wrap.style.borderColor = checked ? (colors[fuelId] || 'var(--accent)') : 'var(--border)';
  }
  if (!checked && row) {
    // Clear inputs when unchecked
    const saleEl = document.getElementById('taxSale_' + fuelId);
    const amtEl  = document.getElementById('taxAmt_' + fuelId);
    if (saleEl) saleEl.value = '';
    if (amtEl)  amtEl.value  = '';
  }
  expCalcTax();
}

function expCategoryChanged() {
  const cat = document.getElementById('expCategory')?.value || '';
  const taxBlock = document.getElementById('expTaxBlock');
  const gstBlock = document.getElementById('expGSTBlock');
  const amtInput = document.getElementById('expAmount');
  const isTax = cat === 'Local Sales Tax (Bill)';
  const isGST = cat === 'GST — Lube / Lubricants';
  taxBlock.style.display = isTax ? 'block' : 'none';
  gstBlock.style.display  = isGST  ? 'block'  : 'none';
  // Amount field: readonly & auto-filled for tax/GST, manual for others
  amtInput.readOnly = isTax || isGST;
  amtInput.style.background = (isTax || isGST) ? 'var(--bg-2)' : '';
  if (!(isTax || isGST)) amtInput.value = '';
}

function expCalcTax() {
  const fuels = ['petrol', 'diesel', 'premium_petrol'];
  let totalSales = 0, totalTax = 0;
  let anyChecked = false;
  fuels.forEach(f => {
    const chk  = document.getElementById('taxChk_' + f);
    if (!chk?.checked) return;
    anyChecked = true;
    const sale = parseFloat(document.getElementById('taxSale_' + f)?.value) || 0;
    const rate = parseFloat(document.getElementById('taxRate_' + f)?.value) || 0;
    const tax  = sale * rate / 100;
    const amtEl = document.getElementById('taxAmt_' + f);
    if (amtEl) amtEl.value = tax > 0 ? '₹' + tax.toFixed(2) : '';
    totalSales += sale;
    totalTax   += tax;
  });
  const summary = document.getElementById('expTaxSummary');
  if (anyChecked && totalTax > 0) {
    document.getElementById('taxTotalSales').textContent  = '₹' + totalSales.toFixed(2);
    document.getElementById('taxTotalPayable').textContent = '₹' + totalTax.toFixed(2);
    summary.style.display = 'block';
  } else {
    summary.style.display = 'none';
  }
  const amtEl = document.getElementById('expAmount');
  if (amtEl) amtEl.value = totalTax > 0 ? totalTax.toFixed(2) : '';
}

function expCalcGST() {
  const invoice = parseFloat(document.getElementById('expGSTInvoice')?.value) || 0;
  const rateSel = document.getElementById('expGSTRate')?.value;
  const customInput = document.getElementById('expGSTCustomRate');
  customInput.style.display = rateSel === 'custom' ? 'block' : 'none';
  const rate = rateSel === 'custom'
    ? (parseFloat(customInput?.value) || 0)
    : parseFloat(rateSel) || 0;
  const summary = document.getElementById('expGSTSummary');
  if (invoice <= 0 || rate <= 0) { summary.style.display = 'none'; document.getElementById('expAmount').value = ''; return; }
  const base   = invoice / (1 + rate / 100);
  const gstAmt = invoice - base;
  const half   = gstAmt / 2;
  document.getElementById('expGSTBase').textContent  = '₹' + base.toFixed(2);
  document.getElementById('expCGST').textContent     = '₹' + half.toFixed(2);
  document.getElementById('expSGST').textContent     = '₹' + half.toFixed(2);
  document.getElementById('expGSTTotal').textContent = '₹' + gstAmt.toFixed(2);
  summary.style.display = 'block';
  document.getElementById('expAmount').value = gstAmt.toFixed(2);
}

function expCalcTotal() {}

function saveExpense() {
  const category = document.getElementById('expCategory').value;
  const amount   = parseFloat(document.getElementById('expAmount').value);
  const desc     = (document.getElementById('expDesc').value || '').trim();
  if (!category) { toast('Select a category', 'error'); return; }
  if (isNaN(amount) || amount <= 0) { toast('Enter a valid amount', 'error'); return; }
  if (amount > 500000) { toast('Amount exceeds ₹5,00,000 limit', 'error'); return; }

  const isTax = category === 'Local Sales Tax (Bill)';
  const isGST = category === 'GST — Lube / Lubricants';
  const meta  = {};

  if (isTax) {
    meta.taxType = 'local_sales_tax';
    meta.fuelTaxBreakdown = {};
    ['petrol','diesel','premium_petrol'].forEach(f => {
      const chk = document.getElementById('taxChk_' + f);
      if (!chk?.checked) return;
      const sale = parseFloat(document.getElementById('taxSale_' + f)?.value) || 0;
      const rate = parseFloat(document.getElementById('taxRate_' + f)?.value) || 0;
      if (sale > 0) meta.fuelTaxBreakdown[f] = { sale, rate, tax: sale * rate / 100 };
    });
    const fuelsOnBill = Object.keys(meta.fuelTaxBreakdown).map(f =>
      ({ petrol: 'Petrol', diesel: 'Diesel', premium_petrol: 'Premium' })[f]
    ).join(' + ');
    meta.billFuels = fuelsOnBill;
  }

  if (isGST) {
    meta.taxType = 'gst';
    meta.invoiceValue = parseFloat(document.getElementById('expGSTInvoice')?.value) || 0;
    const rateSel = document.getElementById('expGSTRate')?.value;
    meta.gstRate  = rateSel === 'custom' ? parseFloat(document.getElementById('expGSTCustomRate')?.value) || 0 : parseFloat(rateSel) || 0;
    meta.cgst = amount / 2;
    meta.sgst = amount / 2;
  }

  const autoDesc = isTax
    ? ('Local Sales Tax' + (meta.billFuels ? ' — ' + meta.billFuels : ''))
    : isGST ? 'GST on Lube Purchase' : category;
  const finalDesc = desc || autoDesc;

  const expense = { id: Date.now(), date: today(), category: sanitize(category), amount, desc: sanitize(finalDesc), ...meta };
  APP.data.expenses.unshift(expense);
  db.add('expenses', expense).catch(() => {});
  auditLog('expense_add', { category, amount, desc: finalDesc });
  closeModal();
  toast('✅ ' + sanitize(category) + ': ' + cur(amount) + ' saved', 'success');
  renderPage();
}

function openPurchaseModal() {
  const fuelOpts = FUEL_TYPES.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
  openModal('Record Fuel Purchase', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Fuel Type</label><select class="form-input" id="purchFuel">${fuelOpts}</select></div>
      <div class="form-group"><label class="form-label">Quantity (L)</label><input class="form-input" id="purchQty" type="number" placeholder="Liters" /></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Rate per Liter (₹)</label><input class="form-input" id="purchRate" type="number" step="0.01" /></div>
      <div class="form-group"><label class="form-label">Invoice No.</label><input class="form-input" id="purchInvoice" placeholder="INV-XXXX" /></div>
    </div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="savePurchase()">💾 Save</button>`);
}

function savePurchase() {
  const fuelType = document.getElementById('purchFuel').value;
  const liters = parseFloat(document.getElementById('purchQty').value);
  const rate = parseFloat(document.getElementById('purchRate').value);
  const invoice = (document.getElementById('purchInvoice').value || '').trim();
  if (!fuelType || !['petrol','diesel','premium_petrol'].includes(fuelType)) { toast('Invalid fuel type', 'error'); return; }
  if (isNaN(liters) || liters <= 0) { toast('Liters must be positive', 'error'); return; }
  if (liters > 25000) { toast('Purchase cannot exceed 25,000 liters', 'error'); return; }
  if (isNaN(rate) || rate <= 0) { toast('Rate must be positive', 'error'); return; }
  if (rate > 300) { toast('Rate exceeds ₹300/L limit', 'error'); return; }
  const total = liters * rate;
  const purchase = { id: Date.now(), date: today(), fuelType, liters, rate, total, invoice: sanitize(invoice) };
  APP.data.fuelPurchases.unshift(purchase);
  db.add('fuelPurchases', purchase).catch(() => {});

  // Auto-create expense register entry for this fuel purchase
  const fuelInfo = getFuel(fuelType);
  const expEntry = {
    id: Date.now() + 1,
    date: today(),
    category: 'Fuel Purchase',
    desc: `${fuelInfo.short} — ${fmt(liters)}L @ ₹${rate}/L${invoice ? ' · ' + sanitize(invoice) : ''}`,
    amount: total,
    source: 'fuel_purchase',
    purchaseId: purchase.id,
  };
  if (!APP.data.expenses) APP.data.expenses = [];
  APP.data.expenses.unshift(expEntry);
  db.add('expenses', expEntry).catch(() => {});

  const tank = APP.data.tanks.find(t => t.fuelType === fuelType);
  if (tank) {
    tank.current = Math.min(tank.capacity, tank.current + liters);
    tank.lastDip = today();
    db.put('tanks', tank).catch(() => {});
  }
  auditLog('purchase_add', { fuelType, liters, rate, total, invoice });
  closeModal();
  toast(`✅ ${fmt(liters)}L ${fuelInfo.short} purchased — ₹${cur(total)} added to expenses`, 'success');
  renderPage();
}

// ── PUMP EDIT — per-nozzle fuel type ─────────────────────────
function openEditPumpModal(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;

  const nozzleLabels = pump.nozzleLabels || (pump.nozzles === 1 ? ['A'] : pump.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, pump.nozzles));
  const nozzleFuels  = pump.nozzleFuels  || {};

  // Build one row per nozzle with fuel type selector
  const nozzleRows = nozzleLabels.map(n => {
    const currentFuel = nozzleFuels[n] || pump.fuelType;
    const fuelOpts = FUEL_TYPES.map(f =>
      `<option value="${f.id}" ${f.id === currentFuel ? 'selected' : ''}>${f.short} — ${f.name}</option>`
    ).join('');
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light)">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--bg-0);border:2px solid var(--border);display:grid;place-items:center;font-size:13px;font-weight:900;color:var(--text-0);flex-shrink:0">N${n}</div>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;font-weight:600">NOZZLE ${n} — Fuel Type</div>
        <select class="form-input" id="nozzleFuel_${n}" style="font-size:13px">${fuelOpts}</select>
      </div>
    </div>`;
  }).join('');

  const statusOpts = ['active','inactive'].map(s =>
    `<option value="${s}" ${pump.status===s?'selected':''}>${s.charAt(0).toUpperCase()+s.slice(1)}</option>`
  ).join('');

  openModal(`✏️ Edit ${pump.name}`,
    `<div class="form-group">
       <label class="form-label">Pump Name</label>
       <input class="form-input" id="editPumpName" value="${pump.name}" />
     </div>
     <div class="form-group">
       <label class="form-label">Status</label>
       <select class="form-input" id="editPumpStatus">${statusOpts}</select>
     </div>
     <div style="margin-top:4px">
       <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⛽ Nozzle Fuel Types</div>
       <div style="background:var(--bg-0);border:1px solid var(--border);border-radius:10px;padding:0 14px">${nozzleRows}</div>
       <div style="font-size:11px;color:var(--text-3);margin-top:6px">Each nozzle can dispense a different fuel type independently</div>
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-sm" style="background:rgba(239,68,68,0.1);color:var(--red);border:1px solid rgba(239,68,68,0.3)" onclick="closeModal();confirmDeletePump(${pumpId})">🗑 Delete</button>
     <button class="btn btn-accent" onclick="saveEditPump(${pumpId})">💾 Save Changes</button>`
  );
}

function saveEditPump(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;

  const name   = (document.getElementById('editPumpName')?.value || '').trim();
  const status = document.getElementById('editPumpStatus')?.value || 'active';
  if (!name) { toast('Enter pump name', 'error'); return; }

  const nozzleLabels = pump.nozzleLabels || (pump.nozzles === 1 ? ['A'] : pump.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, pump.nozzles));
  const nozzleFuels  = {};
  nozzleLabels.forEach(n => {
    nozzleFuels[n] = document.getElementById(`nozzleFuel_${n}`)?.value || pump.fuelType;
  });

  // Primary fuelType = first nozzle's fuel (for backward compat)
  pump.name        = sanitize(name);
  pump.status      = status;
  pump.nozzleFuels = nozzleFuels;
  pump.fuelType    = nozzleFuels[nozzleLabels[0]] || pump.fuelType;

  db.put('pumps', pump).catch(() => {});
  auditLog('pump_edit', { pumpId, name, status, nozzleFuels });
  closeModal();
  toast(`${name} updated`, 'success');
  renderPage();
}

function openAddPumpModal() {
  const fuelOpts = FUEL_TYPES.map(f =>
    `<option value="${f.id}">${f.short} — ${f.name}</option>`
  ).join('');

  const nozzleCountOpts = [1,2,3].map(n =>
    `<option value="${n}" ${n===2?'selected':''}>${n} Nozzle${n>1?'s':''}</option>`
  ).join('');

  openModal('➕ Add New Pump',
    `<div class="form-group">
       <label class="form-label">Pump Name *</label>
       <input class="form-input" id="addPumpName" placeholder="e.g. Pump 6" />
     </div>
     <div class="form-row">
       <div class="form-group">
         <label class="form-label">Number of Nozzles</label>
         <select class="form-input" id="addPumpNozzles" onchange="renderAddPumpNozzleRows()">${nozzleCountOpts}</select>
       </div>
       <div class="form-group">
         <label class="form-label">Status</label>
         <select class="form-input" id="addPumpStatus">
           <option value="active">Active</option>
           <option value="inactive">Inactive</option>
         </select>
       </div>
     </div>
     <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:6px">⛽ Nozzle Fuel Types</div>
     <div id="addPumpNozzleRows" style="background:var(--bg-0);border:1px solid var(--border);border-radius:10px;padding:0 14px"></div>
     <div style="font-size:11px;color:var(--text-3);margin-top:6px">Each nozzle can dispense a different fuel type independently</div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveAddPump()">💾 Add Pump</button>`
  );
  // Render initial nozzle rows
  setTimeout(() => renderAddPumpNozzleRows(), 50);
}

function renderAddPumpNozzleRows() {
  const count = parseInt(document.getElementById('addPumpNozzles')?.value) || 2;
  const labels = count === 1 ? ['A'] : count === 2 ? ['A','B'] : ['A','B','C'];
  const fuelOpts = FUEL_TYPES.map(f => `<option value="${f.id}">${f.short} — ${f.name}</option>`).join('');
  const el = document.getElementById('addPumpNozzleRows');
  if (!el) return;
  el.innerHTML = labels.map(n => `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border-light)">
      <div style="width:34px;height:34px;border-radius:50%;background:var(--bg-2);border:2px solid var(--border);display:grid;place-items:center;font-size:13px;font-weight:900;color:var(--text-0);flex-shrink:0">N${n}</div>
      <div style="flex:1">
        <div style="font-size:11px;color:var(--text-3);margin-bottom:4px;font-weight:600">NOZZLE ${n} — Fuel Type</div>
        <select class="form-input" id="addNozzleFuel_${n}" style="font-size:13px">${fuelOpts}</select>
      </div>
    </div>`).join('');
}

function saveAddPump() {
  const name = (document.getElementById('addPumpName')?.value || '').trim();
  const status = document.getElementById('addPumpStatus')?.value || 'active';
  const count = parseInt(document.getElementById('addPumpNozzles')?.value) || 2;
  if (!name || name.length < 1) { toast('Enter a pump name', 'error'); return; }

  const nozzleLabels = count === 1 ? ['A'] : count === 2 ? ['A','B'] : ['A','B','C'];
  const nozzleFuels = {};
  nozzleLabels.forEach(n => {
    nozzleFuels[n] = document.getElementById(`addNozzleFuel_${n}`)?.value || 'petrol';
  });
  const primaryFuel = nozzleFuels[nozzleLabels[0]];

  const newPump = {
    id: Date.now(),
    name: sanitize(name),
    fuelType: primaryFuel,
    nozzles: count,
    nozzleLabels,
    nozzleFuels,
    status,
    openReading: 0,
    currentReading: 0,
    nozzleReadings: {},
  };

  APP.data.pumps.push(newPump);
  db.put('pumps', newPump).catch(() => {});
  auditLog('pump_add', { name, nozzles: count, nozzleFuels });
  closeModal();
  toast(`✅ ${name} added with ${count} nozzle${count>1?'s':''}`, 'success');
  renderPage();
}

function confirmDeletePump(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;
  openModal('🗑 Delete Pump',
    `<p style="color:var(--text-1);margin-bottom:12px">Are you sure you want to delete <strong style="color:var(--red)">${sanitize(pump.name)}</strong>?</p>
     <p style="font-size:12px;color:var(--text-3)">This will permanently remove the pump and all its meter readings. Sales history is not affected.</p>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-sm" style="background:var(--red);color:#fff;border:none;padding:8px 18px;border-radius:var(--radius-sm);font-weight:700;cursor:pointer" onclick="deletePump(${pumpId})">🗑 Yes, Delete</button>`
  );
}

function deletePump(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;
  APP.data.pumps = APP.data.pumps.filter(p => p.id !== pumpId);
  db.delete('pumps', pumpId).catch(() => {});
  auditLog('pump_delete', { pumpId, name: pump.name });
  closeModal();
  toast(`${pump.name} deleted`, 'success');
  renderPage();
}

// ── Per-nozzle reading modal ─────────────────────────────────
function _nozzleLabels(pump) {
  return pump.nozzleLabels || (pump.nozzles === 1 ? ['A'] : pump.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, pump.nozzles));
}
function _nozzleFuelType(pump, nozzle) {
  return (pump.nozzleFuels || {})[nozzle] || pump.fuelType;
}
// Per-nozzle reading stored as pump.nozzleReadings = { A: number, B: number }
function _nozzleReading(pump, nozzle) {
  return (pump.nozzleReadings || {})[nozzle] ?? pump.currentReading ?? 0;
}

function openReadingModal(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;
  const labels = _nozzleLabels(pump);

  const nozzleRows = labels.map(n => {
    const ft   = _nozzleFuelType(pump, n);
    const fuel = getFuel(ft);
    const cur  = _nozzleReading(pump, n);
    const tank = APP.data.tanks.find(t => Number(t.fuelType === ft ? t.fuelType : null) || t.fuelType === ft);
    const tankStock = tank ? `<span style="font-size:10px;color:var(--text-3)"> · Tank: <strong style="color:var(--text-1)">${fmt(tank.current)}L</strong></span>` : '';

    return `<div style="background:var(--bg-0);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <!-- Nozzle header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="width:32px;height:32px;border-radius:50%;background:${fuel.color}22;border:2px solid ${fuel.color};display:grid;place-items:center;font-weight:900;font-size:12px;color:${fuel.color}">N${n}</div>
          <div>
            <div style="font-size:12px;font-weight:700;color:var(--text-0)">Nozzle ${n}</div>
            <div style="display:flex;align-items:center;gap:4px">
              <span style="font-size:10px;font-weight:700;color:${fuel.color};background:${fuel.color}18;padding:1px 6px;border-radius:3px">${fuel.short}</span>
              ${tankStock}
            </div>
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--text-3)">Current reading</div>
          <div style="font-size:16px;font-weight:800;color:var(--text-0);font-family:var(--mono)">${fmt(cur)}</div>
        </div>
      </div>
      <!-- New reading input -->
      <input class="form-input" type="number" step="0.1" id="nozzleReading_${n}"
        placeholder="New meter reading" value=""
        oninput="updateNozzlePreview(${pumpId},'${n}')"
        style="font-size:18px;font-weight:700;text-align:center;margin-bottom:6px" />
      <!-- Live deduct preview -->
      <div id="nozzlePreview_${n}" style="display:none;font-size:11px;padding:6px 10px;border-radius:6px;font-weight:600"></div>
    </div>`;
  }).join('');

  openModal(`⛽ Update ${pump.name} — Per Nozzle`,
    `<div style="font-size:11px;color:var(--text-3);margin-bottom:14px">Enter the new meter reading for each nozzle. Sold liters will be deducted from the corresponding fuel tank automatically.</div>
     ${nozzleRows}`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveReading(${pumpId})">💾 Save All & Sync Tanks</button>`
  );
}

function updateNozzlePreview(pumpId, nozzle) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) return;
  const cur     = _nozzleReading(pump, nozzle);
  const newVal  = parseFloat(document.getElementById(`nozzleReading_${nozzle}`)?.value);
  const preview = document.getElementById(`nozzlePreview_${nozzle}`);
  if (!preview) return;

  if (isNaN(newVal)) { preview.style.display = 'none'; return; }
  const sold = newVal - cur;
  const ft   = _nozzleFuelType(pump, nozzle);
  const fuel = getFuel(ft);
  const tank = APP.data.tanks.find(t => t.fuelType === ft);

  if (sold < 0) {
    preview.style.display = '';
    preview.style.background = 'rgba(239,68,68,0.08)';
    preview.style.color = 'var(--red)';
    preview.textContent = '⚠️ Cannot be less than current reading';
  } else if (sold === 0) {
    preview.style.display = 'none';
  } else {
    const overDraw = tank && sold > tank.current;
    preview.style.display = '';
    preview.style.background = overDraw ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)';
    preview.style.color = overDraw ? 'var(--red)' : 'var(--green)';
    preview.innerHTML = `⛽ ${fmt(sold)} L ${fuel.short} will be deducted from tank` +
      (tank ? ` (${fmt(tank.current)} L → ${fmt(Math.max(0, tank.current - sold))} L)` : '') +
      (overDraw ? ' — ⚠️ exceeds stock!' : '');
  }
}

function saveReading(pumpId) {
  const pump = APP.data.pumps.find(p => p.id === pumpId);
  if (!pump) { toast('Pump not found', 'error'); return; }
  const labels = _nozzleLabels(pump);
  const nozzleReadings = pump.nozzleReadings ? { ...pump.nozzleReadings } : {};

  let totalSold = 0;
  const deductions = {}; // fuelType -> liters
  const auditLines = [];

  for (const n of labels) {
    const inputEl = document.getElementById(`nozzleReading_${n}`);
    const rawVal  = inputEl?.value;
    if (!rawVal && rawVal !== '0') continue; // skip blanks — nozzle not updated this time

    const newReading = parseFloat(rawVal);
    const oldReading = _nozzleReading(pump, n);
    const ft         = _nozzleFuelType(pump, n);

    if (isNaN(newReading) || newReading < 0) { toast(`Nozzle ${n}: Invalid reading`, 'error'); return; }
    if (newReading < oldReading)             { toast(`Nozzle ${n}: Cannot be less than current (${fmt(oldReading)})`, 'error'); return; }
    if (newReading - oldReading > 10000)     { toast(`Nozzle ${n}: Jump >10000L — verify reading`, 'error'); return; }

    const sold = newReading - oldReading;
    nozzleReadings[n] = newReading;
    if (sold > 0) deductions[ft] = (deductions[ft] || 0) + sold;
    totalSold += sold;
    auditLines.push(`N${n}(${ft}): ${fmt(oldReading)}→${fmt(newReading)} sold ${fmt(sold)}L`);
  }

  if (!Object.keys(deductions).length && !auditLines.length) {
    toast('No readings entered', 'info'); return;
  }

  // Update pump — store per-nozzle readings + update cumulative currentReading
  // Save nozzleOpen (opening reading) if not yet set — used for sold calculation
  if (!pump.nozzleOpen) pump.nozzleOpen = {};
  labels.forEach(n => {
    if (pump.nozzleOpen[n] === undefined && nozzleReadings[n] !== undefined) {
      // First time setting this nozzle — use previous reading as open
      pump.nozzleOpen[n] = pump.nozzleReadings?.[n] ?? 0;
    }
  });
  pump.nozzleReadings  = nozzleReadings;
  pump.currentReading  = Object.values(nozzleReadings).reduce((a, v) => a + v, 0);
  db.put('pumps', pump).catch(() => {});

  // Deduct from each fuel tank
  const msgs = [];
  for (const [ft, liters] of Object.entries(deductions)) {
    const tank = APP.data.tanks.find(t => t.fuelType === ft);
    if (tank && liters > 0) {
      const before = tank.current;
      tank.current = Math.max(0, tank.current - liters);
      db.put('tanks', tank).catch(() => {});
      msgs.push(`${getFuel(ft).short}: −${fmt(liters)}L → ${fmt(tank.current)}L left`);
      if (tank.current < before * 0.15 && before > 0)
        toast(`⚠️ ${getFuel(ft).short} tank critically low: ${fmt(tank.current)} L`, 'warning');
    }
  }

  auditLog('reading_update', { pump: pump.name, pumpId, detail: auditLines.join('; '), totalSold });
  closeModal();
  toast(`✅ ${pump.name} updated — ${msgs.join(' · ')}`, 'success');
  renderPage();
}

function openPaymentModal(customerId) {
  const c = APP.data.creditCustomers.find(x => x.id === customerId);
  if (!c) return;
  openModal(`Record Payment — ${sanitize(c.name)}`, `
    <div class="dbox mb-14" style="padding:16px"><div class="dbox-label">Outstanding</div><div class="dbox-value mono" style="color:var(--red)">${cur(c.outstanding)}</div></div>
    <div class="form-group"><label class="form-label">Payment Amount (₹)</label><input class="form-input" id="payAmount" type="number" placeholder="0.00" /></div>
    <div class="form-group"><label class="form-label">Payment Mode</label><select class="form-input" id="payMode">
      <option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option><option value="neft">NEFT/RTGS</option>
    </select></div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="savePayment(${customerId})">💾 Record Payment</button>`);
}

function savePayment(customerId) {
  const amount = parseFloat(document.getElementById('payAmount').value);
  const mode = document.getElementById('payMode').value;
  if (isNaN(amount) || amount <= 0) { toast('Enter valid payment amount', 'error'); return; }
  if (amount > 1000000) { toast('Amount exceeds ₹10,00,000 limit', 'error'); return; }
  const c = APP.data.creditCustomers.find(x => x.id === customerId);
  if (!c) return;
  if (amount > c.outstanding) { toast('Payment exceeds outstanding amount ₹' + fmt(c.outstanding), 'error'); return; }
  const oldOutstanding = c.outstanding;
  c.outstanding = Math.max(0, c.outstanding - amount);
  c.lastPayment = today();
  db.put('creditCustomers', c).catch(() => {});
  auditLog('credit_payment', { customer: c.name, amount, mode, oldOutstanding, newOutstanding: c.outstanding });
  closeModal();
  toast(`Payment of ${cur(amount)} recorded for ${sanitize(c.name)}`, 'success');
  renderPage();
}

// ═══════════════════════════════════════════════════════════
// UPI PAYMENT INTEGRATION — Three methods
// 1. Razorpay SDK (auto-confirm, needs API key)
// 2. UPI Intent (mobile-only, opens GPay/PhonePe/Paytm)
// 3. UPI Payment Link (WhatsApp share)
// ═══════════════════════════════════════════════════════════

// ── Razorpay SDK loader ──
function loadRazorpaySDK() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Razorpay SDK failed to load'));
    document.head.appendChild(s);
  });
}

// ── Main UPI Payment modal (for sales) ──
function openUPIPaymentModal(amount, fuelType, liters, onSuccess) {
  const vpa   = APP.data.upiVPA  || '';
  const name  = APP.data.upiName || 'Fuel Station';
  const rzpKey = APP.data.razorpayKey || '';
  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  const upiRef = 'FB' + Date.now().toString(36).toUpperCase();
  const fuel = getFuel(fuelType);

  // Store callback for when payment is confirmed
  window._upiPayCallback = onSuccess;
  window._upiPayRef = upiRef;

  openModal('📱 UPI Payment',
    `<!-- Amount header -->
    <div style="background:linear-gradient(135deg,var(--accent),var(--accent-light));border-radius:12px;padding:18px;text-align:center;margin-bottom:18px">
      <div style="font-size:11px;font-weight:700;color:rgba(0,0,0,0.6);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Amount to Collect</div>
      <div style="font-size:36px;font-weight:900;color:#000">₹${amount.toLocaleString('en-IN', {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
      <div style="font-size:12px;color:rgba(0,0,0,0.55);margin-top:4px">${fuel.name} · ${liters ? liters.toFixed(2) + 'L' : ''}</div>
    </div>

    <!-- Payment options -->
    <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Choose Payment Method</div>

    <!-- Option 1: Razorpay -->
    ${rzpKey ? `
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px;cursor:pointer" onclick="payViaRazorpay(${amount}, '${fuelType}', ${liters||0}, '${upiRef}')">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:8px;background:#3395FF;display:grid;place-items:center;font-size:18px;flex-shrink:0">💳</div>
        <div style="flex:1">
          <div style="font-weight:700;color:var(--text-0);font-size:13px">Razorpay — UPI / Card / NetBanking</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:1px">Auto-confirmed · Customer pays on their device</div>
        </div>
        <div style="color:var(--green);font-weight:700;font-size:12px">AUTO ✓</div>
      </div>
    </div>` : `
    <div style="background:var(--bg-2);border:1px dashed var(--border);border-radius:10px;padding:14px;margin-bottom:10px;opacity:0.6">
      <div style="display:flex;align-items:center;gap:12px">
        <div style="width:40px;height:40px;border-radius:8px;background:#3395FF44;display:grid;place-items:center;font-size:18px;flex-shrink:0">💳</div>
        <div style="flex:1">
          <div style="font-weight:700;color:var(--text-0);font-size:13px">Razorpay (Not configured)</div>
          <div style="font-size:11px;color:var(--accent-light);margin-top:1px">Add Razorpay API key in Settings → UPI Settings</div>
        </div>
      </div>
    </div>`}

    <!-- Option 2: UPI Intent (mobile) -->
    ${vpa ? `
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--text-2);margin-bottom:10px">Open UPI App directly on this phone:</div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
        ${[
          ['GPay', 'https://pay.google.com/intl/en_in/about/','#4285F4','G'],
          ['PhonePe','https://www.phonepe.com/','#5F259F','P'],
          ['Paytm','https://paytm.com/','#00B9F5','P'],
          ['BHIM','https://www.bhimupi.org.in/','#00A651','B'],
        ].map(([app,,col,letter]) =>
          `<button onclick="openUPIIntent('${app}', ${amount}, '${upiRef}')"
            style="background:${col}18;border:1px solid ${col}33;border-radius:8px;padding:10px 4px;cursor:pointer;text-align:center">
            <div style="width:28px;height:28px;border-radius:50%;background:${col};color:#fff;font-weight:900;font-size:12px;display:grid;place-items:center;margin:0 auto 4px">${letter}</div>
            <div style="font-size:10px;font-weight:700;color:var(--text-1)">${app}</div>
          </button>`
        ).join('')}
      </div>
      ${isMobile ? '' : '<div style="font-size:10px;color:var(--text-3);text-align:center">⚠️ UPI app buttons work on mobile only</div>'}
    </div>` : ''}

    <!-- Option 3: QR Code -->
    ${vpa ? `
    <div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:12px">
        <div id="miniUpiQR" style="flex-shrink:0"></div>
        <div>
          <div style="font-weight:700;color:var(--text-0);font-size:12px;margin-bottom:2px">Scan QR to Pay</div>
          <div style="font-size:11px;color:var(--text-3);margin-bottom:8px">${vpa}</div>
          <button onclick="copyUPILink2()" style="background:var(--bg-0);border:1px solid var(--border);color:var(--text-1);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px">📋 Copy UPI Link</button>
          <button onclick="shareUPILink2()" style="background:var(--bg-0);border:1px solid var(--border);color:var(--text-1);border-radius:6px;padding:4px 10px;cursor:pointer;font-size:11px;margin-left:6px">📤 WhatsApp</button>
        </div>
      </div>
    </div>` : `
    <div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:12px;text-align:center;font-size:12px;color:var(--red)">
      ⚠️ Set your UPI VPA in Settings to enable QR & app payments
    </div>`}

    <!-- Manual confirm section -->
    <div style="border-top:1px solid var(--border-light);margin-top:14px;padding-top:14px">
      <div style="font-size:11px;color:var(--text-3);margin-bottom:8px;text-align:center">After customer pays — confirm and record:</div>
      <div style="display:flex;gap:8px">
        <input class="form-input" id="upiTxnId" placeholder="UTR / Transaction ID (optional)" style="flex:1;font-size:12px" />
        <button onclick="confirmUPIPayment()" class="btn btn-accent" style="white-space:nowrap">✓ Mark Paid</button>
      </div>
    </div>
    `,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`,
    480
  );

  // Generate QR after modal renders
  if (vpa) {
    setTimeout(() => {
      const qrEl = document.getElementById('miniUpiQR');
      if (qrEl) {
        window._currentUPIString = generateUPIQR(qrEl, { vpa, name, amount, note: 'Fuel-' + upiRef }, 120);
      }
    }, 150);
  }
}

function openUPIIntent(app, amount, ref) {
  const vpa   = APP.data.upiVPA  || '';
  const name  = APP.data.upiName || 'Fuel Station';
  if (!vpa) { toast('Set UPI VPA in Settings first', 'error'); return; }
  const upiStr = `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent('Fuel ' + ref)}&cu=INR`;
  // Intent URLs for specific apps
  const intents = {
    'GPay':    `tez://upi/pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent('Fuel ' + ref)}&cu=INR`,
    'PhonePe': `phonepe://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent('Fuel ' + ref)}&cu=INR`,
    'Paytm':   `paytmmp://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent('Fuel ' + ref)}&cu=INR`,
    'BHIM':    `upi://pay?pa=${encodeURIComponent(vpa)}&pn=${encodeURIComponent(name)}&am=${amount}&tn=${encodeURIComponent('Fuel ' + ref)}&cu=INR`,
  };
  window.location.href = intents[app] || upiStr;
  // Show confirmation prompt after 3 seconds
  setTimeout(() => {
    if (document.getElementById('upiTxnId')) {
      document.getElementById('upiTxnId').placeholder = 'Enter UTR from ' + app + ' notification';
      document.getElementById('upiTxnId').focus();
    }
  }, 3000);
}

function copyUPILink2() {
  const str = window._currentUPIString || '';
  if (!str) return;
  navigator.clipboard.writeText(str).then(() => toast('UPI link copied!', 'success'));
}

function shareUPILink2() {
  const str = window._currentUPIString || '';
  const amount = str.match(/am=([^&]+)/)?.[1] || '';
  const text = `💰 Please pay ₹${amount} for fuel

${str}`;
  if (navigator.share) {
    navigator.share({ title: 'UPI Payment Request', text }).catch(() => {});
  } else {
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(wa, '_blank');
  }
}

function confirmUPIPayment() {
  const txnId = (document.getElementById('upiTxnId')?.value || '').trim();
  if (window._upiPayCallback) {
    window._upiPayCallback(txnId || null);
    window._upiPayCallback = null;
  }
  closeModal();
}

// ── Razorpay Integration ──
async function payViaRazorpay(amount, fuelType, liters, ref) {
  const key = APP.data.razorpayKey || '';
  if (!key) { toast('Add Razorpay Key ID in Settings', 'error'); return; }
  try {
    await loadRazorpaySDK();
  } catch(e) {
    toast('Could not load Razorpay. Check internet.', 'error'); return;
  }
  const rzp = new window.Razorpay({
    key,
    amount: Math.round(amount * 100), // paise
    currency: 'INR',
    name: APP.data.upiName || APP.tenant?.name || 'Fuel Station',
    description: `${getFuel(fuelType).name}${liters ? ' · ' + liters.toFixed(2) + 'L' : ''}`,
    notes: { ref, fuelType, liters },
    method: { upi: true, card: true, netbanking: true, wallet: false },
    prefill: { method: 'upi' },
    theme: { color: '#d4940f' },
    handler: function(response) {
      // Payment confirmed by Razorpay
      const txnId = response.razorpay_payment_id;
      toast(`✅ Payment confirmed! ID: ${txnId}`, 'success');
      if (window._upiPayCallback) {
        window._upiPayCallback(txnId);
        window._upiPayCallback = null;
      }
      closeModal();
    },
    modal: {
      ondismiss: function() {
        toast('Payment cancelled', 'info');
      }
    }
  });
  rzp.open();
}

// ── Hook into sale recording ──
// Called from the main sale modal when mode === 'upi'
function recordSaleWithUPI(saleData) {
  openUPIPaymentModal(saleData.amount, saleData.fuelType, saleData.liters, (txnId) => {
    saleData.upiTxnId = txnId;
    saleData.mode = 'upi';
    // Save the sale
    APP.data.sales.unshift(saleData);
    db.add('sales', saleData).catch(() => {});
    const tank = APP.data.tanks.find(t => t.fuelType === saleData.fuelType);
    if (tank && saleData.liters) { tank.current = Math.max(0, tank.current - saleData.liters); db.put('tanks', tank).catch(() => {}); }
    auditLog('sale_add', { ...saleData, note: 'UPI payment' + (txnId ? ' UTR:' + txnId : '') });
    toast(`Sale ₹${saleData.amount.toLocaleString('en-IN')} recorded via UPI`, 'success');
    renderPage();
  });
}

function openUPIModal(customerName, amount) {
  openModal('UPI Payment Request', `
    <div class="text-center" style="padding:20px 0">
      <div id="upiQR"></div>
    </div>
    <div class="text-center" style="margin-top:12px">
      <button class="btn btn-ghost" onclick="copyUPILink()">📋 Copy UPI Link</button>
      <button class="btn btn-ghost" style="margin-left:8px" onclick="shareUPILink()">📤 Share</button>
    </div>
  `, '', 400);
  setTimeout(() => {
    const container = document.getElementById('upiQR');
    if (container) {
      generateUPIQR(container, {
        vpa: APP.data.upiVPA || '',
        name: APP.data.upiName || APP.tenant?.name || 'Fuel Station',
        amount: amount,
        note: `Payment from ${customerName}`
      });
    }
  }, 100);
}

function copyUPILink() {
  const el = document.getElementById('upiQR');
  if (el && el.dataset.upiString) {
    navigator.clipboard.writeText(el.dataset.upiString).then(() => toast('UPI link copied', 'success'));
  }
}

function shareUPILink() {
  const el = document.getElementById('upiQR');
  if (el && el.dataset.upiString) shareData('UPI Payment', el.dataset.upiString);
}

function openPriceModal() {
  const fields = FUEL_TYPES.map(f => `
    <div class="form-group">
      <label class="form-label" style="display:flex;align-items:center;gap:8px">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${f.color}"></span>
        ${f.name}
      </label>
      <input class="form-input" id="price_${f.id}" type="number" inputmode="decimal" step="0.01" value="${APP.data.prices[f.id]}"
        style="font-family:var(--mono);font-size:22px;font-weight:700;text-align:center;padding:16px;color:${f.color}" />
    </div>`).join('');
  openModal('Update Selling Prices', fields,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="savePrices()">&#128190; Update</button>`);
}

function savePrices() {
  const changes = [];
  let valid = true;
  FUEL_TYPES.forEach(f => {
    const el = document.getElementById('price_' + f.id);
    if (!el) return;
    const newSell = parseFloat(el.value);
    if (isNaN(newSell) || newSell <= 0 || newSell > 500) { toast('Invalid price for ' + f.short + ': must be ₹0.01–500', 'error'); valid = false; return; }
    if (newSell !== APP.data.prices[f.id]) {
      changes.push({ fuel: f.short, oldSell: APP.data.prices[f.id], newSell });
    }
    APP.data.prices[f.id] = newSell;
  });
  if (!valid) return;
  db.setSetting('prices', APP.data.prices);
  if (changes.length > 0) auditLog('price_change', { changes });
  closeModal();
  toast('Fuel prices updated', 'success');
  renderPage();
}

function openPurchasePriceModal() {
  const fields = FUEL_TYPES.map(f => `
    <div class="form-group">
      <label class="form-label">${f.name} — Purchase Price (&#8377;/L)</label>
      <input class="form-input" id="pprice_${f.id}" type="number" inputmode="decimal" step="0.01" value="${APP.data.purchasePrices[f.id]}"
        style="font-family:var(--mono);font-size:18px;font-weight:700;text-align:center;padding:12px" />
    </div>`).join('');
  openModal('Update Purchase Prices', fields,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="savePurchasePrices()">&#128190; Update</button>`);
}

function savePurchasePrices() {
  FUEL_TYPES.forEach(f => {
    const el = document.getElementById('pprice_' + f.id);
    if (!el) return;
    const val = parseFloat(el.value);
    if (!isNaN(val) && val > 0 && val <= 300) APP.data.purchasePrices[f.id] = val;
  });
  db.setSetting('purchasePrices', APP.data.purchasePrices);
  closeModal();
  toast('Purchase prices updated', 'success');
  renderPage();
}

function saveUPISettings() {
  const vpa  = (document.getElementById('upiVPA')?.value || '').trim();
  const name = (document.getElementById('upiName')?.value || '').trim();
  const rzpKey = (document.getElementById('rzpKey')?.value || '').trim();
  const stationCode = (document.getElementById('stationCode')?.value || '').trim();
  const omcName = (document.getElementById('omcName')?.value || '').trim();
  APP.data.upiVPA  = sanitize(vpa);
  APP.data.upiName = sanitize(name);
  APP.data.stationCode = sanitize(stationCode);
  APP.data.omcName = sanitize(omcName);
  APP.data.razorpayKey = rzpKey;
  db.setSetting('upiVPA', APP.data.upiVPA);
  db.setSetting('upiName', APP.data.upiName);
  db.setSetting('stationCode', APP.data.stationCode);
  db.setSetting('omcName', APP.data.omcName);
  db.setSetting('razorpayKey', rzpKey);
  const preview = document.getElementById('upiQRPreview');
  if (preview && vpa) generateUPIQR(preview, { vpa: APP.data.upiVPA, name: APP.data.upiName });
  auditLog('settings_change', { upiVPA: vpa ? '***' : 'cleared', upiName: name, razorpay: rzpKey ? 'set' : 'cleared' });
  toast('UPI settings saved', 'success');
  renderPage();
}

function enableNotifications() {
  requestNotificationPermission().then(ok => {
    if (ok) { toast('Notifications enabled!', 'success'); checkTankAlerts(APP.data.tanks); checkCreditAlerts(APP.data.creditCustomers); }
    else toast('Notifications denied', 'warning');
  });
}

// ── ALLOCATION ACTIONS ────────────────────────────────────────
function assignNozzle(pumpId, nozzle, empIdStr) {
  const empId = parseInt(empIdStr);
  if (!allocations[allocShift]) allocations[allocShift] = {};
  if (empId) {
    allocations[allocShift][`${pumpId}_${nozzle}`] = empId;
    const emp = APP.data.employees.find(e => e.id === empId);
    const pump = APP.data.pumps.find(p => p.id === pumpId);
    toast(`${emp?.name} → ${pump?.name} Nozzle ${nozzle}`, 'success');
  } else {
    delete allocations[allocShift][`${pumpId}_${nozzle}`];
  }
  saveAllocations();
  renderPage();
}

function removeAlloc(pumpId, nozzle) {
  if (allocations[allocShift]) delete allocations[allocShift][`${pumpId}_${nozzle}`];
  saveAllocations();
  toast('Assignment removed', 'info');
  renderPage();
}

function openChangeAllocModal(pumpId, nozzle) {
  const D = APP.data;
  const key = `${pumpId}_${nozzle}`;
  const currentEmpId = allocations[allocShift]?.[key];
  const pump = D.pumps.find(p => p.id === pumpId);
  const shiftEmps = D.employees.filter(e => (e.shift||'').split(',').map(s=>s.trim()).includes(allocShift));

  const empItems = shiftEmps.map(e => {
    const isCurrent = e.id === currentEmpId;
    // Count how many nozzles this employee already has
    const nozzleCount = Object.values(allocations[allocShift] || {}).filter(id => id === e.id).length;
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:${isCurrent ? 'rgba(34,197,94,0.06)' : 'var(--bg-0)'};border:1px solid ${isCurrent ? 'rgba(34,197,94,0.25)' : 'var(--border-light)'};border-radius:var(--radius-sm);cursor:pointer;margin-bottom:6px;transition:border-color 0.15s" onclick="assignNozzle(${pumpId},'${nozzle}','${e.id}');closeModal();" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='${isCurrent ? 'rgba(34,197,94,0.25)' : 'var(--border-light)'}'">
      <span style="width:30px;height:30px;border-radius:8px;background:${empColor(e)};display:grid;place-items:center;color:#fff;font-size:10px;font-weight:800;flex-shrink:0">${empInitials(e.name)}</span>
      <div style="flex:1"><div class="fw-700" style="color:var(--text-0);font-size:13px">${e.name}</div><div style="font-size:10px;color:var(--text-3)">${e.role} · ${nozzleCount} nozzle${nozzleCount !== 1 ? 's' : ''}</div></div>
      ${isCurrent ? '<span class="badge badge-green">Current</span>' : ''}
    </div>`;
  }).join('');

  openModal(`Assign ${pump?.name} · Nozzle ${nozzle}`, `
    <p style="font-size:13px;color:var(--text-2);margin-bottom:14px">Select an employee for <strong style="color:var(--text-0)">${pump?.name} — Nozzle ${nozzle}</strong> during <strong style="color:var(--accent-light)">${allocShift}</strong> shift</p>
    ${empItems}
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
}

function autoAssignAlloc() {
  const D = APP.data;
  const shiftEmps = D.employees.filter(e => (e.shift||'').split(',').map(s=>s.trim()).includes(allocShift));
  if (shiftEmps.length === 0) { toast('No employees in ' + allocShift + ' shift', 'error'); return; }

  if (!allocations[allocShift]) allocations[allocShift] = {};
  let idx = 0;
  D.pumps.forEach(p => {
    const nLabels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : ['A','B']);
    nLabels.forEach(n => {
      allocations[allocShift][`${p.id}_${n}`] = shiftEmps[idx % shiftEmps.length].id;
      idx++;
    });
  });
  saveAllocations();
  toast(`Auto-assigned ${idx} nozzles across ${shiftEmps.length} employees`, 'success');
  renderPage();
}

function clearShiftAllocConfirm() {
  openModal('Clear Allocations', `
    <p style="color:var(--red);font-weight:600;margin-bottom:8px">This will remove all nozzle assignments for the <strong>${allocShift}</strong> shift.</p>
    <p style="color:var(--text-2);font-size:13px">Are you sure you want to proceed?</p>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn" style="background:var(--red);color:#fff" onclick="doClearAlloc()">Yes, Clear All</button>`);
}

function doClearAlloc() {
  allocations[allocShift] = {};
  saveAllocations();
  closeModal();
  toast('All allocations cleared for ' + allocShift, 'info');
  renderPage();
}

function copyAllocModal() {
  const D = APP.data;
  const otherShifts = D.shifts.filter(s => s.name !== allocShift);
  const opts = otherShifts.map(s =>
    `<div style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--bg-0);border:1px solid var(--border-light);border-radius:var(--radius-sm);cursor:pointer;margin-bottom:8px;transition:border-color 0.15s" onclick="doCopyAlloc('${s.name}');closeModal()" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border-light)'">
      <div style="font-size:18px">📋</div>
      <div><div class="fw-700" style="color:var(--text-0)">${s.name} Shift</div><div style="font-size:11px;color:var(--text-3)">${s.start} – ${s.end}</div></div>
    </div>`
  ).join('');

  openModal('Copy Allocation Structure', `
    <p style="font-size:13px;color:var(--text-2);margin-bottom:14px">Copy the pump/nozzle layout from <strong style="color:var(--accent-light)">${allocShift}</strong> to another shift. Employees will be mapped round-robin to the target shift's staff.</p>
    ${opts}
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>`);
}

function doCopyAlloc(targetShiftName) {
  const D = APP.data;
  const sourceAlloc = allocations[allocShift] || {};
  const targetEmps = D.employees.filter(e => e.shift === targetShiftName);

  if (targetEmps.length === 0) { toast('No employees in ' + targetShiftName + ' shift', 'error'); return; }

  allocations[targetShiftName] = {};
  let idx = 0;
  Object.keys(sourceAlloc).forEach(key => {
    allocations[targetShiftName][key] = targetEmps[idx % targetEmps.length].id;
    idx++;
  });
  saveAllocations();
  toast(`Copied allocation to ${targetShiftName} shift (${idx} nozzles)`, 'success');
}

// Optional permissions definition
const EMP_OPTIONAL_PERMISSIONS = [
  { id: 'dip',      label: 'Dip Reading',       desc: 'Record physical tank dip measurements', icon: '📏' },
  { id: 'prices',   label: 'View Fuel Prices',   desc: 'See current fuel prices while working', icon: '💰' },
  { id: 'credit',   label: 'Credit Sales',        desc: 'Allow credit/account sales recording', icon: '📋' },
  { id: 'print',    label: 'Print / Share Report',desc: 'Print or WhatsApp share their shift report', icon: '🖨️' },
  { id: 'expense',  label: 'Log Expenses',        desc: 'Record petty cash & daily expenses', icon: '🧾' },
];

function empFormHTML(shiftOpts, vals) {
  const perms = vals.permissions || {};
  const permBoxes = EMP_OPTIONAL_PERMISSIONS.map(p => {
    const checked = !!perms[p.id]; // truthy check (handles true, "true", 1)
    return `<label style="display:flex;align-items:flex-start;gap:10px;padding:9px 12px;background:var(--bg-0);border:1px solid ${checked?'rgba(212,148,15,0.4)':'var(--border)'};border-radius:8px;cursor:pointer;transition:border 0.15s" onclick="event.stopPropagation()">
      <input type="checkbox" id="perm_${p.id}" ${checked?'checked':''} onchange="this.closest('label').style.borderColor=this.checked?'rgba(212,148,15,0.4)':'var(--border)'"
        style="margin-top:2px;width:16px;height:16px;accent-color:var(--accent);cursor:pointer;flex-shrink:0" />
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--text-0)">${p.icon} ${p.label}</div>
        <div style="font-size:10px;color:var(--text-3);margin-top:1px">${p.desc}</div>
      </div>
    </label>`;
  }).join('');

  return `
    <div class="form-group"><label class="form-label">Full Name *</label><input class="form-input" id="empName" placeholder="Enter full name" value="${vals.name||''}" /></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Role</label>
        <select class="form-input" id="empRole">
          <option ${vals.role==='Attendant'?'selected':''}>Attendant</option>
          <option ${vals.role==='Shift Manager'?'selected':''}>Shift Manager</option>
        </select>
      </div>
      <div class="form-group"><label class="form-label">Shift <span style="font-size:9px;color:var(--text-3);font-weight:400">(Ctrl/Cmd+click for multiple)</span></label>
        <select class="form-input" id="empShift" multiple size="3" style="height:auto;padding:4px">${shiftOpts}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="empPhone" placeholder="10-digit mobile" value="${vals.phone||''}" /></div>
      <div class="form-group"><label class="form-label">Monthly Salary (₹)</label><input class="form-input" id="empSalary" type="number" value="${vals.salary||12000}" /></div>
    </div>
    <div style="margin-top:4px">
      <div style="font-size:11px;font-weight:700;color:var(--text-2);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">
        🔐 Portal Permissions
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-bottom:10px;padding:6px 10px;background:var(--bg-0);border-radius:6px;border:1px solid var(--border)">
        ✅ Always ON for all staff: <strong style="color:var(--text-1)">Overview · Readings · Sales · History</strong>
      </div>
      <div style="font-size:10px;color:var(--text-3);margin-bottom:8px;font-weight:600">
        ☑️ Check to GRANT optional access — uncheck to REVOKE:
      </div>
      <div style="display:grid;gap:6px">${permBoxes}</div>
    </div>`;
}

function openEmployeeModal() {
  const D = APP.data;
  const shiftOpts = D.shifts.map(s => `<option value="${s.name}">${s.name} (${s.start}–${s.end})</option>`).join('');
  openModal('➕ Add Employee', empFormHTML(shiftOpts, {}),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="addEmployee()">💾 Save Employee</button>`);
}

function readEmpPermissions() {
  const perms = {};
  EMP_OPTIONAL_PERMISSIONS.forEach(p => {
    perms[p.id] = !!(document.getElementById('perm_' + p.id)?.checked);
  });
  return perms;
}

function addEmployee() {
  const name = document.getElementById('empName')?.value?.trim();
  const role = document.getElementById('empRole')?.value;
  const shiftEl = document.getElementById('empShift');
  const shift = shiftEl
    ? Array.from(shiftEl.selectedOptions).map(o => o.value).join(',')
    : '';
  const phone = document.getElementById('empPhone')?.value?.trim();
  const salary = parseInt(document.getElementById('empSalary')?.value) || 12000;
  if (!name || name.length < 2) { toast('Enter a valid employee name', 'error'); return; }
  const permissions = readEmpPermissions();
  const newEmp = {
    id: Date.now(), name, role, shift, phone: phone || '', salary,
    permissions,
    color: EMP_COLORS[APP.data.employees.length % EMP_COLORS.length]
  };
  APP.data.employees.push(newEmp);
  db.add('employees', newEmp).catch(() => {});
  closeModal();
  const granted = Object.entries(permissions).filter(([,v])=>v).map(([k])=>EMP_OPTIONAL_PERMISSIONS.find(p=>p.id===k)?.label).filter(Boolean);
  toast(`${name} added · ${granted.length ? granted.join(', ') : 'No extra permissions'}`, 'success');
  renderPage();
}

function openEditEmployeeModal(empId) {
  const D = APP.data;
  const e = D.employees.find(x => x.id === empId);
  if (!e) { toast('Employee not found', 'error'); return; }
  const empShifts = (e.shift || '').split(',').map(s => s.trim()).filter(Boolean);
  const shiftOpts = D.shifts.map(s =>
    `<option value="${s.name}" ${empShifts.includes(s.name)?'selected':''}>${s.name} (${s.start}–${s.end})</option>`
  ).join('');
  openModal('✏️ Edit Employee',
    `<input type="hidden" id="editEmpId" value="${empId}" />` + empFormHTML(shiftOpts, e),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="saveEditEmployee()">💾 Save Changes</button>`
  );
}

function saveEditEmployee() {
  const empId = parseInt(document.getElementById('editEmpId')?.value);
  const name = document.getElementById('empName')?.value?.trim();
  const role = document.getElementById('empRole')?.value;
  const phone = document.getElementById('empPhone')?.value?.trim();
  const salary = parseInt(document.getElementById('empSalary')?.value) || 12000;
  if (!name || name.length < 2) { toast('Enter a valid name', 'error'); return; }
  const D = APP.data;
  const idx = D.employees.findIndex(x => x.id === empId);
  if (idx === -1) { toast('Employee not found', 'error'); return; }
  const permissions = readEmpPermissions();
  const oldEmp = D.employees[idx];
  const oldName = oldEmp.name;
  const oldShift = oldEmp.shift;

  // Collect selected shifts from multi-select
  const shiftEl = document.getElementById('empShift');
  const selectedShifts = shiftEl
    ? Array.from(shiftEl.selectedOptions).map(o => o.value)
    : (oldShift ? [oldShift] : []);
  const newShift = selectedShifts.join(',');

  D.employees[idx] = { ...oldEmp, name, role, shift: newShift, phone: phone||'', salary, permissions };
  db.put('employees', D.employees[idx]).catch(() => {});

  // FIX 4: propagate name change everywhere
  if (oldName !== name) {
    // Update sales records
    if (D.sales) D.sales.forEach(s => { if (s.employee === oldName) s.employee = name; });
    // Update audit log
    if (APP.auditLog) APP.auditLog.forEach(a => { if (a.user === oldName) a.user = name; if (a.details?.employee === oldName) a.details.employee = name; });
    // Update shift manager names
    if (D.shifts) D.shifts.forEach(s => {
      if (s.manager === oldName) { s.manager = name; db.put('shifts', s).catch(()=>{}); }
    });
  }

  // FIX 7: if shift changed, de-allocate that employee from all nozzles
  if (oldShift !== newShift) {
    let deallocs = 0;
    Object.keys(allocations).forEach(shiftName => {
      const shiftObj = allocations[shiftName];
      Object.keys(shiftObj).forEach(nozzleKey => {
        if (shiftObj[nozzleKey] === oldEmp.id) {
          delete shiftObj[nozzleKey];
          deallocs++;
        }
      });
    });
    saveAllocations();
    if (deallocs > 0) {
      toast(`${name} moved to ${newShift} shift — ${deallocs} nozzle allocation${deallocs>1?'s':''} cleared. Please re-assign.`, 'warning');
    } else {
      toast(`${name} updated — shift changed to ${newShift}`, 'success');
    }
  } else {
    toast(`${name} updated`, 'success');
  }

  closeModal();
  renderPage();
}

function openSetPINModal(empId) {
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp) { toast('Employee not found', 'error'); return; }
  const hasPIN = !!getEmpPinHash(empId);
  openModal(`🔑 Set PIN — ${sanitize(emp.name)}`,
    `<div style="margin-bottom:12px;padding:12px;background:var(--bg-0);border-radius:var(--radius-sm);border:1px solid var(--border-light);font-size:12px;color:var(--text-2)">
      ${hasPIN ? '🔄 <strong style="color:var(--accent-light)">A PIN is already set.</strong> Enter a new PIN below to change it.' : '⚠️ <strong style="color:var(--orange)">No PIN set yet.</strong> This employee cannot log in until a PIN is assigned.'}
    </div>
    <div class="form-group"><label class="form-label">New 4-Digit PIN *</label>
      <input class="form-input mono" id="newPIN" type="password" inputmode="numeric" maxlength="4" placeholder="••••" style="font-size:24px;letter-spacing:8px;text-align:center" />
    </div>
    <div class="form-group"><label class="form-label">Confirm PIN *</label>
      <input class="form-input mono" id="confirmPIN" type="password" inputmode="numeric" maxlength="4" placeholder="••••" style="font-size:24px;letter-spacing:8px;text-align:center" />
    </div>
    <input type="hidden" id="setPINEmpId" value="${empId}" />`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="saveEmployeePIN()">🔑 Set PIN</button>`
  );
}

async function saveEmployeePIN() {
  const empId = parseInt(document.getElementById('setPINEmpId')?.value);
  const pin = document.getElementById('newPIN')?.value?.trim();
  const confirm = document.getElementById('confirmPIN')?.value?.trim();
  if (!pin || pin.length !== 4 || !/^\d{4}$/.test(pin)) { toast('PIN must be exactly 4 digits', 'error'); return; }
  if (pin !== confirm) { toast('PINs do not match', 'error'); return; }
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp) { toast('Employee not found', 'error'); return; }
  try {
    const hash = await sha256(pin);
    const pins = loadEmpPins();
    pins[empId] = hash;
    saveEmpPins(pins);
    closeModal();
    toast(`PIN set for ${emp.name}`, 'success');
    renderPage();
  } catch(err) {
    toast('Failed to set PIN', 'error');
  }
}

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function confirmDeleteEmployee(empId) {
  const emp = APP.data.employees.find(e => e.id === empId);
  if (!emp) return;
  openModal('🗑 Delete Employee',
    `<div style="text-align:center;padding:20px 0">
      <div style="font-size:40px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-0);margin-bottom:8px">Delete ${sanitize(emp.name)}?</div>
      <div style="font-size:13px;color:var(--text-2)">This will permanently remove the employee and their login PIN. This cannot be undone.</div>
    </div>
    <input type="hidden" id="deleteEmpId" value="${empId}" />`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-red" onclick="deleteEmployee()">🗑 Yes, Delete</button>`
  );
}

function deleteEmployee() {
  const empId = parseInt(document.getElementById('deleteEmpId')?.value);
  const D = APP.data;
  const emp = D.employees.find(e => e.id === empId);
  if (!emp) return;
  const name = emp.name;
  D.employees = D.employees.filter(e => e.id !== empId);
  db.delete('employees', empId).catch(() => {});
  // Remove their PIN
  const pins = loadEmpPins();
  delete pins[empId];
  saveEmpPins(pins);
  closeModal();
  toast(`${name} removed`, 'success');
  renderPage();
}

// ═══════════════════════════════════════════════════════════════
// SHIFT MANAGEMENT — Add / Edit / Delete
// ═══════════════════════════════════════════════════════════════

function shiftFormHTML(vals) {
  const D = APP.data;
  // Store manager as employee ID for live name resolution
  const managerOpts = D.employees
    .filter(e => e.role === 'Shift Manager')
    .map(e => `<option value="${e.id}" ${(vals.managerId===e.id || vals.manager===e.name)?'selected':''}>${sanitize(e.name)}</option>`)
    .join('');
  return `
    <div class="form-group"><label class="form-label">Shift Name *</label>
      <input class="form-input" id="shiftName" placeholder="e.g. Morning" value="${vals.name||''}" />
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Start Time *</label>
        <input class="form-input" id="shiftStart" type="time" value="${vals.start||'06:00'}" />
      </div>
      <div class="form-group"><label class="form-label">End Time *</label>
        <input class="form-input" id="shiftEnd" type="time" value="${vals.end||'14:00'}" />
      </div>
    </div>
    <div class="form-group"><label class="form-label">Shift Manager</label>
      <select class="form-input" id="shiftManager">
        <option value="">— None —</option>
        ${managerOpts}
      </select>
    </div>`;
}

function openAddShiftModal() {
  openModal('➕ Add Shift', shiftFormHTML({}),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveNewShift()">💾 Save Shift</button>`);
}

function saveNewShift() {
  const D = APP.data;
  const name    = document.getElementById('shiftName')?.value?.trim();
  const start   = document.getElementById('shiftStart')?.value;
  const end     = document.getElementById('shiftEnd')?.value;
  const managerRaw = document.getElementById('shiftManager')?.value || '';
  const managerId = parseInt(managerRaw) || null;
  const managerEmp = managerId ? D.employees.find(e => e.id === managerId) : null;
  const manager = managerEmp ? managerEmp.name : (managerRaw || '');
  if (!name || name.length < 2) { toast('Enter a shift name', 'error'); return; }
  if (!start || !end)            { toast('Enter start and end times', 'error'); return; }
  if (D.shifts.find(s => s.name.toLowerCase() === name.toLowerCase())) {
    toast('A shift with this name already exists', 'error'); return;
  }
  const newShift = { id: 'shift_' + Date.now(), name, start, end, manager, managerId: managerId || null };
  D.shifts.push(newShift);
  db.put('shifts', newShift).catch(() => {});
  closeModal();
  toast(`${name} shift added`, 'success');
  renderPage();
}

function openEditShiftModal(shiftId) {
  const D = APP.data;
  const s = D.shifts.find(x => String(x.id) === String(shiftId));
  if (!s) { toast('Shift not found', 'error'); return; }
  openModal(`✏️ Edit — ${sanitize(s.name)} Shift`,
    `<input type="hidden" id="editShiftId" value="${shiftId}" />` + shiftFormHTML(s),
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveEditShift()">💾 Save Changes</button>`);
}

function saveEditShift() {
  const shiftId = document.getElementById('editShiftId')?.value;
  const name    = document.getElementById('shiftName')?.value?.trim();
  const start   = document.getElementById('shiftStart')?.value;
  const end     = document.getElementById('shiftEnd')?.value;
  const managerRaw = document.getElementById('shiftManager')?.value || '';
  const managerId = parseInt(managerRaw) || null;
  const managerEmp = managerId ? D.employees.find(e => e.id === managerId) : null;
  const manager = managerEmp ? managerEmp.name : (managerRaw || '');
  if (!name || name.length < 2) { toast('Enter a shift name', 'error'); return; }
  if (!start || !end)            { toast('Enter start and end times', 'error'); return; }
  const D = APP.data;
  const idx = D.shifts.findIndex(x => String(x.id) === String(shiftId));
  if (idx === -1) { toast('Shift not found', 'error'); return; }
  const oldName = D.shifts[idx].name;
  D.shifts[idx] = { ...D.shifts[idx], name, start, end, manager };
  // Update employees who were assigned to old shift name
  if (oldName !== name) {
    D.employees.forEach(e => { if (e.shift === oldName) e.shift = name; });
    db.bulkPut('employees', D.employees).catch(() => {});
  }
  db.put('shifts', D.shifts[idx]).catch(() => {});
  closeModal();
  toast(`${name} shift updated`, 'success');
  renderPage();
}

function confirmDeleteShift(shiftId) {
  const D = APP.data;
  const s = D.shifts.find(x => String(x.id) === String(shiftId));
  if (!s) return;
  const affectedEmps = D.employees.filter(e => e.shift === s.name).length;
  openModal('🗑 Delete Shift',
    `<div style="text-align:center;padding:20px 0">
      <div style="font-size:40px;margin-bottom:12px">⚠️</div>
      <div style="font-size:16px;font-weight:700;color:var(--text-0);margin-bottom:8px">Delete "${sanitize(s.name)}" Shift?</div>
      <div style="font-size:13px;color:var(--text-2);margin-bottom:10px">This cannot be undone.</div>
      ${affectedEmps > 0 ? `<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm);padding:10px 14px;font-size:12px;color:var(--red);font-weight:600">⚠ ${affectedEmps} employee${affectedEmps>1?'s are':' is'} assigned to this shift. They will be unassigned.</div>` : ''}
    </div>
    <input type="hidden" id="deleteShiftId" value="${shiftId}" />`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-red" onclick="deleteShift()">🗑 Yes, Delete</button>`);
}

function deleteShift() {
  const shiftId = document.getElementById('deleteShiftId')?.value;
  const D = APP.data;
  const s = D.shifts.find(x => String(x.id) === String(shiftId));
  if (!s) return;
  const name = s.name;
  D.shifts = D.shifts.filter(x => String(x.id) !== String(shiftId));
  // Unassign employees from deleted shift
  D.employees.forEach(e => { if (e.shift === name) e.shift = ''; });
  db.bulkPut('employees', D.employees).catch(() => {});
  db.delete('shifts', shiftId).catch(() => {});
  closeModal();
  toast(`${name} shift deleted`, 'success');
  renderPage();
}

// ── Switch station — logout and go back to tenant selector ──
function mt_switchStation() {
  // Confirm if there are unsaved changes
  if (APP.loggedIn) {
    openModal('🏪 Switch Station',
      `<div style="text-align:center;padding:16px 0">
        <div style="font-size:36px;margin-bottom:12px">🏪</div>
        <div style="font-size:15px;font-weight:700;color:var(--text-0);margin-bottom:8px">Switch to a different station?</div>
        <div style="font-size:13px;color:var(--text-2)">You'll be logged out of the current session.</div>
      </div>`,
      `<button class="btn btn-ghost" onclick="closeModal()">Stay Here</button>
       <button class="btn btn-accent" onclick="mt_doSwitchStation()">🏪 Switch Station</button>`
    );
  } else {
    mt_doSwitchStation();
  }
}

function mt_doSwitchStation() {
  // Clear current session but keep tenant registry
  try { localStorage.removeItem('fb_session'); } catch {}
  try { localStorage.removeItem('fb_emp_session'); } catch {}
  mt_clearActiveTenant();
  closeModal();
  location.reload();
}


// ═══════════════════════════════════════════════════════════════
// EMPLOYEE PORTAL MODULE (embedded inside management portal)
// All functions prefixed with emp_ to avoid conflicts
// ═══════════════════════════════════════════════════════════════

// EMP_PUMPS — built dynamically from admin pump data (includes per-nozzle fuel types)
function getEmpPumps() {
  const adminPumps = APP.data?.pumps || [];
  if (!adminPumps.length) {
    // Fallback for fresh installs
    return [
      { id: 1, name: 'PUMP 01', fuelType: 'petrol', nozzles: ['A','B'], nozzleFuels: {A:'petrol',B:'petrol'} },
      { id: 2, name: 'PUMP 02', fuelType: 'petrol', nozzles: ['A','B'], nozzleFuels: {A:'petrol',B:'petrol'} },
      { id: 3, name: 'PUMP 03', fuelType: 'diesel', nozzles: ['A','B'], nozzleFuels: {A:'diesel',B:'diesel'} },
      { id: 4, name: 'PUMP 04', fuelType: 'diesel', nozzles: ['A','B'], nozzleFuels: {A:'diesel',B:'diesel'} },
      { id: 5, name: 'PUMP 05', fuelType: 'premium_petrol', nozzles: ['A'], nozzleFuels: {A:'premium_petrol'} },
    ];
  }
  return adminPumps.filter(p => p.status !== 'inactive').map(p => {
    const labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
    const nf = p.nozzleFuels || {};
    const nozzleFuels = {};
    labels.forEach(n => { nozzleFuels[n] = nf[n] || p.fuelType; });
    return { id: p.id, name: p.name, fuelType: p.fuelType, nozzles: labels, nozzleFuels };
  });
}
// Getter — always fresh from admin data
Object.defineProperty(window, 'EMP_PUMPS', { get: () => getEmpPumps(), configurable: true });

const EMP_FUEL = {
  petrol: 'PETROL (MS)', diesel: 'DIESEL (HSD)',
  premium_petrol: 'XP95 PREMIUM', premium: 'XP95 PREMIUM'
};
const EMP_PRICES_MAP = () => APP.data?.prices || { petrol: 102.86, diesel: 88.62, premium_petrol: 112.50 };
const EMP_PRICES = new Proxy({}, { get: (_, k) => (APP.data?.prices || {})[k] || 0 });

// ── DYNAMIC EMP_LIST — synced with IndexedDB employees ──────
// Default hashes for initial seed employees (PIN = 1001-1007)
const DEFAULT_EMP_PINS = {
  1: 'fe675fe7aaee830b6fed09b64e034f84dcbdaeb429d9cccd4ebb90e15af8dd71',
  2: 'b281bc2c616cb3c3a097215fdc9397ae87e6e06b156cc34e656be7a1a9ce8839',
  3: '8c9a013ab70c0434313e3e881c310b9ff24aff1075255ceede3f2c239c231623',
  4: '75992a5ac67ff644d3063976c2effd10bdd93fcc109798e3d5c1acf2e530d01a',
  5: '7f861bcee185de001377d79e08af62e94b1e7718e2470e08520c917f8d953602',
  6: '478c4ffb1cbcea37956a748e6c19d8eadd0a47e86f5e308d26cad39453b5d1ab',
  7: '2c8b871e52d4e5f5db5ff84a82a45327e20df77edef961c4b6fa0e9c3d97ce5b',
};

function loadEmpPins() {
  try { return JSON.parse(localStorage.getItem('fb_emp_pins') || '{}'); } catch { return {}; }
}
function saveEmpPins(pins) {
  try { localStorage.setItem('fb_emp_pins', JSON.stringify(pins)); } catch {}
}
function getEmpPinHash(empId) {
  const saved = loadEmpPins();
  return saved[empId] || DEFAULT_EMP_PINS[empId] || null;
}

// Build EMP_LIST dynamically from APP.data.employees + stored pins
function getEmpList() {
  const emps = APP.data?.employees || [];
  return emps.map(e => ({
    id: e.id,
    name: e.name,
    role: e.role,
    shift: e.shift,
    permissions: e.permissions || {},
    pinHash: getEmpPinHash(e.id),
  })).filter(e => e.pinHash); // only employees with a PIN set
}

// EMP_LIST — always reads live from APP.data (reflects admin edits immediately)
Object.defineProperty(window, 'EMP_LIST', {
  get: () => getEmpList(),
  configurable: true
});
const EMP_SHIFTS = [
  { id: 'morning', name: 'Morning', time: '06:00 – 14:00' },
  { id: 'afternoon', name: 'Afternoon', time: '14:00 – 22:00' },
  { id: 'night', name: 'Night', time: '22:00 – 06:00' },
];

let empState = {
  page: 'login', user: null, active: false,
  openReadings: {}, closeReadings: {}, sales: [], dipReadings: [],
  sessionHistory: emp_loadHistory(),
};
let empSaleFuel = 'petrol', empPayMode = 'cash';

function emp_loadHistory() { try { return JSON.parse(localStorage.getItem('fb_emp_history') || '[]'); } catch { return []; } }
function emp_saveHistory() { try { localStorage.setItem('fb_emp_history', JSON.stringify(empState.sessionHistory.slice(0, 50))); } catch {} }
function emp_loadSession() {
  try {
    const raw = localStorage.getItem('fb_emp_session');
    if (!raw) return false;
    const s = verifyData(raw);
    if (!s || !validateEmpSessionShape(s)) { localStorage.removeItem('fb_emp_session'); return false; }
    empState = { ...empState, ...s };
    return true;
  } catch { return false; }
}
function emp_saveSession() {
  try {
    const data = {
      user: empState.user, active: empState.active,
      page: empState.page === 'login' ? 'readings' : empState.page,
      openReadings: empState.openReadings, closeReadings: empState.closeReadings,
      sales: empState.sales, dipReadings: empState.dipReadings,
    };
    localStorage.setItem('fb_emp_session', signData(data));
  } catch {}
}
function emp_clearSession() { try { localStorage.removeItem('fb_emp_session'); } catch {} }

const emp_today = () => new Date().toISOString().split('T')[0];
const emp_time = () => new Date().toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit', hour12: false });
function emp_key(pumpId, nozzle) { return `${pumpId}_${nozzle}`; }
function emp_hasPerm(permId) {
  // Admin/owner previewing always has all permissions
  if (APP.role === 'admin') return true;
  return !!(empState.user?.permissions?.[permId]);
}
function emp_toast(msg, type) { toast(msg, type === 'ok' ? 'success' : type === 'err' ? 'error' : 'info'); }

// Get pumps & nozzles allocated to current employee
function emp_myPumps() {
  if (!empState.user) return [];
  const uid = empState.user.id;
  // Collect all nozzle keys assigned to this employee across all shifts
  const myKeys = new Set();
  Object.values(allocations).forEach(shiftAlloc => {
    Object.entries(shiftAlloc).forEach(([key, empId]) => {
      if (empId === uid) myKeys.add(key);
    });
  });
  // If no allocations ever configured (fresh install), show all pumps
  const totalAllocations = Object.values(allocations).reduce((a, sa) => a + Object.keys(sa).length, 0);
  if (totalAllocations === 0) return EMP_PUMPS;
  // If this specific employee has no allocations yet, return empty (admin must assign)
  if (myKeys.size === 0) return [];
  // Build filtered pump list with only assigned nozzles
  const result = [];
  EMP_PUMPS.forEach(p => {
    const myNozzles = p.nozzles.filter(n => myKeys.has(emp_key(p.id, n)));
    if (myNozzles.length > 0) {
      result.push({ ...p, nozzles: myNozzles });
    }
  });
  return result;
}
function emp_myNozzleCount() { return emp_myPumps().reduce((a,p) => a + p.nozzles.length, 0); }

function emp_pumpSold(pumpId) {
  const myP = emp_myPumps();
  const p = myP.find(x => x.id === pumpId); if (!p) return 0;
  let t = 0;
  p.nozzles.forEach(n => {
    const oRaw = empState.openReadings[emp_key(pumpId,n)];
    const cRaw = empState.closeReadings[emp_key(pumpId,n)];
    if (oRaw === undefined || cRaw === undefined) return;
    const o = parseFloat(oRaw), c = parseFloat(cRaw);
    if (oRaw !== undefined && cRaw !== undefined && !isNaN(o) && !isNaN(c) && c > o) t += c - o;
  });
  return t;
}
function emp_totalSold() {
  // Prefer meter-based total if readings entered, else use sales records
  const meterTotal = emp_myPumps().reduce((a,p) => a + emp_pumpSold(p.id), 0);
  if (meterTotal > 0) return meterTotal;
  return empState.sales.reduce((a, s) => a + (s.liters || 0), 0);
}
function emp_totalRev() {
  // Prefer meter-based revenue if readings entered, else use sales records directly
  let meterTotal = 0;
  emp_myPumps().forEach(p => {
    const nozzleFuels = p.nozzleFuels || {};
    p.nozzles.forEach(n => {
      const k  = emp_key(p.id, n);
      const oRaw = empState.openReadings[k];
      const cRaw = empState.closeReadings[k];
      if (oRaw === undefined || cRaw === undefined) return;
      const o = parseFloat(oRaw), c = parseFloat(cRaw);
      const ft = nozzleFuels[n] || p.fuelType;
      if (oRaw !== undefined && cRaw !== undefined && !isNaN(o) && !isNaN(c) && c > o) meterTotal += (c - o) * (EMP_PRICES[ft] || 0);
    });
  });
  if (meterTotal > 0) return meterTotal;
  return empState.sales.reduce((a, s) => a + (s.amount || 0), 0);
}
function emp_totalCash() { return empState.sales.reduce((a,s) => a + (s.mode==='cash'?s.amount:0), 0); }

// Sales liters recorded for a specific pump+fuelType combination
function emp_nozzleSalesLiters(pumpId, fuelType, nozzle) {
  return empState.sales
    .filter(s => s.pump === pumpId && s.fuelType === fuelType && (!nozzle || !s.nozzle || s.nozzle === nozzle))
    .reduce((a, s) => a + (s.liters || 0), 0);
}

// Reconciliation for a nozzle: { meterSold, salesSold, diff, matched }
function emp_nozzleRecon(pumpId, nozzle, fuelType) {
  const k       = emp_key(pumpId, nozzle);
  const openRaw  = empState.openReadings[k];
  const closeRaw = empState.closeReadings[k];
  const open    = openRaw  !== undefined ? (parseFloat(openRaw)  || 0) : 0;
  const close   = closeRaw !== undefined ? (parseFloat(closeRaw) || 0) : 0;
  const meterSold = (openRaw !== undefined && closeRaw !== undefined && close > open) ? close - open : 0;
  const salesSold = emp_nozzleSalesLiters(pumpId, fuelType, nozzle);
  const diff      = Math.abs(meterSold - salesSold);
  const matched   = diff < 0.1; // allow 0.1L rounding tolerance
  return { meterSold, salesSold, diff, matched, hasClose: close > 0 };
}
const emp_totalNozzles = () => emp_myNozzleCount();

// ── Employee sub-page navigation ──
function emp_go(page) { empState.page = page; renderPage(); if (page === 'sales') { setTimeout(() => { emp_refreshNozzles(); }, 50); } }

// ── MAIN RENDER ──
function renderEmployeePortal() {
  // If accessed by admin, show employee overview/demo
  if (APP.role === 'admin' && !empState.active && empState.page !== 'complete') {
    // Check if there's a saved employee session
    emp_loadSession();
  }

  // If employee is directly logged in, restore session
  if (APP.role === 'employee' && !empState.active && empState.page !== 'complete') {
    emp_loadSession();
    if (!empState.active) {
      // Employee session expired, back to login
      return `<div style="max-width:520px;margin:0 auto;text-align:center;padding:40px 20px">
        <div style="font-size:48px;margin-bottom:12px">🧑‍🔧</div>
        <h3 class="fw-800" style="color:var(--text-0);font-size:18px;margin-bottom:8px">Session Expired</h3>
        <p style="color:var(--text-3);font-size:13px;margin-bottom:20px">Your shift session has ended. Please login again.</p>
        <button class="btn btn-accent" onclick="appLogout()">🔐 Go to Login</button>
      </div>`;
    }
  }

  const isLoggedIn = empState.active || empState.page === 'complete';

  // If not logged in and admin is viewing, show info
  if (!isLoggedIn && APP.role === 'admin') {
    return `<div style="max-width:520px;margin:0 auto;text-align:center;padding:40px 20px">
      <div style="font-size:48px;margin-bottom:12px">🧑‍🔧</div>
      <h3 class="fw-800" style="color:var(--text-0);font-size:18px;margin-bottom:8px">Employee Portal</h3>
      <p style="color:var(--text-3);font-size:13px;margin-bottom:8px">This is the view employees see when they login from the main login screen.</p>
      <p style="color:var(--text-3);font-size:12px;margin-bottom:20px">No active employee session right now.</p>
      <div class="card" style="text-align:left;max-width:360px;margin:0 auto"><div class="card-head"><h4>Employee Credentials</h4></div><div class="card-body" style="font-size:12px">
        ${EMP_LIST.map(e => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light)"><span class="fw-600" style="color:var(--text-0)">${sanitize(e.name)}</span><span class="fw-600" style="color:var(--text-3)">${sanitize(e.role)}</span></div>`).join('')}
      </div></div>
    </div>`;
  }

  const subNav = isLoggedIn ? `
    ${emp_myPumps().length === 0 ? '<div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius);padding:14px 16px;margin-bottom:14px;display:flex;align-items:center;gap:10px"><span style="font-size:20px">⚠️</span><div><div class="fw-700" style="color:var(--red);font-size:13px">No Nozzles Allocated</div><div style="font-size:11px;color:var(--text-3)">Admin has not assigned any pump nozzles to you yet. Contact your manager.</div></div></div>' : ''}
    <div style="display:flex;gap:4px;background:var(--bg-1);border-radius:var(--radius);padding:5px;margin-bottom:16px;border:1px solid var(--border-light)">
      ${[
        {id:'overview',icon:'📋',l:'Overview', always:true},
        {id:'readings',icon:'🔢',l:'Readings', always:true},
        {id:'sales',icon:'💰',l:'Sales',       always:true},
        {id:'dip',icon:'📏',l:'Dip',           perm:'dip'},
        {id:'expense',icon:'🧾',l:'Expenses',  perm:'expense'},
        {id:'history',icon:'📊',l:'History',   always:true},
      ].filter(t => t.always || emp_hasPerm(t.perm)).map(t =>
        `<button onclick="emp_go('${t.id}')" style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;padding:8px 4px;border-radius:var(--radius-sm);border:none;background:${empState.page===t.id?'rgba(212,148,15,0.12)':'transparent'};color:${empState.page===t.id?'var(--accent-light)':'var(--text-3)'};font-family:var(--font);font-size:9px;font-weight:700;cursor:pointer;letter-spacing:0.3px;text-transform:uppercase"><span style="font-size:16px">${t.icon}</span>${t.l}</button>`
      ).join('')}
    </div>` : '';

  let inner = '';
  switch (empState.page) {
    case 'login': inner = emp_renderLogin(); break;
    case 'overview': inner = emp_renderOverview(); break;
    case 'readings': inner = emp_renderReadings(); break;
    case 'sales': inner = emp_renderSales(); break;
    case 'dip': inner = emp_hasPerm('dip') ? emp_renderDip() : emp_renderReadings(); break;
    case 'expense': inner = emp_hasPerm('expense') ? emp_renderExpense() : emp_renderSales(); break;
    case 'history': inner = emp_renderHistory(); break;
    case 'complete': inner = emp_renderComplete(); break;
    default: inner = emp_renderLogin();
  }

  return `<div style="max-width:520px;margin:0 auto">${subNav}${inner}</div>`;
}

// ── LOGIN ──
function emp_renderLogin() {
  const empOpts = EMP_LIST.map(e => `<option value="${e.id}">${e.name} — ${e.role}</option>`).join('');

  return `<div style="text-align:center;margin-bottom:24px;padding-top:16px">
    <div style="font-size:42px;margin-bottom:10px">🧑‍🔧</div>
    <h2 class="fw-800" style="color:var(--text-0);font-size:20px;margin-bottom:4px">Employee Portal</h2>
    <p style="font-size:12px;color:var(--text-3)">${APP.tenant ? sanitize(APP.tenant.name) + (APP.tenant.location ? ', ' + sanitize(APP.tenant.location) : '') : 'FuelBunk Pro'}</p>
  </div>
  <div class="card"><div class="card-head"><h4>Login</h4>${badge(emp_today(),'badge-accent')}</div><div class="card-body">
    <div class="form-group"><label class="form-label">Select Your Name</label><select class="form-input" id="empLoginName">${empOpts}</select></div>
    <div class="form-group"><label class="form-label">Last 4 Digits of Phone (PIN)</label><input class="form-input" id="empLoginPin" type="tel" maxlength="4" placeholder="Enter 4-digit PIN" inputmode="numeric" autocomplete="off" /><div style="font-size:10px;color:var(--text-3);margin-top:4px">Use last 4 digits of registered mobile</div></div>
    <button class="btn btn-accent btn-block" style="padding:14px;font-size:14px;margin-top:6px" onclick="emp_doLogin()">🔐 Login</button>
  </div></div>`;
}

// ── OVERVIEW ──
function emp_renderOverview() {
  const oc = Object.keys(empState.openReadings).length, tn = emp_totalNozzles();
  const cc = Object.keys(empState.closeReadings).length;
  const ts = emp_totalSold(), tr = emp_totalRev(), tc = emp_totalCash();

  return `
    <div style="background:linear-gradient(135deg,rgba(34,197,94,0.08),rgba(34,197,94,0.03));border:1px solid rgba(34,197,94,0.2);border-radius:var(--radius);padding:14px 16px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      <div><div class="fw-800" style="color:var(--text-0);font-size:14px">🟢 ${empState.user?.name||'Employee'}</div><div style="font-size:11px;color:var(--text-2)">${emp_today()}</div></div>
      ${badge('ACTIVE','badge-green')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--green)">${fmt(ts)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Liters Sold</div></div>
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--accent-light)">${cur(tr)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Revenue</div></div>
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--text-0)">${cur(tc)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Cash</div></div>
    </div>
    <div class="card mb-16" style="margin-bottom:14px"><div class="card-head"><h4>📋 Progress</h4></div><div class="card-body">
      <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text-2)">Opening Readings</span>${badge(oc+'/'+tn, oc>=tn?'badge-green':'badge-accent')}</div><div style="background:var(--bg-0);border-radius:6px;height:8px;overflow:hidden"><div style="height:100%;width:${(oc/tn)*100}%;background:var(--green);border-radius:6px;transition:width 0.4s"></div></div></div>
      <div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text-2)">Closing Readings</span>${badge(cc+'/'+tn, cc>=tn?'badge-green':cc>0?'badge-accent':'badge-red')}</div><div style="background:var(--bg-0);border-radius:6px;height:8px;overflow:hidden"><div style="height:100%;width:${(cc/tn)*100}%;background:var(--accent);border-radius:6px;transition:width 0.4s"></div></div></div>
      <div style="display:flex;justify-content:space-between;font-size:12px"><span style="color:var(--text-2)">Sales Recorded</span><span class="fw-700" style="color:var(--text-0)">${empState.sales.length}</span></div>
    </div></div>
    <div class="card" style="margin-bottom:14px"><div class="card-head"><h4>⛽ Pump Summary</h4></div><div class="card-body">
      ${emp_myPumps().map(p => {
        const nozzleFuels = p.nozzleFuels || {};
        const s   = emp_pumpSold(p.id);
        const ho  = p.nozzles.every(n => empState.openReadings[emp_key(p.id,n)]  !== undefined);
        const hc  = p.nozzles.every(n => empState.closeReadings[emp_key(p.id,n)] !== undefined);
        // Reconciliation across all nozzles of this pump
        const recons = p.nozzles.map(n => emp_nozzleRecon(p.id, n, nozzleFuels[n] || p.fuelType));
        const anyRecon  = recons.some(r => r.hasClose);
        const allMatch  = anyRecon && recons.filter(r=>r.hasClose).every(r => r.matched);
        const anyMis    = anyRecon && recons.some(r => r.hasClose && !r.matched && r.salesSold > 0);
        const totalSales = p.nozzles.reduce((a,n) => a + emp_nozzleSalesLiters(p.id, nozzleFuels[n] || p.fuelType), 0);

        const reconBadge = !anyRecon ? '' :
          allMatch  ? `<span style="font-size:10px;font-weight:700;color:var(--green);background:rgba(34,197,94,0.12);padding:2px 7px;border-radius:4px">✅ MATCHED</span>` :
          anyMis    ? `<span style="font-size:10px;font-weight:700;color:var(--red);background:rgba(239,68,68,0.12);padding:2px 7px;border-radius:4px">❌ MISMATCH</span>` :
                      `<span style="font-size:10px;font-weight:700;color:#f97316;background:rgba(249,115,22,0.1);padding:2px 7px;border-radius:4px">⚠️ NO SALES</span>`;

        const nozzlePills = p.nozzles.map(n => {
          const ft   = nozzleFuels[n] || p.fuelType;
          const fuel = getFuel(ft) || { short: ft, color: '#888' };
          return `<span style="font-size:9px;font-weight:700;color:${fuel.color};background:${fuel.color}18;padding:1px 6px;border-radius:3px">N${n}:${fuel.short}</span>`;
        }).join(' ');

        return `<div style="padding:12px 0;border-bottom:1px solid var(--border-light)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
            <div>
              <span class="fw-800" style="color:var(--text-0);font-size:14px">${p.name}</span>
              <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:3px">${nozzlePills}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              ${reconBadge}
              ${ho&&hc ? badge('DONE','badge-green') : ho ? badge('OPEN','badge-accent') : badge('PENDING','badge-red')}
            </div>
          </div>
          ${anyRecon ? `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:4px">
            <div style="background:var(--bg-0);border-radius:6px;padding:7px 8px;text-align:center">
              <div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-bottom:2px">Meter Sold</div>
              <div class="mono fw-700" style="color:var(--text-0);font-size:14px">${fmt(s)} L</div>
            </div>
            <div style="background:var(--bg-0);border-radius:6px;padding:7px 8px;text-align:center">
              <div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-bottom:2px">Sales Entered</div>
              <div class="mono fw-700" style="color:${totalSales===0?'var(--text-3)':'var(--green)'};font-size:14px">${fmt(totalSales)} L</div>
            </div>
            <div style="background:var(--bg-0);border-radius:6px;padding:7px 8px;text-align:center;${allMatch?'':'border:1px solid rgba(239,68,68,0.2)'}">
              <div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-bottom:2px">Difference</div>
              <div class="mono fw-700" style="color:${allMatch?'var(--green)':'var(--red)'};font-size:14px">${fmt(recons.reduce((a,r)=>a+r.diff,0))} L</div>
            </div>
          </div>` : ''}
        </div>`;
      }).join('')}
    </div></div>
    ${cc>=tn&&oc>=tn?`<button class="btn btn-block" style="background:var(--green);color:#fff;padding:16px;font-size:15px;border-radius:var(--radius);margin-top:8px" onclick="emp_submit()">✅ Submit & Done</button>`
    :`<button class="btn btn-block" style="background:transparent;color:var(--red);border:1px solid rgba(239,68,68,0.25);padding:14px;font-size:13px;border-radius:var(--radius);margin-top:8px" onclick="emp_confirmEnd()">⏹ Submit ${cc<tn?'(closing readings pending)':''}</button>`}
  `;
}

// ── READINGS ──
function emp_renderReadings() {
  const allOpen = Object.keys(empState.openReadings).length >= emp_totalNozzles();
  const mode = allOpen ? 'close' : 'open';
  const label = mode === 'open' ? 'OPENING' : 'CLOSING';
  const clr = mode === 'open' ? 'var(--green)' : 'var(--accent-light)';

  if (emp_myPumps().length === 0) {
    return `<div style="text-align:center;padding:40px 20px;color:var(--text-3)">
      <div style="font-size:40px;margin-bottom:12px">⛽</div>
      <div class="fw-700" style="color:var(--text-1);margin-bottom:6px">No Pumps Assigned</div>
      <div style="font-size:12px">Ask your admin to assign you to a pump nozzle in Staff &amp; Allocation.</div>
    </div>`;
  }
  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div><h3 class="fw-800" style="color:var(--text-0);font-size:18px">${label} Readings</h3><p style="font-size:11px;color:var(--text-3);margin-top:2px">Enter meter readings for each nozzle</p></div>
      ${badge(label, mode==='open'?'badge-green':'badge-accent')}
    </div>
    <div style="display:flex;gap:8px;margin-bottom:16px">
      <button class="emp-mode-tab btn btn-sm ${mode==='open'?'btn-accent':'btn-ghost'}" data-mode="open" onclick="emp_switchMode('open')">Opening</button>
      <button class="emp-mode-tab btn btn-sm ${mode==='close'?'btn-accent':'btn-ghost'}" data-mode="close" onclick="emp_switchMode('close')">Closing</button>
    </div>
    <div id="empReadCards">${emp_renderCards(mode)}</div>
  `;
}

function emp_renderCards(mode) {
  const rd    = mode === 'open' ? empState.openReadings : empState.closeReadings;
  const other = mode === 'close' ? empState.openReadings : {};

  return emp_myPumps().map(p => {
    const nozzleFuels = p.nozzleFuels || {};
    const done = p.nozzles.every(n => rd[emp_key(p.id,n)] !== undefined);
    const sold = mode === 'close' ? emp_pumpSold(p.id) : 0;

    // Revenue per nozzle fuel type
    let revenue = 0;
    if (mode === 'close') {
      p.nozzles.forEach(n => {
        const k = emp_key(p.id, n);
        const o = parseFloat(other[k]) || 0;
        const c = parseFloat(rd[k])    || 0;
        const ft = nozzleFuels[n] || p.fuelType;
        if (c > o) revenue += (c - o) * (EMP_PRICES[ft] || 0);
      });
    }

    const nozzleRows = p.nozzles.map(n => {
      const k  = emp_key(p.id, n);
      const v  = rd[k];
      const ov = other[k];
      const ft   = nozzleFuels[n] || p.fuelType;
      const fuel = getFuel(ft) || { short: ft.toUpperCase(), color: '#888' };
      const tank = APP.data?.tanks?.find(t => t.fuelType === ft);
      const nSold = (mode === 'close' && ov !== undefined && v !== undefined) ? Math.max(0, parseFloat(v) - parseFloat(ov)) : 0;

      const tankBalance = tank
        ? `<span style="font-size:10px;color:var(--text-3);margin-left:6px">Tank: <strong style="color:${tank.current < 500 ? 'var(--red)' : 'var(--text-1)'}">${fmt(tank.current)} L</strong></span>`
        : '';

      return `<div style="padding:12px;background:var(--bg-0);border:1px solid ${v!==undefined?'rgba(34,197,94,0.3)':'var(--border)'};border-radius:8px;margin-bottom:8px">
        <!-- Nozzle header -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:28px;height:28px;border-radius:50%;background:${fuel.color}22;border:2px solid ${fuel.color};display:grid;place-items:center;font-size:10px;font-weight:900;color:${fuel.color}">N${n}</div>
            <div>
              <span style="font-size:11px;font-weight:700;color:${fuel.color};background:${fuel.color}18;padding:1px 7px;border-radius:3px">${fuel.short}</span>
              ${tankBalance}
            </div>
          </div>
          ${ov !== undefined && mode === 'close'
            ? `<span style="font-size:11px;color:var(--text-3);font-family:var(--mono)">Open: <strong style="color:var(--text-1)">${fmt(ov)}</strong></span>`
            : ''}
        </div>
        <!-- Reading input -->
        <div style="display:flex;gap:8px;align-items:center">
          <input class="form-input" type="number" inputmode="decimal" step="0.1"
            placeholder="${mode==='open'?'Opening reading':'Closing reading'}"
            value="${v !== undefined ? v : ''}"
            onchange="emp_saveReading('${mode}','${k}',this.value)"
            onfocus="this.select()"
            style="flex:1;font-family:var(--mono);font-size:20px;font-weight:700;padding:12px 14px;text-align:center" />
          ${v !== undefined ? '<span style="color:var(--green);font-size:20px;flex-shrink:0">✓</span>' : ''}
        </div>
        ${mode === 'close' && v !== undefined
          ? (() => {
              const r = emp_nozzleRecon(p.id, n, ft);
              if (!r.hasClose) return '';
              const salesLabel = r.salesSold > 0
                ? `Sales recorded: <strong>${fmt(r.salesSold)} L</strong>`
                : `<span style="color:var(--text-3)">No quick sales recorded</span>`;
              if (r.matched) {
                return `<div style="margin-top:8px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:6px;padding:7px 10px;font-size:11px;color:var(--green);font-weight:600">
                  ✅ Matched — Meter: ${fmt(r.meterSold)} L = ${salesLabel}
                </div>`;
              } else if (r.salesSold === 0) {
                return `<div style="margin-top:8px;background:rgba(249,115,22,0.07);border:1px solid rgba(249,115,22,0.2);border-radius:6px;padding:7px 10px;font-size:11px;color:#f97316;font-weight:600">
                  ⚠️ Meter: ${fmt(r.meterSold)} L sold — No quick sales entered yet
                </div>`;
              } else {
                return `<div style="margin-top:8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:6px;padding:7px 10px;font-size:11px;color:var(--red);font-weight:600">
                  ❌ Mismatch — Meter: ${fmt(r.meterSold)} L · Sales: ${fmt(r.salesSold)} L · Gap: ${fmt(r.diff)} L
                </div>`;
              }
            })()
          : ''}
      </div>`;
    }).join('');

    return `<div class="card" style="margin-bottom:12px;${done ? 'border-color:rgba(34,197,94,0.3)' : ''}">
      <div style="padding:12px 16px;display:flex;justify-content:space-between;align-items:center;background:${done ? 'rgba(34,197,94,0.04)' : 'var(--bg-3)'};border-bottom:1px solid var(--border-light)">
        <div>
          <div class="fw-800" style="color:var(--text-0);font-size:15px">${p.name}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
            ${p.nozzles.map(n => {
              const ft = nozzleFuels[n] || p.fuelType;
              const fuel = getFuel(ft) || { short: ft, color: '#888' };
              return `<span style="font-size:9px;font-weight:700;color:${fuel.color};background:${fuel.color}18;padding:1px 6px;border-radius:3px">N${n}: ${fuel.short}</span>`;
            }).join('')}
          </div>
        </div>
        ${done ? badge('✓ Done', 'badge-green') : badge('Pending', 'badge-accent')}
      </div>
      <div style="padding:14px 16px">
        ${nozzleRows}
        ${mode === 'close' && sold > 0
          ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
               <div style="background:var(--bg-2);border-radius:8px;padding:10px 12px;border:1px solid var(--border-light);text-align:center">
                 <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Total Sold</div>
                 <div class="mono fw-700" style="color:var(--green);font-size:20px">${fmt(sold)} L</div>
               </div>
               <div style="background:var(--bg-2);border-radius:8px;padding:10px 12px;border:1px solid var(--border-light);text-align:center">
                 <div style="font-size:9px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Revenue</div>
                 <div class="mono fw-700" style="color:var(--accent-light);font-size:20px">${cur(revenue)}</div>
               </div>
             </div>`
          : ''}
      </div>
    </div>`;
  }).join('');
}

// ── SALES ──
function emp_renderSales() {
  // Pre-sync nozzle dropdown after render (called via setTimeout in emp_go)
  const total = empState.sales.reduce((a,s) => a+s.amount, 0);
  // Collect only the fuel types from nozzles actually assigned to this employee
  const fuels = [];
  emp_myPumps().forEach(p => {
    (p.nozzles || []).forEach(n => {
      const ft = (p.nozzleFuels || {})[n] || p.fuelType;
      if (!fuels.includes(ft)) fuels.push(ft);
    });
  });
  // Ensure empSaleFuel is valid for this employee
  if (fuels.length > 0 && !fuels.includes(empSaleFuel)) empSaleFuel = fuels[0];

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div><h3 class="fw-800" style="color:var(--text-0);font-size:18px">Quick Sale</h3><p style="font-size:11px;color:var(--text-3)">Record individual fuel sales</p></div>
      ${badge(empState.sales.length+' sales','badge-green')}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-body">
      <div class="form-group"><label class="form-label">Fuel Type</label><div style="display:flex;gap:6px;flex-wrap:wrap">${fuels.map(f=>`<button class="btn btn-sm ${empSaleFuel===f?'btn-accent':'btn-ghost'}" data-fuelbtn="${f}" onclick="emp_selFuel('${f}')">${EMP_FUEL[f]?.split(' ')[0]||f}</button>`).join('')}</div></div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Pump</label>
          <select class="form-input" id="empSalePump" onchange="emp_refreshNozzles()">
            ${emp_myPumps().filter(p => {
              const nf = p.nozzleFuels || {};
              return p.fuelType === empSaleFuel || Object.values(nf).includes(empSaleFuel);
            }).map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Nozzle</label>
          <select class="form-input" id="empSaleNozzle">
            ${(() => {
              const p = emp_myPumps().find(p => {
                const nf = p.nozzleFuels || {};
                return p.fuelType === empSaleFuel || Object.values(nf).includes(empSaleFuel);
              });
              if (!p) return '';
              const nf = p.nozzleFuels || {};
              return (p.nozzles || []).filter(n => (nf[n] || p.fuelType) === empSaleFuel)
                .map(n => { const fuel = getFuel(nf[n]||p.fuelType); return `<option value="${n}">Nozzle ${n} <span style="color:${fuel?.color}">${fuel?.short||''}</span></option>`; }).join('');
            })()}
          </select>
        </div>
      </div>
      <div class="form-row"><div class="form-group"><label class="form-label">Liters</label><input class="form-input" id="empSaleLiters" type="number" inputmode="decimal" step="0.1" placeholder="0.0" oninput="emp_calcAmt()" style="font-family:var(--mono);font-weight:600" /></div>
      <div class="form-group"><label class="form-label">Amount (₹)</label><input class="form-input" id="empSaleAmt" type="number" inputmode="decimal" step="0.01" placeholder="${emp_hasPerm('prices')?'Auto — price applied':'Enter amount'}" style="font-family:var(--mono);font-weight:600" oninput="emp_calcLiters()" /></div></div>
      ${emp_hasPerm('prices') ? `<div style="font-size:11px;color:var(--text-3);margin-top:-6px;margin-bottom:8px">Current price: <strong style="color:var(--accent-light)">${cur(EMP_PRICES[empSaleFuel] || 0)}/L</strong></div>` : ''}
      <div class="form-group"><label class="form-label">Vehicle Number</label><input class="form-input" id="empSaleVeh" placeholder="KA00XX0000" oninput="this.value=this.value.toUpperCase()" onpaste="setTimeout(()=>this.value=this.value.toUpperCase(),0)" style="text-transform:uppercase;font-family:var(--mono);font-weight:600" /></div>
      <div class="form-group"><label class="form-label">Payment Mode</label><div style="display:flex;gap:6px;flex-wrap:wrap">${['cash','upi','card','credit']
        .map(m=>`<button class="btn btn-sm ${empPayMode===m?'btn-accent':'btn-ghost'}" data-paybtn="${m}" onclick="emp_selPay('${m}')">${{cash:'💵 Cash',upi:'📱 UPI',card:'💳 Card',credit:'📋 Credit'}[m]}</button>`).join('')}</div></div>
      <div id="empCustWrap" style="display:${empPayMode==='credit'?'':'none'}"><div class="form-group"><label class="form-label">Credit Customer</label><select class="form-input" id="empSaleCustomer"><option value="">— Select Customer —</option>${(APP.data?.creditCustomers||[]).filter(c=>!c.inactive).map(c=>`<option value="${sanitize(c.name)}">${sanitize(c.name)}</option>`).join('')}</select></div></div><input type="hidden" id="empSaleCustomerHidden" value="" />
      <button class="btn btn-accent btn-block" style="padding:14px;font-size:14px;margin-top:6px" onclick="emp_recordSale()">💾 Record Sale</button>
    </div></div>
    ${empState.sales.length>0?`<div class="card"><div class="card-head"><h4>Recent Sales</h4><span class="mono fw-700" style="color:var(--green);font-size:13px">${cur(total)}</span></div><div class="card-body">
      ${empState.sales.slice(0,15).map(s=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border-light)">
        <div>
          <span class="fw-700" style="color:var(--text-0);font-size:13px">${sanitize(s.vehicle)}</span>
          <span style="font-size:10px;color:var(--text-3);margin-left:6px">${s.time}</span>
          ${badge(s.mode,s.mode==='cash'?'badge-green':s.mode==='upi'?'badge-blue':s.mode==='card'?'badge-accent':'badge-red')}
          ${s.nozzle ? `<span style="font-size:9px;font-weight:700;color:var(--text-3);background:var(--bg-0);padding:1px 5px;border-radius:3px;margin-left:4px">N${s.nozzle}</span>` : ''}
        </div>
        <div style="text-align:right"><div class="mono fw-700" style="color:var(--text-0);font-size:13px">${cur(s.amount)}</div><div style="font-size:10px;color:var(--text-3)">${fmt(s.liters)} L · ${(getFuel(s.fuelType)||{short:''}).short}</div></div>
      </div>`).join('')}
    </div></div>`:
    `<div style="text-align:center;padding:30px;color:var(--text-3)"><div style="font-size:32px;margin-bottom:8px;opacity:0.4">💰</div><div class="fw-600">No sales recorded yet</div></div>`}
  `;
}

// ── DIP ──
function emp_renderDip() {
  const tanks = (APP.data?.tanks || []).map(t => {
    const fuel = getFuel(t.fuelType) || { short: t.fuelType };
    return { id: t.id, name: t.name || ('Tank ' + t.id + ' — ' + fuel.short), cap: t.capacity };
  });
  return `
    <h3 class="fw-800" style="color:var(--text-0);font-size:18px;margin-bottom:4px">📏 Dip Reading</h3>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:16px">Measure & record physical tank levels</p>
    <div class="card" style="margin-bottom:14px"><div class="card-body">
      <div class="form-group"><label class="form-label">Select Tank</label><select class="form-input" id="empDipTank">${tanks.map(t=>`<option value="${t.id}">${t.name} (${fmt(t.cap)} L)</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Physical Dip Reading (Liters)</label><input class="form-input" id="empDipVal" type="number" inputmode="numeric" placeholder="Enter reading in liters" style="font-family:var(--mono);font-size:22px;font-weight:700;text-align:center;padding:16px" /></div>
      <button class="btn btn-accent btn-block" style="padding:14px;font-size:14px" onclick="emp_recordDip()">📏 Save Dip Reading</button>
    </div></div>
    ${empState.dipReadings.length>0?`<div class="card"><div class="card-head"><h4>Today's Readings</h4></div><div class="card-body">
      ${empState.dipReadings.map(d=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)"><div><span class="fw-700" style="color:var(--text-0)">Tank ${d.tankId}</span><span style="font-size:11px;color:var(--text-3);margin-left:8px">${d.time}</span></div><span class="mono fw-700" style="color:var(--green)">${fmt(d.reading)} L</span></div>`).join('')}
    </div></div>`:''}
  `;
}

// ── EXPENSE ENTRY (optional permission) ──
function emp_renderExpense() {
  const expTotal = (empState.expenses || []).reduce((a, e) => a + e.amount, 0);
  const cats = ['Fuel','Cleaning','Maintenance','Stationary','Petty Cash','Other'];
  return `
    <h3 class="fw-800" style="color:var(--text-0);font-size:18px;margin-bottom:4px">🧾 Log Expense</h3>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:16px">Record petty cash & daily expenses</p>
    <div class="card" style="margin-bottom:14px"><div class="card-body">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-input" id="empExpCat">${cats.map(c=>`<option>${c}</option>`).join('')}</select>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Amount (₹)</label>
          <input class="form-input" id="empExpAmt" type="number" inputmode="decimal" placeholder="0" style="font-family:var(--mono);font-size:20px;font-weight:700;text-align:center" />
        </div>
        <div class="form-group"><label class="form-label">Payment</label>
          <select class="form-input" id="empExpMode"><option value="cash">Cash</option><option value="upi">UPI</option></select>
        </div>
      </div>
      <div class="form-group"><label class="form-label">Description (optional)</label>
        <input class="form-input" id="empExpDesc" placeholder="Brief note..." />
      </div>
      <button class="btn btn-accent btn-block" style="padding:14px;font-size:14px" onclick="emp_recordExpense()">🧾 Save Expense</button>
    </div></div>
    ${(empState.expenses||[]).length > 0 ? `
      <div class="card"><div class="card-head"><h4>Today's Expenses</h4><span class="mono fw-700" style="color:var(--red);font-size:13px">${cur(expTotal)}</span></div><div class="card-body">
        ${empState.expenses.map(e=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light)">
          <div><div class="fw-700" style="color:var(--text-0);font-size:13px">${e.category}</div>
          <div style="font-size:10px;color:var(--text-3)">${e.desc||''} · ${e.time} · ${e.mode}</div></div>
          <span class="mono fw-700" style="color:var(--red)">${cur(e.amount)}</span>
        </div>`).join('')}
      </div></div>` : ''}
  `;
}

function emp_recordExpense() {
  const amt  = parseFloat(document.getElementById('empExpAmt')?.value);
  const cat  = document.getElementById('empExpCat')?.value;
  const mode = document.getElementById('empExpMode')?.value;
  const desc = (document.getElementById('empExpDesc')?.value||'').trim();
  if (isNaN(amt) || amt <= 0) { toast('Enter valid amount', 'error'); return; }
  if (amt > 1000000) { toast('Amount too large', 'error'); return; }
  const expense = { id: Date.now(), category: cat, amount: amt, mode, desc, time: emp_time(), date: emp_today(), employee: empState.user?.name || '' };
  if (!empState.expenses) empState.expenses = [];
  empState.expenses.unshift(expense);
  // Save to admin data too
  if (APP.data?.expenses) APP.data.expenses.unshift({ ...expense, source: 'employee' });
  db.add('expenses', { ...expense, source: 'employee' }).catch(() => {});
  emp_saveSession();
  toast(`✅ ${cat} — ${cur(amt)} logged`, 'success');
  emp_go('expense');
}
window.emp_recordExpense = emp_recordExpense;

// ── HISTORY ──
function emp_buildHistoryBreakdown() {
  // Group by pump + nozzle fuel from actual sales
  var map = {};
  empState.sales.forEach(function(s) {
    var k = (s.pump || 0) + '_' + (s.fuelType || 'petrol');
    if (!map[k]) {
      var p = emp_myPumps().find(function(x) { return x.id === s.pump; }) || { name: 'Pump ' + s.pump };
      map[k] = { pumpName: p.name, fuelType: s.fuelType || 'petrol', liters: 0, amount: 0, hasMeter: false };
    }
    map[k].liters += (s.liters || 0);
    map[k].amount += (s.amount || 0);
  });
  // Override liters with meter reading where both open+close exist
  emp_myPumps().forEach(function(p) {
    (p.nozzles || []).forEach(function(n) {
      var k = emp_key(p.id, n);
      var oRaw = empState.openReadings[k], cRaw = empState.closeReadings[k];
      if (oRaw !== undefined && cRaw !== undefined) {
        var o = parseFloat(oRaw), c = parseFloat(cRaw);
        if (!isNaN(o) && !isNaN(c) && c > o) {
          var ft = (p.nozzleFuels || {})[n] || p.fuelType;
          var mk = p.id + '_' + ft;
          if (!map[mk]) map[mk] = { pumpName: p.name, fuelType: ft, liters: 0, amount: 0 };
          map[mk].liters = Math.max(map[mk].liters, c - o);
          map[mk].hasMeter = true;
        }
      }
    });
  });
  var entries = Object.values(map);
  if (!entries.length) return '<div style="color:var(--text-3);font-size:12px;padding:8px 0">No sales recorded yet</div>';
  return entries.map(function(e) {
    var fuel = getFuel(e.fuelType) || { short: e.fuelType, color: '#888' };
    return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light)">'
      + '<div><span class="fw-800" style="color:var(--text-0);font-size:14px">' + e.pumpName + '</span>'
      + '<span style="margin-left:8px;font-size:10px;font-weight:700;color:' + fuel.color + '">' + fuel.short + '</span>'
      + '<span style="margin-left:4px;font-size:9px;color:var(--text-3)">' + (e.hasMeter ? '📊' : '💳') + '</span></div>'
      + '<div style="text-align:right">'
      + '<div class="mono fw-700" style="color:' + (e.liters > 0 ? 'var(--green)' : 'var(--text-3)') + ';font-size:13px">' + fmt(e.liters) + ' L</div>'
      + (e.amount > 0 ? '<div style="font-size:10px;color:var(--text-3)">' + cur(e.amount) + '</div>' : '')
      + '</div></div>';
  }).join('');
}

function emp_renderHistory() {
  const ts = emp_totalSold(), tr = emp_totalRev();
  return `
    <h3 class="fw-800" style="color:var(--text-0);font-size:18px;margin-bottom:4px">📊 Report</h3>
    <p style="font-size:11px;color:var(--text-3);margin-bottom:16px">Current session and past history</p>
    <div class="card" style="margin-bottom:16px"><div class="card-head"><h4>Current Summary</h4></div><div class="card-body">
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">
        <div style="text-align:center;background:var(--bg-0);padding:10px;border-radius:var(--radius-sm)"><div class="mono fw-800" style="font-size:16px;color:var(--green)">${fmt(ts)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:2px">Total Liters</div></div>
        <div style="text-align:center;background:var(--bg-0);padding:10px;border-radius:var(--radius-sm)"><div class="mono fw-800" style="font-size:16px;color:var(--accent-light)">${cur(tr)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:2px">Revenue</div></div>
        <div style="text-align:center;background:var(--bg-0);padding:10px;border-radius:var(--radius-sm)"><div class="mono fw-800" style="font-size:16px;color:var(--text-0)">${empState.sales.length}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:2px">Transactions</div></div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Pump-wise Breakdown</div>
      ${emp_buildHistoryBreakdown()}
      <div style="height:1px;background:var(--border);margin:14px 0"></div>
      <div style="font-size:12px;font-weight:700;color:var(--text-2);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Payment Breakdown</div>
      ${['cash','upi','card','credit'].map(m=>{const t=empState.sales.filter(s=>s.mode===m).reduce((a,s)=>a+s.amount,0);const cs={cash:'var(--green)',upi:'var(--blue)',card:'var(--accent-light)',credit:'var(--red)'};return t>0?`<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-light)"><span style="text-transform:capitalize;font-weight:600;color:var(--text-1)">${m}</span><span class="mono fw-700" style="color:${cs[m]}">${cur(t)}</span></div>`:''}).join('')}
      <button class="btn btn-ghost btn-block" onclick="${emp_hasPerm('print') ? 'emp_share()' : ''}" style="margin-top:12px;${emp_hasPerm('print') ? '' : 'display:none'}" >📤 Share Summary</button>
    </div></div>
    <div class="card"><div class="card-head"><h4>Past Sessions</h4>${badge(empState.sessionHistory.length,'badge-blue')}</div><div class="card-body">
      ${empState.sessionHistory.length>0?empState.sessionHistory.slice(0,10).map(h=>`<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border-light)"><div><div class="fw-700" style="color:var(--text-0);font-size:13px">${h.date}</div><div style="font-size:11px;color:var(--text-3)">${h.user} · ${h.salesCount} sales</div></div><div style="text-align:right"><div class="mono fw-700" style="color:var(--accent-light);font-size:13px">${cur(h.revenue)}</div><div style="font-size:10px;color:var(--text-3)">${fmt(h.liters)} L</div></div></div>`).join(''):'<div style="text-align:center;padding:24px;color:var(--text-3)"><div style="font-size:28px;margin-bottom:8px;opacity:0.4">📊</div><div class="fw-600">No past sessions yet</div></div>'}
    </div></div>
  `;
}

// ── COMPLETE ──
function emp_renderComplete() {
  const ts = emp_totalSold(), tr = emp_totalRev();
  return `
    <div style="text-align:center;padding:30px 20px">
      <div style="width:72px;height:72px;border-radius:50%;background:rgba(34,197,94,0.1);display:grid;place-items:center;margin:0 auto 16px;font-size:32px;border:2px solid rgba(34,197,94,0.25)">✓</div>
      <h2 class="fw-800" style="color:var(--text-0);font-size:20px;margin-bottom:6px">Shift Submitted!</h2>
      <p style="font-size:13px;color:var(--text-2)">All readings and sales have been saved</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--green)">${fmt(ts)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Liters</div></div>
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--accent-light)">${cur(tr)}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Revenue</div></div>
      <div class="card" style="text-align:center;padding:12px"><div class="mono fw-800" style="font-size:18px;color:var(--text-0)">${empState.sales.length}</div><div style="font-size:9px;color:var(--text-3);font-weight:700;text-transform:uppercase;margin-top:3px">Sales</div></div>
    </div>
    <div class="card" style="margin-bottom:16px"><div class="card-head"><h4>Pump-wise Report</h4></div><div class="card-body">
      ${emp_myPumps().map(p=>{const s=emp_pumpSold(p.id);return `<div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px"><span class="fw-800" style="color:var(--text-0);font-size:15px">${p.name} <span style="font-size:10px;font-weight:700;color:${p.fuelType==='petrol'?'var(--red)':p.fuelType==='diesel'?'var(--orange)':'var(--purple)'}">${EMP_FUEL[p.fuelType].split(' ')[0]}</span></span><span class="mono fw-800" style="color:var(--green);font-size:14px">${fmt(s)} L</span></div>
        ${p.nozzles.map(n=>{const k=emp_key(p.id,n),o=empState.openReadings[k]||0,c=empState.closeReadings[k]||0;return `<div style="display:grid;grid-template-columns:50px 1fr 1fr 1fr;gap:6px;font-size:12px;padding:6px 0;border-bottom:1px solid var(--border-light)"><span style="color:var(--text-3);font-weight:700">N-${n}</span><span style="color:var(--text-2)">Open: <span class="mono" style="color:var(--text-0)">${fmt(o)}</span></span><span style="color:var(--text-2)">Close: <span class="mono" style="color:var(--text-0)">${fmt(c)}</span></span><span class="mono fw-700" style="color:var(--green);text-align:right">${fmt(c-o)} L</span></div>`;}).join('')}
      </div>`;}).join('')}
    </div></div>
    ${emp_hasPerm('print') ? `<div style="display:flex;gap:10px"><button class="btn btn-ghost" style="flex:1" onclick="emp_share()">📤 Share</button><button class="btn btn-accent" style="flex:1" onclick="emp_print()">🖨 Print</button></div>` : ''}
    <button class="btn btn-ghost btn-block" style="margin-top:12px;color:var(--red);border-color:rgba(239,68,68,0.2)" onclick="emp_logout()">🚪 Logout</button>
  `;
}

// ═══════════════════════════════════════════════════════════════
// EMPLOYEE ACTIONS
// ═══════════════════════════════════════════════════════════════

async function emp_doLogin() {
  const id = parseInt(document.getElementById('empLoginName').value);
  const pin = document.getElementById('empLoginPin').value;
  const emp = EMP_LIST.find(e => e.id === id);
  if (!emp) { toast('Select employee','error'); return; }
  if (!checkRateLimit('emp_' + id)) return;
  const pinHash = await hashPassword(pin);
  if (pinHash !== emp.pinHash) { recordFailedLogin('emp_' + id); toast('Incorrect PIN','error'); return; }
  recordSuccessLogin('emp_' + id);

  // Restore existing session if same employee re-logging in during same shift
  let inAppRestored = false;
  try {
    const rawS = localStorage.getItem('fb_emp_session');
    if (rawS) {
      const savedS = verifyData(rawS);
      if (savedS && savedS.user && savedS.user.id === emp.id && savedS.active) {
        empState = { ...empState, ...savedS };
        inAppRestored = true;
      }
    }
  } catch(ex) {}

  if (!inAppRestored) {
    // Pre-fill opening readings from last stored nozzle readings (last close = this open)
    // Use APP.data.pumps directly — emp_myPumps/getEmpPumps strip nozzleReadings
    const freshOpenings = {};
    (APP.data?.pumps || []).forEach(p => {
      const nr = p.nozzleReadings || {};
      const labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
      labels.forEach(n => {
        const k = emp_key(p.id, n);
        if (nr[n] !== undefined && nr[n] > 0) freshOpenings[k] = nr[n];
      });
    });
    empState.openReadings = freshOpenings;
    empState.closeReadings = {}; empState.sales = []; empState.dipReadings = [];
    empState.page = 'readings';
  } else {
    if (!empState.page || empState.page === 'login') empState.page = 'readings';
  }
  empState.user = { id: emp.id, name: emp.name, role: emp.role, permissions: emp.permissions || {} };
  empState.active = true;

  // Set default fuel to first fuel in employee's assigned nozzles
  const allAllocFuels = [];
  emp_myPumps().forEach(p => {
    (p.nozzles || []).forEach(n => {
      const ft = (p.nozzleFuels || {})[n] || p.fuelType;
      if (!allAllocFuels.includes(ft)) allAllocFuels.push(ft);
    });
  });
  if (allAllocFuels.length > 0) empSaleFuel = allAllocFuels[0];

  emp_saveSession(); auditLog('login', { employee: emp.name });
  if (inAppRestored && empState.sales.length > 0) {
    toast('Welcome back ' + sanitize(emp.name) + '! ' + empState.sales.length + ' sale(s) restored.', 'success');
  } else {
    toast('Welcome ' + sanitize(emp.name) + '!', 'success');
  }
  emp_go('readings');
}

function emp_saveReading(mode, key, value) {
  const v = parseFloat(value);
  if (isNaN(v) || v < 0) { if (mode==='open') delete empState.openReadings[key]; else delete empState.closeReadings[key]; }
  else {
    if (v > 9999999) { toast('Reading value too large', 'error'); return; }
    if (mode === 'open') empState.openReadings[key] = v;
    else {
      const ov = empState.openReadings[key];
      if (ov !== undefined && v < ov) { toast('Closing must be ≥ opening','error'); return; }
      if (ov !== undefined && (v - ov) > 10000) { toast('Difference exceeds 10,000L. Verify reading.','error'); return; }
      empState.closeReadings[key] = v;
    }
  }
  emp_saveSession();
  const c = document.getElementById('empReadCards');
  if (c) c.innerHTML = emp_renderCards(mode);
}

function emp_switchMode(mode) {
  const c = document.getElementById('empReadCards');
  if (c) c.innerHTML = emp_renderCards(mode);
  // Update tab button states without full re-render
  document.querySelectorAll('.emp-mode-tab').forEach(btn => {
    btn.classList.toggle('btn-accent', btn.dataset.mode === mode);
    btn.classList.toggle('btn-ghost', btn.dataset.mode !== mode);
  });
}

function emp_refreshNozzles() {
  const pumpId = parseInt(document.getElementById('empSalePump')?.value);
  const nozzleSel = document.getElementById('empSaleNozzle');
  if (!nozzleSel) return;
  const p = emp_myPumps().find(px => px.id === pumpId);
  if (!p) return;
  const nf = p.nozzleFuels || {};
  const matchingNozzles = (p.nozzles || []).filter(n => (nf[n] || p.fuelType) === empSaleFuel);
  nozzleSel.innerHTML = matchingNozzles.map(n => {
    const fuel = getFuel(nf[n] || p.fuelType);
    return `<option value="${n}">Nozzle ${n} — ${fuel?.short || ''}</option>`;
  }).join('');
}

function emp_selFuel(f) {
  empSaleFuel = f;
  // Update fuel button highlights without full renderPage (preserves form inputs)
  document.querySelectorAll('[data-fuelbtn]').forEach(btn => {
    btn.classList.toggle('btn-accent', btn.dataset.fuelbtn === f);
    btn.classList.toggle('btn-ghost', btn.dataset.fuelbtn !== f);
  });
  // Rebuild pump dropdown to only show pumps that have a nozzle for this fuel
  const pumpSel = document.getElementById('empSalePump');
  if (pumpSel) {
    const filtered = emp_myPumps().filter(p => {
      const nf = p.nozzleFuels || {};
      return p.fuelType === f || Object.values(nf).includes(f);
    });
    pumpSel.innerHTML = filtered.length 
      ? filtered.map(p => `<option value="${p.id}">${p.name}</option>`).join('')
      : '<option value="">No pump assigned for this fuel</option>';
    if (!filtered.length) {
      const ns = document.getElementById('empSaleNozzle');
      if (ns) ns.innerHTML = '<option value="">—</option>';
    }
  }
  emp_refreshNozzles();
  emp_calcAmt();
  // Update price display if visible
  const priceEl = document.getElementById('empFuelPrice');
  if (priceEl) priceEl.textContent = cur(EMP_PRICES[f] || 0) + '/L';
}
function emp_selPay(m) {
  empPayMode = m;
  // Update payment button highlights
  document.querySelectorAll('[data-paybtn]').forEach(btn => {
    btn.classList.toggle('btn-accent', btn.dataset.paybtn === m);
    btn.classList.toggle('btn-ghost', btn.dataset.paybtn !== m);
  });
  // Show/hide credit customer field without full re-render
  const custWrap = document.getElementById('empCustWrap');
  if (custWrap) custWrap.style.display = m === 'credit' ? '' : 'none';
}
function emp_calcAmt() {
  const price = EMP_PRICES[empSaleFuel] || 0;
  const litersEl = document.getElementById('empSaleLiters');
  const amtEl = document.getElementById('empSaleAmt');
  if (!litersEl || !amtEl) return;
  const l = parseFloat(litersEl.value) || 0;
  if (l > 0 && price > 0) {
    amtEl.dataset.manualAmt = '';
    amtEl.value = (l * price).toFixed(2);
  }
}
function emp_calcLiters() {
  const price = EMP_PRICES[empSaleFuel] || 0;
  const litersEl = document.getElementById('empSaleLiters');
  const amtEl = document.getElementById('empSaleAmt');
  if (!litersEl || !amtEl || price <= 0) return;
  const a = parseFloat(amtEl.value) || 0;
  if (a > 0) { amtEl.dataset.manualAmt = '1'; litersEl.value = (a / price).toFixed(2); }
  else amtEl.dataset.manualAmt = '';
}

function emp_recordSale() {
  const l = parseFloat(document.getElementById('empSaleLiters')?.value);
  const a = parseFloat(document.getElementById('empSaleAmt')?.value);
  const v = (document.getElementById('empSaleVeh')?.value || '').toUpperCase().trim();
  const p = parseInt(document.getElementById('empSalePump')?.value);
  if (isNaN(l)||l<=0) { toast('Enter valid liters','error'); return; }
  // No upper liter limit
  if (!v || v.length < 2) { toast('Enter valid vehicle number','error'); return; }
  if (!/^[A-Z0-9\s\-\.]+$/i.test(v)) { toast('Vehicle number has invalid characters','error'); return; }
  const amt = isNaN(a) || a <= 0 ? l * (EMP_PRICES[empSaleFuel] || 0) : a;
  if (isNaN(amt) || amt <= 0) { toast('Invalid amount','error'); return; }

  const nozzle = document.getElementById('empSaleNozzle')?.value || 'A';

  const customerEl = document.getElementById('empSaleCustomer');
  const customer = customerEl ? customerEl.value.trim() : '';
  if (empPayMode === 'credit' && !customer) { toast('Select a credit customer', 'error'); return; }

  const sale = {
    id: Date.now(), date: today(), time: emp_time(),
    fuelType: empSaleFuel, liters: l, amount: amt,
    mode: empPayMode, pump: p, nozzle,
    vehicle: sanitize(v),
    customer: customer ? sanitize(customer) : undefined,
    shift: 'Employee', employee: empState.user?.name || 'Employee'
  };

  // ── Save to employee session (for shift summary & reconciliation) ──
  empState.sales.unshift(sale);
  emp_saveSession();

  // ── Save to admin APP.data.sales + IndexedDB (shows in Sales History) ──
  if (APP.data?.sales) APP.data.sales.unshift(sale);
  db.add('sales', sale).catch(() => {});

  // ── If credit sale, update customer outstanding balance ──
  if (empPayMode === 'credit' && sale.customer) {
    const creditCust = APP.data?.creditCustomers?.find(c => c.name === sale.customer);
    if (creditCust) {
      creditCust.outstanding = (creditCust.outstanding || 0) + sale.amount;
      db.put('creditCustomers', creditCust).catch(() => {});
    }
  }

  // ── NO tank deduction here — meter reading at shift end handles inventory sync
  //    to prevent double-deduction (sale + meter reading both deducting from tank)

  auditLog('sale_add', { ...sale, source: 'employee_portal' });
  toast(`✅ Sale recorded: ${fmt(l)}L · ${cur(amt)}`, 'success');

  // Clear inputs
  const litersEl = document.getElementById('empSaleLiters');
  const amtEl    = document.getElementById('empSaleAmt');
  const vehEl    = document.getElementById('empSaleVeh');
  if (litersEl) litersEl.value = '';
  if (amtEl)    { amtEl.value = ''; amtEl.dataset.manualAmt = ''; }
  if (vehEl)    vehEl.value    = '';
  const custEl = document.getElementById('empSaleCustomer');
  if (custEl) custEl.value = '';

  emp_go('sales');
}

function emp_recordDip() {
  const tankId = parseInt(document.getElementById('empDipTank')?.value);
  const r = parseFloat(document.getElementById('empDipVal')?.value);
  if (isNaN(r)||r<=0) { toast('Enter valid dip reading','error'); return; }
  if (r > 30000) { toast('Dip reading exceeds tank capacity limit','error'); return; }

  const dip = { id: Date.now(), tankId, reading: r, time: emp_time(), date: emp_today(), method: 'direct', employee: empState.user?.name || 'Employee' };

  // Save to employee session
  empState.dipReadings.unshift(dip);
  emp_saveSession();

  // Save to admin dip store + update tank level
  APP.data?.dipReadings?.unshift(dip);
  db.add('dipReadings', dip).catch(() => {});
  const tank = APP.data?.tanks?.find(t => t.id === tankId);
  if (tank) { tank.current = r; tank.lastDip = emp_today() + ' ' + emp_time(); db.put('tanks', tank).catch(() => {}); }

  toast(`✅ Dip saved: Tank ${tankId} = ${fmt(r)} L`, 'success');
  emp_go('overview');
}

function emp_confirmEnd() {
  const cc = Object.keys(empState.closeReadings).length, tn = emp_totalNozzles();

  // Check for reconciliation mismatches
  const mismatches = [];
  emp_myPumps().forEach(p => {
    const nozzleFuels = p.nozzleFuels || {};
    p.nozzles.forEach(n => {
      const ft = nozzleFuels[n] || p.fuelType;
      const r  = emp_nozzleRecon(p.id, n, ft);
      if (r.hasClose && !r.matched && (r.meterSold > 0 || r.salesSold > 0)) {
        mismatches.push({ pump: p.name, nozzle: n, fuel: (getFuel(ft)||{short:ft}).short, ...r });
      }
    });
  });

  if (mismatches.length > 0) {
    const rows = mismatches.map(m =>
      `<div style="padding:8px 12px;background:rgba(239,68,68,0.06);border-left:3px solid var(--red);border-radius:4px;margin-bottom:6px;font-size:12px">
        <strong style="color:var(--text-0)">${m.pump} · Nozzle ${m.nozzle} (${m.fuel})</strong>
        <div style="color:var(--text-2);margin-top:2px">Meter: <strong>${fmt(m.meterSold)} L</strong> · Sales recorded: <strong>${fmt(m.salesSold)} L</strong> · Gap: <strong style="color:var(--red)">${fmt(m.diff)} L</strong></div>
      </div>`
    ).join('');
    openModal('⚠️ Sales vs Reading Mismatch',
      `<p style="color:var(--text-2);font-size:13px;margin-bottom:12px">The meter readings don't match the quick sales entered. Please review before submitting.</p>
       ${rows}
       <p style="font-size:11px;color:var(--text-3);margin-top:12px">You can go back to Sales tab to add missing entries, or submit with this difference (manager will be notified).</p>`,
      `<button class="btn btn-ghost" onclick="closeModal()">← Fix Sales</button>
       <button class="btn btn-accent" onclick="closeModal();emp_submit()">Submit With Difference</button>`);
    return;
  }

  if (cc < tn) {
    openModal('⚠️ Closing Readings Pending',
      `<p style="color:var(--accent-light);font-weight:600;margin-bottom:12px">${tn-cc} nozzle closing readings are still pending.</p><p style="color:var(--text-2);font-size:13px;margin-bottom:16px">Are you sure you want to submit?</p>`,
      `<button class="btn btn-ghost" onclick="closeModal()">Go Back</button><button class="btn btn-accent" onclick="closeModal();emp_submit()">Submit Anyway</button>`);
  } else emp_submit();
}

async function emp_submit() {
  // ── Refresh tanks from DB to get latest values before deducting ──
  try {
    const freshTanks = await db.getAll('tanks');
    if (freshTanks && freshTanks.length) APP.data.tanks = freshTanks;
  } catch(e) { console.warn('[emp_submit] Tank refresh failed:', e); }

  // ── Sync pump readings & tank levels — per nozzle fuel type ──
  const tankDeductionsTotalByFuel = {}; // fuelType -> totalLiters

  console.log('[emp_submit] openReadings:', JSON.stringify(empState.openReadings));
  console.log('[emp_submit] closeReadings:', JSON.stringify(empState.closeReadings));
  console.log('[emp_submit] myPumps:', JSON.stringify(emp_myPumps().map(p=>({id:p.id,name:p.name,nozzles:p.nozzles,nozzleFuels:p.nozzleFuels}))));
  console.log('[emp_submit] tanks before deduct:', JSON.stringify(APP.data.tanks.map(t=>({id:t.id,ft:t.fuelType,cur:t.current}))));

  emp_myPumps().forEach(pump => {
    const nozzleFuels = pump.nozzleFuels || {};
    const adminPump = APP.data.pumps.find(p => p.id === pump.id);
    let pumpHasMeterReadings = false;

    pump.nozzles.forEach(n => {
      const key    = emp_key(pump.id, n);
      const openRaw  = empState.openReadings[key];
      const closeRaw = empState.closeReadings[key];
      const open   = openRaw  !== undefined ? parseFloat(openRaw)  : null;
      const close  = closeRaw !== undefined ? parseFloat(closeRaw) : null;
      const ft     = nozzleFuels[n] || pump.fuelType;

      console.log('[emp_submit] nozzle', pump.name, 'N'+n, 'ft='+ft, 'open='+open, 'close='+close);
      // Only deduct when BOTH readings are present and close > open
      if (open !== null && close !== null && !isNaN(open) && !isNaN(close) && close > open) {
        const sold = close - open;
        pumpHasMeterReadings = true;
        tankDeductionsTotalByFuel[ft] = (tankDeductionsTotalByFuel[ft] || 0) + sold;
        console.log('[emp_submit] DEDUCT', ft, sold, 'L');
      } else {
        console.log('[emp_submit] SKIP nozzle - no valid readings');
      }

      // Update per-nozzle reading on admin pump (only with valid close)
      if (adminPump && close !== null && !isNaN(close) && close > 0) {
        if (!adminPump.nozzleReadings) adminPump.nozzleReadings = {};
        adminPump.nozzleReadings[n] = close;
      }
    });

    // If NO meter readings entered for this pump, use sales records as tank deduction source
    if (!pumpHasMeterReadings) {
      const pumpSales = empState.sales.filter(s => s.pump === pump.id);
      pumpSales.forEach(s => {
        const ft = s.fuelType || pump.fuelType;
        tankDeductionsTotalByFuel[ft] = (tankDeductionsTotalByFuel[ft] || 0) + (s.liters || 0);
      });
    }

    // Update pump aggregate currentReading
    if (adminPump) {
      if (adminPump.nozzleReadings && Object.keys(adminPump.nozzleReadings).length) {
        adminPump.currentReading = Object.values(adminPump.nozzleReadings).reduce((a, v) => a + v, 0);
      }
      db.put('pumps', adminPump).catch(() => {});
    }
  });

  // Deduct each fuel type from its tank once (combined across all pumps)
  const tankWritePromises = [];
  const deductLog = [];
  for (const [ft, liters] of Object.entries(tankDeductionsTotalByFuel)) {
    const tank = APP.data.tanks.find(t => t.fuelType === ft);
    if (tank && liters > 0) {
      const before = tank.current;
      tank.current = Math.max(0, tank.current - liters);
      tank.lastDip = emp_today();
      deductLog.push(getFuel(ft).short + ': -' + fmt(liters) + 'L (' + fmt(before) + 'L → ' + fmt(tank.current) + 'L)');
      tankWritePromises.push(db.put('tanks', tank));
    }
  }
  if (tankWritePromises.length > 0) {
    await Promise.all(tankWritePromises).catch(e => console.error('[Tank] Write failed:', e));
  }
  // Broadcast to admin tab
  try { var bc2=new BroadcastChannel('fuelbunk_sync'); bc2.postMessage({type:'EMP_SUBMITTED',deductions:tankDeductionsTotalByFuel,employee:empState.user?empState.user.name:''}); bc2.close(); } catch(e) {}
  console.log('[FuelBunk] Deductions:', JSON.stringify(tankDeductionsTotalByFuel), '| Results:', deductLog.join(', '));

  // ── Compute mismatch balances and record against employee ──
  const empUser = empState.user;
  const mismatchEntries = [];
  emp_myPumps().forEach(pump => {
    const nozzleFuels = pump.nozzleFuels || {};
    pump.nozzles.forEach(n => {
      const ft   = nozzleFuels[n] || pump.fuelType;
      const recon = emp_nozzleRecon(pump.id, n, ft);
      if (recon.hasClose && !recon.matched && recon.meterSold > 0) {
        const fuel = getFuel(ft) || { short: ft, name: ft };
        const diffLiters = recon.meterSold - recon.salesSold; // positive = employee sold but didn't record
        const diffAmount = Math.abs(diffLiters) * ((APP.data?.prices || {})[ft] || 0);
        if (Math.abs(diffLiters) >= 0.1) {
          mismatchEntries.push({
            pump: pump.name, nozzle: n, fuelType: ft, fuelName: fuel.short,
            meterSold: recon.meterSold, salesSold: recon.salesSold,
            diffLiters, diffAmount, date: emp_today(), shift: empState.shift || ''
          });
        }
      }
    });
  });

  if (mismatchEntries.length > 0 && empUser) {
    const adminEmp = APP.data.employees?.find(e => e.id === empUser.id);
    if (adminEmp) {
      if (!adminEmp.balanceEntries) adminEmp.balanceEntries = [];
      adminEmp.balanceEntries.push({
        id: Date.now(), date: emp_today(), shift: empState.shift || '',
        entries: mismatchEntries,
        totalDiffLiters: mismatchEntries.reduce((a,e) => a + Math.abs(e.diffLiters), 0),
        totalDiffAmount: mismatchEntries.reduce((a,e) => a + e.diffAmount, 0),
        status: 'pending', // 'pending' | 'settled'
        settledAt: null, settledBy: null, note: ''
      });
      adminEmp.pendingBalance = (adminEmp.pendingBalance || 0) + mismatchEntries.reduce((a,e) => a + e.diffAmount, 0);
      db.put('employees', adminEmp).catch(() => {});
      APP.data.employees = APP.data.employees.map(e => e.id === adminEmp.id ? adminEmp : e);
    }
  }

  const submitLiters = emp_totalSold(), submitRev = emp_totalRev();
  empState.sessionHistory.unshift({
    date: emp_today(), user: empUser?.name || '',
    liters: submitLiters, revenue: submitRev, salesCount: empState.sales.length,
    openReadings: { ...empState.openReadings }, closeReadings: { ...empState.closeReadings },
    sales: [...empState.sales], dipReadings: [...empState.dipReadings], timestamp: Date.now(),
    mismatches: mismatchEntries,
  });
  emp_saveHistory(); empState.active = false; emp_clearSession();
  auditLog('reading_submit', { employee: empUser?.name, liters: submitLiters, revenue: submitRev, salesCount: empState.sales.length, mismatches: mismatchEntries.length });
  const msg = mismatchEntries.length > 0
    ? `Submitted with ${mismatchEntries.length} difference(s) — Admin notified.`
    : 'Submitted successfully! Tank inventory updated.';
  toast(msg, mismatchEntries.length > 0 ? 'warning' : 'success');

  // ── Re-sync APP.data from DB so admin sees the updated tank levels ──
  try {
    const [freshTanks, freshPumps, freshSales] = await Promise.all([
      db.getAll('tanks'),
      db.getAll('pumps'),
      db.getAll('sales'),
    ]);
    // Always update from DB regardless of array length
    APP.data.tanks = freshTanks.length ? freshTanks : APP.data.tanks;
    APP.data.pumps = freshPumps.length ? freshPumps : APP.data.pumps;
    if (freshSales.length) APP.data.sales = freshSales.sort((a,b) => b.id - a.id);
    console.log('[FuelBunk] Post-submit tanks:', APP.data.tanks.map(t => t.fuelType + ':' + t.current + 'L').join(', '));
  } catch(e) { console.warn('Post-submit DB refresh failed:', e); }

  empState.page = 'complete'; renderPage();
}

function emp_share() {
  const uname = sanitize(empState.user?.name||'');
  let t = `⛽ FuelBunk Pro — Report\n📅 ${emp_today()}\n👤 ${uname}\n\n📊 Summary:\n• Liters: ${fmt(emp_totalSold())} L\n• Revenue: ${cur(emp_totalRev())}\n• Sales: ${empState.sales.length}\n\n⛽ Pump-wise:\n`;
  emp_myPumps().forEach(p => { const s=emp_pumpSold(p.id); if(s>0) t+=`• ${sanitize(p.name)} (${EMP_FUEL[p.fuelType].split(' ')[0]}): ${fmt(s)} L\n`; });
  t += '\n— ' + (APP.data?.upiName || APP.tenant?.name || 'Fuel Station');
  if (navigator.share) navigator.share({title:'Report',text:t}).catch(()=>{});
  else navigator.clipboard?.writeText(t).then(()=>toast('Copied!','success')).catch(()=>{});
}

function emp_print() {
  const ts=emp_totalSold(), tr=emp_totalRev();
  const uname = sanitize(empState.user?.name||'');
  const rows = emp_myPumps().map(p => {
    const nr = p.nozzles.map(n => { const k=emp_key(p.id,n),o=empState.openReadings[k]||0,c=empState.closeReadings[k]||0; return `<tr><td style="padding-left:24px;color:#666">Nozzle ${n}</td><td style="text-align:right;font-family:monospace">${o.toFixed(1)}</td><td style="text-align:right;font-family:monospace">${c.toFixed(1)}</td><td style="text-align:right;font-family:monospace;font-weight:700">${(c-o).toFixed(1)}</td></tr>`; }).join('');
    return `<tr style="background:#f8f9fa"><td style="font-weight:700">${sanitize(p.name)} — ${EMP_FUEL[p.fuelType].split(' ')[0]}</td><td></td><td></td><td style="text-align:right;font-weight:700">${emp_pumpSold(p.id).toFixed(1)} L</td></tr>${nr}`;
  }).join('');
  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report</title><style>body{font-family:'Segoe UI',system-ui,sans-serif;padding:30px;font-size:12px;color:#333}h1{font-size:18px;text-align:center;margin-bottom:2px}h2{font-size:13px;text-align:center;color:#666;font-weight:400;margin-bottom:16px}.meta{text-align:center;font-size:11px;color:#888;margin-bottom:20px;padding-bottom:12px;border-bottom:2px solid #d4940f}table{width:100%;border-collapse:collapse;margin-bottom:16px}th{background:#f0f0f0;text-align:left;padding:8px;font-size:10px;text-transform:uppercase;border-bottom:2px solid #ddd}td{padding:6px 8px;border-bottom:1px solid #eee;font-size:12px}.total-row{background:#fff8e6;font-weight:700}.footer{text-align:center;font-size:10px;color:#aaa;margin-top:20px;border-top:1px solid #eee;padding-top:10px}</style></head><body><h1>${APP.data?.upiName || APP.tenant?.name || 'Fuel Station'}</h1><h2>Report — ${emp_today()}</h2><div class="meta">${emp_today()} · ${uname}</div><table><thead><tr><th>Pump / Nozzle</th><th style="text-align:right">Opening</th><th style="text-align:right">Closing</th><th style="text-align:right">Sold (L)</th></tr></thead><tbody>${rows}<tr class="total-row"><td>TOTAL</td><td></td><td></td><td style="text-align:right">${ts.toFixed(1)} L</td></tr></tbody></table><table><thead><tr><th>Metric</th><th style="text-align:right">Value</th></tr></thead><tbody><tr><td>Total Revenue</td><td style="text-align:right;font-weight:700">&#8377;${tr.toFixed(2)}</td></tr><tr><td>Sales</td><td style="text-align:right">${empState.sales.length}</td></tr><tr><td>Cash</td><td style="text-align:right">&#8377;${emp_totalCash().toFixed(2)}</td></tr></tbody></table><div class="footer">FuelBunk Pro — Auto Generated<br>Signature: ________________</div></body></html>`;
  const empBlob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const empUrl = URL.createObjectURL(empBlob);
  const rpw = window.open(empUrl, '_blank');
  if (rpw && !rpw.closed) {
    setTimeout(() => { try { rpw.focus(); } catch(e){} URL.revokeObjectURL(empUrl); }, 2000);
  } else {
    const _close = '<button onclick="document.getElementById(\'reportOverlay\').remove()" style="background:#d4940f;color:#000;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#10005; Close</button>';
    const _print = '<button onclick="document.getElementById(\'reportFrame\').contentWindow.print()" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#128424; Print / Save PDF</button>';
    const _dl    = '<a href="' + empUrl + '" download="shift-report.html" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px;text-decoration:none">&#8595; Download</a>';
    const _tb    = '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1a1a2e;border-bottom:2px solid #d4940f;flex-shrink:0">' + _close + '<span style="color:#fff;font-size:13px;font-weight:600;flex:1">FuelBunk Pro &#8212; Report</span>' + _print + _dl + '</div>';
    const _ov    = document.createElement('div');
    _ov.id = 'reportOverlay';
    _ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column';
    _ov.innerHTML = _tb + '<iframe id="reportFrame" src="' + empUrl + '" style="flex:1;border:none;width:100%;height:100%"></iframe>';
    const _ex = document.getElementById('reportOverlay'); if (_ex) _ex.remove();
    document.body.appendChild(_ov);
  }
}

function emp_logout() {
  auditLog('logout', { employee: empState.user?.name });
  appLogout(); // appLogout() now saves session before clearing state
}

// ═══════════════════════════════════════════════════════════════
// LOGIN & AUTH SYSTEM
// ═══════════════════════════════════════════════════════════════

// ADMIN_USERS — populated from active tenant config
// Falls back to default if no tenant selected (demo mode)
let ADMIN_USERS = (() => {
  try {
    const t = JSON.parse(localStorage.getItem('fb_active_tenant') || 'null');
    if (t && t.adminUsers && t.adminUsers.length > 0) return t.adminUsers;
  } catch {}
  return [
    { id: 1, name: 'Demo Owner', username: 'admin', passHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', role: 'Owner' },
  ];
})();

function loadSession() {
  try {
    const raw = localStorage.getItem('fb_session');
    if (!raw) return false;
    const s = verifyData(raw);
    if (!s || !validateSessionShape(s)) {
      localStorage.removeItem('fb_session');
      return false;
    }
    // Check session age
    if (Date.now() - s.timestamp > SESSION_MAX_AGE) {
      localStorage.removeItem('fb_session');
      return false;
    }
    // Check idle timeout
    if (s.lastActive && Date.now() - s.lastActive > SESSION_IDLE_TIMEOUT) {
      localStorage.removeItem('fb_session');
      return false;
    }
    APP.loggedIn = true; APP.role = s.role; APP.adminUser = s.adminUser || null;
    return true;
  } catch { return false; }
}
function saveSession() {
  try {
    const data = {
      loggedIn: APP.loggedIn, role: APP.role, adminUser: APP.adminUser,
      timestamp: Date.now(), lastActive: Date.now()
    };
    localStorage.setItem('fb_session', signData(data));
  } catch {}
}
function clearSession() {
  try { localStorage.removeItem('fb_session'); } catch {}
  APP.loggedIn = false; APP.role = null; APP.adminUser = null;
  clearTimeout(idleTimer);
}

function showLoginScreen() {
  // Hide app shell
  document.getElementById('sidebar').style.display = 'none';
  document.querySelector('.main-area').style.display = 'none';

  var el = document.getElementById('loginScreen');
  if (!el) {
    el = document.createElement('div');
    el.id = 'loginScreen';
    document.getElementById('app').appendChild(el);
  }
  el.style.display = '';

  // Build options using string concat (safe from ordering issues)
  var empOpts = '';
  for (var i = 0; i < EMP_LIST.length; i++) {
    empOpts += '<option value="' + EMP_LIST[i].id + '">' + sanitize(EMP_LIST[i].name) + ' — ' + sanitize(EMP_LIST[i].role) + '</option>';
  }

  el.innerHTML =
    '<div class="login-screen"><div class="login-container">' +
    '<div class="login-hero">' +
      '<div class="login-logo">\u26FD</div>' +
      '<h1 class="login-title">FuelBunk Pro</h1>' +
      '<p class="login-sub">' + (APP.tenant ? sanitize(APP.tenant.name) + (APP.tenant.location ? ', ' + sanitize(APP.tenant.location) : '') : 'FuelBunk Pro') + '</p>' +
    '</div>' +
    '<div class="login-tabs">' +
      '<button class="login-tab active" id="ltAdmin" onclick="switchLoginTab(\'admin\')">\uD83D\uDD11 Admin Login</button>' +
      '<button class="login-tab" id="ltEmp" onclick="switchLoginTab(\'employee\')">\uD83E\uDDD1\u200D\uD83D\uDD27 Employee Login</button>' +
    '</div>' +
    '<div id="adminLoginForm" class="login-card">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">' +
        '<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,var(--accent),var(--accent-light));display:grid;place-items:center;font-size:18px">\uD83D\uDD11</div>' +
        '<div><div class="fw-800" style="color:var(--text-0);font-size:16px">Admin / Owner Login</div><div style="font-size:11px;color:var(--text-3)">Full access to management dashboard</div></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Username</label><input class="form-input" id="adminUser" placeholder="Enter username" autocomplete="username" /></div>' +
      '<div class="form-group"><label class="form-label">Password</label><input class="form-input" id="adminPass" type="password" placeholder="Enter password" autocomplete="current-password" onkeydown="if(event.key===\'Enter\')doAdminLogin()" /></div>' +
      '<button class="btn btn-accent btn-block" style="padding:14px;font-size:14px;margin-top:6px" onclick="doAdminLogin()">\uD83D\uDD10 Login as Admin</button>' +
    '</div>' +
    '<div id="empLoginForm" class="login-card" style="display:none">' +
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:18px">' +
        '<div style="width:42px;height:42px;border-radius:10px;background:linear-gradient(135deg,var(--green),#34d399);display:grid;place-items:center;font-size:18px">\uD83E\uDDD1\u200D\uD83D\uDD27</div>' +
        '<div><div class="fw-800" style="color:var(--text-0);font-size:16px">Employee Login</div><div style="font-size:11px;color:var(--text-3)">Enter meter readings &amp; record sales</div></div>' +
      '</div>' +
      '<div class="form-group"><label class="form-label">Select Your Name</label><select class="form-input" id="empLoginName2">' + empOpts + '</select></div>' +
      '<div class="form-group"><label class="form-label">PIN (Last 4 digits of phone)</label><input class="form-input" id="empLoginPin2" type="tel" maxlength="4" placeholder="Enter 4-digit PIN" inputmode="numeric" autocomplete="off" onkeydown="if(event.key===\'Enter\')doEmpLogin()" /></div>' +
      '<button class="btn btn-block" style="background:var(--green);color:#fff;padding:14px;font-size:14px;margin-top:6px" onclick="doEmpLogin()">\uD83E\uDDD1\u200D\uD83D\uDD27 Login</button>' +
    '</div>' +
    '<div class="login-footer">FuelBunk Pro v3.0 &copy; 2026 &nbsp;·&nbsp; <a href="#" onclick="mt_switchStation();return false;" style="color:var(--accent-light);text-decoration:none;font-weight:600;">🏪 Switch Station</a></div>' +
    '</div></div>';

  setTimeout(function() { var f = document.getElementById('adminUser'); if (f) f.focus(); }, 300);
}

function switchLoginTab(tab) {
  document.getElementById('ltAdmin').className = 'login-tab' + (tab === 'admin' ? ' active' : '');
  document.getElementById('ltEmp').className = 'login-tab' + (tab === 'employee' ? ' active' : '');
  document.getElementById('adminLoginForm').style.display = tab === 'admin' ? '' : 'none';
  document.getElementById('empLoginForm').style.display = tab === 'employee' ? '' : 'none';
}

async function doAdminLogin() {
  var u = (document.getElementById('adminUser').value || '').trim().toLowerCase();
  var p = document.getElementById('adminPass').value || '';
  if (!u || !p) { toast('Enter credentials', 'error'); return; }
  if (!checkRateLimit('admin_' + u)) return;
  var pHash = await hashPassword(p);
  var admin = null;
  for (var i = 0; i < ADMIN_USERS.length; i++) {
    if (ADMIN_USERS[i].username === u && ADMIN_USERS[i].passHash === pHash) { admin = ADMIN_USERS[i]; break; }
  }
  if (!admin) { recordFailedLogin('admin_' + u); toast('Invalid username or password', 'error'); return; }
  recordSuccessLogin('admin_' + u);
  APP.loggedIn = true; APP.role = 'admin'; APP.adminUser = { id: admin.id, name: admin.name, role: admin.role };
  saveSession(); enterApp();
  auditLog('login', { username: u, role: admin.role });
  toast('Welcome ' + sanitize(admin.name) + '!', 'success');
}

async function doEmpLogin() {
  var id = parseInt(document.getElementById('empLoginName2').value);
  var pin = document.getElementById('empLoginPin2').value || '';
  var emp = null;
  for (var i = 0; i < EMP_LIST.length; i++) { if (EMP_LIST[i].id === id) { emp = EMP_LIST[i]; break; } }
  if (!emp) { toast('Select employee', 'error'); return; }
  if (!checkRateLimit('emp_' + id)) return;
  var pinHash = await hashPassword(pin);
  if (pinHash !== emp.pinHash) { recordFailedLogin('emp_' + id); toast('Incorrect PIN.', 'error'); return; }
  recordSuccessLogin('emp_' + id);
  APP.loggedIn = true; APP.role = 'employee'; saveSession();

  // Try to restore existing session for this employee (re-login during same shift)
  var restored = false;
  try {
    var raw = localStorage.getItem('fb_emp_session');
    console.log('[doEmpLogin] fb_emp_session exists:', !!raw);
    if (raw) {
      var saved = verifyData(raw);
      console.log('[doEmpLogin] session valid:', !!saved, saved ? 'active='+saved.active+' empId='+saved?.user?.id+' sales='+saved?.sales?.length+' opens='+Object.keys(saved?.openReadings||{}).length : '');
      if (saved && saved.user && saved.user.id === emp.id && saved.active) {
        // Same employee, session still active — restore it
        empState = { ...empState, ...saved };
        restored = true;
        console.log('[doEmpLogin] RESTORED session: sales='+empState.sales.length+' opens='+Object.keys(empState.openReadings).length+' closes='+Object.keys(empState.closeReadings).length+' page='+empState.page);
      } else {
        console.log('[doEmpLogin] session NOT restored - id match:', saved?.user?.id === emp.id, 'active:', saved?.active);
      }
    }
  } catch(e) { console.error('[doEmpLogin] restore error:', e); }

  if (!restored) {
    // Fresh session — pre-fill opening readings from last closing readings stored on pumps
    // Use APP.data.pumps directly because getEmpPumps() strips nozzleReadings
    var freshOpenings = {};
    (APP.data?.pumps || []).forEach(function(p) {
      var nr = p.nozzleReadings || {};
      var labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
      labels.forEach(function(n) {
        var k = emp_key(p.id, n);
        if (nr[n] !== undefined && nr[n] > 0) freshOpenings[k] = nr[n];
      });
    });
    empState.user = { id: emp.id, name: emp.name, role: emp.role, permissions: emp.permissions || {} };
    empState.active = true;
    empState.openReadings = freshOpenings; // last close becomes this shift's open
    empState.closeReadings = {}; empState.sales = []; empState.dipReadings = [];
    empState.page = 'readings';
    console.log('[doEmpLogin] Pre-filled openings from last close:', JSON.stringify(freshOpenings));
  } else {
    // Restore user object with latest data (in case name/perms changed)
    empState.user = { id: emp.id, name: emp.name, role: emp.role, permissions: emp.permissions || {} };
    empState.active = true;
    // Always land on readings page after re-login (never stay on 'login' page)
    if (!empState.page || empState.page === 'login') empState.page = 'readings';
  }

  // Set correct default fuel for this employee's allocation
  var rPumps = getEmpPumps();
  var rFuels = [];
  rPumps.forEach(function(p) {
    (p.nozzles || []).forEach(function(n) {
      var ft = (p.nozzleFuels || {})[n] || p.fuelType;
      if (!rFuels.includes(ft)) rFuels.push(ft);
    });
  });
  if (rFuels.length > 0) empSaleFuel = rFuels[0];

  emp_saveSession();
  enterApp();
  auditLog('login', { employee: emp.name, role: emp.role });
  var msg = restored
    ? 'Welcome back ' + sanitize(emp.name) + '! Previous session restored (' + empState.sales.length + ' sales).'
    : 'Welcome ' + sanitize(emp.name) + '!';
  toast(msg, 'success');
}

function enterApp() {
  var loginEl = document.getElementById('loginScreen');
  if (loginEl) loginEl.style.display = 'none';
  document.getElementById('sidebar').style.display = '';
  document.querySelector('.main-area').style.display = '';

  // Start idle timer for session timeout
  resetIdleTimer();

  // Update tenant name in sidebar footer
  if (APP.tenant) {
    const footEl = document.getElementById('tenantNameFoot');
    if (footEl) footEl.textContent = APP.tenant.name || 'FuelBunk Pro';
  }

  if (APP.role === 'admin') {
    document.getElementById('sidebar').classList.remove('emp-hidden');
    document.querySelector('.main-area').classList.remove('emp-fullwidth');
    var ini = 'AD';
    if (APP.adminUser && APP.adminUser.name) ini = APP.adminUser.name.split(' ').map(function(w){return w[0]}).join('');
    document.getElementById('avatarEl').textContent = ini;
    // Always start at dashboard on admin login — ignore any stale hash/page from employee session
    APP.page = 'dashboard';
    window.location.hash = '';
    buildNav(); renderPage();
    // Check backup reminder for admin
    checkBackupReminder();
  } else {
    document.getElementById('sidebar').classList.add('emp-hidden');
    document.querySelector('.main-area').classList.add('emp-fullwidth');
    var eIni = 'EM';
    if (empState.user && empState.user.name) eIni = empState.user.name.split(' ').map(function(w){return w[0]}).join('');
    document.getElementById('avatarEl').textContent = eIni;
    APP.page = 'employee';
    document.getElementById('pageTitle').textContent = 'Employee Portal';
    document.getElementById('breadcrumb').textContent = sanitize(empState.user ? empState.user.name : 'Employee') + ' \u00B7 ' + emp_today();
    renderPage();
  }
}

function appLogout() {
  auditLog('logout', { user: APP.role === 'admin' ? APP.adminUser?.name : empState.user?.name, role: APP.role });
  if (APP.role === 'employee') {
    // Save current session BEFORE any state changes so re-login can restore it
    // This handles both emp_logout() and direct ⏻ topbar button calls
    if (empState.active && empState.user) {
      emp_saveSession(); // preserve readings + sales for re-login
      console.log('[appLogout] saved session: sales='+empState.sales.length+' opens='+Object.keys(empState.openReadings).length+' closes='+Object.keys(empState.closeReadings).length);
    }
    // Freeze in-memory state (DO NOT clear localStorage session)
    empState.active = false;
    empState.page = 'login';
  }
  clearSession();
  window.location.hash = '';
  showLoginScreen();
}

function openCreditCustomerModal() {
  openModal('Add Credit Customer', `
    <div class="form-group"><label class="form-label">Customer Name</label><input class="form-input" id="ccName" placeholder="Enter full name or company" /></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Type</label><select class="form-input" id="ccType"><option value="Fleet">Fleet</option><option value="Government">Government</option><option value="Individual">Individual</option></select></div>
      <div class="form-group"><label class="form-label">Credit Limit (₹)</label><input class="form-input" id="ccLimit" type="number" placeholder="500000" /></div>
    </div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-input" id="ccPhone" placeholder="10-digit mobile" /></div>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-accent" onclick="saveCreditCustomer()">💾 Save Customer</button>`);
}

function saveCreditCustomer() {
  const name = (document.getElementById('ccName').value || '').trim();
  const type = document.getElementById('ccType').value;
  const limit = parseFloat(document.getElementById('ccLimit').value);
  const phone = (document.getElementById('ccPhone').value || '').trim();
  if (!name || name.length < 2) { toast('Enter customer name (min 2 chars)', 'error'); return; }
  if (isNaN(limit) || limit <= 0) { toast('Enter valid credit limit', 'error'); return; }
  if (limit > 10000000) { toast('Credit limit exceeds ₹1,00,00,000', 'error'); return; }
  const customer = {
    id: Date.now(), name: sanitize(name), type, limit, outstanding: 0,
    lastPayment: '', phone: sanitize(phone)
  };
  APP.data.creditCustomers.push(customer);
  db.add('creditCustomers', customer).catch(() => {});
  auditLog('credit_customer_add', { name, type, limit });
  closeModal();
  toast(`${sanitize(name)} added as credit customer`, 'success');
  renderPage();
}

// ── CSV EXPORTS ──────────────────────────────────────────────
function exportSalesCSV() {
  const todayIso = new Date().toISOString().slice(0,10);
  const sales = APP.salesAllTime ? APP.data.sales : APP.data.sales.filter(s => (s.date||'').slice(0,10) === todayIso);
  exportCSV('sales-' + today() + '.csv',
    ['Date', 'Time', 'Vehicle', 'Fuel', 'Liters', 'Amount', 'Pump', 'Nozzle', 'Employee', 'Payment', 'Customer'],
    sales.map(s => [s.date||today(), s.time, s.vehicle, getFuel(s.fuelType).short, s.liters, s.amount, s.pump ? 'Pump '+s.pump : '', s.nozzle||'', s.employee||'', s.mode, s.customer||'']));
}
function exportDipCSV() {
  exportCSV('dip-readings-' + today() + '.csv',
    ['Date', 'Time', 'Tank', 'Physical', 'Book Stock', 'Variance'],
    APP.data.dipReadings.map(r => [r.date, r.time, 'Tank ' + r.tankId, r.reading, r.calculated, r.reading - r.calculated]));
}
function exportPumpCSV() {
  const rows = [];
  APP.data.pumps.forEach(p => {
    const labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
    const nf = p.nozzleFuels || {};
    const nr = p.nozzleReadings || {};
    const no_ = p.nozzleOpen || {};
    const fuels = labels.map(n => nf[n] || p.fuelType);
    const allSame = fuels.every(f => f === fuels[0]);
    if (allSame) {
      const open = p.openReading || 0;
      const close = p.currentReading || 0;
      const sold = Math.max(0, close - open);
      rows.push([p.name, getFuel(fuels[0]).short, '', open.toFixed(1), close.toFixed(1), sold.toFixed(1), (sold * (APP.data.prices[fuels[0]] || 0)).toFixed(2)]);
    } else {
      labels.forEach(n => {
        const ft = nf[n] || p.fuelType;
        const open = no_[n] ?? 0;
        const close = nr[n] ?? 0;
        const sold = Math.max(0, close - open);
        rows.push([p.name, getFuel(ft).short, 'N' + n, open.toFixed(1), close.toFixed(1), sold.toFixed(1), (sold * (APP.data.prices[ft] || 0)).toFixed(2)]);
      });
    }
  });
  exportCSV('pump-report-' + today() + '.csv',
    ['Pump', 'Fuel', 'Nozzle', 'Opening', 'Closing', 'Sold (L)', 'Revenue'],
    rows);
}
function exportExpenseCSV() {
  exportCSV('expenses-' + today() + '.csv',
    ['Date', 'Category', 'Description', 'Amount'],
    APP.data.expenses.map(e => [e.date, e.category, e.desc, e.amount]));
}

function shareSalesSummary() {
  const totalRev = APP.data.sales.reduce((a, s) => a + s.amount, 0);
  const totalL = APP.data.sales.reduce((a, s) => a + s.liters, 0);
  const text = `📊 FuelBunk Pro — Daily Summary\n📅 ${today()}\n💰 Revenue: ${cur(totalRev)}\n⛽ Liters Sold: ${fmt(totalL)} L\n🧾 Transactions: ${APP.data.sales.length}\n\n— ' + (APP.data?.upiName || APP.tenant?.name || 'FuelBunk Pro') + `;
  shareData('Daily Sales Summary', text);
}

function exportAllData() {
  const blob = new Blob([JSON.stringify(APP.data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fuelbunk-backup-${today()}.json`;
  a.click();
  localStorage.setItem('fb_last_backup', String(Date.now()));
  auditLog('data_export', { type: 'full_backup', date: today() });
  toast('Full backup exported', 'success');
}

function confirmResetData() {
  openModal('⚠️ Reset All Data', `
    <p style="color:var(--red);font-weight:600;margin-bottom:12px">This will delete ALL data and reset to demo data. This cannot be undone.</p>
    <p style="color:var(--text-3);font-size:13px">Are you sure you want to proceed?</p>
  `, `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button><button class="btn btn-red" onclick="resetData()">⚠ Yes, Reset Everything</button>`);
}

async function resetData() {
  auditLog('data_clear', { type: 'full_reset', date: today() });
  const stores = ['sales', 'tanks', 'pumps', 'dipReadings', 'expenses', 'fuelPurchases', 'creditCustomers', 'employees', 'shifts', 'settings', 'pendingSync'];
  for (const s of stores) { await db.clear(s).catch(() => {}); }
  await seedDatabase();
  APP.data = { ...SEED };
  closeModal();
  toast('Data reset to demo', 'info');
  renderPage();
}

// ── PDF REPORTS ──────────────────────────────────────────────
function generateDSRReport() {
  const D = APP.data;
  const todayIso = new Date().toISOString().slice(0, 10);
  const todaySales = D.sales.filter(s => (s.date || '').slice(0, 10) === todayIso);
  const totalRev = todaySales.reduce((a, s) => a + s.amount, 0);
  const totalL = todaySales.reduce((a, s) => a + s.liters, 0);
  const totalStock = D.tanks.reduce((a, t) => a + t.current, 0);
  const openingStock = totalStock + totalL; // closing stock + today's sold = opening stock

  const pumpRows = D.pumps.flatMap(p => {
    const labels = p.nozzleLabels || (p.nozzles === 1 ? ['A'] : p.nozzles === 2 ? ['A','B'] : ['A','B','C'].slice(0, p.nozzles));
    const nf = p.nozzleFuels || {};
    const nr = p.nozzleReadings || {};
    const no_ = p.nozzleOpen || {};
    const fuels = labels.map(n => nf[n] || p.fuelType);
    const allSame = fuels.every(f => f === fuels[0]);
    if (allSame) {
      const fuel = getFuel(fuels[0]);
      const open = p.openReading || 0;
      const close = p.currentReading || 0;
      const sold = Math.max(0, close - open);
      const price = (D.prices || {})[fuels[0]] || 0;
      return [`<tr><td>${p.name}</td><td style="color:${fuel.color}">${fuel.short}</td><td class="r">${fmt(open)}</td><td class="r">${fmt(close)}</td><td class="r fw-700">${fmt(sold)}</td><td class="r">${cur(sold * price)}</td></tr>`];
    }
    return labels.map((n, i) => {
      const ft = nf[n] || p.fuelType;
      const fuel = getFuel(ft);
      const open = no_[n] ?? 0;
      const close = nr[n] ?? 0;
      const sold = Math.max(0, close - open);
      const price = (D.prices || {})[ft] || 0;
      return `<tr>${i === 0 ? `<td rowspan="${labels.length}" style="vertical-align:middle">${p.name}</td>` : ''}<td style="color:${fuel.color}">N${n}: ${fuel.short}</td><td class="r">${fmt(open)}</td><td class="r">${fmt(close)}</td><td class="r fw-700">${fmt(sold)}</td><td class="r">${cur(sold * price)}</td></tr>`;
    });
  }).join('');

  const paymentSummary = ['cash', 'upi', 'card', 'credit'].map(m => {
    const total = todaySales.filter(s => s.mode === m).reduce((a, s) => a + s.amount, 0);
    return `<tr><td style="text-transform:capitalize">${m}</td><td class="r fw-700">${cur(total)}</td></tr>`;
  }).join('');

  const empSalesRows = todaySales.slice(0, 50).map(s =>
    `<tr><td>${s.time}</td><td>${sanitize(s.vehicle||'')}</td><td>${getFuel(s.fuelType).short}</td><td class="r">${fmt(s.liters)}</td><td class="r">${cur(s.amount)}</td><td>${s.employee||'—'}</td><td style="text-transform:capitalize">${s.mode}</td></tr>`
  ).join('');

  generatePDFReport('Daily Shift Report (DSR) - ' + today(), [
    `<div class="section"><h3>Summary</h3><div class="summary-grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px">
      <div class="summary-box"><div class="label">Opening Stock</div><div class="value">${fmt(openingStock)} L</div></div>
      <div class="summary-box"><div class="label">Closing Stock</div><div class="value">${fmt(totalStock)} L</div></div>
      <div class="summary-box"><div class="label">Total Sold</div><div class="value">${fmt(totalL)} L</div></div>
      <div class="summary-box"><div class="label">Transactions</div><div class="value">${todaySales.length}</div></div>
      <div class="summary-box"><div class="label">Revenue</div><div class="value text-green">${cur(totalRev)}</div></div>
      <div class="summary-box"><div class="label">Cash Collected</div><div class="value">${cur(todaySales.filter(s=>s.mode==='cash').reduce((a,s)=>a+s.amount,0))}</div></div>
      <div class="summary-box"><div class="label">Date</div><div class="value">${today()}</div></div>
    </div></div>`,
    `<div class="section"><h3>Pump Readings</h3><table><thead><tr><th>Pump</th><th>Fuel</th><th class="r">Opening</th><th class="r">Closing</th><th class="r">Sold (L)</th><th class="r">Revenue</th></tr></thead><tbody>${pumpRows}</tbody></table></div>`,
    `<div class="section"><h3>Payment Summary</h3><table><thead><tr><th>Mode</th><th class="r">Amount</th></tr></thead><tbody>${paymentSummary}</tbody></table></div>`,
    `<div class="section"><h3>Sales Transactions (Today)</h3><table><thead><tr><th>Time</th><th>Vehicle</th><th>Fuel</th><th class="r">Liters</th><th class="r">Amount</th><th>Employee</th><th>Payment</th></tr></thead><tbody>${empSalesRows || '<tr><td colspan="7" style="text-align:center;color:#999">No sales today</td></tr>'}</tbody></table></div>`,
  ]);
  toast('DSR Report generated', 'success');
}

function generatePLReport() {
  const D = APP.data;
  const totalRev = D.sales.reduce((a, s) => a + s.amount, 0);
  const cogs = D.sales.reduce((a, s) => a + s.liters * (D.purchasePrices[s.fuelType] || 0), 0);
  const gross = totalRev - cogs;
  const salary = D.employees.reduce((a, e) => a + (e.salary || 0), 0);
  // Use real expenses from DB grouped by category
  const expenseMap = {};
  D.expenses.forEach(e => {
    if (e.source === 'fuel_purchase') return; // skip fuel purchases (already in COGS)
    const cat = e.category || 'Other';
    expenseMap[cat] = (expenseMap[cat] || 0) + (e.amount || 0);
  });
  const totalOtherExp = Object.values(expenseMap).reduce((a, v) => a + v, 0);
  const totalExp = salary + totalOtherExp;
  const net = gross - totalExp;

  const expRows = Object.entries(expenseMap).map(([cat, amt]) =>
    `<tr><td>${sanitize(cat)}</td><td class="r">${cur(amt)}</td></tr>`
  ).join('') || '<tr><td colspan="2" style="color:#999;text-align:center">No expenses recorded</td></tr>';

  generatePDFReport('Profit & Loss Statement - ' + today(), [
    `<div class="section"><h3>Revenue & Cost of Goods</h3><table>
      <tr><td>Total Revenue</td><td class="r fw-700 text-green">${cur(totalRev)}</td></tr>
      <tr><td>Cost of Goods Sold (fuel purchase cost)</td><td class="r fw-700 text-red">(${cur(cogs)})</td></tr>
      <tr style="background:#f8f9fa"><td class="fw-700">Gross Profit</td><td class="r fw-700">${cur(gross)}</td></tr>
    </table></div>`,
    `<div class="section"><h3>Operating Expenses</h3><table>
      <tr><td>Staff Salaries</td><td class="r">${cur(salary)}</td></tr>
      ${expRows}
      <tr style="background:#f8f9fa"><td class="fw-700">Total Expenses</td><td class="r fw-700">${cur(totalExp)}</td></tr>
    </table></div>`,
    `<div class="section"><h3>Net Profit</h3><div class="summary-grid">
      <div class="summary-box"><div class="label">Net Profit</div><div class="value ${net >= 0 ? 'text-green' : 'text-red'}">${cur(Math.abs(net))}${net < 0 ? ' (Loss)' : ''}</div></div>
      <div class="summary-box"><div class="label">Net Margin</div><div class="value">${totalRev > 0 ? (net / totalRev * 100).toFixed(1) : '0'}%</div></div>
      <div class="summary-box"><div class="label">Gross Margin</div><div class="value">${totalRev > 0 ? (gross / totalRev * 100).toFixed(1) : '0'}%</div></div>
    </div></div>`,
  ]);
  toast('P&L Report generated', 'success');
}

function generateCreditReport() {
  const rows = APP.data.creditCustomers.map(c =>
    `<tr><td>${sanitize(c.name)}</td><td>${c.type}</td><td class="r">${cur(c.limit)}</td><td class="r fw-700 text-red">${cur(c.outstanding)}</td><td class="r" style="${c.outstanding>c.limit?'color:#dc2626':''}">${cur(Math.max(0,c.limit-c.outstanding))}</td><td>${c.lastPayment}</td></tr>`
  ).join('');
  generatePDFReport('Credit Outstanding Report - ' + today(), [
    `<div class="section"><h3>Customer Wise Outstanding</h3><table><thead><tr><th>Customer</th><th>Type</th><th class="r">Limit</th><th class="r">Outstanding</th><th class="r">Available</th><th>Last Payment</th></tr></thead><tbody>${rows}</tbody></table></div>`,
    `<div class="section"><h3>Summary</h3><div class="summary-grid">
      <div class="summary-box"><div class="label">Total Outstanding</div><div class="value text-red">${cur(APP.data.creditCustomers.reduce((a, c) => a + c.outstanding, 0))}</div></div>
      <div class="summary-box"><div class="label">Total Limit</div><div class="value">${cur(APP.data.creditCustomers.reduce((a, c) => a + c.limit, 0))}</div></div>
      <div class="summary-box"><div class="label">Accounts</div><div class="value">${APP.data.creditCustomers.length}</div></div>
    </div></div>`,
  ]);
}
function generateTankReport() { generateDSRReport(); }
function generatePumpReport() { generateDSRReport(); }
function generateGSTReport() { toast('GST report feature coming soon', 'info'); }

function generateShiftReport() {
  const D = APP.data;
  const now = new Date();
  const monthName = now.toLocaleString('default', { month: 'long', year: 'numeric' });
  const thisMonth = now.toISOString().slice(0, 7); // YYYY-MM

  // Collect shift submissions from auditLog
  const submits = (APP.auditLog || []).filter(a =>
    a.action === 'reading_submit' && a.timestamp && a.timestamp.startsWith(thisMonth)
  );

  // Also collect login events
  const logins = (APP.auditLog || []).filter(a =>
    a.action === 'login' && a.role === 'employee' && a.timestamp && a.timestamp.startsWith(thisMonth)
  );

  // Build per-employee stats
  const empStats = {};
  D.employees.forEach(e => {
    empStats[e.name] = {
      name: e.name,
      role: e.role,
      shift: e.shift || '',
      submits: [],
      logins: 0,
      totalLiters: 0,
      totalRevenue: 0,
    };
  });

  submits.forEach(a => {
    const n = a.user || a.details?.employee;
    if (!n) return;
    if (!empStats[n]) empStats[n] = { name: n, role: '—', shift: '—', submits: [], logins: 0, totalLiters: 0, totalRevenue: 0 };
    empStats[n].submits.push({ date: a.timestamp.slice(0, 10), liters: a.details?.liters || 0, revenue: a.details?.revenue || 0 });
    empStats[n].totalLiters += a.details?.liters || 0;
    empStats[n].totalRevenue += a.details?.revenue || 0;
  });

  logins.forEach(a => {
    const n = a.user || a.details?.employee;
    if (n && empStats[n]) empStats[n].logins++;
  });

  const rows = Object.values(empStats).map(e => {
    const shiftBadges = (e.shift||'').split(',').map(s => s.trim()).filter(Boolean)
      .map(s => `<span style="background:#d4940f22;color:#d4940f;font-size:9px;font-weight:700;padding:1px 6px;border-radius:3px">${s}</span>`).join(' ');
    const dateList = [...new Set(e.submits.map(s => s.date))].sort();
    const calRows = dateList.map(d =>
      `<span style="display:inline-block;font-size:9px;font-family:monospace;background:rgba(34,197,94,0.15);color:#22c55e;padding:1px 5px;border-radius:3px;margin:1px">${d}</span>`
    ).join('');
    return `
      <tr style="border-bottom:1px solid #eee">
        <td style="padding:10px 8px;font-weight:700;font-size:13px;color:#111;white-space:nowrap">${e.name}</td>
        <td style="padding:10px 8px;font-size:11px;color:#666">${e.role}</td>
        <td style="padding:10px 8px">${shiftBadges || '<span style="color:#aaa;font-size:11px">—</span>'}</td>
        <td style="padding:10px 8px;text-align:center;font-weight:800;font-size:16px;color:#22c55e">${e.submits.length}</td>
        <td style="padding:10px 8px;text-align:center;font-size:13px;color:#3b82f6">${e.logins}</td>
        <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:13px;font-weight:700">${e.totalLiters.toFixed(1)} L</td>
        <td style="padding:10px 8px;text-align:right;font-family:monospace;font-size:13px;font-weight:700;color:#16a34a">&#8377;${e.totalRevenue.toFixed(2)}</td>
        <td style="padding:10px 8px;font-size:10px;color:#555;max-width:200px">${calRows || '<span style="color:#aaa">No shifts this month</span>'}</td>
      </tr>`;
  }).join('');

  const totalShifts = Object.values(empStats).reduce((a, e) => a + e.submits.length, 0);
  const totalLiters = Object.values(empStats).reduce((a, e) => a + e.totalLiters, 0);

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><title>Employee Shift Report - ${monthName}</title>
<style>
  body{font-family:'Segoe UI',system-ui,sans-serif;padding:30px;font-size:12px;color:#1a1a1a;background:#fff}
  h1{font-size:20px;text-align:center;margin:0 0 4px}
  h2{font-size:13px;text-align:center;color:#666;font-weight:400;margin:0 0 20px}
  .meta{display:flex;justify-content:space-between;padding:10px 16px;background:#f8f9fa;border-radius:8px;margin-bottom:20px;font-size:11px;color:#888}
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .box{background:#f8f9fa;border-radius:8px;padding:14px;text-align:center}
  .box-val{font-size:22px;font-weight:800;color:#d4940f;font-family:monospace}
  .box-lbl{font-size:9px;color:#999;text-transform:uppercase;letter-spacing:0.8px;margin-top:4px;font-weight:700}
  table{width:100%;border-collapse:collapse}
  th{background:#f0f0f0;text-align:left;padding:8px;font-size:10px;text-transform:uppercase;letter-spacing:0.6px;border-bottom:2px solid #ddd;color:#555}
  .footer{text-align:center;font-size:10px;color:#bbb;margin-top:24px;border-top:1px solid #eee;padding-top:12px}
</style></head>
<body>
  <h1>Employee Shift Report</h1>
  <h2>${monthName}</h2>
  <div class="meta">
    <span>Station: ${APP.data?.upiName || APP.tenant?.name || 'FuelBunk Pro'}</span>
    <span>Generated: ${new Date().toLocaleString('en-IN')}</span>
    <span>Employees: ${D.employees.length}</span>
  </div>
  <div class="summary">
    <div class="box"><div class="box-val">${D.employees.length}</div><div class="box-lbl">Total Staff</div></div>
    <div class="box"><div class="box-val">${totalShifts}</div><div class="box-lbl">Shifts Done</div></div>
    <div class="box"><div class="box-val">${totalLiters.toFixed(0)} L</div><div class="box-lbl">Total Dispensed</div></div>
    <div class="box"><div class="box-val">${D.shifts?.length || 0}</div><div class="box-lbl">Shift Types</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Employee</th><th>Role</th><th>Assigned Shift(s)</th>
      <th style="text-align:center">Shifts Done</th>
      <th style="text-align:center">Logins</th>
      <th style="text-align:right">Liters</th>
      <th style="text-align:right">Revenue</th>
      <th>Dates Active</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">FuelBunk Pro &#8212; Auto Generated &#183; Confidential</div>
</body></html>`;

  const shiftBlob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const shiftUrl = URL.createObjectURL(shiftBlob);
  const rpw = window.open(shiftUrl, '_blank');
  if (rpw && !rpw.closed) {
    setTimeout(() => { try { rpw.focus(); } catch(e){} URL.revokeObjectURL(shiftUrl); }, 2000);
  } else {
    const _close = '<button onclick="document.getElementById(\'reportOverlay\').remove()" style="background:#d4940f;color:#000;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#10005; Close</button>';
    const _print = '<button onclick="document.getElementById(\'reportFrame\').contentWindow.print()" style="background:#22c55e;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px">&#128424; Print / Save PDF</button>';
    const _dl    = '<a href="' + shiftUrl + '" download="employee-shift-report.html" style="background:#3b82f6;color:#fff;border:none;border-radius:6px;padding:6px 14px;font-weight:800;cursor:pointer;font-size:13px;text-decoration:none">&#8595; Download</a>';
    const _tb    = '<div style="display:flex;align-items:center;gap:10px;padding:10px 16px;background:#1a1a2e;border-bottom:2px solid #d4940f;flex-shrink:0">' + _close + '<span style="color:#fff;font-size:13px;font-weight:600;flex:1">FuelBunk Pro &#8212; Report</span>' + _print + _dl + '</div>';
    const _ov    = document.createElement('div');
    _ov.id = 'reportOverlay';
    _ov.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#fff;display:flex;flex-direction:column';
    _ov.innerHTML = _tb + '<iframe id="reportFrame" src="' + shiftUrl + '" style="flex:1;border:none;width:100%;height:100%"></iframe>';
    const _ex = document.getElementById('reportOverlay'); if (_ex) _ex.remove();
    document.body.appendChild(_ov);
  }
}
window.generateShiftReport = generateShiftReport;
window.generateDSRReport = generateDSRReport;
window.generatePLReport = generatePLReport;
window.generateCreditReport = generateCreditReport;
window.generateTankReport = generateTankReport;
window.generatePumpReport = generatePumpReport;
window.generateGSTReport = generateGSTReport;
window.exportSalesCSV = exportSalesCSV;
window.exportPumpCSV = exportPumpCSV;
window.exportDipCSV = exportDipCSV;
window.exportExpenseCSV = exportExpenseCSV;
window.exportAllData = exportAllData;
window.shareSalesSummary = shareSalesSummary;
window.saveUPISettings = saveUPISettings;
window.openPriceModal = openPriceModal;
window.savePrices = savePrices;
window.savePurchasePrices = savePurchasePrices;
window.openPurchasePriceModal = openPurchasePriceModal;
window.confirmResetData = confirmResetData;
window.enableNotifications = enableNotifications;
window.expCategoryChanged = expCategoryChanged;
window.expToggleFuel = expToggleFuel;
window.expCalcTax = expCalcTax;
window.expCalcGST = expCalcGST;
window.expCalcTotal = expCalcTotal;

// ── DATA INIT ────────────────────────────────────────────────
async function seedDatabase() {
  for (const t of SEED.tanks) await db.put('tanks', t).catch(() => {});
  for (const p of SEED.pumps) await db.put('pumps', p).catch(() => {});
  for (const s of SEED.shifts) await db.put('shifts', s).catch(() => {});
  await db.bulkPut('employees', SEED.employees).catch(() => {});
  await db.bulkPut('sales', SEED.sales).catch(() => {});
  await db.bulkPut('creditCustomers', SEED.creditCustomers).catch(() => {});
  await db.bulkPut('expenses', SEED.expenses).catch(() => {});
  await db.bulkPut('fuelPurchases', SEED.fuelPurchases).catch(() => {});
  await db.bulkPut('dipReadings', SEED.dipReadings).catch(() => {});
  await db.setSetting('prices', SEED.prices);
  await db.setSetting('purchasePrices', SEED.purchasePrices);
  await db.setSetting('seeded', true);
}

async function loadData() {
  try {
    await db.ready;
  } catch (e) {
    console.error('IndexedDB init failed:', e);
    APP.data = { ...SEED };
    return;
  }

  // If db connection wasn't established (blocked/timeout), use SEED
  if (!db.db) {
    console.warn('No DB connection, using seed data');
    APP.data = { ...SEED };
    return;
  }

  const seeded = await db.getSetting('seeded').catch(() => null);
  // Load UPI / payment settings
  APP.data.razorpayKey = await db.getSetting('razorpayKey').catch(() => '') || '';
  if (!seeded) await seedDatabase().catch(() => {});

  try {
    APP.data = {
      tanks: await db.getAll('tanks'),
      pumps: await db.getAll('pumps'),
      shifts: await db.getAll('shifts'),
      employees: await db.getAll('employees'),
      sales: (await db.getAll('sales')).sort((a, b) => b.id - a.id),
      creditCustomers: await db.getAll('creditCustomers'),
      expenses: (await db.getAll('expenses')).sort((a, b) => b.id - a.id),
      fuelPurchases: (await db.getAll('fuelPurchases')).sort((a, b) => b.id - a.id),
      dipReadings: (await db.getAll('dipReadings')).sort((a, b) => b.id - a.id),
      prices: await db.getSetting('prices') || SEED.prices,
      purchasePrices: await db.getSetting('purchasePrices') || SEED.purchasePrices,
      weekly: [],  // will be computed in renderDashboard from real sales
      upiVPA: await db.getSetting('upiVPA') || SEED.upiVPA,
      upiName: await db.getSetting('upiName') || SEED.upiName,
      stationCode: await db.getSetting('stationCode') || '',
      omcName: await db.getSetting('omcName') || '',
    };

    // Note: empty tanks is valid (fresh install, no tanks added yet)
    // Do NOT wipe sales/employees/pumps just because tanks is empty

    // ── Backfill: ensure every fuel purchase has a matching expense entry ──
    // This handles purchases entered before the auto-expense feature was added
    const existingPurchaseExpIds = new Set(
      APP.data.expenses.filter(e => e.source === 'fuel_purchase').map(e => e.purchaseId)
    );
    const missingPurchases = APP.data.fuelPurchases.filter(p => !existingPurchaseExpIds.has(p.id));
    if (missingPurchases.length > 0) {
      const newExpenses = missingPurchases.map(p => {
        const fi = getFuel(p.fuelType) || { short: p.fuelType };
        return {
          id: p.id + 0.1, // stable ID derived from purchase
          date: p.date || today(),
          category: 'Fuel Purchase',
          desc: `${fi.short} — ${fmt(p.liters)}L @ ₹${p.rate}/L${p.invoice ? ' · ' + p.invoice : ''}`,
          amount: p.total || (p.liters * p.rate),
          source: 'fuel_purchase',
          purchaseId: p.id,
        };
      });
      for (const e of newExpenses) {
        APP.data.expenses.push(e);
        db.add('expenses', e).catch(() => {});
      }
      APP.data.expenses.sort((a, b) => (b.id || 0) - (a.id || 0));
    }
  } catch (e) {
    console.error('Data load failed, using seed data:', e);
    APP.data = { ...SEED };
  }
}

// ── PWA INSTALL ──────────────────────────────────────────────
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  APP.deferredPrompt = e;
  const banner = document.getElementById('installBanner');
  if (banner) banner.classList.add('show');
});

function installPWA() {
  if (APP.deferredPrompt) {
    APP.deferredPrompt.prompt();
    APP.deferredPrompt.userChoice.then(choice => {
      if (choice.outcome === 'accepted') toast('App installed!', 'success');
      APP.deferredPrompt = null;
      document.getElementById('installBanner').classList.remove('show');
    });
  }
}
function dismissInstall() { document.getElementById('installBanner').classList.remove('show'); }

// ── ONLINE/OFFLINE ───────────────────────────────────────────
function updateOnlineStatus() {
  const online = navigator.onLine;
  document.body.classList.toggle('is-offline', !online);
  const pill = document.getElementById('statusPill');
  if (pill) {
    pill.className = `status-pill ${online ? 'online' : 'offline'}`;
    pill.querySelector('.status-text').textContent = online ? 'Online' : 'Offline';
  }
  if (online && 'serviceWorker' in navigator && 'SyncManager' in window) {
    navigator.serviceWorker.ready.then(reg => reg.sync.register('sync-sales')).catch(() => {});
  }
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

// ── INIT ─────────────────────────────────────────────────────
function _splashProgress(pct, msg) {
  try {
    var f = document.getElementById('splash-bar-fill');
    var m = document.getElementById('splash-msg');
    if (f) f.style.width = pct + '%';
    if (m && msg) m.textContent = msg;
  } catch(e) {}
}

async function initApp() {
  _splashProgress(70, 'Initializing...');
  // Local file guard removed for standalone build

  // Check if a tenant is selected — if not, show selector screen
  _splashProgress(80, 'Loading station...');
  const _tenant = mt_getActiveTenant();
  if (!_tenant) {
    document.body.classList.add('app-ready');
    await mt_showSelector();
    return;
  }

  // Store tenant info in APP for use throughout
  APP.tenant = _tenant;

  // HTTPS redirect: REMOVED for standalone HTML build

  // Set SEED data IMMEDIATELY so app always works
  APP.data = JSON.parse(JSON.stringify(SEED));
  APP.auditLog = [];

  // Register service worker (only on deployed site)
  const isDeployed = location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.endsWith('.netlify.app') || location.hostname.endsWith('.netlify.com');
  if ('serviceWorker' in navigator && isDeployed) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js?v=5.0');
      navigator.serviceWorker.addEventListener('message', e => {
        if (e.data.type === 'SYNC_COMPLETE') toast('Data synced!', 'info');
      });
    } catch (e) { /* skip */ }
  }

  // Try IndexedDB (non-blocking: SEED is already set as fallback)
  try {
    await Promise.race([
      loadData(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('DB timeout 3s')), 3000))
    ]);
  } catch (e) {
    console.warn('DB load failed, using seed:', e);
  }

  // Clock + status
  updateClock(); setInterval(updateClock, 1000); updateOnlineStatus();

  // Cross-tab sync: admin auto-refreshes tanks when employee submits in another tab
  try {
    var syncCh = new BroadcastChannel('fuelbunk_sync');
    syncCh.onmessage = function(evt) {
      if (!evt.data || evt.data.type !== 'EMP_SUBMITTED') return;
      Promise.all([db.getAll('tanks'), db.getAll('pumps'), db.getAll('sales')]).then(function(res) {
        var freshTanks = res[0], freshPumps = res[1], freshSales = res[2];
        if (freshTanks.length && APP.data) {
          APP.data.tanks = freshTanks;
          APP.data.pumps = freshPumps;
          if (freshSales.length) APP.data.sales = freshSales.sort(function(a,b){ return b.id - a.id; });
        }
        if (APP.role === 'admin') {
          var name = evt.data.employee || 'Employee';
          var ded = evt.data.deductions || {};
          var parts = Object.keys(ded).map(function(ft){ return getFuel(ft).short + ': ' + fmt(ded[ft]) + 'L'; });
          toast(name + ' submitted' + (parts.length ? ' — ' + parts.join(', ') + ' deducted' : ''), 'info');
          if (APP.page === 'tanks' || APP.page === 'dashboard') renderPage();
        }
      }).catch(function(){});
    };
  } catch(e) {}

  // Idle timer
  ['click','keydown','touchstart','scroll'].forEach(evt =>
    document.addEventListener(evt, resetIdleTimer, { passive: true })
  );

  // Check session
  var sessionOk = loadSession();

  if (sessionOk) {
    if (APP.role === 'employee') { emp_loadSession(); if (!empState.active) { empState.page = 'login'; } }
    enterApp();
  } else {
    showLoginScreen();
  }
  _splashProgress(100, 'Ready!');
  document.body.classList.add('app-ready');

  // Load audit log AFTER app is visible (non-blocking, with timeout)
  setTimeout(async () => {
    try {
      if (db && db.db) {
        var logs = await Promise.race([
          db.getAll('auditLog'),
          new Promise((_, rej) => setTimeout(() => rej('timeout'), 2000))
        ]);
        APP.auditLog = logs || [];
        APP.auditLog.sort((a,b) => (b.timestamp||'').localeCompare(a.timestamp||''));
      }
    } catch { APP.auditLog = []; }
  }, 1000);

  setTimeout(() => { if (APP.data) { checkTankAlerts(APP.data.tanks); checkCreditAlerts(APP.data.creditCustomers); } }, 5000);
}

// ── Admin User Management (Tenant level) ──
function openChangeAdminPassModal(userIdx) {
  const t = mt_getActiveTenant();
  if (!t) return;
  const u = (t.adminUsers||[])[userIdx];
  if (!u) return;
  openModal(`🔑 Change Password — ${sanitize(u.name)}`,
    `<input type="hidden" id="adminUserIdx" value="${userIdx}" />
     <div class="form-group"><label class="form-label">New Password *</label>
       <input class="form-input" id="newAdminPass" type="password" placeholder="Enter new password" autocomplete="new-password" />
     </div>
     <div class="form-group"><label class="form-label">Confirm Password *</label>
       <input class="form-input" id="confirmAdminPass" type="password" placeholder="Confirm password" />
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveAdminPassword()">🔑 Update Password</button>`
  );
}

async function saveAdminPassword() {
  const idx  = parseInt(document.getElementById('adminUserIdx')?.value);
  const pass = document.getElementById('newAdminPass')?.value;
  const conf = document.getElementById('confirmAdminPass')?.value;
  if (!pass || pass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  if (pass !== conf) { toast('Passwords do not match', 'error'); return; }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const tenants = mt_getTenants();
  const tIdx = tenants.findIndex(t => t.id === APP.tenant?.id);
  if (tIdx === -1) { toast('Tenant not found', 'error'); return; }
  tenants[tIdx].adminUsers[idx].passHash = hash;
  mt_saveTenants(tenants);
  mt_setActiveTenant(tenants[tIdx]);
  // Update in-memory ADMIN_USERS
  ADMIN_USERS[idx].passHash = hash;
  APP.tenant = tenants[tIdx];
  closeModal();
  toast('Password updated', 'success');
}

function openAddAdminUserModal() {
  openModal('➕ Add Admin User',
    `<div class="form-group"><label class="form-label">Full Name *</label>
       <input class="form-input" id="newAdminName" placeholder="e.g. Suresh Kumar" />
     </div>
     <div class="form-row">
       <div class="form-group"><label class="form-label">Username *</label>
         <input class="form-input" id="newAdminUsername" placeholder="e.g. manager" />
       </div>
       <div class="form-group"><label class="form-label">Role</label>
         <select class="form-input" id="newAdminRole">
           <option>Manager</option>
           <option>Owner</option>
           <option>Accountant</option>
         </select>
       </div>
     </div>
     <div class="form-group"><label class="form-label">Password *</label>
       <input class="form-input" id="newAdminPass2" type="password" placeholder="Min 6 characters" autocomplete="new-password" />
     </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-accent" onclick="saveNewAdminUser()">💾 Add User</button>`
  );
}

async function saveNewAdminUser() {
  const name = document.getElementById('newAdminName')?.value?.trim();
  const username = document.getElementById('newAdminUsername')?.value?.trim()?.toLowerCase();
  const role = document.getElementById('newAdminRole')?.value;
  const pass = document.getElementById('newAdminPass2')?.value;
  if (!name || name.length < 2) { toast('Enter a name', 'error'); return; }
  if (!username || username.length < 2) { toast('Enter a username', 'error'); return; }
  if (!pass || pass.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  const tenants = mt_getTenants();
  const tIdx = tenants.findIndex(t => t.id === APP.tenant?.id);
  if (tIdx === -1) { toast('Tenant not found', 'error'); return; }
  if ((tenants[tIdx].adminUsers||[]).find(u => u.username === username)) {
    toast('Username already exists', 'error'); return;
  }
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass));
  const hash = Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  const newUser = { id: Date.now(), name, username, passHash: hash, role };
  tenants[tIdx].adminUsers = [...(tenants[tIdx].adminUsers||[]), newUser];
  mt_saveTenants(tenants);
  mt_setActiveTenant(tenants[tIdx]);
  ADMIN_USERS.push(newUser);
  APP.tenant = tenants[tIdx];
  closeModal();
  toast(`${name} added as admin`, 'success');
  renderPage();
}

// Hash change
window.addEventListener('hashchange', () => {
  if (!APP.loggedIn) return;
  const hash = window.location.hash.replace('#', '');
  if (APP.role === 'admin' && hash && PAGES.find(p => p.id === hash) && hash !== APP.page) navigate(hash);
});

// Start
document.addEventListener('DOMContentLoaded', function() {
  try {
    initApp().catch(function(e) {
      console.error('initApp async error:', e);
      document.body.classList.add('app-ready');
      var app = document.getElementById('app');
      if (app) app.innerHTML = '<div style="position:fixed;inset:0;background:#0a0c10;display:flex;align-items:center;justify-content:center;color:#f4f5f7;font-family:sans-serif;text-align:center;padding:24px"><div><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="margin-bottom:8px">App Error</h2><p style="color:#9498a5;font-size:13px;margin-bottom:20px">' + (e && e.message ? e.message : 'Unknown error') + '</p><button onclick="location.reload()" style="background:#d4940f;color:#000;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Reload App</button></div></div>';
    });
  } catch(e) {
    console.error('initApp sync error:', e);
    document.body.classList.add('app-ready');
    var app = document.getElementById('app');
    if (app) app.innerHTML = '<div style="position:fixed;inset:0;background:#0a0c10;display:flex;align-items:center;justify-content:center;color:#f4f5f7;font-family:sans-serif;text-align:center;padding:24px"><div><div style="font-size:48px;margin-bottom:16px">⚠️</div><h2 style="margin-bottom:8px">App Error</h2><p style="color:#9498a5;font-size:13px;margin-bottom:20px">' + (e && e.message ? e.message : 'Unknown error') + '</p><button onclick="location.reload()" style="background:#d4940f;color:#000;border:none;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">Reload App</button></div></div>';
  }
});