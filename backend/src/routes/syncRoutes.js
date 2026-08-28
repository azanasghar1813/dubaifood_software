import { Router } from 'express';
import { getSyncStatus, triggerSync, getActiveDevices, getSyncQueue, retrySyncEvent, retryAllSyncEvents, clearSyncQueue, reassignDeviceId, resolveConflict } from '../controllers/syncController.js';

const router = Router();

router.get('/status', getSyncStatus);
router.post('/trigger', triggerSync);
router.get('/devices', getActiveDevices);
router.get('/queue', getSyncQueue);
router.post('/retry/:id', retrySyncEvent);
router.post('/retry-all', retryAllSyncEvents);
router.post('/resolve/:id', resolveConflict);
router.delete('/clear-queue', clearSyncQueue);
router.post('/reassign-identity', reassignDeviceId);

export default router;
