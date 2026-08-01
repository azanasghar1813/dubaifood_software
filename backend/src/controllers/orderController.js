import { orderService } from '../services/orderService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

export const orderController = {
  getDraft: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const draft = orderService.getOrCreateDraft(shiftId, userId);
      sendSuccess(res, draft, 'Draft retrieved successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  createOrder: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const order = orderService.createDraftOrder(shiftId, userId, req.body);
      sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getOrderDetails: (req, res) => {
    try {
      const order = orderService.getOrderById(req.params.orderId);
      if (!order) {
        return sendError(res, 404, 'Order not found');
      }
      sendSuccess(res, order, 'Order details retrieved');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToDraft: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedDraft = orderService.addItemToDraft(shiftId, userId, req.body);
      sendSuccess(res, updatedDraft, 'Item added to draft');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToOrder: (req, res) => {
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedOrder = orderService.addItemToOrder(req.params.orderId, req.body, userId);
      sendSuccess(res, updatedOrder, 'Item added to order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: (req, res) => {
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedOrder = orderService.updateItemQuantity(req.params.orderId, req.params.itemId, req.body.quantity, userId);
      sendSuccess(res, updatedOrder, 'Item quantity updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItemFromOrder: (req, res) => {
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedOrder = orderService.removeItem(req.params.orderId, req.params.itemId, userId);
      sendSuccess(res, updatedOrder, 'Item removed from order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  holdOrder: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const heldOrder = orderService.holdOrder(shiftId, userId, req.body.holdName);
      sendSuccess(res, heldOrder, 'Order held successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  getHeldOrders: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || null;
    try {
      const heldOrders = orderService.getHeldOrders(shiftId);
      sendSuccess(res, heldOrders, 'Held orders retrieved');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  resumeOrder: (req, res) => {
    const shiftId = req.headers['x-cashier-session-id'] || 'mock-session-123';
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const resumedOrder = orderService.resumeOrder(shiftId, userId, req.params.orderId);
      sendSuccess(res, resumedOrder, 'Order resumed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  transitionState: (req, res) => {
    const userId = req.headers['x-user-id'] || 'mock-user-123';
    try {
      const updatedOrder = orderService.transitionOrderState(
        req.params.orderId,
        req.body.targetState,
        {
          userId,
          reason: req.body.reason,
          kitchenState: req.body.kitchenState,
          paymentState: req.body.paymentState
        }
      );
      sendSuccess(res, updatedOrder, `Order state transitioned to ${req.body.targetState}`);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  }
};
