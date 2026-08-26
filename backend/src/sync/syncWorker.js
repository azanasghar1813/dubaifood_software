import config from '../config/index.js';
import { syncService } from '../services/syncService.js';
import { dbEngine } from '../database/sqlite.js';

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
               'ORDER': 'orders',
               'ORDER_ITEM': 'order_items',
               'ORDER_PAYMENT': 'order_payments',
               'DINING_TABLE': 'dining_tables'
             };
             const tableName = tableMap[event.entity_type];
             if (tableName && (event.action === 'INSERT' || event.action === 'UPDATE')) {
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
            'x-device-secret': config.sync.deviceSecret
          },
          body: JSON.stringify({ events: pendingEvents })
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

        // Handle conflicts (For now, mark them as failed so they don't block the queue forever, 
        // in a complete implementation, this might trigger a local overwrite or resolution)
        for (const conflict of data.conflicts) {
          syncService.markEventFailed(conflict.eventId, `Conflict: Server version ${conflict.serverVersion} is newer than client version ${conflict.clientVersion}`);
        }

        console.log(`[SyncWorker] Sync complete. Success: ${data.successful.length}, Failed: ${data.failed.length}, Conflicts: ${data.conflicts.length}`);
        
        // Reset delay on success, but immediately pull next batch if queue is full
        this.currentDelayMs = pendingEvents.length === 50 ? 0 : this.baseDelayMs;
      }
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
