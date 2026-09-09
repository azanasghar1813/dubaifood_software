import { configService } from './configService.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';
import { orderService } from './orderService.js';
import { dbEngine } from '../database/sqlite.js';
import { io } from 'socket.io-client';
import { orderUpsertService } from './orderUpsertService.js';

class LanSyncService {
  constructor() {
    this.retryInterval = null;
    this.isRetrying = false;
    this.socket = null;
    this.activityLogs = [];
  }

  _log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    this.activityLogs.unshift({ timestamp, message, level });
    if (this.activityLogs.length > 100) this.activityLogs.pop();
    
    if (level === 'error') console.error(message);
    else if (level === 'warn') console.warn(message);
    else console.log(message);
  }

  getStatus() {
    let pendingOrders = 0;
    let pendingPrints = 0;
    try {
      pendingOrders = dbEngine.prepare("SELECT COUNT(*) as c FROM orders WHERE synced_to_hub = 0").get()?.c || 0;
      pendingPrints = dbEngine.prepare("SELECT COUNT(*) as c FROM pending_kitchen_prints").get()?.c || 0;
    } catch { /* DB might not be ready */ }

    return {
      isRetrying: this.isRetrying,
      pendingOrders,
      pendingPrints,
      logs: this.activityLogs
    };
  }

  startBackgroundRetries() {
    if (this.retryInterval) return;
    this.retryInterval = setInterval(() => {
      this._processRetries().catch(err => this._log(`[LanSync] Retry error: ${err.message}`, 'error'));
    }, 5000);
    
    // Also initialize the terminal socket listener
    this._initTerminalSocket();

    // Start Master Data Polling
    import('./lanMasterDataService.js').then(({ lanMasterDataService }) => {
      const syncConfig = configService.getSyncConfig();
      const isHub = syncConfig.device_role !== 'TERMINAL';
      const hubUrl = isHub ? null : `http://${syncConfig.hub_ip}:${syncConfig.hub_port || 5000}`;
      lanMasterDataService.startPolling(isHub, syncConfig.device_id, hubUrl);
    });
  }

  _initTerminalSocket() {
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role !== 'TERMINAL' || !syncConfig.hub_ip) return;
    if (this.socket) return; // already initialized

    const hubPort = syncConfig.hub_port || 5000;
    const url = `http://${syncConfig.hub_ip}:${hubPort}`;
    const secret = LAN_SHARED_SECRET;

    console.log(`[LanSync] Initializing Terminal backend socket connection to Hub at ${url}`);
    this.socket = io(url, {
      auth: { token: secret },
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 5000
    });

    this.socket.on('connect', () => {
      this._log(`[LanSync] Terminal backend connected to Hub Socket! ID: ${this.socket.id}`);
      this._runCatchupSync();
    });

    this.socket.on('connect_error', (err) => {
      this._log(`[LanSync] Terminal backend socket connection error: ${err.message}`, 'error');
    });

    this.socket.on('disconnect', () => {
      this._log(`[LanSync] Terminal backend disconnected from Hub Socket.`);
    });

    this.socket.on('order:upserted', (order) => {
      try {
        this._log(`[LanSync] Received order:upserted from Hub for order ${order.order_number}`);
        // Ensure it has synced_to_hub = 1 since it comes from the Hub
        order.synced_to_hub = 1; 
        const res = orderUpsertService.upsertHydratedOrder(order);
        
        if (!res.stale) {
          // Tell the local Terminal UI that an order was updated by the Hub
          import('./socketService.js').then(({ socketService }) => {
            socketService.emitOrderUpserted(order);
          });
        } else {
          this._log(`[LanSync] Ignored stale order payload from Hub for ${order.order_number}`);
        }
      } catch (e) {
        this._log(`[LanSync] Failed to process order:upserted from Hub: ${e.message}`, 'error');
      }
    });

    this.socket.on('order:deleted', (orderId) => {
      try {
        this._log(`[LanSync] Received order:deleted from Hub for order ${orderId}`);
        dbEngine.prepare(`DELETE FROM orders WHERE id = ?`).run(orderId);
        import('./socketService.js').then(({ socketService }) => {
          socketService.emitOrderDeleted(orderId);
        });
      } catch (e) {
        this._log(`[LanSync] Failed to process order:deleted from Hub: ${e.message}`, 'error');
      }
    });

    this.socket.on('sync:master_data', (payloadByTable) => {
      try {
        this._log(`[LanSync] Received Master Data push from Hub`);
        import('./lanMasterDataService.js').then(({ lanMasterDataService }) => {
          lanMasterDataService.applyIncomingData(payloadByTable);
        });
      } catch (e) {
        this._log(`[LanSync] Failed to process Master Data from Hub: ${e.message}`, 'error');
      }
    });
  }

  stopBackgroundRetries() {
    if (this.retryInterval) clearInterval(this.retryInterval);
    this.retryInterval = null;
  }

  async _runCatchupSync() {
    if (this.isCatchingUp) return;
    this.isCatchingUp = true;
    try {
      const syncConfig = configService.getSyncConfig();
      if (syncConfig.device_role !== 'TERMINAL' || !syncConfig.hub_ip) return;
      
      const hubPort = syncConfig.hub_port || 5000;
      const baseUrl = `http://${syncConfig.hub_ip}:${hubPort}/api/v1/internal`;
      const headers = {
        'Content-Type': 'application/json',
        'x-device-secret': LAN_SHARED_SECRET,
        'x-terminal-id': syncConfig.device_id || 'unknown'
      };

      // Default since to 24 hours ago if we have no history, to avoid syncing the whole DB initially
      let since = syncConfig.last_catchup_time;
      if (!since) {
         since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      }

      let hasMore = true;
      while (hasMore) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // larger timeout for bulk
        const res = await fetch(`${baseUrl}/lan-sync-catchup`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ since }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Hub returned HTTP ${res.status}`);
        }

        const data = await res.json();
        
        // 1. Process Master Data
        if (data.masterData && Object.keys(data.masterData).length > 0) {
          const { lanMasterDataService } = await import('./lanMasterDataService.js');
          lanMasterDataService.applyIncomingData(data.masterData);
          this._log(`[LanSync] Applied Catch-Up Master Data`);
        }

        // 2. Process Orders
        if (data.orders && data.orders.length > 0) {
          for (const order of data.orders) {
             if (order._deleted) {
               dbEngine.prepare(`DELETE FROM orders WHERE id = ?`).run(order.id);
               import('./socketService.js').then(({ socketService }) => {
                 socketService.emitOrderDeleted(order.id);
               });
             } else {
               order.synced_to_hub = 1;
               orderUpsertService.upsertHydratedOrder(order);
             }
          }
          this._log(`[LanSync] Applied ${data.orders.length} Catch-Up Orders`);
          import('./socketService.js').then(({ socketService }) => {
             // Let frontend know to refresh its order list if needed
             socketService.emitOrderUpserted(data.orders[data.orders.length - 1]); 
          });
        }

        // 3. Update 'since' for the next batch or save it locally
        if (data.hub_time) {
           since = data.hub_time;
           configService.updateApplicationCategory('SYSTEM', 'SYNC', { last_catchup_time: since });
        }
        
        hasMore = data.hasMore === true;
      }
      this._log(`[LanSync] Catch-Up Sync completed successfully.`);

    } catch (e) {
      this._log(`[LanSync] Catch-Up Sync failed: ${e.message}`, 'error');
    } finally {
      this.isCatchingUp = false;
    }
  }

  async _processRetries() {
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role !== 'TERMINAL' || !syncConfig.hub_ip) return;
    if (this.isRetrying) return;
    this.isRetrying = true;

    try {
      const hubPort = syncConfig.hub_port || 5000;
      const baseUrl = `http://${syncConfig.hub_ip}:${hubPort}/api/v1/internal`;
      const headers = {
        'Content-Type': 'application/json',
        'x-device-secret': LAN_SHARED_SECRET,
        'x-terminal-id': syncConfig.device_id || 'unknown'
      };

      // 1. Retry Kitchen Prints
      const pendingPrints = dbEngine.prepare(`SELECT * FROM pending_kitchen_prints ORDER BY created_at ASC LIMIT 10`).all();
      for (const print of pendingPrints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), syncConfig.hub_timeout_ms || 400);
          const res = await fetch(`${baseUrl}/print/kitchen/${print.order_id}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ cashierUserId: print.cashier_user_id, options: JSON.parse(print.options || '{}') }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            dbEngine.prepare(`DELETE FROM pending_kitchen_prints WHERE id = ?`).run(print.id);
            this._log(`[LanSync] Successfully retried kitchen print for order ${print.order_id}`);
          }
        } catch (e) {
          // ignore, wait for next tick
        }
      }

      // 2. Retry Orders
      const pendingOrders = dbEngine.prepare(`SELECT id FROM orders WHERE synced_to_hub = 0 LIMIT 10`).all();
      for (const row of pendingOrders) {
        const order = orderService.getOrderById(row.id);
        if (!order) continue;
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), syncConfig.hub_timeout_ms || 2000);
          const res = await fetch(`${baseUrl}/lan-sync-order`, {
            method: 'POST',
            headers,
            body: JSON.stringify(order),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          if (res.ok) {
            const json = await res.json();
            if (json.final_order_number && json.final_order_number !== order.order_number) {
              dbEngine.prepare(`UPDATE orders SET order_number = ? WHERE id = ?`).run(json.final_order_number, order.id);
            }
            dbEngine.prepare(`UPDATE orders SET synced_to_hub = 1 WHERE id = ?`).run(order.id);
            this._log(`[LanSync] Successfully synced order ${json.final_order_number || order.order_number} to Hub`);
          } else {
            const body = await res.text().catch(() => '');
            this._log(`[LanSync] Hub rejected order sync (HTTP ${res.status}): ${body}`, 'error');
          }
        } catch (e) {
          // ignore, wait for next tick
        }
      }
    } finally {
      this.isRetrying = false;
    }
  }

  /**
   * Broadcasts a fully hydrated order from a TERMINAL to the HUB over LAN.
   * This is a fire-and-forget async function designed not to block the POS UI.
   * 
   * @param {string} orderId - The UUID of the order to broadcast
   */
  async broadcastOrder(orderId) {
    try {
      const syncConfig = configService.getSyncConfig();
      
      // Only Terminals broadcast to the Hub
      if (syncConfig.device_role !== 'TERMINAL') {
        return;
      }
      if (!syncConfig.hub_ip) {
        return;
      }

      // Fetch the full hydrated order
      const order = orderService.getOrderById(orderId);
      if (!order) return;

      const hubPort = syncConfig.hub_port || 5000;
      const url = `http://${syncConfig.hub_ip}:${hubPort}/api/v1/internal/lan-sync-order`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), syncConfig.hub_timeout_ms || 2000);

      fetch(url, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-device-secret': LAN_SHARED_SECRET,
          'x-terminal-id': syncConfig.device_id || 'unknown'
        },
        body: JSON.stringify(order),
        signal: controller.signal
      })
      .then(async res => {
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          this._log(`[LanSync] Hub rejected broadcast for order ${order.order_number}: HTTP ${res.status} — ${body}`, 'warn');
        } else {
          const json = await res.json();
          if (json.final_order_number && json.final_order_number !== order.order_number) {
            dbEngine.prepare(`UPDATE orders SET order_number = ? WHERE id = ?`).run(json.final_order_number, order.id);
            this._log(`[LanSync] Successfully broadcasted order to Hub. Reassigned TEMP order ${order.order_number} to ${json.final_order_number}`);
          } else {
            this._log(`[LanSync] Successfully broadcasted order ${order.order_number} to Hub`);
          }
          dbEngine.prepare(`UPDATE orders SET synced_to_hub = 1 WHERE id = ?`).run(order.id);
        }
      })
      .catch(err => {
        if (err.name === 'AbortError') {
          this._log(`[LanSync] Broadcast for order ${order.order_number} timed out. Hub might be offline.`, 'warn');
        } else {
          this._log(`[LanSync] Broadcast for order ${order.order_number} failed: ${err.message}`, 'warn');
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });

    } catch (err) {
      this._log(`[LanSync] Error preparing order broadcast: ${err.message}`, 'error');
    }
  }
}

export const lanSyncService = new LanSyncService();
