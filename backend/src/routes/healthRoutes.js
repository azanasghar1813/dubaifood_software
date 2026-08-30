import { Router } from 'express';
import { checkHealth, claimDeviceId } from '../controllers/healthController.js';

const router = Router();

router.get('/', checkHealth);
router.post('/device-id', claimDeviceId);

export default router;
