import express from 'express';
import { activityLogController } from '../controllers/activityLogController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate);

router.get('/', activityLogController.getLogs);

export default router;
