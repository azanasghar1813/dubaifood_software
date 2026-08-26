import { Router } from 'express';
import { getSyncStatus, triggerSync, getActiveDevices } from '../controllers/syncController.js';

const router = Router();

router.get('/status', getSyncStatus);
router.post('/trigger', triggerSync);
router.get('/devices', getActiveDevices);

export default router;
