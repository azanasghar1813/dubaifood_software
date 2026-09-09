import { dbEngine } from '../database/sqlite.js';
import { socketService } from './socketService.js';
import { PENDING_TYPE_MAP } from '../sync/syncWorker.js';

// Reverse map to get table name from entity_type
export const TYPE_TO_TABLE_MAP = {};
for (const [tableName, types] of Object.entries(PENDING_TYPE_MAP)) {
  for (const type of types) {
    TYPE_TO_TABLE_MAP[type] = tableName;
  }
}

class LanMasterDataService {
  constructor() {
    this.intervalId = null;
    this.isPolling = false;
  }

  startPolling(isHub, terminalId, hubUrl) {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => {
      this.processPendingSync(isHub, terminalId, hubUrl);
    }, 5000);
  }

  stopPolling() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async processPendingSync(isHub, terminalId, hubUrl) {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // 1. Fetch pending LAN sync queue items
      const pendingQueue = dbEngine.prepare(`
        SELECT id, entity_type, entity_id, action 
        FROM sync_queue 
        WHERE lan_status = 'PENDING'
        LIMIT 200
      `).all();

      if (pendingQueue.length === 0) {
        this.isPolling = false;
        return;
      }

      // Group by table
      const payloadByTable = {};
      const processedQueueIds = [];

      for (const item of pendingQueue) {
        const tableName = TYPE_TO_TABLE_MAP[item.entity_type];
        // Skip Orders (handled by orderSync)
        if (!tableName || tableName.startsWith('order') || tableName === 'dining_tables' || tableName === 'tables') {
          processedQueueIds.push(item.id); // Mark as synced so we don't stall on them
          continue; 
        }

        if (!payloadByTable[tableName]) {
          payloadByTable[tableName] = [];
        }

        if (item.action === 'DELETE') {
          payloadByTable[tableName].push({ id: item.entity_id, _deleted: true });
        } else {
          try {
             const actualRow = dbEngine.prepare(`SELECT * FROM ${tableName} WHERE id = ?`).get(item.entity_id);
             if (actualRow) {
               payloadByTable[tableName].push(actualRow);
             } else {
               // If not found, maybe it was deleted subsequently. Just send delete.
               payloadByTable[tableName].push({ id: item.entity_id, _deleted: true });
             }
          } catch (err) {
             console.error(`[LanMasterData] Failed to fetch row from ${tableName}:`, err.message);
          }
        }
        processedQueueIds.push(item.id);
      }

      const hasDataToPush = Object.keys(payloadByTable).some(t => payloadByTable[t].length > 0);

      if (hasDataToPush) {
        if (isHub) {
          // Hub broadcasts to all terminals via Socket
          socketService.emitToAll('sync:master_data', payloadByTable);
          console.log(`[LanSync] Hub pushed Master Data to Terminals via Socket`);
        } else {
          // Terminal POSTs to Hub
          if (!hubUrl) throw new Error('Hub URL not set for Terminal Master Data Sync');
          const res = await fetch(`${hubUrl}/api/v1/internal/lan-sync-master-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ terminalId, payload: payloadByTable })
          });
          if (!res.ok) {
            throw new Error(`Hub returned ${res.status}`);
          }
          console.log(`[LanSync] Terminal pushed Master Data to Hub via HTTP`);
        }
      }

      // Mark as synced locally
      if (processedQueueIds.length > 0) {
        const placeholders = processedQueueIds.map(() => '?').join(',');
        dbEngine.prepare(`UPDATE sync_queue SET lan_status = 'SYNCED' WHERE id IN (${placeholders})`).run(...processedQueueIds);
      }

    } catch (error) {
      console.error('[LanMasterData] Error in processPendingSync:', error.message);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Applies incoming Master Data payload dynamically.
   */
  applyIncomingData(payloadByTable) {
    dbEngine.transaction(() => {
      // Temporarily mute sync triggers so applying remote data doesn't bounce it back
      dbEngine.prepare('CREATE TABLE IF NOT EXISTS sync_mute (id INTEGER PRIMARY KEY CHECK (id = 1))').run();
      dbEngine.prepare('INSERT OR IGNORE INTO sync_mute (id) VALUES (1)').run();

      try {
        for (const [tableName, rows] of Object.entries(payloadByTable)) {
          if (!rows || rows.length === 0) continue;

          // Process Deletes first
          const deletes = rows.filter(r => r._deleted).map(r => r.id);
          if (deletes.length > 0) {
            const placeholders = deletes.map(() => '?').join(',');
            try {
              dbEngine.prepare(`DELETE FROM ${tableName} WHERE id IN (${placeholders})`).run(...deletes);
            } catch (err) {
              console.warn(`[LanMasterData] Failed to delete from ${tableName}:`, err.message);
            }
          }

          // Process Upserts
          const upserts = rows.filter(r => !r._deleted);
          if (upserts.length > 0) {
            this._dynamicUpsert(tableName, upserts);
          }
        }
      } finally {
        try { dbEngine.prepare('DELETE FROM sync_mute').run(); } catch { /* ignore */ }
      }
    })();

    // Notify UI to refresh Master Data
    socketService.emitToAll('sync:master_data_updated', { ts: Date.now() });
  }

  _dynamicUpsert(tableName, rows) {
    const cols = dbEngine.prepare(`PRAGMA table_info(${tableName})`).all();
    if (cols.length === 0) return;
    const colNames = cols.map(c => c.name);

    const insertCols = colNames.join(', ');
    const placeholders = colNames.map(() => '?').join(', ');
    
    const updateSet = colNames
      .filter(c => c !== 'id')
      .map(c => `${c} = excluded.${c}`)
      .join(', ');

    const hasPv = colNames.includes('payload_version');
    const hasUpd = colNames.includes('updated_at');

    let conflictClause = '';
    if (hasPv && hasUpd) {
      conflictClause = `WHERE excluded.payload_version > ${tableName}.payload_version OR (excluded.payload_version = ${tableName}.payload_version AND excluded.updated_at >= ${tableName}.updated_at)`;
    } else if (hasPv) {
      conflictClause = `WHERE excluded.payload_version >= ${tableName}.payload_version`;
    } else if (hasUpd) {
      conflictClause = `WHERE excluded.updated_at >= ${tableName}.updated_at`;
    }

    const sql = `
      INSERT INTO ${tableName} (${insertCols})
      VALUES (${placeholders})
      ON CONFLICT(id) DO UPDATE SET ${updateSet} ${conflictClause}
    `;

    try {
      const stmt = dbEngine.prepare(sql);
      for (const row of rows) {
        // Build values array based on exactly what the schema expects
        const values = colNames.map(c => row[c] === undefined ? null : row[c]);
        stmt.run(...values);
      }
    } catch (err) {
      console.error(`[LanMasterData] Error dynamicUpsert on ${tableName}:`, err.message);
    }
  }
}

export const lanMasterDataService = new LanMasterDataService();
