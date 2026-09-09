import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import config from '../config/index.js';
import { syncService } from '../services/syncService.js';
import { dbEngine } from '../database/sqlite.js';
import { configService } from '../services/configService.js';
import { SYSTEM_USER_ID, SYSTEM_SHIFT_ID } from './syncIdentities.js';
import { installGuardedSyncTriggers, unmuteSyncTriggers, withSyncMuted } from './syncTriggers.js';
import { menuCacheService } from '../services/menuCacheService.js';
import { preferLocalProductImage } from '../utils/localProductImage.js';
import { orderNumberService } from '../services/orderNumberService.js';
import { dateUtils } from '../utils/dateUtils.js';
import { getSyncCloudClient, FALLBACK_IDLE_DELAY_MS, hostLabel } from './syncCloudClient.js';

const syncCloud = getSyncCloudClient(config);

const LOCAL_SETTING_KEYS = new Set([
  'order_prefix',
  'device_id',
  'last_sync_timestamp',
  'last_sync_fixed_v2',
  'last_sync_fixed_v1'
]);

function isSuperRoleName(name) {
  const n = String(name || '').trim().toLowerCase();
  return n === 'super admin' || n === 'super administrator';
}

function applyDealComponents(key, value) {
  if (!String(key || '').startsWith('deal_components_')) return;
  const dealId = String(key).slice('deal_components_'.length);
  if (!dealId) return;
  let comps;
  try { comps = typeof value === 'string' ? JSON.parse(value) : value; } catch { return; }
  if (!Array.isArray(comps)) return;
  const deal = dbEngine.prepare('SELECT id FROM deals WHERE id = ?').get(dealId);
  if (!deal) return;
  dbEngine.prepare('DELETE FROM deal_components WHERE deal_id = ?').run(dealId);
  const insert = dbEngine.prepare(`
    INSERT INTO deal_components (
      id, deal_id, name, component_type, product_id, quantity, target_category_id, target_variant_name, allowed_product_ids, price_adjustment
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const comp of comps) {
    const productId = comp.product_id || null;
    if (productId && !dbEngine.prepare('SELECT 1 FROM products WHERE id = ?').get(productId)) continue;
    try {
      insert.run(
        comp.id || crypto.randomUUID(),
        dealId,
        comp.name || null,
        comp.component_type || 'FIXED_PRODUCT',
        productId,
        Number(comp.quantity) || 1,
        comp.target_category_id || null,
        comp.target_variant_name || null,
        comp.allowed_product_ids || null,
        Number(comp.price_adjustment) || 0
      );
    } catch { /* skip a component that cannot land on this till */ }
  }
}

function applyShowOnLoginSetting(key, value) {
  if (!String(key || '').startsWith('user_show_on_login_')) return;
  const userId = String(key).slice('user_show_on_login_'.length);
  if (!userId) return;
  const show = (value === '0' || value === 0) ? 0 : 1;
  try {
    dbEngine.prepare('UPDATE users SET show_on_login = ? WHERE id = ?').run(show, userId);
  } catch { /* users table may lack column */ }
}

function applyRoleAcl(raw) {
  let data;
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return; }
  if (!data || !Array.isArray(data.permission_codes)) return;
  const role = (data.role_id && dbEngine.prepare('SELECT id FROM roles WHERE id = ?').get(data.role_id))
    || (data.name && dbEngine.prepare('SELECT id FROM roles WHERE name = ? COLLATE NOCASE').get(data.name));
  if (!role) return;
  const incoming = data.permission_codes.map((c) => String(c || '').trim()).filter(Boolean);
  const localCount = dbEngine.prepare('SELECT COUNT(*) AS c FROM role_permissions WHERE role_id = ?').get(role.id)?.c || 0;
  // Never let an old empty cloud ACL wipe permissions already assigned on this till.
  if (incoming.length === 0 && localCount > 0) return;
  dbEngine.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
  const insert = dbEngine.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  for (const code of incoming) {
    const perm = dbEngine.prepare('SELECT id FROM permissions WHERE code = ?').get(code);
    if (perm) insert.run(role.id, perm.id);
  }
}

function restoreEmptyRolePermissionsFromPacked() {
  const packedDbPath = path.join(process.env.PACKED_STORAGE || path.join(process.cwd(), 'backend', 'storage'), 'database', 'pos.db');
  const liveDbPath = config.paths?.database?.file;
  if (!packedDbPath || !fs.existsSync(packedDbPath)) return 0;
  if (liveDbPath && path.resolve(packedDbPath) === path.resolve(liveDbPath)) return 0;
  let packed;
  try {
    packed = new Database(packedDbPath, { readonly: true });
  } catch {
    return 0;
  }
  let restored = 0;
  try {
    const roles = dbEngine.prepare('SELECT id, name FROM roles').all();
    const insert = dbEngine.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
    const insertAcl = dbEngine.prepare(`INSERT INTO application_settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`);
    for (const role of roles) {
      const localCount = dbEngine.prepare('SELECT COUNT(*) AS c FROM role_permissions WHERE role_id = ?').get(role.id)?.c || 0;
      if (localCount > 0) continue;
      const packedRows = packed.prepare(`
        SELECT p.code
        FROM role_permissions rp
        INNER JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?
      `).all(role.id);
      if (!packedRows.length) continue;
      for (const row of packedRows) {
        const perm = dbEngine.prepare('SELECT id FROM permissions WHERE code = ?').get(row.code);
        if (perm) {
          insert.run(role.id, perm.id);
          restored += 1;
        }
      }
      insertAcl.run(
        `role_acl_${role.id}`,
        JSON.stringify({ role_id: role.id, name: role.name, permission_codes: packedRows.map((r) => r.code) }),
        'Role screen access'
      );
    }
  } finally {
    try { packed.close(); } catch { /* ignore */ }
  }
  return restored;
}

function restoreCashierPermissionsIfEmpty() {
  const cashier = dbEngine.prepare("SELECT id, name FROM roles WHERE name = 'Cashier' COLLATE NOCASE").get();
  if (!cashier) return 0;
  const localCount = dbEngine.prepare('SELECT COUNT(*) AS c FROM role_permissions WHERE role_id = ?').get(cashier.id)?.c || 0;
  if (localCount > 0) return 0;
  const codes = [
    'VIEW_TABLES', 'VIEW_ORDERS', 'VIEW_REPORTS', 'VIEW_CATEGORIES',
    'VIEW_POS', 'VIEW_KITCHEN', 'VIEW_SETTINGS', 'VIEW_DASHBOARD',
    'VIEW_CUSTOMERS', 'VIEW_SYNC'
  ];
  const insert = dbEngine.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  let n = 0;
  for (const code of codes) {
    const perm = dbEngine.prepare('SELECT id FROM permissions WHERE code = ?').get(code);
    if (perm) {
      insert.run(cashier.id, perm.id);
      n += 1;
    }
  }
  if (n > 0) {
    dbEngine.prepare(`
      INSERT INTO application_settings (key, value, description)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(
      `role_acl_${cashier.id}`,
      JSON.stringify({ role_id: cashier.id, name: cashier.name, permission_codes: codes }),
      'Role screen access'
    );
    try {
      const exists = dbEngine.prepare(`SELECT 1 FROM sync_queue WHERE entity_type = 'SETTING' AND entity_id = ? AND status = 'PENDING'`).get(`role_acl_${cashier.id}`);
      if (!exists) {
        dbEngine.prepare(`INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version) VALUES (?, 'SETTING', ?, 'UPDATE', 'PENDING', 1)`).run(crypto.randomUUID(), `role_acl_${cashier.id}`);
      }
    } catch { /* queue is best-effort */ }
  }
  return n;
}

