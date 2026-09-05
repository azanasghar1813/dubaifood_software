import express from 'express';
import { activityLogController } from '../controllers/activityLogController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);
router.use(authorize(['VIEW_ACTIVITY_LOGS', 'MANAGE_SETTINGS']));

router.get('/', activityLogController.getLogs);

export default router;
