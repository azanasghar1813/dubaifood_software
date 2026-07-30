import express from 'express';
import { permissionController } from '../controllers/permissionController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';

const router = express.Router();

// Both require MANAGE_ROLES permission to view the permission list
router.use(authenticate);
router.use(authorize('MANAGE_ROLES'));

router.get('/', permissionController.getAll);

export default router;