function floorStatusFromCloud(status) {
  const u = String(status || 'Available').trim().toUpperCase();
  if (u === 'OCCUPIED' || u === 'BUSY' || u === 'IN_USE') return 'Occupied';
  return 'Available';
}

function dedupeFloorTablesByName() {
  const hasTables = dbEngine.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tables'").get();
  if (!hasTables) return 0;
  const diningIds = new Set(
    (dbEngine.prepare('SELECT id FROM dining_tables').all() || []).map((r) => r.id)
  );
  const rows = dbEngine.prepare('SELECT id, name FROM tables ORDER BY created_at ASC').all();
  const keepByName = new Map();
  for (const row of rows) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const current = keepByName.get(name.toUpperCase());
    if (!current) {
      keepByName.set(name.toUpperCase(), row);
      continue;
    }
    if (!diningIds.has(current.id) && diningIds.has(row.id)) {
      keepByName.set(name.toUpperCase(), row);
    }
  }
  const keepIds = new Set([...keepByName.values()].map((r) => r.id));
  let removed = 0;
  const del = dbEngine.prepare('DELETE FROM tables WHERE id = ?');
  for (const row of rows) {
    if (!keepIds.has(row.id)) {
      del.run(row.id);
      removed += 1;
    }
  }
  dbEngine.prepare("UPDATE tables SET status = 'Available' WHERE UPPER(status) IN ('OCCUPIED', 'BUSY', 'AVAILABLE')").run();
  dbEngine.prepare("UPDATE tables SET status = 'Available' WHERE status IS NULL OR TRIM(status) = ''").run();
  return removed;
}

function upsertFloorTablesFromDining(rows) {
  if (!rows || !rows.length) return;
  const hasTables = dbEngine.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'tables'").get();
  if (!hasTables) return;
  let fallbackCat = dbEngine.prepare('SELECT id FROM table_categories ORDER BY created_at ASC LIMIT 1').get();
  for (const row of rows) {
    const name = String(row.table_number || row.name || '').trim();
    if (!name || !row.id) continue;
    let catId = fallbackCat?.id || null;
    if (row.zone) {
      let cat = dbEngine.prepare('SELECT id FROM table_categories WHERE name = ? COLLATE NOCASE').get(row.zone);
      if (!cat) {
        const newId = crypto.randomUUID();
        dbEngine.prepare('INSERT INTO table_categories (id, name) VALUES (?, ?)').run(newId, row.zone);
        cat = { id: newId };
        if (!fallbackCat) fallbackCat = cat;
      }
      catId = cat.id;
    }
    if (!catId) continue;
    const existingByName = dbEngine.prepare('SELECT id FROM tables WHERE name = ? COLLATE NOCASE').get(name);
    if (existingByName) {
      dbEngine.prepare('UPDATE tables SET category_id = ? WHERE id = ?').run(catId, existingByName.id);
      continue;
    }
    dbEngine.prepare(`
      INSERT INTO tables (id, name, category_id, status, created_at)
      VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        category_id = excluded.category_id
    `).run(row.id, name, catId, floorStatusFromCloud(row.status), row.created_at || null);
  }
  dedupeFloorTablesByName();
}

