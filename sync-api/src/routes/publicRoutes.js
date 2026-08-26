import express from 'express';
import { getPublicMenu, submitOnlineOrder } from '../controllers/publicController.js';

const router = express.Router();

// GET /api/v1/public/menu
router.get('/menu', getPublicMenu);

// POST /api/v1/public/order
router.post('/order', submitOnlineOrder);

export default router;
