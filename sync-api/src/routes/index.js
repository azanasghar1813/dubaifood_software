import express from 'express';
import multer from 'multer';
import { requireDeviceAuth } from '../middleware/auth.js';
import { pushSyncEvents, pullSyncEvents } from '../controllers/syncController.js';
import { uploadImage } from '../controllers/imageController.js';
import publicRoutes from './publicRoutes.js';

const router = express.Router();

// Setup multer for memory storage (for image uploads to Cloudinary)
const upload = multer({ storage: multer.memoryStorage() });

// Public route for health check
router.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Mount public customer routes
router.use('/public', publicRoutes);

// All sync routes require valid device authentication
router.use('/sync', requireDeviceAuth);

// Sync endpoints
router.post('/sync/push', pushSyncEvents);
router.get('/sync/pull', pullSyncEvents);
router.post('/sync/upload-image', upload.single('image'), uploadImage);

export default router;
