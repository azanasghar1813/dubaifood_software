import { Router } from 'express';
import { orderController } from '../controllers/orderController.js';
import { validate } from '../middleware/validationMiddleware.js';
import { z } from 'zod';

const router = Router();

// Validation schemas for order routes
const addItemSchema = z.object({
  product_id: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
  modifiers: z.array(z.any()).optional().default([]),
  notes: z.string().optional().nullable()
});

const updateQuantitySchema = z.object({
  quantity: z.number().int().min(1)
});

const holdOrderSchema = z.object({
  holdName: z.string().min(1, 'Hold name is required')
});

const addPaymentSchema = z.object({
  payment_method: z.string().min(1),
  amount: z.number().min(0),
  transaction_reference: z.string().optional().nullable()
});

// Get active draft order
router.get('/draft', orderController.getDraft);

// Add item to draft
router.post('/draft/items', validate(addItemSchema), orderController.addItemToDraft);

// Update item quantity in draft
router.put('/draft/items/:itemId', validate(updateQuantitySchema), orderController.updateItemQuantity);

// Remove item from draft
router.delete('/draft/items/:itemId', orderController.removeItemFromDraft);

// Hold order
router.post('/draft/hold', validate(holdOrderSchema), orderController.holdOrder);

// Get held orders
router.get('/held', orderController.getHeldOrders);

// Resume order
router.post('/resume/:orderId', orderController.resumeOrder);

// Add payment and complete
router.post('/:orderId/pay', validate(addPaymentSchema), orderController.addPayment);

export default router;
