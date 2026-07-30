import express from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

router.use(authenticate);

// Protected routes (require standard login access, but individual cards can be further protected on frontend,
// or we can attach role-based authorize middleware to specific endpoints if we want strict backend enforcement).
// For now, these are accessible by any authenticated user, and the frontend will conditionally render based on permissions.

router.get('/summary', dashboardController.getSummary);
router.get('/operations', dashboardController.getOperations);
router.get('/revenue', authorize('VIEW_REPORTS'), dashboardController.getRevenue);
router.get('/popular', dashboardController.getPopular);
router.get('/activity', dashboardController.getActivity);

export default router;
