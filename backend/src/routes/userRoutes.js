import express from 'express';
import { userController } from '../controllers/userController.js';
import { authenticate } from '../middleware/authenticate.js';
import { authorize } from '../middleware/authorize.js';
import { uploadUserPhoto } from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.use(authenticate);

// Self-service route (doesn't require MANAGE_USERS, just an active session)
router.post('/change-pin', userController.changeMyPin);

// Admin routes
router.use(authorize('MANAGE_USERS'));

router.get('/', userController.getAll);
router.get('/:id', userController.getById);
router.post('/', userController.create);
router.put('/:id', userController.update);
router.patch('/:id/status', userController.updateStatus);
router.post('/:id/reset-pin', userController.resetPin);
router.post('/:id/photo', uploadUserPhoto.single('photo'), userController.uploadPhoto);

export default router;
