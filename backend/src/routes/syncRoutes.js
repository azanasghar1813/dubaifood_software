import { Router } from 'express';
import { getSyncStatus, triggerSync, getActiveDevices, getSyncQueue, retrySyncEvent } from '../controllers/syncController.js';

const router = Router();

router.get('/status', getSyncStatus);
router.post('/trigger', triggerSync);
router.get('/devices', getActiveDevices);
router.get('/queue', getSyncQueue);
router.post('/retry/:id', retrySyncEvent);

export default router;
