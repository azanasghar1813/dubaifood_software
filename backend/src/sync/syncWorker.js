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
  }

  start() {
    if (this.intervalId) return;
    console.log('[SyncWorker] Starting background synchronization worker...');
    
    // Automatically retry any previously failed syncs on startup
    try {
      const resetCount = dbEngine.prepare("UPDATE sync_queue SET status = 'PENDING' WHERE status = 'FAILED' AND permanent_failure = 0").run();
      if (resetCount.changes > 0) {
        console.log(`[SyncWorker] Reset ${resetCount.changes} FAILED events back to PENDING for retry.`);
      }
    } catch (e) {
      console.error('[SyncWorker] Failed to reset sync queue:', e.message);
    }

    this.scheduleNextRun(this.baseDelayMs);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
    console.log('[SyncWorker] Stopped.');
  }

  scheduleNextRun(delay) {
    if (this.intervalId) clearTimeout(this.intervalId);
    this.intervalId = setTimeout(() => this.run(), delay);
  }

  async run() {
    if (this.isRunning) {
      this.scheduleNextRun(this.currentDelayMs);
      return;
    }

    this.isRunning = true;

    try {
      const pendingEvents = syncService.getPendingEvents(50); // Batch of 50

      if (pendingEvents.length > 0) {
        console.log(`[SyncWorker] Processing ${pendingEvents.length} pending events...`);
        
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

        const syncConfig = configService.getSyncConfig();
        const terminalId = syncConfig.device_id || 'UNKNOWN_DEVICE';

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

        // Handle conflicts (Mark them as permanent failures so they don't block the queue forever)
        for (const conflict of data.conflicts) {
          syncService.markEventPermanentFailure(conflict.eventId, `Conflict: Server version ${conflict.serverVersion} >= client version ${conflict.clientVersion}. Needs pull: ${conflict.needsPull || false}`);
        }

        console.log(`[SyncWorker] Sync complete. Success: ${data.successful.length}, Failed: ${data.failed.length}, Conflicts: ${data.conflicts.length}`);
        
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
              const keys = Object.keys(items[0]);
              const placeholders = keys.map(() => '?').join(', ');
              const updateSet = keys.filter(k => k !== 'id').map(k => `${k} = excluded.${k}`).join(', ');
              const stmt = dbEngine.prepare(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders}) ON CONFLICT(id) DO UPDATE SET ${updateSet}`);
              for (const item of items) {
                stmt.run(...keys.map(k => item[k] === undefined ? null : item[k]));
              }
            };

            // Upsert dependencies first
            upsertData('categories', categories);
            upsertData('products', products);
            upsertData('users', users);
            upsertData('customers', customers);
            
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
        console.log(`[SyncWorker] Pull complete. Processed ${totalPulled} items from cloud.`);
      }

      // Update timestamp unconditionally if full paginated pull succeeded without throwing
      if (finalTimestamp) {
        dbEngine.prepare("INSERT INTO application_settings (key, value, description) VALUES ('last_sync_timestamp', ?, 'Last successful cloud pull timestamp') ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(finalTimestamp.toString());
      }
      // --- PULL LOGIC END ---

    } catch (error) {
      console.error('[SyncWorker] Sync failed (Offline or API Error):', error.message);
      // Exponential backoff
      this.currentDelayMs = Math.min(this.currentDelayMs * 2, this.maxDelayMs);
      console.log(`[SyncWorker] Backing off. Next attempt in ${this.currentDelayMs / 1000}s`);
    } finally {
      this.isRunning = false;
      this.scheduleNextRun(this.currentDelayMs);
    }
  }
}

export const syncWorker = new SyncWorker();
