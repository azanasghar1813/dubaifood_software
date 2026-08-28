import config from '../config/index.js';
import { syncService } from '../services/syncService.js';
import { dbEngine } from '../database/sqlite.js';
import { configService } from '../services/configService.js';

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
      const pendingEvents = syncService.getPendingEvents(50); // Batch of 50

      if (pendingEvents.length > 0) {
        this.currentPhase = 'PUSHING';
        this.logActivity(`Pushing ${pendingEvents.length} pending events to cloud...`);
        
        // Dynamically fetch payloads for triggers that did not include them
        for (const event of pendingEvents) {
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
               'DINING_TABLE': 'dining_tables',
               'SETTING': 'application_settings'
             };
             const tableName = tableMap[event.entity_type];
             if (tableName) {
                 const record = dbEngine.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(event.entity_id);
                 if (record) {
                     event.payload = JSON.stringify(record);
                 } else {
                     // If record is gone, convert to DELETE
                     event.action = 'DELETE';
                 }
             }
          }
        }

        // Push to cloud
        const response = await fetch(`${config.sync.apiUrl}/sync/push`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-device-secret': config.sync.deviceSecret,
            'x-terminal-id': terminalId
          },
          body: JSON.stringify({ events: pendingEvents, terminal_id: terminalId })
        });

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
          syncService.markEventFailed(failure.eventId, failure.error);
        }

        // Handle conflicts
        // If the server has an equal or newer version, the local event is obsolete.
        // We mark it as synced to clear it from the queue, and rely on the subsequent PULL to sync the local DB.
        for (const conflict of data.conflicts) {
          syncService.markEventSynced(conflict.eventId);
        }

        pushed = data.successful.length;
        this.logActivity(`Push complete. Success: ${data.successful.length}, Failed: ${data.failed.length}, Conflicts: ${data.conflicts.length}`);
        
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
      
      let offset = 0;
      const limit = 50;
      let hasMore = true;
      let finalTimestamp = null;
      let totalPulled = 0;

      this.currentPhase = 'PULLING';
      this.logActivity(`Pulling new data from cloud... (Since: ${lastSyncTimestamp})`);

      while (hasMore) {
        const pullResponse = await fetch(`${config.sync.apiUrl}/sync/pull?last_sync_timestamp=${lastSyncTimestamp}&limit=${limit}&offset=${offset}`, {
          headers: { 
            'x-device-secret': config.sync.deviceSecret,
            'x-terminal-id': terminalId
          }
        });

        if (!pullResponse.ok) {
           throw new Error(`Cloud API Pull responded with status: ${pullResponse.status}`);
        }

        const pullData = await pullResponse.json();
        const { products, categories, orders, order_items, customers, users } = pullData.data;

        const itemsCount = (products?.length || 0) + (categories?.length || 0) + (orders?.length || 0) + 
                           (order_items?.length || 0) + (customers?.length || 0) + (users?.length || 0);
        
        totalPulled += itemsCount;

        if (itemsCount > 0) {
          dbEngine.transaction(() => {
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
              
              // Ensure ALL NOT NULL columns without defaults are in `keys` so our fallback logic can handle them
              tableInfo.forEach(meta => {
                if (meta.notnull && meta.dflt_value === null && !keys.includes(meta.name)) {
                  keys.push(meta.name);
                }
              });
              
              const placeholders = keys.map(() => '?').join(', ');
              const updateSet = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');
              const stmt = dbEngine.prepare(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`);
              
              for (const item of items) {
                const values = keys.map(k => {
                  if (k === 'sync_status') return 'SYNCED';
                  
                  let val = item[k];
                  const meta = columnMeta[k];
                  
                  if (val === undefined || val === null) {
                    if (meta && meta.notnull) {
                       // Try to use default value from schema
                       if (meta.dflt_value !== null) {
                         // dflt_value comes back as a string, e.g., '0', 'DINE_IN', or "DEFAULT_BRANCH"
                         // Remove surrounding quotes if they exist
                         return meta.dflt_value.replace(/^['"](.*)['"]$/, '$1');
                       }
                       // Fallbacks for known non-defaultable foreign keys
                       if (k === 'shift_id') return 'SYSTEM_SHIFT';
                       if (k === 'cashier_user_id') return 'SYSTEM_USER';
                       if (meta.type.includes('INT') || meta.type.includes('REAL')) return 0;
                       return '';
                    }
                    return null;
                  }
                  
                  return val;
                });
                stmt.run(...values);
              }
            };

            // Upsert dependencies first
            upsertData('categories', categories);
            upsertData('products', products);
            upsertData('users', users);
            upsertData('customers', customers);
            
            // Ensure SYSTEM fallbacks exist for orders that reference them to prevent Foreign Key constraint failures
            if (orders && orders.length > 0) {
              const anyRole = dbEngine.prepare('SELECT id, name FROM roles LIMIT 1').get();
              if (anyRole) {
                 dbEngine.prepare(`INSERT OR IGNORE INTO users (id, username, password_hash, pin_code, first_name, last_name, role_id, role_name, force_pin_change, is_active, created_at, updated_at) VALUES ('SYSTEM_USER', 'system_user', 'system_hash', '0000', 'System', 'User', ?, ?, 0, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run(anyRole.id, anyRole.name);
                 dbEngine.prepare(`INSERT OR IGNORE INTO cashier_sessions (id, user_id, device_info, status, opening_balance, opened_at, created_at, updated_at) VALUES ('SYSTEM_SHIFT', 'SYSTEM_USER', 'System Sync', 'CLOSED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).run();
              }
            }
            
            // Upsert orders and items
            upsertData('orders', orders);
            upsertData('order_items', order_items);
          });
        }

        const hasAnyTableReachedLimit = [products, categories, orders, order_items, customers, users].some(arr => arr && arr.length === limit);
        hasMore = hasAnyTableReachedLimit;
        offset += limit;
        if (!finalTimestamp) finalTimestamp = pullData.timestamp;
      }

      if (totalPulled > 0) {
        this.logActivity(`Pull complete. Processed ${totalPulled} new items from cloud.`);
      } else {
        this.logActivity(`Pull complete. No new items found.`);
      }

      // Update timestamp unconditionally if full paginated pull succeeded without throwing
      if (finalTimestamp) {
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('last_sync_timestamp', ?, 'Last successful cloud pull timestamp') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(finalTimestamp.toString());
      }
      // --- PULL LOGIC END ---

      pulled = totalPulled;
      this.currentPhase = 'IDLE';
      return { success: true, pushed, pulled };
    } catch (error) {
      this.currentPhase = 'ERROR';
      this.logActivity(`Sync failed (Offline or API Error): ${error.message}`, 'error');
      // Exponential backoff
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxDelayMs);
      this.logActivity(`Backing off. Next attempt in ${this.currentDelayMs / 1000}s`);
      return { success: false, error: error.message };
    } finally {
      if (this.currentPhase !== 'ERROR') {
        this.currentPhase = 'IDLE';
      }
      this.isRunning = false;
      this.scheduleNextRun(this.currentDelayMs);
    }
  }
}

export const syncWorker = new SyncWorker();
