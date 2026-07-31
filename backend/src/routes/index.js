import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import authRoutes from './authRoutes.js';
import userRoutes from './userRoutes.js';
import roleRoutes from './roleRoutes.js';
import permissionRoutes from './permissionRoutes.js';
import configRoutes from './configRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import orderRoutes from './orderRoutes.js';

const router = Router();

// Mount all routes here
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/roles', roleRoutes);
router.use('/permissions', permissionRoutes);
router.use('/config', configRoutes);
router.use('/catalog', catalogRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/orders', orderRoutes);

export default router;