export const PENDING_TYPE_MAP = {
  products: ['PRODUCT'],
  categories: ['CATEGORY', 'CATEGORIE'],
  deals: ['DEAL'],
  deal_components: ['DEAL_COMPONENT'],
  customers: ['CUSTOMER'],
  users: ['USER', 'EMPLOYEE'],
  orders: ['ORDER'],
  order_items: ['ORDER_ITEM'],
  order_payments: ['ORDER_PAYMENT', 'PAYMENT'],
  dining_tables: ['DINING_TABLE'],
  application_settings: ['SETTING'],
  product_variants: ['VARIANT'],
  product_images: ['PRODUCT_IMAGE'],
  modifiers: ['MODIFIER'],
  modifier_groups: ['MODIFIER_GROUP']
};

class SyncWorker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.drainDelayMs = 5000;
    this.idleDelayMs = 30000;
    this.baseDelayMs = this.drainDelayMs;
    this.currentDelayMs = this.idleDelayMs;
    this.maxDelayMs = 60000;
    this.lastSuccessfulPullAt = 0;
    
    this.currentPhase = 'IDLE';
    this.logs = [];
    this._imageUploadCache = new Map();
  }

  _resolveLocalImage(relPath) {
    if (!relPath || typeof relPath !== 'string') return null;
    if (/^https?:\/\//i.test(relPath)) return null;
    const name = path.basename(relPath);
    const candidates = [
      path.join(config.paths.images.products, name),
      path.join(config.paths.images.categories, name),
      path.join(config.paths.images.business, name),
      path.join(config.paths.root, relPath.replace(/^[/\\]?storage[/\\]?/, '')),
    ];
    return candidates.find((p) => fs.existsSync(p)) || null;
  }

  _guessMime(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.gif') return 'image/gif';
    return 'image/jpeg';
  }

  async _uploadLocalImage(relPath, terminalId) {
    const abs = this._resolveLocalImage(relPath);
    if (!abs) return relPath;
    try {
      const st = fs.statSync(abs);
      const cached = this._imageUploadCache.get(abs);
      if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size && cached.url) {
        return cached.url;
      }
      const buf = fs.readFileSync(abs);
      const form = new FormData();
      form.append('image', new Blob([buf], { type: this._guessMime(abs) }), path.basename(abs));
      form.append('folder', 'pos_images');
      const result = await syncCloud.request('/sync/upload-image', {
        method: 'POST',
        headers: {
          'x-device-secret': config.sync.deviceSecret,
          'x-terminal-id': terminalId
        },
        body: form
      });
      const url = result.json?.url || relPath;
      this._imageUploadCache.set(abs, { mtimeMs: st.mtimeMs, size: st.size, url });
      return url;
    } catch (err) {
      this.logActivity(`Image upload error for ${path.basename(abs)}: ${err.message}`, 'error');
      return relPath;
    }
  }

  async _attachCloudImages(event, terminalId) {
    if (!event) return;
    let payload = event.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { payload = null; }
    }
    if (payload && payload.image_path) {
      payload.image_path = await this._uploadLocalImage(payload.image_path, terminalId);
      event.payload = JSON.stringify(payload);
    }
    if (event.entity_type === 'PRODUCT' && event.entity_id) {
      try {
        const images = dbEngine.prepare('SELECT id, image_path FROM product_images WHERE product_id = ?').all(event.entity_id);
        for (const img of images) {
          await this._uploadLocalImage(img.image_path, terminalId);
        }
      } catch (err) {
        this.logActivity(`product_images upload skipped: ${err.message}`, 'error');
      }
    }
  }

  _stripCloudUnknownFields(event) {
    if (!event?.payload) return;
    let payload = event.payload;
    if (typeof payload === 'string') {
      try { payload = JSON.parse(payload); } catch { return; }
    }
    if (!payload || typeof payload !== 'object') return;
    delete payload.sync_version;
    delete payload.sync_status;
    delete payload.synced_at;
    delete payload.sync_hash;
    delete payload.failed_login_attempts;
    delete payload.locked_until;
    delete payload.force_pin_change;
    if (event.entity_type === 'ORDER' || event.entity_type === 'ORDER_ITEM') {
      delete payload.deleted_at;
      delete payload.locked_by;
    }
    event.payload = JSON.stringify(payload);
  }

  logActivity(message, level = 'info') {
    const entry = {
      timestamp: new Date().toISOString(),
      message,
      level
    };
    this.logs.unshift(entry);
    if (this.logs.length > 10) {
      this.logs.pop(); // Keep only last 10 logs
    }
    console.log(`[SyncWorker] ${message}`);
  }

  start() {
    if (this.intervalId) return;
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role === 'TERMINAL') {
      this.logActivity('SyncWorker disabled on TERMINAL. Local LAN Hub is authoritative.');
      return;
    }

    this.logActivity('Starting background synchronization worker...');

    try {
      installGuardedSyncTriggers();
      unmuteSyncTriggers();
      const collapsed = syncService.collapseDuplicatePending();
      if (collapsed > 0) this.logActivity(`Removed ${collapsed} duplicate pending sync rows.`);
      const pruned = syncService.pruneSynced(50);
      if (pruned > 0) this.logActivity(`Cleared ${pruned} old synced rows to free storage.`);
      const backfill = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'variant_sync_backfill_v1'").get();
      if (!backfill) {
        const variants = dbEngine.prepare('SELECT id FROM product_variants').all();
        const insert = dbEngine.prepare(`INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version) VALUES (?, 'VARIANT', ?, 'UPDATE', 'PENDING', 1)`);
        let n = 0;
        for (const v of variants) {
          const exists = dbEngine.prepare(`SELECT 1 FROM sync_queue WHERE entity_type = 'VARIANT' AND entity_id = ? AND status = 'PENDING'`).get(v.id);
          if (!exists) {
            insert.run(crypto.randomUUID(), v.id);
            n += 1;
          }
        }
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('variant_sync_backfill_v1', '1', 'Queued variants for cloud sync') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
        if (n > 0) this.logActivity(`Queued ${n} product variants for sync.`);
      }
      const tableFill = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'floor_tables_sync_v1'").get();
      if (!tableFill) {
        let queued = 0;
        try {
          const floorTables = dbEngine.prepare('SELECT id FROM tables').all();
          const insertT = dbEngine.prepare(`INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version) VALUES (?, 'DINING_TABLE', ?, 'UPDATE', 'PENDING', 1)`);
          for (const t of floorTables) {
            const exists = dbEngine.prepare(`SELECT 1 FROM sync_queue WHERE entity_type = 'DINING_TABLE' AND entity_id = ? AND status = 'PENDING'`).get(t.id);
            if (!exists) {
              insertT.run(crypto.randomUUID(), t.id);
              queued += 1;
            }
          }
        } catch { /* tables table may not exist */ }
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('floor_tables_sync_v1', '1', 'Queued floor tables for cloud sync') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
        if (queued > 0) this.logActivity(`Queued ${queued} floor tables for sync.`);
      }
      const roleFill = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'role_acl_sync_v1'").get();
      if (!roleFill) {
        try {
          const roles = dbEngine.prepare('SELECT id FROM roles').all();
          const insertS = dbEngine.prepare(`INSERT INTO application_settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
          const insertQ = dbEngine.prepare(`INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version) VALUES (?, 'SETTING', ?, 'UPDATE', 'PENDING', 1)`);
          for (const role of roles) {
            const codes = dbEngine.prepare(`
              SELECT p.code FROM permissions p
              INNER JOIN role_permissions rp ON rp.permission_id = p.id
              WHERE rp.role_id = ?
            `).all(role.id).map((r) => r.code);
            const nameRow = dbEngine.prepare('SELECT name FROM roles WHERE id = ?').get(role.id);
            const key = `role_acl_${role.id}`;
            insertS.run(key, JSON.stringify({ role_id: role.id, name: nameRow?.name, permission_codes: codes }), 'Role screen access');
            const exists = dbEngine.prepare(`SELECT 1 FROM sync_queue WHERE entity_type = 'SETTING' AND entity_id = ? AND status = 'PENDING'`).get(key);
            if (!exists) insertQ.run(crypto.randomUUID(), key);
          }
        } catch (e) {
          this.logActivity(`Role ACL backfill skipped: ${e.message}`, 'error');
        }
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('role_acl_sync_v1', '1', 'Queued role screen access for cloud sync') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
        this.logActivity('Queued role screen-access for sync.');
      }
      const tableDedupe = dedupeFloorTablesByName();
      if (tableDedupe > 0) this.logActivity(`Removed ${tableDedupe} duplicate floor tables.`);
      const restoredRoles = restoreEmptyRolePermissionsFromPacked();
      if (restoredRoles > 0) this.logActivity(`Restored ${restoredRoles} missing role permissions from packaged catalog.`);
      const cashierRestored = restoreCashierPermissionsIfEmpty();
      if (cashierRestored > 0) this.logActivity(`Restored ${cashierRestored} Cashier screen permissions.`);
      const dealCompFill = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'deal_components_sync_v1'").get();
      if (!dealCompFill) {
        try {
          const deals = dbEngine.prepare('SELECT id FROM deals').all();
          const insertS = dbEngine.prepare(`INSERT INTO application_settings (key, value, description) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`);
          const insertQ = dbEngine.prepare(`INSERT INTO sync_queue (id, entity_type, entity_id, action, status, payload_version) VALUES (?, 'SETTING', ?, 'UPDATE', 'PENDING', 1)`);
          for (const deal of deals) {
            const comps = dbEngine.prepare('SELECT * FROM deal_components WHERE deal_id = ?').all(deal.id);
            const key = `deal_components_${deal.id}`;
            insertS.run(key, JSON.stringify(comps), 'Deal included items');
            const exists = dbEngine.prepare(`SELECT 1 FROM sync_queue WHERE entity_type = 'SETTING' AND entity_id = ? AND status = 'PENDING'`).get(key);
            if (!exists) insertQ.run(crypto.randomUUID(), key);
          }
        } catch (e) {
          this.logActivity(`Deal components backfill skipped: ${e.message}`, 'error');
        }
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('deal_components_sync_v1', '1', 'Queued deal items for cloud sync') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
        this.logActivity('Queued deal included-items for sync.');
      }
    } catch (e) {
      this.logActivity(`Failed to repair sync queue/triggers: ${e.message}`, 'error');
    }
    
    // Automatically retry any previously failed syncs on startup
    try {
      const resetCount = dbEngine.prepare("UPDATE sync_queue SET status = 'PENDING' WHERE status = 'FAILED' AND permanent_failure = 0").run();
      if (resetCount.changes > 0) {
        this.logActivity(`Reset ${resetCount.changes} FAILED events back to PENDING for retry.`);
      }
    } catch (e) {
      this.logActivity(`Failed to reset sync queue: ${e.message}`, 'error');
    }

    this.scheduleNextRun(this.drainDelayMs);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    this.logActivity('Worker Stopped.');
  }

  scheduleNextRun(delay) {
    if (this.intervalId) clearTimeout(this.intervalId);
    this.intervalId = setTimeout(() => this.run(), delay);
  }

  _pendingCount() {
    try {
      return Number(dbEngine.prepare(
        `SELECT COUNT(*) AS c FROM sync_queue WHERE status = 'PENDING'`
      ).get()?.c) || 0;
    } catch {
      return 0;
    }
  }

  _setNextDelay() {
    const pending = this._pendingCount();
    if (pending >= 50) this.currentDelayMs = 0;
    else if (pending > 0) this.currentDelayMs = this.drainDelayMs;
    else if (syncCloud.getState().activeHost === 'fallback') this.currentDelayMs = FALLBACK_IDLE_DELAY_MS;
    else this.currentDelayMs = this.idleDelayMs;
  }

  async _cloudHeartbeat(sinceMs, terminalId) {
    if (process.env.NODE_ENV === 'test' || !config.sync?.apiUrl) return null;
    try {
      const qs = new URLSearchParams({ last_sync_timestamp: String(sinceMs || 0) });
      const result = await syncCloud.request(`/sync/heartbeat?${qs}`, {
        headers: {
          'x-device-secret': config.sync.deviceSecret,
          'x-terminal-id': terminalId
        }
      });
      const data = result.json?.data || result.json;
      if (typeof data?.changed !== 'boolean') return null;
      return {
        changed: data.changed === true,
        watermark: Number(data.watermark) || 0
      };
    } catch {
      return null;
    }
  }

  async _shouldFullPull(lastSyncTimestamp, terminalId) {
    const beat = await this._cloudHeartbeat(lastSyncTimestamp, terminalId);
    if (beat) {
      if (beat.changed) {
        this.logActivity('Heartbeat: cloud has new rows, pulling.');
        return true;
      }
      this.logActivity('Heartbeat: no cloud changes, skip pull.');
      return false;
    }
    const staleMs = Date.now() - (this.lastSuccessfulPullAt || 0);
    if (staleMs >= this.idleDelayMs || !this.lastSuccessfulPullAt) {
      this.logActivity('Heartbeat unavailable, falling back to pull.');
      return true;
    }
    this.logActivity('Heartbeat unavailable, last pull is fresh, skip pull.');
    return false;
  }

  async run() {
    if (this.isRunning) {
      this.scheduleNextRun(this.currentDelayMs);
      return { success: false, error: 'Sync already running' };
    }

    this.isRunning = true;
    let pushed = 0;
    let pulled = 0;

    try {
      const syncConfig = configService.getSyncConfig();
      const terminalId = syncConfig.device_id || 'UNKNOWN_DEVICE';
      try {
        dbEngine.prepare(`UPDATE sync_queue SET status = 'SYNCED' WHERE status = 'CONFLICT' AND entity_type = 'USER' AND entity_id = ?`).run(SYSTEM_USER_ID);
        const collapsed = syncService.collapseDuplicatePending();
        if (collapsed > 0) this.logActivity(`Collapsed ${collapsed} duplicate pending rows.`);
      } catch { /* optional */ }

      await syncCloud.maybeFailBack();

      const pendingEvents = syncService.getPendingEvents(100).filter((event) => {
        if (event.entity_type === 'USER' && event.entity_id === SYSTEM_USER_ID) {
          syncService.markEventSynced(event.id);
          return false;
        }
        if (event.entity_type === 'SETTING' && LOCAL_SETTING_KEYS.has(String(event.entity_id || ''))) {
          syncService.markEventSynced(event.id);
          return false;
        }
        return true;
      });

      if (pendingEvents.length > 0) {
        this.currentPhase = 'PUSHING';
        this.logActivity(`Pushing ${pendingEvents.length} pending events via ${hostLabel(syncCloud.getState().activeUrl)}...`);
        
        // Dynamically fetch payloads for triggers that did not include them
        for (const event of pendingEvents) {
          // Auto-heal legacy 'CATEGORIE' typos from old software versions
          if (event.entity_type === 'CATEGORIE') {
            event.entity_type = 'CATEGORY';
            try {
              dbEngine.prepare("UPDATE sync_queue SET entity_type = 'CATEGORY' WHERE id = ?").run(event.id);
            } catch (e) {
              this.logActivity(`Failed to auto-heal CATEGORIE typo for event ${event.id}: ${e.message}`, 'error');
            }
          }

          if (!event.payload) {
             const tableMap = {
               'PRODUCT': 'products',
               'CATEGORY': 'categories',
               'DEAL': 'deals',
               'CUSTOMER': 'customers',
               'USER': 'users',
               'EMPLOYEE': 'users',
               'ORDER': 'orders',
               'ORDER_ITEM': 'order_items',
               'ORDER_PAYMENT': 'order_payments',
               'PAYMENT': 'order_payments',
               'DINING_TABLE': 'dining_tables',
               'SETTING': 'application_settings',
               'VARIANT': 'product_variants'
             };
             const tableName = tableMap[event.entity_type];
             if (tableName) {
                 let record;
                 if (tableName === 'application_settings') {
                   record = dbEngine.prepare('SELECT * FROM application_settings WHERE key = ?').get(event.entity_id);
                 } else if (event.entity_type === 'DINING_TABLE') {
                   record = dbEngine.prepare('SELECT * FROM dining_tables WHERE id = ?').get(event.entity_id);
                   if (!record) {
                     const floor = dbEngine.prepare(`
                       SELECT t.id, t.name, t.status, t.created_at, c.name AS category_name
                       FROM tables t
                       LEFT JOIN table_categories c ON c.id = t.category_id
                       WHERE t.id = ?
                     `).get(event.entity_id);
                     if (floor) {
                       record = {
                         id: floor.id,
                         table_number: floor.name,
                         capacity: 4,
                         status: floor.status || 'Available',
                         zone: floor.category_name || null,
                         payload_version: 1,
                         created_at: floor.created_at,
                         updated_at: new Date().toISOString()
                       };
                     }
                   }
                 } else {
                   record = dbEngine.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(event.entity_id);
                 }
                 if (record) {
                     // Strip columns that don't exist in Supabase yet to prevent schema cache errors
                     delete record.sync_version;
                     delete record.sync_status;
                     delete record.synced_at;
                     delete record.sync_hash;
                     delete record.failed_login_attempts;
                     delete record.locked_until;
                     delete record.force_pin_change;
                     if (tableName === 'orders' || tableName === 'order_items') {
                         delete record.deleted_at;
                         delete record.locked_by;
                     }
                     event.payload_version = Number(record.payload_version || event.payload_version || 1);
                     event.payload = JSON.stringify(record);
                 } else {
                     // If record is gone, convert to DELETE
                     event.action = 'DELETE';
                 }
             }
          }
        }

        for (const event of pendingEvents) {
          if (event.entity_type === 'PRODUCT' || event.entity_type === 'CATEGORY') {
            await this._attachCloudImages(event, terminalId);
          }
          this._stripCloudUnknownFields(event);
        }

        const pushResult = await syncCloud.request('/sync/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-secret': config.sync.deviceSecret,
            'x-terminal-id': terminalId
          },
          body: JSON.stringify({ events: pendingEvents, terminal_id: terminalId })
        });
        const data = pushResult.json || {};
        if (!Array.isArray(data.successful)) {
          throw new Error(`Cloud API push returned unexpected body from ${hostLabel(pushResult.hostUrl)}`);
        }
        data.failed = Array.isArray(data.failed) ? data.failed : [];
        data.conflicts = Array.isArray(data.conflicts) ? data.conflicts : [];

        // Mark successful
        for (const eventId of data.successful) {
          syncService.markEventSynced(eventId);
        }

        // Mark failed
        for (const failure of data.failed) {
          if (failure.permanent || (failure.error && failure.error.includes('Unknown entity_type'))) {
            syncService.markEventPermanentFailure(failure.eventId, failure.error);
          } else {
            syncService.markEventFailed(failure.eventId, failure.error);
          }
        }

        const accounted = new Set([
          ...(data.successful || []),
          ...((data.failed || []).map((f) => f.eventId)),
          ...((data.conflicts || []).map((c) => c.eventId))
        ]);
        const unaccounted = pendingEvents.filter((event) => !accounted.has(event.id));
        if (unaccounted.length > 0) {
          this.logActivity(`Cloud did not acknowledge ${unaccounted.length} event(s); leaving them pending.`, 'warn');
        }

        for (const conflict of data.conflicts || []) {
          syncService.markEventSynced(conflict.eventId);
        }

        pushed = data.successful.length;
        this.logActivity(`Push complete. Success: ${data.successful.length}, Failed: ${data.failed.length}, Conflicts: ${data.conflicts.length}`);
        try { syncService.pruneSynced(50); } catch { /* ignore */ }
        
      }

      // --- PULL LOGIC BEGIN ---
      let lastSyncRecord = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'last_sync_timestamp'").get();
      let lastSyncTimestamp = lastSyncRecord ? parseInt(lastSyncRecord.value, 10) : 0;
      const pullFix = dbEngine.prepare("SELECT value FROM application_settings WHERE key = 'last_sync_fixed_v2'").get();
      if (!pullFix) {
        lastSyncTimestamp = 0;
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('last_sync_fixed_v2', '1', 'One-time full cloud pull after order sync fix') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run();
        this.logActivity('Re-pulling full order history from cloud (one-time repair).');
      }
      const shouldPull = await this._shouldFullPull(lastSyncTimestamp, terminalId);
      const limit = 50;
      let maxUpdatedMs = lastSyncTimestamp || 0;
      let totalPulled = 0;

      if (!shouldPull) {
        pulled = 0;
      } else {
      this.currentPhase = 'PULLING';
      this.logActivity(`Pulling new data from cloud... (Since: ${lastSyncTimestamp})`);

      const pullPage = async (offset, table) => {
        const qs = new URLSearchParams({
          last_sync_timestamp: String(lastSyncTimestamp || 0),
          limit: String(limit),
          offset: String(offset)
        });
        if (table) qs.set('table', table);
        const pullResult = await syncCloud.request(`/sync/pull?${qs}`, {
          headers: {
            'x-device-secret': config.sync.deviceSecret,
            'x-terminal-id': terminalId
          }
        });
        return pullResult.json || {};
      };

      const bumpTimestamp = (rows) => {
        for (const row of rows || []) {
          const ms = Date.parse(row.updated_at || '');
          if (Number.isFinite(ms) && ms > maxUpdatedMs) maxUpdatedMs = ms;
        }
      };

      const existsId = (table, id) => {
        if (!id) return false;
        try {
          return !!dbEngine.prepare(`SELECT 1 FROM ${table} WHERE id = ? LIMIT 1`).get(id);
        } catch {
          return false;
        }
      };

      const pendingByTable = {};
      for (const [tableName, types] of Object.entries(PENDING_TYPE_MAP)) {
        const placeholders = types.map(() => '?').join(',');
        const rows = dbEngine.prepare(
          `SELECT entity_id FROM sync_queue WHERE status IN ('PENDING', 'CONFLICT') AND entity_type IN (${placeholders})`
        ).all(...types);
        pendingByTable[tableName] = new Set(rows.map((r) => r.entity_id));
      }

      const gathered = {
        products: [],
        categories: [],
        orders: [],
        order_items: [],
        customers: [],
        users: [],
        deals: [],
        deal_components: [],
        order_payments: [],
        dining_tables: [],
        application_settings: [],
        product_variants: [],
        product_images: [],
        modifiers: [],
        modifier_groups: []
      };

      for (const tableName of Object.keys(gathered)) {
        let offset = 0;
        while (true) {
          const pullData = await pullPage(offset, tableName);
          const rows = Array.isArray(pullData.data?.[tableName]) ? pullData.data[tableName] : [];
          gathered[tableName].push(...rows);
          bumpTimestamp(rows);
          totalPulled += rows.length;
          if (rows.length < limit) break;
          offset += limit;
          if (offset > 50000) break;
        }
      }

      if (totalPulled > 0) {
        withSyncMuted(() => dbEngine.transaction(() => {
          const upsertData = (tableName, items) => {
            if (!items || items.length === 0) return;

            const tableInfo = dbEngine.prepare(`PRAGMA table_info(${tableName})`).all();
            const validColumns = new Set(tableInfo.map(c => c.name));
            const columnMeta = {};
            tableInfo.forEach(c => { columnMeta[c.name] = c; });

            const keys = Object.keys(items[0]).filter(k => validColumns.has(k));
            if (validColumns.has('sync_status') && !keys.includes('sync_status')) {
              keys.push('sync_status');
            }

            tableInfo.forEach(meta => {
              if (meta.notnull && meta.dflt_value === null && !keys.includes(meta.name)) {
                keys.push(meta.name);
              }
            });

            const conflictCol = tableName === 'application_settings' && validColumns.has('key') ? 'key' : 'id';
            const placeholders = keys.map(() => '?').join(', ');
            const updateCols = keys.filter((k) => k !== conflictCol)
              .filter((k) => !(tableName === 'users' && k === 'show_on_login'));
            const updateSet = updateCols.map(k => `${k} = excluded.${k}`).join(', ');
            const stmt = dbEngine.prepare(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(${conflictCol}) DO UPDATE SET ${updateSet}`);

            for (const rawItem of items) {
              const item = { ...rawItem };
              const pendingIds = pendingByTable[tableName];
              const itemKey = tableName === 'application_settings' ? item.key : item.id;
              if (pendingIds && itemKey && pendingIds.has(itemKey)) {
                continue;
              }
              if (tableName === 'application_settings' && LOCAL_SETTING_KEYS.has(String(item.key || ''))) {
                continue;
              }
              if (tableName === 'users' && (item.id === SYSTEM_USER_ID || String(item.username || '').toLowerCase() === 'system_user')) {
                continue;
              }
              if (tableName === 'users' && item.id) {
                const localUser = dbEngine.prepare(`
                  SELECT u.role_id, u.show_on_login, r.name as role_name
                  FROM users u LEFT JOIN roles r ON r.id = u.role_id
                  WHERE u.id = ?
                `).get(item.id);
                if (localUser) {
                  if (isSuperRoleName(localUser.role_name)) {
                    item.role_id = localUser.role_id;
                  }
                  if (item.show_on_login === undefined || item.show_on_login === null) {
                    item.show_on_login = localUser.show_on_login;
                  }
                }
              }
              if (tableName === 'orders') {
                if (item.table_id && !existsId('dining_tables', item.table_id) && !existsId('tables', item.table_id)) item.table_id = null;
                if (item.waiter_id && !existsId('users', item.waiter_id)) item.waiter_id = null;
                if (item.rider_id && !existsId('users', item.rider_id)) item.rider_id = null;
                if (item.customer_id && !existsId('customers', item.customer_id)) item.customer_id = null;
                if (item.cashier_user_id && !existsId('users', item.cashier_user_id)) item.cashier_user_id = SYSTEM_USER_ID;
                if (item.shift_id && !existsId('cashier_sessions', item.shift_id)) item.shift_id = SYSTEM_SHIFT_ID;
              }
              if (tableName === 'order_items' && item.order_id && !existsId('orders', item.order_id)) continue;
              if (tableName === 'order_payments' && item.order_id && !existsId('orders', item.order_id)) continue;
              if (tableName === 'product_images' && item.product_id) {
                const localPath = preferLocalProductImage(item.product_id, item.image_path);
                if (localPath) item.image_path = localPath;
              }

              const values = keys.map(k => {
                if (k === 'sync_status') return 'SYNCED';
                let val = item[k];
                const meta = columnMeta[k];
                if (val === undefined || val === null) {
                  if (meta && meta.notnull) {
                    if (meta.dflt_value !== null) {
                      return meta.dflt_value.replace(/^['"](.*)['"]$/, '$1');
                    }
                    if (k === 'shift_id') return SYSTEM_SHIFT_ID;
                    if (k === 'cashier_user_id') return SYSTEM_USER_ID;
                    if (meta.type.includes('INT') || meta.type.includes('REAL')) return 0;
                    return '';
                  }
                  return null;
                }
                return val;
              });
              try {
                stmt.run(...values);
              } catch (err) {
                if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY' || err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('FOREIGN KEY constraint failed') || err.message.includes('UNIQUE constraint failed')) {
                  console.warn(`[Pull] Deferred/skipped ${tableName} row ${item.id} — ${err.code}: ${err.message}`);
                  continue;
                }
                throw err;
              }
            }
          };

          upsertData('categories', gathered.categories);
          upsertData('products', gathered.products);
          upsertData('product_variants', gathered.product_variants);
          upsertData('product_images', gathered.product_images);
          upsertData('modifiers', gathered.modifiers);
          upsertData('modifier_groups', gathered.modifier_groups);
          upsertData('users', gathered.users);
          upsertData('customers', gathered.customers);
          upsertData('deals', gathered.deals);
          upsertData('deal_components', gathered.deal_components);
          upsertData('dining_tables', gathered.dining_tables);
          upsertFloorTablesFromDining(gathered.dining_tables);
          upsertData('application_settings', gathered.application_settings);
          for (const row of gathered.application_settings || []) {
            if (String(row.key || '').startsWith('role_acl_')) applyRoleAcl(row.value);
            applyShowOnLoginSetting(row.key, row.value);
            applyDealComponents(row.key, row.value);
          }

          if (gathered.orders.length > 0) {
            const anyRole = dbEngine.prepare('SELECT id, name FROM roles LIMIT 1').get();
            if (anyRole) {
              dbEngine.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, pin_code, first_name, last_name, role_id, force_pin_change, is_active, created_at, updated_at) VALUES (?, 'system_user', 'system_hash', '0000', 'System', 'User', ?, 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(SYSTEM_USER_ID, anyRole.id);
              try {
                dbEngine.prepare(`UPDATE users SET show_on_login = 0, is_active = 0 WHERE id = ?`).run(SYSTEM_USER_ID);
              } catch { /* show_on_login may be missing */ }
              dbEngine.prepare(`INSERT OR IGNORE INTO cashier_sessions (id, user_id, terminal_id, status, opening_float, opened_at, created_at, updated_at) VALUES (?, ?, 'System Sync', 'CLOSED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(SYSTEM_SHIFT_ID, SYSTEM_USER_ID);
            }
          }

          upsertData('orders', gathered.orders);
          try { orderNumberService.absorbPulledNumbers(dateUtils.getBusinessDate()); } catch { /* sequence refresh is best-effort */ }
          upsertData('order_items', gathered.order_items);
          upsertData('order_payments', gathered.order_payments);
        }));
      }

      if (totalPulled > 0) {
        this.logActivity(`Pull complete. Processed ${totalPulled} new items from cloud.`);
        try { menuCacheService.refresh(); } catch { /* catalog cache optional */ }
      } else {
        this.logActivity(`Pull complete. No new items found.`);
      }

      if (maxUpdatedMs > 0) {
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('last_sync_timestamp', ?, 'Last successful cloud pull timestamp') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(String(maxUpdatedMs));
      }
      this.lastSuccessfulPullAt = Date.now();
      } // end shouldPull
      // --- PULL LOGIC END ---

      pulled = totalPulled;
      this._setNextDelay();
      this.currentPhase = 'IDLE';
      return { success: true, pushed, pulled };
    } catch (error) {
      this.currentPhase = 'ERROR';
      const cause = error.cause?.code || error.cause?.message || error.cause || '';
      const url = hostLabel(syncCloud.getState().activeUrl || config.sync?.apiUrl);
      this.logActivity(`Sync failed (Offline or API Error): ${error.message}${cause ? ' [' + cause + ']' : ''} → ${url}`, 'error');
      // Exponential backoff
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxDelayMs);
      this.logActivity(`Backing off. Next attempt in ${this.currentDelayMs / 1000}s`);
      return { success: false, error: error.message };
    } finally {
      try { unmuteSyncTriggers(); } catch { /* never leave triggers muted */ }
      if (this.currentPhase !== 'ERROR') {
        this.currentPhase = 'IDLE';
      }
      this.isRunning = false;
      this.scheduleNextRun(this.currentDelayMs);
    }
  }
}

export const syncWorker = new SyncWorker();
