import { dbEngine } from '../database/sqlite.js';
import { syncWorker } from '../sync/syncWorker.js';

export const getSyncStatus = async (req, res) => {
  try {
    const counts = dbEngine.prepare(`
      SELECT 
        status, COUNT(*) as count 
      FROM sync_queue 
      GROUP BY status
    `).all();

    let pending = 0;
    let failed = 0;
    let synced = 0;

    for (const row of counts) {
      if (row.status === 'PENDING') pending = row.count;
      if (row.status === 'FAILED') failed = row.count;
      if (row.status === 'SYNCED') synced = row.count;
    }

    res.status(200).json({
      pending,
      failed,
      synced,
      isRunning: syncWorker.isRunning,
      nextRunDelay: syncWorker.currentDelayMs
    });
  } catch (error) {
    console.error('[SyncController] Status fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
};

export const triggerSync = async (req, res) => {
  try {
    // Fire and forget
    syncWorker.run();
    res.status(200).json({ message: 'Sync triggered successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
};

export const getActiveDevices = (req, res) => {
  try {
    // This uses the global active devices map from app.js
    const activeDevices = global.activeDevices ? Array.from(global.activeDevices.values()) : [];
    
    // Sort by lastSeen descending
    activeDevices.sort((a, b) => b.lastSeen - a.lastSeen);
    
    res.status(200).json(activeDevices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
};
