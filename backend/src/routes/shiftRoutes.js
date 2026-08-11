import express from 'express';
import { shiftController } from '../controllers/shiftController.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate);

router.get('/active', shiftController.getActiveShift);
router.post('/start', shiftController.startShift);
router.post('/close', shiftController.closeShift);
router.post('/cash-drop', shiftController.addCashDrop);
router.post('/paid-out', shiftController.addPaidOut);
router.get('/history', shiftController.getShiftHistory);

export default router;
