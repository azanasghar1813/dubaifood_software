import { cartService } from '../services/cartService.js';
import { orderCreationService } from '../services/orderCreationService.js';
import { sendSuccess, sendError } from '../utils/responseHandler.js';

const resolveCartContext = (req, res) => {
  const sessionId = req.headers['x-cashier-session-id'];
  const userId = req.headers['x-user-id'] || req.user?.userId;
  const branchId = req.headers['x-branch-id'] || 'DEFAULT_BRANCH';

  if (!sessionId) {
    sendError(res, 400, 'x-cashier-session-id header is required.');
    return null;
  }
  if (!userId) {
    sendError(res, 400, 'Authenticated user identity is required.');
    return null;
  }

  return { sessionId, userId, branchId };
};

export const cartController = {
  getCart: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const cart = cartService.getOrCreateCart(ctx.sessionId, ctx.userId, ctx.branchId, {
        order_type: req.query.order_type || 'DINE_IN'
      });
      sendSuccess(res, cart, 'Cart retrieved successfully.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  addItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.addItem(ctx.sessionId, ctx.userId, ctx.branchId, req.body);
      sendSuccess(res, updatedCart, 'Item added to cart.');
    } catch (error) {
      console.error("[CART ERROR]", error.message);
      sendError(res, 400, error.message);
    }
  },

  updateItemQuantity: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.updateItemQuantity(
        ctx.sessionId,
        req.params.cartItemId,
        Number(req.body.quantity),
        ctx.userId
      );
      sendSuccess(res, updatedCart, 'Cart item quantity updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  updateItemDetails: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.updateItemDetails(ctx.sessionId, req.params.cartItemId, req.body || {}, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  duplicateItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.duplicateItem(ctx.sessionId, req.params.cartItemId, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item duplicated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  removeItem: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const updatedCart = cartService.removeItem(ctx.sessionId, req.params.cartItemId, ctx.userId);
      sendSuccess(res, updatedCart, 'Cart item removed.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  setNotes: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.setNotes(sessionId, {
        notes: req.body.notes,
        kitchen_notes: req.body.kitchen_notes
      });
      sendSuccess(res, updatedCart, 'Cart notes updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  setMeta: (req, res) => {
    const sessionId = req.headers['x-cashier-session-id'];
    if (!sessionId) return sendError(res, 400, 'x-cashier-session-id header is required.');

    try {
      const updatedCart = cartService.setCartMeta(sessionId, {
        order_type: req.body.order_type,
        customer_id: req.body.customer_id,
        table_id: req.body.table_id
      });
      sendSuccess(res, updatedCart, 'Cart metadata updated.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  clearCart: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const clearedCart = cartService.clearCart(ctx.sessionId, ctx.userId);
      sendSuccess(res, clearedCart, 'Cart cleared.');
    } catch (error) {
      sendError(res, 400, error.message);
    }
  },

  checkout: (req, res) => {
    const ctx = resolveCartContext(req, res);
    if (!ctx) return;

    try {
      const order = orderCreationService.checkoutCart(ctx.sessionId, ctx.userId, req.body || {});
      sendSuccess(res, order, `Order ${order.order_number} created successfully.`, 201);
    } catch (error) {
      sendError(res, 400, error.message);
    }
  }
};
