import { orderService } from '../services/orderService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

const resolveSessionContext = (req, res, { requireShift = true } = {}) => {
  const shiftId = req.headers['x-cashier-session-id'];
  const userId = req.headers['x-user-id'] || req.user?.userId;

  if (requireShift && !shiftId) {
    sendError(res, 400, 'x-cashier-session-id header is required.');
    return null;
  }
  if (!userId) {
    sendError(res, 400, 'Authenticated user identity is required.');
    return null;
  }

  return { shiftId, userId };
};

export const orderController = {
  getDraft: (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const draft = orderService.getOrCreateDraft(ctx.shiftId, ctx.userId);
      sendSuccess(res, draft, 'Draft retrieved successfully');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  createOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const order = orderService.createDraftOrder(ctx.shiftId, ctx.userId, req.body);
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
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const updatedDraft = orderService.addItemToDraft(ctx.shiftId, ctx.userId, req.body);
      sendSuccess(res, updatedDraft, 'Item added to draft');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItemToOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.addItemToOrder(req.params.orderId, req.body, ctx.userId);
      sendSuccess(res, updatedOrder, 'Item added to order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.updateItemQuantity(req.params.orderId, req.params.itemId, req.body.quantity, ctx.userId);
      sendSuccess(res, updatedOrder, 'Item quantity updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItemFromOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.removeItem(req.params.orderId, req.params.itemId, ctx.userId);
      sendSuccess(res, updatedOrder, 'Item removed from order');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  holdOrder: (req, res) => {
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const heldOrder = orderService.holdOrder(ctx.shiftId, ctx.userId, req.body.holdName);
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
    const ctx = resolveSessionContext(req, res);
    if (!ctx) return;
    try {
      const resumedOrder = orderService.resumeOrder(ctx.shiftId, ctx.userId, req.params.orderId);
      sendSuccess(res, resumedOrder, 'Order resumed');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  transitionState: (req, res) => {
    const ctx = resolveSessionContext(req, res, { requireShift: false });
    if (!ctx) return;
    try {
      const updatedOrder = orderService.transitionOrderState(
        req.params.orderId,
        req.body.targetState,
        {
          userId: ctx.userId,
          reason: req.body.reason,
        }
      );
      sendSuccess(res, updatedOrder, 'Order state updated');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },
};
