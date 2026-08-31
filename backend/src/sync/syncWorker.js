import fs from 'fs';
import path from 'path';
import config from '../config/index.js';
import { syncService } from '../services/syncService.js';
import { dbEngine } from '../database/sqlite.js';
import { configService } from '../services/configService.js';
import { SYSTEM_USER_ID, SYSTEM_SHIFT_ID } from './syncIdentities.js';
import { installGuardedSyncTriggers, unmuteSyncTriggers, withSyncMuted } from './syncTriggers.js';
import { menuCacheService } from '../services/menuCacheService.js';
import { preferLocalProductImage } from '../utils/localProductImage.js';

const LOCAL_SETTING_KEYS = new Set([
  'order_prefix',
  'device_id',
  'last_sync_timestamp',
  'last_sync_fixed_v2',
  'last_sync_fixed_v1'
]);

const PENDING_TYPE_MAP = {
  products: ['PRODUCT'],
  categories: ['CATEGORY', 'CATEGORIE'],
  deals: ['DEAL'],
  customers: ['CUSTOMER'],
  users: ['USER', 'EMPLOYEE'],
  orders: ['ORDER'],
  order_items: ['ORDER_ITEM'],
  order_payments: ['ORDER_PAYMENT', 'PAYMENT'],
  dining_tables: ['DINING_TABLE'],
  application_settings: ['SETTING'],
  product_variants: ['VARIANT']
};

class SyncWorker {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.baseDelayMs = 5000; // 5 seconds
    this.currentDelayMs = this.baseDelayMs;
    this.maxDelayMs = 60000; // 1 minute max backoff
    
    this.currentPhase = 'IDLE';
    this.logs = [];
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
      const buf = fs.readFileSync(abs);
      const form = new FormData();
      form.append('image', new Blob([buf], { type: this._guessMime(abs) }), path.basename(abs));
      form.append('folder', 'pos_images');
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let response;
      try {
        response = await fetch(`${config.sync.apiUrl}/sync/upload-image`, {
          method: 'POST',
          headers: {
            'x-device-secret': config.sync.deviceSecret,
            'x-terminal-id': terminalId
          },
          body: form,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        this.logActivity(`Image upload failed (${response.status}) for ${path.basename(abs)}`, 'error');
        return relPath;
      }
      const data = await response.json();
      return data.url || relPath;
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

    this.scheduleNextRun(this.baseDelayMs);
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

      const pendingEvents = syncService.getPendingEvents(50).filter((event) => {
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
        this.logActivity(`Pushing ${pendingEvents.length} pending events to cloud...`);
        
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
                 const record = tableName === 'application_settings'
                   ? dbEngine.prepare('SELECT * FROM application_settings WHERE key = ?').get(event.entity_id)
                   : dbEngine.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(event.entity_id);
                 if (record) {
                     // Strip columns that don't exist in Supabase yet to prevent schema cache errors
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
        }

        // Push to cloud
        const pushController = new AbortController();
        const pushTimeout = setTimeout(() => pushController.abort(), 30000); // 30s timeout
        
        let response;
        try {
          response = await fetch(`${config.sync.apiUrl}/sync/push`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-device-secret': config.sync.deviceSecret,
              'x-terminal-id': terminalId
            },
            body: JSON.stringify({ events: pendingEvents, terminal_id: terminalId }),
            signal: pushController.signal
          });
        } finally {
          clearTimeout(pushTimeout);
        }

        if (!response.ok) {
          throw new Error(`Cloud API responded with status: ${response.status}`);
        }

        const data = await response.json();

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

        for (const conflict of data.conflicts || []) {
          syncService.markEventSynced(conflict.eventId);
        }

        pushed = data.successful.length;
        this.logActivity(`Push complete. Success: ${data.successful.length}, Failed: ${data.failed.length}, Conflicts: ${data.conflicts.length}`);
        try { syncService.pruneSynced(50); } catch { /* ignore */ }
        
        // Reset delay on success if queue is full
        if (pendingEvents.length === 50) {
           this.currentDelayMs = 0;
        } else {
           this.currentDelayMs = this.baseDelayMs;
        }
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
      const limit = 50;
      let maxUpdatedMs = lastSyncTimestamp || 0;
      let totalPulled = 0;

      this.currentPhase = 'PULLING';
      this.logActivity(`Pulling new data from cloud... (Since: ${lastSyncTimestamp})`);

      const pullPage = async (offset) => {
        const pullController = new AbortController();
        const pullTimeout = setTimeout(() => pullController.abort(), 30000);
        try {
          const pullResponse = await fetch(`${config.sync.apiUrl}/sync/pull?last_sync_timestamp=${lastSyncTimestamp}&limit=${limit}&offset=${offset}`, {
            headers: {
              'x-device-secret': config.sync.deviceSecret,
              'x-terminal-id': terminalId
            },
            signal: pullController.signal
          });
          if (!pullResponse.ok) {
            throw new Error(`Cloud API Pull responded with status: ${pullResponse.status}`);
          }
          return await pullResponse.json();
        } finally {
          clearTimeout(pullTimeout);
        }
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
        order_payments: [],
        dining_tables: [],
        application_settings: [],
        product_variants: []
      };

      let offset = 0;
      let hasMore = true;
      while (hasMore) {
        const pullData = await pullPage(offset);
        const page = pullData.data || {};
        let pageCount = 0;
        for (const key of Object.keys(gathered)) {
          const rows = Array.isArray(page[key]) ? page[key] : [];
          gathered[key].push(...rows);
          pageCount += rows.length;
          bumpTimestamp(rows);
        }
        totalPulled += pageCount;
        hasMore = Object.values(page).some((arr) => Array.isArray(arr) && arr.length === limit);
        offset += limit;
        if (offset > 20000) break;
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
            const updateSet = keys.filter(k => k !== conflictCol).map(k => `${k} = excluded.${k}`).join(', ');
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
          upsertData('users', gathered.users);
          upsertData('customers', gathered.customers);
          upsertData('deals', gathered.deals);
          upsertData('dining_tables', gathered.dining_tables);
          upsertData('application_settings', gathered.application_settings);

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
      // --- PULL LOGIC END ---

      pulled = totalPulled;
      // After an outage, backoff can sit at 60s forever if there was nothing to push.
      // Keep 0 (drain a full 50-event queue immediately); otherwise resume the 5s cadence.
      if (this.currentDelayMs !== 0) {
        this.currentDelayMs = this.baseDelayMs;
      }
      this.currentPhase = 'IDLE';
      return { success: true, pushed, pulled };
    } catch (error) {
      this.currentPhase = 'ERROR';
      const cause = error.cause?.code || error.cause?.message || error.cause || '';
      const url = config.sync?.apiUrl || 'unknown';
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
