import { orderService } from '../services/orderService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const orderController = {
  getDraft: (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const draft = orderService.getOrCreateDraft(cashierSessionId, userId);
      sendSuccess(res, draft, 'Draft retrieved successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToDraft: async (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedDraft = await orderService.addItemToDraft(cashierSessionId, userId, req.body);
      sendSuccess(res, updatedDraft, 'Item added to draft');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: async (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedDraft = await orderService.updateItemQuantity(cashierSessionId, userId, req.params.itemId, req.body.quantity);
      sendSuccess(res, updatedDraft, 'Quantity updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItemFromDraft: async (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedDraft = await orderService.removeItemFromDraft(cashierSessionId, userId, req.params.itemId);
      sendSuccess(res, updatedDraft, 'Item removed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  holdOrder: (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const held = orderService.holdOrder(cashierSessionId, userId, req.body.holdName);
      sendSuccess(res, held, 'Order held');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getHeldOrders: (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    try {
      const heldOrders = orderService.getHeldOrders(cashierSessionId);
      sendSuccess(res, heldOrders, 'Held orders retrieved');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  resumeOrder: (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const resumed = orderService.resumeOrder(cashierSessionId, userId, req.params.orderId);
      sendSuccess(res, resumed, 'Order resumed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addPayment: (req, res) => {
    const cashierSessionId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const order = orderService.addPayment(req.params.orderId, cashierSessionId, userId, req.body);
      sendSuccess(res, order, 'Payment added');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  }
};
