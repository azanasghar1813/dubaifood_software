import { dbEngine } from '../database/sqlite.js';
import { syncWorker } from '../sync/syncWorker.js';
import { configService } from '../services/configService.js';
import { syncService } from '../services/syncService.js';

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
      currentPhase: syncWorker.currentPhase,
      logs: syncWorker.logs,
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

export const getSyncQueue = (req, res) => {
  try {
    const { status = 'FAILED', limit = 50 } = req.query;
    // ensure status is either FAILED or SYNCED
    if (!['FAILED', 'SYNCED', 'PENDING'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const data = syncService.getQueue(status, parseInt(limit, 10) || 50);
    res.status(200).json(data);
  } catch (error) {
    console.error('[SyncController] Failed to get sync queue:', error);
    res.status(500).json({ error: 'Failed to fetch sync queue' });
  }
};

export const retrySyncEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const success = syncService.retryEvent(id);
    if (!success) {
      return res.status(404).json({ error: 'Failed event not found or already retried' });
    }
    // Immediately trigger the background worker to try and push it
    syncWorker.run().catch(e => console.error('Error triggering syncWorker after retry:', e));
    res.status(200).json({ message: 'Event queued for retry' });
  } catch (error) {
    console.error('[SyncController] Failed to retry event:', error);
    res.status(500).json({ error: 'Failed to retry event' });
  }
};

export const retryAllSyncEvents = async (req, res) => {
  try {
    const success = syncService.retryAllEvents();
    if (!success) {
      return res.status(404).json({ error: 'No failed events found to retry' });
    }
    syncWorker.run().catch(e => console.error('Error triggering syncWorker after retryAll:', e));
    res.status(200).json({ message: 'All failed events queued for retry' });
  } catch (error) {
    console.error('[SyncController] Failed to retry all events:', error);
    res.status(500).json({ error: 'Failed to retry all events' });
  }
};

export const clearSyncQueue = async (req, res) => {
  try {
    syncService.clearQueue();
    res.status(200).json({ message: 'Sync queue cleared successfully' });
  } catch (error) {
    console.error('[SyncController] Failed to clear sync queue:', error);
    res.status(500).json({ error: 'Failed to clear sync queue' });
  }
};
