import { dbEngine } from '../database/sqlite.js';
import { syncWorker } from '../sync/syncWorker.js';
import { configService } from '../services/configService.js';

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

    const syncConfig = configService.getSyncConfig();

    res.status(200).json({
      pending,
      failed,
      synced,
      isRunning: syncWorker.isRunning,
      nextRunDelay: syncWorker.currentDelayMs,
      deviceId: syncConfig.device_id || 'UNKNOWN_DEVICE'
    });
  } catch (error) {
    console.error('[SyncController] Status fetch failed:', error);
    res.status(500).json({ error: 'Failed to fetch sync status' });
  }
};

export const triggerSync = async (req, res) => {
  try {
    const result = await syncWorker.run();
    if (result && !result.success) {
      return res.status(400).json({ error: result.error || 'Sync failed' });
    }
    res.status(200).json({ 
      message: 'Sync completed successfully',
      pushed: result ? result.pushed : 0,
      pulled: result ? result.pulled : 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Failed to trigger sync' });
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
