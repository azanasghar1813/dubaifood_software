import { configService } from './configService.js';
import { dbEngine } from '../database/sqlite.js';
import { menuCacheService } from './menuCacheService.js';
import { LAN_SHARED_SECRET } from '../config/lanSecret.js';

class LanCatalogSyncService {
  constructor() {
    this.intervalId = null;
    this.isSyncing = false;
  }

  startAutoSync() {
    const config = configService.getSyncConfig();
    if (config.device_role !== 'TERMINAL' || !config.hub_ip) return;

    if (this.intervalId) clearInterval(this.intervalId);

    // Auto-sync every 5 minutes silently
    this.intervalId = setInterval(() => {
      this.pullCatalogFromHub().catch(err => {
        console.error('[LanCatalogSync] Auto-sync failed:', err.message);
      });
    }, 5 * 60 * 1000);
  }

  stopAutoSync() {
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  async pullCatalogFromHub() {
    const syncConfig = configService.getSyncConfig();
    if (syncConfig.device_role !== 'TERMINAL' || !syncConfig.hub_ip) {
      throw new Error('Device is not configured as a TERMINAL or missing hub_ip.');
    }

    if (this.isSyncing) {
      console.log('[LanCatalogSync] Sync already in progress, skipping.');
      return;
    }
    
    this.isSyncing = true;

    try {
      const hubPort = syncConfig.hub_port || 5000;
      const url = `http://${syncConfig.hub_ip}:${hubPort}/api/v1/internal/lan-catalog/dump`;
      const secret = LAN_SHARED_SECRET;

      console.log(`[LanCatalogSync] Pulling catalog from Hub at ${url}...`);

      const res = await fetch(url, {
        headers: {
          'x-device-secret': secret,
          'x-terminal-id': syncConfig.device_id || 'unknown'
        }
      });

      if (!res.ok) {
        throw new Error(`Hub returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (!json.success || !json.data) {
        throw new Error(json.message || 'Invalid response from Hub');
      }

      this._applyDump(json.data);
      console.log('[LanCatalogSync] Catalog successfully synchronized from Hub.');
      
      // Reload the cache so the frontend can see the updates instantly
      menuCacheService.initialize();
      
      return { success: true };
    } finally {
      this.isSyncing = false;
    }
  }

  _applyDump(data) {
    return dbEngine.transaction(() => {
      // Temporarily turn off foreign keys to allow aggressive replacement
      dbEngine.prepare('PRAGMA foreign_keys = OFF').run();

      const tables = [
        'settings',
        'categories',
        'products',
        'product_variants',
        'modifiers',
        'modifier_options',
        'deals',
        'deal_items'
      ];

      for (const table of tables) {
        const rows = data[table] || [];
        // Optional: We can delete everything first to ensure deleted items are removed.
        // Wait, Settings shouldn't be fully wiped if terminal has local settings.
        // Let's only wipe the catalog tables.
        if (table !== 'settings') {
          dbEngine.prepare(`DELETE FROM ${table}`).run();
        }

        if (rows.length === 0) continue;

        const keys = Object.keys(rows[0]);
        const placeholders = keys.map(() => '?').join(', ');
        
        // For settings, we use INSERT OR REPLACE.
        // For others, since we deleted them, we can just INSERT.
        const stmt = dbEngine.prepare(`INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`);
        
        for (const row of rows) {
          const values = keys.map(k => row[k]);
          stmt.run(...values);
        }
      }

      // Re-enable foreign keys
      dbEngine.prepare('PRAGMA foreign_keys = ON').run();
    });
  }
}

export const lanCatalogSyncService = new LanCatalogSyncService();
