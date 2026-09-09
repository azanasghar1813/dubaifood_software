import { Router } from 'express';
import { lanSyncService } from '../services/lanSyncService.js';
import { configService } from '../services/configService.js';

const router = Router();

router.get('/status', (req, res) => {
  try {
    const status = lanSyncService.getStatus();
    const config = configService.getSyncConfig();
    
    // Merge the current config into the status so the frontend can display the role/IP
    res.json({
      success: true,
      data: {
        ...status,
        deviceRole: config.device_role || 'HUB',
        hubIp: config.hub_ip || '',
        hubPort: config.hub_port || 5000,
        deviceId: config.device_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

import { lanMasterDataService } from '../services/lanMasterDataService.js';

router.post('/sync-master-data', async (req, res) => {
  try {
    const config = configService.getSyncConfig();
    const isHub = config.device_role !== 'TERMINAL';
    const hubUrl = isHub ? null : `http://${config.hub_ip}:${config.hub_port || 5000}`;
    
    // Fire and forget
    lanMasterDataService.processPendingSync(isHub, config.device_id, hubUrl);
    
    res.json({ success: true, message: 'Master data sync initiated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
