import { Router } from 'express';
import { getSyncStatus, triggerSync, getActiveDevices, getSyncQueue, retrySyncEvent, retryAllSyncEvents, clearSyncQueue, reassignDeviceId, resolveConflict } from '../controllers/syncController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = Router();

router.use(authenticate);

router.get('/status', getSyncStatus);
router.get('/devices', getActiveDevices);
router.get('/queue', getSyncQueue);
router.post('/trigger', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), triggerSync);
router.post('/retry/:id', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), retrySyncEvent);
router.post('/retry-all', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), retryAllSyncEvents);
router.post('/resolve/:id', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), resolveConflict);
router.delete('/clear-queue', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), clearSyncQueue);
router.post('/reassign-identity', authorize(['VIEW_SYNC', 'MANAGE_SETTINGS']), reassignDeviceId);

export default router;
